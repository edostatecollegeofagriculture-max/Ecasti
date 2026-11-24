import assert from 'node:assert/strict';
import {
  canExamOfficerModerateResult,
  canHodApproveResult,
  isHodApprovedForPublication,
} from '../server/resultApprovalAuthorization';

const courseA = { departmentId: 'dept-a' };
const courseB = { departmentId: 'dept-b' };
const submitted = { status: 'SUBMITTED' };
const hodApproved = { status: 'HOD_APPROVED' };
const published = { status: 'PUBLISHED' };
const hodA = { role: 'HOD', departmentId: 'dept-a' };
const hodNoDepartment = { role: 'HOD' };
const examA = { role: 'EXAM_OFFICER', departmentId: 'dept-a' };
const examB = { role: 'EXAM_OFFICER', departmentId: 'dept-b' };
const student = { role: 'STUDENT', departmentId: 'dept-a' };

assert.equal(canHodApproveResult(hodA, courseA, submitted), true);
assert.equal(canHodApproveResult(hodA, courseB, submitted), false);
assert.equal(canHodApproveResult(hodNoDepartment, courseA, submitted), false);
assert.equal(canHodApproveResult(hodA, courseA, hodApproved), false);
assert.equal(canHodApproveResult(hodA, courseA, published), false);
assert.equal(canHodApproveResult(examA, courseA, submitted), false);
assert.equal(canHodApproveResult(student, courseA, submitted), false);
assert.equal(canHodApproveResult(hodA, undefined, submitted), false);

assert.equal(canExamOfficerModerateResult(examA, courseA, hodApproved), true);
assert.equal(canExamOfficerModerateResult(examA, courseB, hodApproved), false);
assert.equal(canExamOfficerModerateResult(examB, courseA, hodApproved), false);
assert.equal(canExamOfficerModerateResult({ role: 'EXAM_OFFICER' }, courseA, hodApproved), false);
assert.equal(canExamOfficerModerateResult(examA, courseA, submitted), false);
assert.equal(canExamOfficerModerateResult(examA, courseA, published), false);
assert.equal(canExamOfficerModerateResult(hodA, courseA, hodApproved), false);
assert.equal(canExamOfficerModerateResult(student, courseA, hodApproved), false);

assert.equal(isHodApprovedForPublication(hodApproved), true);
assert.equal(isHodApprovedForPublication(submitted), false);
assert.equal(isHodApprovedForPublication(published), false);
assert.equal(isHodApprovedForPublication(undefined), false);

console.log('RESULT: HOD and Exam Officer result authorization tests passed');
