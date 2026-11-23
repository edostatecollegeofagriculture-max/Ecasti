import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { neonPool } from './neon';

export type AcademicResultEventType =
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'INVALIDATED'
  | 'CANCELLED';

export interface CreateAcademicResultAttemptInput {
  studentId: string;
  courseId: string;
  academicSession: string;
  semester: 'First Semester' | 'Second Semester';
  attemptNumber: number;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  gradePoint: number;
  actorUserId: string;
  legacyResultId?: string;
  idempotencyKey: string;
}

export interface AcademicResultFilters {
  studentId?: string;
  courseId?: string;
  academicSession?: string;
  semester?: 'First Semester' | 'Second Semester';
}

export interface AcademicResultFreshness {
  sourceName: string;
  lastSuccessfulSyncAt: string | null;
  sourceWatermark: string | null;
  isComplete: boolean;
  isFresh: boolean;
  failureReason: string | null;
}

const MAX_SOURCE_AGE_MS = 24 * 60 * 60 * 1000;

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await neonPool.connect();
  let transactionOpen = false;
  let destroyClient = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const value = await work(client);
    await client.query('COMMIT');
    transactionOpen = false;
    return value;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        destroyClient = true;
      }
    }
    throw error;
  } finally {
    client.release(destroyClient);
  }
}

function requiredText(value: unknown, label: string, maxLength = 200): string {
  if (typeof value !== 'string') throw new Error(`${label} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

function score(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${label} must be a finite score between 0 and 100.`);
  }
  return parsed;
}

function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function mapFreshness(row: any): AcademicResultFreshness {
  const lastSuccessfulSyncAt = row.last_successful_sync_at
    ? new Date(row.last_successful_sync_at).toISOString()
    : null;
  const fresh = lastSuccessfulSyncAt !== null
    && Date.now() - new Date(lastSuccessfulSyncAt).getTime() <= MAX_SOURCE_AGE_MS;
  const isComplete = Boolean(row.is_complete);
  return {
    sourceName: String(row.source_name),
    lastSuccessfulSyncAt,
    sourceWatermark: row.source_watermark ? String(row.source_watermark) : null,
    isComplete,
    isFresh: isComplete && fresh,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
  };
}

/**
 * Reads the Neon source-freshness marker. A missing, incomplete or older-than-
 * 24-hour marker is not authoritative and must fail closed.
 */
export async function getAcademicResultSourceFreshness(): Promise<AcademicResultFreshness> {
  const result = await neonPool.query(
    `SELECT source_name, last_successful_sync_at, source_watermark,
            is_complete, failure_reason
       FROM academic_result_source_sync
      WHERE id = 'primary'`
  );
  if (!result.rows[0]) {
    throw new Error('Academic result source freshness has not been initialized.');
  }
  return mapFreshness(result.rows[0]);
}

/**
 * Creates a new immutable attempt and its first SUBMITTED event atomically.
 * The idempotency key makes retried requests safe.
 */
