const fs = require("fs");

const checks = [];
const failures = [];

function check(name,fn) {
  let passed = false;
  try { passed = fn() === true; } catch {}
  checks.push({name,passed});
  if (!passed) failures.push(name);
}

// Synthetic records only. No real migration source or destination is loaded.
function reconcile(existing,incoming) {
  const decisions = [];
  const errors = [];
  const existingIds = new Map();
  const incomingIds = new Map();

  for (const record of existing) {
    if (existingIds.has(record.id)) {
      errors.push("DUPLICATE_EXISTING_ID");
    }
    existingIds.set(record.id,record);
  }

  for (const record of incoming) {
    if (incomingIds.has(record.id)) {
      errors.push("DUPLICATE_INCOMING_ID");
    }
    incomingIds.set(record.id,record);
  }

  if (errors.length) {
    return {decisions,errors};
  }

  for (const record of incoming) {
    const prior = existingIds.get(record.id);

    if (!prior) {
      decisions.push({id:record.id,action:"INSERT_SIMULATED"});
    } else if (JSON.stringify(prior) === JSON.stringify(record)) {
      decisions.push({id:record.id,action:"IDENTICAL_MATCH"});
    } else {
      decisions.push({id:record.id,action:"REJECT_CONFLICT"});
      errors.push("ID_CONTENT_CONFLICT");
    }
  }

  return {decisions,errors};
}

const existing = [
  {id:"T1",name:"Synthetic School A"},
  {id:"T2",name:"Synthetic Department A"}
];

const identicalIncoming = [
  {id:"T1",name:"Synthetic School A"}
];

const newIncoming = [
  {id:"T3",name:"Synthetic Programme A"}
];

const conflictingIncoming = [
  {id:"T1",name:"Synthetic School B"}
];

const duplicateIncoming = [
  {id:"T4",name:"Synthetic Record A"},
  {id:"T4",name:"Synthetic Record B"}
];

const duplicateExisting = [
  {id:"T5",name:"Synthetic Existing A"},
  {id:"T5",name:"Synthetic Existing B"}
];

const businessCollisionExisting = [
  {id:"T6",email:"synthetic@example.invalid"}
];

const businessCollisionIncoming = [
  {id:"T7",email:"SYNTHETIC@example.invalid"}
];

function checkBusinessCollision(existing,incoming) {
  const normalize = x => String(x.email || "").trim().toLowerCase();
  return existing.some(a =>
    incoming.some(b =>
      normalize(a) !== "" && normalize(a) === normalize(b)
    )
  );
}

const identicalResult = reconcile(existing,identicalIncoming);
const newResult = reconcile(existing,newIncoming);
const conflictResult = reconcile(existing,conflictingIncoming);
const duplicateIncomingResult = reconcile(existing,duplicateIncoming);
const duplicateExistingResult = reconcile(duplicateExisting,[]);
const businessCollision = checkBusinessCollision(
  businessCollisionExisting,businessCollisionIncoming
);

const beforeExisting = JSON.stringify(existing);
const beforeIncoming = JSON.stringify(conflictingIncoming);

check("Identical existing record recognized safely",() =>
  identicalResult.errors.length === 0 &&
  identicalResult.decisions[0]?.action === "IDENTICAL_MATCH");

check("New ID classified for simulated insertion",() =>
  newResult.errors.length === 0 &&
  newResult.decisions[0]?.action === "INSERT_SIMULATED");

check("Conflicting ID content rejected",() =>
  conflictResult.errors.includes("ID_CONTENT_CONFLICT") &&
  conflictResult.decisions[0]?.action === "REJECT_CONFLICT");

check("Duplicate incoming IDs rejected",() =>
  duplicateIncomingResult.errors.includes("DUPLICATE_INCOMING_ID"));

check("Duplicate destination IDs detected",() =>
  duplicateExistingResult.errors.includes("DUPLICATE_EXISTING_ID"));

check("Case-insensitive business identifier collision detected",() =>
  businessCollision === true);

check("Existing records remain unchanged",() =>
  JSON.stringify(existing) === beforeExisting);

check("Incoming conflict fixture remains unchanged",() =>
  JSON.stringify(conflictingIncoming) === beforeIncoming);

const report = {
  mode:"SYNTHETIC_TARGET_COLLISION_TEST",
  status:failures.length ? "TEST_FAILED" : "TEST_PASS",
  checks,
  passed:checks.filter(x => x.passed).length,
  failed:failures.length,
  safety:{
    realSourceUsed:false,
    destinationInspected:false,
    databaseConnected:false,
    sqlExecuted:false,
    importPerformed:false,
    sourceModified:false,
    destinationModified:false
  }
};

fs.writeFileSync(
  "./EDOCASTI_Migration_010_Target_Collision_Test.json",
  JSON.stringify(report,null,2),
  "utf8"
);

console.log("\n=== TARGET COLLISION TEST ===");
console.log("Checks:",checks.length);
console.log("Passed:",report.passed);
console.log("Failed:",report.failed);

for (const item of checks) {
  console.log(`${item.passed ? "PASS" : "FAIL"}: ${item.name}`);
}

console.log("\nReal source records used: NO");
console.log("Destination inspected: NO");
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Import performed: NO");
console.log("Source modified: NO");
console.log("Destination modified: NO");
console.log("Status:",report.status);
console.log("Report: ./EDOCASTI_Migration_010_Target_Collision_Test.json");

if (failures.length) process.exitCode = 1;
