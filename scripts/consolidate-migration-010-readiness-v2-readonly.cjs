const fs = require("fs");

function readJSON(file) {
  return JSON.parse(
    fs.readFileSync(file,"utf8").replace(/^\uFEFF/,"")
  );
}

const checks = [];
function add(name,pass,detail="") {
  checks.push({name,pass,detail});
}

const staticRecon = readJSON(
  "EDOCASTI_Migration_010_Final_Static_Reconciliation.json"
);
const manifest = readJSON(
  "EDOCASTI_Migration_010_Manifest_Integrity.json"
);
const synthetic = readJSON(
  "EDOCASTI_Migration_010_Synthetic_Test_Report.json"
);
const propagation = readJSON(
  "EDOCASTI_Migration_010_Quarantine_Propagation_Test.json"
);
const dependency = readJSON(
  "EDOCASTI_Migration_010_Dependency_Integrity_Test.json"
);
const collision = readJSON(
  "EDOCASTI_Migration_010_Target_Collision_Test.json"
);
const quarantine = readJSON(
  "EDOCASTI_Migration_010_Quarantine_Simulation.json"
);
const transformation = readJSON(
  "EDOCASTI_Migration_010_Transformation_Validation.json"
);

// 1. Static reconciliation.
const staticPassed = staticRecon.checks.filter(x => x.pass === true).length;
const staticFailed = staticRecon.checks.filter(x => x.pass !== true).length;

add(
  "Static reconciliation passed",
  staticRecon.status === "STATIC_RECONCILIATION_PASS" &&
  staticPassed === 11 &&
  staticFailed === 0,
  `${staticPassed} passed; ${staticFailed} failed`
);

// 2. Manifest integrity.
const manifestPassed = manifest.checks.filter(x =>
  x.pass === true || x.passed === true || x.status === "PASS"
).length;

add(
  "Manifest integrity passed",
  manifest.status === "MANIFEST_VALID" &&
  manifestPassed === 46 &&
  manifest.failures.length === 0,
  `${manifestPassed}/46; failures ${manifest.failures.length}`
);

// 3. Synthetic tests.
for (const [name,data,expected] of [
  ["Synthetic safety logic",synthetic,15],
  ["Quarantine propagation",propagation,10],
  ["Dependency integrity",dependency,8],
  ["Target collision simulation",collision,8]
]) {
  add(
    `${name} passed`,
    data.status === "TEST_PASS" &&
    data.passed === expected &&
    data.failed === 0,
    `${data.passed}/${expected}; failures ${data.failed}`
  );
}

// 4. Quarantine simulation.
add(
  "Quarantine simulation status recognized",
  quarantine.status === "SIMULATION_PASS_REVIEW_REQUIRED",
  quarantine.status
);

// 5. Transformation validation remains blocked appropriately.
add(
  "Transformation validation retains source blockers",
  transformation.status === "BLOCKED" &&
  transformation.findings.length === 2,
  `${transformation.findings.length} findings; status ${transformation.status}`
);

// 6. Expected source record totals from prior file-only simulation.
add(
  "Simulation source record total",
  quarantine.totals?.sourceRecords === 60,
  String(quarantine.totals?.sourceRecords ?? "field not found")
);

add(
  "Simulation eligible total",
  quarantine.totals?.eligible === 57,
  String(quarantine.totals?.eligible ?? "field not found")
);

add(
  "Simulation quarantined total",
  quarantine.totals?.quarantined === 3,
  String(quarantine.totals?.quarantined ?? "field not found")
);

// 7. Actual blockers remain explicitly unresolved.
const blockers = [
  "Application required phone missing",
  "Student required emergency contact missing"
];

add(
  "Required source data blockers resolved",
  false,
  blockers.length + " unresolved"
);

add(
  "Destination collision verification completed",
  false,
  "Real destination not inspected"
);

add(
  "Import authorized",
  false,
  "Not authorized"
);

const report = {
  mode:"MIGRATION_010_CONSOLIDATED_READINESS_V2",
  status:"REVIEW_REQUIRED",
  checks,
  passed:checks.filter(x => x.pass).length,
  reviewItems:checks.filter(x => !x.pass).length,
  blockers,
  safety:{
    databaseConnected:false,
    sqlExecuted:false,
    sourceModified:false,
    destinationInspected:false,
    importPerformed:false,
    importAuthorized:false
  },
  note:"Validation summary only. Does not authorize or execute migration."
};

fs.writeFileSync(
  "./EDOCASTI_Migration_010_Consolidated_Readiness_V2.json",
  JSON.stringify(report,null,2),
  "utf8"
);

console.log("\n=== MIGRATION 010 CONSOLIDATED READINESS V2 ===");
console.log("Checks:",checks.length);
console.log("Passed:",report.passed);
console.log("Review items:",report.reviewItems);

for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "REVIEW"}: ${c.name}`);
  if (c.detail) console.log("  "+c.detail);
}

console.log("\nDatabase connected: NO");
console.log("SQL executed: NO");
console.log("Source modified: NO");
console.log("Destination inspected: NO");
console.log("Import performed: NO");
console.log("Import authorized: NO");
console.log("Status:",report.status);
console.log("Report: ./EDOCASTI_Migration_010_Consolidated_Readiness_V2.json");
