import 'dotenv/config';
import { Pool } from 'pg';
import { createInterface } from 'node:readline/promises';
import process, { stdin, stdout } from 'node:process';

const EXPECTED_TABLES = [
  'academic_curriculum_mappings',
  'academic_curriculum_mapping_courses',
  'academic_curriculum_mapping_reviews',
  'student_academic_curriculum_assignments',
  'academic_curriculum_assignment_ledger',
  'academic_student_curriculum_exceptions',
  'academic_student_curriculum_exception_reviews',
  'student_academic_required_courses',
  'student_academic_progression',
  'academic_progression_history',
  'academic_management_pass_approvals',
] as const;

const EXPECTED_INDEXES = [
  'uq_approved_curriculum_mapping',
  'idx_curriculum_mapping_lookup',
  'idx_mapping_courses_mapping',
  'idx_curriculum_reviews_mapping',
  'uq_current_curriculum_assignment',
  'idx_curriculum_assignment_mapping',
  'idx_curriculum_assignment_ledger_retry',
  'idx_curriculum_assignment_ledger_cohort',
  'idx_student_curriculum_exceptions',
  'uq_active_student_curriculum_exception_course',
  'idx_exception_reviews',
  'idx_student_required_courses_student',
  'idx_student_required_courses_cohort',
  'idx_academic_progression_status',
  'idx_academic_progression_programme',
  'idx_progression_history_student',
  'idx_progression_history_session',
  'uq_progression_initial_record_per_student',
] as const;

const EXPECTED_TRIGGERS = [
  'trg_validate_academic_curriculum_mapping_review',
  'trg_require_academic_curriculum_mapping_review',
  'trg_validate_academic_student_exception_review',
  'trg_require_academic_student_exception_review',
  'trg_curriculum_reviews_no_update_delete',
  'trg_curriculum_reviews_no_truncate',
  'trg_exception_reviews_no_update_delete',
  'trg_exception_reviews_no_truncate',
  'trg_progression_history_no_update_delete',
  'trg_progression_history_no_truncate',
  'trg_management_pass_no_update_delete',
  'trg_management_pass_no_truncate',
  'trg_protect_curriculum_mapping',
  'trg_validate_student_curriculum_assignment',
  'trg_protect_curriculum_mapping_courses',
  'trg_student_exception_no_delete',
  'trg_protect_student_required_course',
  'trg_protect_current_curriculum_mapping',
  'trg_protect_student_curriculum_assignment',
  'trg_protect_student_curriculum_exception',
  'trg_validate_student_required_course_integrity',
  'trg_student_exceptions_no_truncate',
  'trg_student_progression_no_delete',
  'trg_student_progression_no_truncate',
  'trg_management_pass_approvals_no_truncate',
  'trg_validate_management_pass_approval',
  'trg_protect_academic_curriculum_assignment_ledger',
  'trg_curriculum_assignment_ledger_no_truncate',
  'trg_protect_academic_curriculum_mapping_delete',
  'trg_curriculum_mappings_no_truncate',
  'trg_mapping_courses_no_truncate',
  'trg_student_assignments_no_truncate',
  'trg_student_required_courses_no_truncate',
  'trg_student_progression_history_no_truncate',
  'trg_protect_student_academic_progression_update',
  'trg_require_academic_progression_history',
  'trg_validate_academic_progression_history_target',
  'trg_require_initial_academic_progression_history',
] as const;

const EXPECTED_FUNCTIONS = [
  'validate_academic_curriculum_mapping_review',
  'require_academic_curriculum_mapping_review',
  'validate_academic_student_exception_review',
  'require_academic_student_exception_review',
  'prevent_academic_append_only_changes',
  'protect_academic_curriculum_mapping',
  'validate_student_curriculum_assignment',
  'protect_academic_curriculum_mapping_courses',
  'protect_student_required_course',
  'protect_current_curriculum_mapping',
  'protect_student_curriculum_assignment',
  'protect_student_curriculum_exception',
  'validate_student_required_course_integrity',
  'validate_management_pass_approval',
  'protect_academic_curriculum_assignment_ledger',
  'protect_academic_curriculum_mapping_delete',
  'protect_student_academic_progression_update',
  'require_academic_progression_history',
  'validate_academic_progression_history_target',
  'require_initial_academic_progression_history',
] as const;

