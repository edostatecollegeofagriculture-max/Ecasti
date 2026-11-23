import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { neonPool } from './neon';

export type StudentCurriculumExceptionAction = 'ADD_COURSE' | 'EXCLUDE_COURSE';
export type StudentCurriculumExceptionDecision = 'APPROVE' | 'REJECT';

export interface SubmitStudentCurriculumExceptionInput {
  studentId: string;
  courseId: string;
  action: StudentCurriculumExceptionAction;
  courseCode: string;
  courseTitle: string;
  level: string;
  semester: string;
  creditUnits: number;
  submittedBy: string;
  reason: string;
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
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
      try { await client.query('ROLLBACK'); } catch { destroy = true; }
    }
    throw error;
  } finally {
    client.release(destroy);
  }
}

function required(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string') throw new Error(`${label} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`${label} is invalid.`);
  return normalized;
}

function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export async function submitStudentCurriculumException(input: SubmitStudentCurriculumExceptionInput) {
  const studentId = required(input.studentId, 'Student ID', 200);
  const courseId = required(input.courseId, 'Course ID', 200);
  const submittedBy = required(input.submittedBy, 'Submitter ID', 200);
  const reason = required(input.reason, 'Exception reason');
  const courseCode = required(input.courseCode, 'Course code', 80);
  const courseTitle = required(input.courseTitle, 'Course title', 250);
  const level = required(input.level, 'Course level', 20);
  const semester = required(input.semester, 'Semester', 30);
  if (!['ADD_COURSE', 'EXCLUDE_COURSE'].includes(input.action)) throw new Error('Exception action must be ADD_COURSE or EXCLUDE_COURSE.');
  if (!['ND I', 'ND II'].includes(level)) throw new Error('Only ND I and ND II courses can be used for curriculum exceptions.');
  if (!['First Semester', 'Second Semester'].includes(semester)) throw new Error('Course semester is invalid.');
  if (!Number.isInteger(input.creditUnits) || input.creditUnits <= 0) throw new Error('Course credit units are invalid.');

  return inTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`student-curriculum-exception:${studentId}`]);
    const assignment = await client.query(
      `SELECT a.mapping_id, a.programme_id, a.cohort_session
         FROM student_academic_curriculum_assignments a
         JOIN academic_curriculum_mappings m ON m.id = a.mapping_id
        WHERE a.student_id = $1 AND a.is_current = TRUE
          AND m.status = 'APPROVED' AND m.is_current = TRUE
        FOR UPDATE OF a`,
      [studentId]
    );
    if (!assignment.rows[0]) throw new Error('The student must have a current approved curriculum assignment before submitting an exception.');
    const current = assignment.rows[0];

    const mappedCourse = await client.query(
      `SELECT id, course_code_snapshot, course_title_snapshot,
              course_level_snapshot, semester_snapshot, credit_units_snapshot
         FROM academic_curriculum_mapping_courses
        WHERE mapping_id = $1 AND course_id = $2`,
      [current.mapping_id, courseId]
    );
    if (input.action === 'EXCLUDE_COURSE') {
      const mapped = mappedCourse.rows[0];
      if (!mapped) throw new Error('EXCLUDE_COURSE must reference a compulsory course in the student current curriculum mapping.');
      if (
        mapped.course_code_snapshot !== courseCode ||
        mapped.course_title_snapshot !== courseTitle ||
        mapped.course_level_snapshot !== level ||
        mapped.semester_snapshot !== semester ||
        Number(mapped.credit_units_snapshot) !== input.creditUnits
      ) throw new Error('Course details do not match the assigned curriculum snapshot.');
      const requiredCourse = await client.query(
        `SELECT id, is_required FROM student_academic_required_courses
          WHERE student_id = $1 AND course_id = $2 FOR UPDATE`,
        [studentId, courseId]
      );
      if (!requiredCourse.rows[0] || !requiredCourse.rows[0].is_required) throw new Error('The mapped course is not currently an effective requirement for this student.');
    } else {
      if (mappedCourse.rows[0]) throw new Error('ADD_COURSE must be a course not already included in the assigned curriculum.');
      const duplicate = await client.query(
        'SELECT 1 FROM student_academic_required_courses WHERE student_id = $1 AND course_id = $2',
        [studentId, courseId]
      );
      if (duplicate.rowCount) throw new Error('This course already exists in the student requirement snapshot.');
    }

    const exceptionId = id('student-curriculum-exception');
    await client.query(
      `INSERT INTO academic_student_curriculum_exceptions
        (id, student_id, mapping_id, action, course_id, course_code_snapshot,
         course_title_snapshot, course_level_snapshot, semester_snapshot,
         credit_units_snapshot, is_compulsory_snapshot, reason, status, submitted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11,'SUBMITTED',$12)`,
      [exceptionId, studentId, current.mapping_id, input.action, courseId,
       courseCode, courseTitle, level, semester, input.creditUnits, reason, submittedBy]
    );
    await client.query(
      `INSERT INTO academic_student_curriculum_exception_reviews
        (id, exception_id, action, actor_user_id, reason)
       VALUES ($1,$2,'SUBMITTED',$3,$4)`,
      [id('exception-review'), exceptionId, submittedBy, reason]
    );
    return { id: exceptionId, studentId, mappingId: String(current.mapping_id), action: input.action, courseId, status: 'SUBMITTED' as const };
  });
}

