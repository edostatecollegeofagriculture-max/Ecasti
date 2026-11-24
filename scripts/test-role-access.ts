import assert from 'node:assert/strict';
import { canAccessAdminTab, canAccessWorkspace, getDefaultAdminTab, getRoleHome } from '../src/utils/roleAccess';

const forbidden = [
  ['HOD', 'dean_curriculum'],
  ['DEAN', 'exam_approvals'],
  ['DEAN', 'hod_allocation'],
  ['EXAM_OFFICER', 'dean_curriculum'],
  ['STUDENT', 'admin'],
  ['STUDENT', 'builder'],
  ['LECTURER', 'admin'],
  ['BURSAR', 'registrar_docs'],
  ['REGISTRAR', 'finance'],
  ['ADMISSIONS_OFFICER', 'finance'],\n  ['ADMISSIONS_OFFICER', 'analytics'],\n  ['APPLICANT', 'admissions_review'],
];
for (const [role, tab] of forbidden) {
  assert.equal(canAccessAdminTab(role, tab), false, `${role} must not access ${tab}`);
}
assert.equal(canAccessAdminTab('HOD', 'hod_allocation'), true);
assert.equal(canAccessAdminTab('HOD', 'exam_approvals'), true);
assert.equal(canAccessAdminTab('DEAN', 'dean_curriculum'), true);
assert.equal(canAccessAdminTab('EXAM_OFFICER', 'exam_approvals'), true);
assert.equal(canAccessAdminTab('REGISTRAR', 'registrar_docs'), true);
assert.equal(canAccessAdminTab('BURSAR', 'finance'), true);\nassert.equal(canAccessAdminTab('ADMISSIONS_OFFICER', 'admissions_review'), true);\nassert.equal(canAccessAdminTab('APPLICANT', 'admissions_review'), false);

for (const role of ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR']) {
  for (const tab of ['analytics', 'dean_curriculum', 'hod_allocation', 'exam_approvals', 'registrar_docs', 'finance', 'global_crud', 'users', 'settings', 'cms', 'audit']) {
    assert.equal(canAccessAdminTab(role, tab), true, `${role} must access ${tab}`);
  }
  for (const tab of ['admin', 'student', 'lecturer', 'admissions', 'builder', 'public']) {
    assert.equal(canAccessWorkspace(role, tab), true, `${role} must access workspace ${tab}`);
  }
}

assert.equal(canAccessWorkspace('ADMISSIONS_OFFICER', 'admissions-review'), true);\nassert.equal(canAccessWorkspace('ADMISSIONS_OFFICER', 'admissions'), false);\nassert.equal(canAccessWorkspace('ADMISSIONS_OFFICER', 'admin'), false);\nassert.equal(canAccessWorkspace('APPLICANT', 'admissions'), true);\nassert.equal(canAccessWorkspace('APPLICANT', 'admissions-review'), false);\nassert.equal(canAccessWorkspace('HOD', 'builder'), false);
assert.equal(canAccessWorkspace('HOD', 'lecturer'), false);
assert.equal(canAccessWorkspace('DEAN', 'lecturer'), false);
assert.equal(canAccessWorkspace('STUDENT', 'student'), true);
assert.equal(canAccessWorkspace('STUDENT', 'admin'), false);
assert.equal(canAccessWorkspace('HOD', 'admin'), true);
assert.equal(getDefaultAdminTab('HOD'), 'hod_allocation');
assert.deepEqual(getRoleHome('STUDENT'), { tab: 'student', section: 'courses' });\nassert.deepEqual(getRoleHome('APPLICANT'), { tab: 'admissions', section: 'overview' });\nassert.deepEqual(getRoleHome('ADMISSIONS_OFFICER'), { tab: 'admissions-review', section: 'applications' });
assert.deepEqual(getRoleHome('HOD'), { tab: 'admin', section: 'hod_allocation' });
assert.deepEqual(getRoleHome('RECTOR'), { tab: 'admin', section: 'analytics' });
console.log('RESULT: role responsibility matrix tests passed');
