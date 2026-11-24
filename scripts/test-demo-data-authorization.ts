import assert from 'node:assert/strict';
import { canManageStagingDemoData } from '../server/demoDataAuthorization';

assert.equal(canManageStagingDemoData('SUPER_ADMIN'), true);
for (const role of ['RECTOR', 'INSTITUTION_ADMIN', 'DEAN', 'HOD', 'LECTURER', 'EXAM_OFFICER', 'REGISTRAR', 'BURSAR', 'ADMISSIONS_OFFICER', 'STUDENT', 'APPLICANT', undefined]) {
  assert.equal(canManageStagingDemoData(role), false, `Expected ${String(role)} to be denied demo data controls`);
}
console.log('Staging demo-data authorization tests passed.');
