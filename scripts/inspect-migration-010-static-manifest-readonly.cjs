const fs = require("fs");

function readSafe(file) {
  let raw = fs.readFileSync(file,"utf8");
  raw = raw.replace(/^\uFEFF/,"");
  return JSON.parse(raw);
}

const staticFile =
  "EDOCASTI_Migration_010_Final_Static_Reconciliation.json";

const manifestFile =
  "EDOCASTI_Migration_010_Manifest_Integrity.json";

console.log("\n=== STATIC RECONCILIATION SUMMARY ===");

try {
  const data = readSafe(staticFile);
  console.log("Keys:",Object.keys(data));
  console.log("Status:",data.status ?? "(not present)");

  for (const key of Object.keys(data)) {
    const value = data[key];
    if (Array.isArray(value)) {
      console.log(key,"array length:",value.length);

      if (value.every(x => x && typeof x === "object")) {
        console.log(
          key,"safe item keys:",
          [...new Set(value.flatMap(x => Object.keys(x)))]
        );
      }
    } else if (value && typeof value === "object") {
      console.log(key,"object keys:",Object.keys(value));
    }
  }
} catch (e) {
  console.log("Static report error:",e.message);
}

console.log("\n=== MANIFEST CHECK SUMMARY ===");

try {
  const data = readSafe(manifestFile);
  console.log("Status:",data.status);
  console.log("Check count:",data.checks?.length ?? 0);
  console.log("Failures count:",data.failures?.length ?? 0);

  if (Array.isArray(data.checks)) {
    const passed = data.checks.filter(x =>
      x.passed === true || x.status === "PASS"
    ).length;

    const failed = data.checks.filter(x =>
      x.passed === false || x.status === "FAIL"
    ).length;

    console.log("Recognized passed checks:",passed);
    console.log("Recognized failed checks:",failed);
  }
} catch (e) {
  console.log("Manifest report error:",e.message);
}

console.log("\nReport record values printed: NO");
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Source modified: NO");
console.log("Status: DIAGNOSTIC_COMPLETE");
