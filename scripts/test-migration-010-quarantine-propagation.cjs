const fs = require("fs");

const checks = [];
const failures = [];

function check(name, fn) {
  let passed = false;
  try { passed = fn() === true; } catch {}
  checks.push({name,passed});
  if (!passed) failures.push(name);
}

// Fabricated graph only. No source file is loaded.
const records = {
  students: [
    {id:"S_VALID"},
    {id:"S_QUARANTINED"}
  ],
  invoices: [
    {id:"I_VALID",studentId:"S_VALID"},
    {id:"I_QUARANTINED",studentId:"S_QUARANTINED"}
  ],
  payments: [
    {id:"P_VALID",invoiceId:"I_VALID"},
    {id:"P_QUARANTINED",invoiceId:"I_QUARANTINED"}
  ]
};

const initialQuarantine = new Set(["S_QUARANTINED"]);

function propagate(records, initial) {
  const quarantined = new Set(initial);
  const reasons = new Map();

  for (const id of initial) {
    reasons.set(id,"INITIAL_QUARANTINE");
  }

  let changed = true;
  let iterations = 0;

  // Bounded propagation; fail closed if convergence is not reached.
  const maxIterations = 10;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const invoice of records.invoices) {
      if (quarantined.has(invoice.studentId) &&
          !quarantined.has(invoice.id)) {
        quarantined.add(invoice.id);
        reasons.set(invoice.id,"DEPENDENT_STUDENT_QUARANTINED");
        changed = true;
      }
    }

    for (const payment of records.payments) {
      if (quarantined.has(payment.invoiceId) &&
          !quarantined.has(payment.id)) {
        quarantined.add(payment.id);
        reasons.set(payment.id,"DEPENDENT_INVOICE_QUARANTINED");
        changed = true;
      }
    }
  }

  if (changed) {
    throw new Error("Propagation did not converge");
  }

  return {quarantined,reasons};
}

const result = propagate(records,initialQuarantine);

const eligible = {
  students: records.students.filter(x =>
    !result.quarantined.has(x.id)),
  invoices: records.invoices.filter(x =>
    !result.quarantined.has(x.id)),
  payments: records.payments.filter(x =>
    !result.quarantined.has(x.id))
};

check("Quarantined student remains quarantined",() =>
  result.quarantined.has("S_QUARANTINED"));

check("Dependent invoice quarantined",() =>
  result.quarantined.has("I_QUARANTINED"));

check("Dependent payment quarantined",() =>
  result.quarantined.has("P_QUARANTINED"));

check("Valid student remains eligible",() =>
  eligible.students.some(x => x.id === "S_VALID"));

check("Valid invoice remains eligible",() =>
  eligible.invoices.some(x => x.id === "I_VALID"));

check("Valid payment remains eligible",() =>
  eligible.payments.some(x => x.id === "P_VALID"));

check("Quarantined invoice excluded from eligible batch",() =>
  !eligible.invoices.some(x => x.id === "I_QUARANTINED"));

check("Quarantined payment excluded from eligible batch",() =>
  !eligible.payments.some(x => x.id === "P_QUARANTINED"));

check("Propagation reasons recorded",() =>
  result.reasons.get("I_QUARANTINED") ===
    "DEPENDENT_STUDENT_QUARANTINED" &&
  result.reasons.get("P_QUARANTINED") ===
    "DEPENDENT_INVOICE_QUARANTINED");

check("Eligible and quarantine sets do not overlap",() =>
  [...eligible.students,...eligible.invoices,...eligible.payments]
    .every(x => !result.quarantined.has(x.id)));

const report = {
  mode:"IN_MEMORY_SYNTHETIC_QUARANTINE_TEST",
  status:failures.length ? "TEST_FAILED" : "TEST_PASS",
  checks,
  passed:checks.filter(x => x.passed).length,
  failed:failures.length,
  safety:{
    realSourceUsed:false,
    databaseConnected:false,
    sqlExecuted:false,
    importPerformed:false,
    sourceModified:false
  }
};

fs.writeFileSync(
  "./EDOCASTI_Migration_010_Quarantine_Propagation_Test.json",
  JSON.stringify(report,null,2),
  "utf8"
);

console.log("\n=== QUARANTINE PROPAGATION TEST ===");
console.log("Checks:",checks.length);
console.log("Passed:",report.passed);
console.log("Failed:",report.failed);

for (const item of checks) {
  console.log(`${item.passed ? "PASS" : "FAIL"}: ${item.name}`);
}

console.log("\nReal source records used: NO");
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Import performed: NO");
console.log("Source modified: NO");
console.log("Status:",report.status);
console.log("Report: ./EDOCASTI_Migration_010_Quarantine_Propagation_Test.json");

if (failures.length) process.exitCode = 1;
