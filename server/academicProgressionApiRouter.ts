import { Router, Response } from 'express';
import { db } from './db';
import { AuthenticatedRequest, authenticateToken, requireRoles } from './authMiddleware';
import { neonPool } from './neon';
import { academicCurriculumMappingApiRouter } from './academicCurriculumMappingApiRouter';
import { assignStudentCurriculum, getStudentCurriculumAssignment } from './academicCurriculumMappingService';
import { listStudentCurriculumExceptions, reviewStudentCurriculumException, submitStudentCurriculumException } from './academicCurriculumExceptionService';
import { initializeStudentProgression, advanceStudentProgression, approveExtensionYearThreeManagementPass } from './academicProgressionDecisionService';
import { evaluateCourseResults } from './academicResultEvaluation';
import { listAuthoritativePublishedAcademicResults } from './academicResultNeonService';
import { canApproveExtensionYearThreeManagementPass, canReadStudentAcademicRecord, canSubmitOwnStudentException } from './academicProgressionAuthorization';

type RequiredCourseRow = {
  student_id: string;
  programme_id: string;
  course_id: string;
  course_code_snapshot: string;
  course_title_snapshot: string;
  course_level_snapshot: string;
  semester_snapshot: string;
  credit_units_snapshot: number;
};

type CourseStatus = 'PASSED' | 'FAILED' | 'MISSING_RESULT' | 'UNPUBLISHED_RESULT';

const PASS_MARK = 40;

// Progression must never use the legacy JSON result store as an authority.
// Keep this hard-disabled until published attempts, invalidations and source
// freshness are implemented and verified in Neon with integration coverage.
const AUTHORITATIVE_RESULT_SOURCE_READY = false;

function requireAuthoritativeResultSource(res: Response): boolean {
  if (AUTHORITATIVE_RESULT_SOURCE_READY) return true;
  res.status(503).json({
    success: false,
    code: 'AUTHORITATIVE_RESULT_SOURCE_UNAVAILABLE',
    message: 'Academic eligibility and progression are temporarily unavailable until published results and their freshness are verified from the authoritative Neon result source.',
  });
  return false;
}

export const academicProgressionApiRouter = Router();
academicProgressionApiRouter.use('/curriculum', academicCurriculumMappingApiRouter);

/**
 * Read-only ND eligibility preview based on the student's assigned
 * curriculum snapshots and freshness-verified published results in Neon.
 *
 * This endpoint deliberately performs no writes and does not advance
 * progression state. Migration 006 must be installed before it is used.
 */
