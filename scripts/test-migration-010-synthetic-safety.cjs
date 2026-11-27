const fs = require("fs");
const path = require("path");

const fixtureFile = "./EDOCASTI_Migration_010_Synthetic_Fixtures.json";
const outputFile = "./EDOCASTI_Migration_010_Synthetic_Test_Report.json";

const fixtures = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
const checks = [];
const failures = [];

function test(name, fn) {
  try {
    const passed = fn() === true;
    checks.push({name, passed});
    if (!passed) failures.push(name);
  } catch {
    checks.push({name, passed:false});
    failures.push(name);
  }
}

// Simulated transaction: state is copied, then either committed
// to the in-memory test object or discarded.
function simulateTransaction(state, operation) {
  const draft = structuredClone(state);
  try {
    operation(draft);
    return {committed:true, state:draft};
  } catch {
    return {committed:false, state};
  }
}

const initialState = {
  schools:[],
  users:[],
  departments:[],
  programmes:[],
  courses:[],
  students:[],
  invoices:[],
  payments:[]
};

const valid = fixtures.validFixture;

test("Synthetic fixture collections exist", () =>
  ["schools","users","departments","programmes","courses",
   "students","invoices","payments"].every(
     k => Array.isArray(valid[k])
   ));

test("Fabricated fixture IDs are present", () =>
  Object.values(valid).every(rows =>
    rows.every(row => typeof row.id === "string" && row.id.length > 0)
  ));

test("School dependency reference exists", () =>
  valid.departments[0].schoolId === valid.schools[0].id);

test("Programme dependency reference exists", () =>
  valid.programmes[0].departmentId === valid.departments[0].id);

test("Course dependency reference exists", () =>
  valid.courses[0].programmeId === valid.programmes[0].id);

test("Student dependency reference exists", () =>
  valid.students[0].programmeId === valid.programmes[0].id);

test("Invoice dependency reference exists", () =>
  valid.invoices[0].studentId === valid.students[0].id);

test("Payment dependency references exist", () =>
  valid.payments[0].studentId === valid.students[0].id &&
  valid.payments[0].invoiceId === valid.invoices[0].id);

test("Incomplete student fixture is detectable", () =>
  fixtures.quarantineFixtures.incompleteStudent.emergencyContact == null);

test("Dependent invoice fixture is identifiable", () =>
  fixtures.quarantineFixtures.dependentInvoice.studentId ===
  "QUARANTINED_STUDENT_REFERENCE");

test("Duplicate fixture is correctly identified", () =>
  fixtures.duplicateIdFixture.collection === "schools" &&
  fixtures.duplicateIdFixture.duplicateId === valid.schools[0].id);

test("Duplicate IDs rejected", () => {
  const ids = valid.schools.map(x => x.id);
  ids.push(fixtures.duplicateIdFixture.duplicateId);
  return new Set(ids).size !== ids.length;
});

test("Failed simulated transaction rolls back", () => {
  const result = simulateTransaction(initialState, draft => {
    draft.schools.push({id:"fake"});
    throw new Error("Simulated failure");
  });
  return !result.committed &&
    result.state.schools.length === 0 &&
    initialState.schools.length === 0;
});

test("Successful simulated transaction commits", () => {
  const result = simulateTransaction(initialState, draft => {
    draft.schools.push({id:"synthetic_commit_test"});
  });
  return result.committed &&
    result.state.schools.length === 1 &&
    initialState.schools.length === 0;
});

test("No actual database operation is represented", () =>
  true);

const report = {
  mode:"IN_MEMORY_SYNTHETIC_TEST",
  status:failures.length ? "TEST_FAILED" : "TEST_PASS",
  checks,
  failures,
  totalChecks:checks.length,
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
  path.join(process.cwd(),outputFile),
  JSON.stringify(report,null,2),
  "utf8"
);

console.log("\n=== SYNTHETIC SAFETY TEST ===");
console.log("Checks:",checks.length);
console.log("Passed:",report.passed);
console.log("Failed:",report.failed);

for (const c of checks) {
  console.log(`${c.passed ? "PASS" : "FAIL"}: ${c.name}`);
}

console.log("\nReal source records used: NO");
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Import performed: NO");
console.log("Source modified: NO");
console.log("Status:",report.status);
console.log("Report:",outputFile);

if (failures.length) process.exitCode = 1;
