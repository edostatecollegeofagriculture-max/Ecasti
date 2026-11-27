const fs = require("fs");

function read(file) {
  return JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));
}

const staticRecon = read("./EDOCASTI_Migration_010_Final_Static_Reconciliation.json");
const manifest = read("./EDOCASTI_Migration_010_Manifest_Integrity.json");
const safety = read("./EDOCASTI_Migration_010_Synthetic_Test_Report.json");
const propagation = read("./EDOCASTI_Migration_010_Quarantine_Propagation_Test.json");
const dependency = read("./EDOCASTI_Migration_010_Dependency_Integrity_Test.json");
const collision = read("./EDOCASTI_Migration_010_Target_Collision_Test.json");
const simulation = read("./EDOCASTI_Migration_010_Quarantine_Simulation.json");
const transformation = read("./EDOCASTI_Migration_010_Transformation_Validation.json");

const checks = [];

function add(name,pass,detail="") {
  checks.push({name,pass,detail});
}

add(
  "Static reconciliation",
  staticRecon.status === "STATIC_RECONCILIATION_PASS" &&
  staticRecon.totals.checksPassed === 11 &&
  staticRecon.totals.checksFailed === 0,
  `${staticRecon.totals.checksPassed}/11`
);

add(
  "Manifest integrity",
  manifest.status === "MANIFEST_VALID" &&
  manifest.checks.length === 46 &&
  manifest.failures.length === 0,
  `${manifest.checks.length}/46`
);

for (const [name,data,count] of [
  ["Synthetic safety logic",safety,15],
  ["Quarantine propagation",propagation,10],
  ["Dependency integrity",dependency,8],
  ["Target collision simulation",collision,8]
]) {
  add(
    name,
    data.status === "TEST_PASS" &&
    data.passed === count &&
    data.failed === 0,
    `${data.passed}/${count}`
  );
}

add(
  "Quarantine simulation recognized",
  simulation.status === "SIMULATION_PASS_REVIEW_REQUIRED",
  simulation.status
);

add(
  "Transformation blockers retained",
  transformation.status === "BLOCKED" &&
  transformation.findings.length === 2,
  `${transformation.findings.length} findings`
);

const t = simulation.totals;

add(
  "Source record total",
  t.sourceRecords === 60,
  String(t.sourceRecords)
);

add(
  "Eligible/quarantined totals reconcile",
  t.simulatedEligible + t.simulatedQuarantined === t.sourceRecords,
  `${t.simulatedEligible}+${t.simulatedQuarantined}=${t.sourceRecords}`
);

add(
  "Nine collections verified",
  t.collections === 9 &&
  Object.keys(simulation.collectionSummary).length === 9,
  String(t.collections)
);

const summary = Object.values(simulation.collectionSummary);

const sourceSum = summary.reduce((a,x) => a+x.sourceRecords,0);
const eligibleSum = summary.reduce((a,x) => a+x.simulatedEligible,0);
const quarantineSum = summary.reduce((a,x) => a+x.simulatedQuarantined,0);

add(
  "Per-collection totals reconcile",
  sourceSum === 60 &&
  eligibleSum === 57 &&
  quarantineSum === 3,
  `${sourceSum} source; ${eligibleSum} eligible; ${quarantineSum} quarantined`
);

add(
  "Reference integrity",
  t.referenceChecks === 65 && t.referenceFailures === 0,
  `${t.referenceChecks} checks; ${t.referenceFailures} failures`
);

add(
  "Required source fields resolved",
  false,
  "Application phone and student emergency contact remain unresolved"
);

add(
  "Destination verification",
  false,
  "Actual destination not inspected"
);

add(
  "Import authorization",
  false,
  "Not authorized"
);

const report = {
  mode:"MIGRATION_010_FINAL_CONSOLIDATED_READINESS",
  status:"REVIEW_REQUIRED",
  checks,
  passed:checks.filter(x=>x.pass).length,
  reviewItems:checks.filter(x=>!x.pass).length,
  simulationTotals:{
    collections:t.collections,
    sourceRecords:t.sourceRecords,
    eligible:t.simulatedEligible,
    quarantined:t.simulatedQuarantined,
    referenceChecks:t.referenceChecks,
    referenceFailures:t.referenceFailures
  },
  blockers:[
    "Application required phone missing",
    "Student required emergency contact missing",
    "Destination not inspected",
    "Import not authorized"
  ],
  safety:{
    databaseConnected:false,
    sqlExecuted:false,
    sourceModified:false,
    destinationInspected:false,
    importPerformed:false,
    importAuthorized:false
  }
};

fs.writeFileSync(
  "./EDOCASTI_Migration_010_Final_Consolidated_Readiness.json",
  JSON.stringify(report,null,2),
  "utf8"
);

console.log("\n=== FINAL MIGRATION 010 READINESS ===");
console.log("Checks:",checks.length);
console.log("Passed:",report.passed);
console.log("Review items:",report.reviewItems);

for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "REVIEW"}: ${c.name}`);
  if (c.detail) console.log("  "+c.detail);
}

console.log("\nSource records:",t.sourceRecords);
console.log("Eligible:",t.simulatedEligible);
console.log("Quarantined:",t.simulatedQuarantined);
console.log("Reference checks:",t.referenceChecks);
console.log("Reference failures:",t.referenceFailures);

console.log("\nDatabase connected: NO");
console.log("SQL executed: NO");
console.log("Source modified: NO");
console.log("Destination inspected: NO");
console.log("Import performed: NO");
console.log("Import authorized: NO");
console.log("Status:",report.status);
console.log("Report: ./EDOCASTI_Migration_010_Final_Consolidated_Readiness.json");
