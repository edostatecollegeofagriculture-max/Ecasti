import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { neonPool } from './neon';

type Stage = 'ND_I' | 'ND_II' | 'EXTENSION_1' | 'EXTENSION_2' | 'EXTENSION_3' | 'GRADUATED';
type Status = 'ACTIVE' | 'EXTENSION' | 'GRADUATION_PENDING' | 'GRADUATED' | 'WITHDRAWN';

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await neonPool.connect();
  let open = false;
  try {
    await client.query('BEGIN');
    open = true;
    const value = await work(client);
    await client.query('COMMIT');
    open = false;
    return value;
  } catch (error) {
    if (open) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function required(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
    throw new Error(`${label} is required and must be valid.`);
  }
  return value.trim();
}

function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export async function initializeStudentProgression(input: {
  studentId: string;
  programmeId: string;
  academicSession: string;
  decidedBy: string;
}) {
  const studentId = required(input.studentId, 'Student ID');
  const programmeId = required(input.programmeId, 'Programme ID');
  const academicSession = required(input.academicSession, 'Academic session');
  const decidedBy = required(input.decidedBy, 'Decision maker');

  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`progression:${studentId}`]);
    const existing = await client.query(
      'SELECT programme_id, current_stage, progression_status, current_session, extension_year FROM student_academic_progression WHERE student_id = $1 FOR UPDATE',
      [studentId]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].programme_id !== programmeId) {
        throw new Error('The existing progression programme does not match the student programme.');
      }
      return { created: false, progression: existing.rows[0] };
    }

    const assignment = await client.query(
      `SELECT a.programme_id, COUNT(r.id)::int AS required_count
         FROM student_academic_curriculum_assignments a
         LEFT JOIN student_academic_required_courses r
           ON r.student_id = a.student_id AND r.is_required = TRUE
        WHERE a.student_id = $1 AND a.is_current = TRUE
        GROUP BY a.programme_id`,
      [studentId]
    );
    if (!assignment.rows[0]) throw new Error('A current approved curriculum assignment is required before progression can be initialized.');
    if (assignment.rows[0].programme_id !== programmeId) throw new Error('The curriculum assignment programme does not match the student programme.');
    if (Number(assignment.rows[0].required_count) < 1) throw new Error('The student has no effective required-course snapshots.');

    const progressionId = id('progression');
    const historyId = id('progression-history');
    await client.query(
      `INSERT INTO student_academic_progression
         (id, student_id, programme_id, current_stage, progression_status, current_session, extension_year)
       VALUES ($1, $2, $3, 'ND_I', 'ACTIVE', $4, 0)`,
      [progressionId, studentId, programmeId, academicSession]
    );
    await client.query(
      `INSERT INTO academic_progression_history
         (id, student_id, programme_id, from_stage, to_stage, from_status, to_status,
          academic_session, extension_year, decision_type, outstanding_course_ids,
          missing_result_course_ids, reason, decided_by, idempotency_key)
       VALUES ($1, $2, $3, NULL, 'ND_I', NULL, 'ACTIVE', $4, 0, 'INITIAL_RECORD',
               '[]'::jsonb, '[]'::jsonb, 'Initial ND academic progression record',
               $5, $6)`,
      [historyId, studentId, programmeId, academicSession, decidedBy, `progression-initial:${studentId}`]
    );
    return {
      created: true,
      progression: { id: progressionId, student_id: studentId, programme_id: programmeId,
        current_stage: 'ND_I' as Stage, progression_status: 'ACTIVE' as Status,
        current_session: academicSession, extension_year: 0 },
    };
  });
}