academicProgressionApiRouter.get(
  '/students/:studentId/snapshot-eligibility',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'RECTOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const studentId = String(req.params.studentId || '').trim();

    if (!studentId || studentId.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'A valid student ID is required.',
      });
    }

    if (!requireAuthoritativeResultSource(res)) return;
    const state = db.getState();
    const student = state.students.find((item) => item.id === studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found.',
      });
    }

    const programme = state.programmes.find(
      (item) => item.id === student.programmeId
    );

    if (programme?.qualification !== 'ND') {
      return res.status(422).json({
        success: false,
        message: 'Snapshot eligibility is currently defined for National Diploma students only.',
      });
    }

    try {
      const requiredResult = await neonPool.query<RequiredCourseRow>(
        `SELECT
           student_id,
           programme_id,
           course_id,
           course_code_snapshot,
           course_title_snapshot,
           course_level_snapshot,
           semester_snapshot,
           credit_units_snapshot
         FROM student_academic_required_courses
         WHERE student_id = $1
           AND is_required = TRUE
         ORDER BY course_level_snapshot, semester_snapshot, course_code_snapshot`,
        [studentId]
      );

      const requiredCourses = requiredResult.rows;

      if (requiredCourses.length === 0) {
        return res.json({
          success: true,
          eligibility: {
            studentId,
            programmeId: student.programmeId,
            eligible: false,
            eligibilityBasis: 'STUDENT_CURRICULUM_SNAPSHOT',
            configurationValid: false,
            passMark: PASS_MARK,
            requiredCourseCount: 0,
            passedCourseCount: 0,
            outstandingCourseCount: 0,
            missingResultCount: 0,
            unpublishedResultCount: 0,
            failedCourseCount: 0,
            courses: [],
            warnings: [
              'No effective required-course snapshots are assigned to this student. Graduation eligibility cannot be confirmed.',
            ],
          },
        });
      }

      if (requiredCourses.some((course) => course.programme_id !== student.programmeId)) {
        return res.status(409).json({
          success: false,
          message: 'The student curriculum snapshot does not match the student programme. Registry review is required.',
        });
      }

      const authoritative = await listAuthoritativePublishedAcademicResults({ studentId });
      const courses = requiredCourses.map((course) => {
        const courseResults = authoritative.results
          .filter((result: any) => result.course_id === course.course_id)
          .map((result: any) => ({
            status: 'PUBLISHED' as const,
            totalScore: result.total_score,
            grade: result.grade,
            session: result.academic_session,
            semester: result.semester,
          }));
        const evaluation = evaluateCourseResults(courseResults, PASS_MARK);

        return {
          courseId: course.course_id,
          code: course.course_code_snapshot,
          title: course.course_title_snapshot,
          level: course.course_level_snapshot,
          semester: course.semester_snapshot,
          creditUnits: Number(course.credit_units_snapshot),
          status: evaluation.status,
          ...(evaluation.publishedScore === undefined ? {} : { publishedScore: evaluation.publishedScore }),
          ...(evaluation.publishedGrade === undefined ? {} : { publishedGrade: evaluation.publishedGrade }),
        };
      });

      const passedCourseCount = courses.filter(
        (course) => course.status === 'PASSED'
      ).length;
      const failedCourseCount = courses.filter(
        (course) => course.status === 'FAILED'
      ).length;
      const missingResultCount = courses.filter(
        (course) => course.status === 'MISSING_RESULT'
      ).length;
      const unpublishedResultCount = courses.filter(
        (course) => course.status === 'UNPUBLISHED_RESULT'
      ).length;
      const outstandingCourseCount = courses.length - passedCourseCount;

      const warnings: string[] = [];
      if (outstandingCourseCount > 0) {
        warnings.push(
          'One or more required courses remain outstanding, have no result, or have no published result.'
        );
      }
      warnings.push(
        'This is a read-only course-requirement evaluation. It does not change the student progression record or constitute final institutional clearance.'
      );

      return res.json({
        success: true,
        eligibility: {
          studentId,
          programmeId: student.programmeId,
          eligible: outstandingCourseCount === 0,
          eligibilityBasis: 'STUDENT_CURRICULUM_SNAPSHOT',
          configurationValid: true,
          passMark: PASS_MARK,
          requiredCourseCount: courses.length,
          passedCourseCount,
          outstandingCourseCount,
          missingResultCount,
          unpublishedResultCount,
          failedCourseCount,
          courses,
          warnings,
        },
      });
    } catch {
      // Keep schema/connection details out of the public API response.
      return res.status(503).json({
        success: false,
        message: 'Academic curriculum snapshot data is unavailable. Confirm that migration 006 has been reviewed and installed.',
      });
    }
  }
);



/**
 * Assigns the current approved ND curriculum to a student and creates
 * immutable required-course snapshots plus an assignment-ledger entry.
 * The service performs all database writes in one transaction.
 */
