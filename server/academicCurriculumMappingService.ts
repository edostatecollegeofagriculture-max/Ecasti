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
  programmeIds?: string[];
  cohortSession?: string;
} = {}): Promise<CurriculumMappingSummary[]> {
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters.programmeId) {
    values.push(filters.programmeId);
    where.push(`m.programme_id = $${values.length}`);
  } else if (filters.programmeIds) {
    if (filters.programmeIds.length === 0) return [];
    values.push(filters.programmeIds);
    where.push(`m.programme_id = ANY($${values.length}::text[])`);
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
      `SELECT COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE is_compulsory_snapshot = TRUE)::int AS compulsory_count
         FROM academic_curriculum_mapping_courses WHERE mapping_id = $1`,
      [mappingId]
    );
    if (Number(count.rows[0].count) < 1 || Number(count.rows[0].compulsory_count) < 1) throw new Error('Add at least one course, including at least one compulsory course, before submitting the mapping.');
    await client.query(
      `UPDATE academic_curriculum_mappings
          SET status = 'SUBMITTED', submitted_at = NOW()
        WHERE id = $1`,
      [mappingId]
    );
    await client.query(
      `INSERT INTO academic_curriculum_mapping_reviews
         (id, mapping_id, action, actor_user_id, reason)
       VALUES ($1, $2, 'SUBMITTED', $3, $4)`,
      [newId('mapping-review'), mappingId, actorId, 'Submitted for Registrar review']
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
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`curriculum-review:${mappingId}`]
    );
    const mappingResult = await client.query(
      'SELECT * FROM academic_curriculum_mappings WHERE id = $1 FOR UPDATE',
      [mappingId]
    );
    const mapping = mappingResult.rows[0];
    if (!mapping) throw new Error('Curriculum mapping not found.');
    if (mapping.status !== 'SUBMITTED') throw new Error('Only a SUBMITTED mapping can be reviewed.');
    if (mapping.prepared_by === reviewerId) throw new Error('The preparer cannot review their own curriculum mapping.');

    const courseCount = await client.query(
      `SELECT COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE is_compulsory_snapshot = TRUE)::int AS compulsory_count
         FROM academic_curriculum_mapping_courses WHERE mapping_id = $1`,
      [mappingId]
    );
    if (Number(courseCount.rows[0].count) < 1 || Number(courseCount.rows[0].compulsory_count) < 1) throw new Error('A curriculum mapping must contain at least one course, including at least one compulsory course.');

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


export interface AssignStudentCurriculumInput {
  studentId: string;
  programmeId: string;
  cohortSession: string;
  assignedBy: string;
}

