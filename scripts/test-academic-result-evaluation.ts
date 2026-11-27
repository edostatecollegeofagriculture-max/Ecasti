import assert from 'node:assert/strict';
import { evaluateCourseResults } from '../server/academicResultEvaluation';

const result = (status: string, totalScore: number, session = '2025/2026') => ({
  status, totalScore, session, semester: 'First', grade: totalScore >= 40 ? 'D' : 'F',
});

assert.equal(evaluateCourseResults([], 40).status, 'MISSING_RESULT');
assert.equal(evaluateCourseResults([result('DRAFT', 80)], 40).status, 'UNPUBLISHED_RESULT');
assert.equal(evaluateCourseResults([result('PUBLISHED', 39)], 40).status, 'FAILED');
assert.equal(evaluateCourseResults([result('PUBLISHED', 40)], 40).status, 'PASSED');
assert.equal(evaluateCourseResults([result('PUBLISHED', 'NaN' as unknown as number)], 40).status, 'FAILED');

// Existing policy is intentionally preserved: any published passing attempt
// counts, even when a more recent published attempt is below the pass mark.
assert.equal(
  evaluateCourseResults([
    result('PUBLISHED', 35, '2025/2026'),
    result('PUBLISHED', 55, '2024/2025'),
  ], 40).status,
  'PASSED'
);

const failed = evaluateCourseResults([
  result('PUBLISHED', 35, '2025/2026'),
  result('PUBLISHED', 32, '2024/2025'),
], 40);
assert.equal(failed.status, 'FAILED');
assert.equal(failed.publishedScore, 35);

console.log('RESULT: 7 PASS, 0 FAIL');
