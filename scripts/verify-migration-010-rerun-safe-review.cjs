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
const generated = fs.readFileSync(draftPath, "utf8");

const header = `-- EDOCASTI MIGRATION 010 RERUN-SAFETY REVIEW DRAFT
-- NOT APPROVED FOR EXECUTION.
-- Generated from the original migration.
-- Original file is preserved.
-- Existing same-name constraints are checked for matching definitions.
-- Review and disposable-database testing are still required.

`;

if (!generated.startsWith(header)) {
  throw new Error("Unexpected or missing review-draft header.");
}

const actualBody = generated.slice(header.length);
let expectedBody = original;

const foreignKeys = [
  ["users", "fk_users_department", "departments", "department_id"],
  ["users", "fk_users_school", "schools", "school_id"],
  ["schools", "fk_schools_dean", "users", "dean_user_id"],
  ["departments", "fk_departments_hod", "users", "hod_user_id"],
  ["courses", "fk_courses_lecturer", "users", "lecturer_user_id"]
];

for (const [table, name, reference, column] of foreignKeys) {
  const pattern = new RegExp(
    "\\bALTER\\s+TABLE\\s+(?:public\\.)?" + table +
    "\\s+ADD\\s+CONSTRAINT\\s+" + name +
    "\\s+FOREIGN\\s+KEY\\s*\\(\\s*" + column +
    "\\s*\\)\\s+REFERENCES\\s+(?:public\\.)?" + reference +
    "\\s*\\(\\s*id\\s*\\)\\s+ON\\s+DELETE\\s+RESTRICT\\s*;",
    "gi"
  );

  const matches = [...expectedBody.matchAll(pattern)];

  if (matches.length !== 1) {
    throw new Error(`Original statement check failed for ${name}.`);
  }

  const block = `DO $migration$
DECLARE
    existing_definition TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
      INTO existing_definition
      FROM pg_constraint c
     WHERE c.conname = '${name}'
       AND c.conrelid = 'public.${table}'::regclass;

    IF existing_definition IS NULL THEN
        ALTER TABLE public.${table}
            ADD CONSTRAINT ${name}
            FOREIGN KEY (${column})
            REFERENCES public.${reference}(id)
            ON DELETE RESTRICT;
    ELSIF regexp_replace(lower(existing_definition), '\\s+', '', 'g')
       <> regexp_replace(
            lower('FOREIGN KEY (${column}) REFERENCES ${reference}(id) ON DELETE RESTRICT'),
            '\\s+', '', 'g'
          ) THEN
        RAISE EXCEPTION
            'Constraint ${name} exists with a different definition.';
    ELSE
        RAISE NOTICE 'Constraint ${name} already exists and matches.';
    END IF;
END
$migration$;`;

  expectedBody = expectedBody.replace(pattern, block);
}

const bodyMatches = actualBody === expectedBody;

const count = (text, regex) => [...text.matchAll(regex)].length;

const report = {
  mode: "LOCAL_STATIC_FILE_COMPARISON",
  originalFileUnchanged: true,
  draftBodyMatchesExpectedTransform: bodyMatches,
  original: {
    sha256: crypto.createHash("sha256").update(original).digest("hex"),
    createTables: count(original, /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gim),
    createIndexes: count(original, /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b/gim),
    alterAddConstraints: count(original, /^\s*ALTER\s+TABLE\b[^;]*\bADD\s+CONSTRAINT\b/gim)
  },
  draft: {
    sha256: crypto.createHash("sha256").update(generated).digest("hex"),
    createTables: count(actualBody, /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gim),
    createIndexes: count(actualBody, /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b/gim),
    guardedForeignKeyBlocks: count(actualBody, /DO \$migration\$/g)
  },
  sqlExecuted: false,
  databaseConnected: false
};

console.log(JSON.stringify(report, null, 2));

if (!bodyMatches ||
    report.draft.createTables !== 9 ||
    report.draft.guardedForeignKeyBlocks !== 5) {
  console.error("STATIC COMPARISON: REVIEW FAILED");
  process.exitCode = 2;
} else {
  console.log("\nSTATIC COMPARISON: PASS");
}
