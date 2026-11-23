export type AcademicResultStatus = 'PUBLISHED' | string;

export type AcademicResultRecord = {
  status: AcademicResultStatus;
  totalScore: number | string;
  grade?: string;
  session: string;
  semester: string;
};

export type CourseResultEvaluation = {
  status: 'PASSED' | 'FAILED' | 'MISSING_RESULT' | 'UNPUBLISHED_RESULT';
  publishedScore?: number;
  publishedGrade?: string;
};

/**
 * Shared policy for eligibility and progression:
 * any published attempt at or above the pass mark satisfies the course.
 * If no published attempt passes, the latest published attempt is reported
 * as FAILED. Unpublished-only and absent results remain distinct.
 *
 * This deliberately preserves the application's existing "any published
 * pass counts" behavior. A policy where a later failed attempt revokes an
 * earlier pass requires an explicit academic decision before changing this.
 */
export function evaluateCourseResults(
  results: readonly AcademicResultRecord[],
  passMark: number
): CourseResultEvaluation {
  const published = results
    .filter((result) => result.status === 'PUBLISHED')
    .slice()
    .sort((a, b) => {
      const sessionOrder = b.session.localeCompare(a.session);
      return sessionOrder || b.semester.localeCompare(a.semester);
    });

  const passing = published.find((result) => {
    const score = Number(result.totalScore);
    return Number.isFinite(score) && score >= passMark;
  });

  if (passing) {
    return {
      status: 'PASSED',
      publishedScore: Number(passing.totalScore),
      ...(passing.grade === undefined ? {} : { publishedGrade: passing.grade }),
    };
  }

  if (published.length > 0) {
    const latest = published[0];
    return {
      status: 'FAILED',
      publishedScore: Number(latest.totalScore),
      ...(latest.grade === undefined ? {} : { publishedGrade: latest.grade }),
    };
  }

  return {
    status: results.length > 0 ? 'UNPUBLISHED_RESULT' : 'MISSING_RESULT',
  };
}
