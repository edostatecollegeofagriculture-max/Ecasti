const fs = require("fs");

const checks = [];
const failures = [];

function check(name, fn) {
  let passed = false;
  try { passed = fn() === true; } catch {}
  checks.push({name,passed});
  if (!passed) failures.push(name);
}

function validate(data) {
  const errors = [];
  const quarantine = new Set();

  const collections = ["students","invoices","payments"];

  for (const collection of collections) {
    const seen = new Set();

    for (const record of data[collection]) {
      if (!record.id || seen.has(record.id)) {
        errors.push("DUPLICATE_OR_MISSING_ID:" + collection);
        quarantine.add(record.id);
      }
      seen.add(record.id);

      if (record.status !== "ELIGIBLE" &&
          record.status !== "QUARANTINED") {
        errors.push("UNKNOWN_STATUS:" + collection);
        quarantine.add(record.id);
      }

      if (record.status === "QUARANTINED") {
        quarantine.add(record.id);
      }
    }
  }

  const students = new Set(data.students.map(x => x.id));
  const invoices = new Set(data.invoices.map(x => x.id));

  for (const invoice of data.invoices) {
    if (!students.has(invoice.studentId)) {
      errors.push("ORPHAN_INVOICE");
      quarantine.add(invoice.id);
    }
    if (quarantine.has(invoice.studentId)) {
      quarantine.add(invoice.id);
    }
  }

  for (const payment of data.payments) {
    if (!invoices.has(payment.invoiceId)) {
      errors.push("ORPHAN_PAYMENT");
      quarantine.add(payment.id);
    }
    if (quarantine.has(payment.invoiceId)) {
      quarantine.add(payment.id);
    }
  }

  return {errors,quarantine};
}

const valid = {
  students:[{id:"S1",status:"ELIGIBLE"}],
  invoices:[{id:"I1",studentId:"S1",status:"ELIGIBLE"}],
  payments:[{id:"P1",invoiceId:"I1",status:"ELIGIBLE"}]
};

const orphanInvoice = {
  students:[],
  invoices:[{id:"I2",studentId:"MISSING_S",status:"ELIGIBLE"}],
  payments:[]
};

const orphanPayment = {
  students:[{id:"S3",status:"ELIGIBLE"}],
  invoices:[],
  payments:[{id:"P3",invoiceId:"MISSING_I",status:"ELIGIBLE"}]
};

const duplicate = {
  students:[
    {id:"S4",status:"ELIGIBLE"},
    {id:"S4",status:"ELIGIBLE"}
  ],
  invoices:[],
  payments:[]
};

const unknownStatus = {
  students:[{id:"S5",status:"UNRECOGNIZED"}],
  invoices:[],
  payments:[]
};

const propagation = {
  students:[{id:"S6",status:"QUARANTINED"}],
  invoices:[{id:"I6",studentId:"S6",status:"ELIGIBLE"}],
  payments:[{id:"P6",invoiceId:"I6",status:"ELIGIBLE"}]
};

const before = JSON.stringify(valid);

const validResult = validate(valid);
const invoiceResult = validate(orphanInvoice);
const paymentResult = validate(orphanPayment);
const duplicateResult = validate(duplicate);
const unknownResult = validate(unknownStatus);
const propagationResult = validate(propagation);

check("Valid dependency chain has no errors",() =>
  validResult.errors.length === 0);

check("Valid student invoice and payment remain eligible",() =>
  !validResult.quarantine.has("S1") &&
  !validResult.quarantine.has("I1") &&
  !validResult.quarantine.has("P1"));

check("Orphan invoice is blocked",() =>
  invoiceResult.errors.includes("ORPHAN_INVOICE") &&
  invoiceResult.quarantine.has("I2"));

check("Orphan payment is blocked",() =>
  paymentResult.errors.includes("ORPHAN_PAYMENT") &&
  paymentResult.quarantine.has("P3"));

check("Duplicate ID is rejected",() =>
  duplicateResult.errors.some(x =>
    x.startsWith("DUPLICATE_OR_MISSING_ID")));

check("Unknown dependency state fails closed",() =>
  unknownResult.errors.includes("UNKNOWN_STATUS:students") &&
  unknownResult.quarantine.has("S5"));

check("Quarantine propagates through valid dependency chain",() =>
  propagationResult.quarantine.has("S6") &&
  propagationResult.quarantine.has("I6") &&
  propagationResult.quarantine.has("P6"));

check("Original valid fixture remains unchanged",() =>
  JSON.stringify(valid) === before);

const report = {
  mode:"SYNTHETIC_DEPENDENCY_INTEGRITY_TEST",
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
  "./EDOCASTI_Migration_010_Dependency_Integrity_Test.json",
  JSON.stringify(report,null,2),
  "utf8"
);

console.log("\n=== DEPENDENCY INTEGRITY TEST ===");
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
console.log("Report: ./EDOCASTI_Migration_010_Dependency_Integrity_Test.json");

if (failures.length) process.exitCode = 1;
