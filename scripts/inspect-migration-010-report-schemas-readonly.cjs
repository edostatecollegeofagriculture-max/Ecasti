const fs = require("fs");

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

console.log("\n=== READ-ONLY REPORT SCHEMA DIAGNOSTIC ===");

for (const file of files) {
  console.log("\nFILE:",file);

  try {
    const data = JSON.parse(fs.readFileSync(file,"utf8"));

    console.log("Top-level keys:",Object.keys(data));
    console.log("Status:",data.status ?? "(not present)");
    console.log("Passed:",data.passed ?? "(not present)");
    console.log("Failed:",data.failed ?? "(not present)");

    if (Array.isArray(data.checks)) {
      console.log("Checks array length:",data.checks.length);
    }

    if (Array.isArray(data.findings)) {
      console.log("Findings array length:",data.findings.length);
    } else if (data.findings !== undefined) {
      console.log("Findings type:",typeof data.findings);
    }

    if (data.summary && typeof data.summary === "object") {
      console.log("Summary keys:",Object.keys(data.summary));
    }

    if (data.validation && typeof data.validation === "object") {
      console.log("Validation keys:",Object.keys(data.validation));
    }

  } catch (e) {
    console.log("READ/PARSE ERROR:",e.message);
  }
}

console.log("\nRecord values printed: NO");
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Source modified: NO");
console.log("Status: DIAGNOSTIC_COMPLETE");
