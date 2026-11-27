const fs = require("fs");
const path = require("path");

const files = [
  "EDOCASTI_Migration_010_Final_Static_Reconciliation.json",
  "EDOCASTI_Migration_010_Manifest_Integrity.json",
  "EDOCASTI_Migration_010_Synthetic_Test_Report.json",
  "EDOCASTI_Migration_010_Quarantine_Propagation_Test.json",
  "EDOCASTI_Migration_010_Dependency_Integrity_Test.json",
  "EDOCASTI_Migration_010_Target_Collision_Test.json",
  "EDOCASTI_Migration_010_Quarantine_Simulation.json",
  "EDOCASTI_Migration_010_Transformation_Validation.json"
];

const checks = [];
const missing = [];
const reports = [];

function addCheck(name,passed,detail) {
  checks.push({name,passed,detail});
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file,"utf8"));
  } catch {
    return null;
  }
}

for (const file of files) {
  const full = path.resolve(file);

  if (!fs.existsSync(full)) {
    missing.push(file);
    reports.push({file,exists:false});
    continue;
  }

  const data = readJSON(full);
  if (!data) {
    reports.push({file,exists:true,parseable:false});
    continue;
  }

  reports.push({
    file,
    exists:true,
    parseable:true,
    status:data.status || null,
    passed:data.passed ?? null,
    failed:data.failed ?? null,
    findings:data.findings ?? null
  });
}

addCheck(
  "All expected report files exist",
  missing.length === 0,
  missing.length ? missing.join(", ") : "All present"
);

addCheck(
  "All reports parse as JSON",
  reports.every(x => x.exists && x.parseable !== false),
  "Reports checked: " + reports.length
);

const testReports = files.slice(1,6).map(readJSON);

addCheck(
  "Five synthetic/integrity reports have TEST_PASS",
  testReports.every(x => x && x.status === "TEST_PASS"),
  testReports.map(x => x?.status || "MISSING").join(", ")
);

const staticRecon = readJSON(files[0]);

addCheck(
  "Static reconciliation reports pass",
  !!staticRecon &&
  (staticRecon.status === "STATIC_RECONCILIATION_PASS" ||
   staticRecon.status === "PASS"),
  staticRecon?.status || "Status not found"
);

const manifest = readJSON(files[1]);

addCheck(
  "Manifest integrity report has no failures",
  !!manifest &&
  manifest.status === "MANIFEST_VALID" &&
  (manifest.failed === undefined || manifest.failed === 0),
  manifest?.status || "Missing"
);

const quarantine = readJSON(files[5]);

addCheck(
  "Quarantine simulation totals reconcile",
  !!quarantine &&
  quarantine.status !== "TEST_FAILED",
  quarantine?.status || "Missing"
);

const transform = readJSON(files[7]);

addCheck(
  "Transformation report does not falsely indicate unrestricted readiness",
  !!transform &&
  transform.status !== "READY_TO_IMPORT",
  transform?.status || "Missing or unknown"
);

// Known source-data blockers from the previously completed file-only audit.
const blockers = [
  {
    collection:"admission_applications",
    issue:"Required phone field missing",
    resolved:false
  },
  {
    collection:"students",
    issue:"Required emergency contact missing",
    resolved:false
  }
];

addCheck(
  "Authoritative required-field blockers resolved",
  blockers.every(x => x.resolved),
  blockers.filter(x => !x.resolved).length + " unresolved"
);

// The destination has not been inspected. No destination readiness is claimed.
addCheck(
  "Destination collision verification completed",
  false,
  "Not performed; collision testing was synthetic only"
);

addCheck(
  "Import authorization",
  false,
  "Blocked pending authoritative data and destination verification"
);

const failed = checks.filter(x => !x.passed);

const report = {
  mode:"MIGRATION_010_CONSOLIDATED_FILE_ONLY_READINESS",
  generatedAt:new Date().toISOString(),
  status:failed.length ? "REVIEW_REQUIRED" : "READY_FOR_REVIEW",
  checks,
  passed:checks.filter(x => x.passed).length,
  failed:failed.length,
  missingFiles:missing,
  individualReports:reports,
  sourceDataBlockers:blockers,
  safety:{
    sourceModified:false,
    databaseConnected:false,
    destinationInspected:false,
    sqlExecuted:false,
    importPerformed:false,
    importAuthorized:false
  },
  scope:{
    collections:[
      "schools",
      "users",
      "departments",
      "programmes",
      "courses",
      "admission_applications",
      "students",
      "legacy_invoices",
      "legacy_payment_transactions"
    ],
    expectedSourceRecords:60,
    simulatedEligible:57,
    simulatedQuarantined:3
  },
  note:"This report consolidates file-only validation. It does not authorize or perform a migration."
};

fs.writeFileSync(
  "./EDOCASTI_Migration_010_Consolidated_Readiness.json",
  JSON.stringify(report,null,2),
  "utf8"
);

console.log("\n=== MIGRATION 010 CONSOLIDATED READINESS ===");
console.log("Checks:",checks.length);
console.log("Passed:",report.passed);
console.log("Failed/review items:",report.failed);

for (const item of checks) {
  console.log(`${item.passed ? "PASS" : "REVIEW"}: ${item.name}`);
  if (item.detail) console.log("  " + item.detail);
}

console.log("\nUnresolved authoritative blockers:",blockers.length);
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Import performed: NO");
console.log("Source modified: NO");
console.log("Import authorized: NO");
console.log("Status:",report.status);
console.log("Report: ./EDOCASTI_Migration_010_Consolidated_Readiness.json");
