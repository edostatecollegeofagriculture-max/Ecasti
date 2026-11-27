import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Pool } from 'pg';

const EXPECTED_TEMPORARY_HOST = 'ep-blue-mud-bdm6m3i0-pooler.c-8.us-east-2.aws.neon.tech';
const databaseUrl = process.env.DATABASE_URL;
assert(databaseUrl, 'DATABASE_URL is missing. Configure the disposable Neon branch in .env.');
const parsed = new URL(databaseUrl);
assert(
  parsed.hostname === EXPECTED_TEMPORARY_HOST && parsed.pathname === '/neondb',
  'STOP: DATABASE_URL is not the confirmed temporary Neon branch. No database query or write was attempted.',
);

const confirmation = createInterface({ input: stdin, output: stdout });
try {
  const answer = await confirmation.question(
    'This test starts the actual API with a synthetic JSON fixture and writes TEST-RESULT-API- records only to the disposable Neon branch. Type TEMPORARY to continue: ',
  );
  assert.equal(answer.trim(), 'TEMPORARY', 'Confirmation not provided. No API tests were run.');
} finally {
  confirmation.close();
}

const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
const studentId = `TEST-RESULT-API-STUDENT-${suffix}`;
const studentUserId = `TEST-RESULT-API-STUDENT-USER-${suffix}`;
const examOfficerId = `TEST-RESULT-API-EXAM-OFFICER-${suffix}`;
const superAdminId = `TEST-RESULT-API-SUPER-ADMIN-${suffix}`;
const lecturerId = `TEST-RESULT-API-LECTURER-${suffix}`;
const courseId = `TEST-RESULT-API-COURSE-${suffix}`;
const session = `TEST-RESULT-API-SESSION-${suffix}`;
const jwtSecret = 'temporary-result-api-integration-secret-at-least-32-characters';
process.env.JWT_SECRET = jwtSecret;

const tempDirectory = mkdtempSync(path.join(tmpdir(), 'edocasti-result-api-test-'));
const fixturePath = path.join(tempDirectory, 'synthetic-edocasti-db.json');
process.env.EDOCASTI_DATA_FILE = fixturePath;
const now = new Date().toISOString();
const makeUser = (id: string, role: string) => ({
  id, email: `${id.toLowerCase()}@integration.invalid`, passwordHash: 'not-used',
  fullName: `Synthetic ${role}`, role, isActive: true, isLocked: false,
  failedLoginAttempts: 0, createdAt: now,
});
const fixture = {
  settings: {
    id: 'TEST-RESULT-API-SETTINGS', institutionName: 'Synthetic Integration Institution',
    shortName: 'TEST', motto: '', state: 'Edo', country: 'Nigeria',
    currentSession: session, currentSemester: 'First Semester', admissionsOpen: false,
    courseRegistrationOpen: false, feePaymentRequiredForReg: false,
    contactEmail: 'integration.invalid', contactPhone: '', address: '',
    caMaxMarks: 40, examMaxMarks: 60,
  },
  users: [
    makeUser(studentUserId, 'STUDENT'),
    makeUser(examOfficerId, 'EXAM_OFFICER'),
    makeUser(superAdminId, 'SUPER_ADMIN'),
    makeUser(lecturerId, 'LECTURER'),
  ],
  schools: [], departments: [], programmes: [],
  courses: [{
    id: courseId, departmentId: 'TEST-RESULT-API-DEPT', code: 'TRAPI101',
    title: 'Synthetic result API course', creditUnits: 2, level: 'ND I',
    semester: 'First Semester', lecturerId, isCompulsory: true,
  }],
  applications: [],
  students: [{
    id: studentId, matricNumber: studentId, userId: studentUserId,
    programmeId: 'TEST-RESULT-API-PROG', departmentId: 'TEST-RESULT-API-DEPT',
    schoolId: 'TEST-RESULT-API-SCHOOL', level: 'ND I', sessionAdmitted: session,
    academicStatus: 'Good Standing', gender: 'Not specified', dob: '2000-01-01',
    emergencyContact: 'Synthetic contact', nextOfKin: 'Synthetic next of kin',
    cgpa: 0, totalCreditsEarned: 0,
  }],
  registrations: [], results: [], feeSchedules: [], invoices: [], payments: [],
  attendance: [], supportTickets: [], auditLogs: [], newsArticles: [],
  feeCatalogItems: [], programFeeSchedules: [], programFeeScheduleItems: [],
  studentFeeObligations: [], studentPayments: [], studentPaymentAllocations: [],
  sliderSlides: [], pageContent: {}, issuedDocuments: [],
};
writeFileSync(fixturePath, JSON.stringify(fixture), 'utf8');

