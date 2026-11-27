const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.cwd();
const files = {
  source: "./data/edocasti_db.json",
  simulation: "./EDOCASTI_Migration_010_Quarantine_Simulation.json",
  transformation: "./EDOCASTI_Migration_010_Transformation_Validation.json",
  manifest: "./EDOCASTI_Migration_010_Dry_Run_Manifest.json"
};

const expected = [
  "schools","users","departments","programmes","courses",
  "applications","students","invoices","payments"
];

function hash(file) {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const failures = [];
const checks = [];

function check(label, condition) {
  checks.push({label, passed:!!condition});
  if (!condition) failures.push(label);
}

for (const file of Object.values(files)) {
  check(`File exists: ${file}`, fs.existsSync(file));
}

if (failures.length) {
  console.log("BLOCKED: Missing files.");
  console.log(failures);
  process.exit(1);
}

const manifest = read(files.manifest);
const source = read(files.source);
const sim = read(files.simulation);
const transform = read(files.transformation);

check("Manifest mode is dry-run only",
  manifest.mode === "DRY_RUN_ONLY");

check("Manifest collection scope exact",
  JSON.stringify(manifest.scope) === JSON.stringify(expected));

check("Manifest order exact",
  JSON.stringify(manifest.importOrder) === JSON.stringify(expected));

check("Manifest collection count",
  manifest.totals.collections === 9);

check("Manifest source total",
  manifest.totals.sourceRecords === 60);

check("Manifest eligible total",
  manifest.totals.simulatedEligible === 57);

check("Manifest quarantine total",
  manifest.totals.simulatedQuarantined === 3);

check("Manifest source hash matches",
  manifest.hashes.source === hash(files.source));

check("Manifest simulation hash matches",
  manifest.hashes.simulation === hash(files.simulation));

check("Manifest transformation hash matches",
  manifest.hashes.transformation === hash(files.transformation));

check("Simulation has zero reference failures",
  sim.totals.referenceFailures === 0);

check("Transformation findings remain two",
  transform.totals.findings === 2);

check("Manifest has no SQL payload",
  !Object.hasOwn(manifest, "sql"));

check("Safety flags remain false",
  manifest.safety.databaseConnected === false &&
  manifest.safety.sqlExecuted === false &&
  manifest.safety.importPerformed === false &&
  manifest.safety.sourceModified === false &&
  manifest.safety.recordsPrinted === false);

let actualSourceCount = 0;

for (const name of expected) {
  const rows = source[name];
  check(`Source array exists: ${name}`, Array.isArray(rows));
  if (Array.isArray(rows)) actualSourceCount += rows.length;

  const entry = manifest.collections[name];
  check(`Manifest entry exists: ${name}`, !!entry);
  if (entry) {
    check(`Source count reconciles: ${name}`,
      entry.sourceCount === rows.length);
  }
}

check("Source count independently reconciles",
  actualSourceCount === 60);

console.log("\n=== MANIFEST INTEGRITY VALIDATION ===");
console.log("Checks:", checks.length);
console.log("Passed:", checks.filter(c => c.passed).length);
console.log("Failed:", failures.length);

for (const item of checks) {
  console.log(`${item.passed ? "PASS" : "FAIL"}: ${item.label}`);
}

console.log("\nDatabase connected: NO");
console.log("SQL executed: NO");
console.log("Import performed: NO");
console.log("Source modified: NO");
console.log("Status:", failures.length ? "BLOCKED" : "MANIFEST_VALID");

const report = {
  mode:"FILE_ONLY",
  status: failures.length ? "BLOCKED" : "MANIFEST_VALID",
  checks,
  failures,
  safety:{
    databaseConnected:false,
    sqlExecuted:false,
    importPerformed:false,
    sourceModified:false
  }
};

fs.writeFileSync(
  path.join(root,"EDOCASTI_Migration_010_Manifest_Integrity.json"),
  JSON.stringify(report,null,2),
  "utf8"
);
