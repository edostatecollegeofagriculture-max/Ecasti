const fs = require("fs");
const crypto = require("crypto");

const sourcePath = "./data/edocasti_db.json";
const migrationPath =
  "./database/migrations/010_core_entities_and_legacy_finance.sql";

const data = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const migration = fs.readFileSync(migrationPath, "utf8");

const definitions = {
  schools: {
    table: "schools",
    fields: {
      id: ["id", "string"],
      code: ["code", "string"],
      name: ["name", "string"],
      description: ["description", "string"],
      image_url: [null, "nullable"],
      dean_user_id: [null, "nullable"]
    }
  },
  users: {
    table: "users",
    fields: {
      id: ["id", "string"],
      email: ["email", "string"],
      password_hash: ["passwordHash", "string"],
      full_name: ["fullName", "string"],
      role: ["role", "string"],
      phone: ["phone", "nullable"],
      photo_url: ["photoUrl", "nullable"],
      is_active: ["isActive", "boolean"],
      is_locked: ["isLocked", "boolean"],
      failed_login_attempts: ["failedLoginAttempts", "number"],
      department_id: ["departmentId", "nullable"],
      school_id: ["schoolId", "nullable"],
      created_at: ["createdAt", "string"],
      last_login: ["lastLogin", "nullable"]
    }
  },
  departments: {
    table: "departments",
    fields: {
      id: ["id", "string"],
      school_id: ["schoolId", "string"],
      code: ["code", "string"],
      name: ["name", "string"],
      hod_user_id: [null, "nullable"]
    }
  },
  programmes: {
    table: "programmes",
    fields: {
      id: ["id", "string"],
      department_id: ["departmentId", "string"],
      code: ["code", "string"],
      name: ["name", "string"],
      qualification: ["qualification", "string"],
      duration_years: ["durationYears", "number"],
      description: ["description", "string"],
      requirements: ["requirements", "array"]
    }
  },
  courses: {
    table: "courses",
    fields: {
      id: ["id", "string"],
      department_id: ["departmentId", "string"],
      programme_id: ["programmeId", "nullable"],
      code: ["code", "string"],
      title: ["title", "string"],
      credit_units: ["creditUnits", "number"],
      level: ["level", "string"],
      semester: ["semester", "string"],
      lecturer_user_id: ["lecturerId", "nullable"],
      lecturer_name: ["lecturerName", "nullable"],
      is_compulsory: ["isCompulsory", "boolean"]
    }
  },
  applications: {
    table: "admission_applications",
    fields: {
      id: ["id", "string"],
      application_number: ["applicationNumber", "string"],
      user_id: ["userId", "string"],
      programme_id: ["programmeId", "string"],
      session: ["session", "string"],
      first_name: ["firstName", "string"],
      last_name: ["lastName", "string"],
      other_names: ["otherNames", "nullable"],
      gender: ["gender", "string"],
      date_of_birth: ["dob", "string"],
      phone: ["phone", "string"],
      email: ["email", "string"],
      photo_url: ["photoUrl", "nullable"],
      state_of_origin: ["stateOfOrigin", "string"],
      lga: ["lga", "string"],
      residential_address: ["residentialAddress", "string"],
      o_level_results: ["oLevelResults", "array"],
      status: ["status", "string"],
      screening_notes: ["screeningNotes", "nullable"],
      reviewer_user_id: [null, "nullable"],
      reviewer_display_snapshot: ["reviewedBy", "nullable"],
      submitted_at: ["submittedAt", "nullable"],
      decision_at: ["decisionAt", "nullable"],
      fee_activation_required_at: [null, "nullable"]
    }
  },
  students: {
    table: "students",
    fields: {
      id: ["id", "string"],
      matric_number: ["matricNumber", "string"],
      user_id: ["userId", "string"],
      photo_url: ["photoUrl", "nullable"],
      programme_id: ["programmeId", "string"],
      department_id: ["departmentId", "string"],
      school_id: ["schoolId", "string"],
      level: ["level", "string"],
      session_admitted: ["sessionAdmitted", "string"],
      academic_status: ["academicStatus", "string"],
      gender: ["gender", "string"],
      date_of_birth: ["dob", "string"],
      emergency_contact: ["emergencyContact", "string"],
      next_of_kin: ["nextOfKin", "string"],
      cgpa: ["cgpa", "number"],
      total_credits_earned: ["totalCreditsEarned", "number"]
    }
  },
  invoices: {
    table: "legacy_invoices",
    fields: {
      id: ["id", "string"],
      invoice_number: ["invoiceNumber", "string"],
      student_id: ["studentId", "string"],
      session: ["session", "string"],
      title: ["title", "string"],
      amount: ["amount", "number"],
      amount_paid: ["amountPaid", "number"],
      status: ["status", "string"],
      due_date: ["dueDate", "string"],
      created_at: ["createdAt", "string"]
    }
  },
  payments: {
    table: "legacy_payment_transactions",
    fields: {
      id: ["id", "string"],
      reference: ["reference", "string"],
      invoice_id: ["invoiceId", "string"],
      student_id: ["studentId", "string"],
      amount: ["amount", "number"],
      channel: ["channel", "string"],
      status: ["status", "string"],
      provider_reference: ["providerReference", "string"],
      paid_at: ["paidAt", "string"],
      verified_by_display: ["verifiedBy", "nullable"]
    }
  }
};

