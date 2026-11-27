import { Client } from 'pg';
import { advanceStudentProgression } from '../server/academicProgressionDecisionService';

const ALLOWED = new Set(['edocasti_pg', 'ecasti_staging_db']);
const results: Array<{ name: string; pass: boolean; detail: string }> = [];

function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? '  [' + detail + ']' : ''}`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] refusing NODE_ENV=production');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('[FATAL] DATABASE_URL not set'); process.exit(1); }

  const probe = new Client({ connectionString: url });
  await probe.connect();
  const dbRow = await probe.query('SELECT current_database() AS db');
  const dbName = String(dbRow.rows[0].db);
  console.log('Database:', dbName);
  if (!ALLOWED.has(dbName)) { console.error('[FATAL] not in allow-list'); process.exit(1); }

  const pre = await probe.query(
    `SELECT student_id, current_stage, progression_status, current_session, extension_year
       FROM student_academic_progression WHERE student_id IN ('std-1','std-2') ORDER BY student_id`
  );
  console.log('\n=== PRE ===');
  for (const r of pre.rows) {
    console.log(`${r.student_id}: ${r.current_stage} / ${r.progression_status} / ${r.current_session} / ext=${r.extension_year}`);
  }
  await probe.end();

  // -------- TEST 1: std-2 ND_I -> ND_II --------
  console.log('\n=== TEST 1: std-2 ND_I -> ND_II (COM 111 passed, COM 112 outstanding) ===');
  try {
    const t1 = await advanceStudentProgression({
      studentId: 'std-2',
      academicSession: '2026/2027',
      passedCourseIds: ['crs-com111'],
      missingResultCourseIds: ['crs-com112'],
      decidedBy: 'usr-examofficer',
    });
    console.log('Result:', JSON.stringify(t1, null, 2));
    check('T1 fromStage=ND_I', t1.fromStage === 'ND_I', String(t1.fromStage));
    check('T1 toStage=ND_II', t1.toStage === 'ND_II', String(t1.toStage));
    check('T1 status=ACTIVE', t1.progressionStatus === 'ACTIVE', String(t1.progressionStatus));
    check('T1 ext=0', t1.extensionYear === 0, String(t1.extensionYear));
    check('T1 outstanding=[crs-com112]',
      Array.isArray(t1.outstandingCourseIds) && t1.outstandingCourseIds.length === 1 &&
      t1.outstandingCourseIds[0] === 'crs-com112',
      JSON.stringify(t1.outstandingCourseIds));
  } catch (e) {
    console.log('[T1 SKIPPED]', e instanceof Error ? e.message : String(e));
  }

  // -------- TEST 2: std-1 ND_II -> EXTENSION_1 --------
  // std-1's current state: ND_II / ACTIVE / 2026/2027 / ext=0
  // We advance it to the NEXT session (2027/2028) with courses outstanding.
  console.log('\n=== TEST 2: std-1 ND_II -> EXTENSION_1 (all 4 outstanding) ===');
  try {
    const t2 = await advanceStudentProgression({
      studentId: 'std-1',
      academicSession: '2027/2028',
      passedCourseIds: [],
      missingResultCourseIds: ['crs-agt111', 'crs-agt112', 'crs-agt113', 'crs-gns101'],
      decidedBy: 'usr-examofficer',
    });
    console.log('Result:', JSON.stringify(t2, null, 2));
    check('T2 fromStage=ND_II', t2.fromStage === 'ND_II', String(t2.fromStage));
    check('T2 toStage=EXTENSION_1', t2.toStage === 'EXTENSION_1', String(t2.toStage));
    check('T2 status=EXTENSION', t2.progressionStatus === 'EXTENSION', String(t2.progressionStatus));
    check('T2 ext=1', t2.extensionYear === 1, String(t2.extensionYear));
    check('T2 outstanding=4', Array.isArray(t2.outstandingCourseIds) && t2.outstandingCourseIds.length === 4, String(t2.outstandingCourseIds?.length));
  } catch (e) {
    console.log('[T2 SKIPPED]', e instanceof Error ? e.message : String(e));
  }

  // -------- POST-STATE --------
  const post = new Client({ connectionString: url });
  await post.connect();
  const postState = await post.query(
    `SELECT student_id, current_stage, progression_status, current_session, extension_year
       FROM student_academic_progression WHERE student_id IN ('std-1','std-2') ORDER BY student_id`
  );
  console.log('\n=== POST ===');
  for (const r of postState.rows) {
    console.log(`${r.student_id}: ${r.current_stage} / ${r.progression_status} / ${r.current_session} / ext=${r.extension_year}`);
  }

  const hist = await post.query(
    `SELECT student_id, decision_type, from_stage, to_stage, academic_session, extension_year
       FROM academic_progression_history WHERE student_id IN ('std-1','std-2') ORDER BY student_id, created_at`
  );
  console.log('\n=== HISTORY ===');
  for (const h of hist.rows) {
    console.log(`${h.student_id} | ${h.decision_type} | ${h.from_stage ?? '-'} -> ${h.to_stage} | ${h.academic_session} | ext=${h.extension_year}`);
  }
  await post.end();

  // -------- SUMMARY --------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total checks: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.name} (${f.detail})`);
    process.exit(1);
  }
  console.log('Status: PROGRESSION_TESTS_PASS');
}

main().catch((e) => {
  console.error('[FATAL]', e instanceof Error ? e.message : String(e));
  process.exit(1);
});