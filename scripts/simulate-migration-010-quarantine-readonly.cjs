// Migration 010 quarantine-aware simulation.
// FILE ONLY. No DB connection, SQL execution, or source edits.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.cwd();
const sourceFile = path.join(root, "data", "edocasti_db.json");
const migrationFile = path.join(
  root,
  "database",
  "migrations",
  "010_core_entities_and_legacy_finance_RERUN_SAFE_REVIEW.sql"
);
const reportFile = path.join(
  root,
  "EDOCASTI_Migration_010_Quarantine_Simulation.json"
);

function hash(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function blank(v) {
  return typeof v === "string" && v.trim() === "";
}

function missingRequired(v) {
  return v === undefined || v === null || blank(v);
}

function getIdSet(rows) {
  return new Set((rows || []).map(r => String(r.id)));
}

function main() {
  const sourceBytes = fs.readFileSync(sourceFile);
  const migrationBytes = fs.readFileSync(migrationFile);

  const data = JSON.parse(sourceBytes.toString("utf8"));
  const migration = migrationBytes.toString("utf8");

  const collections = [
    "schools",
    "users",
    "departments",
    "programmes",
    "courses",
    "applications",
    "students",
    "invoices",
    "payments"
  ];

  const quarantine = {};
  const eligible = {};
  const reasons = {};

  for (const name of collections) {
    quarantine[name] = new Set();
    eligible[name] = new Set();
    reasons[name] = {};
  }

  function mark(collection, id, reason) {
    const key = String(id);
    quarantine[collection].add(key);
    reasons[collection][key] = reason;
  }

  // Initial required-field quarantine.
  for (const row of data.applications || []) {
    if (missingRequired(row.phone)) {
      mark("applications", row.id, "REQUIRED_PHONE_MISSING");
    }
  }

  for (const row of data.students || []) {
    if (missingRequired(row.emergencyContact)) {
      mark("students", row.id, "REQUIRED_EMERGENCY_CONTACT_MISSING");
    }
  }

  // Quarantine invoices dependent on quarantined students.
  const quarantinedStudents = quarantine.students;

  for (const row of data.invoices || []) {
    if (quarantinedStudents.has(String(row.studentId))) {
      mark("invoices", row.id, "DEPENDENT_STUDENT_QUARANTINED");
    }
  }

  // Quarantine payments dependent on quarantined students
  // or quarantined invoices.
  const quarantinedInvoices = quarantine.invoices;

  for (const row of data.payments || []) {
    if (
      quarantinedStudents.has(String(row.studentId)) ||
      quarantinedInvoices.has(String(row.invoiceId))
    ) {
      mark("payments", row.id, "DEPENDENT_RECORD_QUARANTINED");
    }
  }

  // Compute eligible sets.
  for (const name of collections) {
    for (const row of data[name] || []) {
      if (!quarantine[name].has(String(row.id))) {
        eligible[name].add(String(row.id));
      }
    }
  }

  // Reference integrity checks against hypothetical eligible records.
  const refs = [
    ["departments", "schoolId", "schools"],
    ["programmes", "departmentId", "departments"],
    ["courses", "departmentId", "departments"],
    ["courses", "programmeId", "programmes"],
    ["courses", "lecturerId", "users"],
    ["applications", "userId", "users"],
    ["applications", "programmeId", "programmes"],
    ["students", "userId", "users"],
    ["students", "programmeId", "programmes"],
    ["students", "departmentId", "departments"],
    ["students", "schoolId", "schools"],
    ["invoices", "studentId", "students"],
    ["payments", "studentId", "students"],
    ["payments", "invoiceId", "invoices"]
  ];

  let referenceChecks = 0;
  let referenceFailures = 0;

  for (const [sourceCollection, field, targetCollection] of refs) {
    for (const row of data[sourceCollection] || []) {
      if (quarantine[sourceCollection].has(String(row.id))) {
        continue;
      }

      const value = row[field];

      if (missingRequired(value)) {
        continue;
      }

      referenceChecks++;

      if (!eligible[targetCollection].has(String(value))) {
        referenceFailures++;
      }
    }
  }

  const summary = {};

  let totalRecords = 0;
  let totalEligible = 0;
  let totalQuarantined = 0;

  for (const name of collections) {
    const count = (data[name] || []).length;
    const quarantinedCount = quarantine[name].size;
    const eligibleCount = eligible[name].size;

    summary[name] = {
      sourceRecords: count,
      simulatedEligible: eligibleCount,
      simulatedQuarantined: quarantinedCount
    };

    totalRecords += count;
    totalEligible += eligibleCount;
    totalQuarantined += quarantinedCount;
  }

  const quarantineReasonCounts = {};

  for (const name of collections) {
    for (const reason of Object.values(reasons[name])) {
      quarantineReasonCounts[reason] =
        (quarantineReasonCounts[reason] || 0) + 1;
    }
  }

  const report = {
    mode: "LOCAL_IN_MEMORY_QUARANTINE_SIMULATION",

    status:
      referenceFailures === 0
        ? "SIMULATION_PASS_REVIEW_REQUIRED"
        : "SIMULATION_BLOCKED",

    source: {
      file: "data/edocasti_db.json",
      sha256: hash(sourceBytes)
    },

    migration: {
      file:
        "database/migrations/010_core_entities_and_legacy_finance_RERUN_SAFE_REVIEW.sql",
      sha256: hash(migrationBytes)
    },

    totals: {
      collections: collections.length,
      sourceRecords: totalRecords,
      simulatedEligible: totalEligible,
      simulatedQuarantined: totalQuarantined,
      referenceChecks,
      referenceFailures
    },

    collectionSummary: summary,
    quarantineReasonCounts,

    limitations: [
      "This is an in-memory simulation, not an importer.",
      "No PostgreSQL connection or SQL execution occurred.",
      "Existing target ID collisions and record equality are not evaluated.",
      "Full SQL constraint enforcement is not simulated.",
      "Quarantine policy requires independent review before adoption.",
      "The source JSON remains untouched."
    ],

    safety: {
      databaseConnected: false,
      sqlExecuted: false,
      importPerformed: false,
      sourceModified: false,
      recordValuesPrinted: false
    }
  };

  fs.writeFileSync(
    reportFile,
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log("\n=== QUARANTINE SIMULATION ===");
  console.log("Collections:", totalRecords ? collections.length : 0);
  console.log("Source records:", totalRecords);
  console.log("Simulated eligible:", totalEligible);
  console.log("Simulated quarantined:", totalQuarantined);
  console.log("Reference checks:", referenceChecks);
  console.log("Reference failures:", referenceFailures);
  console.log("Database connected: NO");
  console.log("SQL executed: NO");
  console.log("Import performed: NO");
  console.log("Source modified: NO");
  console.log("Status:", report.status);
  console.log("Report:", reportFile);
}

main();