export async function assignStudentCurriculum(input: AssignStudentCurriculumInput) {
  const studentId = required(input.studentId, 'Student ID');
  const programmeId = required(input.programmeId, 'Programme ID');
  const cohortSession = required(input.cohortSession, 'Cohort session');
  const assignedBy = required(input.assignedBy, 'Assigner ID');
  const ledgerIdempotencyKey = `curriculum-assignment:${studentId}:${programmeId}:${cohortSession}`;

  return transaction(async (client) => {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`student-curriculum-assignment:${studentId}`]
    );

    const existingAssignment = await client.query(
      `SELECT a.id, a.programme_id, a.cohort_session, a.mapping_id,
              a.is_current, a.assigned_at, a.assigned_by
         FROM student_academic_curriculum_assignments a
        WHERE a.student_id = $1
        ORDER BY a.is_current DESC, a.assigned_at DESC
        LIMIT 1
        FOR UPDATE`,
      [studentId]
    );
    if (existingAssignment.rows[0]) {
      const existing = existingAssignment.rows[0];
      if (
        existing.programme_id !== programmeId ||
        existing.cohort_session !== cohortSession
      ) {
        throw new Error('The student already has a curriculum assignment for a different programme or admission cohort. Registry review is required.');
      }
      const courseCount = await client.query(
        `SELECT COUNT(*)::int AS count
           FROM student_academic_required_courses
          WHERE student_id = $1 AND is_required = TRUE`,
        [studentId]
      );
      if (Number(courseCount.rows[0]?.count ?? 0) < 1) {
        throw new Error('An existing student assignment has no effective required-course snapshots. Registry review is required.');
      }
      if (existing.is_current) {
        const existingLedger = await client.query(
          `SELECT id, status, mapping_id
             FROM academic_curriculum_assignment_ledger
            WHERE student_id = $1 AND programme_id = $2 AND cohort_session = $3
            FOR UPDATE`,
          [studentId, programmeId, cohortSession]
        );
        if (existingLedger.rows[0]) {
          const currentLedger = existingLedger.rows[0];
          if (currentLedger.status === 'REVIEW_REQUIRED' || currentLedger.status === 'FAILED') {
            await client.query(
              `UPDATE academic_curriculum_assignment_ledger
                  SET status = 'PENDING',
                      mapping_id = NULL,
                      attempt_count = attempt_count + 1,
                      last_attempt_at = NOW(),
                      assigned_at = NULL,
                      review_reason = NULL,
                      error_code = NULL,
                      updated_at = NOW()
                WHERE id = $1`,
              [currentLedger.id]
            );
          }
          if (currentLedger.status !== 'ASSIGNED' || currentLedger.mapping_id !== existing.mapping_id) {
            await client.query(
              `UPDATE academic_curriculum_assignment_ledger
                  SET status = 'ASSIGNED', mapping_id = $2,
                      assigned_at = COALESCE(assigned_at, $3),
                      review_reason = NULL, error_code = NULL,
                      updated_at = NOW()
                WHERE id = $1`,
              [currentLedger.id, existing.mapping_id, existing.assigned_at]
            );
          }
        } else {
          await client.query(
            `INSERT INTO academic_curriculum_assignment_ledger
               (id, student_id, programme_id, cohort_session, idempotency_key,
                status, mapping_id, attempt_count, last_attempt_at, assigned_at)
             VALUES ($1, $2, $3, $4, $5, 'ASSIGNED', $6, 1, NOW(), $7)`,
            [newId('assignment-ledger'), studentId, programmeId, cohortSession, ledgerIdempotencyKey, existing.mapping_id, existing.assigned_at]
          );
        }
      }
      return {
        status: 'ALREADY_ASSIGNED' as const,
        assignmentId: String(existing.id),
        mappingId: String(existing.mapping_id),
        programmeId,
        cohortSession,
        isCurrent: Boolean(existing.is_current),
        requiredCourseCount: Number(courseCount.rows[0]?.count ?? 0),
      };
    }

    const ledgerResult = await client.query(
      `SELECT id, status
         FROM academic_curriculum_assignment_ledger
        WHERE student_id = $1
          AND programme_id = $2
          AND cohort_session = $3
        FOR UPDATE`,
      [studentId, programmeId, cohortSession]
    );
    const ledger = ledgerResult.rows[0];

    const mappingResult = await client.query(
      `SELECT id
         FROM academic_curriculum_mappings
        WHERE programme_id = $1
          AND cohort_session = $2
          AND status = 'APPROVED'
          AND is_current = TRUE
        ORDER BY version DESC
        LIMIT 1
        FOR SHARE`,
      [programmeId, cohortSession]
    );

    if (!mappingResult.rows[0]) {
      const reviewReason = 'No current approved curriculum mapping exists for this programme and admission cohort.';
      if (ledger?.status === 'ASSIGNED') {
        throw new Error('The assignment ledger indicates completion but no student assignment exists. Registry review is required.');
      }
      if (ledger) {
        if (ledger.status === 'FAILED') {
          await client.query(
            `UPDATE academic_curriculum_assignment_ledger
                SET status = 'PENDING',
                    mapping_id = NULL,
                    attempt_count = attempt_count + 1,
                    last_attempt_at = NOW(),
                    assigned_at = NULL,
                    review_reason = NULL,
                    error_code = NULL,
                    updated_at = NOW()
              WHERE id = $1`,
            [ledger.id]
          );
        }
        await client.query(
          `UPDATE academic_curriculum_assignment_ledger
              SET status = 'REVIEW_REQUIRED',
                  mapping_id = NULL,
                  attempt_count = attempt_count + CASE WHEN $3 THEN 0 ELSE 1 END,
                  last_attempt_at = NOW(),
                  assigned_at = NULL,
                  review_reason = $2,
                  error_code = NULL,
                  updated_at = NOW()
            WHERE id = $1`,
          [ledger.id, reviewReason, ledger.status === 'FAILED']
        );
      } else {
        await client.query(
          `INSERT INTO academic_curriculum_assignment_ledger
             (id, student_id, programme_id, cohort_session, idempotency_key,
              status, attempt_count, last_attempt_at, review_reason)
           VALUES ($1, $2, $3, $4, $5, 'REVIEW_REQUIRED', 1, NOW(), $6)`,
          [newId('assignment-ledger'), studentId, programmeId, cohortSession, ledgerIdempotencyKey, reviewReason]
        );
      }
      return {
        status: 'REVIEW_REQUIRED' as const,
        programmeId,
        cohortSession,
        message: reviewReason,
      };
    }

    const mappingId = String(mappingResult.rows[0].id);
    const mappingCourses = await client.query(
      `SELECT id, course_id, course_code_snapshot, course_title_snapshot,
              course_level_snapshot, semester_snapshot, credit_units_snapshot
         FROM academic_curriculum_mapping_courses
        WHERE mapping_id = $1
          AND is_compulsory_snapshot = TRUE
        ORDER BY course_level_snapshot, semester_snapshot, course_code_snapshot`,
      [mappingId]
    );
    if (Number(mappingCourses.rowCount ?? 0) < 1) {
      throw new Error('The current approved mapping has no compulsory course snapshots. Registry review is required.');
    }

    const assignmentId = newId('student-curriculum-assignment');
    await client.query(
      `INSERT INTO student_academic_curriculum_assignments
         (id, student_id, programme_id, cohort_session, mapping_id,
          is_current, assigned_by)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
      [assignmentId, studentId, programmeId, cohortSession, mappingId, assignedBy]
    );

    for (const course of mappingCourses.rows) {
      await client.query(
        `INSERT INTO student_academic_required_courses
           (id, student_id, programme_id, cohort_session, course_id,
            course_code_snapshot, course_title_snapshot, course_level_snapshot,
            semester_snapshot, credit_units_snapshot, is_required, mapping_course_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11)`,
        [
          newId('student-required-course'),
          studentId,
          programmeId,
          cohortSession,
          course.course_id,
          course.course_code_snapshot,
          course.course_title_snapshot,
          course.course_level_snapshot,
          course.semester_snapshot,
          course.credit_units_snapshot,
          course.id,
        ]
      );
    }

    if (ledger) {
      const retryingLedger = ledger.status === 'REVIEW_REQUIRED' || ledger.status === 'FAILED';
      if (retryingLedger) {
        await client.query(
          `UPDATE academic_curriculum_assignment_ledger
              SET status = 'PENDING',
                  mapping_id = NULL,
                  attempt_count = attempt_count + 1,
                  last_attempt_at = NOW(),
                  assigned_at = NULL,
                  review_reason = NULL,
                  error_code = NULL,
                  updated_at = NOW()
            WHERE id = $1`,
          [ledger.id]
        );
      }
      await client.query(
        `UPDATE academic_curriculum_assignment_ledger
            SET status = 'ASSIGNED',
                mapping_id = $2,
                attempt_count = attempt_count + CASE WHEN $3 THEN 0 ELSE 1 END,
                last_attempt_at = NOW(),
                assigned_at = NOW(),
                review_reason = NULL,
                error_code = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [ledger.id, mappingId, retryingLedger]
      );
    } else {
      await client.query(
        `INSERT INTO academic_curriculum_assignment_ledger
           (id, student_id, programme_id, cohort_session, idempotency_key,
            status, mapping_id, attempt_count, last_attempt_at, assigned_at)
         VALUES ($1, $2, $3, $4, $5, 'ASSIGNED', $6, 1, NOW(), NOW())`,
        [newId('assignment-ledger'), studentId, programmeId, cohortSession, ledgerIdempotencyKey, mappingId]
      );
    }

    return {
      status: 'ASSIGNED' as const,
      assignmentId,
      mappingId,
      programmeId,
      cohortSession,
      isCurrent: true,
      requiredCourseCount: Number(mappingCourses.rowCount ?? 0),
    };
  });
}

