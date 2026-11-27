// Migration 010 transformation validation.
// LOCAL FILE ONLY: no DB connections, SQL execution or source edits.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.cwd();
const sourceFile = path.join(root, "data/edocasti_db.json");
const sqlFile = path.join(root, "database/migrations/010_core_entities_and_legacy_finance_RERUN_SAFE_REVIEW.sql");
const outputFile = path.join(root, "EDOCASTI_Migration_010_Transformation_Validation.json");

const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const blank = v => typeof v === "string" && v.trim() === "";
const absent = v => v === undefined || v === null || blank(v);

const maps = {
  schools: ["id","code","name","description","imageUrl"],
  users: ["id","email","passwordHash","fullName","role","phone","photoUrl","isActive","isLocked","failedLoginAttempts","departmentId","schoolId","createdAt","lastLogin"],
  departments: ["id","schoolId","code","name","hodUserId"],
  programmes: ["id","departmentId","code","name","qualification","durationYears","description","requirements"],
  courses: ["id","departmentId","programmeId","code","title","creditUnits","level","semester","lecturerId","lecturerName","isCompulsory"],
  applications: ["id","applicationNumber","userId","programmeId","session","firstName","lastName","otherNames","gender","dob","phone","email","photoUrl","stateOfOrigin","lga","residentialAddress","oLevelResults","status","screeningNotes","reviewedBy","submittedAt","decisionAt","feeActivationRequiredAt"],
  students: ["id","matricNumber","userId","photoUrl","programmeId","departmentId","schoolId","level","sessionAdmitted","academicStatus","gender","dob","emergencyContact","nextOfKin","cgpa","totalCreditsEarned"],
  invoices: ["id","studentId","invoiceNumber","title","session","amount","amountPaid","dueDate","status","createdAt"],
  payments: ["id","invoiceId","studentId","reference","providerReference","amount","channel","status","paidAt","verifiedBy"]
};

const target = {
  schools: "schools",
  users: "users",
  departments: "departments",
  programmes: "programmes",
  courses: "courses",
  applications: "admission_applications",
  students: "students",
  invoices: "legacy_invoices",
  payments: "legacy_payment_transactions"
};

const columns = {
  schools: ["id","code","name","description","image_url"],
  users: ["id","email","password_hash","full_name","role","phone","photo_url","is_active","is_locked","failed_login_attempts","department_id","school_id","created_at","last_login"],
  departments: ["id","school_id","code","name","hod_user_id"],
  programmes: ["id","department_id","code","name","qualification","duration_years","description","requirements"],
  courses: ["id","department_id","programme_id","code","title","credit_units","level","semester","lecturer_user_id","lecturer_name","is_compulsory"],
  applications: ["id","application_number","user_id","programme_id","session","first_name","last_name","other_names","gender","date_of_birth","phone","email","photo_url","state_of_origin","lga","residential_address","o_level_results","status","screening_notes","reviewer_user_id","reviewer_display_snapshot","submitted_at","decision_at","fee_activation_required_at"],
  students: ["id","matric_number","user_id","photo_url","programme_id","department_id","school_id","level","session_admitted","academic_status","gender","date_of_birth","emergency_contact","next_of_kin","cgpa","total_credits_earned"],
  invoices: ["id","student_id","invoice_number","title","session","amount","amount_paid","due_date","status","created_at"],
  payments: ["id","invoice_id","student_id","reference","provider_reference","amount","channel","status","paid_at","verified_by_display"]
};

const fieldTarget = {
  schools: {imageUrl:"image_url"},
  users: {passwordHash:"password_hash",fullName:"full_name",photoUrl:"photo_url",isActive:"is_active",isLocked:"is_locked",failedLoginAttempts:"failed_login_attempts",departmentId:"department_id",schoolId:"school_id",createdAt:"created_at",lastLogin:"last_login"},
  departments: {schoolId:"school_id",hodUserId:"hod_user_id"},
  programmes: {departmentId:"department_id",durationYears:"duration_years"},
  courses: {departmentId:"department_id",programmeId:"programme_id",creditUnits:"credit_units",lecturerId:"lecturer_user_id",lecturerName:"lecturer_name",isCompulsory:"is_compulsory"},
  applications: {photoUrl:"photo_url",applicationNumber:"application_number",userId:"user_id",programmeId:"programme_id",firstName:"first_name",lastName:"last_name",otherNames:"other_names",dob:"date_of_birth",stateOfOrigin:"state_of_origin",residentialAddress:"residential_address",oLevelResults:"o_level_results",screeningNotes:"screening_notes",reviewedBy:"reviewer_display_snapshot",submittedAt:"submitted_at",decisionAt:"decision_at",feeActivationRequiredAt:"fee_activation_required_at"},
  students: {matricNumber:"matric_number",userId:"user_id",photoUrl:"photo_url",programmeId:"programme_id",departmentId:"department_id",schoolId:"school_id",sessionAdmitted:"session_admitted",academicStatus:"academic_status",dob:"date_of_birth",emergencyContact:"emergency_contact",nextOfKin:"next_of_kin",totalCreditsEarned:"total_credits_earned"},
  invoices: {studentId:"student_id",invoiceNumber:"invoice_number",amountPaid:"amount_paid",dueDate:"due_date",createdAt:"created_at"},
  payments: {invoiceId:"invoice_id",studentId:"student_id",providerReference:"provider_reference",paidAt:"paid_at",verifiedBy:"verified_by_display"}
};

