import assert from 'node:assert/strict';
import express from 'express';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import {
  createAuthenticateToken,
  requireRoles,
} from '../server/authenticationMiddleware';
import type { AuthPrincipal } from '../server/authenticationMiddleware';
import {
  canApproveExtensionYearThreeManagementPass,
  canReadStudentAcademicRecord,
} from '../server/academicProgressionAuthorization';

const TEST_SECRET = 'http-integration-test-secret-at-least-32-characters';
const users = new Map<string, AuthPrincipal>();
const studentScopes = new Map([
  ['student-a', { userId: 'student-a-user', departmentId: 'dept-a', schoolId: 'school-a' }],
  ['student-b', { userId: 'student-b-user', departmentId: 'dept-b', schoolId: 'school-b' }],
]);

const addUser = (
  id: string,
  role: string,
  scope: { departmentId?: string; schoolId?: string } = {},
  flags: { isActive?: boolean; isLocked?: boolean } = {},
): AuthPrincipal => {
  const user: AuthPrincipal = {
    id,
    email: `${id}@integration.invalid`,
    fullName: `Synthetic ${role}`,
    role,
    isActive: flags.isActive ?? true,
    isLocked: flags.isLocked ?? false,
    ...scope,
  };
  users.set(id, user);
  return user;
};

addUser('student-a-user', 'STUDENT');
addUser('student-b-user', 'STUDENT');
addUser('registrar-a', 'REGISTRAR');
addUser('dean-a', 'DEAN', { schoolId: 'school-a' });
addUser('dean-b', 'DEAN', { schoolId: 'school-b' });
addUser('hod-a', 'HOD', { departmentId: 'dept-a' });
addUser('hod-b', 'HOD', { departmentId: 'dept-b' });
addUser('exam-b', 'EXAM_OFFICER', { departmentId: 'dept-b' });
addUser('rector-a', 'RECTOR');
addUser('super-admin-a', 'SUPER_ADMIN');
addUser('inactive-a', 'REGISTRAR', {}, { isActive: false });
addUser('locked-a', 'REGISTRAR', {}, { isLocked: true });

const app = express();
app.use(express.json());
const authenticate = createAuthenticateToken((id) => users.get(id), TEST_SECRET);

app.get('/staff/registrar', authenticate, requireRoles('REGISTRAR'), (_req, res) => {
  res.status(200).json({ success: true });
});

app.post('/registry/exception-review', authenticate, requireRoles('REGISTRAR', 'SUPER_ADMIN'), (_req, res) => {
  res.status(200).json({ success: true });
});

app.get(
  '/students/:studentId/academic-record',
  authenticate,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'RECTOR', 'DEAN', 'HOD', 'EXAM_OFFICER', 'STUDENT'),
  (req, res) => {
    const actor = (req as Request & { user?: AuthPrincipal }).user;
    const student = studentScopes.get(String(req.params.studentId));
    if (!student) return res.status(404).json({ success: false });
    if (!canReadStudentAcademicRecord(actor, student)) {
      return res.status(403).json({ success: false });
    }
    return res.status(200).json({ success: true });
  },
);

app.post('/students/:studentId/progression/management-pass', authenticate, (req, res) => {
  const actor = (req as Request & { user?: AuthPrincipal }).user;
  if (!canApproveExtensionYearThreeManagementPass(actor)) {
    return res.status(403).json({ success: false });
  }
  return res.status(200).json({ success: true });
});

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;

function tokenFor(userId: string, expiresIn: number = 300): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn });
}

async function request(
  path: string,
  options: { method?: string; userId?: string; rawToken?: string } = {},
): Promise<Response> {
  const token = options.rawToken ?? (options.userId ? tokenFor(options.userId) : undefined);
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.method === 'POST' ? { body: JSON.stringify({}) } : {}),
  });
}

let passed = 0;
async function test(name: string, run: () => Promise<void>) {
  await run();
  passed += 1;
  console.log(`[PASS] ${name}`);
}

