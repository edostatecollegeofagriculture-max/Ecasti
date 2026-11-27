require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const migrationPath = path.resolve(
  "database/migrations/010_core_entities_and_legacy_finance.sql"
);

const expectedTables = [
  "schools", "users", "departments", "programmes", "courses",
  "admission_applications", "students", "legacy_invoices",
  "legacy_payment_transactions"
];

async function main() {
  const sql = fs.readFileSync(migrationPath, "utf8");

  const report = {
    mode: "READ_ONLY_SCHEMA_APPLICATION_PREFLIGHT",
    migration: "010_core_entities_and_legacy_finance.sql",
    statements: {
      createTables: [],
      addConstraints: [],
      destructiveStatements: [],
      transactionMarkers: []
    },
    database: {},
    existingApplicationState: null,
    existingTargetTables: [],
    existingTargetConstraints: [],
    risks: [],
    status: "REVIEW"
  };

  const createRegex =
    /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi;

  for (const match of sql.matchAll(createRegex)) {
    report.statements.createTables.push({
      table: match[2],
      guarded: Boolean(match[1])
    });
  }

  const constraintRegex =
    /ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ADD\s+CONSTRAINT\s+([a-z_][a-z0-9_]*)/gi;

  for (const match of sql.matchAll(constraintRegex)) {
    report.statements.addConstraints.push({
      table: match[1],
      constraint: match[2],
      guarded: false
    });
  }

  for (const pattern of [
    /\bDROP\s+TABLE\b/gi,
    /\bDROP\s+COLUMN\b/gi,
    /\bTRUNCATE\b/gi,
    /\bDELETE\s+FROM\b/gi
  ]) {
    for (const match of sql.matchAll(pattern)) {
      report.statements.destructiveStatements.push({
        statement: match[0]
      });
    }
  }

  report.statements.transactionMarkers = {
    begin: /^\s*BEGIN\b/im.test(sql),
    commit: /^\s*COMMIT\b/im.test(sql)
  };

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing.");
  }

  if (
    process.env.RENDER_SERVICE_ID ||
    process.env.STAGING_DEMO_ONLY === "true"
  ) {
    throw new Error("Staging environment detected. Stopping.");
  }

  const url = new URL(process.env.DATABASE_URL);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "5433" ||
    dbName !== "ecasti_local"
  ) {
    throw new Error("Target is not the approved local database.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000
  });

  await client.connect();

  try {
    await client.query("BEGIN READ ONLY");

    const identity = await client.query(`
      SELECT current_database() AS db,
             current_schema() AS schema,
             inet_server_addr()::text AS address,
             inet_server_port() AS port
    `);

    const db = identity.rows[0];

    if (
      db.db !== "ecasti_local" ||
      db.schema !== "public" ||
      db.port !== 5433 ||
      !["127.0.0.1", "127.0.0.1/32"].includes(db.address)
    ) {
      throw new Error("Connected database identity mismatch.");
    }

    report.database = {
      ...db,
      verified: true
    };

    const existing = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `, [expectedTables]);

    report.existingTargetTables =
      existing.rows.map(row => row.table_name);

    const constraints = await client.query(`
      SELECT table_name, constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name, constraint_name
    `, [expectedTables]);

    report.existingTargetConstraints = constraints.rows;

    const state = await client.query(`
      SELECT COUNT(*)::integer AS row_count
      FROM public.ecasti_application_state
    `);

    report.existingApplicationState = {
      tableExists: true,
      rowCount: state.rows[0].row_count
    };

    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }

  const unguardedCreates =
    report.statements.createTables.filter(item => !item.guarded);

  if (unguardedCreates.length) {
    report.risks.push("One or more CREATE TABLE statements are unguarded.");
  }

  if (report.statements.addConstraints.length) {
    report.risks.push(
      "ADD CONSTRAINT statements are not protected by IF NOT EXISTS; inspect before reruns."
    );
  }

  if (report.statements.destructiveStatements.length) {
    report.risks.push("Potentially destructive SQL statements detected.");
  }

  if (!report.statements.transactionMarkers.begin ||
      !report.statements.transactionMarkers.commit) {
    report.risks.push("Explicit transaction markers need review.");
  }

  if (report.existingTargetTables.length) {
    report.risks.push(
      "Some target tables already exist; inspect their definitions before applying the migration."
    );
  }

  report.status = report.risks.length ? "REVIEW" : "PREFLIGHT_CLEAR";

  const output = path.resolve("EDOCASTI_Migration_010_Schema_Preflight.json");
  fs.writeFileSync(output, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.log("\nPREFLIGHT STATUS:", report.status);
  console.log("No SQL migration was executed.");
  console.log("No database writes were performed.");
  console.log("Report:", path.basename(output));
}

main().catch(error => {
  console.error("PREFLIGHT STOP:", error.message);
  process.exitCode = 2;
});
