const fs = require("fs");
const file = "./EDOCASTI_Migration_010_Quarantine_Simulation.json";

const data = JSON.parse(
  fs.readFileSync(file,"utf8").replace(/^\uFEFF/,"")
);

console.log("=== SIMULATION TOTALS SCHEMA ===");
console.log("Totals keys:",Object.keys(data.totals || {}));

for (const [key,value] of Object.entries(data.totals || {})) {
  if (typeof value !== "object") {
    console.log(key,":",value);
  }
}

console.log("\nCollection summary keys:",
  Object.keys(data.collectionSummary || {}));

if (Array.isArray(data.collectionSummary)) {
  console.log("Collection summary entries:",data.collectionSummary.length);
} else if (data.collectionSummary) {
  console.log("Collection summary structure:");
  for (const [key,value] of Object.entries(data.collectionSummary)) {
    if (typeof value === "object" && value !== null) {
      console.log(key,"keys:",Object.keys(value));
    } else {
      console.log(key,":",value);
    }
  }
}

console.log("\nSafety flags:",data.safety);
console.log("Record values printed: NO");
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Source modified: NO");
console.log("Status: SCHEMA_INSPECTED");
