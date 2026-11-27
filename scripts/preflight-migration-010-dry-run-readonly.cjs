const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "data", "edocasti_db.json");
const MIGRATION = path.join(
  ROOT,
  "database",
  "migrations",
  "010_core_entities_and_legacy_finance.sql"
);

const EXPECTED = {
  schools: "schools",
  users: "users",
  departments: "departments",
  programmes: "programmes",
  courses: "courses",
  applications: "admission_applications",
  students: "students",
  invoices: "legacy_invoices",
  payments: "legacy_payment_transactions"
};

function stop(message) {
  throw new Error(message);
}

function countRows(data, collection) {
  if (!Array.isArray(data[collection])) {
    stop(`Source collection "${collection}" is missing or is not an array.`);
  }
  return data[collection].length;
}

function safeOutput(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  console.log("\nEDOCASTI MIGRATION 010 — READ-ONLY DRY RUN\n");

  if (!fs.existsSync(SOURCE)) stop("JSON source file not found.");
  if (!fs.existsSync(MIGRATION)) stop("Migration 010 SQL file not found.");

  const sourceText = fs.readFileSync(SOURCE, "utf8");
  const data = JSON.parse(sourceText);
  const migrationText = fs.readFileSync(MIGRATION, "utf8");

  const sourceChecksum = require("crypto")
    .createHash("sha256")
    .update(sourceText)
    .digest("hex");

  const migrationChecksum = require("crypto")
    .createHash("sha256")
    .update(migrationText)
    .digest("hex");

  const collections = {};

  for (const collection of Object.keys(EXPECTED)) {
    collections[collection] = countRows(data, collection);
  }

  const migrationTables = [
    ...migrationText.matchAll(
      /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gim
    )
  ].map(match => match[1]);

  const missingFromMigration = Object.values(EXPECTED)
    .filter(table => !migrationTables.includes(table));

  if (missingFromMigration.length) {
    stop(
      "Migration SQL does not declare expected tables: " +
      missingFromMigration.join(", ")
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) stop("DATABASE_URL is not configured.");

  const parsed = new URL(connectionString);

  // Strict local-target guard. Never connect to a remote database.
  const allowedHosts = ["127.0.0.1", "localhost", "::1"];

  if (!allowedHosts.includes(parsed.hostname)) {
    stop("Safety stop: database host is not local.");
  }

  if (parsed.port !== "5433") {
    stop("Safety stop: expected local PostgreSQL port 5433.");
  }

  if (parsed.pathname.replace(/^\//, "") !== "ecasti_local") {
    stop("Safety stop: expected database ec​asti_local.");
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    application_name: "EDOCASTI_MIGRATION_010_READONLY_PREFLIGHT"
  });

  let transactionOpen = false;

  try {
    await client.connect();

    await client.query("BEGIN READ ONLY");
    transactionOpen = true;

    await client.query("SET LOCAL statement_timeout = '10s'");

    const identity = await client.query(`
      SELECT
        current_database() AS database_name,
        current_schema() AS schema_name,
        inet_server_addr()::text AS server_address,
        inet_server_port() AS server_port
    `);

    const db = identity.rows[0];

    if (
      db.database_name !== "ecasti_local" ||
      db.schema_name !== "public" ||
      !["127.0.0.1", "127.0.0.1/32", "::1", "::1/128"].includes(db.server_address)
    ) {
      stop("Safety stop: connected database identity failed verification.");
    }

    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const existingTables = new Set(
      tableResult.rows.map(row => row.table_name)
    );

    const tableReport = {};

    for (const [collection, table] of Object.entries(EXPECTED)) {
      const exists = existingTables.has(table);

      tableReport[collection] = {
        targetTable: table,
        exists,
        sourceRecords: collections[collection],
        columns: [],
        missingIdentityColumn: exists
      };

      if (exists) {
        const columns = await client.query(
          `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position
          `,
          [table]
        );

        tableReport[collection].columns = columns.rows;
        tableReport[collection].missingIdentityColumn =
          !columns.rows.some(column => column.column_name === "id");
      }
    }

    const missingTables = Object.values(tableReport)
      .filter(item => !item.exists)
      .map(item => item.targetTable);

    const missingIdColumns = Object.values(tableReport)
      .filter(item => item.exists && item.missingIdentityColumn)
      .map(item => item.targetTable);

    const fkResult = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.constraint_schema = kcu.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `);

    const stateResult = await client.query(`
      SELECT count(*)::integer AS row_count
      FROM public.ecasti_application_state
    `).catch(() => ({ rows: [{ row_count: null }] }));

    const status =
      missingTables.length || missingIdColumns.length
        ? "BLOCKED"
        : "REVIEW";

    const report = {
      status,
      mode: "READ_ONLY_NO_IMPORT",
      database: {
        name: db.database_name,
        schema: db.schema_name,
        address: db.server_address,
        port: db.server_port
      },
      source: {
        file: "data/edocasti_db.json",
        sha256: sourceChecksum,
        collections
      },
      migration: {
        file: "database/migrations/010_core_entities_and_legacy_finance.sql",
        sha256: migrationChecksum,
        declaredTables: migrationTables
      },
      targetTables: tableReport,
      missingTables,
      missingIdentityColumns: missingIdColumns,
      foreignKeyConstraints: fkResult.rows,
      existingApplicationStateRows: stateResult.rows[0].row_count,
      limitations: [
        "No records were inserted, updated or deleted.",
        "No SQL migration was executed.",
        "Full field-by-field transformation mapping is not yet implemented.",
        "Existing ID collisions and record equality have not been evaluated.",
        "Outstanding reconciliation exceptions remain subject to review."
      ]
    };

    console.log("\nDRY-RUN REPORT\n");
    safeOutput(report);

    console.log("\nFINAL STATUS:", status);

    if (status === "BLOCKED") {
      console.log(
        "The local relational schema is not ready. No import can be planned."
      );
    } else {
      console.log(
        "Schema presence check passed. Full field mapping and data comparison remain necessary."
      );
    }

    await client.query("ROLLBACK");
    transactionOpen = false;

  } finally {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }
    await client.end().catch(() => {});
  }
}

main().catch(error => {
  // Do not print connection strings, credentials or source records.
  console.error("\nDRY-RUN STOPPED:", error.message);
  process.exitCode = 1;
});