academicProgressionApiRouter.post(
  '/students/:studentId/curriculum-assignment',
  authenticateToken,
  requireRoles('INSTITUTION_ADMIN', 'REGISTRAR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const studentId = String(req.params.studentId || '').trim();
    if (!studentId || studentId.length > 200) {
      return res.status(400).json({ success: false, message: 'A valid student ID is required.' });
    }

    const state = db.getState();
    const student = state.students.find((item) => item.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });

    const programme = state.programmes.find((item) => item.id === student.programmeId);
    if (programme?.qualification !== 'ND') {
      return res.status(422).json({ success: false, message: 'Automated curriculum assignment currently supports National Diploma students only.' });
    }
    if (!student.sessionAdmitted || !student.programmeId) {
      return res.status(422).json({ success: false, message: 'The student programme and admission cohort must be complete before curriculum assignment.' });
    }

    try {
      const result = await assignStudentCurriculum({
        studentId: student.id,
        programmeId: student.programmeId,
        cohortSession: student.sessionAdmitted,
        assignedBy: req.user!.id,
      });
      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        action: result.status === 'REVIEW_REQUIRED' ? 'STUDENT_CURRICULUM_ASSIGNMENT_REVIEW_REQUIRED' : 'STUDENT_CURRICULUM_ASSIGNED',
        resource: 'STUDENT_ACADEMIC_CURRICULUM',
        details: {
          studentId: student.id,
          programmeId: student.programmeId,
          cohortSession: student.sessionAdmitted,
          assignmentId: 'assignmentId' in result ? result.assignmentId : undefined,
          mappingId: 'mappingId' in result ? result.mappingId : undefined,
          status: result.status,
        },
        ipAddress: req.ip,
      });
      return res.status(result.status === 'REVIEW_REQUIRED' ? 202 : 200).json({
        success: true,
        assignment: result,
      });
    } catch (error) {
      if (error instanceof Error && /already has a curriculum assignment|existing student assignment|no compulsory course snapshots/i.test(error.message)) {
        return res.status(409).json({ success: false, message: error.message });
      }
      return res.status(503).json({
        success: false,
        message: 'Curriculum assignment could not be completed. No partial assignment was committed; verify the temporary database and review the assignment constraints.',
      });
    }
  }
);

/**
 * Returns the student's assignment, immutable course snapshots and ledger
 * status. Programme/school/department scope is enforced before querying Neon.
 */
academicProgressionApiRouter.get(
  '/students/:studentId/curriculum-assignment',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'RECTOR', 'DEAN', 'HOD', 'EXAM_OFFICER', 'STUDENT'),
  async (req: AuthenticatedRequest, res: Response) => {
    const studentId = String(req.params.studentId || '').trim();
    if (!studentId || studentId.length > 200) {
      return res.status(400).json({ success: false, message: 'A valid student ID is required.' });
    }
    const student = db.getState().students.find((item) => item.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });
    if (!canReadStudentAcademicRecord(req.user!, student)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this student academic record.' });
    }

    try {
      const result = await getStudentCurriculumAssignment(studentId);
      if (req.user!.role === 'STUDENT') {
        return res.json({ success: true, assignment: result.assignment, courses: result.courses ?? [] });
      }
      return res.json({ success: true, ...result });
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Student curriculum assignment data is unavailable. Confirm that migration 006 is installed in the target environment.',
      });
    }
  }
);


/**
 * Student-specific compulsory-course exception requests.
 * Submission is limited to the student concerned or Registry administrators.
 */
academicProgressionApiRouter.get(
  '/students/:studentId/curriculum-exceptions',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'RECTOR', 'DEAN', 'HOD', 'EXAM_OFFICER', 'STUDENT'),
  async (req: AuthenticatedRequest, res: Response) => {
    const studentId = String(req.params.studentId || '').trim();
    const student = db.getState().students.find((item) => item.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });
    if (!canReadStudentAcademicRecord(req.user!, student)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this student academic record.' });
    }
    try {
      const exceptions = await listStudentCurriculumExceptions(studentId);
      return res.json({ success: true, exceptions });
    } catch {
      return res.status(503).json({ success: false, message: 'Curriculum exception data is unavailable. Confirm that migration 006 is installed.' });
    }
  }
);

