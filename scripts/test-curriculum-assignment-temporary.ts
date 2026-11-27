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
import { reviewStudentCurriculumException, submitStudentCurriculumException } from '../server/academicCurriculumExceptionService';
import { initializeStudentProgression, advanceStudentProgression, approveExtensionYearThreeManagementPass } from '../server/academicProgressionDecisionService';

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
      stageCode: 'ND_I',
      stageLabel: 'ND I',
      periodCode: 'FIRST_SEMESTER',
      periodLabel: 'First Semester',
      classification: 'COMPULSORY',
      legacyLevel: 'ND I',
      legacySemester: 'First Semester',
      creditUnits: 2,
    });
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-B-${tag}`,
      courseCode: 'TST102',
      courseTitle: 'Synthetic Required Course B',
      stageCode: 'ND_I',
      stageLabel: 'ND I',
      periodCode: 'SECOND_SEMESTER',
      periodLabel: 'Second Semester',
      classification: 'COMPULSORY',
      legacyLevel: 'ND I',
      legacySemester: 'Second Semester',
      creditUnits: 3,
    });
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-C-${tag}`,
      courseCode: 'TST201',
      courseTitle: 'Synthetic Required ND II Course C',
      stageCode: 'ND_II',
      stageLabel: 'ND II',
      periodCode: 'FIRST_SEMESTER',
      periodLabel: 'First Semester',
      classification: 'COMPULSORY',
      legacyLevel: 'ND II',
      legacySemester: 'First Semester',
      creditUnits: 2,
    });
    await submitCurriculumMapping(mapping.id, preparer);
    const approval = await reviewCurriculumMapping(mapping.id, reviewer, 'APPROVE');
    assert(approval.status === 'APPROVED' && approval.isCurrent, 'Synthetic mapping was not approved as current.');
    check('Synthetic mapping can be prepared, submitted, and approved through service workflow');

    const assigned = await assignStudentCurriculum({
      studentId, programmeId, cohortSession: cohort, assignedBy: preparer,
    });
    assert(assigned.status === 'ASSIGNED', 'REVIEW_REQUIRED student did not assign after mapping approval.');
    assert(assigned.requiredCourseCount === 3, 'Assignment did not copy both compulsory course snapshots.');
    check('REVIEW_REQUIRED ledger retries to ASSIGNED when a current mapping becomes available');

    const snapshot = await getStudentCurriculumAssignment(studentId);
    assert(snapshot.assignment?.mapping_id === mapping.id, 'Read method returned the wrong mapping.');
    assert(snapshot.courses.length === 3, 'Read method did not return all three course snapshots.');
    assert(snapshot.ledger?.status === 'ASSIGNED', 'Read method did not return ASSIGNED ledger state.');
    check('Assignment read returns matching mapping, all course snapshots, and ASSIGNED ledger');

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
    assert(counts.rows[0].assignments === 1 && counts.rows[0].courses === 3 && counts.rows[0].ledger_rows === 1,
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

    // Student-specific ADD_COURSE and EXCLUDE_COURSE exceptions.
    const addException = await submitStudentCurriculumException({
      studentId,
      courseId: `TEST-COURSE-ADD-${tag}`,
      action: 'ADD_COURSE',
      courseCode: 'TST201',
      courseTitle: 'Synthetic Exception Added Course',
      level: 'ND II',
      semester: 'First Semester',
      creditUnits: 2,
      submittedBy: preparer,
      reason: 'Synthetic test: additional compulsory course.',
    });
    let selfReviewRejected = false;
    try {
      await reviewStudentCurriculumException(addException.id, preparer, 'APPROVE');
    } catch (error) {
      selfReviewRejected = String(error).includes('submitter cannot review');
    }
    assert(selfReviewRejected, 'Exception submitter was allowed to review their own request.');
    const addApproval = await reviewStudentCurriculumException(addException.id, reviewer, 'APPROVE');
    assert(addApproval.status === 'APPROVED', 'ADD_COURSE exception was not approved.');
    const addedSnapshot = await neonPool.query(
      'SELECT is_required, mapping_course_id, exception_id FROM student_academic_required_courses WHERE student_id = $1 AND course_id = $2',
      [studentId, `TEST-COURSE-ADD-${tag}`]
    );
    assert(addedSnapshot.rows[0]?.is_required === true && addedSnapshot.rows[0]?.mapping_course_id === null && addedSnapshot.rows[0]?.exception_id === addException.id,
      'Approved ADD_COURSE exception did not create the correct required-course snapshot.');
    check('ADD_COURSE exception requires independent approval and adds a student-only required-course snapshot');

    const excludeException = await submitStudentCurriculumException({
      studentId,
      courseId: `TEST-COURSE-A-${tag}`,
      action: 'EXCLUDE_COURSE',
      courseCode: 'TST101',
      courseTitle: 'Synthetic Required Course A',
      level: 'ND I',
      semester: 'First Semester',
      creditUnits: 2,
      submittedBy: preparer,
      reason: 'Synthetic test: exclude mapped requirement.',
    });
    const excludeApproval = await reviewStudentCurriculumException(excludeException.id, reviewer, 'APPROVE');
    assert(excludeApproval.status === 'APPROVED', 'EXCLUDE_COURSE exception was not approved.');
    const excludedSnapshot = await neonPool.query(
      'SELECT is_required, mapping_course_id, exception_id FROM student_academic_required_courses WHERE student_id = $1 AND course_id = $2',
      [studentId, `TEST-COURSE-A-${tag}`]
    );
    assert(excludedSnapshot.rows[0]?.is_required === false && Boolean(excludedSnapshot.rows[0]?.mapping_course_id) && excludedSnapshot.rows[0]?.exception_id === excludeException.id,
      'Approved EXCLUDE_COURSE exception did not retain and mark the mapped snapshot as not required.');
    check('EXCLUDE_COURSE exception preserves the mapped snapshot and marks it not required');

    const rejectException = await submitStudentCurriculumException({
      studentId,
      courseId: `TEST-COURSE-B-${tag}`,
      action: 'EXCLUDE_COURSE',
      courseCode: 'TST102',
      courseTitle: 'Synthetic Required Course B',
      level: 'ND I',
      semester: 'Second Semester',
      creditUnits: 3,
      submittedBy: preparer,
      reason: 'Synthetic test: rejection path.',
    });
    const rejected = await reviewStudentCurriculumException(rejectException.id, reviewer, 'REJECT', 'Synthetic test rejection.');
    assert(rejected.status === 'REJECTED', 'Exception rejection did not persist REJECTED state.');
    const unchangedSnapshot = await neonPool.query(
      'SELECT is_required, exception_id FROM student_academic_required_courses WHERE student_id = $1 AND course_id = $2',
      [studentId, `TEST-COURSE-B-${tag}`]
    );
    assert(unchangedSnapshot.rows[0]?.is_required === true && unchangedSnapshot.rows[0]?.exception_id === null,
      'Rejected EXCLUDE_COURSE exception changed the effective course requirement.');
    check('Rejected exception leaves the student required-course snapshot unchanged');


    // Progression: ND I always advances, even with no passed courses.
    const initialProgression = await initializeStudentProgression({ studentId, programmeId, academicSession: 'TEST-SESSION-2025', decidedBy: preparer });
    assert(initialProgression.created && initialProgression.progression.current_stage === 'ND_I', 'Initial progression record was not created at ND_I.');
    const initialHistory = await neonPool.query('SELECT decided_by FROM academic_progression_history WHERE student_id = $1 AND decision_type = \'INITIAL_RECORD\'', [studentId]);
    assert(initialHistory.rows[0]?.decided_by === preparer, 'Initial progression history did not record its authenticated decision actor.');
    check('Progression initializes at ND I with an initial history event and actor attribution');

    const ndOneDecision = await advanceStudentProgression({
      studentId, academicSession: 'TEST-SESSION-2026', passedCourseIds: [],
      missingResultCourseIds: ['TEST-COURSE-B-' + tag, 'TEST-COURSE-ADD-' + tag, 'TEST-COURSE-C-' + tag], decidedBy: preparer,
    });
    assert(ndOneDecision.toStage === 'ND_II' && ndOneDecision.progressionStatus === 'ACTIVE', 'ND I student did not advance to ND II with outstanding courses.');
    assert(ndOneDecision.outstandingCourseIds.length === 1 && ndOneDecision.outstandingCourseIds[0] === `TEST-COURSE-B-${tag}`, 'ND I history must list only outstanding ND I requirements, not future ND II courses.');
    check('Every ND I student advances to ND II despite outstanding compulsory courses');

    const ndTwoDecision = await advanceStudentProgression({
      studentId, academicSession: 'TEST-SESSION-2027', passedCourseIds: [],
      missingResultCourseIds: ['TEST-COURSE-B-' + tag, 'TEST-COURSE-ADD-' + tag, 'TEST-COURSE-C-' + tag], decidedBy: preparer,
    });
    assert(ndTwoDecision.toStage === 'EXTENSION_1' && ndTwoDecision.progressionStatus === 'EXTENSION', 'ND II student with outstanding requirements did not enter Extension Year 1.');
    assert(ndTwoDecision.outstandingCourseIds.length === 3, 'ND II decision must evaluate all effective ND I and ND II requirements.');
    check('ND II students with outstanding ND I or ND II requirements enter Extension Year 1');

    const extensionTwo = await advanceStudentProgression({
      studentId, academicSession: 'TEST-SESSION-2028', passedCourseIds: [],
      missingResultCourseIds: ['TEST-COURSE-B-' + tag, 'TEST-COURSE-ADD-' + tag, 'TEST-COURSE-C-' + tag], decidedBy: preparer,
    });
    assert(extensionTwo.toStage === 'EXTENSION_2', 'Extension Year 1 did not advance to Extension Year 2.');
    const extensionThree = await advanceStudentProgression({
      studentId, academicSession: 'TEST-SESSION-2029', passedCourseIds: [],
      missingResultCourseIds: ['TEST-COURSE-B-' + tag, 'TEST-COURSE-ADD-' + tag, 'TEST-COURSE-C-' + tag], decidedBy: preparer,
    });
    assert(extensionThree.toStage === 'EXTENSION_3', 'Extension Year 2 did not advance to Extension Year 3.');
    check('Extension progression advances sequentially through Extension Years 2 and 3');

    const managementPass = await approveExtensionYearThreeManagementPass({
      studentId, academicSession: 'TEST-SESSION-2030', approverUserId: 'TEST-RECTOR',
      reason: 'Synthetic test: Rector-approved management pass.',
      outstandingCourseIds: ['TEST-COURSE-B-' + tag, 'TEST-COURSE-C-' + tag, 'TEST-COURSE-ADD-' + tag],
      missingResultCourseIds: ['TEST-COURSE-B-' + tag, 'TEST-COURSE-C-' + tag, 'TEST-COURSE-ADD-' + tag],
    });
    assert(managementPass.status === 'GRADUATED' && managementPass.decisionType === 'MANAGEMENT_APPROVED_PASS', 'Extension Year 3 management pass did not graduate the synthetic student.');
    const managementHistory = await neonPool.query('SELECT decided_by, approved_by, outstanding_course_ids, missing_result_course_ids FROM academic_progression_history WHERE id = $1', [managementPass.historyId]);
    assert(managementHistory.rows[0]?.decided_by === 'TEST-RECTOR' && managementHistory.rows[0]?.approved_by === 'TEST-RECTOR', 'Management-pass history did not record the Rector as both actor and approver.');
    assert(managementHistory.rows[0]?.outstanding_course_ids.length === 3 && managementHistory.rows[0]?.missing_result_course_ids.length === 3, 'Management-pass history did not preserve the outstanding and missing-result course lists.');
    check('Extension Year 3 management pass records Rector approval and immutable history');

    // A second synthetic student proves normal graduation is blocked until all
    // effective ND I and ND II required-course snapshots have passing results.
    const graduateStudentId = 'TEST-GRADUATE-' + tag;
    const graduateAssignment = await assignStudentCurriculum({ studentId: graduateStudentId, programmeId, cohortSession: cohort, assignedBy: preparer });
    assert(graduateAssignment.status === 'ASSIGNED', 'Second synthetic student curriculum assignment failed.');
    await initializeStudentProgression({ studentId: graduateStudentId, programmeId, academicSession: 'TEST-GRAD-2025', decidedBy: preparer });
    const graduateSnapshot = await getStudentCurriculumAssignment(graduateStudentId);
    const allGraduateCourseIds = graduateSnapshot.courses.map((course: any) => String(course.courseId));
    const ndOneCourseIds = graduateSnapshot.courses
      .filter((course: any) => course.level === 'ND I')
      .map((course: any) => String(course.courseId));
    const graduateNdOne = await advanceStudentProgression({
      studentId: graduateStudentId, academicSession: 'TEST-GRAD-2026', passedCourseIds: ndOneCourseIds,
      missingResultCourseIds: [], decidedBy: preparer,
    });
    assert(graduateNdOne.toStage === 'ND_II', 'ND I did not advance to ND II after all ND I courses were passed.');
    const graduateNdTwo = await advanceStudentProgression({
      studentId: graduateStudentId, academicSession: 'TEST-GRAD-2027', passedCourseIds: ndOneCourseIds,
      missingResultCourseIds: [], decidedBy: preparer,
    });
    assert(graduateNdTwo.toStage === 'EXTENSION_1', 'Student graduated without passing the ND II compulsory course.');
    const graduateExtension = await advanceStudentProgression({
      studentId: graduateStudentId, academicSession: 'TEST-GRAD-2028', passedCourseIds: allGraduateCourseIds,
      missingResultCourseIds: [], decidedBy: preparer,
    });
    assert(graduateExtension.toStage === 'GRADUATED', 'Student with all effective ND I and ND II requirements passed did not graduate through normal clearance.');
    check('Normal graduation occurs only after all effective ND I and ND II requirements are passed');
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
