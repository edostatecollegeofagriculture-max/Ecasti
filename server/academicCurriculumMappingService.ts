import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { neonPool } from './neon';

export type MappingReviewDecision = 'APPROVE' | 'REJECT';

export interface CreateCurriculumMappingInput {
  programmeId: string;
  cohortSession: string;
  preparedBy: string;
}

export interface CurriculumMappingSummary {
  id: string;
  programmeId: string;
  cohortSession: string;
  version: number;
  status: string;
  preparedBy: string;
  isCurrent: boolean;
  createdAt: string;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  courseCount: number;
}

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await neonPool.connect();
  let open = false;
  let destroy = false;
  try {
    await client.query('BEGIN');
    open = true;
    const result = await work(client);
    await client.query('COMMIT');
    open = false;
    return result;
  } catch (error) {
    if (open) {
      try {
        await client.query('ROLLBACK');
      } catch {
        destroy = true;
      }
    }
    throw error;
  } finally {
    client.release(destroy);
  }
}

function required(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string') throw new Error(`${label} is required.`);
  const result = value.trim();
  if (!result || result.length > max) throw new Error(`${label} is invalid.`);
  return result;
}

function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function mapSummary(row: any): CurriculumMappingSummary {
  return {
    id: String(row.id),
    programmeId: String(row.programme_id),
    cohortSession: String(row.cohort_session),
    version: Number(row.version),
    status: String(row.status),
    preparedBy: String(row.prepared_by),
    isCurrent: Boolean(row.is_current),
    createdAt: new Date(row.created_at).toISOString(),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    courseCount: Number(row.course_count ?? 0),
  };
}

export async function listCurriculumMappings(filters: {
  programmeId?: string;
  cohortSession?: string;
} = {}): Promise<CurriculumMappingSummary[]> {
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters.programmeId) {
    values.push(filters.programmeId);
    where.push(`m.programme_id = $${values.length}`);
  }
  if (filters.cohortSession) {
    values.push(filters.cohortSession);
    where.push(`m.cohort_session = $${values.length}`);
  }
  const result = await neonPool.query(
    `SELECT m.*,
            COUNT(mc.id)::int AS course_count
       FROM academic_curriculum_mappings m
       LEFT JOIN academic_curriculum_mapping_courses mc ON mc.mapping_id = m.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY m.id
      ORDER BY m.programme_id, m.cohort_session, m.version DESC`,
    values
  );
  return result.rows.map(mapSummary);
}

export async function getCurriculumMapping(mappingIdInput: string) {
  const mappingId = required(mappingIdInput, 'Mapping ID');
  const result = await neonPool.query(
    `SELECT m.*,
            COUNT(mc.id)::int AS course_count
       FROM academic_curriculum_mappings m
       LEFT JOIN academic_curriculum_mapping_courses mc ON mc.mapping_id = m.id
      WHERE m.id = $1
      GROUP BY m.id`,
    [mappingId]
  );
  if (!result.rows[0]) return null;

  const courses = await neonPool.query(
    `SELECT id, course_id AS "courseId",
            course_code_snapshot AS "courseCode",
            course_title_snapshot AS "courseTitle",
            course_level_snapshot AS level,
            semester_snapshot AS semester,
            credit_units_snapshot AS "creditUnits",
            is_compulsory_snapshot AS compulsory
       FROM academic_curriculum_mapping_courses
      WHERE mapping_id = $1
      ORDER BY course_level_snapshot, semester_snapshot, course_code_snapshot`,
    [mappingId]
  );
  return { ...mapSummary(result.rows[0]), courses: courses.rows };
}

