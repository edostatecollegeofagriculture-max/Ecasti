/**
 * Test the academic progression engine against real seeded data.
 *
 * NOTE: The engine opens its OWN connection to Postgres (neonPool), so the
 * test cannot wrap it in a rollback-able transaction. These tests MUTATE
 * edocasti_pg: if they pass, students advance to their new stages. That's a
 * real progression record, not a test artifact.
 *
 * If you need to reset later:
 *   DROP DATABASE edocasti_pg; CREATE DATABASE edocasti_pg;
 *   node .\scripts\apply-006.cjs
 *   node .\scripts\seed-progression-foundation.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const { Client, Pool } = require('pg');
const { spawnSync } = require('child_process');

const ALLOWED_DBS = new Set(['edocasti_pg', 'ecasti_staging_db']);
const RUNNER_TS = path.resolve(process.cwd(), 'scripts', '_engine-runner.ts');

function fail(msg) {
  console.error('[FATAL]', msg);
  process.exit(1);
}

function runEngine(scenario) {
  const env = {
    ...process.env,
    EDOCASTI_TEST_SCENARIO: JSON.stringify(scenario),
  };
  // On Windows, npx is npx.cmd. shell:true also works. Use both.
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(cmd, ['tsx', RUNNER_TS], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    shell: true,
  });
  if (r.error) {
    fail(`Could not spawn ${cmd}: ${r.error.message}`);
  }
  if (r.status !== 0) {
    console.error('[runner stdout]', r.stdout);
    console.error('[runner stderr]', r.stderr);
    fail(`Engine runner exited with status ${r.status}`);
  }
  const start = r.stdout.indexOf('<<<RESULT>>>');
  const end = r.stdout.indexOf('<<<END>>>');
  if (start < 0 || end < 0) {
    fail('Runner output missing markers.\nstdout:\n' + r.stdout + '\nstderr:\n' + r.stderr);
  }
  const json = r.stdout.slice(start + '<<<RESULT>>>'.length, end).trim();
  return JSON.parse(json);
}

async function main() {
  if (process.env.NODE_ENV === 'production') fail('Refusing to run with NODE_ENV=production.');

  if (!fs.existsSync(RUNNER_TS)) {
    fail('Runner not found: ' + RUNNER_TS);
  }
  if (fs.statSync(RUNNER_TS).size < 100) {
    fail('Runner is empty or truncated: ' + RUNNER_TS);
  }

  const url = process.env.EDOCASTI_LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) fail('No DATABASE_URL.');

  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const id = await c.query('SELECT current_database() AS db');
    const dbName = String(id.rows[0].db);
    console.log('Target database:', dbName);
    if (!ALLOWED_DBS.has(dbName)) fail(`Database "${dbName}" not in allow-list.`);
  } finally {
    await c.end();
  }

  const results = [];
  function check(name, condition, detail) {
    results.push({ name, pass: !!condition, detail: detail || '' });
    console.log(`${condition ? 'PASS' : 'FAIL'}: ${name}${detail ? '  [' + detail + ']' : ''}`);
  }

  // ---------------------------------------------------------------
  // Pre-state: read std-1 and std-2 current progression
  // ---------------------------------------------------------------
  const pool = new Pool({ connectionString: url, max: 2 });
  const pre = await pool.query(
    `SELECT student_id, current_stage, progression_status, current_session, extension_year
       FROM student_academic_progression
      WHERE student_id IN ('std-1','std-2')
      ORDER BY student_id`
  );
  console.log('\n=== PRE-STATE ===');
  for (const r of pre.rows) {
    console.log(`${r.student_id}: ${r.current_stage} / ${r.progression_status} / session=${r.current_session} / ext=${r.extension_year}`);
  }
  await pool.end();

  // ---------------------------------------------------------------
  // TEST 1 — std-1 ND_I, all 4 outstanding. Expect ND_I -> ND_II.
  // ---------------------------------------------------------------
  console.log('\n=== TEST 1: std-1 ND_I -> ND_II with all 4 outstanding ===');
  const t1 = runEngine({
    op: 'advance',
    studentId: 'std-1',
    academicSession: '2026/2027',
    passedCourseIds: [],
    missingResultCourseIds: ['crs-agt111', 'crs-agt112', 'crs-agt113', 'crs-gns101'],
    decidedBy: 'usr-examofficer',
  });
  console.log('Result:', JSON.stringify(t1, null, 2));

  check('T1 fromStage=ND_I', t1.fromStage === 'ND_I', `got ${t1.fromStage}`);
  check('T1 toStage=ND_II', t1.toStage === 'ND_II', `got ${t1.toStage}`);
  check('T1 progressionStatus=ACTIVE', t1.progressionStatus === 'ACTIVE', `got ${t1.progressionStatus}`);
  check('T1 extensionYear=0', t1.extensionYear === 0, `got ${t1.extensionYear}`);
  check('T1 outstanding = 4 courses',
    Array.isArray(t1.outstandingCourseIds) && t1.outstandingCourseIds.length === 4,
    `got ${t1.outstandingCourseIds ? t1.outstandingCourseIds.length : 'null'}`);

  // ---------------------------------------------------------------
  // TEST 2 — std-2 ND_I, COM 111 passed, COM 112 outstanding.
  // Expect ND_I -> ND_II, outstanding = [crs-com112].
  // ---------------------------------------------------------------
  console.log('\n=== TEST 2: std-2 ND_I -> ND_II with COM 112 outstanding ===');
  const t2 = runEngine({
    op: 'advance',
    studentId: 'std-2',
    academicSession: '2026/2027',
    passedCourseIds: ['crs-com111'],
    missingResultCourseIds: ['crs-com112'],
    decidedBy: 'usr-examofficer',
  });
  console.log('Result:', JSON.stringify(t2, null, 2));

  check('T2 fromStage=ND_I', t2.fromStage === 'ND_I', `got ${t2.fromStage}`);
  check('T2 toStage=ND_II', t2.toStage === 'ND_II', `got ${t2.toStage}`);
  check('T2 progressionStatus=ACTIVE', t2.progressionStatus === 'ACTIVE', `got ${t2.progressionStatus}`);
  check('T2 outstanding = 1 course (crs-com112)',
    Array.isArray(t2.outstandingCourseIds) && t2.outstandingCourseIds.length === 1 &&
    t2.outstandingCourseIds[0] === 'crs-com112',
    `got ${JSON.stringify(t2.outstandingCourseIds)}`);

  // ---------------------------------------------------------------
  // TEST 3 — std-2 already at ND_II (from T2). Advance again with
  // COM 112 still outstanding. Expect ND_II -> EXTENSION_1.
  // ---------------------------------------------------------------
  console.log('\n=== TEST 3: std-2 ND_II -> EXTENSION_1 with COM 112 outstanding ===');
  const t3 = runEngine({
    op: 'advance',
    studentId: 'std-2',
    academicSession: '2027/2028',
    passedCourseIds: ['crs-com111'],
    missingResultCourseIds: ['crs-com112'],
    decidedBy: 'usr-examofficer',
  });
  console.log('Result:', JSON.stringify(t3, null, 2));

  check('T3 fromStage=ND_II', t3.fromStage === 'ND_II', `got ${t3.fromStage}`);
  check('T3 toStage=EXTENSION_1', t3.toStage === 'EXTENSION_1', `got ${t3.toStage}`);
  check('T3 progressionStatus=EXTENSION', t3.progressionStatus === 'EXTENSION', `got ${t3.progressionStatus}`);
  check('T3 extensionYear=1', t3.extensionYear === 1, `got ${t3.extensionYear}`);

  // ---------------------------------------------------------------
  // POST-STATE: read again to confirm the mutations are visible
  // ---------------------------------------------------------------
  const pool2 = new Pool({ connectionString: url, max: 2 });
  try {
    const post = await pool2.query(
      `SELECT student_id, current_stage, progression_status, current_session, extension_year
         FROM student_academic_progression
        WHERE student_id IN ('std-1','std-2')
        ORDER BY student_id`
    );
    console.log('\n=== POST-STATE ===');
    for (const r of post.rows) {
      console.log(`${r.student_id}: ${r.current_stage} / ${r.progression_status} / session=${r.current_session} / ext=${r.extension_year}`);
    }

    const hist = await pool2.query(
      `SELECT student_id, decision_type, from_stage, to_stage, academic_session, extension_year
         FROM academic_progression_history
        WHERE student_id IN ('std-1','std-2')
        ORDER BY student_id, created_at`
    );
    console.log('\n=== HISTORY (all rows for std-1, std-2) ===');
    for (const h of hist.rows) {
      console.log(`${h.student_id} | ${h.decision_type} | ${h.from_stage || '-'} -> ${h.to_stage} | ${h.academic_session} | ext=${h.extension_year}`);
    }
  } finally {
    await pool2.end();
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length) {
    console.log('\nFailed checks:');
    for (const f of failed) console.log(`  - ${f.name} (${f.detail})`);
    process.exit(1);
  }
  console.log('Status: PROGRESSION_TESTS_PASS');
}
main().catch((e) => fail(e.message));