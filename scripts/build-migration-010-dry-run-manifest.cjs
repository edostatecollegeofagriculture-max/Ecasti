const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.cwd();
const sourceFile = path.join(root, "data", "edocasti_db.json");
const simFile = path.join(root, "EDOCASTI_Migration_010_Quarantine_Simulation.json");
const transformFile = path.join(root, "EDOCASTI_Migration_010_Transformation_Validation.json");

const scope = [
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

const order = [
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

const dependencies = {
  schools: [],
  users: ["schools", "departments"],
  departments: ["schools", "users"],
  programmes: ["departments"],
  courses: ["departments", "programmes", "users"],
  applications: ["users", "programmes"],
  students: ["users", "schools", "departments", "programmes"],
  invoices: ["students"],
  payments: ["students", "invoices"]
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function hashFile(file) {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function fail(message) {
  console.error("BLOCKED:", message);
  process.exit(1);
}

if (!fs.existsSync(sourceFile)) fail("Source JSON not found");
if (!fs.existsSync(simFile)) fail("Quarantine simulation report missing");
if (!fs.existsSync(transformFile)) fail("Transformation validation report missing");

const source = readJson(sourceFile);
const simulation = readJson(simFile);
const transformation = readJson(transformFile);

if (simulation.safety?.databaseConnected !== false ||
    simulation.safety?.sqlExecuted !== false ||
    simulation.safety?.importPerformed !== false ||
    simulation.safety?.sourceModified !== false) {
  fail("Simulation safety flags are not all false");
}

if (transformation.safety?.databaseConnected !== false ||
    transformation.safety?.sqlExecuted !== false ||
    transformation.safety?.importPerformed !== false ||
    transformation.safety?.sourceModified !== false) {
  fail("Transformation safety flags are not all false");
}

const collections = {};

for (const name of scope) {
  if (!Array.isArray(source[name])) fail(`Missing source collection: ${name}`);

  collections[name] = {
    sourceCount: source[name].length,
    simulatedEligible: null,
    simulatedQuarantined: null,
    dependencies: dependencies[name],
    status: "REVIEW_REQUIRED"
  };
}

const simSummary = simulation.collectionSummary || {};

for (const name of scope) {
  const item = simSummary[name];

  if (!item) fail(`Simulation summary missing: ${name}`);

  collections[name].simulatedEligible = item.simulatedEligible;
  collections[name].simulatedQuarantined = item.simulatedQuarantined;
}

const sourceCount = scope.reduce(
  (n, name) => n + collections[name].sourceCount, 0
);

const eligibleCount = scope.reduce(
  (n, name) => n + collections[name].simulatedEligible, 0
);

const quarantinedCount = scope.reduce(
  (n, name) => n + collections[name].simulatedQuarantined, 0
);

if (sourceCount !== simulation.totals.sourceRecords) {
  fail("Source count differs from simulation");
}

if (eligibleCount !== simulation.totals.simulatedEligible) {
  fail("Eligible count differs from simulation");
}

if (quarantinedCount !== simulation.totals.simulatedQuarantined) {
  fail("Quarantine count differs from simulation");
}

const manifest = {
  manifestVersion: 1,
  mode: "DRY_RUN_ONLY",
  status: "REVIEW_REQUIRED",
  generatedAt: new Date().toISOString(),
  scope,
  importOrder: order,
  dependencies,
  collections,
  totals: {
    collections: scope.length,
    sourceRecords: sourceCount,
    simulatedEligible: eligibleCount,
    simulatedQuarantined: quarantinedCount
  },
  validation: {
    transformationStatus: transformation.status,
    transformationFindings: transformation.totals?.findings,
    referenceFailures: simulation.totals?.referenceFailures,
    targetCollisionCheck: "NOT_PERFORMED",
    databaseValidation: "NOT_PERFORMED"
  },
  hashes: {
    source: hashFile(sourceFile),
    simulation: hashFile(simFile),
    transformation: hashFile(transformFile)
  },
  limitations: [
    "Manifest does not establish target ID collision safety.",
    "Manifest does not validate actual target database schema.",
    "Circular user and department references require staged resolution.",
    "Import ordering is a proposed logical order, not an executable plan.",
    "Transformation blockers remain unresolved.",
    "Actual database import is not authorized by this manifest."
  ],
  safety: {
    databaseConnected: false,
    sqlExecuted: false,
    importPerformed: false,
    sourceModified: false,
    recordsPrinted: false
  }
};

const output = path.join(
  root,
  "EDOCASTI_Migration_010_Dry_Run_Manifest.json"
);

fs.writeFileSync(output, JSON.stringify(manifest, null, 2), "utf8");

console.log("\n=== DRY-RUN MANIFEST ===");
console.log("Scope:", scope.length);
console.log("Source records:", sourceCount);
console.log("Eligible:", eligibleCount);
console.log("Quarantined:", quarantinedCount);
console.log("Target collisions: NOT CHECKED");
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Import performed: NO");
console.log("Source modified: NO");
console.log("Status:", manifest.status);
console.log("Report:", output);