export async function createCurriculumMapping(input: CreateCurriculumMappingInput) {
  const programmeId = required(input.programmeId, 'Programme ID');
  const cohortSession = required(input.cohortSession, 'Cohort session');
  const preparedBy = required(input.preparedBy, 'Preparer ID');

  return transaction(async (client) => {
    const lockKey = `${programmeId}:${cohortSession}`;
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [lockKey]
    );
    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version), 0)::int + 1 AS next_version
         FROM academic_curriculum_mappings
        WHERE programme_id = $1 AND cohort_session = $2`,
      [programmeId, cohortSession]
    );
    const id = newId('curriculum');
    const inserted = await client.query(
      `INSERT INTO academic_curriculum_mappings
         (id, programme_id, cohort_session, version, status, prepared_by)
       VALUES ($1, $2, $3, $4, 'DRAFT', $5)
       RETURNING *`,
      [id, programmeId, cohortSession, versionResult.rows[0].next_version, preparedBy]
    );
    return mapSummary({ ...inserted.rows[0], course_count: 0 });
  });
}

export async function addCurriculumCourse(
  mappingIdInput: string,
  course: {
    courseId: string;
    courseCode: string;
    courseTitle: string;
    level: string;
    semester: string;
    creditUnits: number;
    compulsory: boolean;
  }
) {
  const mappingId = required(mappingIdInput, 'Mapping ID');
  const courseId = required(course.courseId, 'Course ID');
  return transaction(async (client) => {
    const mapping = await client.query(
      'SELECT status FROM academic_curriculum_mappings WHERE id = $1 FOR UPDATE',
      [mappingId]
    );
    if (!mapping.rows[0]) throw new Error('Curriculum mapping not found.');
    if (mapping.rows[0].status !== 'DRAFT') throw new Error('Courses can only be changed while a mapping is in DRAFT status.');
    const id = newId('mapping-course');
    await client.query(
      `INSERT INTO academic_curriculum_mapping_courses
         (id, mapping_id, course_id, course_code_snapshot,
          course_title_snapshot, course_level_snapshot,
          semester_snapshot, credit_units_snapshot, is_compulsory_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, mappingId, courseId, course.courseCode, course.courseTitle,
       course.level, course.semester, course.creditUnits, course.compulsory]
    );
    return { id, mappingId, courseId };
  });
}

export async function removeCurriculumCourse(mappingIdInput: string, courseIdInput: string) {
  const mappingId = required(mappingIdInput, 'Mapping ID');
  const courseId = required(courseIdInput, 'Course ID');
  return transaction(async (client) => {
    const mapping = await client.query(
      'SELECT status FROM academic_curriculum_mappings WHERE id = $1 FOR UPDATE',
      [mappingId]
    );
    if (!mapping.rows[0]) throw new Error('Curriculum mapping not found.');
    if (mapping.rows[0].status !== 'DRAFT') throw new Error('Courses can only be changed while a mapping is in DRAFT status.');
    const deleted = await client.query(
      'DELETE FROM academic_curriculum_mapping_courses WHERE mapping_id = $1 AND course_id = $2 RETURNING id',
      [mappingId, courseId]
    );
    if (deleted.rowCount !== 1) throw new Error('Course is not part of this curriculum mapping.');
    return { mappingId, courseId, removed: true };
  });
}

export async function submitCurriculumMapping(mappingIdInput: string, actorIdInput: string) {
  const mappingId = required(mappingIdInput, 'Mapping ID');
  const actorId = required(actorIdInput, 'Actor ID');
  return transaction(async (client) => {
    const mapping = await client.query(
      'SELECT status, prepared_by FROM academic_curriculum_mappings WHERE id = $1 FOR UPDATE',
      [mappingId]
    );
    if (!mapping.rows[0]) throw new Error('Curriculum mapping not found.');
    if (mapping.rows[0].status !== 'DRAFT') throw new Error('Only a DRAFT mapping can be submitted.');
    if (mapping.rows[0].prepared_by !== actorId) throw new Error('Only the mapping preparer may submit this draft.');
    const count = await client.query(
      'SELECT COUNT(*)::int AS count FROM academic_curriculum_mapping_courses WHERE mapping_id = $1',
      [mappingId]
    );
    if (Number(count.rows[0].count) < 1) throw new Error('Add at least one course before submitting the mapping.');
    await client.query(
      `UPDATE academic_curriculum_mappings
          SET status = 'SUBMITTED', submitted_at = NOW()
        WHERE id = $1`,
      [mappingId]
    );
    await client.query(
      `INSERT INTO academic_curriculum_mapping_reviews
         (id, mapping_id, action, actor_user_id)
       VALUES ($1, $2, 'SUBMITTED', $3)`,
      [newId('mapping-review'), mappingId, actorId]
    );
    return { mappingId, status: 'SUBMITTED' as const };
  });
}

