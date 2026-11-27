require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const sourcePath = path.resolve("data/edocasti_db.json");
const migrationPath = path.resolve(
  "database/migrations/010_core_entities_and_legacy_finance.sql"
);
const reportPath = path.resolve("EDOCASTI_Migration_010_Dry_Run_Report.json");

const tables = {
  schools: [
    "id", "code", "name", "dean_user_id", "description", "image_url"
  ],
  users: [
    "id", "email", "password_hash", "full_name", "role", "phone",
    "photo_url", "is_active", "is_locked", "failed_login_attempts",
    "department_id", "school_id", "created_at", "last_login"
  ],
  departments: [
    "id", "school_id", "code", "name", "hod_user_id"
  ],
  programmes: [
    "id", "department_id", "code", "name", "qualification",
    "duration_years", "description", "requirements"
  ],
  courses: [
    "id", "department_id", "programme_id", "code", "title",
    "credit_units", "level", "semester", "lecturer_user_id",
    "lecturer_name", "is_compulsory"
  ],
  admission_applications: [
    "id", "application_number", "user_id", "programme_id", "session",
    "first_name", "last_name", "other_names", "gender", "date_of_birth",
    "phone", "email", "photo_url", "state_of_origin", "lga",
    "residential_address", "o_level_results", "status", "screening_notes",
    "reviewer_user_id", "reviewer_display_snapshot", "submitted_at",
    "decision_at", "fee_activation_required_at"
  ],
  students: [
    "id", "matric_number", "user_id", "photo_url", "programme_id",
    "department_id", "school_id", "level", "session_admitted",
    "academic_status", "gender", "date_of_birth", "emergency_contact",
    "next_of_kin", "cgpa", "total_credits_earned"
  ],
  legacy_invoices: [
    "id", "invoice_number", "student_id", "session", "title",
    "amount", "amount_paid", "status", "due_date", "created_at"
  ],
  legacy_payment_transactions: [
    "id", "reference", "invoice_id", "student_id", "amount",
    "channel", "status", "provider_reference", "paid_at",
    "verified_by_display"
  ]
};

const sourceCollections = {
  schools: "schools",
  users: "users",
  departments: "departments",
  programmes: "programmes",
  courses: "courses",
  admission_applications: "applications",
  students: "students",
  legacy_invoices: "invoices",
  legacy_payment_transactions: "payments"
};

const requiredFields = {
  applications: [
    "phone"
  ],
  students: [
    "emergencyContact"
  ]
};

