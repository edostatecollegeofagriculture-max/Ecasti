const fs = require("fs");

const d = JSON.parse(fs.readFileSync("./data/edocasti_db.json", "utf8"));

const report = {
  mode: "SOURCE_ONLY_READ_ONLY",
  numericChecks: [],
  dateChecks: [],
  blankRequiredFields: [],
  businessRuleWarnings: [],
  circularReferencePlan: {},
  totals: {}
};

function addNumeric(collection, field, options) {
  const rows = d[collection] || [];
  let invalidType = 0;
  let invalidInteger = 0;
  let invalidRange = 0;
  let invalidPrecision = 0;

  for (const row of rows) {
    const value = row[field];

    if (value === undefined || value === null || value === "") continue;

    if (typeof value !== "number" || !Number.isFinite(value)) {
      invalidType++;
      continue;
    }

    if (options.integer && !Number.isInteger(value)) invalidInteger++;
    if (options.min !== undefined && value < options.min) invalidRange++;
    if (options.max !== undefined && value > options.max) invalidRange++;

    if (options.scale !== undefined) {
      const scaled = value * (10 ** options.scale);
      if (Math.abs(scaled - Math.round(scaled)) > 1e-7) {
        invalidPrecision++;
      }
    }
  }

  report.numericChecks.push({
    field: `${collection}.${field}`,
    records: rows.length,
    invalidType,
    invalidInteger,
    invalidRange,
    invalidPrecision
  });
}

function addDate(collection, field, required = false) {
  const rows = d[collection] || [];
  let missing = 0;
  let invalid = 0;
  let checked = 0;

  for (const row of rows) {
    const value = row[field];

    if (value === undefined || value === null ||
        (typeof value === "string" && value.trim() === "")) {
      if (required) missing++;
      continue;
    }

    checked++;

    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
      invalid++;
    }
  }

  report.dateChecks.push({
    field: `${collection}.${field}`,
    checked,
    missingRequired: missing,
    unparseable: invalid
  });
}

const requiredStrings = {
  schools: ["id", "code", "name", "description"],
  users: ["id", "email", "passwordHash", "fullName", "role", "createdAt"],
  departments: ["id", "schoolId", "code", "name"],
  programmes: ["id", "departmentId", "code", "name", "qualification", "description"],
  courses: ["id", "departmentId", "code", "title", "level", "semester"],
  applications: [
    "id", "applicationNumber", "userId", "programmeId", "session",
    "firstName", "lastName", "gender", "dob", "phone", "email",
    "stateOfOrigin", "lga", "residentialAddress", "status"
  ],
  students: [
    "id", "matricNumber", "userId", "programmeId", "departmentId",
    "schoolId", "level", "sessionAdmitted", "academicStatus",
    "gender", "dob", "emergencyContact", "nextOfKin"
  ],
  invoices: [
    "id", "invoiceNumber", "studentId", "session", "title",
    "status", "dueDate", "createdAt"
  ],
  payments: [
    "id", "reference", "invoiceId", "studentId",
    "channel", "status", "paidAt"
  ]
};

for (const [collection, fields] of Object.entries(requiredStrings)) {
  for (const field of fields) {
    for (const row of d[collection] || []) {
      const value = row[field];

      if (typeof value !== "string" || value.trim() === "") {
        report.blankRequiredFields.push({
          collection,
          recordId: row.id,
          field,
          state: value === undefined ? "MISSING" :
            value === null ? "NULL" :
            typeof value !== "string" ? "NOT_STRING" : "EMPTY_OR_WHITESPACE"
        });
      }
    }
  }
}

addNumeric("users", "failedLoginAttempts", {
  integer: true, min: 0, max: 2147483647
});
addNumeric("programmes", "durationYears", {
  integer: true, min: 1, max: 2147483647
});
addNumeric("courses", "creditUnits", {
  integer: true, min: 1, max: 2147483647
});
addNumeric("students", "cgpa", {
  min: -999.999, max: 999.999, scale: 3
});
addNumeric("students", "totalCreditsEarned", {
  integer: true, min: 0, max: 2147483647
});
addNumeric("invoices", "amount", {
  min: 0, max: 9999999999.99, scale: 2
});
addNumeric("invoices", "amountPaid", {
  min: 0, max: 9999999999.99, scale: 2
});
addNumeric("payments", "amount", {
  min: 0, max: 9999999999.99, scale: 2
});

addDate("users", "createdAt", true);
addDate("users", "lastLogin");
addDate("applications", "dob", true);
addDate("applications", "submittedAt");
addDate("applications", "decisionAt");
addDate("applications", "feeActivationRequiredAt");
addDate("students", "dob", true);
addDate("invoices", "dueDate", true);
addDate("invoices", "createdAt", true);
addDate("payments", "paidAt", true);

// Check JSONB arrays and the two existing amount relationships.
for (const [collection, field] of [
  ["programmes", "requirements"],
  ["applications", "oLevelResults"]
]) {
  let invalid = 0;
  for (const row of d[collection] || []) {
    if (!Array.isArray(row[field])) invalid++;
  }
  report.businessRuleWarnings.push({
    check: `${collection}.${field} must be a JSON array`,
    invalidCount: invalid
  });
}

for (const invoice of d.invoices || []) {
  if (typeof invoice.amount === "number" &&
      typeof invoice.amountPaid === "number" &&
      invoice.amountPaid > invoice.amount) {
    report.businessRuleWarnings.push({
      check: "Invoice amountPaid exceeds amount",
      recordId: invoice.id
    });
  }
}

// Circular foreign-key handling: no constraints need to be disabled.
report.circularReferencePlan = {
  phase1: "Insert schools with dean_user_id = NULL",
  phase2: "Insert departments with hod_user_id = NULL",
  phase3: "Insert users with department_id and school_id = NULL",
  phase4: "Update users with validated department_id and school_id",
  phase5: "Update schools.dean_user_id and departments.hod_user_id only if authoritative source assignments exist",
  remaining: "Insert programmes, courses, applications, students, invoices and payments in dependency order",
  foreignKeys: "Remain enabled throughout"
};

const numericFailures = report.numericChecks.reduce(
  (sum, item) => sum + item.invalidType + item.invalidInteger +
    item.invalidRange + item.invalidPrecision, 0
);

const dateFailures = report.dateChecks.reduce(
  (sum, item) => sum + item.unparseable, 0
);

const missingDates = report.dateChecks.reduce(
  (sum, item) => sum + item.missingRequired, 0
);

report.totals = {
  numericFieldsChecked: report.numericChecks.length,
  numericFailures,
  dateFieldsChecked: report.dateChecks.length,
  unparseableDates: dateFailures,
  missingRequiredDates: missingDates,
  blankRequiredFields: report.blankRequiredFields.length
};

report.status =
  numericFailures || dateFailures || missingDates ||
  report.blankRequiredFields.length
    ? "BLOCKED"
    : "REVIEW";

console.log("\nEDOCASTI SQL CONSTRAINT AUDIT\n");
console.log(JSON.stringify(report, null, 2));
console.log("\nFINAL STATUS:", report.status);
console.log("No database connection or writes were performed.");
