var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var apiRouter_exports = {};
__export(apiRouter_exports, {
  apiRouter: () => apiRouter
});
module.exports = __toCommonJS(apiRouter_exports);
var import_express = require("express");
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_db = require("./db");
var import_authMiddleware = require("./authMiddleware");
var import_feeAdmissionLedgerService = require("./feeAdmissionLedgerService");
var import_academicProgressionService = require("./academicProgressionService");
var import_academicProgressionApiRouter = require("./academicProgressionApiRouter");
var import_documentsApiRouter = require("./documentsApiRouter");
var import_academicResultNeonService = require("./academicResultNeonService");
var import_resultApprovalAuthorization = require("./resultApprovalAuthorization");
var import_demoDataService = require("./demoDataService");
var import_demoDataAuthorization = require("./demoDataAuthorization");
const apiRouter = (0, import_express.Router)();
apiRouter.use("/academic-progression", import_academicProgressionApiRouter.academicProgressionApiRouter);
apiRouter.use("/documents-v2", import_documentsApiRouter.documentsApiRouter);
const requireExactSuperAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required." });
  if (!(0, import_demoDataAuthorization.canManageStagingDemoData)(req.user.role)) return res.status(403).json({ success: false, message: "Only the SUPER_ADMIN role may manage staging demo data." });
  return next();
};
const superAdminOnly = [import_authMiddleware.authenticateToken, requireExactSuperAdmin];
apiRouter.get("/staging/demo-data/status", ...superAdminOnly, (_req, res) => {
  try {
    return res.json((0, import_demoDataService.getDemoSeedStatus)());
  } catch (error) {
    return res.status(403).json({ success: false, message: error instanceof Error ? error.message : "Demo data controls unavailable." });
  }
});
apiRouter.post("/staging/demo-data/seed", ...superAdminOnly, (req, res) => {
  try {
    return res.json((0, import_demoDataService.seedDemoAcademicData)({ id: req.user.id, email: req.user.email }));
  } catch (error) {
    return res.status(409).json({ success: false, message: error instanceof Error ? error.message : "Unable to seed demo data." });
  }
});
apiRouter.post("/staging/demo-data/unseed", ...superAdminOnly, (req, res) => {
  try {
    return res.json((0, import_demoDataService.unseedDemoAcademicData)({ id: req.user.id, email: req.user.email }));
  } catch (error) {
    return res.status(409).json({ success: false, message: error instanceof Error ? error.message : "Unable to unseed demo data." });
  }
});
apiRouter.post("/staging/demo-data/preserve-student-cleanup", ...superAdminOnly, (req, res) => {
  try {
    return res.json((0, import_demoDataService.preserveEditedDemoStudentAndClean)({ id: req.user.id, email: req.user.email }));
  } catch (error) {
    return res.status(409).json({ success: false, message: error instanceof Error ? error.message : "Unable to safely clean demo data." });
  }
});
apiRouter.get(
  "/academic-progression/students/:studentId/eligibility",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)(
    "SUPER_ADMIN",
    "INSTITUTION_ADMIN",
    "REGISTRAR",
    "RECTOR"
  ),
  (req, res) => {
    try {
      const eligibility = (0, import_academicProgressionService.evaluateNdGraduationEligibility)(
        import_db.db.getState(),
        String(req.params.studentId)
      );
      return res.json({
        success: true,
        eligibility
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to evaluate eligibility.";
      const status = message === "Student record not found." ? 404 : 500;
      return res.status(status).json({
        success: false,
        message
      });
    }
  }
);
apiRouter.get("/search", import_authMiddleware.authenticateToken, (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"), (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const state = import_db.db.getState();
  const matchedStudents = state.students.map((s) => {
    const u = state.users.find((user) => user.id === s.userId);
    const prog = state.programmes.find((p) => p.id === s.programmeId);
    return {
      id: s.id,
      matricNumber: s.matricNumber,
      fullName: u?.fullName || "Student",
      email: u?.email || "",
      programmeName: prog?.name || "",
      level: s.level,
      cgpa: s.cgpa,
      type: "STUDENT"
    };
  }).filter(
    (s) => !q || s.fullName.toLowerCase().includes(q) || s.matricNumber.toLowerCase().includes(q) || s.programmeName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  ).slice(0, 6);
  const matchedApplicants = state.applications.map((a) => {
    const prog = state.programmes.find((p) => p.id === a.programmeId);
    return {
      id: a.id,
      applicationNumber: a.applicationNumber,
      fullName: `${a.firstName} ${a.lastName}`,
      email: a.email,
      programmeName: prog?.name || "",
      status: a.status,
      type: "APPLICANT"
    };
  }).filter(
    (a) => !q || a.fullName.toLowerCase().includes(q) || a.applicationNumber.toLowerCase().includes(q) || a.programmeName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
  ).slice(0, 6);
  const matchedCourses = state.courses.filter(
    (c) => !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.lecturerName?.toLowerCase().includes(q)
  ).slice(0, 6).map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    creditUnits: c.creditUnits,
    level: c.level,
    semester: c.semester,
    lecturerName: c.lecturerName,
    type: "COURSE"
  }));
  const standardDocuments = [
    {
      id: "doc-admission",
      title: "Provisional Offer of Admission Letter",
      category: "Admissions Office",
      slipType: "ADMISSION_LETTER",
      description: "Official letter for accepted candidates with security seal",
      type: "DOCUMENT"
    },
    {
      id: "doc-reg",
      title: "Course Registration & Examination Clearance Slip",
      category: "Academic Registry",
      slipType: "COURSE_REGISTRATION",
      description: "Semester approved course enrollment signed by HOD",
      type: "DOCUMENT"
    },
    {
      id: "doc-receipt",
      title: "Official Bursary Electronic Payment Receipt",
      category: "Bursary & Accounts",
      slipType: "PAYMENT_RECEIPT",
      description: "Verified Remita payment acknowledgment and clearance slip",
      type: "DOCUMENT"
    },
    {
      id: "doc-result",
      title: "Official Statement of Academic Results / Transcript",
      category: "Examination Office",
      slipType: "RESULT_SLIP",
      description: "Senate moderated semester grades and CGPA transcript",
      type: "DOCUMENT"
    },
    {
      id: "doc-idcard",
      title: "Student Identity Card Credential",
      category: "Security & Registry",
      slipType: "STUDENT_ID",
      description: "Digital institutional barcode ID card",
      type: "DOCUMENT"
    }
  ].filter(
    (d) => !q || d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
  );
  const portalSections = [
    { title: "Public College Overview", tab: "public", subSection: "overview", description: "About EDOCASTI, schools, mission and campuses" },
    { title: "Schools & Academic Programmes", tab: "public", subSection: "programmes", description: "Agricultural, Applied Science and Engineering courses" },
    { title: "Online Admission Screening Form", tab: "admissions", subSection: "form", description: "Submit biodata and O-Level WAEC/NECO results" },
    { title: "Applicant Screening Register", tab: "admissions", subSection: "screening", description: "Vetting queue for Admissions Committee & Registrar" },
    { title: "Student Course Registration", tab: "student", subSection: "courses", description: "Enroll semester credit units and submit to HOD" },
    { title: "Semester Published Results", tab: "student", subSection: "results", description: "View CGPA breakdown and Senate approved grades" },
    { title: "Bursary Fee Settlement", tab: "student", subSection: "finance", description: "Pay tuition fees online via Remita" },
    { title: "Continuous Assessment Grade Entry", tab: "lecturer", subSection: "scores", description: "Lecturer marks input for CA (40) and Exam (60)" },
    { title: "Practical Farm & Lab Attendance", tab: "lecturer", subSection: "attendance", description: "Register attendees for demonstration farms & workshops" },
    { title: "Executive Management Analytics", tab: "admin", subSection: "analytics", description: "Institutional KPIs, revenue and departmental charts" },
    { title: "Institutional Settings & Session", tab: "admin", subSection: "settings", description: "Configure academic session, semester and registration windows" },
    { title: "User Roles & Access Control (RBAC)", tab: "admin", subSection: "users", description: "Manage accounts, lockouts and role provisioning" },
    { title: "Security & Governance Audit Trail", tab: "admin", subSection: "audit", description: "Tamper-resistant activity logs of all critical actions" },
    { title: "Content Management Module (CMS)", tab: "admin", subSection: "cms", description: "Publish news articles, manage bulletins and hero slideshow" },
    { title: "College News & Press Releases", tab: "public", subSection: "news", description: "Official announcements, agriculture research news and campus notices" }
  ].filter(
    (s) => !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tab.toLowerCase().includes(q)
  );
  return res.json({
    success: true,
    query: q,
    results: {
      students: matchedStudents,
      applicants: matchedApplicants,
      courses: matchedCourses,
      documents: standardDocuments,
      sections: portalSections
    }
  });
});
apiRouter.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }
  const state = import_db.db.getState();
  const reqEmail = email.toLowerCase().trim();
  const user = state.users.find((u) => {
    const uEmail = u.email.toLowerCase().trim();
    if (uEmail === reqEmail) return true;
    return uEmail.replace("@edocasti.edu.ng", "@edocas.edu.ng") === reqEmail.replace("@edocasti.edu.ng", "@edocas.edu.ng");
  });
  if (!user) {
    import_db.db.logAudit({
      action: "LOGIN_FAILED",
      resource: "AUTH",
      details: { email, reason: "User not found" },
      ipAddress: req.ip
    });
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }
  if (user.isLocked) {
    import_db.db.logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "LOGIN_BLOCKED_LOCKED",
      resource: "AUTH",
      details: { email },
      ipAddress: req.ip
    });
    return res.status(403).json({ success: false, message: "Account is locked. Please contact the ICT Administrator." });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "Account is deactivated." });
  }
  const isMatch = import_bcryptjs.default.compareSync(password, user.passwordHash);
  if (!isMatch) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= 5) {
      user.isLocked = true;
    }
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "LOGIN_FAILED_PASSWORD",
      resource: "AUTH",
      details: { email, attempts: user.failedLoginAttempts },
      ipAddress: req.ip
    });
    return res.status(401).json({
      success: false,
      message: user.isLocked ? "Account locked after 5 failed attempts." : "Invalid email or password."
    });
  }
  user.failedLoginAttempts = 0;
  user.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
  import_db.db.saveState();
  const token = (0, import_authMiddleware.generateToken)(user);
  import_db.db.logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "LOGIN_SUCCESS",
    resource: "AUTH",
    details: { role: user.role },
    ipAddress: req.ip
  });
  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      photoUrl: user.photoUrl,
      departmentId: user.departmentId,
      schoolId: user.schoolId
    }
  });
});
apiRouter.post("/auth/register-applicant", (req, res) => {
  const { email, password, fullName, phone, photoUrl } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ success: false, message: "Email, password, and full name are required." });
  }
  const state = import_db.db.getState();
  const existing = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, message: "An account with this email address already exists." });
  }
  const passwordHash = import_bcryptjs.default.hashSync(password, 10);
  const newUser = {
    id: "usr-app-" + Date.now(),
    email: email.toLowerCase().trim(),
    passwordHash,
    fullName: fullName.trim(),
    phone: phone || "",
    photoUrl: photoUrl || "",
    role: "APPLICANT",
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  state.users.push(newUser);
  import_db.db.saveState();
  import_db.db.logAudit({
    userId: newUser.id,
    userEmail: newUser.email,
    action: "APPLICANT_ACCOUNT_CREATED",
    resource: "USER",
    details: { fullName: newUser.fullName },
    ipAddress: req.ip
  });
  const token = (0, import_authMiddleware.generateToken)(newUser);
  return res.status(201).json({
    success: true,
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      phone: newUser.phone,
      photoUrl: newUser.photoUrl
    }
  });
});
apiRouter.get("/auth/me", import_authMiddleware.authenticateToken, (req, res) => {
  const user = req.user;
  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      photoUrl: user.photoUrl,
      departmentId: user.departmentId,
      schoolId: user.schoolId,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }
  });
});
apiRouter.put("/auth/profile", import_authMiddleware.authenticateToken, (req, res) => {
  const state = import_db.db.getState();
  const user = state.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  const { fullName, phone, photoUrl } = req.body;
  if (fullName !== void 0) user.fullName = String(fullName).trim();
  if (phone !== void 0) user.phone = phone;
  if (photoUrl !== void 0) {
    user.photoUrl = photoUrl;
    const std = state.students.find((s) => s.userId === user.id);
    if (std) std.photoUrl = photoUrl;
    const app = state.applications.find((a) => a.userId === user.id);
    if (app) app.photoUrl = photoUrl;
  }
  import_db.db.saveState();
  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      photoUrl: user.photoUrl,
      departmentId: user.departmentId,
      schoolId: user.schoolId
    }
  });
});
apiRouter.post("/auth/change-password", import_authMiddleware.authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user;
  if (!import_bcryptjs.default.compareSync(currentPassword, user.passwordHash)) {
    return res.status(400).json({ success: false, message: "Incorrect current password." });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });
  }
  user.passwordHash = import_bcryptjs.default.hashSync(newPassword, 10);
  import_db.db.saveState();
  import_db.db.logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "PASSWORD_CHANGED",
    resource: "AUTH",
    details: {},
    ipAddress: req.ip
  });
  return res.json({ success: true, message: "Password updated successfully." });
});
apiRouter.get("/settings", (req, res) => {
  return res.json({ success: true, settings: import_db.db.getState().settings });
});
apiRouter.put(
  "/settings",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  async (req, res) => {
    const current = import_db.db.getState().settings;
    const updated = { ...current, ...req.body, id: "default" };
    import_db.db.getState().settings = updated;
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "SETTINGS_UPDATED",
      resource: "INSTITUTION_PROFILE",
      details: { updatedFields: Object.keys(req.body) },
      ipAddress: req.ip
    });
    try {
      await import_db.db.flushPersistentWrites();
    } catch (error) {
      console.error("[EDOCASTI] institution settings persistence failed.");
      return res.status(503).json({ success: false, message: "Settings could not be durably saved. Please retry." });
    }
    return res.json({ success: true, settings: import_db.db.getState().settings });
  }
);
apiRouter.get(
  "/users",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { role, search } = req.query;
    let list = import_db.db.getState().users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      phone: u.phone,
      photoUrl: u.photoUrl,
      departmentId: u.departmentId,
      schoolId: u.schoolId,
      isActive: u.isActive,
      isLocked: u.isLocked,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin
    }));
    if (role) {
      list = list.filter((u) => u.role === role);
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return res.json({ success: true, users: list });
  }
);
apiRouter.post(
  "/users",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { email, password, fullName, role, phone, departmentId, schoolId } = req.body;
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ success: false, message: "All required fields must be provided." });
    }
    const state = import_db.db.getState();
    if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ success: false, message: "User with this email already exists." });
    }
    const newUser = {
      id: "usr-" + Date.now(),
      email: email.toLowerCase().trim(),
      passwordHash: import_bcryptjs.default.hashSync(password, 10),
      fullName: fullName.trim(),
      role,
      phone: phone || "",
      departmentId,
      schoolId,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    state.users.push(newUser);
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "USER_CREATED",
      resource: "USER",
      details: { newUserId: newUser.id, role: newUser.role, email: newUser.email },
      ipAddress: req.ip
    });
    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role
      }
    });
  }
);
apiRouter.patch(
  "/users/:id/status",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const { isActive, isLocked } = req.body;
    const user = import_db.db.getState().users.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (typeof isActive === "boolean") user.isActive = isActive;
    if (typeof isLocked === "boolean") {
      user.isLocked = isLocked;
      if (!isLocked) user.failedLoginAttempts = 0;
    }
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "USER_STATUS_UPDATED",
      resource: "USER",
      details: { targetUserId: user.id, isActive: user.isActive, isLocked: user.isLocked },
      ipAddress: req.ip
    });
    return res.json({ success: true, message: "User status updated successfully." });
  }
);
apiRouter.put(
  "/users/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const { fullName, email, role, phone, photoUrl, departmentId, schoolId, isActive, isLocked } = req.body;
    const user = import_db.db.getState().users.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (fullName !== void 0) user.fullName = String(fullName).trim();
    if (email !== void 0) user.email = String(email).toLowerCase().trim();
    if (role !== void 0) user.role = role;
    if (phone !== void 0) user.phone = phone;
    if (photoUrl !== void 0) user.photoUrl = photoUrl;
    if (departmentId !== void 0) user.departmentId = departmentId;
    if (schoolId !== void 0) user.schoolId = schoolId;
    if (typeof isActive === "boolean") user.isActive = isActive;
    if (typeof isLocked === "boolean") user.isLocked = isLocked;
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "USER_UPDATED",
      resource: "USER",
      details: { targetUserId: user.id, fullName: user.fullName, role: user.role },
      ipAddress: req.ip
    });
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        photoUrl: user.photoUrl,
        departmentId: user.departmentId,
        schoolId: user.schoolId,
        isActive: user.isActive,
        isLocked: user.isLocked
      }
    });
  }
);
apiRouter.delete(
  "/users/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot delete your own currently active account." });
    }
    const state = import_db.db.getState();
    const idx = state.users.findIndex((u) => u.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "User not found." });
    const removed = state.users.splice(idx, 1)[0];
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "USER_DELETED",
      resource: "USER",
      details: { targetUserId: id, email: removed.email },
      ipAddress: req.ip
    });
    return res.json({ success: true, message: "User account deleted." });
  }
);
apiRouter.get("/academics/schools", (req, res) => {
  return res.json({ success: true, schools: import_db.db.getState().schools });
});
apiRouter.get("/academics/departments", (req, res) => {
  return res.json({ success: true, departments: import_db.db.getState().departments });
});
apiRouter.get("/academics/programmes", (req, res) => {
  return res.json({ success: true, programmes: import_db.db.getState().programmes });
});
apiRouter.get("/academics/courses", (req, res) => {
  const { departmentId, level, semester } = req.query;
  let list = import_db.db.getState().courses;
  if (departmentId) list = list.filter((c) => c.departmentId === departmentId);
  if (level) list = list.filter((c) => c.level === level);
  if (semester) list = list.filter((c) => c.semester === semester);
  return res.json({ success: true, courses: list });
});
apiRouter.get(
  "/academics/my-courses",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("LECTURER"),
  (req, res) => {
    const courses = import_db.db.getState().courses.filter((course) => course.lecturerId === req.user.id);
    return res.json({ success: true, courses });
  }
);
apiRouter.get(
  "/academics/lecturers",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "HOD"),
  (req, res) => {
    const state = import_db.db.getState();
    let lecturerUsers = state.users.filter((u) => u.role === "LECTURER" && u.isActive);
    if (req.user.role === "HOD") {
      const departmentId = req.user.departmentId;
      lecturerUsers = departmentId ? lecturerUsers.filter((lecturer) => lecturer.departmentId === departmentId) : [];
    }
    if (req.user.role === "DEAN") {
      const schoolId = req.user.schoolId;
      const departmentIds = new Set(state.departments.filter((department) => department.schoolId === schoolId).map((department) => department.id));
      lecturerUsers = schoolId ? lecturerUsers.filter((lecturer) => Boolean(lecturer.departmentId && departmentIds.has(lecturer.departmentId))) : [];
    }
    const lecturers = lecturerUsers.map((lecturer) => ({
      id: lecturer.id,
      fullName: lecturer.fullName,
      role: lecturer.role,
      departmentId: lecturer.departmentId
    }));
    return res.json({ success: true, lecturers });
  }
);
apiRouter.post(
  "/academics/courses",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "DEAN"),
  (req, res) => {
    const { departmentId, programmeId, code, title, creditUnits, level, semester, lecturerId, isCompulsory } = req.body;
    if (!departmentId || !code || !title || !creditUnits) {
      return res.status(400).json({ success: false, message: "Missing course details." });
    }
    const state = import_db.db.getState();
    const mayAssignLecturer = req.user.role === "HOD";
    const resolvedLecturer = mayAssignLecturer && lecturerId ? state.users.find((u) => u.id === lecturerId && u.role === "LECTURER") : void 0;
    if (mayAssignLecturer && lecturerId && !resolvedLecturer) {
      return res.status(400).json({ success: false, message: "Select an active lecturer account." });
    }
    const newCourse = {
      id: "crs-" + code.toLowerCase().replace(/[^a-z0-9]/g, "") + "-" + Date.now().toString().slice(-3),
      departmentId,
      programmeId: programmeId || void 0,
      code: code.toUpperCase().trim(),
      title: title.trim(),
      creditUnits: Number(creditUnits),
      level: level || "ND I",
      semester: semester || "First Semester",
      lecturerId: resolvedLecturer?.id || void 0,
      lecturerName: resolvedLecturer?.fullName || "Departmental Staff",
      isCompulsory: isCompulsory !== void 0 ? Boolean(isCompulsory) : true
    };
    state.courses.push(newCourse);
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "COURSE_CREATED",
      resource: "COURSE",
      details: { code: newCourse.code, title: newCourse.title },
      ipAddress: req.ip
    });
    return res.status(201).json({ success: true, course: newCourse });
  }
);
apiRouter.put(
  "/academics/courses/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "DEAN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const course = state.courses.find((c) => c.id === id);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }
    const { departmentId, programmeId, code, title, creditUnits, level, semester, lecturerId, isCompulsory } = req.body;
    if (departmentId !== void 0) course.departmentId = departmentId;
    if (programmeId !== void 0) course.programmeId = programmeId || void 0;
    if (code !== void 0) course.code = String(code).toUpperCase().trim();
    if (title !== void 0) course.title = String(title).trim();
    if (creditUnits !== void 0) course.creditUnits = Number(creditUnits);
    if (level !== void 0) course.level = level;
    if (semester !== void 0) course.semester = semester;
    if (lecturerId !== void 0) {
      if (req.user.role !== "HOD") {
        return res.status(403).json({ success: false, message: "Only the HOD can assign courses to lecturers." });
      }
      const usr = lecturerId ? state.users.find((u) => u.id === lecturerId && u.role === "LECTURER" && u.isActive) : void 0;
      if (lecturerId && !usr) {
        return res.status(400).json({ success: false, message: "Select an active lecturer account." });
      }
      course.lecturerId = usr?.id;
      course.lecturerName = usr?.fullName || "Departmental Staff";
    }
    if (typeof isCompulsory === "boolean") course.isCompulsory = isCompulsory;
    import_db.db.saveState();
    return res.json({ success: true, course });
  }
);
apiRouter.patch(
  "/academics/courses/:id/assign-lecturer",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("HOD"),
  (req, res) => {
    const { id } = req.params;
    const { lecturerId } = req.body;
    const state = import_db.db.getState();
    const course = state.courses.find((c) => c.id === id);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }
    if (!req.user.departmentId || course.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: "You can only assign courses within your department." });
    }
    const lecturerUser = lecturerId ? state.users.find((u) => u.id === lecturerId && u.role === "LECTURER" && u.isActive) : void 0;
    if (lecturerId && !lecturerUser) {
      return res.status(400).json({ success: false, message: "Select an active lecturer account." });
    }
    course.lecturerId = lecturerUser?.id;
    course.lecturerName = lecturerUser?.fullName || "Departmental Staff";
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "COURSE_LECTURER_ASSIGNED",
      resource: "COURSE",
      details: { courseId: course.id, code: course.code, lecturerName: course.lecturerName },
      ipAddress: req.ip
    });
    return res.json({ success: true, course });
  }
);
apiRouter.delete(
  "/academics/courses/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "DEAN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.courses.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Course not found." });
    state.courses.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Course deleted." });
  }
);
apiRouter.post(
  "/academics/schools",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { code, name, description, imageUrl } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: "School code and name are required." });
    }
    const newSchool = {
      id: "sch-" + Date.now(),
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
      description: String(description || "").trim(),
      imageUrl: imageUrl || ""
    };
    import_db.db.getState().schools.push(newSchool);
    import_db.db.saveState();
    return res.status(201).json({ success: true, school: newSchool });
  }
);
apiRouter.put(
  "/academics/schools/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const school = import_db.db.getState().schools.find((s) => s.id === id);
    if (!school) return res.status(404).json({ success: false, message: "School not found." });
    const { code, name, description, imageUrl } = req.body;
    if (code !== void 0) school.code = String(code).toUpperCase().trim();
    if (name !== void 0) school.name = String(name).trim();
    if (description !== void 0) school.description = String(description).trim();
    if (imageUrl !== void 0) school.imageUrl = imageUrl;
    import_db.db.saveState();
    return res.json({ success: true, school });
  }
);
apiRouter.delete(
  "/academics/schools/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.schools.findIndex((s) => s.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "School not found." });
    state.schools.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "School deleted." });
  }
);
apiRouter.post(
  "/academics/departments",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { schoolId, code, name } = req.body;
    if (!schoolId || !code || !name) {
      return res.status(400).json({ success: false, message: "School, code, and name are required." });
    }
    const newDept = {
      id: "dept-" + Date.now(),
      schoolId,
      code: String(code).toUpperCase().trim(),
      name: String(name).trim()
    };
    import_db.db.getState().departments.push(newDept);
    import_db.db.saveState();
    return res.status(201).json({ success: true, department: newDept });
  }
);
apiRouter.put(
  "/academics/departments/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const dept = import_db.db.getState().departments.find((d) => d.id === id);
    if (!dept) return res.status(404).json({ success: false, message: "Department not found." });
    const { schoolId, code, name } = req.body;
    if (schoolId !== void 0) dept.schoolId = schoolId;
    if (code !== void 0) dept.code = String(code).toUpperCase().trim();
    if (name !== void 0) dept.name = String(name).trim();
    import_db.db.saveState();
    return res.json({ success: true, department: dept });
  }
);
apiRouter.delete(
  "/academics/departments/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.departments.findIndex((d) => d.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Department not found." });
    state.departments.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Department deleted." });
  }
);
function isValidProgrammeAcademicStructure(value) {
  if (!value || typeof value !== "object") return false;
  const structure = value;
  if (!Array.isArray(structure.stages) || structure.stages.length === 0) return false;
  return structure.stages.every(
    (stage) => stage && typeof stage.code === "string" && typeof stage.label === "string" && Number.isInteger(stage.yearIndex) && Array.isArray(stage.periods) && stage.periods.length > 0 && stage.periods.every(
      (period) => period && typeof period.code === "string" && typeof period.label === "string"
    )
  );
}
apiRouter.post(
  "/academics/programmes",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "DEAN"),
  (req, res) => {
    const { departmentId, code, name, qualification, durationYears, description, requirements, academicStructure } = req.body;
    if (!departmentId || !code || !name) {
      return res.status(400).json({ success: false, message: "Department, code, and name are required." });
    }
    if (academicStructure !== void 0 && !isValidProgrammeAcademicStructure(academicStructure)) {
      return res.status(400).json({ success: false, message: "Invalid academic structure." });
    }
    const newProg = {
      id: "prog-" + Date.now(),
      departmentId,
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
      qualification: qualification || "ND",
      durationYears: Number(durationYears) || 2,
      description: String(description || "").trim(),
      requirements: Array.isArray(requirements) ? requirements : [],
      ...academicStructure !== void 0 ? { academicStructure } : {}
    };
    import_db.db.getState().programmes.push(newProg);
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "PROGRAMME_CREATED",
      resource: "PROGRAMME",
      details: { code: newProg.code, name: newProg.name },
      ipAddress: req.ip
    });
    return res.status(201).json({ success: true, programme: newProg });
  }
);
apiRouter.put(
  "/academics/programmes/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "DEAN"),
  (req, res) => {
    const { id } = req.params;
    const prog = import_db.db.getState().programmes.find((p) => p.id === id);
    if (!prog) return res.status(404).json({ success: false, message: "Programme not found." });
    const { departmentId, code, name, qualification, durationYears, description, requirements, academicStructure } = req.body;
    if (academicStructure !== void 0 && !isValidProgrammeAcademicStructure(academicStructure)) {
      return res.status(400).json({ success: false, message: "Invalid academic structure." });
    }
    if (departmentId !== void 0) prog.departmentId = departmentId;
    if (code !== void 0) prog.code = String(code).toUpperCase().trim();
    if (name !== void 0) prog.name = String(name).trim();
    if (qualification !== void 0) prog.qualification = qualification;
    if (durationYears !== void 0) prog.durationYears = Number(durationYears);
    if (description !== void 0) prog.description = String(description).trim();
    if (Array.isArray(requirements)) prog.requirements = requirements;
    if (academicStructure !== void 0) prog.academicStructure = academicStructure;
    import_db.db.saveState();
    return res.json({ success: true, programme: prog });
  }
);
apiRouter.delete(
  "/academics/programmes/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "DEAN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.programmes.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Programme not found." });
    state.programmes.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Programme deleted." });
  }
);
apiRouter.get(
  "/admissions",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR", "ADMISSIONS_OFFICER"),
  (req, res) => {
    const { status, programmeId, session } = req.query;
    let list = import_db.db.getState().applications;
    if (status) list = list.filter((a) => a.status === status);
    if (programmeId) list = list.filter((a) => a.programmeId === programmeId);
    if (session) list = list.filter((a) => a.session === session);
    return res.json({ success: true, applications: list });
  }
);
apiRouter.get("/admissions/my-application", import_authMiddleware.authenticateToken, (req, res) => {
  const app = import_db.db.getState().applications.find((a) => a.userId === req.user.id);
  if (!app) {
    return res.status(404).json({ success: false, message: "No application record found for this user." });
  }
  return res.json({ success: true, application: app });
});
apiRouter.post("/admissions/apply", import_authMiddleware.authenticateToken, (req, res) => {
  const user = req.user;
  const state = import_db.db.getState();
  const existing = state.applications.find((a) => a.userId === user.id);
  const {
    programmeId,
    firstName,
    lastName,
    otherNames,
    gender,
    dob,
    phone,
    photoUrl,
    stateOfOrigin,
    lga,
    residentialAddress,
    oLevelResults
  } = req.body;
  const resolvedPhoto = photoUrl || existing?.photoUrl || user.photoUrl || "";
  if (photoUrl) {
    const u = state.users.find((usr) => usr.id === user.id);
    if (u) u.photoUrl = photoUrl;
  }
  const appNumber = existing?.applicationNumber || `EDOCASTI/${state.settings.currentSession.slice(0, 4)}/APP-${String(state.applications.length + 100).padStart(5, "0")}`;
  const applicationData = {
    id: existing?.id || "app-" + Date.now(),
    applicationNumber: appNumber,
    userId: user.id,
    programmeId: programmeId || existing?.programmeId || "prog-nd-agric",
    session: state.settings.currentSession,
    firstName: firstName || user.fullName.split(" ")[0],
    lastName: lastName || user.fullName.split(" ")[1] || "",
    otherNames: otherNames || "",
    gender: gender || "Male",
    dob: dob || "2005-01-01",
    phone: phone || user.phone || "",
    email: user.email,
    photoUrl: resolvedPhoto,
    stateOfOrigin: stateOfOrigin || "Edo State",
    lga: lga || "Oredo",
    residentialAddress: residentialAddress || "Benin City, Edo State",
    oLevelResults: oLevelResults || [
      { subject: "English Language", grade: "C4", examNumber: "5002991", examType: "WAEC" },
      { subject: "Mathematics", grade: "B3", examNumber: "5002991", examType: "WAEC" },
      { subject: "Agricultural Science / Biology", grade: "A1", examNumber: "5002991", examType: "WAEC" },
      { subject: "Chemistry", grade: "B3", examNumber: "5002991", examType: "WAEC" },
      { subject: "Physics / Economics", grade: "C5", examNumber: "5002991", examType: "WAEC" }
    ],
    status: "SUBMITTED",
    submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
    screeningNotes: "Application submitted and awaiting credential screening."
  };
  if (existing) {
    const idx = state.applications.findIndex((a) => a.id === existing.id);
    state.applications[idx] = applicationData;
  } else {
    state.applications.push(applicationData);
  }
  import_db.db.saveState();
  import_db.db.logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "ADMISSION_APPLICATION_SUBMITTED",
    resource: "APPLICATION",
    details: { applicationNumber: appNumber, programmeId },
    ipAddress: req.ip
  });
  return res.json({ success: true, application: applicationData });
});
apiRouter.put(
  "/admissions/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "ADMISSIONS_OFFICER"),
  (req, res) => {
    const { id } = req.params;
    const app = import_db.db.getState().applications.find((a) => a.id === id);
    if (!app) return res.status(404).json({ success: false, message: "Application not found." });
    Object.assign(app, req.body, { id: app.id });
    import_db.db.saveState();
    return res.json({ success: true, application: app });
  }
);
apiRouter.delete(
  "/admissions/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.applications.findIndex((a) => a.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Application not found." });
    state.applications.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Application deleted." });
  }
);
apiRouter.patch(
  "/admissions/:id/decision",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR", "ADMISSIONS_OFFICER"),
  (req, res) => {
    const { id } = req.params;
    const { status, screeningNotes } = req.body;
    const app = import_db.db.getState().applications.find((a) => a.id === id);
    if (!app) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }
    app.status = status;
    if (screeningNotes) app.screeningNotes = screeningNotes;
    app.reviewedBy = `${req.user.fullName} (${req.user.role})`;
    app.decisionAt = (/* @__PURE__ */ new Date()).toISOString();
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "ADMISSION_DECISION_RECORDED",
      resource: "APPLICATION",
      details: { applicationId: id, status, decisionBy: app.reviewedBy },
      ipAddress: req.ip
    });
    return res.json({ success: true, application: app });
  }
);
function calculateAdmissionFeeTotal(state, programmeId, level, session) {
  const applicableFees = state.feeSchedules.filter(
    (fee) => fee.session === session && (!fee.level || fee.level === "All" || fee.level === level) && (!fee.programmeId || fee.programmeId === programmeId) && Number.isFinite(Number(fee.amount)) && Number(fee.amount) >= 0
  );
  const programmeCategories = new Set(
    applicableFees.filter((fee) => fee.programmeId === programmeId).map((fee) => String(fee.category || "").trim().toLowerCase())
  );
  const feesToCharge = applicableFees.filter(
    (fee) => Boolean(fee.programmeId) || !programmeCategories.has(String(fee.category || "").trim().toLowerCase())
  );
  if (feesToCharge.length === 0) return null;
  const total = feesToCharge.reduce((sum, fee) => sum + Number(fee.amount), 0);
  return total > 0 ? total : null;
}
function isFeeManagementEnabled() {
  return process.env.FEE_MANAGEMENT_ENABLED === "true";
}
function migrateApplicantToStudent(state, app, applicantUser, createLegacyInvoice = true) {
  const prog = state.programmes.find((p) => p.id === app.programmeId);
  const dept = state.departments.find((d) => d.id === prog?.departmentId);
  const school = state.schools.find((s) => s.id === dept?.schoolId);
  const existingStudent = state.students.find((s) => s.userId === applicantUser.id);
  if (existingStudent) {
    if (!existingStudent.photoUrl && (app.photoUrl || applicantUser.photoUrl)) {
      existingStudent.photoUrl = app.photoUrl || applicantUser.photoUrl;
    }
    applicantUser.role = "STUDENT";
    return existingStudent;
  }
  const admissionSession = app.session;
  const admissionLevel = `${prog?.qualification || "ND"} I`;
  if (!admissionSession || !admissionSession.trim()) {
    throw new Error("The application admission session is missing.");
  }
  const matric = `EDOCASTI/${prog?.qualification || "ND"}/${admissionSession.slice(0, 4)}/${String(state.students.length + 101).padStart(4, "0")}`;
  const studentRecord = {
    id: "std-" + Date.now(),
    matricNumber: matric,
    userId: applicantUser.id,
    photoUrl: app.photoUrl || applicantUser.photoUrl || "",
    programmeId: app.programmeId,
    departmentId: dept?.id || "dept-agric",
    schoolId: school?.id || "sch-agric",
    level: admissionLevel,
    sessionAdmitted: admissionSession,
    academicStatus: "Good Standing",
    gender: app.gender,
    dob: app.dob,
    emergencyContact: app.phone,
    nextOfKin: "Parent/Guardian",
    cgpa: 0,
    totalCreditsEarned: 0
  };
  state.students.push(studentRecord);
  applicantUser.role = "STUDENT";
  if (!applicantUser.photoUrl && app.photoUrl) {
    applicantUser.photoUrl = app.photoUrl;
  }
  if (createLegacyInvoice) {
    const legacyTotal = calculateAdmissionFeeTotal(
      state,
      app.programmeId,
      admissionLevel,
      admissionSession
    );
    if (legacyTotal === null) {
      throw new Error("No applicable legacy fee schedule exists for this admission.");
    }
    const inv = {
      id: "inv-" + Date.now(),
      invoiceNumber: `INV/${admissionSession.slice(0, 4)}/${Math.floor(1e4 + Math.random() * 9e4)}`,
      studentId: studentRecord.id,
      session: admissionSession,
      title: `${studentRecord.level} Academic Session Consolidated Fees`,
      amount: legacyTotal,
      amountPaid: 0,
      status: "UNPAID",
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString().split("T")[0],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    state.invoices.push(inv);
  }
  return studentRecord;
}
async function attemptAdmissionFeeActivation(app, student, actorUserId, ipAddress) {
  if (!app.feeActivationRequiredAt) return true;
  try {
    const programme = import_db.db.getState().programmes.find((p) => p.id === app.programmeId);
    await (0, import_feeAdmissionLedgerService.activateAdmissionFeeObligations)({
      applicationId: app.id,
      studentId: student.id,
      programmeId: app.programmeId,
      session: app.session,
      level: student.level || `${programme?.qualification || "ND"} I`,
      activatedBy: actorUserId,
      ipAddress: ipAddress || "unknown"
    });
    return true;
  } catch {
    return false;
  }
}
apiRouter.post(
  "/admissions/:id/accept-offer",
  import_authMiddleware.authenticateToken,
  async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const state = import_db.db.getState();
    const app = state.applications.find((a) => a.id === id && a.userId === user.id);
    if (!app) {
      return res.status(404).json({
        success: false,
        message: "Application not found or unauthorized."
      });
    }
    if (app.status !== "OFFERED") {
      return res.status(400).json({
        success: false,
        message: "Only offered applications can be accepted."
      });
    }
    if (!app.session || !app.session.trim()) {
      return res.status(400).json({
        success: false,
        message: "The application admission session is missing. Contact the admissions office."
      });
    }
    const feeEnabled = isFeeManagementEnabled();
    const programme = state.programmes.find((p) => p.id === app.programmeId);
    const admissionLevel = `${programme?.qualification || "ND"} I`;
    const existingStudent = state.students.some((s) => s.userId === user.id);
    if (!feeEnabled) {
      const admissionTotal = calculateAdmissionFeeTotal(
        state,
        app.programmeId,
        admissionLevel,
        app.session
      );
      if (admissionTotal === null) {
        return res.status(400).json({
          success: false,
          message: `No applicable legacy fee schedule is configured for ${programme?.code || "this programme"} (${admissionLevel}) for ${app.session}.`
        });
      }
    }
    const applicantUser = state.users.find((u) => u.id === user.id) || user;
    try {
      app.status = "ACCEPTED";
      const studentRecord = migrateApplicantToStudent(
        state,
        app,
        applicantUser,
        !feeEnabled
      );
      if (feeEnabled && !existingStudent) {
        app.feeActivationRequiredAt = (/* @__PURE__ */ new Date()).toISOString();
      }
      import_db.db.saveState();
      const newToken = (0, import_authMiddleware.generateToken)(applicantUser);
      let auditLogged = true;
      try {
        import_db.db.logAudit({
          userId: applicantUser.id,
          userEmail: applicantUser.email,
          action: "ADMISSION_OFFER_ACCEPTED",
          resource: "APPLICATION",
          details: {
            matricNumber: studentRecord.matricNumber,
            studentId: studentRecord.id,
            feeActivationRequired: Boolean(app.feeActivationRequiredAt)
          },
          ipAddress: req.ip
        });
      } catch {
        auditLogged = false;
      }
      const activationSucceeded = await attemptAdmissionFeeActivation(
        app,
        studentRecord,
        applicantUser.id,
        req.ip || "unknown"
      );
      const activationPending = Boolean(app.feeActivationRequiredAt) && !activationSucceeded;
      return res.status(activationPending ? 202 : 200).json({
        success: true,
        feeActivationPending: activationPending,
        message: activationPending ? "Admission accepted. Fee activation is pending and can be retried by an authorised administrator." : !auditLogged ? "Admission accepted, but its audit entry could not be saved. Please notify an administrator." : "Admission offer accepted successfully! Account migrated to Student.",
        auditWarning: !auditLogged,
        student: studentRecord,
        token: newToken,
        user: {
          id: applicantUser.id,
          email: applicantUser.email,
          fullName: applicantUser.fullName,
          role: applicantUser.role,
          phone: applicantUser.phone,
          photoUrl: applicantUser.photoUrl
        }
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Admission processing could not be completed. Please contact the admissions office."
      });
    }
  }
);
apiRouter.post(
  "/admissions/:id/migrate-student",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR", "ADMISSIONS_OFFICER"),
  async (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const app = state.applications.find((a) => a.id === id);
    if (!app) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }
    const applicantUser = state.users.find((u) => u.id === app.userId);
    if (!applicantUser) {
      return res.status(404).json({
        success: false,
        message: "Linked applicant user account not found."
      });
    }
    if (app.status !== "OFFERED" && app.status !== "ACCEPTED") {
      return res.status(409).json({
        success: false,
        message: "Only offered or already accepted applications can be migrated."
      });
    }
    if (!app.session || !app.session.trim()) {
      return res.status(400).json({
        success: false,
        message: "The application admission session is missing."
      });
    }
    const feeEnabled = isFeeManagementEnabled();
    const programme = state.programmes.find((p) => p.id === app.programmeId);
    const admissionLevel = `${programme?.qualification || "ND"} I`;
    const existingStudent = state.students.some((s) => s.userId === applicantUser.id);
    if (!feeEnabled) {
      const admissionTotal = calculateAdmissionFeeTotal(
        state,
        app.programmeId,
        admissionLevel,
        app.session
      );
      if (admissionTotal === null) {
        return res.status(400).json({
          success: false,
          message: `No applicable legacy fee schedule is configured for ${programme?.code || "this programme"} (${admissionLevel}) for ${app.session}.`
        });
      }
    }
    try {
      app.status = "ACCEPTED";
      const studentRecord = migrateApplicantToStudent(
        state,
        app,
        applicantUser,
        !feeEnabled
      );
      if (feeEnabled && !existingStudent) {
        app.feeActivationRequiredAt = (/* @__PURE__ */ new Date()).toISOString();
      }
      import_db.db.saveState();
      let auditLogged = true;
      try {
        import_db.db.logAudit({
          userId: req.user.id,
          userEmail: req.user.email,
          action: "APPLICANT_MIGRATED_TO_STUDENT",
          resource: "STUDENT",
          details: {
            studentId: studentRecord.id,
            matricNumber: studentRecord.matricNumber,
            feeActivationRequired: Boolean(app.feeActivationRequiredAt)
          },
          ipAddress: req.ip
        });
      } catch {
        auditLogged = false;
      }
      const activationSucceeded = await attemptAdmissionFeeActivation(
        app,
        studentRecord,
        req.user.id,
        req.ip || "unknown"
      );
      const activationPending = Boolean(app.feeActivationRequiredAt) && !activationSucceeded;
      return res.status(activationPending ? 202 : 200).json({
        success: true,
        feeActivationPending: activationPending,
        message: activationPending ? "Student migration completed. Fee activation is pending and can be retried by an authorised administrator." : !auditLogged ? "Student migration completed, but its audit entry could not be saved. Please notify an administrator." : "Applicant migrated successfully.",
        auditWarning: !auditLogged,
        student: studentRecord,
        application: app
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Student migration could not be completed. Please try again or contact support."
      });
    }
  }
);
apiRouter.get(
  "/admissions/fee-activation-retries",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR", "ADMISSIONS_OFFICER"),
  async (req, res) => {
    if (!isFeeManagementEnabled()) {
      return res.status(503).json({
        success: false,
        message: "The new fee management system is not enabled."
      });
    }
    try {
      const requestedLimit = Number(req.query.limit || 50);
      const items = await (0, import_feeAdmissionLedgerService.listRetryableAdmissionFeeActivations)(requestedLimit);
      return res.json({
        success: true,
        items
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Admission fee activation records could not be loaded."
      });
    }
  }
);
apiRouter.post(
  "/admissions/:id/retry-fee-activation",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR", "ADMISSIONS_OFFICER"),
  async (req, res) => {
    if (!isFeeManagementEnabled()) {
      return res.status(503).json({
        success: false,
        message: "The new fee management system is not enabled."
      });
    }
    const { id } = req.params;
    const state = import_db.db.getState();
    const app = state.applications.find((a) => a.id === id);
    if (!app) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }
    if (app.status !== "ACCEPTED" || !app.feeActivationRequiredAt) {
      return res.status(409).json({
        success: false,
        message: "This application is not marked for new fee activation."
      });
    }
    const student = state.students.find((s) => s.userId === app.userId);
    if (!student || student.programmeId !== app.programmeId) {
      return res.status(409).json({
        success: false,
        message: "The accepted application does not have a matching student record."
      });
    }
    const succeeded = await attemptAdmissionFeeActivation(
      app,
      student,
      req.user.id,
      req.ip || "unknown"
    );
    if (!succeeded) {
      return res.status(503).json({
        success: false,
        message: "Fee activation is still pending. Check the fee database and retry later."
      });
    }
    return res.json({
      success: true,
      feeActivationPending: false,
      message: "Admission fee obligations activated successfully.",
      applicationId: app.id,
      studentId: student.id
    });
  }
);
apiRouter.get(
  "/students",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR", "REGISTRAR", "BURSAR", "LECTURER"),
  (req, res) => {
    const { departmentId, level, search, programmeId } = req.query;
    const state = import_db.db.getState();
    let list = state.students.map((std) => {
      const usr = state.users.find((u) => u.id === std.userId);
      const app = state.applications.find((a) => a.userId === std.userId);
      const prog = state.programmes.find((p) => p.id === std.programmeId);
      const dept = state.departments.find((d) => d.id === std.departmentId);
      const sch = state.schools.find((s) => s.id === std.schoolId);
      return {
        ...std,
        fullName: usr?.fullName || "Unknown Student",
        email: usr?.email || "",
        phone: usr?.phone || "",
        photoUrl: std.photoUrl || usr?.photoUrl || app?.photoUrl || "",
        programmeName: prog?.name || "",
        departmentName: dept?.name || "",
        schoolName: sch?.name || ""
      };
    });
    if (departmentId) list = list.filter((s) => s.departmentId === departmentId);
    if (programmeId) list = list.filter((s) => s.programmeId === programmeId);
    if (level) list = list.filter((s) => s.level === level);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (s) => s.fullName.toLowerCase().includes(q) || s.matricNumber.toLowerCase().includes(q)
      );
    }
    const role = req.user.role;
    if (role === "LECTURER") {
      const assignedCourseIds = new Set(state.courses.filter((c) => c.lecturerId === req.user.id).map((c) => c.id));
      const enrolledStudentIds = new Set(
        state.registrations.filter((r) => r.status === "APPROVED_BY_HOD" && r.courseIds.some((courseId) => assignedCourseIds.has(courseId))).map((r) => r.studentId)
      );
      list = list.filter((s) => enrolledStudentIds.has(s.id));
    }
    if (role === "EXAM_OFFICER") {
      const departmentId2 = req.user.departmentId;
      list = departmentId2 ? list.filter((s) => s.departmentId === departmentId2) : [];
    }
    if (role === "DEAN") {
      const schoolId = req.user.schoolId;
      list = schoolId ? list.filter((s) => s.schoolId === schoolId) : [];
    }
    if (["HOD", "DEAN", "EXAM_OFFICER", "LECTURER", "BURSAR"].includes(role)) {
      list = list.map((student) => ({
        ...student,
        email: "",
        phone: "",
        photoUrl: "",
        gender: "",
        dob: "",
        emergencyContact: "",
        nextOfKin: ""
      }));
    }
    return res.json({ success: true, students: list });
  }
);
apiRouter.post(
  "/students",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "REGISTRAR"),
  (req, res) => {
    const { fullName, email, phone, password, programmeId, level, gender, dob, photoUrl } = req.body;
    if (!fullName || !email || !programmeId) {
      return res.status(400).json({ success: false, message: "Full name, email, and programme are required." });
    }
    const state = import_db.db.getState();
    let user = state.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim());
    if (!user) {
      user = {
        id: "usr-std-" + Date.now(),
        email: String(email).toLowerCase().trim(),
        passwordHash: import_bcryptjs.default.hashSync(password || "Password123!", 10),
        fullName: String(fullName).trim(),
        role: "STUDENT",
        phone: phone || "",
        photoUrl: photoUrl || "",
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      state.users.push(user);
    } else {
      user.role = "STUDENT";
      if (photoUrl) user.photoUrl = photoUrl;
    }
    const prog = state.programmes.find((p) => p.id === programmeId);
    const dept = state.departments.find((d) => d.id === prog?.departmentId);
    const school = state.schools.find((s) => s.id === dept?.schoolId);
    const matric = `EDOCASTI/${prog?.qualification || "ND"}/${state.settings.currentSession.slice(0, 4)}/${String(state.students.length + 101).padStart(4, "0")}`;
    const student = {
      id: "std-" + Date.now(),
      matricNumber: matric,
      userId: user.id,
      photoUrl: photoUrl || user.photoUrl || "",
      programmeId,
      departmentId: dept?.id || "dept-agric",
      schoolId: school?.id || "sch-agric",
      level: level || `${prog?.qualification || "ND"} I`,
      sessionAdmitted: state.settings.currentSession,
      academicStatus: "Good Standing",
      gender: gender || "Male",
      dob: dob || "2004-01-01",
      emergencyContact: phone || "",
      nextOfKin: "Parent/Guardian",
      cgpa: 0,
      totalCreditsEarned: 0
    };
    state.students.push(student);
    import_db.db.saveState();
    return res.status(201).json({ success: true, student });
  }
);
apiRouter.put(
  "/students/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "REGISTRAR"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const student = state.students.find((s) => s.id === id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    const {
      matricNumber,
      level,
      academicStatus,
      cgpa,
      totalCreditsEarned,
      emergencyContact,
      nextOfKin,
      fullName,
      phone,
      photoUrl,
      programmeId,
      departmentId,
      schoolId
    } = req.body;
    if (matricNumber !== void 0) student.matricNumber = String(matricNumber).trim();
    if (level !== void 0) student.level = level;
    if (academicStatus !== void 0) student.academicStatus = academicStatus;
    if (cgpa !== void 0) student.cgpa = Number(cgpa);
    if (totalCreditsEarned !== void 0) student.totalCreditsEarned = Number(totalCreditsEarned);
    if (emergencyContact !== void 0) student.emergencyContact = emergencyContact;
    if (nextOfKin !== void 0) student.nextOfKin = nextOfKin;
    if (photoUrl !== void 0) student.photoUrl = photoUrl;
    if (programmeId !== void 0) student.programmeId = programmeId;
    if (departmentId !== void 0) student.departmentId = departmentId;
    if (schoolId !== void 0) student.schoolId = schoolId;
    const usr = state.users.find((u) => u.id === student.userId);
    if (usr) {
      if (fullName !== void 0) usr.fullName = String(fullName).trim();
      if (phone !== void 0) usr.phone = phone;
      if (photoUrl !== void 0) usr.photoUrl = photoUrl;
    }
    import_db.db.saveState();
    return res.json({ success: true, student });
  }
);
apiRouter.delete(
  "/students/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.students.findIndex((s) => s.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Student not found." });
    state.students.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Student record deleted." });
  }
);
apiRouter.get("/students/me", import_authMiddleware.authenticateToken, (req, res) => {
  const user = req.user;
  const state = import_db.db.getState();
  const student = state.students.find((s) => s.userId === user.id);
  if (!student) {
    return res.status(404).json({ success: false, message: "Student profile not found." });
  }
  const prog = state.programmes.find((p) => p.id === student.programmeId);
  const dept = state.departments.find((d) => d.id === student.departmentId);
  const school = state.schools.find((s) => s.id === student.schoolId);
  const app = state.applications.find((a) => a.userId === user.id);
  return res.json({
    success: true,
    student: {
      ...student,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      photoUrl: student.photoUrl || user.photoUrl || app?.photoUrl || "",
      programmeName: prog?.name,
      departmentName: dept?.name,
      schoolName: school?.name
    }
  });
});
apiRouter.get(
  "/registrations",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "HOD", "LECTURER"),
  (req, res) => {
    const { session, semester, studentId } = req.query;
    const state = import_db.db.getState();
    let list = state.registrations;
    const actorRole = req.user.role;
    if (actorRole === "HOD") {
      const departmentId = req.user.departmentId;
      const departmentCourseIds = new Set(state.courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
      list = departmentId ? list.filter((registration) => registration.courseIds.every((courseId) => departmentCourseIds.has(courseId))) : [];
    }
    if (actorRole === "LECTURER") {
      const assignedCourseIds = new Set(state.courses.filter((course) => course.lecturerId === req.user.id).map((course) => course.id));
      list = list.filter((registration) => registration.status === "APPROVED_BY_HOD" && registration.courseIds.some((courseId) => assignedCourseIds.has(courseId))).map((registration) => ({
        ...registration,
        courseIds: registration.courseIds.filter((courseId) => assignedCourseIds.has(courseId))
      }));
    }
    if (session) list = list.filter((r) => r.session === session);
    if (semester) list = list.filter((r) => r.semester === semester);
    if (studentId) list = list.filter((r) => r.studentId === studentId);
    const registrations = list.map((registration) => {
      const student = state.students.find((s) => s.id === registration.studentId);
      const user = student ? state.users.find((u) => u.id === student.userId) : void 0;
      const courses = registration.courseIds.map((courseId) => state.courses.find((course) => course.id === courseId)).filter(Boolean).map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
        creditUnits: course.creditUnits,
        level: course.level,
        semester: course.semester,
        lecturerName: course.lecturerName
      }));
      return {
        ...registration,
        studentName: user?.fullName || "Unknown Student",
        matricNumber: student?.matricNumber || "",
        programmeName: state.programmes.find((p) => p.id === student?.programmeId)?.name || "",
        departmentName: state.departments.find((d) => d.id === student?.departmentId)?.name || "",
        courses
      };
    });
    return res.json({ success: true, registrations });
  }
);
apiRouter.get("/registrations/my-registration", import_authMiddleware.authenticateToken, (req, res) => {
  const state = import_db.db.getState();
  const student = state.students.find((s) => s.userId === req.user.id);
  if (!student) {
    return res.status(404).json({ success: false, message: "Student record not found." });
  }
  const reg = state.registrations.find(
    (r) => r.studentId === student.id && r.session === state.settings.currentSession && r.semester === state.settings.currentSemester
  );
  return res.json({ success: true, registration: reg || null });
});
apiRouter.post("/registrations/register", import_authMiddleware.authenticateToken, (req, res) => {
  const state = import_db.db.getState();
  const student = state.students.find((s) => s.userId === req.user.id);
  if (!student) {
    return res.status(403).json({ success: false, message: "Only active students can register courses." });
  }
  const { courseIds } = req.body;
  if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
    return res.status(400).json({ success: false, message: "Must select at least one course." });
  }
  const courses = state.courses.filter((c) => courseIds.includes(c.id));
  const totalCredits = courses.reduce((sum, c) => sum + c.creditUnits, 0);
  const existing = state.registrations.find(
    (r) => r.studentId === student.id && r.session === state.settings.currentSession && r.semester === state.settings.currentSemester
  );
  if (existing && existing.status !== "REJECTED") {
    return res.status(409).json({
      success: false,
      message: "Your course registration has already been submitted. It cannot be changed unless it is rejected by the reviewing officer.",
      registration: existing
    });
  }
  if (courses.length !== new Set(courseIds).size) {
    return res.status(400).json({ success: false, message: "One or more selected courses are invalid." });
  }
  const registrationData = {
    id: existing?.id || "reg-" + Date.now(),
    studentId: student.id,
    session: state.settings.currentSession,
    semester: state.settings.currentSemester,
    level: student.level,
    courseIds,
    totalCredits,
    status: "SUBMITTED",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (existing) {
    const idx = state.registrations.findIndex((r) => r.id === existing.id);
    state.registrations[idx] = registrationData;
  } else {
    state.registrations.push(registrationData);
  }
  import_db.db.saveState();
  import_db.db.logAudit({
    userId: req.user.id,
    userEmail: req.user.email,
    action: "COURSE_REGISTRATION_SUBMITTED",
    resource: "REGISTRATION",
    details: { totalCredits, coursesCount: courseIds.length },
    ipAddress: req.ip
  });
  return res.json({ success: true, registration: registrationData });
});
apiRouter.patch(
  "/registrations/:id/approve",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "HOD"),
  (req, res) => {
    const { id } = req.params;
    const reg = import_db.db.getState().registrations.find((r) => r.id === id);
    if (!reg) {
      return res.status(404).json({ success: false, message: "Registration not found." });
    }
    if (req.user.role === "HOD") {
      const departmentId = req.user.departmentId;
      const allowedCourseIds = new Set(import_db.db.getState().courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
      if (!departmentId || !reg.courseIds.every((courseId) => allowedCourseIds.has(courseId))) return res.status(403).json({ success: false, message: "You can only approve registrations for your department." });
    }
    if (reg.status === "APPROVED_BY_HOD") {
      return res.status(409).json({ success: false, message: "This registration has already been approved." });
    }
    if (reg.status !== "SUBMITTED") {
      return res.status(400).json({ success: false, message: "Only submitted registrations can be approved." });
    }
    reg.status = "APPROVED_BY_HOD";
    reg.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
    reg.approvedBy = `${req.user.fullName} (${req.user.role})`;
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "COURSE_REGISTRATION_APPROVED",
      resource: "REGISTRATION",
      details: { registrationId: id, approvedBy: reg.approvedBy },
      ipAddress: req.ip
    });
    return res.json({ success: true, registration: reg });
  }
);
apiRouter.post(
  "/registrations/approve-bulk",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "HOD"),
  (req, res) => {
    const { registrationIds, session, semester } = req.body;
    const state = import_db.db.getState();
    if (!Array.isArray(registrationIds) && !session && !semester) {
      return res.status(400).json({ success: false, message: "Provide registrationIds or a session/semester filter." });
    }
    const selectedIds = Array.isArray(registrationIds) ? new Set(registrationIds) : null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let approvedCount = 0;
    for (const registration of state.registrations) {
      const selected = selectedIds ? selectedIds.has(registration.id) : (!session || registration.session === session) && (!semester || registration.semester === semester);
      const hodDepartmentId = req.user.role === "HOD" ? req.user.departmentId : void 0;
      const hodCourseIds = hodDepartmentId ? new Set(state.courses.filter((course) => course.departmentId === hodDepartmentId).map((course) => course.id)) : null;
      const withinHodDepartment = req.user.role !== "HOD" || Boolean(hodDepartmentId && registration.courseIds.every((courseId) => Boolean(hodCourseIds?.has(courseId))));
      if (selected && withinHodDepartment && registration.status === "SUBMITTED") {
        registration.status = "APPROVED_BY_HOD";
        registration.approvedAt = now;
        registration.approvedBy = `${req.user.fullName} (${req.user.role})`;
        approvedCount++;
      }
    }
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "COURSE_REGISTRATIONS_BULK_APPROVED",
      resource: "REGISTRATION",
      details: { approvedCount, registrationIds: Array.isArray(registrationIds) ? registrationIds : void 0, session, semester },
      ipAddress: req.ip
    });
    return res.json({ success: true, approvedCount });
  }
);
apiRouter.patch(
  "/registrations/:id/reject",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "HOD"),
  (req, res) => {
    const { id } = req.params;
    const reg = import_db.db.getState().registrations.find((r) => r.id === id);
    if (!reg) return res.status(404).json({ success: false, message: "Registration not found." });
    if (req.user.role === "HOD") {
      const departmentId = req.user.departmentId;
      const allowedCourseIds = new Set(import_db.db.getState().courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
      if (!departmentId || !reg.courseIds.every((courseId) => allowedCourseIds.has(courseId))) return res.status(403).json({ success: false, message: "You can only reject registrations for your department." });
    }
    reg.status = "REJECTED";
    reg.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
    reg.approvedBy = `${req.user.fullName} (${req.user.role})`;
    import_db.db.saveState();
    return res.json({ success: true, registration: reg });
  }
);
apiRouter.put(
  "/registrations/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "HOD"),
  (req, res) => {
    const { id } = req.params;
    const reg = import_db.db.getState().registrations.find((r) => r.id === id);
    if (!reg) return res.status(404).json({ success: false, message: "Registration not found." });
    if (req.user.role === "HOD") {
      const departmentId = req.user.departmentId;
      const allowedCourseIds = new Set(import_db.db.getState().courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
      if (!departmentId || !reg.courseIds.every((courseId) => allowedCourseIds.has(courseId))) return res.status(403).json({ success: false, message: "You can only edit registrations for your department." });
    }
    if (reg.status === "APPROVED_BY_HOD") {
      return res.status(409).json({ success: false, message: "Approved registrations are locked against changes." });
    }
    const { courseIds } = req.body;
    if (courseIds !== void 0) {
      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return res.status(400).json({ success: false, message: "At least one course must be selected." });
      }
      const state = import_db.db.getState();
      const courses = state.courses.filter((c) => courseIds.includes(c.id));
      if (courses.length !== new Set(courseIds).size) {
        return res.status(400).json({ success: false, message: "One or more selected courses are invalid." });
      }
      reg.courseIds = courseIds;
      reg.totalCredits = courses.reduce((sum, course) => sum + course.creditUnits, 0);
    }
    import_db.db.saveState();
    return res.json({ success: true, registration: reg });
  }
);
apiRouter.delete(
  "/registrations/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.registrations.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Registration not found." });
    state.registrations.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Registration deleted." });
  }
);
function recalculateStudentAcademicTotals(state, studentId) {
  const studentResults = state.results.filter((r) => r.studentId === studentId && r.status === "PUBLISHED");
  const student = state.students.find((s) => s.id === studentId);
  if (!student || studentResults.length === 0) return;
  let totalWeightedPoints = 0;
  let totalUnits = 0;
  let earnedCredits = 0;
  for (const r of studentResults) {
    const crs = state.courses.find((c) => c.id === r.courseId);
    const units = crs?.creditUnits || 3;
    totalWeightedPoints += r.gradePoint * units;
    totalUnits += units;
    if (r.gradePoint > 0) earnedCredits += units;
  }
  if (totalUnits > 0) {
    student.cgpa = Number((totalWeightedPoints / totalUnits).toFixed(2));
    student.totalCreditsEarned = earnedCredits;
  }
}
apiRouter.get("/results", import_authMiddleware.authenticateToken, (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "EXAM_OFFICER", "HOD", "LECTURER"), (req, res) => {
  const { courseId, session, semester, studentId, status } = req.query;
  let list = import_db.db.getState().results;
  if (courseId) list = list.filter((r) => r.courseId === courseId);
  if (session) list = list.filter((r) => r.session === session);
  if (semester) list = list.filter((r) => r.semester === semester);
  if (studentId) list = list.filter((r) => r.studentId === studentId);
  if (status) list = list.filter((r) => r.status === status);
  const state = import_db.db.getState();
  const role = req.user.role;
  if (role === "LECTURER") {
    const assignedCourseIds = new Set(state.courses.filter((c) => c.lecturerId === req.user.id).map((c) => c.id));
    list = list.filter((r) => assignedCourseIds.has(r.courseId));
  }
  if (role === "HOD") {
    const departmentId = req.user.departmentId;
    const departmentCourseIds = new Set(state.courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
    list = departmentId ? list.filter((result) => departmentCourseIds.has(result.courseId)) : [];
  }
  return res.json({ success: true, results: list });
});
apiRouter.get(
  "/results/neon-attempts",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "LECTURER", "EXAM_OFFICER"),
  async (req, res) => {
    try {
      const state = import_db.db.getState();
      const allowedStatuses = ["SUBMITTED", "VERIFIED", "APPROVED", "PUBLISHED", "INVALIDATED", "CANCELLED"];
      const queryFilters = [
        ["studentId", req.query.studentId, 200],
        ["courseId", req.query.courseId, 200],
        ["session", req.query.session, 40]
      ];
      for (const [label, value, maxLength] of queryFilters) {
        if (value !== void 0 && (typeof value !== "string" || !value.trim() || value.trim().length > maxLength)) {
          return res.status(400).json({ success: false, message: `Invalid ${label} filter.` });
        }
      }
      if (req.query.semester !== void 0 && (typeof req.query.semester !== "string" || !["First Semester", "Second Semester"].includes(req.query.semester))) {
        return res.status(400).json({ success: false, message: "Invalid semester filter." });
      }
      if (req.query.status !== void 0 && (typeof req.query.status !== "string" || !allowedStatuses.includes(req.query.status))) {
        return res.status(400).json({ success: false, message: "Invalid result status filter." });
      }
      const filters = {
        studentId: typeof req.query.studentId === "string" ? req.query.studentId.trim() : void 0,
        courseId: typeof req.query.courseId === "string" ? req.query.courseId.trim() : void 0,
        academicSession: typeof req.query.session === "string" ? req.query.session.trim() : void 0,
        semester: req.query.semester
      };
      const attempts = await (0, import_academicResultNeonService.listAcademicResultAttempts)(filters);
      const assignedCourseIds = req.user.role === "LECTURER" ? new Set(state.courses.filter((course) => course.lecturerId === req.user.id).map((course) => course.id)) : null;
      const results = attempts.filter((attempt) => !assignedCourseIds || assignedCourseIds.has(String(attempt.course_id))).filter((attempt) => req.query.status === void 0 || attempt.latest_event_type === req.query.status).map((attempt) => {
        const student = state.students.find((item) => item.id === attempt.student_id);
        const user = student ? state.users.find((item) => item.id === student.userId) : void 0;
        return {
          id: attempt.result_attempt_id,
          legacyResultId: attempt.legacy_result_id,
          courseId: attempt.course_id,
          studentId: attempt.student_id,
          matricNumber: student?.matricNumber || "",
          studentName: user?.fullName || "Student",
          session: attempt.academic_session,
          semester: attempt.semester,
          attemptNumber: attempt.attempt_number,
          caScore: Number(attempt.ca_score),
          examScore: Number(attempt.exam_score),
          totalScore: Number(attempt.total_score),
          grade: attempt.grade,
          gradePoint: Number(attempt.grade_point),
          status: attempt.latest_event_type,
          submittedBy: attempt.entered_by,
          latestEvent: {
            actorUserId: attempt.latest_event_actor_user_id,
            reason: attempt.latest_event_reason,
            at: attempt.latest_event_at
          },
          createdAt: attempt.created_at
        };
      });
      return res.json({ success: true, results, source: "NEON_ATTEMPT_LEDGER" });
    } catch {
      return res.status(503).json({
        success: false,
        message: "Neon result attempts are temporarily unavailable."
      });
    }
  }
);
apiRouter.post(
  "/results/neon-attempts/:id/events",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "EXAM_OFFICER"),
  async (req, res) => {
    const resultAttemptId = String(req.params.id || "").trim();
    const { eventType, idempotencyKey, reason } = req.body || {};
    const allowedEvents = ["VERIFIED", "APPROVED", "PUBLISHED"];
    if (!resultAttemptId || resultAttemptId.length > 200) {
      return res.status(400).json({ success: false, message: "A valid result attempt ID is required." });
    }
    if (typeof eventType !== "string" || !allowedEvents.includes(eventType)) {
      return res.status(400).json({ success: false, message: "Only VERIFIED, APPROVED, or PUBLISHED events may be recorded here." });
    }
    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.trim().length > 200) {
      return res.status(400).json({ success: false, message: "A valid idempotency key is required." });
    }
    if (reason !== void 0 && (typeof reason !== "string" || reason.length > 1e3)) {
      return res.status(400).json({ success: false, message: "The reason must be text no longer than 1000 characters." });
    }
    try {
      const outcome = await (0, import_academicResultNeonService.appendAcademicResultEvent)({
        resultAttemptId,
        eventType,
        actorUserId: req.user.id,
        idempotencyKey: idempotencyKey.trim(),
        reason: typeof reason === "string" ? reason.trim() : void 0
      });
      if (outcome.created) {
        try {
          import_db.db.logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: `ACADEMIC_RESULT_${eventType}`,
            resource: "ACADEMIC_RESULT_ATTEMPT",
            details: { resultAttemptId, eventId: outcome.event.id },
            ipAddress: req.ip
          });
        } catch (auditError) {
          console.error("Failed to write audit log for committed academic result event.", {
            eventId: outcome.event.id,
            error: auditError instanceof Error ? auditError.message : "Unknown audit error"
          });
        }
      }
      return res.status(outcome.created ? 201 : 200).json({
        success: true,
        created: outcome.created,
        event: {
          id: outcome.event.id,
          resultAttemptId: outcome.event.result_attempt_id,
          eventType: outcome.event.event_type,
          actorUserId: outcome.event.actor_user_id,
          createdAt: outcome.event.created_at
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Academic result attempt not found.") {
        return res.status(404).json({ success: false, message: "Academic result attempt not found." });
      }
      return res.status(409).json({
        success: false,
        message: "The result workflow transition was rejected. Check the current stage and use a new idempotency key only for a new action."
      });
    }
  }
);
apiRouter.get("/results/my-results", import_authMiddleware.authenticateToken, (req, res) => {
  const state = import_db.db.getState();
  const student = state.students.find((s) => s.userId === req.user.id);
  if (!student) {
    return res.status(404).json({ success: false, message: "Student record not found." });
  }
  const studentResults = state.results.filter((r) => r.studentId === student.id).map((r) => {
    if (r.status === "PUBLISHED") return r;
    return {
      id: r.id,
      courseId: r.courseId,
      studentId: r.studentId,
      matricNumber: r.matricNumber,
      studentName: r.studentName,
      session: r.session,
      semester: r.semester,
      status: r.status
    };
  });
  return res.json({ success: true, results: studentResults });
});
apiRouter.post(
  "/results/score-entry",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "LECTURER"),
  (req, res) => {
    const { courseId, studentId, matricNumber, studentName, session, semester, caScore, examScore } = req.body;
    if (!courseId || !studentId) {
      return res.status(400).json({ success: false, message: "Course and student must be specified." });
    }
    const state = import_db.db.getState();
    const targetCourse = state.courses.find((c) => c.id === courseId);
    if (!targetCourse) return res.status(404).json({ success: false, message: "Course not found." });
    if (req.user.role === "LECTURER" && targetCourse.lecturerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "You can only enter scores for courses assigned to you." });
    }
    const targetSession = session || state.settings.currentSession;
    const targetSemester = semester || state.settings.currentSemester;
    const ca = Math.max(0, Math.min(Number(caScore || 0), state.settings.caMaxMarks));
    const ex = Math.max(0, Math.min(Number(examScore || 0), state.settings.examMaxMarks));
    const total = ca + ex;
    const { grade, gradePoint } = (0, import_db.computeGradeAndPoints)(total);
    const existing = state.results.find(
      (r) => r.courseId === courseId && r.studentId === studentId && r.session === targetSession && r.semester === targetSemester
    );
    const nextStatus = "SUBMITTED";
    const resultRecord = {
      id: existing?.id || "res-" + Date.now() + "-" + Math.floor(Math.random() * 100),
      courseId,
      studentId,
      matricNumber: matricNumber || "EDOCASTI/ND/2024/0000",
      studentName: studentName || "Student",
      session: targetSession,
      semester: targetSemester,
      caScore: ca,
      examScore: ex,
      totalScore: total,
      grade,
      gradePoint,
      status: nextStatus,
      submittedBy: `${req.user.fullName} (${req.user.role})`
    };
    if (existing) {
      const idx = state.results.findIndex((r) => r.id === existing.id);
      state.results[idx] = resultRecord;
    } else {
      state.results.push(resultRecord);
    }
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "RESULT_SCORE_ENTERED",
      resource: "RESULT",
      details: { courseId, studentId, ca, exam: ex, total, grade },
      ipAddress: req.ip
    });
    return res.json({ success: true, result: resultRecord });
  }
);
apiRouter.patch(
  "/results/:id/hod-approve",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("HOD"),
  (req, res) => {
    const state = import_db.db.getState();
    const result = state.results.find((item) => item.id === req.params.id);
    if (!result) return res.status(404).json({ success: false, message: "Result not found." });
    const departmentId = req.user.departmentId;
    const course = state.courses.find((item) => item.id === result.courseId);
    if (!departmentId || !(0, import_resultApprovalAuthorization.canHodApproveResult)(req.user, course, result)) {
      return res.status(403).json({ success: false, message: "You can only approve submitted results for courses in your department." });
    }
    result.status = "HOD_APPROVED";
    result.hodApprovedAt = (/* @__PURE__ */ new Date()).toISOString();
    result.hodApprovedBy = `${req.user.fullName} (${req.user.role})`;
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "RESULT_HOD_APPROVED",
      resource: "RESULT",
      details: { resultId: result.id, courseId: result.courseId, studentId: result.studentId },
      ipAddress: req.ip
    });
    return res.json({ success: true, result });
  }
);
apiRouter.post(
  "/results/hod-approve-bulk",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("HOD"),
  (req, res) => {
    const { resultIds, courseId } = req.body || {};
    if (resultIds !== void 0 && (!Array.isArray(resultIds) || resultIds.some((id) => typeof id !== "string"))) {
      return res.status(400).json({ success: false, message: "Result IDs must be an array of valid IDs." });
    }
    const requestedIds = new Set(resultIds || []);
    const hasCourseFilter = typeof courseId === "string" && courseId.trim().length > 0;
    if (requestedIds.size === 0 && !hasCourseFilter) {
      return res.status(400).json({ success: false, message: "Select submitted results or specify a course." });
    }
    const departmentId = req.user.departmentId;
    if (!departmentId) return res.status(403).json({ success: false, message: "Your account has no assigned department." });
    const state = import_db.db.getState();
    const departmentCourseIds = new Set(state.courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
    if (hasCourseFilter && !departmentCourseIds.has(courseId)) {
      return res.status(403).json({ success: false, message: "You can only approve results for courses in your department." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const eligibleResults = state.results.filter((result) => {
      const course = state.courses.find((item) => item.id === result.courseId);
      return (0, import_resultApprovalAuthorization.canHodApproveResult)(req.user, course, result) && departmentCourseIds.has(result.courseId) && (requestedIds.has(result.id) || hasCourseFilter && result.courseId === courseId);
    });
    for (const result of eligibleResults) {
      result.status = "HOD_APPROVED";
      result.hodApprovedAt = now;
      result.hodApprovedBy = `${req.user.fullName} (${req.user.role})`;
    }
    if (eligibleResults.length > 0) import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "RESULTS_HOD_BULK_APPROVED",
      resource: "RESULT",
      details: { count: eligibleResults.length, resultIds: eligibleResults.map((result) => result.id) },
      ipAddress: req.ip
    });
    return res.json({
      success: true,
      approvedCount: eligibleResults.length,
      skippedCount: Math.max(0, requestedIds.size - eligibleResults.length)
    });
  }
);
apiRouter.patch(
  "/results/:id/publish",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "EXAM_OFFICER"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const resItem = state.results.find((r) => r.id === id);
    if (!resItem) {
      return res.status(404).json({ success: false, message: "Result not found." });
    }
    if (!(0, import_resultApprovalAuthorization.isHodApprovedForPublication)(resItem)) {
      return res.status(409).json({ success: false, message: "Results must be approved by the HOD before Exam Officer moderation and publication." });
    }
    if (req.user.role === "EXAM_OFFICER") {
      const course = state.courses.find((item) => item.id === resItem.courseId);
      if (!(0, import_resultApprovalAuthorization.canExamOfficerModerateResult)(req.user, course, resItem)) {
        return res.status(403).json({ success: false, message: "You can only moderate HOD-approved results for your department." });
      }
    }
    resItem.status = "PUBLISHED";
    resItem.publishedAt = (/* @__PURE__ */ new Date()).toISOString();
    resItem.approvedBy = `${req.user.fullName} (${req.user.role})`;
    recalculateStudentAcademicTotals(state, resItem.studentId);
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "RESULT_APPROVED_AND_PUBLISHED",
      resource: "RESULT",
      details: { resultId: id, courseId: resItem.courseId, studentId: resItem.studentId },
      ipAddress: req.ip
    });
    return res.json({ success: true, result: resItem });
  }
);
apiRouter.post(
  "/results/approve-bulk",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "EXAM_OFFICER"),
  (req, res) => {
    const { resultIds, courseId } = req.body || {};
    if (resultIds !== void 0 && (!Array.isArray(resultIds) || resultIds.some((id) => typeof id !== "string"))) {
      return res.status(400).json({ success: false, message: "Result IDs must be an array of valid IDs." });
    }
    const requestedIds = new Set(resultIds || []);
    const hasCourseFilter = typeof courseId === "string" && courseId.trim().length > 0;
    if (requestedIds.size === 0 && !hasCourseFilter) {
      return res.status(400).json({ success: false, message: "Select submitted results or specify a course." });
    }
    const state = import_db.db.getState();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const touchedStudents = /* @__PURE__ */ new Set();
    const eligibleResults = state.results.filter((result) => {
      const course = state.courses.find((item) => item.id === result.courseId);
      if (!(0, import_resultApprovalAuthorization.isHodApprovedForPublication)(result)) return false;
      if (req.user.role === "EXAM_OFFICER" && !(0, import_resultApprovalAuthorization.canExamOfficerModerateResult)(req.user, course, result)) return false;
      const matchesId = requestedIds.has(result.id);
      const matchesCourse = hasCourseFilter && result.courseId === courseId;
      return matchesId || matchesCourse;
    });
    for (const result of eligibleResults) {
      result.status = "PUBLISHED";
      result.publishedAt = now;
      result.approvedBy = `${req.user.fullName} (${req.user.role})`;
      touchedStudents.add(result.studentId);
    }
    touchedStudents.forEach((studentId) => recalculateStudentAcademicTotals(state, studentId));
    if (eligibleResults.length > 0) import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "RESULTS_BULK_APPROVED",
      resource: "RESULT",
      details: {
        count: eligibleResults.length,
        requestedCount: requestedIds.size,
        courseId: hasCourseFilter ? courseId : void 0,
        resultIds: eligibleResults.map((result) => result.id)
      },
      ipAddress: req.ip
    });
    return res.json({
      success: true,
      approvedCount: eligibleResults.length,
      skippedCount: Math.max(0, requestedIds.size - eligibleResults.length)
    });
  }
);
apiRouter.put(
  "/results/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "LECTURER"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const resItem = state.results.find((r) => r.id === id);
    if (!resItem) {
      return res.status(404).json({ success: false, message: "Result not found." });
    }
    const resultCourse = state.courses.find((c) => c.id === resItem.courseId);
    if (req.user.role === "LECTURER" && resultCourse?.lecturerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "You can only update results for courses assigned to you." });
    }
    if (req.user.role === "LECTURER" && req.body.status !== void 0) {
      return res.status(403).json({ success: false, message: "Lecturers cannot approve or publish results." });
    }
    const { caScore, examScore } = req.body;
    if (req.body.status !== void 0) {
      return res.status(400).json({ success: false, message: "Result status can only be changed through the approval workflow." });
    }
    if (caScore !== void 0) {
      resItem.caScore = Math.max(0, Math.min(Number(caScore), state.settings.caMaxMarks));
    }
    if (examScore !== void 0) {
      resItem.examScore = Math.max(0, Math.min(Number(examScore), state.settings.examMaxMarks));
    }
    resItem.totalScore = resItem.caScore + resItem.examScore;
    const { grade, gradePoint } = (0, import_db.computeGradeAndPoints)(resItem.totalScore);
    resItem.grade = grade;
    resItem.gradePoint = gradePoint;
    resItem.status = "SUBMITTED";
    delete resItem.hodApprovedBy;
    delete resItem.hodApprovedAt;
    delete resItem.approvedBy;
    delete resItem.publishedAt;
    recalculateStudentAcademicTotals(state, resItem.studentId);
    import_db.db.saveState();
    return res.json({ success: true, result: resItem });
  }
);
apiRouter.delete(
  "/results/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "EXAM_OFFICER"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.results.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Result not found." });
    state.results.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Result record deleted." });
  }
);
apiRouter.delete(
  "/results/student/:studentId",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN"),
  (req, res) => {
    const { studentId } = req.params;
    const state = import_db.db.getState();
    const student = state.students.find((item) => item.id === studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }
    const originalCount = state.results.length;
    state.results = state.results.filter((result) => result.studentId !== studentId);
    const deletedCount = originalCount - state.results.length;
    student.cgpa = 0;
    student.totalCreditsEarned = 0;
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "STUDENT_RESULTS_CLEARED",
      resource: "RESULT",
      details: {
        studentId: student.id,
        matricNumber: student.matricNumber,
        studentName: student.matricNumber,
        deletedCount
      },
      ipAddress: req.ip
    });
    return res.json({
      success: true,
      message: deletedCount > 0 ? "Student results cleared." : "No result records were found for this student.",
      deletedCount
    });
  }
);
function computeHonoursClassification(cgpa) {
  if (cgpa >= 3.5) return "Distinction";
  if (cgpa >= 3) return "Upper Credit";
  if (cgpa >= 2.5) return "Lower Credit";
  if (cgpa >= 2) return "Pass";
  return "Probation / Incomplete";
}
apiRouter.get(
  "/documents",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "REGISTRAR"),
  (req, res) => {
    const state = import_db.db.getState();
    const list = (state.issuedDocuments || []).map((doc) => {
      const inv = state.invoices.find((i) => i.id === doc.invoiceId);
      const publishedResults = state.results.filter((r) => r.studentId === doc.studentId && r.status === "PUBLISHED").map((r) => {
        const crs = state.courses.find((c) => c.id === r.courseId);
        return { ...r, courseCode: crs?.code || r.courseId, courseTitle: crs?.title || "Course", creditUnits: crs?.creditUnits || 3 };
      });
      return {
        ...doc,
        paymentStatus: inv?.status || "UNPAID",
        resultsSnapshot: publishedResults
      };
    });
    return res.json({ success: true, documents: list });
  }
);
apiRouter.get("/documents/my-documents", import_authMiddleware.authenticateToken, (req, res) => {
  const state = import_db.db.getState();
  const student = state.students.find((s) => s.userId === req.user.id);
  if (!student) {
    return res.status(404).json({ success: false, message: "Student profile not found." });
  }
  const usr = state.users.find((u) => u.id === student.userId);
  const admissionApp = state.applications.find((a) => a.userId === student.userId && a.status === "ACCEPTED");
  const programme = state.programmes.find((p) => p.id === student.programmeId);
  const department = state.departments.find((d) => d.id === student.departmentId);
  const school = state.schools.find((s) => s.id === student.schoolId);
  const admissionLetter = admissionApp ? [{
    id: `admission-${admissionApp.id}`,
    studentId: student.id,
    type: "ADMISSION_LETTER",
    title: "Official Admission Letter",
    documentNumber: admissionApp.applicationNumber,
    matricNumber: student.matricNumber,
    studentName: usr?.fullName || admissionApp.firstName + " " + admissionApp.lastName,
    programmeName: programme?.name || "National Diploma Programme",
    departmentName: department?.name || "",
    schoolName: school?.name || "",
    level: student.level,
    photoUrl: student.photoUrl || usr?.photoUrl || admissionApp.photoUrl || "",
    session: admissionApp.session,
    generatedAt: admissionApp.decisionAt || admissionApp.submittedAt,
    generatedBy: admissionApp.reviewedBy || "Admissions Office",
    paymentStatus: "NOT_REQUIRED",
    isUnlocked: true,
    remarks: "Admission offer accepted. This letter confirms the student admission."
  }] : [];
  const issuedDocs = (state.issuedDocuments || []).filter((d) => d.studentId === student.id).map((doc) => {
    const inv = state.invoices.find((i) => i.id === doc.invoiceId);
    const paymentStatus = inv?.status || "UNPAID";
    const isUnlocked = paymentStatus === "PAID";
    const publishedResults = isUnlocked ? state.results.filter((r) => r.studentId === student.id && r.status === "PUBLISHED").map((r) => {
      const crs = state.courses.find((c) => c.id === r.courseId);
      return {
        ...r,
        courseCode: crs?.code || r.courseId,
        courseTitle: crs?.title || "Academic Course",
        creditUnits: crs?.creditUnits || 3
      };
    }) : void 0;
    return {
      ...doc,
      photoUrl: doc.photoUrl || student.photoUrl || usr?.photoUrl || "",
      paymentStatus,
      resultsSnapshot: publishedResults
    };
  });
  const myDocs = [...admissionLetter, ...issuedDocs];
  return res.json({ success: true, documents: myDocs });
});
apiRouter.post(
  "/documents/generate",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "REGISTRAR"),
  (req, res) => {
    const { studentId, type, feeAmount, remarks, classification } = req.body;
    if (!studentId || !type || !["TRANSCRIPT", "FINAL_CERTIFICATE"].includes(type)) {
      return res.status(400).json({ success: false, message: "Valid studentId and document type (TRANSCRIPT or FINAL_CERTIFICATE) are required." });
    }
    const state = import_db.db.getState();
    const student = state.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    const usr = state.users.find((u) => u.id === student.userId);
    const prog = state.programmes.find((p) => p.id === student.programmeId);
    const dept = state.departments.find((d) => d.id === student.departmentId);
    const sch = state.schools.find((s) => s.id === student.schoolId);
    const app = state.applications.find((a) => a.userId === student.userId);
    const existing = (state.issuedDocuments || []).find((d) => d.studentId === studentId && d.type === type);
    if (existing) {
      return res.status(409).json({ success: false, message: `${type === "TRANSCRIPT" ? "Transcript" : "Final Certificate"} has already been generated for this student.` });
    }
    const defaultFee = type === "TRANSCRIPT" ? state.settings.transcriptFee || 1e4 : state.settings.certificateFee || 25e3;
    const resolvedFee = feeAmount !== void 0 ? Number(feeAmount) : defaultFee;
    const inv = {
      id: "inv-doc-" + Date.now(),
      invoiceNumber: `INV/${state.settings.currentSession.slice(0, 4)}/${Math.floor(1e4 + Math.random() * 9e4)}`,
      studentId: student.id,
      session: state.settings.currentSession,
      title: type === "TRANSCRIPT" ? "Official Academic Transcript Processing Fee" : "Final Graduation Certificate Issuance Fee",
      amount: resolvedFee,
      amountPaid: resolvedFee <= 0 ? 0 : 0,
      status: resolvedFee <= 0 ? "PAID" : "UNPAID",
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString().split("T")[0],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    state.invoices.push(inv);
    const docNumber = `${type === "TRANSCRIPT" ? "TRN" : "CERT"}/EDOCASTI/${(/* @__PURE__ */ new Date()).getFullYear()}/${String((state.issuedDocuments?.length || 0) + 1).padStart(4, "0")}`;
    const doc = {
      id: "doc-" + Date.now(),
      studentId: student.id,
      matricNumber: student.matricNumber,
      studentName: usr?.fullName || "Student",
      programmeName: prog?.name || "National Diploma Programme",
      departmentName: dept?.name || "",
      schoolName: sch?.name || "",
      level: student.level,
      photoUrl: student.photoUrl || usr?.photoUrl || app?.photoUrl || "",
      type,
      documentNumber: docNumber,
      title: type === "TRANSCRIPT" ? "Official Academic Transcript" : "Final Diploma / Graduation Certificate",
      session: state.settings.currentSession,
      cgpa: student.cgpa,
      classification: classification || computeHonoursClassification(student.cgpa),
      remarks: remarks || "Completed all academic & practical requirements in good standing.",
      feeAmount: resolvedFee,
      invoiceId: inv.id,
      generatedBy: `${req.user.fullName} (${req.user.role})`,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!state.issuedDocuments) state.issuedDocuments = [];
    state.issuedDocuments.unshift(doc);
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: `${type}_GENERATED`,
      resource: "ISSUED_DOCUMENT",
      details: { documentNumber: docNumber, studentId: student.id, feeAmount: resolvedFee },
      ipAddress: req.ip
    });
    return res.status(201).json({ success: true, document: { ...doc, paymentStatus: inv.status }, invoice: inv });
  }
);
apiRouter.put(
  "/documents/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "REGISTRAR"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const doc = (state.issuedDocuments || []).find((d) => d.id === id);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });
    const { classification, remarks, feeAmount } = req.body;
    if (classification !== void 0) doc.classification = classification;
    if (remarks !== void 0) doc.remarks = remarks;
    if (feeAmount !== void 0) {
      doc.feeAmount = Number(feeAmount);
      const inv = state.invoices.find((i) => i.id === doc.invoiceId);
      if (inv && inv.status !== "PAID") inv.amount = Number(feeAmount);
    }
    import_db.db.saveState();
    return res.json({ success: true, document: doc });
  }
);
apiRouter.delete(
  "/documents/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "REGISTRAR"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = (state.issuedDocuments || []).findIndex((d) => d.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Document not found." });
    state.issuedDocuments.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Issued document deleted." });
  }
);
apiRouter.get("/finance/fee-schedules", (req, res) => {
  return res.json({ success: true, feeSchedules: import_db.db.getState().feeSchedules });
});
apiRouter.post(
  "/finance/fee-schedules",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "BURSAR"),
  (req, res) => {
    const { title, category, level, session, amount, programmeId } = req.body;
    const state = import_db.db.getState();
    const cleanTitle = String(title || "").trim();
    const cleanCategory = String(category || "").trim();
    const cleanSession = String(session || state.settings.currentSession || "").trim();
    const cleanLevel = String(level || "All").trim();
    const allowedLevels = ["All", "ND I", "ND II", "HND I", "HND II"];
    const allowedCategories = ["Tuition", "Acceptance", "Registration", "Laboratory", "Hostel", "Other"];
    if (!cleanTitle || !cleanCategory || amount === void 0 || !cleanSession) {
      return res.status(400).json({ success: false, message: "Fee title, category, amount, and academic session are required." });
    }
    if (!allowedCategories.includes(cleanCategory)) {
      return res.status(400).json({ success: false, message: "Select a valid fee category." });
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: "Fee amount must be a valid non-negative number." });
    }
    if (!allowedLevels.includes(cleanLevel)) {
      return res.status(400).json({ success: false, message: "Select a valid fee level." });
    }
    if (programmeId && !state.programmes.some((programme) => programme.id === String(programmeId))) {
      return res.status(400).json({ success: false, message: "The selected programme does not exist." });
    }
    const newFee = {
      id: "fee-" + Date.now(),
      programmeId: programmeId ? String(programmeId) : void 0,
      title: cleanTitle,
      category: cleanCategory,
      level: cleanLevel,
      session: cleanSession,
      amount: Number(amount)
    };
    import_db.db.getState().feeSchedules.push(newFee);
    import_db.db.saveState();
    return res.status(201).json({ success: true, feeSchedule: newFee });
  }
);
apiRouter.put(
  "/finance/fee-schedules/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "BURSAR"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const fee = state.feeSchedules.find((f) => f.id === id);
    if (!fee) return res.status(404).json({ success: false, message: "Fee schedule item not found." });
    const { title, category, level, session, amount, programmeId } = req.body;
    const allowedLevels = ["All", "ND I", "ND II", "HND I", "HND II"];
    const allowedCategories = ["Tuition", "Acceptance", "Registration", "Laboratory", "Hostel", "Other"];
    const updated = { ...fee };
    if (title !== void 0) updated.title = String(title).trim();
    if (category !== void 0) {
      const cleanCategory = String(category).trim();
      if (!allowedCategories.includes(cleanCategory)) {
        return res.status(400).json({ success: false, message: "Select a valid fee category." });
      }
      updated.category = cleanCategory;
    }
    if (level !== void 0) updated.level = String(level).trim();
    if (session !== void 0) updated.session = String(session).trim();
    if (programmeId !== void 0) updated.programmeId = programmeId ? String(programmeId) : void 0;
    if (amount !== void 0) updated.amount = Number(amount);
    if (!updated.title) return res.status(400).json({ success: false, message: "Fee title cannot be empty." });
    if (!updated.category) return res.status(400).json({ success: false, message: "Fee category cannot be empty." });
    if (!updated.session) return res.status(400).json({ success: false, message: "Academic session cannot be empty." });
    if (!allowedLevels.includes(String(updated.level || "All"))) {
      return res.status(400).json({ success: false, message: "Select a valid fee level." });
    }
    if (!Number.isFinite(Number(updated.amount)) || Number(updated.amount) < 0) {
      return res.status(400).json({ success: false, message: "Fee amount must be a valid non-negative number." });
    }
    if (updated.programmeId && !state.programmes.some((programme) => programme.id === updated.programmeId)) {
      return res.status(400).json({ success: false, message: "The selected programme does not exist." });
    }
    Object.assign(fee, updated);
    import_db.db.saveState();
    return res.json({ success: true, feeSchedule: fee });
  }
);
apiRouter.delete(
  "/finance/fee-schedules/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "BURSAR"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.feeSchedules.findIndex((f) => f.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Fee schedule item not found." });
    state.feeSchedules.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Fee item deleted." });
  }
);
apiRouter.get("/finance/invoices", import_authMiddleware.authenticateToken, (req, res) => {
  const user = req.user;
  if (user.role !== "STUDENT" && !["SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR", "BURSAR"].includes(user.role)) {
    return res.status(403).json({ success: false, message: "You do not have permission to view the fee ledger." });
  }
  const { studentId } = req.query;
  let list = import_db.db.getState().invoices;
  if (user.role === "STUDENT") {
    const student = import_db.db.getState().students.find((s) => s.userId === user.id);
    list = list.filter((invoice) => invoice.studentId === student?.id);
  } else if (studentId) {
    list = list.filter((invoice) => invoice.studentId === studentId);
  }
  return res.json({ success: true, invoices: list });
});
apiRouter.post("/finance/pay", import_authMiddleware.authenticateToken, (req, res) => {
  const { invoiceId, channel } = req.body;
  const state = import_db.db.getState();
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  const payingStudent = state.students.find((student) => student.userId === req.user.id);
  if (req.user.role !== "STUDENT" || !payingStudent || invoice?.studentId !== payingStudent.id) {
    return res.status(403).json({ success: false, message: "You can only pay invoices assigned to your own student account." });
  }
  if (!invoice) {
    return res.status(404).json({ success: false, message: "Invoice not found." });
  }
  const remaining = invoice.amount - invoice.amountPaid;
  if (remaining <= 0) {
    return res.status(400).json({ success: false, message: "Invoice is already fully settled." });
  }
  const ref = `EDOCASTI-TX-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
  const transaction = {
    id: "pay-" + Date.now(),
    reference: ref,
    invoiceId: invoice.id,
    studentId: invoice.studentId,
    amount: remaining,
    channel: channel || "Remita",
    status: "VERIFIED",
    providerReference: `RRR-${Math.floor(1e3 + Math.random() * 9e3)}-${Date.now().toString().slice(-4)}`,
    paidAt: (/* @__PURE__ */ new Date()).toISOString(),
    verifiedBy: "Automated Gateway Reconciler"
  };
  invoice.amountPaid = invoice.amount;
  invoice.status = "PAID";
  state.payments.unshift(transaction);
  import_db.db.saveState();
  import_db.db.logAudit({
    userId: req.user.id,
    userEmail: req.user.email,
    action: "PAYMENT_SETTLED_VERIFIED",
    resource: "FINANCE",
    details: { invoiceId: invoice.id, reference: ref, amount: remaining, channel: transaction.channel },
    ipAddress: req.ip
  });
  return res.json({
    success: true,
    message: "Payment verified and receipt generated successfully.",
    transaction,
    invoice
  });
});
apiRouter.get(
  "/finance/payments",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "BURSAR"),
  (req, res) => {
    return res.json({ success: true, payments: import_db.db.getState().payments });
  }
);
apiRouter.post(
  "/finance/invoices",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "BURSAR"),
  (req, res) => {
    const { studentId, title, amount, session, dueDate, status } = req.body;
    if (!studentId || !title || amount === void 0) {
      return res.status(400).json({ success: false, message: "Student, title, and amount are required." });
    }
    const state = import_db.db.getState();
    const inv = {
      id: "inv-" + Date.now(),
      invoiceNumber: `INV/${state.settings.currentSession.slice(0, 4)}/${Math.floor(1e4 + Math.random() * 9e4)}`,
      studentId,
      session: session || state.settings.currentSession,
      title: String(title).trim(),
      amount: Number(amount),
      amountPaid: status === "PAID" ? Number(amount) : 0,
      status: status || "UNPAID",
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString().split("T")[0],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    state.invoices.unshift(inv);
    import_db.db.saveState();
    return res.status(201).json({ success: true, invoice: inv });
  }
);
apiRouter.put(
  "/finance/invoices/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "BURSAR"),
  (req, res) => {
    const { id } = req.params;
    const inv = import_db.db.getState().invoices.find((i) => i.id === id);
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    const { title, amount, amountPaid, status, dueDate, session } = req.body;
    if (title !== void 0) inv.title = String(title).trim();
    if (amount !== void 0) inv.amount = Number(amount);
    if (amountPaid !== void 0) inv.amountPaid = Number(amountPaid);
    if (status !== void 0) inv.status = status;
    if (dueDate !== void 0) inv.dueDate = dueDate;
    if (session !== void 0) inv.session = session;
    import_db.db.saveState();
    return res.json({ success: true, invoice: inv });
  }
);
apiRouter.delete(
  "/finance/invoices/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "BURSAR"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.invoices.findIndex((i) => i.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Invoice not found." });
    state.invoices.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Invoice deleted." });
  }
);
apiRouter.delete(
  "/finance/payments/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "BURSAR"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.payments.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Payment not found." });
    state.payments.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Payment record deleted." });
  }
);
apiRouter.get("/attendance", import_authMiddleware.authenticateToken, (req, res) => {
  const { courseId } = req.query;
  const user = req.user;
  if (!["SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR", "LECTURER"].includes(user.role)) {
    return res.status(403).json({ success: false, message: "You do not have permission to view attendance records." });
  }
  const state = import_db.db.getState();
  let list = state.attendance;
  if (user.role === "LECTURER") {
    const assignedCourseIds = new Set(state.courses.filter((course) => course.lecturerId === user.id).map((course) => course.id));
    list = list.filter((record) => assignedCourseIds.has(record.courseId));
  }
  if (courseId) list = list.filter((record) => record.courseId === courseId);
  return res.json({ success: true, attendance: list });
});
apiRouter.post(
  "/attendance",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "LECTURER"),
  (req, res) => {
    const { courseId, type, topic, records } = req.body;
    if (!courseId || !topic) {
      return res.status(400).json({ success: false, message: "Course and topic are required." });
    }
    const state = import_db.db.getState();
    const assignedCourse = state.courses.find((course) => course.id === courseId);
    if (!assignedCourse) return res.status(404).json({ success: false, message: "Course not found." });
    if (req.user.role === "LECTURER" && assignedCourse.lecturerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "You can only record attendance for courses assigned to you." });
    }
    const newSession = {
      id: "att-" + Date.now(),
      courseId,
      lecturerId: req.user.id,
      date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      type: type || "Lecture",
      topic,
      records: records || []
    };
    state.attendance.unshift(newSession);
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "ATTENDANCE_SESSION_RECORDED",
      resource: "ATTENDANCE",
      details: { courseId, topic, attendeesCount: records?.length || 0 },
      ipAddress: req.ip
    });
    return res.status(201).json({ success: true, session: newSession });
  }
);
apiRouter.put(
  "/attendance/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "LECTURER", "HOD"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const session = state.attendance.find((a) => a.id === id);
    if (!session) return res.status(404).json({ success: false, message: "Attendance session not found." });
    if (req.user.role === "LECTURER" && session.lecturerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "You can only update attendance sessions you recorded." });
    }
    const { topic, type, date } = req.body;
    if (topic !== void 0) session.topic = String(topic).trim();
    if (type !== void 0) session.type = type;
    if (date !== void 0) session.date = date;
    import_db.db.saveState();
    return res.json({ success: true, session });
  }
);
apiRouter.delete(
  "/attendance/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.attendance.findIndex((a) => a.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Attendance session not found." });
    state.attendance.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Attendance session deleted." });
  }
);
apiRouter.get("/support", import_authMiddleware.authenticateToken, (req, res) => {
  const user = req.user;
  let list = import_db.db.getState().supportTickets;
  if (user.role === "STUDENT" || user.role === "APPLICANT") {
    list = list.filter((ticket) => ticket.userId === user.id);
  } else if (user.role === "BURSAR") {
    list = list.filter((ticket) => ticket.category === "Bursary & Payments");
  } else if (user.role === "ADMISSIONS_OFFICER") {
    list = list.filter((ticket) => ticket.category === "Admissions");
  } else if (user.role === "REGISTRAR") {
    list = list.filter((ticket) => ["Course Registration", "Results"].includes(ticket.category));
  } else if (!["SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR"].includes(user.role)) {
    return res.status(403).json({ success: false, message: "You do not have permission to view support queues." });
  }
  return res.json({ success: true, tickets: list });
});
apiRouter.post("/support", import_authMiddleware.authenticateToken, (req, res) => {
  const user = req.user;
  const { subject, category, priority, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ success: false, message: "Subject and message are required." });
  }
  const state = import_db.db.getState();
  const ticketNumber = `TKT-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(state.supportTickets.length + 42).padStart(4, "0")}`;
  const ticket = {
    id: "tkt-" + Date.now(),
    ticketNumber,
    userId: user.id,
    userName: user.fullName,
    userEmail: user.email,
    subject: subject.trim(),
    category: category || "Admissions",
    priority: priority || "MEDIUM",
    status: "OPEN",
    messages: [
      {
        sender: user.fullName,
        role: user.role,
        message: message.trim(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    ],
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  state.supportTickets.unshift(ticket);
  import_db.db.saveState();
  import_db.db.logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "SUPPORT_TICKET_CREATED",
    resource: "SUPPORT",
    details: { ticketNumber, category, subject },
    ipAddress: req.ip
  });
  return res.status(201).json({ success: true, ticket });
});
apiRouter.post("/support/:id/reply", import_authMiddleware.authenticateToken, (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const user = req.user;
  const ticket = import_db.db.getState().supportTickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Ticket not found." });
  }
  const supportRoles = ["SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR", "REGISTRAR", "ADMISSIONS_OFFICER", "BURSAR"];
  if (ticket.userId !== user.id && !supportRoles.includes(user.role)) {
    return res.status(403).json({ success: false, message: "You can only reply to your own ticket or an authorized support queue." });
  }
  if (ticket.userId !== user.id && user.role === "BURSAR" && ticket.category !== "Bursary & Payments") {
    return res.status(403).json({ success: false, message: "This ticket is outside the Bursar support queue." });
  }
  if (ticket.userId !== user.id && user.role === "ADMISSIONS_OFFICER" && ticket.category !== "Admissions") {
    return res.status(403).json({ success: false, message: "This ticket is outside the Admissions support queue." });
  }
  if (ticket.userId !== user.id && user.role === "REGISTRAR" && !["Course Registration", "Results"].includes(ticket.category)) {
    return res.status(403).json({ success: false, message: "This ticket is outside the Registry support queue." });
  }
  ticket.messages.push({
    sender: user.fullName,
    role: user.role,
    message: message.trim(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (user.role !== "STUDENT" && user.role !== "APPLICANT" && ticket.status === "OPEN") {
    ticket.status = "IN_PROGRESS";
  }
  import_db.db.saveState();
  return res.json({ success: true, ticket });
});
apiRouter.patch(
  "/support/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "REGISTRAR", "ADMISSIONS_OFFICER", "BURSAR"),
  (req, res) => {
    const { id } = req.params;
    const ticket = import_db.db.getState().supportTickets.find((t) => t.id === id);
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
    if (req.user.role === "BURSAR" && ticket.category !== "Bursary & Payments") {
      return res.status(403).json({ success: false, message: "This ticket is outside the Bursar support queue." });
    }
    if (req.user.role === "ADMISSIONS_OFFICER" && ticket.category !== "Admissions") {
      return res.status(403).json({ success: false, message: "This ticket is outside the Admissions support queue." });
    }
    if (req.user.role === "REGISTRAR" && !["Course Registration", "Results"].includes(ticket.category)) {
      return res.status(403).json({ success: false, message: "This ticket is outside the Registry support queue." });
    }
    const { status, priority, subject, category } = req.body;
    if (status !== void 0) ticket.status = status;
    if (priority !== void 0) ticket.priority = priority;
    if (subject !== void 0) ticket.subject = String(subject).trim();
    if (category !== void 0) ticket.category = category;
    import_db.db.saveState();
    return res.json({ success: true, ticket });
  }
);
apiRouter.delete(
  "/support/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const idx = state.supportTickets.findIndex((t) => t.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Ticket not found." });
    state.supportTickets.splice(idx, 1);
    import_db.db.saveState();
    return res.json({ success: true, message: "Support ticket deleted." });
  }
);
apiRouter.get(
  "/audit",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { action, search, limit = 50 } = req.query;
    let list = import_db.db.getState().auditLogs;
    if (action) list = list.filter((l) => l.action === action);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (l) => l.action.toLowerCase().includes(q) || l.userEmail?.toLowerCase().includes(q) || l.resource.toLowerCase().includes(q)
      );
    }
    return res.json({ success: true, logs: list.slice(0, Number(limit)) });
  }
);
apiRouter.get("/dashboard/stats", import_authMiddleware.authenticateToken, (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN", "RECTOR"), (req, res) => {
  const state = import_db.db.getState();
  const studentsCount = state.students.length;
  const applicantsCount = state.applications.length;
  const staffCount = state.users.filter((u) => ["LECTURER", "HOD", "DEAN", "REGISTRAR", "BURSAR"].includes(u.role)).length;
  const coursesCount = state.courses.length;
  const totalRevenue = state.payments.filter((p) => p.status === "VERIFIED").reduce((sum, p) => sum + p.amount, 0);
  const pendingApplications = state.applications.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length;
  const pendingRegistrations = state.registrations.filter((r) => r.status === "SUBMITTED").length;
  return res.json({
    success: true,
    stats: {
      studentsCount,
      applicantsCount,
      staffCount,
      coursesCount,
      totalRevenue,
      pendingApplications,
      pendingRegistrations,
      schoolsCount: state.schools.length,
      departmentsCount: state.departments.length,
      programmesCount: state.programmes.length
    }
  });
});
apiRouter.get("/cms/news", (req, res) => {
  const { category, status, sliderOnly, search } = req.query;
  let list = [...import_db.db.getState().newsArticles];
  if (category && category !== "ALL") {
    list = list.filter((a) => a.category === category);
  }
  if (status && status !== "ALL") {
    list = list.filter((a) => a.status === status);
  }
  if (sliderOnly === "true") {
    list = list.filter((a) => a.isFeaturedInSlider && a.status === "PUBLISHED");
  }
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      (a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || a.author.toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return res.json({ success: true, articles: list });
});
apiRouter.get("/cms/news/:id", (req, res) => {
  const { id } = req.params;
  const state = import_db.db.getState();
  const article = state.newsArticles.find((a) => a.id === id || a.slug === id);
  if (!article) {
    return res.status(404).json({ success: false, message: "Article not found." });
  }
  article.views = (article.views || 0) + 1;
  import_db.db.saveState();
  return res.json({ success: true, article });
});
apiRouter.post(
  "/cms/news",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { title, summary, content, category, imageUrl, isFeaturedInSlider, status, author } = req.body;
    if (!title || !summary || !content) {
      return res.status(400).json({ success: false, message: "Title, summary, and content are required." });
    }
    const state = import_db.db.getState();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 80);
    const newArticle = {
      id: "news-" + Date.now(),
      title: title.trim(),
      slug: `${slug}-${Math.floor(Math.random() * 1e3)}`,
      summary: summary.trim(),
      content: content.trim(),
      category: category || "Academics",
      imageUrl: imageUrl || "",
      isFeaturedInSlider: Boolean(isFeaturedInSlider),
      status: status || "PUBLISHED",
      author: author?.trim() || req.user.fullName,
      publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
      views: 0
    };
    state.newsArticles.unshift(newArticle);
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "NEWS_ARTICLE_CREATED",
      resource: "CMS_NEWS",
      details: { articleId: newArticle.id, title: newArticle.title, status: newArticle.status },
      ipAddress: req.ip
    });
    return res.status(201).json({ success: true, article: newArticle });
  }
);
apiRouter.put(
  "/cms/news/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const { title, summary, content, category, imageUrl, isFeaturedInSlider, status, author } = req.body;
    const state = import_db.db.getState();
    const article = state.newsArticles.find((a) => a.id === id);
    if (!article) {
      return res.status(404).json({ success: false, message: "Article not found." });
    }
    if (title) article.title = title.trim();
    if (summary) article.summary = summary.trim();
    if (content) article.content = content.trim();
    if (category) article.category = category;
    if (imageUrl !== void 0) article.imageUrl = imageUrl;
    if (isFeaturedInSlider !== void 0) article.isFeaturedInSlider = Boolean(isFeaturedInSlider);
    if (status) article.status = status;
    if (author) article.author = author.trim();
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "NEWS_ARTICLE_UPDATED",
      resource: "CMS_NEWS",
      details: { articleId: article.id, title: article.title },
      ipAddress: req.ip
    });
    return res.json({ success: true, article });
  }
);
apiRouter.delete(
  "/cms/news/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const index = state.newsArticles.findIndex((a) => a.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: "Article not found." });
    }
    const removed = state.newsArticles.splice(index, 1)[0];
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "NEWS_ARTICLE_DELETED",
      resource: "CMS_NEWS",
      details: { articleId: id, title: removed.title },
      ipAddress: req.ip
    });
    return res.json({ success: true, message: "Article deleted successfully." });
  }
);
apiRouter.patch(
  "/cms/news/:id/toggle-slider",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const article = state.newsArticles.find((a) => a.id === id);
    if (!article) {
      return res.status(404).json({ success: false, message: "Article not found." });
    }
    article.isFeaturedInSlider = !article.isFeaturedInSlider;
    import_db.db.saveState();
    return res.json({ success: true, isFeaturedInSlider: article.isFeaturedInSlider });
  }
);
apiRouter.get("/cms/slides", (req, res) => {
  const { activeOnly } = req.query;
  let slides = [...import_db.db.getState().sliderSlides];
  if (activeOnly === "true") {
    slides = slides.filter((s) => s.isActive);
  }
  slides.sort((a, b) => a.order - b.order);
  return res.json({ success: true, slides });
});
apiRouter.post(
  "/cms/slides",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const {
      title,
      subtitle,
      badge,
      bgGradient,
      accentColor,
      bgColor,
      bgSecondaryColor,
      textColor,
      subtitleColor,
      accentHex,
      ctaBgColor,
      ctaTextColor,
      secondaryBtnBgColor,
      secondaryBtnTextColor,
      footerBarBgColor,
      imageUrl,
      ctaText,
      ctaTab,
      ctaSubSection,
      iconName,
      order,
      isActive
    } = req.body;
    if (!title || !subtitle) {
      return res.status(400).json({ success: false, message: "Title and subtitle are required." });
    }
    const state = import_db.db.getState();
    const newSlide = {
      id: "slide-" + Date.now(),
      title: title.trim(),
      subtitle: subtitle.trim(),
      badge: badge || "College Update",
      bgGradient: bgGradient || "from-emerald-950 via-emerald-900 to-slate-950",
      accentColor: accentColor || "amber-400",
      bgColor: bgColor || "",
      bgSecondaryColor: bgSecondaryColor || "",
      textColor: textColor || "",
      subtitleColor: subtitleColor || "",
      accentHex: accentHex || "",
      ctaBgColor: ctaBgColor || "",
      ctaTextColor: ctaTextColor || "",
      secondaryBtnBgColor: secondaryBtnBgColor || "",
      secondaryBtnTextColor: secondaryBtnTextColor || "",
      footerBarBgColor: footerBarBgColor || "",
      imageUrl: imageUrl || "",
      ctaText: ctaText || "Learn More",
      ctaTab: ctaTab || "public",
      ctaSubSection: ctaSubSection || "overview",
      iconName: iconName || "Sparkles",
      order: order !== void 0 ? Number(order) : state.sliderSlides.length + 1,
      isActive: isActive !== void 0 ? Boolean(isActive) : true
    };
    state.sliderSlides.push(newSlide);
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "HERO_SLIDE_CREATED",
      resource: "CMS_SLIDER",
      details: { slideId: newSlide.id, title: newSlide.title },
      ipAddress: req.ip
    });
    return res.status(201).json({ success: true, slide: newSlide });
  }
);
apiRouter.put(
  "/cms/slides/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const slide = state.sliderSlides.find((s) => s.id === id);
    if (!slide) {
      return res.status(404).json({ success: false, message: "Slide not found." });
    }
    const {
      title,
      subtitle,
      badge,
      bgGradient,
      accentColor,
      bgColor,
      bgSecondaryColor,
      textColor,
      subtitleColor,
      accentHex,
      ctaBgColor,
      ctaTextColor,
      secondaryBtnBgColor,
      secondaryBtnTextColor,
      footerBarBgColor,
      imageUrl,
      ctaText,
      ctaTab,
      ctaSubSection,
      iconName,
      order,
      isActive
    } = req.body;
    if (title !== void 0) slide.title = title.trim();
    if (subtitle !== void 0) slide.subtitle = subtitle.trim();
    if (badge !== void 0) slide.badge = badge.trim();
    if (bgGradient !== void 0) slide.bgGradient = bgGradient;
    if (accentColor !== void 0) slide.accentColor = accentColor;
    if (bgColor !== void 0) slide.bgColor = bgColor;
    if (bgSecondaryColor !== void 0) slide.bgSecondaryColor = bgSecondaryColor;
    if (textColor !== void 0) slide.textColor = textColor;
    if (subtitleColor !== void 0) slide.subtitleColor = subtitleColor;
    if (accentHex !== void 0) slide.accentHex = accentHex;
    if (ctaBgColor !== void 0) slide.ctaBgColor = ctaBgColor;
    if (ctaTextColor !== void 0) slide.ctaTextColor = ctaTextColor;
    if (secondaryBtnBgColor !== void 0) slide.secondaryBtnBgColor = secondaryBtnBgColor;
    if (secondaryBtnTextColor !== void 0) slide.secondaryBtnTextColor = secondaryBtnTextColor;
    if (footerBarBgColor !== void 0) slide.footerBarBgColor = footerBarBgColor;
    if (imageUrl !== void 0) slide.imageUrl = imageUrl;
    if (ctaText !== void 0) slide.ctaText = ctaText.trim();
    if (ctaTab !== void 0) slide.ctaTab = ctaTab;
    if (ctaSubSection !== void 0) slide.ctaSubSection = ctaSubSection;
    if (iconName !== void 0) slide.iconName = iconName;
    if (order !== void 0) slide.order = Number(order);
    if (isActive !== void 0) slide.isActive = Boolean(isActive);
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "HERO_SLIDE_UPDATED",
      resource: "CMS_SLIDER",
      details: { slideId: slide.id, title: slide.title },
      ipAddress: req.ip
    });
    return res.json({ success: true, slide });
  }
);
apiRouter.delete(
  "/cms/slides/:id",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const { id } = req.params;
    const state = import_db.db.getState();
    const index = state.sliderSlides.findIndex((s) => s.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: "Slide not found." });
    }
    const removed = state.sliderSlides.splice(index, 1)[0];
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "HERO_SLIDE_DELETED",
      resource: "CMS_SLIDER",
      details: { slideId: id, title: removed.title },
      ipAddress: req.ip
    });
    return res.json({ success: true, message: "Slide deleted successfully." });
  }
);
apiRouter.get("/cms/page-content", (req, res) => {
  return res.json({ success: true, pageContent: import_db.db.getState().pageContent });
});
apiRouter.put(
  "/cms/page-content",
  import_authMiddleware.authenticateToken,
  (0, import_authMiddleware.requireRoles)("SUPER_ADMIN", "INSTITUTION_ADMIN"),
  (req, res) => {
    const current = import_db.db.getState().pageContent;
    const updated = { ...current, ...req.body };
    import_db.db.getState().pageContent = updated;
    import_db.db.saveState();
    import_db.db.logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "PAGE_CONTENT_UPDATED",
      resource: "CMS_PAGE_BUILDER",
      details: { updatedFields: Object.keys(req.body) },
      ipAddress: req.ip
    });
    return res.json({ success: true, pageContent: updated });
  }
);
