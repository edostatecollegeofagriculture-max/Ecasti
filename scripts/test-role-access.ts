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
];
for (const [role, tab] of forbidden) {
  assert.equal(canAccessAdminTab(role, tab), false, `${role} must not access ${tab}`);
}
assert.equal(canAccessAdminTab('HOD', 'hod_allocation'), true);
assert.equal(canAccessAdminTab('DEAN', 'dean_curriculum'), true);
assert.equal(canAccessAdminTab('EXAM_OFFICER', 'exam_approvals'), true);
assert.equal(canAccessAdminTab('REGISTRAR', 'registrar_docs'), true);
assert.equal(canAccessAdminTab('BURSAR', 'finance'), true);
assert.equal(canAccessWorkspace('HOD', 'builder'), false);
assert.equal(canAccessWorkspace('HOD', 'lecturer'), false);
assert.equal(canAccessWorkspace('DEAN', 'lecturer'), false);
assert.equal(canAccessWorkspace('STUDENT', 'student'), true);
assert.equal(canAccessWorkspace('HOD', 'admin'), true);
assert.equal(getDefaultAdminTab('HOD'), 'hod_allocation');
assert.deepEqual(getRoleHome('STUDENT'), { tab: 'student', section: 'courses' });
assert.deepEqual(getRoleHome('HOD'), { tab: 'admin', section: 'hod_allocation' });
console.log('RESULT: role-specific workspace policy tests passed');
