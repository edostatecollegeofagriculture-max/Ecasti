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
const DATABASE_URL = process.env.DATABASE_URL;
assert(DATABASE_URL, 'DATABASE_URL is missing. Configure the disposable Neon branch in .env.');
const parsedDatabaseUrl = new URL(DATABASE_URL);
assert(
  parsedDatabaseUrl.hostname === EXPECTED_TEMPORARY_HOST && parsedDatabaseUrl.pathname.slice(1) === 'neondb',
  'STOP: DATABASE_URL is not the confirmed edocasti-migration006-test branch. No database queries or writes were attempted.',
);

const confirmation = createInterface({ input: stdin, output: stdout });
try {
  const answer = await confirmation.question(
    'This test mounts the actual academic API and writes only TEST-API-prefixed records to edocasti-migration006-test. Type TEMPORARY to continue: ',
  );
  assert.equal(answer.trim(), 'TEMPORARY', 'Confirmation not provided. No API tests were run.');
} finally {
  confirmation.close();
}

const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
const programmeId = `TEST-API-PROG-${suffix}`;
const departmentId = `TEST-API-DEPT-${suffix}`;
const schoolId = `TEST-API-SCHOOL-${suffix}`;
const cohort = `TEST-API-COHORT-${suffix}`;
const studentOneId = `TEST-API-STUDENT-A-${suffix}`;
const studentTwoId = `TEST-API-STUDENT-B-${suffix}`;
const studentOneUserId = `TEST-API-USER-A-${suffix}`;
const studentTwoUserId = `TEST-API-USER-B-${suffix}`;
const preparerId = `TEST-API-HOD-${suffix}`;
const registrarId = `TEST-API-REGISTRAR-${suffix}`;
const rectorId = `TEST-API-RECTOR-${suffix}`;
const courseIds = [
  `TEST-API-COURSE-101-${suffix}`,
  `TEST-API-COURSE-102-${suffix}`,
  `TEST-API-COURSE-201-${suffix}`,
  `TEST-API-COURSE-202-${suffix}`,
];
const jwtSecret = 'isolated-api-integration-secret-at-least-32-characters';
process.env.JWT_SECRET = jwtSecret;

const tempDirectory = mkdtempSync(path.join(tmpdir(), 'edocasti-api-test-'));
const fixturePath = path.join(tempDirectory, 'synthetic-edocasti-db.json');
process.env.EDOCASTI_DATA_FILE = fixturePath;