academicProgressionApiRouter.post(
  '/students/:studentId/curriculum-exceptions',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'STUDENT'),
  async (req: AuthenticatedRequest, res: Response) => {
    const studentId = String(req.params.studentId || '').trim();
    const student = db.getState().students.find((item) => item.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });
    if (!canSubmitOwnStudentException(req.user, student)) {
      return res.status(403).json({ success: false, message: 'Students may submit exceptions only for their own academic record.' });
    }
    const programme = db.getState().programmes.find((item) => item.id === student.programmeId);
    if (programme?.qualification !== 'ND') {
      return res.status(422).json({ success: false, message: 'Curriculum exceptions currently support National Diploma students only.' });
    }

    const action = req.body?.action;
    const courseId = typeof req.body?.courseId === 'string' ? req.body.courseId.trim() : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!['ADD_COURSE', 'EXCLUDE_COURSE'].includes(action) || !courseId || !reason) {
      return res.status(400).json({ success: false, message: 'Action, course ID and reason are required.' });
    }
    const course = db.getState().courses.find((item) => item.id === courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course was not found in the institutional catalogue.' });
    if (!course.isCompulsory || !['ND I', 'ND II'].includes(course.level)) {
      return res.status(422).json({ success: false, message: 'Only compulsory ND I or ND II courses can be used for a curriculum exception.' });
    }
    if (course.programmeId && course.programmeId !== student.programmeId) {
      return res.status(422).json({ success: false, message: 'The selected course belongs to a different programme.' });
    }
    if (!course.programmeId && course.departmentId !== student.departmentId) {
      return res.status(422).json({ success: false, message: 'The selected course is not assigned to the student programme or department.' });
    }

    try {
      const result = await submitStudentCurriculumException({
        studentId,
        courseId: course.id,
        action,
        courseCode: course.code,
        courseTitle: course.title,
        level: course.level,
        semester: course.semester,
        creditUnits: course.creditUnits,
        submittedBy: req.user!.id,
        reason,
      });
      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        action: 'STUDENT_CURRICULUM_EXCEPTION_SUBMITTED',
        resource: 'STUDENT_ACADEMIC_CURRICULUM',
        details: { studentId, exceptionId: result.id, action, courseId },
        ipAddress: req.ip,
      });
      return res.status(201).json({ success: true, exception: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Curriculum exception could not be submitted.';
      const conflict = /already|must have|not currently|not already|no longer current/i.test(message);
      return res.status(conflict ? 409 : 400).json({ success: false, message });
    }
  }
);

/**
 * Registry makes an independent decision. The service applies approved
 * additions/exclusions to the student's effective requirement snapshots.
 */
academicProgressionApiRouter.post(
  '/curriculum-exceptions/:exceptionId/review',
  authenticateToken,
  requireRoles('REGISTRAR', 'SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const decision = req.body?.decision;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;
    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be APPROVE or REJECT.' });
    }
    if (decision === 'REJECT' && !reason) {
      return res.status(400).json({ success: false, message: 'A reason is required when rejecting an exception.' });
    }
    try {
      const result = await reviewStudentCurriculumException(
        req.params.exceptionId,
        req.user!.id,
        decision,
        reason
      );
      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        action: decision === 'APPROVE' ? 'STUDENT_CURRICULUM_EXCEPTION_APPROVED' : 'STUDENT_CURRICULUM_EXCEPTION_REJECTED',
        resource: 'STUDENT_ACADEMIC_CURRICULUM',
        details: { exceptionId: result.exceptionId, studentId: result.studentId, decision, action: result.action, reason: decision === 'REJECT' ? reason : undefined },
        ipAddress: req.ip,
      });
      return res.json({ success: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Curriculum exception review could not be completed.';
      const notFound = /not found/i.test(message);
      const conflict = /only a |cannot |no longer current|could not be excluded/i.test(message);
      return res.status(notFound ? 404 : conflict ? 409 : 400).json({ success: false, message });
    }
  }
);


/**
 * Initializes an ND I progression record after a current curriculum assignment
 * exists. The service writes the initial state and immutable history atomically.
 */