export async function reviewStudentCurriculumException(
  exceptionIdInput: string,
  reviewerIdInput: string,
  decision: StudentCurriculumExceptionDecision,
  reviewReasonInput?: string
) {
  const exceptionId = required(exceptionIdInput, 'Exception ID', 200);
  const reviewerId = required(reviewerIdInput, 'Reviewer ID', 200);
  if (!['APPROVE', 'REJECT'].includes(decision)) throw new Error('Decision must be APPROVE or REJECT.');
  const reviewReason = reviewReasonInput?.trim() || null;
  if (decision === 'REJECT' && !reviewReason) throw new Error('A reason is required when rejecting an exception.');

  return inTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`student-curriculum-exception-review:${exceptionId}`]);
    const result = await client.query(
      'SELECT * FROM academic_student_curriculum_exceptions WHERE id = $1 FOR UPDATE',
      [exceptionId]
    );
    const exception = result.rows[0];
    if (!exception) throw new Error('Curriculum exception not found.');
    if (exception.status !== 'SUBMITTED') throw new Error('Only a SUBMITTED exception can be reviewed.');
    if (exception.submitted_by === reviewerId) throw new Error('The submitter cannot review their own curriculum exception.');

    const nextStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await client.query(
      `UPDATE academic_student_curriculum_exceptions
          SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_reason = $4
        WHERE id = $1`,
      [exceptionId, nextStatus, reviewerId, reviewReason]
    );
    await client.query(
      `INSERT INTO academic_student_curriculum_exception_reviews
        (id, exception_id, action, actor_user_id, reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [id('exception-review'), exceptionId, nextStatus, reviewerId, reviewReason]
    );

    if (decision === 'APPROVE' && exception.action === 'ADD_COURSE') {
      const assignment = await client.query(
        `SELECT programme_id, cohort_session
           FROM student_academic_curriculum_assignments
          WHERE student_id = $1 AND mapping_id = $2 AND is_current = TRUE
          FOR UPDATE`,
        [exception.student_id, exception.mapping_id]
      );
      if (!assignment.rows[0]) throw new Error('The student curriculum assignment is no longer current; Registry review is required.');
      await client.query(
        `INSERT INTO student_academic_required_courses
          (id, student_id, programme_id, cohort_session, course_id,
           course_code_snapshot, course_title_snapshot, course_level_snapshot,
           semester_snapshot, credit_units_snapshot, is_required, exception_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11)`,
        [id('student-required-course'), exception.student_id,
         assignment.rows[0].programme_id, assignment.rows[0].cohort_session,
         exception.course_id, exception.course_code_snapshot,
         exception.course_title_snapshot, exception.course_level_snapshot,
         exception.semester_snapshot, exception.credit_units_snapshot, exceptionId]
      );
    }

    if (decision === 'APPROVE' && exception.action === 'EXCLUDE_COURSE') {
      const updated = await client.query(
        `UPDATE student_academic_required_courses
            SET is_required = FALSE, exception_id = $3
          WHERE student_id = $1 AND course_id = $2
            AND mapping_course_id IS NOT NULL AND is_required = TRUE
          RETURNING id`,
        [exception.student_id, exception.course_id, exceptionId]
      );
      if (updated.rowCount !== 1) throw new Error('The mapped required course could not be excluded; Registry review is required.');
    }

    return { exceptionId, status: nextStatus, action: exception.action, studentId: String(exception.student_id) };
  });
}

export async function listStudentCurriculumExceptions(studentIdInput: string) {
  const studentId = required(studentIdInput, 'Student ID', 200);
  const result = await neonPool.query(
    `SELECT id, student_id AS "studentId", mapping_id AS "mappingId",
            action, course_id AS "courseId", course_code_snapshot AS "courseCode",
            course_title_snapshot AS "courseTitle", course_level_snapshot AS level,
            semester_snapshot AS semester, credit_units_snapshot AS "creditUnits",
            reason, status, submitted_by AS "submittedBy", submitted_at AS "submittedAt",
            reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
            review_reason AS "reviewReason"
       FROM academic_student_curriculum_exceptions
      WHERE student_id = $1
      ORDER BY submitted_at DESC`,
    [studentId]
  );
  return result.rows;
}