export async function reviewCurriculumMapping(
  mappingIdInput: string,
  reviewerIdInput: string,
  decision: MappingReviewDecision,
  reasonInput?: string
) {
  const mappingId = required(mappingIdInput, 'Mapping ID');
  const reviewerId = required(reviewerIdInput, 'Reviewer ID');
  const reason = reasonInput?.trim() || null;
  if (decision !== 'APPROVE' && decision !== 'REJECT') throw new Error('Review decision must be APPROVE or REJECT.');
  if (decision === 'REJECT' && !reason) throw new Error('A rejection reason is required.');

  return transaction(async (client) => {
    const mappingResult = await client.query(
      'SELECT * FROM academic_curriculum_mappings WHERE id = $1 FOR UPDATE',
      [mappingId]
    );
    const mapping = mappingResult.rows[0];
    if (!mapping) throw new Error('Curriculum mapping not found.');
    if (mapping.status !== 'SUBMITTED') throw new Error('Only a SUBMITTED mapping can be reviewed.');
    if (mapping.prepared_by === reviewerId) throw new Error('The preparer cannot review their own curriculum mapping.');

    const courseCount = await client.query(
      'SELECT COUNT(*)::int AS count FROM academic_curriculum_mapping_courses WHERE mapping_id = $1',
      [mappingId]
    );
    if (Number(courseCount.rows[0].count) < 1) throw new Error('A curriculum mapping must contain at least one course.');

    if (decision === 'APPROVE') {
      const current = await client.query(
        `SELECT id FROM academic_curriculum_mappings
          WHERE programme_id = $1 AND cohort_session = $2
            AND is_current = TRUE
          FOR UPDATE`,
        [mapping.programme_id, mapping.cohort_session]
      );
      const makeCurrent = current.rowCount === 0;
      await client.query(
        `UPDATE academic_curriculum_mappings
            SET status = 'APPROVED',
                approved_by = $2,
                approved_at = NOW(),
                is_current = $3
          WHERE id = $1`,
        [mappingId, reviewerId, makeCurrent]
      );
      await client.query(
        `INSERT INTO academic_curriculum_mapping_reviews
           (id, mapping_id, action, actor_user_id)
         VALUES ($1, $2, 'APPROVED', $3)`,
        [newId('mapping-review'), mappingId, reviewerId]
      );
      return {
        mappingId,
        status: 'APPROVED' as const,
        isCurrent: makeCurrent,
        activationPending: !makeCurrent,
        message: makeCurrent
          ? 'Curriculum mapping approved and set as current for this programme and cohort.'
          : 'Curriculum mapping approved. An existing current mapping remains active; student assignments must be transferred through the controlled cohort transition before this version can become current.',
      };
    }

    await client.query(
      `UPDATE academic_curriculum_mappings
          SET status = 'REJECTED', rejection_reason = $2
        WHERE id = $1`,
      [mappingId, reason]
    );
    await client.query(
      `INSERT INTO academic_curriculum_mapping_reviews
         (id, mapping_id, action, actor_user_id, reason)
       VALUES ($1, $2, 'REJECTED', $3, $4)`,
      [newId('mapping-review'), mappingId, reviewerId, reason]
    );
    return { mappingId, status: 'REJECTED' as const };
  });
}
