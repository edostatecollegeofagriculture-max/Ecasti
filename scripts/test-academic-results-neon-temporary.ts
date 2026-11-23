import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { Pool } from 'pg';

const EXPECTED_TEMPORARY_HOST = 'ep-blue-mud-bdm6m3i0-pooler.c-8.us-east-2.aws.neon.tech';
const databaseUrl = process.env.DATABASE_URL;
assert(databaseUrl, 'DATABASE_URL is missing. Configure the disposable Neon branch in .env.');
const parsed = new URL(databaseUrl);
assert(
  parsed.hostname === EXPECTED_TEMPORARY_HOST && parsed.pathname.replace(/^\\//, '') === 'neondb',
  'STOP: DATABASE_URL is not the confirmed temporary Neon branch. No database query or write was attempted.',
);

const confirmation = createInterface({ input: stdin, output: stdout });
try {
  const answer = await confirmation.question(
    'This test writes synthetic TEST-RESULT- records to the disposable Neon branch. Rows are append-only and will remain for audit. Type TEMPORARY to continue: ',
  );
  assert.equal(answer.trim(), 'TEMPORARY', 'Confirmation not provided. No result tests were run.');
} finally {
  confirmation.close();
}

const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
const studentId = `TEST-RESULT-STUDENT-${suffix}`;
const courseId = `TEST-RESULT-COURSE-${suffix}`;
const actorId = `TEST-RESULT-ACTOR-${suffix}`;
const session = `TEST-RESULT-SESSION-${suffix}`;
const key = (name: string) => `TEST-RESULT-${suffix}-${name}`;
let neonPool: Pool | undefined;
let passed = 0;

async function test(name: string, run: () => Promise<void>) {
  await run();
  passed += 1;
  console.log(`[PASS] ${name}`);
}

async function main() {
  const neon = await import('../server/neon');
  neonPool = neon.neonPool;
  const schema = await neonPool.query(
    `SELECT
       to_regclass('public.academic_result_attempts') AS attempts,
       to_regclass('public.academic_result_events') AS events,
       to_regclass('public.academic_result_source_sync') AS freshness,
       to_regclass('public.academic_authoritative_published_results') AS published_view`,
  );
  assert(
    schema.rows[0] && Object.values(schema.rows[0]).every(Boolean),
    'Migration 009 is not installed on the verified temporary Neon branch.',
  );

  const service = await import('../server/academicResultNeonService');
  let passingAttemptId = '';
  let failingAttemptId = '';

  await test('creates a synthetic passing attempt and its SUBMITTED event atomically', async () => {
    const created = await service.createAcademicResultAttempt({
      studentId, courseId, academicSession: session, semester: 'First Semester',
      attemptNumber: 1, caScore: 35, examScore: 45, totalScore: 80,
      grade: 'A', gradePoint: 4, actorUserId: actorId,
      idempotencyKey: key('attempt-1'),
    });
    assert.equal(created.created, true);
    passingAttemptId = String(created.attempt.id);
    const event = await neonPool!.query(
      'SELECT event_type FROM academic_result_events WHERE result_attempt_id = $1 ORDER BY event_sequence',
      [passingAttemptId],
    );
    assert.deepEqual(event.rows.map((row) => row.event_type), ['SUBMITTED']);
  });

  await test('retries the same submission idempotently without creating a duplicate', async () => {
    const retried = await service.createAcademicResultAttempt({
      studentId, courseId, academicSession: session, semester: 'First Semester',
      attemptNumber: 1, caScore: 35, examScore: 45, totalScore: 80,
      grade: 'A', gradePoint: 4, actorUserId: actorId,
      idempotencyKey: key('attempt-1'),
    });
    assert.equal(retried.created, false);
    assert.equal(String(retried.attempt.id), passingAttemptId);
  });

  await test('enforces VERIFIED then APPROVED then PUBLISHED sequence', async () => {
    for (const eventType of ['VERIFIED', 'APPROVED', 'PUBLISHED'] as const) {
      const event = await service.appendAcademicResultEvent({
        resultAttemptId: passingAttemptId, eventType, actorUserId: actorId,
        idempotencyKey: key(`pass-${eventType.toLowerCase()}`),
      });
      assert.equal(event.created, true);
    }
  });

  await test('retains an earlier published pass alongside a later failed attempt', async () => {
    const created = await service.createAcademicResultAttempt({
      studentId, courseId, academicSession: session, semester: 'First Semester',
      attemptNumber: 2, caScore: 10, examScore: 15, totalScore: 25,
      grade: 'F', gradePoint: 0, actorUserId: actorId,
      idempotencyKey: key('attempt-2'),
    });
    failingAttemptId = String(created.attempt.id);
    for (const eventType of ['VERIFIED', 'APPROVED', 'PUBLISHED'] as const) {
      await service.appendAcademicResultEvent({
        resultAttemptId: failingAttemptId, eventType, actorUserId: actorId,
        idempotencyKey: key(`fail-${eventType.toLowerCase()}`),
      });
    }
    const published = await neonPool!.query(
      `SELECT result_attempt_id, grade
         FROM academic_authoritative_published_results
        WHERE student_id = $1 AND course_id = $2 AND academic_session = $3
        ORDER BY attempt_number`,
      [studentId, courseId, session],
    );
    assert.equal(published.rows.length, 2);
    assert.equal(published.rows[0].grade, 'A');
    assert.equal(published.rows[1].grade, 'F');
  });

  await test('fails closed while source freshness is incomplete', async () => {
    const freshness = await service.getAcademicResultSourceFreshness();
    assert.equal(freshness.isComplete, false);
    await assert.rejects(
      () => service.listAuthoritativePublishedAcademicResults({ studentId, courseId }),
      /AUTHORITATIVE_RESULT_SOURCE_UNAVAILABLE/,
    );
  });

  await test('requires a reason and records explicit invalidation', async () => {
    await assert.rejects(
      () => service.appendAcademicResultEvent({
        resultAttemptId: passingAttemptId, eventType: 'INVALIDATED',
        actorUserId: actorId, idempotencyKey: key('invalid-no-reason'),
      }),
      /reason is required/i,
    );
    const event = await service.appendAcademicResultEvent({
      resultAttemptId: passingAttemptId, eventType: 'INVALIDATED',
      actorUserId: actorId, reason: 'Synthetic integration test invalidation',
      idempotencyKey: key('invalid-pass'),
    });
    assert.equal(event.created, true);
    const published = await neonPool!.query(
      'SELECT result_attempt_id FROM academic_authoritative_published_results WHERE result_attempt_id = $1',
      [passingAttemptId],
    );
    assert.equal(published.rowCount, 0);
  });

  await test('rejects deletion of retained result attempts', async () => {
    await assert.rejects(
      () => neonPool!.query('DELETE FROM academic_result_attempts WHERE id = $1', [failingAttemptId]),
      /append-only/i,
    );
  });

  console.log(`\\n${passed} PASS, 0 FAIL. Synthetic rows remain in the temporary branch by design.`);
}

try {
  await main();
} finally {
  if (neonPool) await neonPool.end();
}
