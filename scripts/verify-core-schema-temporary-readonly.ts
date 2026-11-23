import 'dotenv/config.js';
import assert from 'node:assert/strict';
import { Client } from 'pg';

// Read-only catalog verification for migration 010. Never selects application rows.
const EXPECTED_HOST = 'ep-blue-mud-bdm6m3i0-pooler.c-8.us-east-2.aws.neon.tech';
const EXPECTED_DATABASE = '/neondb';
const databaseUrl = process.env.DATABASE_URL;
assert(databaseUrl, 'DATABASE_URL is missing.');
const parsed = new URL(databaseUrl);
assert(
  parsed.hostname === EXPECTED_HOST && parsed.pathname === EXPECTED_DATABASE,
  'STOP: DATABASE_URL is not the approved temporary Neon target. No connection attempted.',
);

const expectedTables = [
  'schools', 'users', 'departments', 'programmes', 'courses',
  'admission_applications', 'students', 'legacy_invoices',
  'legacy_payment_transactions',
];
const expectedConstraints = [
  'fk_departments_school', 'fk_programmes_department', 'fk_courses_department',
  'fk_courses_programme', 'fk_applications_user', 'fk_applications_programme',
  'fk_applications_reviewer', 'fk_students_user', 'fk_students_programme',
  'fk_students_department', 'fk_students_school', 'fk_users_department',
  'fk_users_school', 'fk_schools_dean', 'fk_departments_hod',
  'fk_courses_lecturer', 'fk_legacy_invoice_student',
  'fk_legacy_payment_invoice_student',
];
const expectedIndexes = [
  'idx_users_email', 'idx_departments_school', 'idx_programmes_department',
  'idx_courses_department', 'idx_courses_programme', 'idx_applications_user',
  'idx_applications_programme', 'idx_students_user', 'idx_students_programme',
  'idx_students_department', 'idx_students_school', 'idx_legacy_invoices_student',
  'idx_legacy_payments_invoice_student', 'idx_legacy_payments_student',
];

const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const identity = await client.query(
    'SELECT current_database() AS database_name, current_schema() AS schema_name',
  );
  assert.equal(identity.rows[0]?.database_name, 'neondb', 'Unexpected database.');
  assert.equal(identity.rows[0]?.schema_name, 'public', 'Unexpected schema.');

  const tables = await client.query(
    'SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1 AND tablename = ANY($2::text[]) ORDER BY tablename',
    ['public', expectedTables],
  );
  assert.deepEqual(tables.rows.map((row) => row.tablename), [...expectedTables].sort(),
    'Migration 010 table inventory does not match expected schema.');

  const constraints = await client.query(
    'SELECT conname FROM pg_catalog.pg_constraint WHERE connamespace = current_schema()::regnamespace AND conname = ANY($1::text[]) ORDER BY conname',
    [expectedConstraints],
  );
  assert.deepEqual(constraints.rows.map((row) => row.conname), [...expectedConstraints].sort(),
    'Migration 010 named constraint inventory does not match.');

  const indexes = await client.query(
    'SELECT indexname FROM pg_catalog.pg_indexes WHERE schemaname = $1 AND indexname = ANY($2::text[]) ORDER BY indexname',
    ['public', expectedIndexes],
  );
  assert.deepEqual(indexes.rows.map((row) => row.indexname), [...expectedIndexes].sort(),
    'Migration 010 index inventory does not match.');

  const columns = await client.query(
    'SELECT table_name, count(*)::int AS column_count FROM information_schema.columns WHERE table_schema = $1 AND table_name = ANY($2::text[]) GROUP BY table_name ORDER BY table_name',
    ['public', expectedTables],
  );
  assert.equal(columns.rowCount, expectedTables.length, 'One or more tables have no visible columns.');

  console.log('[PASS] Temporary Neon database/schema identity verified.');
  console.log('[PASS] All 9 migration 010 tables are present.');
  console.log('[PASS] All 18 expected named constraints are present.');
  console.log('[PASS] All 14 expected indexes are present.');
  console.log('[PASS] Column metadata is present for all 9 tables.');
  console.log('[INFO] Verification used PostgreSQL catalog metadata only; no application rows were read or changed.');
} finally {
  await client.end().catch(() => undefined);
}