export async function createAcademicResultAttempt(input: CreateAcademicResultAttemptInput) {
  const studentId = requiredText(input.studentId, 'Student ID');
  const courseId = requiredText(input.courseId, 'Course ID');
  const academicSession = requiredText(input.academicSession, 'Academic session', 40);
  const actorUserId = requiredText(input.actorUserId, 'Actor ID');
  const idempotencyKey = requiredText(input.idempotencyKey, 'Idempotency key', 200);
  const semester = input.semester;
  if (semester !== 'First Semester' && semester !== 'Second Semester') {
    throw new Error('Semester is invalid.');
  }
  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) {
    throw new Error('Attempt number must be a positive integer.');
  }
  const caScore = score(input.caScore, 'CA score');
  const examScore = score(input.examScore, 'Exam score');
  const totalScore = score(input.totalScore, 'Total score');
  if (Math.abs(totalScore - (caScore + examScore)) > 0.01) {
    throw new Error('Total score must equal the CA score plus the exam score.');
  }
  const grade = requiredText(input.grade, 'Grade', 20);
  const gradePoint = Number(input.gradePoint);
  if (!Number.isFinite(gradePoint) || gradePoint < 0 || gradePoint > 5) {
    throw new Error('Grade point must be between 0 and 5.');
  }

  return inTransaction(async (client) => {
    const prior = await client.query(
      `SELECT id, result_attempt_id
         FROM academic_result_events
        WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    if (prior.rows[0]) {
      const attempt = await client.query(
        `SELECT id, student_id, course_id, academic_session, semester,
                attempt_number, ca_score, exam_score, total_score, grade,
                grade_point, created_at
           FROM academic_result_attempts
          WHERE id = $1`,
        [prior.rows[0].result_attempt_id]
      );
      if (!attempt.rows[0]) throw new Error('Idempotency record exists without its result attempt.');
      return { created: false, attempt: attempt.rows[0] };
    }

    const attemptId = newId('result-attempt');
    const eventId = newId('result-event');
    const inserted = await client.query(
      `INSERT INTO academic_result_attempts
         (id, legacy_result_id, student_id, course_id, academic_session,
          semester, attempt_number, ca_score, exam_score, total_score,
          grade, grade_point, entered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, student_id, course_id, academic_session, semester,
                 attempt_number, ca_score, exam_score, total_score, grade,
                 grade_point, created_at`,
      [
        attemptId,
        input.legacyResultId ? requiredText(input.legacyResultId, 'Legacy result ID') : null,
        studentId, courseId, academicSession, semester, input.attemptNumber,
        caScore, examScore, totalScore, grade, gradePoint, actorUserId,
      ]
    );
    await client.query(
      `INSERT INTO academic_result_events
         (id, result_attempt_id, event_type, actor_user_id, idempotency_key)
       VALUES ($1,$2,'SUBMITTED',$3,$4)`,
      [eventId, attemptId, actorUserId, idempotencyKey]
    );
    return { created: true, attempt: inserted.rows[0] };
  });
}

/**
 * Appends the next workflow event. The row lock serializes concurrent
 * transitions; the database trigger independently validates the sequence.
 */
export async function appendAcademicResultEvent(input: {
  resultAttemptId: string;
  eventType: AcademicResultEventType;
  actorUserId: string;
  idempotencyKey: string;
  reason?: string;
}) {
  const resultAttemptId = requiredText(input.resultAttemptId, 'Result attempt ID');
  const actorUserId = requiredText(input.actorUserId, 'Actor ID');
  const idempotencyKey = requiredText(input.idempotencyKey, 'Idempotency key', 200);
  const reason = input.reason?.trim() || null;
  if (!['SUBMITTED', 'VERIFIED', 'APPROVED', 'PUBLISHED', 'INVALIDATED', 'CANCELLED'].includes(input.eventType)) {
    throw new Error('Academic result event type is invalid.');
  }
  if ((input.eventType === 'INVALIDATED' || input.eventType === 'CANCELLED') && !reason) {
    throw new Error('A reason is required to invalidate or cancel a published result.');
  }

  return inTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id, result_attempt_id, event_type, actor_user_id, created_at
         FROM academic_result_events
        WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].result_attempt_id !== resultAttemptId
          || existing.rows[0].event_type !== input.eventType) {
        throw new Error('Idempotency key was already used for a different result event.');
      }
      return { created: false, event: existing.rows[0] };
    }

    const locked = await client.query(
      'SELECT id FROM academic_result_attempts WHERE id = $1 FOR UPDATE',
      [resultAttemptId]
    );
    if (!locked.rows[0]) throw new Error('Academic result attempt not found.');

    const inserted = await client.query(
      `INSERT INTO academic_result_events
         (id, result_attempt_id, event_type, actor_user_id, reason, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, result_attempt_id, event_type, actor_user_id, reason, created_at`,
      [newId('result-event'), resultAttemptId, input.eventType, actorUserId, reason, idempotencyKey]
    );
    return { created: true, event: inserted.rows[0] };
  });
}

/**
 * Lists immutable Neon attempts with their latest workflow event. This is an
 * operational read for migration/reconciliation and does not claim that the
 * legacy source has been fully synchronized.
 */
export async function listAcademicResultAttempts(filters: AcademicResultFilters = {}) {
  const values: unknown[] = [];
  const conditions: string[] = [];
  if (filters.studentId) {
    values.push(requiredText(filters.studentId, 'Student ID'));
    conditions.push(`a.student_id = ${values.length}`);
  }
  if (filters.courseId) {
    values.push(requiredText(filters.courseId, 'Course ID'));
    conditions.push(`a.course_id = ${values.length}`);
  }
  if (filters.academicSession) {
    values.push(requiredText(filters.academicSession, 'Academic session', 40));
    conditions.push(`a.academic_session = $ ${values.length}`.replace('$ ', '
 * complete and no older than 24 hours. This function is intentionally not
 * wired into progression routes until reconciliation and integration tests
 * prove the source is authoritative.
 */
export async function listAuthoritativePublishedAcademicResults(
  filters: AcademicResultFilters = {}
) {
  const freshness = await getAcademicResultSourceFreshness();
  if (!freshness.isFresh || !freshness.sourceWatermark) {
    throw new Error('AUTHORITATIVE_RESULT_SOURCE_UNAVAILABLE');
  }

  const values: unknown[] = [];
  const conditions: string[] = [];
  if (filters.studentId) {
    values.push(requiredText(filters.studentId, 'Student ID'));
    conditions.push(`student_id = $${values.length}`);
  }
  if (filters.courseId) {
    values.push(requiredText(filters.courseId, 'Course ID'));
    conditions.push(`course_id = $${values.length}`);
  }
  if (filters.academicSession) {
    values.push(requiredText(filters.academicSession, 'Academic session', 40));
    conditions.push(`academic_session = $${values.length}`);
  }
  if (filters.semester) {
    if (filters.semester !== 'First Semester' && filters.semester !== 'Second Semester') {
      throw new Error('Semester is invalid.');
    }
    values.push(filters.semester);
    conditions.push(`semester = $${values.length}`);
  }

  const result = await neonPool.query(
    `SELECT result_attempt_id, legacy_result_id, student_id, course_id,
            academic_session, semester, attempt_number, ca_score,
            exam_score, total_score, grade, grade_point, published_at
       FROM academic_authoritative_published_results
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY student_id, course_id, academic_session, semester, attempt_number`,
    values
  );
  return { freshness, results: result.rows };
}
));
  }
  if (filters.semester) {
    if (filters.semester !== 'First Semester' && filters.semester !== 'Second Semester') {
      throw new Error('Semester is invalid.');
    }
    values.push(filters.semester);
    conditions.push(`a.semester = ${values.length}`);
  }

  const result = await neonPool.query(
    `SELECT a.id AS result_attempt_id, a.legacy_result_id, a.student_id,
            a.course_id, a.academic_session, a.semester, a.attempt_number,
            a.ca_score, a.exam_score, a.total_score, a.grade, a.grade_point,
            a.entered_by, a.created_at,
            latest.event_type AS latest_event_type,
            latest.actor_user_id AS latest_event_actor_user_id,
            latest.reason AS latest_event_reason,
            latest.created_at AS latest_event_at
       FROM academic_result_attempts a
       LEFT JOIN LATERAL (
         SELECT e.event_type, e.actor_user_id, e.reason, e.created_at
           FROM academic_result_events e
          WHERE e.result_attempt_id = a.id
          ORDER BY e.event_sequence DESC
          LIMIT 1
       ) latest ON TRUE
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY a.student_id, a.course_id, a.academic_session,
               a.semester, a.attempt_number`,
    values
  );
  return result.rows;
}

/**
 * Returns published attempts only when the configured source watermark is
 * complete and no older than 24 hours. This function is intentionally not
 * wired into progression routes until reconciliation and integration tests
 * prove the source is authoritative.
 */
export async function listAuthoritativePublishedAcademicResults(
  filters: AcademicResultFilters = {}
) {
  const freshness = await getAcademicResultSourceFreshness();
  if (!freshness.isFresh || !freshness.sourceWatermark) {
    throw new Error('AUTHORITATIVE_RESULT_SOURCE_UNAVAILABLE');
  }

  const values: unknown[] = [];
  const conditions: string[] = [];
  if (filters.studentId) {
    values.push(requiredText(filters.studentId, 'Student ID'));
    conditions.push(`student_id = $${values.length}`);
  }
  if (filters.courseId) {
    values.push(requiredText(filters.courseId, 'Course ID'));
    conditions.push(`course_id = $${values.length}`);
  }
  if (filters.academicSession) {
    values.push(requiredText(filters.academicSession, 'Academic session', 40));
    conditions.push(`academic_session = $${values.length}`);
  }
  if (filters.semester) {
    if (filters.semester !== 'First Semester' && filters.semester !== 'Second Semester') {
      throw new Error('Semester is invalid.');
    }
    values.push(filters.semester);
    conditions.push(`semester = $${values.length}`);
  }

  const result = await neonPool.query(
    `SELECT result_attempt_id, legacy_result_id, student_id, course_id,
            academic_session, semester, attempt_number, ca_score,
            exam_score, total_score, grade, grade_point, published_at
       FROM academic_authoritative_published_results
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY student_id, course_id, academic_session, semester, attempt_number`,
    values
  );
  return { freshness, results: result.rows };
}