export async function advanceStudentProgression(input: {
  studentId: string;
  academicSession: string;
  passedCourseIds: string[];
  missingResultCourseIds: string[];
  decidedBy: string;
}) {
  const studentId = required(input.studentId, 'Student ID');
  const academicSession = required(input.academicSession, 'Academic session');
  const decidedBy = required(input.decidedBy, 'Decision maker');
  const passed = new Set(input.passedCourseIds.map((value) => required(value, 'Passed course ID')));
  const missing = new Set(input.missingResultCourseIds.map((value) => required(value, 'Missing-result course ID')));

  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`progression:${studentId}`]);
    const currentResult = await client.query(
      'SELECT * FROM student_academic_progression WHERE student_id = $1 FOR UPDATE',
      [studentId]
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error('Student progression has not been initialized.');
    if (current.progression_status === 'WITHDRAWN') throw new Error('Withdrawn students require an authorized correction workflow.');
    if (current.progression_status === 'GRADUATED') throw new Error('The student has already graduated.');
    if (current.current_session === academicSession) throw new Error('A progression decision has already been recorded for this academic session.');

    const snapshotResult = await client.query(
      `SELECT course_id, course_level_snapshot, programme_id FROM student_academic_required_courses
        WHERE student_id = $1 AND is_required = TRUE
        ORDER BY course_level_snapshot, semester_snapshot, course_code_snapshot`,
      [studentId]
    );
    const requiredIds = snapshotResult.rows.map((row: { course_id: string }) => String(row.course_id));
    if (!requiredIds.length) throw new Error('No effective required-course snapshots exist for this student.');
    if (snapshotResult.rows.some((row: { programme_id: string }) => row.programme_id !== current.programme_id)) {
      throw new Error('The progression programme does not match the student required-course snapshots.');
    }
    for (const courseId of passed) {
      if (!requiredIds.includes(courseId)) throw new Error('A passed course does not belong to the student required-course snapshots.');
    }
    for (const courseId of missing) {
      if (!requiredIds.includes(courseId)) throw new Error('A missing-result course does not belong to the student required-course snapshots.');
    }

    const fromStage = current.current_stage as Stage;
    // ND I history tracks only ND I courses; ND II and later decisions evaluate every effective requirement.
    const evaluatedIds = fromStage === 'ND_I'
      ? snapshotResult.rows
          .filter((row: { course_level_snapshot: string }) => row.course_level_snapshot === 'ND I')
          .map((row: { course_id: string }) => String(row.course_id))
      : requiredIds;
    const outstanding = evaluatedIds.filter((courseId: string) => !passed.has(courseId));
    const fromStatus = current.progression_status as Status;
    let toStage: Stage = fromStage;
    let toStatus: Status = fromStatus;
    let extensionYear = Number(current.extension_year);
    let decisionType: 'SESSION_ROLLOVER' | 'NORMAL_CLEARANCE' = 'SESSION_ROLLOVER';

    if (fromStage === 'ND_I') {
      // ND I students always advance to ND II, regardless of outstanding courses.
      toStage = 'ND_II';
      toStatus = 'ACTIVE';
      decisionType = 'SESSION_ROLLOVER';
    } else if (outstanding.length === 0) {
      toStage = 'GRADUATED';
      toStatus = 'GRADUATED';
      decisionType = 'NORMAL_CLEARANCE';
    } else if (fromStage === 'ND_II') {
      toStage = 'EXTENSION_1';
      toStatus = 'EXTENSION';
      extensionYear = 1;
    } else if (fromStage === 'EXTENSION_1') {
      toStage = 'EXTENSION_2';
      toStatus = 'EXTENSION';
      extensionYear = 2;
    } else if (fromStage === 'EXTENSION_2') {
      toStage = 'EXTENSION_3';
      toStatus = 'EXTENSION';
      extensionYear = 3;
    } else if (fromStage === 'EXTENSION_3') {
      toStage = 'EXTENSION_3';
      toStatus = 'EXTENSION';
      extensionYear = 3;
    } else {
      throw new Error('Unsupported progression stage.');
    }

    const historyId = id('progression-history');
    const key = `progression-decision:${studentId}:${academicSession}`;
    await client.query(
      `INSERT INTO academic_progression_history
         (id, student_id, programme_id, from_stage, to_stage, from_status, to_status,
          academic_session, extension_year, decision_type, outstanding_course_ids,
          missing_result_course_ids, reason, decided_by, approved_by, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,NULL,$15)`,
      [historyId, studentId, current.programme_id, fromStage, toStage, fromStatus, toStatus,
       academicSession, extensionYear, decisionType, JSON.stringify(outstanding),
       JSON.stringify([...missing].filter((courseId) => outstanding.includes(courseId))),
       fromStage === 'ND_I'
         ? 'ND I to ND II progression; outstanding ND I courses remain required.'
         : outstanding.length === 0
           ? 'All effective ND I and ND II required courses have published passing results.'
           : 'Outstanding required courses carried forward into the extension pathway.',
       decidedBy, key]
    );
    await client.query(
      `UPDATE student_academic_progression
          SET current_stage = $2, progression_status = $3, current_session = $4,
              extension_year = $5, updated_at = NOW()
        WHERE student_id = $1`,
      [studentId, toStage, toStatus, academicSession, extensionYear]
    );

    return {
      studentId, fromStage, toStage, progressionStatus: toStatus,
      academicSession, extensionYear, requiredCourseCount: requiredIds.length,
      passedCourseCount: passed.size, outstandingCourseIds: outstanding,
      missingResultCourseIds: [...missing].filter((courseId) => outstanding.includes(courseId)),
      historyId,
    };
  });
}