export async function getStudentCurriculumAssignment(studentIdInput: string) {
  const studentId = required(studentIdInput, 'Student ID');
  const assignmentResult = await neonPool.query(
    `SELECT a.id, a.student_id, a.programme_id, a.cohort_session,
            a.mapping_id, a.is_current, a.assigned_by, a.assigned_at,
            m.version AS mapping_version, m.status AS mapping_status
       FROM student_academic_curriculum_assignments a
       JOIN academic_curriculum_mappings m ON m.id = a.mapping_id
      WHERE a.student_id = $1
      ORDER BY a.is_current DESC, a.assigned_at DESC
      LIMIT 1`,
    [studentId]
  );
  const ledgerResult = await neonPool.query(
    `SELECT status, attempt_count, last_attempt_at, review_reason, assigned_at
       FROM academic_curriculum_assignment_ledger
      WHERE student_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [studentId]
  );
  if (!assignmentResult.rows[0]) {
    return {
      assignment: null,
      courses: [],
      ledger: ledgerResult.rows[0] ?? null,
    };
  }
  const assignment = assignmentResult.rows[0];
  const coursesResult = await neonPool.query(
    `SELECT id, course_id AS "courseId",
            course_code_snapshot AS "courseCode",
            course_title_snapshot AS "courseTitle",
            course_level_snapshot AS level,
            semester_snapshot AS semester,
            credit_units_snapshot AS "creditUnits",
            is_required AS "isRequired"
       FROM student_academic_required_courses
      WHERE student_id = $1
      ORDER BY course_level_snapshot, semester_snapshot, course_code_snapshot`,
    [studentId]
  );
  return {
    assignment,
    courses: coursesResult.rows,
    ledger: ledgerResult.rows[0] ?? null,
  };
}
