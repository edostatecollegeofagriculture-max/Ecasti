const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const originalPath = path.resolve(
  "database/migrations/010_core_entities_and_legacy_finance.sql"
);
const draftPath = path.resolve(
  "database/migrations/010_core_entities_and_legacy_finance_RERUN_SAFE_REVIEW.sql"
);

const original = fs.readFileSync(originalPath, "utf8");
const draft = fs.readFileSync(draftPath, "utf8");

const header = `-- EDOCASTI MIGRATION 010 RERUN-SAFETY REVIEW DRAFT
-- NOT APPROVED FOR EXECUTION.
-- Generated from the original migration.
-- Original file is preserved.
-- Existing same-name constraints are checked for matching definitions.
-- Review and disposable-database testing are still required.

`;

if (!draft.startsWith(header)) {
  throw new Error("Review draft header does not match the expected version.");
}

const body = draft.slice(header.length);

const requiredTables = [
  "schools", "users", "departments", "programmes", "courses",
  "admission_applications", "students", "legacy_invoices",
  "legacy_payment_transactions"
];

const expectedForeignKeys = [
  ["users", "fk_users_department", "departments", "department_id"],
  ["users", "fk_users_school", "schools", "school_id"],
  ["schools", "fk_schools_dean", "users", "dean_user_id"],
  ["departments", "fk_departments_hod", "users", "hod_user_id"],
  ["courses", "fk_courses_lecturer", "users", "lecturer_user_id"]
];

const count = (text, regex) => [...text.matchAll(regex)].length;
const sha256 = text =>
  crypto.createHash("sha256").update(text).digest("hex");

const findings = [];

for (const table of requiredTables) {
  const pattern = new RegExp(
    `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, "i"
  );
  if (!pattern.test(body)) findings.push(`Missing table declaration: ${table}`);
}

for (const [table, name, reference, column] of expectedForeignKeys) {
  const blockStart = body.indexOf(`DO $migration$`);
  const occurrences = count(
    body,
    new RegExp(`ADD CONSTRAINT ${name}`, "g")
  );

  if (occurrences !== 1) {
    findings.push(`Expected exactly one guarded ADD CONSTRAINT for ${name}.`);
  }

  if (!body.includes(`'public.${table}'::regclass`)) {
    findings.push(`Missing target-table identity check for ${name}.`);
  }

  if (!body.includes(`FOREIGN KEY (${column})`)) {
    findings.push(`Missing local column declaration for ${name}.`);
  }

  if (!body.includes(`REFERENCES public.${reference}(id)`)) {
    findings.push(`Missing referenced table/column for ${name}.`);
  }

  if (!body.includes(`'${name}'`)) {
    findings.push(`Missing constraint-name lookup for ${name}.`);
  }
}

const tableCount = count(
  body, /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gim
);
const indexCount = count(
  body, /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b/gim
);
const guardedBlockCount = count(body, /DO \$migration\$/g);

if (tableCount !== 9) findings.push(`Expected 9 tables; found ${tableCount}.`);
if (indexCount !== 14) findings.push(`Expected 14 indexes; found ${indexCount}.`);
if (guardedBlockCount !== 5) {
  findings.push(`Expected 5 guarded blocks; found ${guardedBlockCount}.`);
}

if (!/^\s*BEGIN\s*;/im.test(body)) {
  findings.push("BEGIN transaction marker missing.");
}
if (!/^\s*COMMIT\s*;/im.test(body)) {
  findings.push("COMMIT transaction marker missing.");
}

const destructivePatterns = [
  /^\s*DROP\s+TABLE\b/gim,
  /^\s*DROP\s+COLUMN\b/gim,
  /^\s*TRUNCATE\b/gim,
  /^\s*DELETE\s+FROM\b/gim
];

const destructiveMatches = destructivePatterns.flatMap(pattern =>
  [...body.matchAll(pattern)].map(match => match[0].trim())
);

if (destructiveMatches.length) {
  findings.push("Potentially destructive SQL patterns detected.");
}

const report = {
  mode: "LOCAL_STATIC_SQL_REVIEW",
  originalSha256: sha256(original),
  draftSha256: sha256(draft),
  originalUnchanged: true,
  tableDeclarations: tableCount,
  indexDeclarations: indexCount,
  guardedForeignKeyBlocks: guardedBlockCount,
  expectedForeignKeys: expectedForeignKeys.map(item => item[1]),
  transactionBeginPresent: /^\s*BEGIN\s*;/im.test(body),
  transactionCommitPresent: /^\s*COMMIT\s*;/im.test(body),
  detectedDestructiveStatements: destructiveMatches,
  findings,
  status: findings.length ? "REVIEW_REQUIRED" : "STATIC_REVIEW_PASS",
  databaseConnected: false,
  sqlExecuted: false
};

const reportPath = path.resolve(
  "EDOCASTI_Migration_010_Static_SQL_Review.json"
);

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

const plan = `# EDOCASTI Migration 010 — Disposable Database Test Plan

## Current status

This is a test plan only. No database was created or changed.

Original migration SHA-256:
\`${report.originalSha256}\`

Review draft SHA-256:
\`${report.draftSha256}\`

Static review status: **${report.status}**

## Safety boundary

- Do not run this test against \`ecasti_local\`.
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

Do not apply the review draft to \`ecasti_local\` until all disposable tests pass, the schema inventory is reviewed, and the user explicitly approves the local schema application.
`;

const planPath = path.resolve(
  "EDOCASTI_Migration_010_Disposable_Test_Plan.md"
);

fs.writeFileSync(planPath, plan, "utf8");

console.log(JSON.stringify({
  report: path.basename(reportPath),
  testPlan: path.basename(planPath),
  staticReviewStatus: report.status,
  findings: findings,
  databaseConnected: false,
  databaseCreated: false,
  sqlExecuted: false
}, null, 2));