let server: Server | undefined;
let neonPool: Pool | undefined;
let passed = 0;
async function test(name: string, run: () => Promise<void>) {
  await run();
  passed += 1;
  console.log(`[PASS] ${name}`);
}

async function main() {
  const [{ apiRouter }, database, neon, expressModule, resultService] = await Promise.all([
    import('../server/apiRouter'),
    import('../server/db'),
    import('../server/neon'),
    import('express'),
    import('../server/academicResultNeonService'),
  ]);
  neonPool = neon.neonPool;
  const db = database.db;
  const express = expressModule.default;

  const schema = await neonPool.query(
    `SELECT to_regclass('public.academic_result_attempts') AS attempts,
            to_regclass('public.academic_result_events') AS events`,
  );
  assert(schema.rows[0]?.attempts && schema.rows[0]?.events,
    'Migration 009 result ledger is missing on the temporary Neon branch.');

  const app = express();
  app.use(express.json());
  app.use('/api/v1', apiRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server!.once('listening', resolve);
    server!.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const token = (userId: string) => jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '10m' });
  async function api(
    route: string,
    options: { userId?: string; method?: string; body?: unknown } = {},
  ) {
    const response = await fetch(`${baseUrl}${route}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.userId ? { Authorization: `Bearer ${token(options.userId)}` } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
  }

  const createAttempt = async (attemptNumber: number) => {
    const created = await resultService.createAcademicResultAttempt({
      studentId, courseId, academicSession: session, semester: 'First Semester',
      attemptNumber, caScore: 30, examScore: 45, totalScore: 75,
      grade: 'A', gradePoint: 5, actorUserId: examOfficerId,
      idempotencyKey: `TEST-RESULT-API-${suffix}-attempt-${attemptNumber}`,
    });
    return String(created.attempt.id);
  };

  try {
    await test('attempt ledger rejects unauthenticated reads', async () => {
      const result = await api('/results/neon-attempts');
      assert.equal(result.status, 401);
    });

    await test('attempt ledger denies the Student role', async () => {
      const result = await api('/results/neon-attempts', { userId: studentUserId });
      assert.equal(result.status, 403);
    });

    await test('workflow endpoint rejects requests without authentication', async () => {
      const result = await api('/results/neon-attempts/missing/events', {
        method: 'POST', body: { eventType: 'VERIFIED', idempotencyKey: `unauth-${suffix}` },
      });
      assert.equal(result.status, 401);
    });

    await test('workflow endpoint denies a Lecturer role', async () => {
      const result = await api('/results/neon-attempts/missing/events', {
        method: 'POST', userId: lecturerId,
        body: { eventType: 'VERIFIED', idempotencyKey: `lecturer-${suffix}` },
      });
      assert.equal(result.status, 403);
    });

    await test('workflow endpoint validates event types and idempotency keys', async () => {
      const invalidEvent = await api('/results/neon-attempts/missing/events', {
        method: 'POST', userId: examOfficerId,
        body: { eventType: 'INVALIDATED', idempotencyKey: `invalid-event-${suffix}` },
      });
      assert.equal(invalidEvent.status, 400);
      const missingKey = await api('/results/neon-attempts/missing/events', {
        method: 'POST', userId: examOfficerId,
        body: { eventType: 'VERIFIED' },
      });
      assert.equal(missingKey.status, 400);
    });

    const passingAttemptId = await createAttempt(1);
    await test('Exam Officer can read the Neon attempt ledger through the actual API', async () => {
      const result = await api('/results/neon-attempts', { userId: examOfficerId });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      const found = result.payload.results.find((item: any) => item.id === passingAttemptId);
      assert.ok(found, 'Synthetic Neon attempt was not returned.');
      assert.equal(found.studentName, `Synthetic STUDENT`);
      assert.equal(found.status, 'SUBMITTED');
    });

    await test('Exam Officer can verify, approve, and publish in sequence', async () => {
      for (const eventType of ['VERIFIED', 'APPROVED', 'PUBLISHED'] as const) {
        const result = await api(`/results/neon-attempts/${passingAttemptId}/events`, {
          method: 'POST', userId: examOfficerId,
          body: { eventType, idempotencyKey: `TEST-RESULT-API-${suffix}-${eventType}` },
        });
        assert.equal(result.status, 201, JSON.stringify(result.payload));
        assert.equal(result.payload.event.eventType, eventType);
        assert.equal(result.payload.event.actorUserId, examOfficerId);
      }
    });

    await test('same Exam Officer action and idempotency key returns HTTP 200 without a duplicate', async () => {
      const result = await api(`/results/neon-attempts/${passingAttemptId}/events`, {
        method: 'POST', userId: examOfficerId,
        body: { eventType: 'PUBLISHED', idempotencyKey: `TEST-RESULT-API-${suffix}-PUBLISHED` },
      });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.created, false);
      const publishedAuditEntries = db.getState().auditLogs.filter(
        (entry: any) => entry.action === 'ACADEMIC_RESULT_PUBLISHED'
          && entry.details?.resultAttemptId === passingAttemptId,
      );
      assert.equal(publishedAuditEntries.length, 1, 'An idempotent retry must not duplicate the audit entry.');
    });

    await test('same idempotency key cannot be reused by SUPER_ADMIN for another actor', async () => {
      const result = await api(`/results/neon-attempts/${passingAttemptId}/events`, {
        method: 'POST', userId: superAdminId,
        body: { eventType: 'PUBLISHED', idempotencyKey: `TEST-RESULT-API-${suffix}-PUBLISHED` },
      });
      assert.equal(result.status, 409);
    });

    const secondAttemptId = await createAttempt(2);
    await test('out-of-order approval is rejected by the actual API', async () => {
      const result = await api(`/results/neon-attempts/${secondAttemptId}/events`, {
        method: 'POST', userId: examOfficerId,
        body: { eventType: 'APPROVED', idempotencyKey: `TEST-RESULT-API-${suffix}-out-of-order` },
      });
      assert.equal(result.status, 409);
    });

    await test('unknown attempt returns HTTP 404', async () => {
      const result = await api('/results/neon-attempts/TEST-RESULT-API-NOT-FOUND/events', {
        method: 'POST', userId: examOfficerId,
        body: { eventType: 'VERIFIED', idempotencyKey: `TEST-RESULT-API-${suffix}-not-found` },
      });
      assert.equal(result.status, 404);
    });

    await test('SUPER_ADMIN retains the documented override role', async () => {
      const result = await api(`/results/neon-attempts/${secondAttemptId}/events`, {
        method: 'POST', userId: superAdminId,
        body: { eventType: 'VERIFIED', idempotencyKey: `TEST-RESULT-API-${suffix}-admin-verify` },
      });
      assert.equal(result.status, 201, JSON.stringify(result.payload));
      assert.equal(result.payload.event.actorUserId, superAdminId);
    });

    const eventCount = await neonPool!.query(
      'SELECT count(*)::int AS count FROM academic_result_events WHERE result_attempt_id = $1',
      [passingAttemptId],
    );
    assert.equal(eventCount.rows[0].count, 4, 'Expected exactly SUBMITTED, VERIFIED, APPROVED, PUBLISHED.');
    console.log(`RESULT: ${passed} PASS, 0 FAIL. Synthetic rows remain in the temporary Neon branch.`);
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => error ? reject(error) : resolve());
      });
    }
    if (neonPool) await neonPool.end();
  }
}

try {
  await main();
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
