/**
 * Seed migration 006 progression tables from ecasti_application_state.
 *
 * RECOMMENDATIONS APPLIED:
 *   Q1 — course→programme matched via departmentId (Option B)
 *   Q2 — ND I courses only; ND II to be added later
 *   Q3 — prepared_by=usr-hod-agric, approved_by=usr-registrar, assigned_by=usr-registrar
 *
 * ORDERING NOTE (per migration 006 trigger validate_academic_curriculum_mapping_review):
 *   The review row is a *record of a transition that already happened*.
 *   Therefore: update the mapping to SUBMITTED first, then insert the SUBMITTED
 *   review. Same for APPROVED. The trigger validates the review row against the
 *   mapping's *current* state at insert time.
 *
 * SAFETY:
 *   - Reads ecasti_application_state read-only
 *   - Does not touch edocasti_db.json
 *   - One transaction per (programmeId, cohortSession)
 *   - Idempotent via ON CONFLICT DO NOTHING
 *   - Dry-run by default; --apply required to commit
 *   - Refuses if migration 006 tables are missing
 */
const { Client } = require('pg');

const ALLOWED_DBS = new Set(['edocasti_pg', 'ecasti_staging_db']);
const PREPARED_BY = 'usr-hod-agric';
const APPROVED_BY = 'usr-registrar';
const ASSIGNED_BY = 'usr-registrar';

function fail(msg) {
  console.error('[FATAL]', msg);
  process.exit(1);
}

function short(id) {
  return id.length <= 40 ? id : id.slice(0, 20) + '...' + id.slice(-8);
}

