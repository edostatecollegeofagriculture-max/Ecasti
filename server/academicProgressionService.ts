import type { DatabaseState } from './db';

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

