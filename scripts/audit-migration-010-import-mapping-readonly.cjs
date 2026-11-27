
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.cwd();
const sourceFile = path.join(root, "data", "edocasti_db.json");
const migrationFile = path.join(
  root,
  "database",
  "migrations",
  "010_core_entities_and_legacy_finance_RERUN_SAFE_REVIEW.sql"
);

const reportFile = path.join(
  root,
  "EDOCASTI_Migration_010_Import_Mapping_Audit.json"
);

if (!fs.existsSync(sourceFile)) throw new Error("Source JSON missing.");
if (!fs.existsSync(migrationFile)) throw new Error("Migration draft missing.");

const sourceText = fs.readFileSync(sourceFile, "utf8");
const migrationText = fs.readFileSync(migrationFile, "utf8");
const source = JSON.parse(sourceText);

const mappings = {
  schools: {
    table: "schools",
    fields: {
      id: "id",
      code: "code",
      name: "name",
      description: "description",
      imageUrl: "image_url"
    }
  },
  users: {
    table: "users",
    fields: {
      id: "id",
      email: "email",
      passwordHash: "password_hash",
      fullName: "full_name",
      role: "role",
      phone: "phone",
      photoUrl: "photo_url",
      isActive: "is_active",
      isLocked: "is_locked",
      failedLoginAttempts: "failed_login_attempts",
      departmentId: "department_id",
      schoolId: "school_id",
      createdAt: "created_at",
      lastLogin: "last_login"
    }
  },
  departments: {
    table: "departments",
    fields: {
      id: "id",
      schoolId: "school_id",
      code: "code",
      name: "name",
      hodUserId: "hod_user_id"
    }
  },
  programmes: {
    table: "programmes",
    fields: {
      id: "id",
      departmentId: "department_id",
      code: "code",
      name: "name",
      qualification: "qualification",
      durationYears: "duration_years",
      description: "description",
      requirements: "requirements"
    }
  },
  courses: {
    table: "courses",
    fields: {
      id: "id",
      departmentId: "department_id",
      programmeId: "programme_id",
      code: "code",
      title: "title",
      creditUnits: "credit_units",
      level: "level",
      semester: "semester",
      lecturerId: "lecturer_user_id",
      lecturerName: "lecturer_name",
      isCompulsory: "is_compulsory"
    }
  },
  applications: {
    table: "admission_applications",
    fields: {
      id: "id",
      applicationNumber: "application_number",
      userId: "user_id",
      programmeId: "programme_id",
      session: "session",
      firstName: "first_name",
      lastName: "last_name",
      otherNames: "other_names",
      gender: "gender",
      dob: "date_of_birth",
      phone: "phone",
      email: "email",
      photoUrl: "photo_url",
      stateOfOrigin: "state_of_origin",
      lga: "lga",
      residentialAddress: "residential_address",
      oLevelResults: "o_level_results",
      status: "status",
      screeningNotes: "screening_notes",
      reviewedBy: "reviewer_display_snapshot",
      submittedAt: "submitted_at",
      decisionAt: "decision_at",
      feeActivationRequiredAt: "fee_activation_required_at"
    }
  },
  students: {
    table: "students",
    fields: {
      id: "id",
      matricNumber: "matric_number",
      userId: "user_id",
      photoUrl: "photo_url",
      programmeId: "programme_id",
      departmentId: "department_id",
      schoolId: "school_id",
      level: "level",
      sessionAdmitted: "session_admitted",
      academicStatus: "academic_status",
      gender: "gender",
      dob: "date_of_birth",
      emergencyContact: "emergency_contact",
      nextOfKin: "next_of_kin",
      cgpa: "cgpa",
      totalCreditsEarned: "total_credits_earned"
    }
  },
  invoices: {
    table: "legacy_invoices",
    fields: {
      id: "id",
      studentId: "student_id",
      invoiceNumber: "invoice_number",
      title: "title",
      session: "session",
      amount: "amount",
      amountPaid: "amount_paid",
      dueDate: "due_date",
      status: "status",
      createdAt: "created_at"
    }
  },
  payments: {
    table: "legacy_payment_transactions",
    fields: {
      id: "id",
      invoiceId: "invoice_id",
      studentId: "student_id",
      reference: "reference",
      providerReference: "provider_reference",
      amount: "amount",
      channel: "channel",
      status: "status",
      paidAt: "paid_at",
      verifiedBy: "verified_by_display"
    }
  }
};

const requiredCollections = Object.keys(mappings);

function isBlank(v) {
  return v === undefined || v === null ||
    (typeof v === "string" && v.trim() === "");
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function collectionStats(collectionName) {
  const records = source[collectionName];

  if (!Array.isArray(records)) {
    return {
      present: false,
      isArray: false,
      count: 0
    };
  }

  return {
    present: true,
    isArray: true,
    count: records.length
  };
}

function fieldStats(collectionName, field) {
  const records = source[collectionName];

  if (!Array.isArray(records)) {
    return {
      total: 0,
      present: 0,
      missing: 0,
      null: 0,
      blank: 0,
      typeCounts: {}
    };
  }

  let present = 0;
  let missing = 0;
  let nullCount = 0;
  let blank = 0;
  const typeCounts = {};

  for (const record of records) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      missing++;
      typeCounts.missing = (typeCounts.missing || 0) + 1;
      continue;
    }

    present++;
    const v = record[field];

    if (v === null) {
      nullCount++;
      typeCounts.null = (typeCounts.null || 0) + 1;
    } else if (typeof v === "string" && v.trim() === "") {
      blank++;
      typeCounts.blank = (typeCounts.blank || 0) + 1;
    } else {
      const t = Array.isArray(v) ? "array" : typeof v;
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
  }

  return {
    total: records.length,
    present,
    missing,
    null: nullCount,
    blank,
    typeCounts
  };
}

