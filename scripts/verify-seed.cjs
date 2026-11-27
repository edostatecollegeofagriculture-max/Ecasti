const { Client } = require('pg');

async function main() {
  const url = process.env.EDOCASTI_LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    console.log('=== student_academic_progression ===');
    const p = await c.query(
      `SELECT student_id, programme_id, current_stage, progression_status, extension_year
         FROM student_academic_progression ORDER BY student_id`
    );
    for (const r of p.rows) {
      console.log(`${r.student_id.padEnd(22)} ${r.programme_id.padEnd(15)} ${r.current_stage.padEnd(8)} ${r.progression_status.padEnd(10)} ext=${r.extension_year}`);
    }

    console.log('\n=== academic_progression_history ===');
    const h = await c.query(
      `SELECT student_id, decision_type, from_stage, to_stage, from_status, to_status, academic_session
         FROM academic_progression_history ORDER BY student_id`
    );
    for (const r of h.rows) {
      console.log(`${r.student_id.padEnd(22)} ${r.decision_type.padEnd(15)} ${(r.from_stage||'-').padEnd(6)}->${r.to_stage.padEnd(6)} ${(r.from_status||'-').padEnd(6)}->${r.to_status.padEnd(8)} ${r.academic_session}`);
    }

    console.log('\n=== student_academic_required_courses (by student) ===');
    const rc = await c.query(
      `SELECT student_id, course_code_snapshot, course_level_snapshot, semester_snapshot, credit_units_snapshot, is_required
         FROM student_academic_required_courses
         ORDER BY student_id, course_code_snapshot`
    );
    const byStudent = new Map();
    for (const r of rc.rows) {
      if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
      byStudent.get(r.student_id).push(r);
    }
    for (const [sid, rows] of byStudent) {
      console.log(`\n${sid} (${rows.length} required course(s)):`);
      for (const r of rows) {
        console.log(`  ${r.course_code_snapshot.padEnd(10)} ${r.course_level_snapshot} ${r.semester_snapshot.padEnd(16)} units=${r.credit_units_snapshot} ${r.is_required ? 'REQ' : '-'}`);
      }
    }

    console.log('\n=== curriculum mapping lifecycle ===');
    const m = await c.query(
      `SELECT id, programme_id, cohort_session, status, is_current,
              prepared_by, approved_by, submitted_at IS NOT NULL AS has_submitted_at, approved_at IS NOT NULL AS has_approved_at
         FROM academic_curriculum_mappings ORDER BY id`
    );
    for (const r of m.rows) {
      console.log(`${r.id}`);
      console.log(`  ${r.programme_id} ${r.cohort_session} status=${r.status} current=${r.is_current}`);
      console.log(`  prepared_by=${r.prepared_by} approved_by=${r.approved_by} submitted=${r.has_submitted_at} approved=${r.has_approved_at}`);
    }
  } catch (e) {
    console.error('[FATAL]', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}
main();