export async function approveExtensionYearThreeManagementPass(input: {
  studentId: string;
  academicSession: string;
  rectorUserId: string;
  reason: string;
  outstandingCourseIds: string[];
  missingResultCourseIds: string[];
}) {
  const studentId = required(input.studentId, 'Student ID');
  const academicSession = required(input.academicSession, 'Academic session');
  const rectorUserId = required(input.rectorUserId, 'Rector ID');
  const reason = required(input.reason, 'Management-pass reason');
  const outstandingCourseIds = [...new Set(input.outstandingCourseIds.map((value) => required(value, 'Outstanding course ID')))];
  const missingResultCourseIds = [...new Set(input.missingResultCourseIds.map((value) => required(value, 'Missing-result course ID')))];
  if (!outstandingCourseIds.length) throw new Error('Management pass is available only when required courses remain outstanding.');
  if (missingResultCourseIds.some((courseId) => !outstandingCourseIds.includes(courseId))) {
    throw new Error('Missing-result courses must also be listed as outstanding.');
  }

  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`progression:${studentId}`]);
    const result = await client.query(
      'SELECT * FROM student_academic_progression WHERE student_id = $1 FOR UPDATE',
      [studentId]
    );
    const current = result.rows[0];
    if (!current) throw new Error('Student progression record not found.');
    if (current.current_stage !== 'EXTENSION_3' || current.progression_status !== 'EXTENSION' || Number(current.extension_year) !== 3) {
      throw new Error('Management pass is available only to students currently in Extension Year 3.');
    }

    const requiredResult = await client.query(
      `SELECT course_id, programme_id FROM student_academic_required_courses
        WHERE student_id = $1 AND is_required = TRUE`,
      [studentId]
    );
    const requiredIds = new Set(requiredResult.rows.map((row: { course_id: string }) => String(row.course_id)));
    if (!requiredIds.size) throw new Error('No effective required-course snapshots exist for this student.');
    if (requiredResult.rows.some((row: { programme_id: string }) => row.programme_id !== current.programme_id)) {
      throw new Error('The progression programme does not match the student required-course snapshots.');
    }
    if (outstandingCourseIds.some((courseId) => !requiredIds.has(courseId))) {
      throw new Error('An outstanding course does not belong to the student required-course snapshots.');
    }

    const historyId = id('progression-history');
    const key = `management-pass:${studentId}`;
    await client.query(
      `INSERT INTO academic_progression_history
         (id, student_id, programme_id, from_stage, to_stage, from_status, to_status,
          academic_session, extension_year, decision_type, outstanding_course_ids,
          missing_result_course_ids, reason, decided_by, approved_by, idempotency_key)
       VALUES ($1,$2,$3,'EXTENSION_3','GRADUATED','EXTENSION','GRADUATED',
               $4,3,'MANAGEMENT_APPROVED_PASS',$5::jsonb,$6::jsonb,$7,$8,$8,$9)`,
      [historyId, studentId, current.programme_id, academicSession,
       JSON.stringify(outstandingCourseIds), JSON.stringify(missingResultCourseIds),
       reason, rectorUserId, key]
    );
    await client.query(
      `UPDATE student_academic_progression
          SET current_stage = 'GRADUATED', progression_status = 'GRADUATED',
              current_session = $2, updated_at = NOW()
        WHERE student_id = $1`,
      [studentId, academicSession]
    );
    await client.query(
      `INSERT INTO academic_management_pass_approvals
         (id, student_id, extension_year, approved_by, approval_reason, history_id)
       VALUES ($1,$2,3,$3,$4,$5)`,
      [id('management-pass-approval'), studentId, rectorUserId, reason, historyId]
    );
    return { studentId, status: 'GRADUATED' as const, decisionType: 'MANAGEMENT_APPROVED_PASS' as const, historyId };
  });
}
