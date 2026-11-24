import assert from 'node:assert/strict';
import { canAccessAdminTab, canAccessWorkspace, getDefaultAdminTab, getRoleHome } from '../src/utils/roleAccess';

const forbidden = [
  ['HOD', 'dean_curriculum'],
  ['HOD', 'exam_approvals'],
  ['DEAN', 'exam_approvals'],
  ['EXAM_OFFICER', 'dean_curriculum'],
  ['STUDENT', 'admin'],
  ['STUDENT', 'builder'],
  ['LECTURER', 'admin'],
  ['BURSAR', 'registrar_docs'],
  ['REGISTRAR', 'finance'],
  ['ADMISSIONS_OFFICER', 'finance'],
];
for (const [role, tab] of forbidden) {
  assert.equal(canAccessAdminTab(role, tab), false, `${role} must not access ${tab}`);
}
assert.equal(canAccessAdminTab('HOD', 'hod_allocation'), true);
assert.equal(canAccessAdminTab('DEAN', 'dean_curriculum'), true);
assert.equal(canAccessAdminTab('EXAM_OFFICER', 'exam_approvals'), true);
assert.equal(canAccessAdminTab('REGISTRAR', 'registrar_docs'), true);
assert.equal(canAccessAdminTab('BURSAR', 'finance'), true);

for (const role of ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR']) {
  for (const tab of ['analytics', 'dean_curriculum', 'hod_allocation', 'exam_approvals', 'registrar_docs', 'finance', 'global_crud', 'users', 'settings', 'cms', 'audit']) {
    assert.equal(canAccessAdminTab(role, tab), true, `${role} must access ${tab}`);
  }
  for (const tab of ['admin', 'student', 'lecturer', 'admissions', 'builder', 'public']) {
    assert.equal(canAccessWorkspace(role, tab), true, `${role} must access workspace ${tab}`);
  }
}

assert.equal(canAccessWorkspace('HOD', 'builder'), false);
assert.equal(canAccessWorkspace('HOD', 'lecturer'), false);
assert.equal(canAccessWorkspace('DEAN', 'lecturer'), false);
assert.equal(canAccessWorkspace('STUDENT', 'student'), true);
assert.equal(canAccessWorkspace('STUDENT', 'admin'), false);
assert.equal(canAccessWorkspace('HOD', 'admin'), true);
assert.equal(getDefaultAdminTab('HOD'), 'hod_allocation');
assert.deepEqual(getRoleHome('STUDENT'), { tab: 'student', section: 'courses' });
assert.deepEqual(getRoleHome('HOD'), { tab: 'admin', section: 'hod_allocation' });
assert.deepEqual(getRoleHome('RECTOR'), { tab: 'admin', section: 'analytics' });
console.log('RESULT: role responsibility matrix tests passed');