const enums = {
  "programmes.qualification": ["ND", "HND", "Certificate"],
  "courses.semester": ["First Semester", "Second Semester"],
  "applications.status": [
    "DRAFT", "SUBMITTED", "UNDER_REVIEW",
    "OFFERED", "ACCEPTED", "REJECTED"
  ],
  "students.academicStatus": [
    "Good Standing", "Probation", "Suspended", "Graduated"
  ],
  "invoices.status": ["UNPAID", "PARTIAL", "PAID"],
  "payments.channel": [
    "Remita", "Bank Transfer", "Interswitch", "Card"
  ],
  "payments.status": ["VERIFIED", "PENDING", "REJECTED"]
};

function kind(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function missing(v) {
  return v === undefined || v === null || v === "";
}

const report = {
  mode: "SOURCE_ONLY_READ_ONLY",
  sourceChecksum: crypto.createHash("sha256")
    .update(fs.readFileSync(sourcePath))
    .digest("hex"),
  migrationChecksum: crypto.createHash("sha256")
    .update(migration)
    .digest("hex"),
  collections: {},
  enumViolations: [],
  duplicateChecks: [],
  mappingWarnings: [],
  totals: {
    records: 0,
    requiredMissing: 0,
    typeMismatches: 0,
    unexpectedFields: 0
  }
};

for (const [collection, definition] of Object.entries(definitions)) {
  const rows = data[collection];

  if (!Array.isArray(rows)) {
    report.mappingWarnings.push(`${collection}: source collection is not an array`);
    continue;
  }

  const knownSourceFields = new Set(
    Object.values(definition.fields)
      .map(entry => entry[0])
      .filter(Boolean)
  );

  const missingFields = {};
  const typeMismatches = {};
  const unexpectedFields = new Set();

  for (const row of rows) {
    report.totals.records++;

    if (!row || typeof row !== "object" || Array.isArray(row)) {
      report.mappingWarnings.push(`${collection}: invalid record structure`);
      continue;
    }

    for (const field of Object.keys(row)) {
      if (!knownSourceFields.has(field)) {
        unexpectedFields.add(field);
      }
    }

    for (const [sqlField, [sourceField, expectedType]] of
      Object.entries(definition.fields)) {

      if (!sourceField) continue;

      const value = row[sourceField];

      if (missing(value)) {
        if (expectedType !== "nullable") {
          missingFields[sourceField] =
            (missingFields[sourceField] || 0) + 1;
        }
        continue;
      }

      const actualType = kind(value);

      if (
        expectedType !== "nullable" &&
        actualType !== expectedType
      ) {
        typeMismatches[sourceField] =
          (typeMismatches[sourceField] || 0) + 1;
      }
    }
  }

  const missingCount = Object.values(missingFields)
    .reduce((a, b) => a + b, 0);

  const mismatchCount = Object.values(typeMismatches)
    .reduce((a, b) => a + b, 0);

  report.totals.requiredMissing += missingCount;
  report.totals.typeMismatches += mismatchCount;
  report.totals.unexpectedFields += unexpectedFields.size;

  report.collections[collection] = {
    targetTable: definition.table,
    sourceRecords: rows.length,
    sqlColumnsMapped: Object.keys(definition.fields).length,
    missingRequiredFields: missingFields,
    typeMismatches,
    unexpectedSourceFields: [...unexpectedFields].sort()
  };
}

for (const [key, allowed] of Object.entries(enums)) {
  const [collection, field] = key.split(".");
  const rows = data[collection] || [];

  const invalidCount = rows.filter(
    row => !missing(row[field]) && !allowed.includes(row[field])
  ).length;

  report.enumViolations.push({
    field: key,
    invalidCount,
    allowedValues: allowed
  });
}

function duplicateCount(rows, keyFn) {
  const values = rows.map(keyFn).filter(v => v !== null && v !== "");
  return values.length - new Set(values).size;
}

const uniqueDefinitions = [
  ["schools.code", "schools", r => r.code],
  ["users.email (case-insensitive)", "users", r =>
    typeof r.email === "string" ? r.email.toLowerCase() : null],
  ["departments.schoolId + code", "departments", r =>
    `${r.schoolId}|${r.code}`],
  ["programmes.departmentId + code", "programmes", r =>
    `${r.departmentId}|${r.code}`],
  ["applications.applicationNumber", "applications", r => r.applicationNumber],
  ["students.matricNumber", "students", r => r.matricNumber],
  ["payments.reference", "payments", r => r.reference]
];

for (const [label, collection, keyFn] of uniqueDefinitions) {
  report.duplicateChecks.push({
    constraint: label,
    duplicateCount: duplicateCount(data[collection] || [], keyFn)
  });
}

const sourceHash = report.sourceChecksum;

const migrationHasExpectedTables = Object.values(definitions).every(
  definition => new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${definition.table}\\s*\\(`,
    "i"
  ).test(migration)
);

report.migrationContainsAllNineTables = migrationHasExpectedTables;

report.status =
  report.totals.requiredMissing > 0 ||
  report.totals.typeMismatches > 0 ||
  report.enumViolations.some(item => item.invalidCount > 0) ||
  report.duplicateChecks.some(item => item.duplicateCount > 0) ||
  !migrationHasExpectedTables
    ? "BLOCKED"
    : "REVIEW";

console.log("\nEDOCASTI FIELD COMPATIBILITY AUDIT\n");
console.log(JSON.stringify(report, null, 2));
console.log("\nFINAL STATUS:", report.status);
console.log("No database connection or writes were performed.");
