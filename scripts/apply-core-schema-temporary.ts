import 'dotenv/config.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Client } from 'pg';

const EXPECTED_TEMPORARY_HOST = 'ep-blue-mud-bdm6m3i0-pooler.c-8.us-east-2.aws.neon.tech';
const EXPECTED_DATABASE = '/neondb';
const databaseUrl = process.env.DATABASE_URL;

assert(databaseUrl, 'DATABASE_URL is missing. Configure the temporary Neon branch in local .env.');
const parsed = new URL(databaseUrl);
assert(
  parsed.hostname === EXPECTED_TEMPORARY_HOST && parsed.pathname === EXPECTED_DATABASE,
  'STOP: DATABASE_URL does not match the specifically approved temporary Neon branch. No database query or write was attempted.',
);

const expectedTables = [
  'schools',
  'users',
  'departments',
  'programmes',
  'courses',
  'admission_applications',
  'students',
  'legacy_invoices',
  'legacy_payment_transactions',
];

const expectedConstraints = [
  'fk_departments_school',
  'fk_programmes_department',
  'fk_courses_department',
  'fk_courses_programme',
  'fk_applications_user',
  'fk_applications_programme',
  'fk_applications_reviewer',
  'fk_students_user',
  'fk_students_programme',
  'fk_students_department',
  'fk_students_school',
  'fk_users_department',
  'fk_users_school',
  'fk_schools_dean',
  'fk_departments_hod',
  'fk_courses_lecturer',
  'fk_legacy_invoice_student',
  'fk_legacy_payment_invoice_student',
];

const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
const confirmation = createInterface({ input: stdin, output: stdout });

try {
  await client.connect();

  const identity = await client.query(
    'SELECT current_database() AS database_name, current_schema() AS schema_name, current_user AS role_name',
  );
  assert.equal(identity.rows[0]?.database_name, 'neondb', 'Unexpected database name.');
  assert.equal(identity.rows[0]?.schema_name, 'public', 'Unexpected current schema.');

  const existing = await client.query(
    'SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1 AND tablename = ANY($2::text[])',
    ['public', expectedTables],
  );
  assert.equal(
    existing.rowCount,
    0,
    'STOP: one or more migration 010 tables already exist. This script will not attempt a re-run or partial repair.',
  );

  const answer = await confirmation.question(
    'Verified temporary Neon target. This will create the empty migration 010 schema only; it will not import JSON data. Type TEMPORARY to continue: ',
  );
  assert.equal(answer.trim(), 'TEMPORARY', 'Confirmation not provided. No schema changes were made.');

  const migration = await readFile(
    resolve(process.cwd(), 'database/migrations/010_core_entities_and_legacy_finance.sql'),
    'utf8',
  );

  try {
    await client.query(migration);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }

  const tables = await client.query(
    'SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1 AND tablename = ANY($2::text[]) ORDER BY tablename',
    ['public', expectedTables],
  );
  assert.deepEqual(
    tables.rows.map((row) => row.tablename),
    [...expectedTables].sort(),
    'Migration ran, but the expected public tables were not all found.',
  );

  const constraints = await client.query(
    'SELECT conname FROM pg_catalog.pg_constraint WHERE connamespace = current_schema()::regnamespace AND conname = ANY($1::text[]) ORDER BY conname',
    [expectedConstraints],
  );
  assert.deepEqual(
    constraints.rows.map((row) => row.conname),
    [...expectedConstraints].sort(),
    'Migration ran, but one or more expected named constraints were not found.',
  );

  console.log('[PASS] Migration 010 created all 9 expected empty tables.');
  console.log(`[PASS] Found all ${expectedConstraints.length} expected named constraints.`);
  console.log('[INFO] No application records were imported or inspected.');
} finally {
  confirmation.close();
  await client.end().catch(() => undefined);
}
