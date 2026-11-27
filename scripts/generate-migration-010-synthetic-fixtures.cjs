const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const id = prefix => prefix + "_" +
  crypto.randomBytes(6).toString("hex");

const schoolId = id("test_school");
const userId = id("test_user");
const departmentId = id("test_department");
const programmeId = id("test_programme");
const courseId = id("test_course");
const studentId = id("test_student");
const invoiceId = id("test_invoice");
const paymentId = id("test_payment");

const fixtures = {
  schools: [{
    id: schoolId,
    code: "SYN-SCH",
    name: "Synthetic Test School",
    description: "Fabricated test fixture"
  }],
  users: [{
    id: userId,
    fullName: "Synthetic Test User",
    email: "synthetic@example.invalid",
    role: "INSTITUTION_ADMIN",
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    schoolId,
    departmentId
  }],
  departments: [{
    id: departmentId,
    code: "SYN-DEP",
    name: "Synthetic Test Department",
    schoolId,
    hodUserId: userId
  }],
  programmes: [{
    id: programmeId,
    departmentId,
    code: "SYN-PROG",
    name: "Synthetic Test Programme",
    qualification: "ND",
    durationYears: 2,
    description: "Fabricated test fixture",
    requirements: []
  }],
  courses: [{
    id: courseId,
    departmentId,
    programmeId,
    code: "SYN-101",
    title: "Synthetic Test Course",
    creditUnits: 2,
    level: "ND I",
    semester: "First Semester",
    isCompulsory: true,
    lecturerId: userId,
    lecturerName: "Synthetic Test User"
  }],
  applications: [],
  students: [{
    id: studentId,
    userId,
    programmeId,
    schoolId,
    departmentId,
    matricNumber: "SYNTHETIC-001",
    level: "ND I",
    sessionAdmitted: "2026/2027",
    academicStatus: "ACTIVE",
    cgpa: 0,
    totalCreditsEarned: 0,
    dob: "2000-01-01",
    gender: "Other",
    emergencyContact: "Synthetic Contact",
    nextOfKin: "Synthetic Kin"
  }],
  invoices: [{
    id: invoiceId,
    studentId,
    invoiceNumber: "SYN-INV-001",
    title: "Synthetic Test Invoice",
    amount: 100,
    amountPaid: 0,
    status: "PENDING",
    session: "2026/2027",
    createdAt: "2026-01-01T00:00:00.000Z"
  }],
  payments: [{
    id: paymentId,
    studentId,
    invoiceId,
    amount: 100,
    reference: "SYN-PAY-001",
    providerReference: "SYN-PROV-001",
    channel: "TEST",
    status: "PENDING",
    verifiedBy: null
  }]
};

const tests = {
  validFixture: fixtures,
  quarantineFixtures: {
    incompleteStudent: {
      id: id("quarantine_student"),
      emergencyContact: null
    },
    dependentInvoice: {
      id: id("quarantine_invoice"),
      studentId: "QUARANTINED_STUDENT_REFERENCE"
    }
  },
  duplicateIdFixture: {
    collection: "schools",
    duplicateId: schoolId,
    description: "Must be rejected by the test importer"
  },
  expected: {
    validSchoolCount: 1,
    validUserCount: 1,
    validDepartmentCount: 1,
    validProgrammeCount: 1,
    validCourseCount: 1,
    validStudentCount: 1,
    validInvoiceCount: 1,
    validPaymentCount: 1,
    expectedQuarantineCount: 2,
    duplicateIdRejectionRequired: true
  }
};

const output = path.join(
  process.cwd(),
  "EDOCASTI_Migration_010_Synthetic_Fixtures.json"
);

fs.writeFileSync(output, JSON.stringify(tests, null, 2), "utf8");

console.log("=== SYNTHETIC FIXTURES ===");
console.log("Fixture file generated.");
console.log("Real source records used: NO");
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Import performed: NO");
console.log("Source modified: NO");
console.log("Report:", output);
