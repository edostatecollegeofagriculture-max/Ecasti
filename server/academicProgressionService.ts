import type { DatabaseState } from './db';
import { evaluateCourseResults } from './academicResultEvaluation';

export const ND_PASS_MARK = 40;

export type GraduationCourseStatus =
  | 'PASSED'
  | 'FAILED'
  | 'MISSING_RESULT'
  | 'UNPUBLISHED_RESULT';

export interface GraduationCourseCheck {
  courseId: string;
  code: string;
  title: string;
  level: string;
  status: GraduationCourseStatus;
  publishedScore?: number;
  publishedGrade?: string;
}

export interface NdGraduationEligibility {
  studentId: string;
  programmeId: string;
  eligible: boolean;
  preliminaryEligible: boolean;
  eligibilityBasis: 'LIVE_CATALOGUE_PREVIEW_ONLY';
  configurationValid: boolean;
  passMark: number;
  requiredCourseCount: number;
  passedCourseCount: number;
  outstandingCourseCount: number;
  missingResultCount: number;
  unpublishedResultCount: number;
  failedCourseCount: number;
  unmappedCompulsoryCourseCount: number;
  courses: GraduationCourseCheck[];
  warnings: string[];
}

export function evaluateNdGraduationEligibility(
  state: DatabaseState,
  studentId: string
): NdGraduationEligibility {
  const student = state.students.find((item) => item.id === studentId);

  if (!student) {
    throw new Error('Student record not found.');
  }

  const ndLevels = new Set(['ND I', 'ND II']);

  const requiredCourses = state.courses.filter(
    (course) =>
      course.programmeId === student.programmeId &&
      course.isCompulsory === true &&
      ndLevels.has(course.level)
  );

  const unmappedCompulsoryCourses = state.courses.filter(
    (course) =>
      !course.programmeId &&
      course.departmentId === student.departmentId &&
      course.isCompulsory === true &&
      ndLevels.has(course.level)
  );

  const warnings: string[] = [];

  if (requiredCourses.length === 0) {
    warnings.push(
      'No compulsory ND I or ND II courses are explicitly assigned to this programme. Graduation eligibility cannot be confirmed.'
    );
  }

  if (unmappedCompulsoryCourses.length > 0) {
    warnings.push(
      `${unmappedCompulsoryCourses.length} compulsory ND course(s) in the student's department are not assigned to a programme. Review course configuration.`
    );
  }

  const courses: GraduationCourseCheck[] = requiredCourses.map((course) => {
    const courseResults = state.results.filter(
      (result) =>
        result.studentId === studentId &&
        result.courseId === course.id
    );

    const publishedResults = courseResults
      .filter((result) => result.status === 'PUBLISHED')
      .sort((a, b) => {
        const sessionCompare = b.session.localeCompare(a.session);
        return sessionCompare || b.semester.localeCompare(a.semester);
      });

    const passingResult = publishedResults.find(
      (result) => Number(result.totalScore) >= ND_PASS_MARK
    );

    if (passingResult) {
      return {
        courseId: course.id,
        code: course.code,
        title: course.title,
        level: course.level,
        status: 'PASSED',
        publishedScore: Number(passingResult.totalScore),
        publishedGrade: passingResult.grade,
      };
    }

    const latestPublished = publishedResults[0];

    if (latestPublished) {
      return {
        courseId: course.id,
        code: course.code,
        title: course.title,
        level: course.level,
        status: 'FAILED',
        publishedScore: Number(latestPublished.totalScore),
        publishedGrade: latestPublished.grade,
      };
    }


    return {
      courseId: course.id,
      code: course.code,
      title: course.title,
      level: course.level,
      status: courseResults.length > 0
        ? 'UNPUBLISHED_RESULT'
        : 'MISSING_RESULT',
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

  const configurationValid =
    requiredCourses.length > 0 &&
    unmappedCompulsoryCourses.length === 0;

  warnings.push(

    'PRELIMINARY ONLY: final graduation clearance is disabled until student-specific curriculum snapshots are populated and used for evaluation.'

  );

  return {
    studentId,
    programmeId: student.programmeId,
    eligible: false,
    preliminaryEligible: configurationValid && outstandingCourseCount === 0,
    eligibilityBasis: 'LIVE_CATALOGUE_PREVIEW_ONLY',
    configurationValid,
    passMark: ND_PASS_MARK,
    requiredCourseCount: courses.length,
    passedCourseCount,
    outstandingCourseCount,
    missingResultCount,
    unpublishedResultCount,
    failedCourseCount,
    unmappedCompulsoryCourseCount: unmappedCompulsoryCourses.length,
    courses,
    warnings,
  };
}

import { neonPool } from './neon';

export interface NdGraduationEligibilityFromPostgres extends Omit<NdGraduationEligibility, 'eligibilityBasis' | 'eligible' | 'warnings'> {
  eligibilityBasis: 'SNAPSHOT_VERIFIED';
  eligible: boolean;
  currentStage: string;
  progressionStatus: string;
  warnings: string[];
}

export async function evaluateNdGraduationEligibilityFromPostgres(
  state: DatabaseState,
  studentId: string,
): Promise<NdGraduationEligibilityFromPostgres> {
  const warnings: string[] = [];
  const student = state.students.find((item) => item.id === studentId);
  if (!student) throw new Error('Student record not found.');

  const progResult = await neonPool.query(
    `SELECT current_stage, progression_status, extension_year
       FROM student_academic_progression WHERE student_id = $1`,
    [studentId],
  );
  if (progResult.rowCount !== 1) {
    throw new Error(`No progression record in Postgres for student ${studentId}.`);
  }
  const prog = progResult.rows[0] as { current_stage: string; progression_status: string; extension_year: number };

  const reqResult = await neonPool.query(
    `SELECT course_id, course_code_snapshot, course_title_snapshot,
            course_level_snapshot, semester_snapshot, credit_units_snapshot, is_required
       FROM student_academic_required_courses
      WHERE student_id = $1 AND is_required = TRUE
      ORDER BY course_level_snapshot, semester_snapshot, course_code_snapshot`,
    [studentId],
  );

  if (reqResult.rowCount === 0) {
    warnings.push('No required-course snapshots found in Postgres for this student.');
  }

  const courses: GraduationCourseCheck[] = reqResult.rows.map((row: any) => {
    const courseResults = state.results.filter(
      (r) => r.studentId === studentId && r.courseId === row.course_id,
    );
    const publishedResults = courseResults
      .filter((r) => r.status === 'PUBLISHED')
      .sort((a, b) => {
        const s = b.session.localeCompare(a.session);
        return s || b.semester.localeCompare(a.semester);
      });
    const passing = publishedResults.find((r) => Number(r.totalScore) >= ND_PASS_MARK);
    if (passing) {
      return { courseId: row.course_id, code: row.course_code_snapshot, title: row.course_title_snapshot, level: row.course_level_snapshot, status: 'PASSED', publishedScore: Number(passing.totalScore), publishedGrade: passing.grade };
    }
    const latest = publishedResults[0];
    if (latest) {
      return { courseId: row.course_id, code: row.course_code_snapshot, title: row.course_title_snapshot, level: row.course_level_snapshot, status: 'FAILED', publishedScore: Number(latest.totalScore), publishedGrade: latest.grade };
    }
    return { courseId: row.course_id, code: row.course_code_snapshot, title: row.course_title_snapshot, level: row.course_level_snapshot, status: courseResults.length > 0 ? 'UNPUBLISHED_RESULT' : 'MISSING_RESULT' };
  });

  const passedCourseCount = courses.filter((c) => c.status === 'PASSED').length;
  const failedCourseCount = courses.filter((c) => c.status === 'FAILED').length;
  const missingResultCount = courses.filter((c) => c.status === 'MISSING_RESULT').length;
  const unpublishedResultCount = courses.filter((c) => c.status === 'UNPUBLISHED_RESULT').length;
  const outstandingCourseCount = courses.length - passedCourseCount;

  const atOrBeyondNdII = prog.current_stage === 'ND_II' || prog.current_stage.startsWith('EXTENSION_') || prog.current_stage === 'GRADUATED';
  const eligible = courses.length > 0 && outstandingCourseCount === 0 && atOrBeyondNdII && prog.progression_status !== 'WITHDRAWN';

  if (courses.length === 0) warnings.push('No required courses in snapshot â€” eligibility cannot be confirmed.');
  if (!atOrBeyondNdII) warnings.push(`Student is at ${prog.current_stage}; graduation eligibility requires ND_II or later.`);
  if (prog.progression_status === 'WITHDRAWN') warnings.push('Student progression status is WITHDRAWN.');

  return {
    studentId, programmeId: student.programmeId,
    eligible, preliminaryEligible: eligible,
    eligibilityBasis: 'SNAPSHOT_VERIFIED',
    configurationValid: courses.length > 0,
    passMark: ND_PASS_MARK,
    requiredCourseCount: courses.length,
    passedCourseCount, outstandingCourseCount,
    missingResultCount, unpublishedResultCount, failedCourseCount,
    unmappedCompulsoryCourseCount: 0,
    courses, warnings,
    currentStage: prog.current_stage, progressionStatus: prog.progression_status,
  };
}
