import assert from 'node:assert/strict';
import { canSearchApplicants, canSearchInstitutionStudents } from '../server/searchAuthorization';

for (const role of ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'RECTOR']) {
  assert.equal(canSearchInstitutionStudents(role), true, `${role} should search institution-wide student records`);
  assert.equal(canSearchApplicants(role), true, `${role} should search applicant records`);
}

assert.equal(canSearchApplicants('ADMISSIONS_OFFICER'), true);
assert.equal(canSearchInstitutionStudents('ADMISSIONS_OFFICER'), false);

for (const role of ['STUDENT', 'LECTURER', 'HOD', 'DEAN', 'BURSAR', 'APPLICANT', undefined]) {
  assert.equal(canSearchInstitutionStudents(role), false, `${role} must not search institution-wide student records`);
  assert.equal(canSearchApplicants(role), false, `${role} must not search applicant records`);
}

console.log('RESULT: 14 PASS, 0 FAIL');
