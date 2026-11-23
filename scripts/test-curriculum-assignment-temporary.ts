import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { neonPool } from '../server/neon';
import {
  addCurriculumCourse,
  assignStudentCurriculum,
  createCurriculumMapping,
  getStudentCurriculumAssignment,
  reviewCurriculumMapping,
  submitCurriculumMapping,
} from '../server/academicCurriculumMappingService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  assert(connectionString, 'DATABASE_URL is missing.');
  const parsed = new URL(connectionString);
  const expectedHost = 'ep-blue-mud-bdm6m3i0-pooler.c-8.us-east-2.aws.neon.tech';
  assert(parsed.hostname === expectedHost, 'STOP: DATABASE_URL host is not the confirmed temporary Neon test branch.');
  assert(parsed.pathname.slice(1) === 'neondb', 'STOP: database name is not neondb.');

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const confirmation = await rl.question(
      'This writes synthetic test records to edocasti-migration006-test only. Type TEMPORARY to continue: '
    );
    assert(confirmation.trim() === 'TEMPORARY', 'Confirmation not provided. No test writes were made.');
  } finally {
    rl.close();
  }

  const tag = randomUUID().replace(/-/g, '').slice(0, 12);
  const programmeId = `TEST-PROG-${tag}`;
  const noMapProgrammeId = `TEST-NOMAP-${tag}`;
  const cohort = `TEST-COHORT-${tag}`;
  const studentId = `TEST-STUDENT-${tag}`;
  const failedStudentId = `TEST-FAILED-${tag}`;
  const preparer = `TEST-PREPARER-${tag}`;
  const reviewer = `TEST-REVIEWER-${tag}`;

  const passed: string[] = [];
  const check = (name: string) => { passed.push(name); console.log(`[PASS] ${name}`); };

  try {
    // No approved mapping: first attempt must be routed to Registrar review.
    const firstReview = await assignStudentCurriculum({
      studentId, programmeId, cohortSession: cohort, assignedBy: preparer,
    });
    assert(firstReview.status === 'REVIEW_REQUIRED', 'No-mapping assignment did not return REVIEW_REQUIRED.');
    check('No current mapping is routed to REVIEW_REQUIRED');

    const secondReview = await assignStudentCurriculum({
      studentId, programmeId, cohortSession: cohort, assignedBy: preparer,
    });
    assert(secondReview.status === 'REVIEW_REQUIRED', 'Repeated no-mapping attempt did not remain REVIEW_REQUIRED.');
    const reviewLedger = await neonPool.query(
      'SELECT status, attempt_count FROM academic_curriculum_assignment_ledger WHERE student_id = $1',
      [studentId]
    );
    assert(reviewLedger.rows[0]?.status === 'REVIEW_REQUIRED', 'No-mapping ledger state is incorrect.');
    assert(Number(reviewLedger.rows[0]?.attempt_count) === 2, 'No-mapping retry attempt_count should be 2.');
    check('REVIEW_REQUIRED retry is idempotent in state and increments attempt count');

    // Create and approve a synthetic mapping for that exact programme/cohort.
    const mapping = await createCurriculumMapping({
      programmeId, cohortSession: cohort, preparedBy: preparer,
    });
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-A-${tag}`,
      courseCode: 'TST101',
      courseTitle: 'Synthetic Required Course A',
      level: 'ND I',
      semester: 'First Semester',
      creditUnits: 2,
      compulsory: true,
    });
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-B-${tag}`,
      courseCode: 'TST102',
      courseTitle: 'Synthetic Required Course B',
      level: 'ND I',
      semester: 'Second Semester',
      creditUnits: 3,
      compulsory: true,
    });
    await submitCurriculumMapping(mapping.id, preparer);
    const approval = await reviewCurriculumMapping(mapping.id, reviewer, 'APPROVE');
    assert(approval.status === 'APPROVED' && approval.isCurrent, 'Synthetic mapping was not approved as current.');
    check('Synthetic mapping can be prepared, submitted, and approved through service workflow');

    const assigned = await assignStudentCurriculum({
      studentId, programmeId, cohortSession: cohort, assignedBy: preparer,
    });
    assert(assigned.status === 'ASSIGNED', 'REVIEW_REQUIRED student did not assign after mapping approval.');
    assert(assigned.requiredCourseCount === 2, 'Assignment did not copy both compulsory course snapshots.');
    check('REVIEW_REQUIRED ledger retries to ASSIGNED when a current mapping becomes available');

    const snapshot = await getStudentCurriculumAssignment(studentId);
    assert(snapshot.assignment?.mapping_id === mapping.id, 'Read method returned the wrong mapping.');
    assert(snapshot.courses.length === 2, 'Read method did not return exactly two course snapshots.');
    assert(snapshot.ledger?.status === 'ASSIGNED', 'Read method did not return ASSIGNED ledger state.');
    check('Assignment read returns matching mapping, two snapshots, and ASSIGNED ledger');

    const repeated = await assignStudentCurriculum({
      studentId, programmeId, cohortSession: cohort, assignedBy: preparer,
    });
    assert(repeated.status === 'ALREADY_ASSIGNED', 'Repeat assignment was not recognized as ALREADY_ASSIGNED.');
    assert(repeated.assignmentId === assigned.assignmentId, 'Repeat assignment created/returned a different assignment.');
    const counts = await neonPool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM student_academic_curriculum_assignments WHERE student_id = $1) AS assignments,
         (SELECT COUNT(*)::int FROM student_academic_required_courses WHERE student_id = $1) AS courses,
         (SELECT COUNT(*)::int FROM academic_curriculum_assignment_ledger WHERE student_id = $1) AS ledger_rows`,
      [studentId]
    );
    assert(counts.rows[0].assignments === 1 && counts.rows[0].courses === 2 && counts.rows[0].ledger_rows === 1,
      'Repeat assignment duplicated assignment, course snapshots, or ledger rows.');
    check('Repeated assignment creates no duplicate assignment, snapshots, or ledger');

    let mismatchRejected = false;
    try {
      await assignStudentCurriculum({
        studentId, programmeId: `${programmeId}-OTHER`, cohortSession: cohort, assignedBy: preparer,
      });
    } catch (error) {
      mismatchRejected = String(error).includes('different programme or admission cohort');
    }
    assert(mismatchRejected, 'Different-programme retry was not rejected.');
    check('Existing assignment rejects a conflicting programme/cohort retry');

    // Seed only a synthetic FAILED ledger row, then exercise FAILED -> PENDING -> REVIEW_REQUIRED.
    await neonPool.query(
      `INSERT INTO academic_curriculum_assignment_ledger
         (id, student_id, programme_id, cohort_session, idempotency_key,
          status, attempt_count, last_attempt_at, error_code)
       VALUES ($1,$2,$3,$4,$5,'FAILED',4,NOW(),'TEST_SYNTHETIC_FAILURE')`,
      [
        `TEST-LEDGER-${tag}`, failedStudentId, noMapProgrammeId, cohort,
        `curriculum-assignment:${failedStudentId}:${noMapProgrammeId}:${cohort}`,
      ]
    );
    const failedRetry = await assignStudentCurriculum({
      studentId: failedStudentId, programmeId: noMapProgrammeId,
      cohortSession: cohort, assignedBy: preparer,
    });
    assert(failedRetry.status === 'REVIEW_REQUIRED', 'FAILED ledger without mapping did not return REVIEW_REQUIRED.');
    const failedLedger = await neonPool.query(
      'SELECT status, attempt_count FROM academic_curriculum_assignment_ledger WHERE student_id = $1',
      [failedStudentId]
    );
    assert(failedLedger.rows[0]?.status === 'REVIEW_REQUIRED', 'FAILED ledger did not transition to REVIEW_REQUIRED.');
    assert(Number(failedLedger.rows[0]?.attempt_count) === 5, 'FAILED retry should increment attempt_count exactly once.');
    check('FAILED ledger safely transitions through PENDING to REVIEW_REQUIRED with one attempt increment');

    console.log(`\\nRESULT: ${passed.length} PASS, 0 FAIL`);
    console.log('All records use TEST-prefixed synthetic identifiers. This temporary branch can be discarded after review.');
  } finally {
    await neonPool.end();
  }
}

main().catch((error) => {
  console.error('TEST FAILED:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