try {
  await test('missing bearer token returns HTTP 401', async () => {
    assert.equal((await request('/staff/registrar')).status, 401);
  });
  await test('invalid bearer token returns HTTP 401', async () => {
    assert.equal((await request('/staff/registrar', { rawToken: 'not-a-valid-token' })).status, 401);
  });
  await test('token for a deleted user returns HTTP 401', async () => {
    assert.equal((await request('/staff/registrar', { rawToken: tokenFor('deleted-user') })).status, 401);
  });
  await test('expired bearer token returns HTTP 401', async () => {
    assert.equal((await request('/staff/registrar', { rawToken: tokenFor('registrar-a', -1) })).status, 401);
  });
  await test('deactivated account returns HTTP 403', async () => {
    assert.equal((await request('/staff/registrar', { userId: 'inactive-a' })).status, 403);
  });
  await test('locked account returns HTTP 403', async () => {
    assert.equal((await request('/staff/registrar', { userId: 'locked-a' })).status, 403);
  });
  await test('authenticated role without route permission returns HTTP 403', async () => {
    assert.equal((await request('/staff/registrar', { userId: 'student-a-user' })).status, 403);
  });
  await test('Registrar with route permission receives HTTP 200', async () => {
    assert.equal((await request('/staff/registrar', { userId: 'registrar-a' })).status, 200);
  });
  await test('non-Registrar cannot review an exception', async () => {
    assert.equal((await request('/registry/exception-review', { method: 'POST', userId: 'hod-a' })).status, 403);
  });
  await test('Registrar can pass the exception-review role guard', async () => {
    assert.equal((await request('/registry/exception-review', { method: 'POST', userId: 'registrar-a' })).status, 200);
  });
  await test('SUPER_ADMIN global bypass is applied by shared role middleware', async () => {
    assert.equal((await request('/registry/exception-review', { method: 'POST', userId: 'super-admin-a' })).status, 200);
  });
  await test('student can read own academic record', async () => {
    assert.equal((await request('/students/student-a/academic-record', { userId: 'student-a-user' })).status, 200);
  });
  await test('student cannot read another student academic record', async () => {
    assert.equal((await request('/students/student-b/academic-record', { userId: 'student-a-user' })).status, 403);
  });
  await test('SUPER_ADMIN can read any student record across department and school scope', async () => {
    assert.equal((await request('/students/student-b/academic-record', { userId: 'super-admin-a' })).status, 200);
  });
  await test('Dean can read within assigned school', async () => {
    assert.equal((await request('/students/student-a/academic-record', { userId: 'dean-a' })).status, 200);
  });
  await test('Dean cannot read outside assigned school', async () => {
    assert.equal((await request('/students/student-b/academic-record', { userId: 'dean-a' })).status, 403);
  });
  await test('HOD can read within assigned department', async () => {
    assert.equal((await request('/students/student-a/academic-record', { userId: 'hod-a' })).status, 200);
  });
  await test('HOD cannot read outside assigned department', async () => {
    assert.equal((await request('/students/student-b/academic-record', { userId: 'hod-a' })).status, 403);
  });
  await test('Exam Officer cannot read outside assigned department', async () => {
    assert.equal((await request('/students/student-a/academic-record', { userId: 'exam-b' })).status, 403);
  });
  await test('Rector receives HTTP 200 on the Rector-only management-pass guard', async () => {
    assert.equal((await request('/students/student-a/progression/management-pass', { method: 'POST', userId: 'rector-a' })).status, 200);
  });
  await test('SUPER_ADMIN receives HTTP 200 when acting on behalf of the Rector', async () => {
    assert.equal((await request('/students/student-a/progression/management-pass', { method: 'POST', userId: 'super-admin-a' })).status, 200);
  });

  console.log(`RESULT: ${passed} PASS, 0 FAIL`);
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
