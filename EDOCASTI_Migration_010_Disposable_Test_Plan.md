# EDOCASTI Migration 010 — Disposable Database Test Plan

## Current status

This is a test plan only. No database was created or changed.

Original migration SHA-256:
`a6b1c87a02ce191aff7cd335f441a27cea01655d754d5d32cff25a8ad2ae6077`

Review draft SHA-256:
`5c39f7e9bc082a8d5e76bed29f25d72c241c0dc2624d04861c3f37e0f0452268`

Static review status: **STATIC_REVIEW_PASS**

## Safety boundary

- Do not run this test against `ecasti_local`.
- Do not use the Render staging database or any remote database.
- Use a newly created, isolated local disposable database only.
- Do not copy production or staging credentials into test scripts.
- Preserve the original migration file.
- Do not import the application JSON data during schema testing.

## Test A — Fresh application

On a disposable local database:

1. Verify the database name and local server address.
2. Confirm the disposable database has no Migration 010 target tables.
3. Apply the review draft inside its transaction.
4. Confirm all nine target tables exist.
5. Confirm all five foreign keys exist with the expected columns and ON DELETE RESTRICT behavior.
6. Confirm the fourteen indexes exist.
7. Inspect every table's columns, data types, nullability, defaults, primary keys, unique constraints and check constraints.
8. Confirm the transaction completed successfully.

Expected: all schema objects are present and match the reviewed migration.

## Test B — Repeat application

On the same disposable database, after Test A succeeds:

1. Apply the review draft a second time.
2. Confirm no duplicate-constraint error occurs.
3. Confirm existing same-name foreign keys are accepted only when their definitions match.
4. Confirm the table and index definitions remain unchanged.
5. Compare schema inventories before and after the second application.

Expected: repeat application succeeds without changing the resulting schema.

## Test C — Mismatch protection

On a separate disposable database:

1. Create the relevant target table.
2. Add a deliberately different constraint using one of the five target names.
3. Run the matching guarded block in an isolated transaction.
4. Confirm it raises an exception.
5. Roll back the test transaction.

Expected: the mismatched constraint is not silently accepted.

## Test D — Rollback

On another disposable database:

1. Begin a transaction.
2. Apply the migration draft.
3. Before commit, deliberately trigger a controlled test error.
4. Roll back.
5. Confirm the nine target tables and associated constraints are absent.

Expected: the transaction leaves no partial schema behind.

## Test E — Referential integrity

On a disposable database with synthetic test rows only:

1. Insert valid parent and child rows.
2. Confirm valid references are accepted.
3. Confirm invalid references are rejected.
4. Confirm ON DELETE RESTRICT prevents deleting referenced parent rows.

Expected: all five foreign keys enforce their intended relationships.

## Important limitations

- A static review cannot prove PostgreSQL execution succeeds.
- CREATE TABLE IF NOT EXISTS does not validate the definition of an existing table.
- The five guarded blocks only protect the named foreign keys.
- This test plan does not approve importing student or application data.
- The missing application phone and student emergency-contact values remain unresolved.

## Approval gate

Do not apply the review draft to `ecasti_local` until all disposable tests pass, the schema inventory is reviewed, and the user explicitly approves the local schema application.
