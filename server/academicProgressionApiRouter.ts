import { Router, Response } from 'express';
import { db } from './db';
import { AuthenticatedRequest, authenticateToken, requireRoles } from './authMiddleware';
import { neonPool } from './neon';

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

export const academicProgressionApiRouter = Router();

/**
 * Read-only ND eligibility preview based on the student's assigned
 * curriculum snapshots and published results in the existing JSON store.
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

      const courses = requiredCourses.map((course) => {
        const courseResults = state.results.filter(
          (result) =>
            result.studentId === studentId &&
            result.courseId === course.course_id
        );

        const publishedResults = courseResults
          .filter((result) => result.status === 'PUBLISHED')
          .sort((a, b) => {
            const sessionOrder = b.session.localeCompare(a.session);
            return sessionOrder || b.semester.localeCompare(a.semester);
          });

        const passingResult = publishedResults.find(
          (result) => Number(result.totalScore) >= PASS_MARK
        );

        let status: CourseStatus;
        let publishedScore: number | undefined;
        let publishedGrade: string | undefined;

        if (passingResult) {
          status = 'PASSED';
          publishedScore = Number(passingResult.totalScore);
          publishedGrade = passingResult.grade;
        } else if (publishedResults.length > 0) {
          status = 'FAILED';
          publishedScore = Number(publishedResults[0].totalScore);
          publishedGrade = publishedResults[0].grade;
        } else {
          status = courseResults.length > 0
            ? 'UNPUBLISHED_RESULT'
            : 'MISSING_RESULT';
        }

        return {
          courseId: course.course_id,
          code: course.course_code_snapshot,
          title: course.course_title_snapshot,
          level: course.course_level_snapshot,
          semester: course.semester_snapshot,
          creditUnits: Number(course.credit_units_snapshot),
          status,
          ...(publishedScore === undefined ? {} : { publishedScore }),
          ...(publishedGrade === undefined ? {} : { publishedGrade }),
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
