import assert from 'node:assert/strict';
import {
  canApproveExtensionYearThreeManagementPass,
  canReadStudentAcademicRecord,
  canSubmitOwnStudentException,
  hasRequiredAcademicRole,
} from '../server/academicProgressionAuthorization';

let passed = 0;
function test(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`[PASS] ${name}`);
}

const student = { userId: 'user-student-a', departmentId: 'dept-a', schoolId: 'school-a' };
const actor = (id: string, role: string, departmentId?: string, schoolId?: string) =>
  ({ id, role, departmentId, schoolId });

test('missing actor cannot read an academic record', () => {
  assert.equal(canReadStudentAcademicRecord(undefined, student), false);
});
test('student can read own academic record', () => {
  assert.equal(canReadStudentAcademicRecord(actor('user-student-a', 'STUDENT'), student), true);
});
test('student cannot read another student academic record', () => {
  assert.equal(canReadStudentAcademicRecord(actor('user-student-b', 'STUDENT'), student), false);
});
test('Dean can read within matching school', () => {
  assert.equal(canReadStudentAcademicRecord(actor('dean-a', 'DEAN', undefined, 'school-a'), student), true);
});
test('Dean cannot read outside assigned school', () => {
  assert.equal(canReadStudentAcademicRecord(actor('dean-b', 'DEAN', undefined, 'school-b'), student), false);
});
test('HOD can read within matching department', () => {
  assert.equal(canReadStudentAcademicRecord(actor('hod-a', 'HOD', 'dept-a'), student), true);
});
test('HOD cannot read outside assigned department', () => {
  assert.equal(canReadStudentAcademicRecord(actor('hod-b', 'HOD', 'dept-b'), student), false);
});
test('Exam Officer is limited to matching department', () => {
  assert.equal(canReadStudentAcademicRecord(actor('exam-a', 'EXAM_OFFICER', 'dept-b'), student), false);
});
test('unrecognized role cannot read academic records', () => {
  assert.equal(canReadStudentAcademicRecord(actor('lecturer-a', 'LECTURER'), student), false);
});
test('student may submit own exception only', () => {
  assert.equal(canSubmitOwnStudentException(actor('user-student-a', 'STUDENT'), student), true);
  assert.equal(canSubmitOwnStudentException(actor('user-student-b', 'STUDENT'), student), false);
});
test('only Registry and institutional administrators can submit on behalf of student', () => {
  for (const role of ['REGISTRAR', 'INSTITUTION_ADMIN', 'SUPER_ADMIN']) {
    assert.equal(canSubmitOwnStudentException(actor('staff-a', role), student), true);
  }
  assert.equal(canSubmitOwnStudentException(actor('rector-a', 'RECTOR'), student), false);
});
test('Rector and SUPER_ADMIN may approve Extension Year 3 management pass', () => {
  assert.equal(canApproveExtensionYearThreeManagementPass(actor('rector-a', 'RECTOR')), true);
  assert.equal(canApproveExtensionYearThreeManagementPass(actor('admin-a', 'SUPER_ADMIN')), true);
  for (const role of ['INSTITUTION_ADMIN', 'REGISTRAR', 'DEAN', 'HOD', 'STUDENT']) {
    assert.equal(canApproveExtensionYearThreeManagementPass(actor('other-a', role)), false);
  }
});
test('shared role policy documents and preserves SUPER_ADMIN bypass', () => {
  assert.equal(hasRequiredAcademicRole(actor('admin-a', 'SUPER_ADMIN'), ['REGISTRAR']), true);
  assert.equal(hasRequiredAcademicRole(actor('dean-a', 'DEAN'), ['REGISTRAR']), false);
  assert.equal(hasRequiredAcademicRole(undefined, ['REGISTRAR']), false);
});

console.log(`RESULT: ${passed} PASS, 0 FAIL`);