academicProgressionApiRouter.post(
  '/students/:studentId/progression/initialize',
  authenticateToken,
  requireRoles('INSTITUTION_ADMIN', 'REGISTRAR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const studentId = String(req.params.studentId || '').trim();
    const academicSession = typeof req.body?.academicSession === 'string' ? req.body.academicSession.trim() : '';
    if (!studentId || !academicSession) {
      return res.status(400).json({ success: false, message: 'Student ID and academic session are required.' });
    }
    const student = db.getState().students.find((item) => item.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });
    const programme = db.getState().programmes.find((item) => item.id === student.programmeId);
    if (programme?.qualification !== 'ND') {
      return res.status(422).json({ success: false, message: 'Progression currently supports National Diploma students only.' });
    }
    try {
      const result = await initializeStudentProgression({
        studentId, programmeId: student.programmeId, academicSession,
        decidedBy: req.user!.id,
      });
      db.logAudit({
        userId: req.user!.id, userEmail: req.user!.email,
        action: result.created ? 'STUDENT_PROGRESSION_INITIALIZED' : 'STUDENT_PROGRESSION_ALREADY_INITIALIZED',
        resource: 'STUDENT_ACADEMIC_PROGRESSION',
        details: { studentId, academicSession, created: result.created },
        ipAddress: req.ip,
      });
      return res.status(result.created ? 201 : 200).json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Progression could not be initialized.';
      return res.status(/required|assignment|programme|snapshots/i.test(message) ? 409 : 503)
        .json({ success: false, message });
    }
  }
);

/**
 * Records one progression decision per academic session. Published results
 * are read from the existing results store; course requirements come only
 * from the immutable student snapshots in Neon.
 */