const now = new Date().toISOString();
const user = (id: string, role: string, scope: Record<string, string> = {}) => ({
  id,
  email: `${id.toLowerCase()}@integration.invalid`,
  passwordHash: 'not-used-by-token-authentication',
  fullName: `Synthetic ${role}`,
  role,
  isActive: true,
  isLocked: false,
  failedLoginAttempts: 0,
  createdAt: now,
  ...scope,
});
const student = (id: string, userId: string) => ({
  id,
  matricNumber: id,
  userId,
  programmeId,
  departmentId,
  schoolId,
  level: 'ND I',
  sessionAdmitted: cohort,
  academicStatus: 'Good Standing',
  gender: 'Not specified',
  dob: '2000-01-01',
  emergencyContact: 'Synthetic contact',
  nextOfKin: 'Synthetic next of kin',
  cgpa: 0,
  totalCreditsEarned: 0,
});
const courses = [
  { id: courseIds[0], departmentId, programmeId, code: 'TAPI101', title: 'Synthetic ND I Course 1', creditUnits: 2, level: 'ND I', semester: 'First Semester', isCompulsory: true },
  { id: courseIds[1], departmentId, programmeId, code: 'TAPI102', title: 'Synthetic ND I Course 2', creditUnits: 3, level: 'ND I', semester: 'Second Semester', isCompulsory: true },
  { id: courseIds[2], departmentId, programmeId, code: 'TAPI201', title: 'Synthetic ND II Course 1', creditUnits: 2, level: 'ND II', semester: 'First Semester', isCompulsory: true },
  { id: courseIds[3], departmentId, programmeId, code: 'TAPI202', title: 'Synthetic ND II Exception Course', creditUnits: 2, level: 'ND II', semester: 'Second Semester', isCompulsory: true },
];
const fixture = {
  settings: { id: 'TEST-API-SETTINGS', institutionName: 'Synthetic Integration Institution', shortName: 'TEST', motto: '', state: 'Edo', country: 'Nigeria', currentSession: 'TEST', currentSemester: 'First Semester', admissionsOpen: false, courseRegistrationOpen: false, feePaymentRequiredForReg: false, contactEmail: 'integration.invalid', contactPhone: '', address: '', caMaxMarks: 40, examMaxMarks: 60 },
  users: [
    user(studentOneUserId, 'STUDENT'),
    user(studentTwoUserId, 'STUDENT'),
    user(preparerId, 'HOD', { departmentId }),
    user(registrarId, 'REGISTRAR'),
    user(rectorId, 'RECTOR'),
  ],
  schools: [{ id: schoolId, code: 'TAPI', name: 'Synthetic Test School', description: '' }],
  departments: [{ id: departmentId, schoolId, code: 'TAPID', name: 'Synthetic Test Department' }],
  programmes: [{ id: programmeId, departmentId, code: 'TAPIP', name: 'Synthetic ND Programme', qualification: 'ND', durationYears: 2, description: '', requirements: [] }],
  courses,
  applications: [],
  students: [student(studentOneId, studentOneUserId), student(studentTwoId, studentTwoUserId)],
  registrations: [],
  results: [],
  feeSchedules: [],
  invoices: [],
  payments: [],
  attendance: [],
  supportTickets: [],
  auditLogs: [],
  newsArticles: [],
  feeCatalogItems: [],
  programFeeSchedules: [],
  programFeeScheduleItems: [],
  studentFeeObligations: [],
  studentPayments: [],
  studentPaymentAllocations: [],
  sliderSlides: [],
  pageContent: {},
  issuedDocuments: [],
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
  try {
    // Dynamic imports ensure the application reads only the disposable fixture
    // and the explicitly verified temporary Neon branch.
    const [{ academicProgressionApiRouter }, database, neon, expressModule] = await Promise.all([
      import('../server/academicProgressionApiRouter'),
      import('../server/db'),
      import('../server/neon'),
      import('express'),
    ]);
    neonPool = neon.neonPool;
    const db = database.db;
    const express = expressModule.default;

    const schemaCheck = await neonPool.query(
      `SELECT
         to_regclass('public.academic_curriculum_mappings') AS mappings,
         to_regclass('public.student_academic_curriculum_assignments') AS assignments,
         to_regclass('public.student_academic_required_courses') AS required_courses,
         to_regclass('public.academic_curriculum_assignment_ledger') AS assignment_ledger,
         to_regclass('public.academic_student_curriculum_exceptions') AS exceptions,
         to_regclass('public.student_academic_progression') AS progression,
         to_regclass('public.academic_progression_history') AS progression_history,
         to_regclass('public.academic_management_pass_approvals') AS management_pass_approvals`,
    );
    const schema = schemaCheck.rows[0];
    assert(schema && Object.values(schema).every(Boolean), 'Required migration 006-008 academic tables are missing on the temporary branch.');
    const actorColumn = await neonPool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'academic_progression_history'
            AND column_name = 'decided_by'
       ) AS present`,
    );
    assert(actorColumn.rows[0]?.present === true, 'Migration 008 actor-attribution column is missing on the temporary branch.');

    const app = express();
    app.use(express.json());
    app.use('/api/v1/academic-progression', academicProgressionApiRouter);
    const listeningServer = app.listen(0, '127.0.0.1');
    server = listeningServer;
    await new Promise<void>((resolve, reject) => {
      listeningServer.once('listening', resolve);
      listeningServer.once('error', reject);
    });
    const address = listeningServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/academic-progression`;

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

    let mappingId = '';
    await test('actual curriculum API rejects unauthenticated mapping creation', async () => {
      const result = await api('/curriculum/mappings', {
        method: 'POST',
        body: { programmeId, cohortSession: cohort },
      });
      assert.equal(result.status, 401);
    });

    await test('actual curriculum API creates a scoped draft mapping', async () => {
      const result = await api('/curriculum/mappings', {
        method: 'POST',
        userId: preparerId,
        body: { programmeId, cohortSession: cohort },
      });
      assert.equal(result.status, 201, JSON.stringify(result.payload));
      mappingId = result.payload.mapping.id;
      assert.ok(mappingId);
    });

    await test('actual curriculum API adds ND I and ND II compulsory course snapshots', async () => {
      for (const courseId of courseIds.slice(0, 3)) {
        const result = await api(`/curriculum/mappings/${mappingId}/courses`, {
          method: 'POST',
          userId: preparerId,
          body: { courseId },
        });
        assert.equal(result.status, 201, JSON.stringify(result.payload));
      }
    });

    await test('actual curriculum API submits and independently approves the mapping', async () => {
      const submit = await api(`/curriculum/mappings/${mappingId}/submit`, { method: 'POST', userId: preparerId, body: {} });
      assert.equal(submit.status, 200, JSON.stringify(submit.payload));
      const approve = await api(`/curriculum/mappings/${mappingId}/review`, {
        method: 'POST', userId: registrarId, body: { decision: 'APPROVE' },
      });
      assert.equal(approve.status, 200, JSON.stringify(approve.payload));
      assert.equal(approve.payload.result.status, 'APPROVED');
    });

    await test('actual assignment API assigns snapshots to both synthetic students', async () => {
      for (const id of [studentOneId, studentTwoId]) {
        const result = await api(`/students/${id}/curriculum-assignment`, {
          method: 'POST', userId: registrarId, body: {},
        });
        assert.equal(result.status, 200, JSON.stringify(result.payload));
        assert.equal(result.payload.assignment.status, 'ASSIGNED');
      }
    });

    await test('actual assignment API denies a Student role from creating an assignment', async () => {
      const result = await api(`/students/${studentOneId}/curriculum-assignment`, {
        method: 'POST', userId: studentOneUserId, body: {},
      });
      assert.equal(result.status, 403);
    });

    await test('actual assignment API is idempotent on a repeated request', async () => {
      const result = await api(`/students/${studentOneId}/curriculum-assignment`, {
        method: 'POST', userId: registrarId, body: {},
      });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.assignment.status, 'ALREADY_ASSIGNED');
    });

    await test('actual assignment GET returns the own student snapshot', async () => {
      const result = await api(`/students/${studentOneId}/curriculum-assignment`, { userId: studentOneUserId });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.courses.length, 3);
    });

    await test('actual assignment GET blocks cross-student access', async () => {
      const result = await api(`/students/${studentOneId}/curriculum-assignment`, { userId: studentTwoUserId });
      assert.equal(result.status, 403);
    });

    await test('actual exception API blocks cross-student submission', async () => {
      const result = await api(`/students/${studentOneId}/curriculum-exceptions`, {
        method: 'POST', userId: studentTwoUserId,
        body: { action: 'ADD_COURSE', courseId: courseIds[3], reason: 'Synthetic test only.' },
      });
      assert.equal(result.status, 403);
    });

    await test('actual exception GET blocks cross-student access', async () => {
      const result = await api(`/students/${studentOneId}/curriculum-exceptions`, { userId: studentTwoUserId });
      assert.equal(result.status, 403);
    });

    let exceptionId = '';
    await test('actual exception API accepts the student own-record request', async () => {
      const result = await api(`/students/${studentOneId}/curriculum-exceptions`, {
        method: 'POST', userId: studentOneUserId,
        body: { action: 'ADD_COURSE', courseId: courseIds[3], reason: 'Synthetic API integration test exception.' },
      });
      assert.equal(result.status, 201, JSON.stringify(result.payload));
      exceptionId = result.payload.exception.id;
      assert.ok(exceptionId);
    });

    await test('actual exception review API requires Registry role', async () => {
      const result = await api(`/curriculum-exceptions/${exceptionId}/review`, {
        method: 'POST', userId: preparerId, body: { decision: 'APPROVE' },
      });
      assert.equal(result.status, 403);
    });

    await test('actual Registry review API approves the synthetic exception', async () => {
      const result = await api(`/curriculum-exceptions/${exceptionId}/review`, {
        method: 'POST', userId: registrarId, body: { decision: 'APPROVE' },
      });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.result.status, 'APPROVED');
    });

    await test('actual exception GET returns the student exception history', async () => {
      const result = await api(`/students/${studentOneId}/curriculum-exceptions`, { userId: studentOneUserId });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.exceptions.length, 1);
    });

    // One submitted but unpublished result must remain outstanding. Student B
    // receives published passing synthetic results for the normal-clearance path.
    db.getState().results.push({
      id: `TEST-API-UNPUBLISHED-${suffix}`,
      courseId: courseIds[0],
      studentId: studentOneId,
      matricNumber: studentOneId,
      studentName: 'Synthetic Student A',
      session: 'TEST-API-SESSION',
      semester: 'First Semester',
      caScore: 20,
      examScore: 30,
      totalScore: 50,
      grade: 'C',
      gradePoint: 3,
      status: 'SUBMITTED',
    });
    for (const courseId of courseIds.slice(0, 3)) {
      db.getState().results.push({
        id: `TEST-API-PUBLISHED-${courseId}-${suffix}`,
        courseId,
        studentId: studentTwoId,
        matricNumber: studentTwoId,
        studentName: 'Synthetic Student B',
        session: 'TEST-API-SESSION',
        semester: 'First Semester',
        caScore: 25,
        examScore: 35,
        totalScore: 60,
        grade: 'B',
        gradePoint: 4,
        status: 'PUBLISHED',
        publishedAt: now,
      });
    }

    await test('actual eligibility API distinguishes unpublished and missing results', async () => {
      const result = await api(`/students/${studentOneId}/snapshot-eligibility`, { userId: registrarId });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.eligibility.eligible, false);
      assert.equal(result.payload.eligibility.unpublishedResultCount, 1);
      assert.equal(result.payload.eligibility.missingResultCount, 3);
    });

    await test('actual eligibility API recognizes all published passing results', async () => {
      const result = await api(`/students/${studentTwoId}/snapshot-eligibility`, { userId: registrarId });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.eligibility.eligible, true);
      assert.equal(result.payload.eligibility.passedCourseCount, 3);
    });

    await test('actual progression API initializes the synthetic student at ND I', async () => {
      const result = await api(`/students/${studentOneId}/progression/initialize`, {
        method: 'POST', userId: registrarId, body: { academicSession: `TEST-API-2025-${suffix}` },
      });
      assert.equal(result.status, 201, JSON.stringify(result.payload));
      assert.equal(result.payload.progression.current_stage, 'ND_I');
    });

    const advance = async (studentId: string, session: string, userId = registrarId) =>
      api(`/students/${studentId}/progression/advance`, {
        method: 'POST', userId, body: { academicSession: session },
      });

    await test('actual management-pass API rejects a Rector request before Extension Year 3', async () => {
      const result = await api(`/students/${studentOneId}/progression/management-pass`, {
        method: 'POST', userId: rectorId,
        body: { academicSession: `TEST-API-EARLY-PASS-${suffix}`, reason: 'Synthetic early-stage rejection test.' },
      });
      assert.equal(result.status, 409, JSON.stringify(result.payload));
    });

    await test('actual progression API advances ND I to ND II with outstanding requirements', async () => {
      const result = await advance(studentOneId, `TEST-API-2026-${suffix}`);
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.progression.toStage, 'ND_II');
      assert.equal(result.payload.progression.outstandingCourseIds.length, 2);
    });

    await test('actual progression API moves ND II with outstanding courses to Extension Year 1', async () => {
      const result = await advance(studentOneId, `TEST-API-2027-${suffix}`);
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.progression.toStage, 'EXTENSION_1');
    });

    await test('actual progression API advances sequentially through Extension Years 2 and 3', async () => {
      const yearTwo = await advance(studentOneId, `TEST-API-2028-${suffix}`);
      assert.equal(yearTwo.status, 200, JSON.stringify(yearTwo.payload));
      assert.equal(yearTwo.payload.progression.toStage, 'EXTENSION_2');
      const yearThree = await advance(studentOneId, `TEST-API-2029-${suffix}`);
      assert.equal(yearThree.status, 200, JSON.stringify(yearThree.payload));
      assert.equal(yearThree.payload.progression.toStage, 'EXTENSION_3');
    });

    await test('actual management-pass API rejects non-Rector and SUPER_ADMIN actors', async () => {
      const registrar = await api(`/students/${studentOneId}/progression/management-pass`, {
        method: 'POST', userId: registrarId,
        body: { academicSession: `TEST-API-2030-${suffix}`, reason: 'Synthetic test.' },
      });
      assert.equal(registrar.status, 403);
      const superAdminId = `TEST-API-SUPER-${suffix}`;
      db.getState().users.push({
        id: superAdminId, email: `${superAdminId}@integration.invalid`, passwordHash: 'unused',
        fullName: 'Synthetic Super Admin', role: 'SUPER_ADMIN', isActive: true, isLocked: false,
        failedLoginAttempts: 0, createdAt: now,
      });
      const superAdmin = await api(`/students/${studentOneId}/progression/management-pass`, {
        method: 'POST', userId: superAdminId,
        body: { academicSession: `TEST-API-2030-${suffix}`, reason: 'Synthetic test.' },
      });
      assert.equal(superAdmin.status, 403);
    });

    await test('actual management-pass API records Rector approval at Extension Year 3', async () => {
      const result = await api(`/students/${studentOneId}/progression/management-pass`, {
        method: 'POST', userId: rectorId,
        body: { academicSession: `TEST-API-2030-${suffix}`, reason: 'Synthetic Rector-approved API integration test.' },
      });
      assert.equal(result.status, 200, JSON.stringify(result.payload));
      assert.equal(result.payload.progression.status, 'GRADUATED');
      assert.equal(result.payload.progression.decisionType, 'MANAGEMENT_APPROVED_PASS');
    });

    await test('actual progression API initializes and normally graduates a fully passed student', async () => {
      const init = await api(`/students/${studentTwoId}/progression/initialize`, {
        method: 'POST', userId: registrarId, body: { academicSession: `TEST-API-GRAD-2025-${suffix}` },
      });
      assert.equal(init.status, 201, JSON.stringify(init.payload));
      const ndOne = await advance(studentTwoId, `TEST-API-GRAD-2026-${suffix}`);
      assert.equal(ndOne.status, 200, JSON.stringify(ndOne.payload));
      assert.equal(ndOne.payload.progression.toStage, 'ND_II');
      const ndTwo = await advance(studentTwoId, `TEST-API-GRAD-2027-${suffix}`);
      assert.equal(ndTwo.status, 200, JSON.stringify(ndTwo.payload));
      assert.equal(ndTwo.payload.progression.toStage, 'GRADUATED');
      assert.equal(ndTwo.payload.progression.progressionStatus, 'GRADUATED');
    });

    console.log(`RESULT: ${passed} PASS, 0 FAIL`);
    console.log('Only TEST-API-prefixed synthetic rows were written to the confirmed temporary Neon branch.');
    console.log('The disposable JSON fixture was isolated under the OS temporary directory and will be removed.');
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
    if (neonPool) await neonPool.end();
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('API INTEGRATION TEST FAILED:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