const required = {
  schools:["id","code","name"],
  users:["id","email","password_hash","full_name","role","is_active","is_locked","failed_login_attempts","created_at"],
  departments:["id","school_id","code","name"],
  programmes:["id","department_id","code","name","qualification","duration_years","requirements"],
  courses:["id","department_id","code","title","credit_units","level","semester","is_compulsory"],
  applications:["id","application_number","user_id","programme_id","session","first_name","last_name","gender","date_of_birth","phone","email","state_of_origin","lga","residential_address","o_level_results","status"],
  students:["id","matric_number","user_id","programme_id","department_id","school_id","level","session_admitted","academic_status","gender","date_of_birth","emergency_contact","next_of_kin","cgpa","total_credits_earned"],
  invoices:["id","student_id","invoice_number","title","session","amount","amount_paid","status","created_at"],
  payments:["id","invoice_id","student_id","reference","amount","channel","status"]
};

function sqlBody(sql, table) {
  const re = new RegExp(
    "CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?" +
    "(?:public\\.)?" + table + "\\s*\\((.*?)\\)\\s*;", "is"
  );
  const m = sql.match(re);
  return m ? m[1] : null;
}

function main() {
  const srcBytes = fs.readFileSync(sourceFile);
  const sqlBytes = fs.readFileSync(sqlFile);
  const data = JSON.parse(srcBytes.toString("utf8"));
  const sql = sqlBytes.toString("utf8");

  const findings = [];
  const summaries = [];
  let totalRecords = 0;
  let mappedFields = 0;

  for (const collection of Object.keys(maps)) {
    const rows = data[collection];
    if (!Array.isArray(rows)) {
      findings.push({type:"BLOCK",collection,reason:"Collection is not an array"});
      continue;
    }

    totalRecords += rows.length;
    const table = target[collection];
    const body = sqlBody(sql, table);

    if (!body) {
      findings.push({type:"BLOCK",collection,reason:"Table definition not found"});
      continue;
    }

    const targetCols = columns[collection];
    const mappings = fieldTarget[collection] || {};
    const missingRequired = [];
    const optionalGaps = [];
    let duplicateIDs = 0;

    for (const field of maps[collection]) {
      mappedFields++;
      const col = mappings[field] || field;

      if (!targetCols.includes(col)) {
        findings.push({type:"BLOCK",collection,field,reason:"Target column not recognized"});
      }

      let gaps = 0;
      for (const row of rows) {
        if (absent(row[field])) gaps++;
      }

      if (gaps > 0) {
        if ((required[collection] || []).includes(col)) {
          missingRequired.push({field,count:gaps});
        } else {
          optionalGaps.push({field,count:gaps});
        }
      }
    }

    for (const col of required[collection] || []) {
      if (!targetCols.includes(col)) {
        findings.push({type:"BLOCK",collection,reason:"Required target column absent from mapping",column:col});
      }
    }

    const seen = new Set();
    for (const row of rows) {
      if (absent(row.id)) continue;
      if (seen.has(String(row.id))) duplicateIDs++;
      seen.add(String(row.id));
    }

    if (duplicateIDs) {
      findings.push({type:"BLOCK",collection,reason:"Duplicate source IDs",count:duplicateIDs});
    }

    for (const f of missingRequired) {
      findings.push({type:"BLOCK",collection,reason:"Required source value missing",field:f.field,count:f.count});
    }

    summaries.push({
      collection,
      records:rows.length,
      mappedFields:maps[collection].length,
      missingRequired,
      optionalGaps,
      duplicateIDs
    });
  }

  const report = {
    mode:"LOCAL_FILE_ONLY",
    status:findings.length===0?"PASS_REVIEW_REQUIRED":"BLOCKED",
    sourceHash:sha(srcBytes),
    migrationHash:sha(sqlBytes),
    totals:{collections:summaries.length,records:totalRecords,mappedFields,findings:findings.length},
    summaries,
    findings,
    limitations:[
      "No database connected.",
      "Existing target collisions cannot be checked.",
      "No SQL executed or import performed.",
      "This report validates field coverage only; transformations require separate review."
    ],
    safety:{databaseConnected:false,sqlExecuted:false,importPerformed:false,sourceModified:false}
  };

  fs.writeFileSync(outputFile,JSON.stringify(report,null,2),"utf8");

  console.log("\n=== TRANSFORMATION VALIDATION ===");
  console.log("Collections:",summaries.length);
  console.log("Records:",totalRecords);
  console.log("Mapped fields:",mappedFields);
  console.log("Findings:",findings.length);
  console.log("Database connected: NO");
  console.log("SQL executed: NO");
  console.log("Import performed: NO");
  console.log("Source modified: NO");
  console.log("Status:",report.status);
  console.log("Report:",outputFile);
}

main();