academicProgressionApiRouter.post(
  '/students/:studentId/progression/advance',
  authenticateToken,
  requireRoles('INSTITUTION_ADMIN', 'REGISTRAR', 'RECTOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const studentId = String(req.params.studentId || '').trim();
    const academicSession = typeof req.body?.academicSession === 'string' ? req.body.academicSession.trim() : '';
    if (!studentId || !academicSession) {
      return res.status(400).json({ success: false, message: 'Student ID and academic session are required.' });
    }
    if (!requireAuthoritativeResultSource(res)) return;
    const student = db.getState().students.find((item) => item.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });
    const studentProgramme = db.getState().programmes.find((item) => item.id === student.programmeId);
    if (studentProgramme?.qualification !== 'ND') {
      return res.status(422).json({ success: false, message: 'Progression currently supports National Diploma students only.' });
    }
    try {
      const snapshotResult = await neonPool.query<{ course_id: string }>(
        `SELECT course_id
           FROM student_academic_required_courses
          WHERE student_id = $1 AND is_required = TRUE`,
        [studentId]
      );
      if (!snapshotResult.rows.length) {
        return res.status(409).json({ success: false, message: 'No effective required-course snapshots exist for this student.' });
      }
      const authoritative = await listAuthoritativePublishedAcademicResults({ studentId });
      const passedCourseIds: string[] = [];
      const missingResultCourseIds: string[] = [];
      for (const row of snapshotResult.rows) {
        const courseResults = authoritative.results
          .filter((item: any) => item.course_id === row.course_id)
          .map((item: any) => ({
            status: 'PUBLISHED' as const,
            totalScore: item.total_score,
            grade: item.grade,
            session: item.academic_session,
            semester: item.semester,
          }));
        const evaluation = evaluateCourseResults(courseResults, PASS_MARK);
        if (evaluation.status === 'PASSED') passedCourseIds.push(row.course_id);
        if (evaluation.status === 'MISSING_RESULT' || evaluation.status === 'UNPUBLISHED_RESULT') {
          missingResultCourseIds.push(row.course_id);
        }
      }
      const result = await advanceStudentProgression({
        studentId, academicSession, passedCourseIds, missingResultCourseIds,
        decidedBy: req.user!.id,
      });
      db.logAudit({
        userId: req.user!.id, userEmail: req.user!.email,
        action: 'STUDENT_PROGRESSION_DECISION_RECORDED',
        resource: 'STUDENT_ACADEMIC_PROGRESSION',
        details: { studentId, academicSession, fromStage: result.fromStage, toStage: result.toStage,
          outstandingCourseCount: result.outstandingCourseIds.length, historyId: result.historyId },
        ipAddress: req.ip,
      });
      return res.json({ success: true, progression: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Progression decision could not be recorded.';
      const conflict = /not initialized|already|withdrawn|snapshot|programme|course does not|session/i.test(message);
      return res.status(conflict ? 409 : 503).json({ success: false, message });
    }
  }
);

/**
 * The Rector may approve an Extension Year 3 management pass. SUPER_ADMIN
 * may also perform the action on the Rector's behalf; the authenticated
 * actor's own ID is recorded as the approver in immutable history.
 */
academicProgressionApiRouter.post(
  '/students/:studentId/progression/management-pass',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const actor = req.user;
    if (!actor || !canApproveExtensionYearThreeManagementPass(actor)) {
      return res.status(403).json({ success: false, message: 'Only the Rector or SUPER_ADMIN may approve an Extension Year 3 management pass.' });
    }
    const studentId = String(req.params.studentId || '').trim();
    const academicSession = typeof req.body?.academicSession === 'string' ? req.body.academicSession.trim() : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!studentId || !academicSession || !reason) {
      return res.status(400).json({ success: false, message: 'Student ID, academic session and approval reason are required.' });
    }
    if (!requireAuthoritativeResultSource(res)) return;
    const student = db.getState().students.find((item) => item.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });
    const studentProgramme = db.getState().programmes.find((item) => item.id === student.programmeId);
    if (studentProgramme?.qualification !== 'ND') {
      return res.status(422).json({ success: false, message: 'Management pass currently supports National Diploma students only.' });
    }
    try {
      const requiredResult = await neonPool.query<{ course_id: string }>(
        `SELECT course_id FROM student_academic_required_courses
          WHERE student_id = $1 AND is_required = TRUE`,
        [studentId]
      );
      if (!requiredResult.rows.length) {
        return res.status(409).json({ success: false, message: 'No effective required-course snapshots exist for this student.' });
      }
      const authoritative = await listAuthoritativePublishedAcademicResults({ studentId });
      const outstandingCourseIds: string[] = [];
      const missingResultCourseIds: string[] = [];
      for (const row of requiredResult.rows) {
        const courseResults = authoritative.results
          .filter((item: any) => item.course_id === row.course_id)
          .map((item: any) => ({
            status: 'PUBLISHED' as const,
            totalScore: item.total_score,
            grade: item.grade,
            session: item.academic_session,
            semester: item.semester,
          }));
        const evaluation = evaluateCourseResults(courseResults, PASS_MARK);
        if (evaluation.status !== 'PASSED') {
          outstandingCourseIds.push(row.course_id);
          if (evaluation.status === 'MISSING_RESULT' || evaluation.status === 'UNPUBLISHED_RESULT') {
            missingResultCourseIds.push(row.course_id);
          }
        }
      }
      if (!outstandingCourseIds.length) {
        return res.status(409).json({ success: false, message: 'All effective required courses have published passing results; use normal academic clearance instead.' });
      }
      const result = await approveExtensionYearThreeManagementPass({
        studentId, academicSession, approverUserId: actor.id, reason,
        outstandingCourseIds, missingResultCourseIds,
      });
      db.logAudit({
        userId: actor.id, userEmail: actor.email,
        action: 'STUDENT_EXTENSION_YEAR_THREE_MANAGEMENT_PASS_APPROVED',
        resource: 'STUDENT_ACADEMIC_PROGRESSION',
        details: { studentId, academicSession, historyId: result.historyId, reason, actorRole: actor.role, actingOnBehalfOf: actor.role === 'SUPER_ADMIN' ? 'RECTOR' : undefined },
        ipAddress: req.ip,
      });
      return res.json({ success: true, progression: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Management pass could not be approved.';
      return res.status(/not found|programme|only to students|only be available|Extension Year 3|outstanding course/i.test(message) ? 409 : 503)
        .json({ success: false, message });
    }
  }
);