function getSqlTableBody(tableName) {
  const pattern = new RegExp(
    "CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?" +
    "(?:public\\.)?" +
    tableName +
    "\\s*\\((.*?)\\)\\s*;",
    "is"
  );

  const match = migrationText.match(pattern);
  return match ? match[1] : null;
}
function getSqlColumns(tableName) {
  const body = getSqlTableBody(tableName);

  if (!body) return [];

  const columns = [];

  for (const line of body.split(/\r?\n/)) {
    const t = line.trim().replace(/,$/, "");

    if (!t) continue;

    if (/^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE\b|CHECK\b|EXCLUDE\b|REFERENCES\b)/i.test(t)) {
      continue;
    }

    const m = t.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+/);

    if (m) columns.push(m[1].toLowerCase());
  }

  return [...new Set(columns)].sort();
}

const collectionReports = [];
const unresolvedTargetColumns = [];
const missingCollections = [];

for (const collectionName of requiredCollections) {
  const mapping = mappings[collectionName];
  const stats = collectionStats(collectionName);

  if (!stats.present || !stats.isArray) {
    missingCollections.push(collectionName);
  }

  const targetColumns = getSqlColumns(mapping.table);
  const fieldReports = [];

  for (const [sourceField, targetColumn] of Object.entries(mapping.fields)) {
    const sourceStats = fieldStats(collectionName, sourceField);
    const targetExists = targetColumns.includes(targetColumn);

    if (!targetExists) {
      unresolvedTargetColumns.push({
        collection: collectionName,
        table: mapping.table,
        targetColumn
      });
    }

    fieldReports.push({
      sourceField,
      targetColumn,
      targetColumnExists: targetExists,
      sourceStats
    });
  }

  collectionReports.push({
    sourceCollection: collectionName,
    targetTable: mapping.table,
    sourceRecordCount: stats.count,
    targetColumns,
    fieldMappings: fieldReports
  });
}

const exceptions = [
  {
    collection: "applications",
    recordId: "app-1795622937861",
    field: "phone",
    reason: "Known missing authoritative source value",
    resolution: "Requires authoritative value or approved schema policy"
  },
  {
    collection: "students",
    recordId: "std-1795623290388",
    field: "emergencyContact",
    reason: "Known missing authoritative source value",
    resolution: "Requires authoritative value or approved schema policy"
  }
];

const orderingPlan = [
  "schools with leadership fields initially NULL",
  "departments with HOD initially NULL",
  "users with circular school/department assignments deferred",
  "update user school/department assignments",
  "programmes",
  "courses",
  "admission_applications",
  "students",
  "legacy_invoices",
  "legacy_payment_transactions"
];

const snapshotSemantics = [
  {
    sourceField: "applications.reviewedBy",
    targetColumn: "admission_applications.reviewer_display_snapshot",
    treatment: "Display snapshot; not converted to reviewer_user_id"
  },
  {
    sourceField: "payments.verifiedBy",
    targetColumn: "legacy_payment_transactions.verified_by_display",
    treatment: "Display snapshot; not converted to user foreign key"
  }
];

const report = {
  mode: "LOCAL_READ_ONLY_MAPPING_AUDIT",
  generatedAt: new Date().toISOString(),

  databaseConnected: false,
  sqlExecuted: false,
  sourceModified: false,
  importPerformed: false,

  files: {
    source: {
      file: "data/edocasti_db.json",
      sha256: hash(sourceText)
    },
    migration: {
      file: "database/migrations/010_core_entities_and_legacy_finance_RERUN_SAFE_REVIEW.sql",
      sha256: hash(migrationText)
    }
  },

  collections: collectionReports,
  missingCollections,
  unresolvedTargetColumns,

  knownExceptions: exceptions,
  circularReferenceOrderingPlan: orderingPlan,
  displaySnapshotMappings: snapshotSemantics,

  reviewWarnings: [
    "No importer was executed or evaluated at runtime.",
    "Field mapping coverage does not establish transformation correctness.",
    "The missing phone and emergency-contact values remain unresolved.",
    "Existing ID collisions and target-record equality remain untested.",
    "The ordering plan is conceptual and requires importer implementation review.",
    "Legacy feeSchedules are outside these nine target collections.",
    "The source-to-target mappings are proposed mappings, not verified transformations."
  ],

  status:
    missingCollections.length === 0 &&
    unresolvedTargetColumns.length === 0
      ? "MAPPING_STRUCTURE_PASS_REVIEW_REQUIRED"
      : "MAPPING_STRUCTURE_REVIEW"
};

fs.writeFileSync(
  reportFile,
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("\n=== MIGRATION 010 READ-ONLY MAPPING AUDIT ===");
console.log("Collections checked:", collectionReports.length);
console.log("Missing collections:", missingCollections.length);
console.log("Unresolved target columns:", unresolvedTargetColumns.length);
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Import performed: NO");
console.log("Source modified: NO");
console.log("Status:", report.status);
console.log("Report:", reportFile);