const DEFERRED_TRIGGERS = [
  'trg_require_academic_curriculum_mapping_review',
  'trg_require_academic_student_exception_review',
  'trg_require_academic_progression_history',
  'trg_validate_academic_progression_history_target',
  'trg_require_initial_academic_progression_history',
] as const;

type Severity = 'PASS' | 'FAIL' | 'WARN';
type Finding = { severity: Severity; area: string; detail: string };

const findings: Finding[] = [];

function add(severity: Severity, area: string, detail: string): void {
  findings.push({ severity, area, detail });
  const symbol = severity === 'PASS' ? '✓' : severity === 'FAIL' ? '✗' : '!';
  console.log(`[${symbol} ${severity}] ${area}: ${detail}`);
}

function missing(expected: readonly string[], actual: Set<string>): string[] {
  return expected.filter((name) => !actual.has(name));
}

function normalizeSql(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing. Check your local .env configuration.');
  }

  const parsedUrl = new URL(connectionString);
  const host = parsedUrl.hostname;
  const databaseFromUrl = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));

  console.log('\nEDOCASTI — Migration 006 read-only audit');
  console.log('No application records will be read or changed.');
  console.log(`Connection host: ${host}`);
  console.log(`Database name: ${databaseFromUrl || '(not specified)'}`);
  console.log('\nThis audit must target your temporary Neon test branch, not production.');

  const readline = createInterface({ input: stdin, output: stdout });
  let confirmation = '';
  try {
    confirmation = (await readline.question('Type TEMPORARY to continue: ')).trim();
  } finally {
    readline.close();
  }

  if (confirmation !== 'TEMPORARY') {
    console.log('Audit cancelled. No database connection was opened.');
    return;
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    application_name: 'edocasti-migration006-readonly-audit',
  });

  try {
    const identity = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        current_setting('server_version') AS server_version,
        inet_server_addr()::text AS server_address
    `);

    const db = identity.rows[0];
    console.log('\nConnected database identity');
    console.log(`Database: ${db.database_name}`);
    console.log(`Database user: ${db.database_user}`);
    console.log(`PostgreSQL: ${db.server_version}`);
    console.log(`Server address: ${db.server_address ?? 'not exposed by provider'}`);

    const tableResult = await pool.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name = ANY($1::text[])
      `,
      [EXPECTED_TABLES],
    );
    const actualTables = new Set(tableResult.rows.map((row) => row.table_name));
    const missingTables = missing(EXPECTED_TABLES, actualTables);
    add(
      missingTables.length === 0 ? 'PASS' : 'FAIL',
      'Tables',
      missingTables.length === 0
        ? `All ${EXPECTED_TABLES.length} expected migration tables exist.`
        : `Missing tables: ${missingTables.join(', ')}`,
    );

    const constraintResult = await pool.query(`
      SELECT
        con.conname AS constraint_name,
        cls.relname AS table_name,
        con.contype AS constraint_type,
        con.convalidated AS is_validated,
        con.condeferrable AS is_deferrable,
        con.condeferred AS initially_deferred
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      WHERE ns.nspname = 'public'
        AND cls.relname = ANY($1::text[])
      ORDER BY cls.relname, con.conname
    `, [EXPECTED_TABLES]);

    const unvalidated = constraintResult.rows.filter((row) => !row.is_validated);
    add(
      unvalidated.length === 0 ? 'PASS' : 'FAIL',
      'Constraints',
      unvalidated.length === 0
        ? `${constraintResult.rowCount ?? 0} constraints found; all are validated.`
        : `Unvalidated constraints: ${unvalidated.map((row) => `${row.table_name}.${row.constraint_name}`).join(', ')}`,
    );

    const indexResult = await pool.query(`
      SELECT indexname AS index_name, indexdef AS index_definition
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
    `, [EXPECTED_INDEXES]);
    const indexNames = new Set(indexResult.rows.map((row) => row.index_name));
    const missingIndexes = missing(EXPECTED_INDEXES, indexNames);
    add(
      missingIndexes.length === 0 ? 'PASS' : 'FAIL',
      'Indexes',
      missingIndexes.length === 0
        ? `All ${EXPECTED_INDEXES.length} expected indexes exist.`
        : `Missing indexes: ${missingIndexes.join(', ')}`,
    );

    const currentMappingIndex = indexResult.rows.find(
      (row) => row.index_name === 'uq_approved_curriculum_mapping',
    );
    if (currentMappingIndex) {
      const definition = normalizeSql(currentMappingIndex.index_definition);
      const valid =
        definition.includes('unique') &&
        definition.includes('(programme_id, cohort_session)') &&
        definition.includes('where (is_current = true)');
      add(
        valid ? 'PASS' : 'FAIL',
        'Current mapping uniqueness',
        valid
          ? 'The unique partial index is scoped to programme/cohort rows marked current.'
          : `Unexpected index definition: ${currentMappingIndex.index_definition}`,
      );
    } else {
      add('FAIL', 'Current mapping uniqueness', 'Required partial unique index is missing.');
    }

    const triggerResult = await pool.query(`
      SELECT
        trig.tgname AS trigger_name,
        cls.relname AS table_name,
        trig.tgenabled AS enabled_state,
        trig.tgdeferrable AS is_deferrable,
        trig.tginitdeferred AS initially_deferred,
        pg_get_triggerdef(trig.oid) AS trigger_definition
      FROM pg_trigger trig
      JOIN pg_class cls ON cls.oid = trig.tgrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      WHERE ns.nspname = 'public'
        AND NOT trig.tgisinternal
        AND cls.relname = ANY($1::text[])
    `, [EXPECTED_TABLES]);

    const actualTriggers = new Set(triggerResult.rows.map((row) => row.trigger_name));
    const missingTriggers = missing(EXPECTED_TRIGGERS, actualTriggers);
    add(
      missingTriggers.length === 0 ? 'PASS' : 'FAIL',
      'Triggers',
      missingTriggers.length === 0
        ? `All ${EXPECTED_TRIGGERS.length} expected triggers exist.`
        : `Missing triggers: ${missingTriggers.join(', ')}`,
    );

    const disabledTriggers = triggerResult.rows.filter((row) => row.enabled_state === 'D');
    add(
      disabledTriggers.length === 0 ? 'PASS' : 'FAIL',
      'Trigger enablement',
      disabledTriggers.length === 0
        ? 'No expected-table triggers are disabled.'
        : `Disabled triggers: ${disabledTriggers.map((row) => row.trigger_name).join(', ')}`,
    );

    const deferredProblems = DEFERRED_TRIGGERS.filter((name) => {
      const trigger = triggerResult.rows.find((row) => row.trigger_name === name);
      return !trigger || !trigger.is_deferrable || !trigger.initially_deferred;
    });
    add(
      deferredProblems.length === 0 ? 'PASS' : 'FAIL',
      'Deferred workflow triggers',
      deferredProblems.length === 0
        ? 'All five mandatory review/history triggers are DEFERRABLE INITIALLY DEFERRED.'
        : `Incorrect or missing deferred triggers: ${deferredProblems.join(', ')}`,
    );

    const functionResult = await pool.query(`
      SELECT
        proc.proname AS function_name,
        pg_get_functiondef(proc.oid) AS definition
      FROM pg_proc proc
      JOIN pg_namespace ns ON ns.oid = proc.pronamespace
      WHERE ns.nspname = 'public'
        AND proc.proname = ANY($1::text[])
    `, [EXPECTED_FUNCTIONS]);

    const functionsByName = new Map(
      functionResult.rows.map((row) => [row.function_name, normalizeSql(row.definition)]),
    );
    const missingFunctions = missing(EXPECTED_FUNCTIONS, new Set(functionsByName.keys()));
    add(
      missingFunctions.length === 0 ? 'PASS' : 'FAIL',
      'Functions',
      missingFunctions.length === 0
        ? `All ${EXPECTED_FUNCTIONS.length} expected trigger functions exist.`
        : `Missing functions: ${missingFunctions.join(', ')}`,
    );

    const functionAssertions: Array<{ name: string; required: string[]; label: string }> = [
      {
        name: 'validate_academic_progression_history_target',
        required: ['history_sequence < new.history_sequence', 'initial_record'],
        label: 'Progression history predecessor ordering and initial-entry rules',
      },
      {
        name: 'require_academic_progression_history',
        required: ['matching history record in the same transaction', 'management_approved_pass'],
        label: 'Progression updates require matching history',
      },
      {
        name: 'require_initial_academic_progression_history',
        required: ['initial_record history entry', 'new.student_id'],
        label: 'New progression rows require initial history',
      },
      {
        name: 'protect_student_curriculum_exception',
        required: ['submitted exception details are immutable', 'new.reviewed_by = old.submitted_by'],
        label: 'Exception review locks submitted details and requires independent reviewer',
      },
      {
        name: 'require_academic_student_exception_review',
        required: ['matching review event in the same transaction', 'r.actor_user_id = new.reviewed_by'],
        label: 'Exception decisions require matching review events',
      },
      {
        name: 'validate_academic_student_exception_review',
        required: ['exception_status is distinct from new.action', 'exception_reviewed_by is distinct from new.actor_user_id'],
        label: 'Exception review events match parent state and reviewer',
      },
      {
        name: 'validate_academic_curriculum_mapping_review',
        required: ['submitted review event must match', 'approved review event must match'],
        label: 'Mapping review events match parent state',
      },
      {
        name: 'protect_academic_curriculum_mapping',
        required: ['invalid curriculum mapping status transition', 'new.approved_by = new.prepared_by', 'a rejection reason is required'],
        label: 'Mapping lifecycle, reviewer separation and rejection reason',
      },
      {
        name: 'prevent_academic_append_only_changes',
        required: ['is append-only'],
        label: 'Append-only protection function',
      },
      {
        name: 'validate_management_pass_approval',
        required: ['extension_3', 'management_approved_pass', 'new.extension_year = 3'],
        label: 'Management-pass approval matches Extension Year 3 history',
      },
    ];

    for (const assertion of functionAssertions) {
      const definition = functionsByName.get(assertion.name);
      if (!definition) {
        add('FAIL', 'Function logic', `${assertion.label}: function is missing.`);
        continue;
      }
      const absent = assertion.required.filter((token) => !definition.includes(normalizeSql(token)));
      add(
        absent.length === 0 ? 'PASS' : 'FAIL',
        'Function logic',
        absent.length === 0
          ? `${assertion.label} — expected safeguards found.`
          : `${assertion.label} — expected logic not found: ${absent.join('; ')}`,
      );
    }

    add(
      'WARN',
      'Authorization boundary',
      'Database metadata cannot prove authenticated user roles. Backend authorization and API/service workflows require a separate code review.',
    );
    add(
      'WARN',
      'Runtime workflow tests',
      'This audit does not create sample records or execute write-path tests. Transactional workflows still need isolated test cases.',
    );

    const passed = findings.filter((finding) => finding.severity === 'PASS').length;
    const failed = findings.filter((finding) => finding.severity === 'FAIL').length;
    const warned = findings.filter((finding) => finding.severity === 'WARN').length;

    console.log('\n============================================================');
    console.log('MIGRATION 006 AUDIT SUMMARY');
    console.log('============================================================');
    console.log(`Database: ${db.database_name} | Host: ${host}`);
    console.log(`PASS: ${passed}   FAIL: ${failed}   WARN: ${warned}`);
    console.log(failed === 0
      ? 'Metadata checks completed without a detected failure.'
      : 'One or more metadata checks failed. Do not treat the migration as production-ready.');
    console.log('This report is not production approval.');
    console.log('============================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('\nMigration 006 audit could not complete:', message);
  process.exitCode = 1;
});