function sha256(file) {
  const crypto = require("crypto");
  return crypto.createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function isBlank(value) {
  return value === undefined || value === null ||
    (typeof value === "string" && value.trim() === "");
}

async function main() {
  const report = {
    mode: "LOCAL_READ_ONLY_DRY_RUN",
    executedAt: new Date().toISOString(),
    source: {},
    migration: {},
    database: {},
    targetSchema: {},
    sourceExceptions: [],
    safety: {
      databaseWrites: false,
      migrationExecuted: false,
      sourceModified: false,
      remoteAccessPermitted: false
    },
    status: "BLOCKED"
  };

  if (!fs.existsSync(sourcePath)) {
    throw new Error("Source JSON file not found.");
  }

  if (!fs.existsSync(migrationPath)) {
    throw new Error("Migration 010 SQL file not found.");
  }

  const sourceText = fs.readFileSync(sourcePath, "utf8");
  const source = JSON.parse(sourceText);
  const migrationText = fs.readFileSync(migrationPath, "utf8");

  report.source = {
    file: "data/edocasti_db.json",
    sha256: sha256(sourcePath),
    counts: {}
  };

  report.migration = {
    file: "database/migrations/010_core_entities_and_legacy_finance.sql",
    sha256: sha256(migrationPath),
    expectedTables: Object.keys(tables)
  };

  for (const [target, collection] of Object.entries(sourceCollections)) {
    report.source.counts[collection] =
      Array.isArray(source[collection]) ? source[collection].length : null;

    if (!Array.isArray(source[collection])) {
      report.sourceExceptions.push({
        collection,
        issue: "SOURCE_COLLECTION_MISSING_OR_NOT_ARRAY"
      });
    }
  }

  for (const [collection, fields] of Object.entries(requiredFields)) {
    for (const record of source[collection] || []) {
      for (const field of fields) {
        if (isBlank(record[field])) {
          report.sourceExceptions.push({
            collection,
            recordId: record.id,
            field,
            issue: "REQUIRED_VALUE_EMPTY"
          });
        }
      }
    }
  }

  // Confirm the migration declares the expected tables.
  const declaredTables = Object.keys(tables).filter(table => {
    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${escaped}\\b`,
      "i"
    ).test(migrationText);
  });

  report.migration.declaredTables = declaredTables;

  if (declaredTables.length !== Object.keys(tables).length) {
    report.migration.declarationMismatch = true;
  }

  // Strict local-only connection checks.
  if (process.env.RENDER_SERVICE_ID ||
      process.env.STAGING_DEMO_ONLY === "true") {
    throw new Error("Safety stop: staging environment markers detected.");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("Safety stop: DATABASE_URL is not configured.");
  }

  const dbUrl = new URL(process.env.DATABASE_URL);
  const databaseName = decodeURIComponent(dbUrl.pathname.replace(/^\//, ""));

  if (
    dbUrl.hostname !== "127.0.0.1" ||
    dbUrl.port !== "5433" ||
    databaseName !== "ecasti_local"
  ) {
    throw new Error(
      "Safety stop: database is not the approved local PostgreSQL target."
    );
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const identity = await client.query(`
      SELECT
        current_database() AS database_name,
        current_schema() AS schema_name,
        inet_server_addr()::text AS server_address,
        inet_server_port() AS server_port
    `);

    const db = identity.rows[0];

    const addressOK =
      db.server_address === "127.0.0.1" ||
      db.server_address === "127.0.0.1/32";

    if (
      db.database_name !== "ecasti_local" ||
      db.schema_name !== "public" ||
      db.server_port !== 5433 ||
      !addressOK
    ) {
      throw new Error("Safety stop: connected database identity mismatch.");
    }

    report.database = {
      name: db.database_name,
      schema: db.schema_name,
      address: db.server_address,
      port: db.server_port,
      verified: true
    };

    const columnsResult = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position
    `, [Object.keys(tables)]);

    const actual = {};

    for (const row of columnsResult.rows) {
      if (!actual[row.table_name]) actual[row.table_name] = [];
      actual[row.table_name].push(row.column_name);
    }

    for (const [table, expectedColumns] of Object.entries(tables)) {
      const actualColumns = actual[table] || [];
      report.targetSchema[table] = {
        exists: actualColumns.length > 0,
        expectedColumnCount: expectedColumns.length,
        actualColumnCount: actualColumns.length,
        missingColumns: expectedColumns.filter(
          column => !actualColumns.includes(column)
        )
      };
    }

    const missingTables = Object.entries(report.targetSchema)
      .filter(([, info]) => !info.exists)
      .map(([table]) => table);

    const columnMismatches = Object.entries(report.targetSchema)
      .filter(([, info]) => info.exists && info.missingColumns.length > 0)
      .map(([table]) => table);

    report.targetSchema.missingTables = missingTables;
    report.targetSchema.columnMismatches = columnMismatches;

    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }

  const sourceBlocked = report.sourceExceptions.length > 0;
  const schemaBlocked =
    report.targetSchema.missingTables.length > 0 ||
    report.targetSchema.columnMismatches.length > 0;
  const migrationBlocked =
    report.migration.declarationMismatch === true;

  report.status =
    sourceBlocked || schemaBlocked || migrationBlocked
      ? "BLOCKED"
      : "DRY_RUN_READY_NOT_IMPORTED";

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.log("\nFINAL STATUS:", report.status);
  console.log("No SQL migration or database writes were performed.");
  console.log("Report:", path.basename(reportPath));

  if (report.status === "BLOCKED") process.exitCode = 2;
}

main().catch(error => {
  console.error("\nDRY-RUN SAFETY STOP:", error.message);
  console.error("No import was performed.");
  process.exitCode = 2;
});