async function main() {
  if (process.env.NODE_ENV === 'production') fail('Refusing to run with NODE_ENV=production.');

  const apply = process.argv.includes('--apply');
  const url = process.env.EDOCASTI_LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) fail('Neither EDOCASTI_LOCAL_DATABASE_URL nor DATABASE_URL is set.');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const id = await client.query('SELECT current_database() AS db');
    const dbName = String(id.rows[0].db);
    console.log('Target database:', dbName);
    if (!ALLOWED_DBS.has(dbName)) fail(`Database "${dbName}" not in allow-list.`);

    // Confirm migration 006 tables are present.
    const required = [
      'academic_curriculum_mappings',
      'academic_curriculum_mapping_courses',
      'academic_curriculum_mapping_reviews',
      'student_academic_curriculum_assignments',
      'academic_curriculum_assignment_ledger',
      'student_academic_required_courses',
      'student_academic_progression',
      'academic_progression_history',
    ];
    const existing = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [required]
    );
    const found = new Set(existing.rows.map((r) => r.table_name));
    const missing = required.filter((t) => !found.has(t));
    if (missing.length) {
      fail('Migration 006 not applied — missing tables: ' + missing.join(', ') +
           '\n       Run scripts/apply-006.cjs first.');
    }

    // Read state.
    const stateR = await client.query(
      'SELECT state FROM ecasti_application_state WHERE singleton_id = 1'
    );
    if (!stateR.rowCount) fail('ecasti_application_state row 1 not found.');
    const state = stateR.rows[0].state;

    const students = Array.isArray(state.students) ? state.students : [];
    const courses = Array.isArray(state.courses) ? state.courses : [];
    const programmes = Array.isArray(state.programmes) ? state.programmes : [];
    const currentSession =
      state.settings && typeof state.settings.currentSession === 'string'
        ? state.settings.currentSession
        : '2025/2026';

    const programmesById = new Map(programmes.map((p) => [p.id, p]));

    // Group students by (programmeId, sessionAdmitted).
    const cohorts = new Map();
    for (const s of students) {
      if (!s.programmeId || !s.sessionAdmitted) continue;
      const key = `${s.programmeId}||${s.sessionAdmitted}`;
      if (!cohorts.has(key)) {
        cohorts.set(key, {
          programmeId: s.programmeId,
          cohortSession: s.sessionAdmitted,
          students: [],
        });
      }
      cohorts.get(key).students.push(s);
    }

    // Courses belonging to a programme: match by departmentId, compulsory, ND I/II.
    function matchedCourses(programmeId) {
      const programme = programmesById.get(programmeId);
      if (!programme) return [];
      return courses.filter(
        (c) =>
          c.departmentId === programme.departmentId &&
          c.isCompulsory === true &&
          (c.level === 'ND I' || c.level === 'ND II')
      );
    }

    // Build the plan.
    const plan = [];
    for (const cohort of cohorts.values()) {
      const programme = programmesById.get(cohort.programmeId);
      if (!programme) continue;
      const mc = matchedCourses(cohort.programmeId);
      if (mc.length === 0) {
        console.warn(
          `[skip] programme ${cohort.programmeId} cohort ${cohort.cohortSession}: no compulsory ND courses in department ${programme.departmentId}`
        );
        continue;
      }
      plan.push({
        programmeId: cohort.programmeId,
        cohortSession: cohort.cohortSession,
        students: cohort.students,
        courses: mc,
      });
    }

    // Report plan.
    console.log('\n=== PLAN ===');
    let totalMappingCourses = 0;
    let totalRequiredCourses = 0;
    for (const p of plan) {
      console.log(
        `- ${p.programmeId} cohort ${p.cohortSession}: ` +
        `${p.courses.length} mapping course(s), ${p.students.length} student(s)`
      );
      for (const c of p.courses) {
        console.log(`    · ${c.code} (${c.level}) — ${c.id}`);
      }
      for (const s of p.students) {
        console.log(`    · student ${short(s.id)} (${s.matricNumber})`);
      }
      totalMappingCourses += p.courses.length;
      totalRequiredCourses += p.courses.length * p.students.length;
    }
    const totalStudents = plan.reduce((a, p) => a + p.students.length, 0);
    console.log(`\nTotals: ${plan.length} mapping(s), ${totalMappingCourses} mapping course row(s), ` +
                `${totalStudents} student(s), ${totalRequiredCourses} required-course row(s)`);

    if (!apply) {
      console.log('\n=== DRY-RUN ===');
      console.log('No writes performed. Re-run with --apply to commit.');
      return;
    }

    console.log('\n=== APPLYING ===');

    for (const p of plan) {
      const programme = programmesById.get(p.programmeId);
      const mappingId = `map-${programme.code}-${p.cohortSession.replace(/\//g, '-')}`;
      console.log(`\nProcessing ${p.programmeId} cohort ${p.cohortSession} (mapping ${mappingId})`);

      await client.query('BEGIN');
      try {
        // 1. Insert DRAFT mapping.
        await client.query(
          `INSERT INTO academic_curriculum_mappings
             (id, programme_id, cohort_session, version, status, prepared_by, is_current)
           VALUES ($1, $2, $3, 1, 'DRAFT', $4, FALSE)
           ON CONFLICT (id) DO NOTHING`,
          [mappingId, p.programmeId, p.cohortSession, PREPARED_BY]
        );

        // 2. Insert mapping courses (one per compulsory ND course).
        for (const c of p.courses) {
          const mcId = `mc-${mappingId}-${c.id}`;
          await client.query(
            `INSERT INTO academic_curriculum_mapping_courses
               (id, mapping_id, course_id,
                course_code_snapshot, course_title_snapshot,
                course_level_snapshot, semester_snapshot,
                credit_units_snapshot, is_compulsory_snapshot)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
             ON CONFLICT (id) DO NOTHING`,
            [
              mcId, mappingId, c.id,
              c.code, c.title, c.level, c.semester, c.creditUnits,
            ]
          );
        }

        // 3. Update mapping -> SUBMITTED (set submitted_at). Must happen
        //    before the review insert, per validate_academic_curriculum_mapping_review.
        await client.query(
          `UPDATE academic_curriculum_mappings
              SET status = 'SUBMITTED', submitted_at = NOW()
            WHERE id = $1 AND status = 'DRAFT'`,
          [mappingId]
        );

        // 4. Insert SUBMITTED review (mapping is now in SUBMITTED state).
        await client.query(
          `INSERT INTO academic_curriculum_mapping_reviews
             (id, mapping_id, action, actor_user_id, reason)
           VALUES ($1, $2, 'SUBMITTED', $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [`rev-sub-${mappingId}`, mappingId, PREPARED_BY, 'Initial curriculum submission']
        );

        // 5. Update mapping -> APPROVED + is_current. Must happen before the
        //    APPROVED review insert.
        await client.query(
          `UPDATE academic_curriculum_mappings
              SET status = 'APPROVED',
                  approved_by = $2,
                  approved_at = NOW(),
                  is_current = TRUE
            WHERE id = $1 AND status = 'SUBMITTED'`,
          [mappingId, APPROVED_BY]
        );

        // 6. Insert APPROVED review (mapping is now in APPROVED state).
        await client.query(
          `INSERT INTO academic_curriculum_mapping_reviews
             (id, mapping_id, action, actor_user_id, reason)
           VALUES ($1, $2, 'APPROVED', $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [`rev-app-${mappingId}`, mappingId, APPROVED_BY, 'Registrar approval']
        );

        // 7. Per student: assignment, ledger, progression, history, required courses.
        for (const s of p.students) {
          const assignmentId = `sa-${s.id}-${mappingId}`;
          await client.query(
            `INSERT INTO student_academic_curriculum_assignments
               (id, student_id, programme_id, cohort_session, mapping_id, is_current, assigned_by)
             VALUES ($1, $2, $3, $4, $5, TRUE, $6)
             ON CONFLICT (id) DO NOTHING`,
            [assignmentId, s.id, p.programmeId, p.cohortSession, mappingId, ASSIGNED_BY]
          );

          const ledgerId = `led-${s.id}-${p.cohortSession.replace(/\//g, '-')}`;
          await client.query(
            `INSERT INTO academic_curriculum_assignment_ledger
               (id, student_id, programme_id, cohort_session, idempotency_key,
                status, mapping_id, attempt_count, assigned_at)
             VALUES ($1, $2, $3, $4, $5, 'ASSIGNED', $6, 1, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [ledgerId, s.id, p.programmeId, p.cohortSession, `seed:${s.id}`, mappingId]
          );

          const progressionId = `prog-${s.id}`;
          await client.query(
            `INSERT INTO student_academic_progression
               (id, student_id, programme_id, current_stage, progression_status,
                current_session, extension_year)
             VALUES ($1, $2, $3, 'ND_I', 'ACTIVE', $4, 0)
             ON CONFLICT (id) DO NOTHING`,
            [progressionId, s.id, p.programmeId, currentSession]
          );

          const historyId = `hist-${s.id}-initial`;
          await client.query(
            `INSERT INTO academic_progression_history
               (id, student_id, programme_id, from_stage, to_stage, from_status, to_status,
                academic_session, extension_year, decision_type,
                outstanding_course_ids, missing_result_course_ids,
                reason, decided_by, idempotency_key)
             VALUES ($1, $2, $3, NULL, 'ND_I', NULL, 'ACTIVE',
                     $4, 0, 'INITIAL_RECORD',
                     '[]'::jsonb, '[]'::jsonb,
                     'Initial seed record', $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [
              historyId, s.id, p.programmeId, currentSession, PREPARED_BY,
              `seed-initial:${s.id}`,
            ]
          );

          for (const c of p.courses) {
            const mcId = `mc-${mappingId}-${c.id}`;
            const srcId = `src-${s.id}-${c.id}`;
            await client.query(
              `INSERT INTO student_academic_required_courses
                 (id, student_id, programme_id, cohort_session,
                  course_id, course_code_snapshot, course_title_snapshot,
                  course_level_snapshot, semester_snapshot,
                  credit_units_snapshot, is_required, mapping_course_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11)
               ON CONFLICT (id) DO NOTHING`,
              [
                srcId, s.id, p.programmeId, p.cohortSession,
                c.id, c.code, c.title, c.level, c.semester, c.creditUnits,
                mcId,
              ]
            );
          }
        }

        await client.query('COMMIT');
        console.log(`  committed`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`  ROLLBACK for ${p.programmeId}/${p.cohortSession}:`, e.message);
        throw e;
      }
    }

    const counts = await client.query(`
      SELECT 'academic_curriculum_mappings' AS t, COUNT(*)::int AS n FROM academic_curriculum_mappings
      UNION ALL SELECT 'academic_curriculum_mapping_courses', COUNT(*)::int FROM academic_curriculum_mapping_courses
      UNION ALL SELECT 'academic_curriculum_mapping_reviews', COUNT(*)::int FROM academic_curriculum_mapping_reviews
      UNION ALL SELECT 'student_academic_curriculum_assignments', COUNT(*)::int FROM student_academic_curriculum_assignments
      UNION ALL SELECT 'academic_curriculum_assignment_ledger', COUNT(*)::int FROM academic_curriculum_assignment_ledger
      UNION ALL SELECT 'student_academic_progression', COUNT(*)::int FROM student_academic_progression
      UNION ALL SELECT 'academic_progression_history', COUNT(*)::int FROM academic_progression_history
      UNION ALL SELECT 'student_academic_required_courses', COUNT(*)::int FROM student_academic_required_courses
    `);
    console.log('\n=== FINAL COUNTS ===');
    for (const row of counts.rows) {
      console.log(`  ${row.t.padEnd(48)} ${row.n}`);
    }
    console.log('\nStatus: SEED_COMPLETE');
  } catch (e) {
    fail(e.message);
  } finally {
    await client.end();
  }
}
main();