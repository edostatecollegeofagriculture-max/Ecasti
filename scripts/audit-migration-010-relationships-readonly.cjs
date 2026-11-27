const fs = require("fs");

const d = JSON.parse(
  fs.readFileSync("./data/edocasti_db.json", "utf8")
);

const collections = [
  "schools", "users", "departments", "programmes",
  "courses", "applications", "students", "invoices", "payments"
];

const indexes = {};
for (const name of collections) {
  const rows = d[name];
  if (!Array.isArray(rows)) {
    throw new Error(`Invalid or missing collection: ${name}`);
  }
  indexes[name] = new Map(rows.map(row => [row.id, row]));
}

const report = {
  mode: "SOURCE_ONLY_READ_ONLY",
  checks: [],
  missingReferences: [],
  hierarchyMismatches: [],
  optionalLeadershipFields: [],
  totals: {}
};

function checkReference(source, target, targetField = "id") {
  let checked = 0;

  for (const row of source.rows) {
    const value = row[source.field];

    if (value === undefined || value === null || value === "") {
      if (source.optional) continue;
      report.missingReferences.push({
        collection: source.name,
        recordId: row.id,
        field: source.field,
        issue: "REQUIRED_REFERENCE_EMPTY"
      });
      continue;
    }

    checked++;

    if (!target.has(value)) {
      report.missingReferences.push({
        collection: source.name,
        recordId: row.id,
        field: source.field,
        issue: "REFERENCED_RECORD_NOT_FOUND"
      });
    }
  }

  report.checks.push({
    relationship: `${source.name}.${source.field} -> ${source.target}`,
    recordsChecked: checked
  });
}

const relations = [
  ["departments", "schoolId", "schools", false],
  ["users", "departmentId", "departments", true],
  ["users", "schoolId", "schools", true],
  ["programmes", "departmentId", "departments", false],
  ["courses", "departmentId", "departments", false],
  ["courses", "programmeId", "programmes", true],
  ["courses", "lecturerId", "users", true],
  ["applications", "userId", "users", false],
  ["applications", "programmeId", "programmes", false],
  ["students", "userId", "users", false],
  ["students", "programmeId", "programmes", false],
  ["students", "departmentId", "departments", false],
  ["students", "schoolId", "schools", false],
  ["invoices", "studentId", "students", false],
  ["payments", "studentId", "students", false],
  ["payments", "invoiceId", "invoices", false]
];

for (const [name, field, targetName, optional] of relations) {
  checkReference(
    { name, field, target: targetName, rows: d[name], optional },
    indexes[targetName]
  );
}

// Check department -> school consistency for programmes.
for (const programme of d.programmes) {
  const department = indexes.departments.get(programme.departmentId);
  if (!department) continue;

  if (!indexes.schools.has(department.schoolId)) continue;
}

// A course with a programme should belong to that programme's department.
for (const course of d.courses) {
  if (!course.programmeId) continue;

  const programme = indexes.programmes.get(course.programmeId);
  if (!programme) continue;

  if (course.departmentId !== programme.departmentId) {
    report.hierarchyMismatches.push({
      collection: "courses",
      recordId: course.id,
      issue: "COURSE_PROGRAMME_DEPARTMENT_MISMATCH"
    });
  }
}

// A student's department and school should match the assigned programme.
for (const student of d.students) {
  const programme = indexes.programmes.get(student.programmeId);
  const department = indexes.departments.get(student.departmentId);

  if (programme && student.departmentId !== programme.departmentId) {
    report.hierarchyMismatches.push({
      collection: "students",
      recordId: student.id,
      issue: "STUDENT_PROGRAMME_DEPARTMENT_MISMATCH"
    });
  }

  if (department && student.schoolId !== department.schoolId) {
    report.hierarchyMismatches.push({
      collection: "students",
      recordId: student.id,
      issue: "STUDENT_DEPARTMENT_SCHOOL_MISMATCH"
    });
  }
}

// Check user department/school combinations where both are supplied.
for (const user of d.users) {
  if (!user.departmentId || !user.schoolId) continue;

  const department = indexes.departments.get(user.departmentId);
  if (department && department.schoolId !== user.schoolId) {
    report.hierarchyMismatches.push({
      collection: "users",
      recordId: user.id,
      issue: "USER_DEPARTMENT_SCHOOL_MISMATCH"
    });
  }
}

// Check that every payment belongs to the same student as its invoice.
for (const payment of d.payments) {
  const invoice = indexes.invoices.get(payment.invoiceId);

  if (invoice && invoice.studentId !== payment.studentId) {
    report.hierarchyMismatches.push({
      collection: "payments",
      recordId: payment.id,
      issue: "PAYMENT_INVOICE_STUDENT_MISMATCH"
    });
  }
}

// These leadership columns exist in SQL but have no source properties.
report.optionalLeadershipFields = [
  {
    sourceCollection: "schools",
    sourceField: "deanUserId",
    targetColumn: "schools.dean_user_id",
    treatment: "NULL - NO SOURCE FIELD"
  },
  {
    sourceCollection: "departments",
    sourceField: "hodUserId",
    targetColumn: "departments.hod_user_id",
    treatment: "NULL - NO SOURCE FIELD"
  }
];

report.totals = {
  sourceRecords: collections.reduce(
    (sum, name) => sum + d[name].length, 0
  ),
  relationshipsChecked: report.checks.length,
  missingReferences: report.missingReferences.length,
  hierarchyMismatches: report.hierarchyMismatches.length
};

report.status =
  report.missingReferences.length ||
  report.hierarchyMismatches.length
    ? "BLOCKED"
    : "REVIEW";

console.log("\nEDOCASTI RELATIONSHIP AUDIT\n");
console.log(JSON.stringify(report, null, 2));
console.log("\nFINAL STATUS:", report.status);
console.log("No database connection or writes were performed.");


