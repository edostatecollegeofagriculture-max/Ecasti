import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  db,
  computeGradeAndPoints,
  User,
  AdmissionApplication,
  Student,
  CourseRegistration,
  AssessmentResult,
  PaymentTransaction,
  AttendanceSession,
  SupportTicket,
  Invoice,
  NewsArticle,
  HeroSlide,
  FeeSchedule,
  IssuedDocument,
} from './db';
import {
  AuthenticatedRequest,
  generateToken,
  authenticateToken,
  requireRoles,
} from './authMiddleware';
import { activateAdmissionFeeObligations, listRetryableAdmissionFeeActivations } from './feeAdmissionLedgerService';

import { evaluateNdGraduationEligibility } from './academicProgressionService';
import { academicProgressionApiRouter } from './academicProgressionApiRouter';
import { appendAcademicResultEvent, listAcademicResultAttempts } from './academicResultNeonService';

export const apiRouter = Router();
apiRouter.use('/academic-progression', academicProgressionApiRouter);
// ==================== ACADEMIC PROGRESSION (READ ONLY) ====================
apiRouter.get(
  '/academic-progression/students/:studentId/eligibility',
  authenticateToken,
  requireRoles(
    'SUPER_ADMIN',
    'INSTITUTION_ADMIN',
    'REGISTRAR',
    'RECTOR'
  ),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const eligibility = evaluateNdGraduationEligibility(
        db.getState(),
        String(req.params.studentId)
      );

      return res.json({
        success: true,
        eligibility,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to evaluate eligibility.';

      const status =
        message === 'Student record not found.' ? 404 : 500;

      return res.status(status).json({
        success: false,
        message,
      });
    }
  }
);
// ==================== END ACADEMIC PROGRESSION ====================

// ==================== GLOBAL SEARCH ====================
apiRouter.get('/search', authenticateToken, requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'), (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const state = db.getState();

  const matchedStudents = state.students
    .map((s) => {
      const u = state.users.find((user) => user.id === s.userId);
      const prog = state.programmes.find((p) => p.id === s.programmeId);
      return {
        id: s.id,
        matricNumber: s.matricNumber,
        fullName: u?.fullName || 'Student',
        email: u?.email || '',
        programmeName: prog?.name || '',
        level: s.level,
        cgpa: s.cgpa,
        type: 'STUDENT',
      };
    })
    .filter(
      (s) =>
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.matricNumber.toLowerCase().includes(q) ||
        s.programmeName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    )
    .slice(0, 6);

  const matchedApplicants = state.applications
    .map((a) => {
      const prog = state.programmes.find((p) => p.id === a.programmeId);
      return {
        id: a.id,
        applicationNumber: a.applicationNumber,
        fullName: `${a.firstName} ${a.lastName}`,
        email: a.email,
        programmeName: prog?.name || '',
        status: a.status,
        type: 'APPLICANT',
      };
    })
    .filter(
      (a) =>
        !q ||
        a.fullName.toLowerCase().includes(q) ||
        a.applicationNumber.toLowerCase().includes(q) ||
        a.programmeName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
    )
    .slice(0, 6);

  const matchedCourses = state.courses
    .filter(
      (c) =>
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.lecturerName?.toLowerCase().includes(q)
    )
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      creditUnits: c.creditUnits,
      level: c.level,
      semester: c.semester,
      lecturerName: c.lecturerName,
      type: 'COURSE',
    }));

  const standardDocuments = [
    {
      id: 'doc-admission',
      title: 'Provisional Offer of Admission Letter',
      category: 'Admissions Office',
      slipType: 'ADMISSION_LETTER',
      description: 'Official letter for accepted candidates with security seal',
      type: 'DOCUMENT',
    },
    {
      id: 'doc-reg',
      title: 'Course Registration & Examination Clearance Slip',
      category: 'Academic Registry',
      slipType: 'COURSE_REGISTRATION',
      description: 'Semester approved course enrollment signed by HOD',
      type: 'DOCUMENT',
    },
    {
      id: 'doc-receipt',
      title: 'Official Bursary Electronic Payment Receipt',
      category: 'Bursary & Accounts',
      slipType: 'PAYMENT_RECEIPT',
      description: 'Verified Remita payment acknowledgment and clearance slip',
      type: 'DOCUMENT',
    },
    {
      id: 'doc-result',
      title: 'Official Statement of Academic Results / Transcript',
      category: 'Examination Office',
      slipType: 'RESULT_SLIP',
      description: 'Senate moderated semester grades and CGPA transcript',
      type: 'DOCUMENT',
    },
    {
      id: 'doc-idcard',
      title: 'Student Identity Card Credential',
      category: 'Security & Registry',
      slipType: 'STUDENT_ID',
      description: 'Digital institutional barcode ID card',
      type: 'DOCUMENT',
    },
  ].filter(
    (d) =>
      !q ||
      d.title.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
  );

  const portalSections = [
    { title: 'Public College Overview', tab: 'public', subSection: 'overview', description: 'About EDOCASTI, schools, mission and campuses' },
    { title: 'Schools & Academic Programmes', tab: 'public', subSection: 'programmes', description: 'Agricultural, Applied Science and Engineering courses' },
    { title: 'Online Admission Screening Form', tab: 'admissions', subSection: 'form', description: 'Submit biodata and O-Level WAEC/NECO results' },
    { title: 'Applicant Screening Register', tab: 'admissions', subSection: 'screening', description: 'Vetting queue for Admissions Committee & Registrar' },
    { title: 'Student Course Registration', tab: 'student', subSection: 'courses', description: 'Enroll semester credit units and submit to HOD' },
    { title: 'Semester Published Results', tab: 'student', subSection: 'results', description: 'View CGPA breakdown and Senate approved grades' },
    { title: 'Bursary Fee Settlement', tab: 'student', subSection: 'finance', description: 'Pay tuition fees online via Remita' },
    { title: 'Continuous Assessment Grade Entry', tab: 'lecturer', subSection: 'scores', description: 'Lecturer marks input for CA (40) and Exam (60)' },
    { title: 'Practical Farm & Lab Attendance', tab: 'lecturer', subSection: 'attendance', description: 'Register attendees for demonstration farms & workshops' },
    { title: 'Executive Management Analytics', tab: 'admin', subSection: 'analytics', description: 'Institutional KPIs, revenue and departmental charts' },
    { title: 'Institutional Settings & Session', tab: 'admin', subSection: 'settings', description: 'Configure academic session, semester and registration windows' },
    { title: 'User Roles & Access Control (RBAC)', tab: 'admin', subSection: 'users', description: 'Manage accounts, lockouts and role provisioning' },
    { title: 'Security & Governance Audit Trail', tab: 'admin', subSection: 'audit', description: 'Tamper-resistant activity logs of all critical actions' },
    { title: 'Content Management Module (CMS)', tab: 'admin', subSection: 'cms', description: 'Publish news articles, manage bulletins and hero slideshow' },
    { title: 'College News & Press Releases', tab: 'public', subSection: 'news', description: 'Official announcements, agriculture research news and campus notices' },
  ].filter(
    (s) =>
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tab.toLowerCase().includes(q)
  );

  return res.json({
    success: true,
    query: q,
    results: {
      students: matchedStudents,
      applicants: matchedApplicants,
      courses: matchedCourses,
      documents: standardDocuments,
      sections: portalSections,
    },
  });
});

// ==================== AUTHENTICATION ====================

apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const state = db.getState();
  const reqEmail = email.toLowerCase().trim();
  const user = state.users.find((u) => {
    const uEmail = u.email.toLowerCase().trim();
    if (uEmail === reqEmail) return true;
    return uEmail.replace('@edocasti.edu.ng', '@edocas.edu.ng') === reqEmail.replace('@edocasti.edu.ng', '@edocas.edu.ng');
  });

  if (!user) {
    db.logAudit({
      action: 'LOGIN_FAILED',
      resource: 'AUTH',
      details: { email, reason: 'User not found' },
      ipAddress: req.ip,
    });
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  if (user.isLocked) {
    db.logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN_BLOCKED_LOCKED',
      resource: 'AUTH',
      details: { email },
      ipAddress: req.ip,
    });
    return res.status(403).json({ success: false, message: 'Account is locked. Please contact the ICT Administrator.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated.' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= 5) {
      user.isLocked = true;
    }
    db.saveState();

    db.logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN_FAILED_PASSWORD',
      resource: 'AUTH',
      details: { email, attempts: user.failedLoginAttempts },
      ipAddress: req.ip,
    });
    return res.status(401).json({
      success: false,
      message: user.isLocked ? 'Account locked after 5 failed attempts.' : 'Invalid email or password.',
    });
  }

  // Reset failed attempts on success
  user.failedLoginAttempts = 0;
  user.lastLogin = new Date().toISOString();
  db.saveState();

  const token = generateToken(user);

  db.logAudit({
    userId: user.id,
    userEmail: user.email,
    action: 'LOGIN_SUCCESS',
    resource: 'AUTH',
    details: { role: user.role },
    ipAddress: req.ip,
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
      schoolId: user.schoolId,
    },
  });
});

apiRouter.post('/auth/register-applicant', (req, res) => {
  const { email, password, fullName, phone, photoUrl } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ success: false, message: 'Email, password, and full name are required.' });
  }

  const state = db.getState();
  const existing = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser: User = {
    id: 'usr-app-' + Date.now(),
    email: email.toLowerCase().trim(),
    passwordHash,
    fullName: fullName.trim(),
    phone: phone || '',
    photoUrl: photoUrl || '',
    role: 'APPLICANT',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    createdAt: new Date().toISOString(),
  };

  state.users.push(newUser);
  db.saveState();

  db.logAudit({
    userId: newUser.id,
    userEmail: newUser.email,
    action: 'APPLICANT_ACCOUNT_CREATED',
    resource: 'USER',
    details: { fullName: newUser.fullName },
    ipAddress: req.ip,
  });

  const token = generateToken(newUser);

  return res.status(201).json({
    success: true,
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      phone: newUser.phone,
      photoUrl: newUser.photoUrl,
    },
  });
});

apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
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
      lastLogin: user.lastLogin,
    },
  });
});

apiRouter.put('/auth/profile', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const state = db.getState();
  const user = state.users.find((u) => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  const { fullName, phone, photoUrl } = req.body;
  if (fullName !== undefined) user.fullName = String(fullName).trim();
  if (phone !== undefined) user.phone = phone;
  if (photoUrl !== undefined) {
    user.photoUrl = photoUrl;
    const std = state.students.find((s) => s.userId === user.id);
    if (std) std.photoUrl = photoUrl;
    const app = state.applications.find((a) => a.userId === user.id);
    if (app) app.photoUrl = photoUrl;
  }

  db.saveState();
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
    },
  });
});

apiRouter.post('/auth/change-password', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user!;

  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(400).json({ success: false, message: 'Incorrect current password.' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  db.saveState();

  db.logAudit({
    userId: user.id,
    userEmail: user.email,
    action: 'PASSWORD_CHANGED',
    resource: 'AUTH',
    details: {},
    ipAddress: req.ip,
  });

  return res.json({ success: true, message: 'Password updated successfully.' });
});

// ==================== INSTITUTION SETTINGS ====================

apiRouter.get('/settings', (req, res) => {
  return res.json({ success: true, settings: db.getState().settings });
});

apiRouter.put(
  '/settings',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const current = db.getState().settings;
    const updated = { ...current, ...req.body, id: 'default' };
    db.getState().settings = updated;
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'SETTINGS_UPDATED',
      resource: 'INSTITUTION_PROFILE',
      details: { updatedFields: Object.keys(req.body) },
      ipAddress: req.ip,
    });

    return res.json({ success: true, settings: updated });
  }
);

// ==================== USER MANAGEMENT ====================

apiRouter.get(
  '/users',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { role, search } = req.query;
    let list = db.getState().users.map((u) => ({
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
      lastLogin: u.lastLogin,
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
  '/users',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { email, password, fullName, role, phone, departmentId, schoolId } = req.body;
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    const state = db.getState();
    if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ success: false, message: 'User with this email already exists.' });
    }

    const newUser: User = {
      id: 'usr-' + Date.now(),
      email: email.toLowerCase().trim(),
      passwordHash: bcrypt.hashSync(password, 10),
      fullName: fullName.trim(),
      role,
      phone: phone || '',
      departmentId,
      schoolId,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString(),
    };

    state.users.push(newUser);
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'USER_CREATED',
      resource: 'USER',
      details: { newUserId: newUser.id, role: newUser.role, email: newUser.email },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
      },
    });
  }
);

apiRouter.patch(
  '/users/:id/status',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { isActive, isLocked } = req.body;
    const user = db.getState().users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (typeof isLocked === 'boolean') {
      user.isLocked = isLocked;
      if (!isLocked) user.failedLoginAttempts = 0;
    }

    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'USER_STATUS_UPDATED',
      resource: 'USER',
      details: { targetUserId: user.id, isActive: user.isActive, isLocked: user.isLocked },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'User status updated successfully.' });
  }
);

apiRouter.put(
  '/users/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { fullName, email, role, phone, photoUrl, departmentId, schoolId, isActive, isLocked } = req.body;
    const user = db.getState().users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (fullName !== undefined) user.fullName = String(fullName).trim();
    if (email !== undefined) user.email = String(email).toLowerCase().trim();
    if (role !== undefined) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (photoUrl !== undefined) user.photoUrl = photoUrl;
    if (departmentId !== undefined) user.departmentId = departmentId;
    if (schoolId !== undefined) user.schoolId = schoolId;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (typeof isLocked === 'boolean') user.isLocked = isLocked;

    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'USER_UPDATED',
      resource: 'USER',
      details: { targetUserId: user.id, fullName: user.fullName, role: user.role },
      ipAddress: req.ip,
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
        isLocked: user.isLocked,
      },
    });
  }
);

apiRouter.delete(
  '/users/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (id === req.user!.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own currently active account.' });
    }
    const state = db.getState();
    const idx = state.users.findIndex((u) => u.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'User not found.' });
    const removed = state.users.splice(idx, 1)[0];
    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'USER_DELETED',
      resource: 'USER',
      details: { targetUserId: id, email: removed.email },
      ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'User account deleted.' });
  }
);

// ==================== ACADEMICS (Schools, Departments, Programmes, Courses) ====================

apiRouter.get('/academics/schools', (req, res) => {
  return res.json({ success: true, schools: db.getState().schools });
});

apiRouter.get('/academics/departments', (req, res) => {
  return res.json({ success: true, departments: db.getState().departments });
});

apiRouter.get('/academics/programmes', (req, res) => {
  return res.json({ success: true, programmes: db.getState().programmes });
});

apiRouter.get('/academics/courses', (req, res) => {
  const { departmentId, level, semester } = req.query;
  let list = db.getState().courses;
  if (departmentId) list = list.filter((c) => c.departmentId === departmentId);
  if (level) list = list.filter((c) => c.level === level);
  if (semester) list = list.filter((c) => c.semester === semester);
  return res.json({ success: true, courses: list });
});

apiRouter.get(
  '/academics/my-courses',
  authenticateToken,
  requireRoles('LECTURER'),
  (req: AuthenticatedRequest, res: Response) => {
    const courses = db.getState().courses.filter((course) => course.lecturerId === req.user!.id);
    return res.json({ success: true, courses });
  }
);

apiRouter.get('/academics/lecturers', authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'HOD'), (req: AuthenticatedRequest, res: Response) => {
  const state = db.getState();
  let lecturerUsers = state.users.filter((u) => u.role === 'LECTURER' && u.isActive);
  if (req.user!.role === 'HOD') {
    const departmentId = req.user!.departmentId;
    lecturerUsers = departmentId
      ? lecturerUsers.filter((lecturer) => lecturer.departmentId === departmentId)
      : [];
  }
  if (req.user!.role === 'DEAN') {
    const schoolId = req.user!.schoolId;
    const departmentIds = new Set(state.departments.filter((department) => department.schoolId === schoolId).map((department) => department.id));
    lecturerUsers = schoolId
      ? lecturerUsers.filter((lecturer) => Boolean(lecturer.departmentId && departmentIds.has(lecturer.departmentId)))
      : [];
  }
  const lecturers = lecturerUsers.map((lecturer) => ({
    id: lecturer.id,
    fullName: lecturer.fullName,
    role: lecturer.role,
    departmentId: lecturer.departmentId,
  }));
  return res.json({ success: true, lecturers });
});

apiRouter.post(
  '/academics/courses',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'DEAN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { departmentId, programmeId, code, title, creditUnits, level, semester, lecturerId, isCompulsory } = req.body;
    if (!departmentId || !code || !title || !creditUnits) {
      return res.status(400).json({ success: false, message: 'Missing course details.' });
    }

    const state = db.getState();
    const mayAssignLecturer = req.user!.role === 'HOD';
    const resolvedLecturer = mayAssignLecturer && lecturerId
      ? state.users.find((u) => u.id === lecturerId && u.role === 'LECTURER')
      : undefined;
    if (mayAssignLecturer && lecturerId && !resolvedLecturer) {
      return res.status(400).json({ success: false, message: 'Select an active lecturer account.' });
    }
    const newCourse = {
      id: 'crs-' + code.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString().slice(-3),
      departmentId,
      programmeId: programmeId || undefined,
      code: code.toUpperCase().trim(),
      title: title.trim(),
      creditUnits: Number(creditUnits),
      level: level || 'ND I',
      semester: semester || 'First Semester',
      lecturerId: resolvedLecturer?.id || undefined,
      lecturerName: resolvedLecturer?.fullName || 'Departmental Staff',
      isCompulsory: isCompulsory !== undefined ? Boolean(isCompulsory) : true,
    };

    state.courses.push(newCourse);
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'COURSE_CREATED',
      resource: 'COURSE',
      details: { code: newCourse.code, title: newCourse.title },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, course: newCourse });
  }
);

apiRouter.put(
  '/academics/courses/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'DEAN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const course = state.courses.find((c) => c.id === id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }
    const { departmentId, programmeId, code, title, creditUnits, level, semester, lecturerId, isCompulsory } = req.body;
    if (departmentId !== undefined) course.departmentId = departmentId;
    if (programmeId !== undefined) course.programmeId = programmeId || undefined;
    if (code !== undefined) course.code = String(code).toUpperCase().trim();
    if (title !== undefined) course.title = String(title).trim();
    if (creditUnits !== undefined) course.creditUnits = Number(creditUnits);
    if (level !== undefined) course.level = level;
    if (semester !== undefined) course.semester = semester;
    if (lecturerId !== undefined) {
      if (req.user!.role !== 'HOD') {
        return res.status(403).json({ success: false, message: 'Only the HOD can assign courses to lecturers.' });
      }
      const usr = lecturerId ? state.users.find((u) => u.id === lecturerId && u.role === 'LECTURER' && u.isActive) : undefined;
      if (lecturerId && !usr) {
        return res.status(400).json({ success: false, message: 'Select an active lecturer account.' });
      }
      course.lecturerId = usr?.id;
      course.lecturerName = usr?.fullName || 'Departmental Staff';
    }
    if (typeof isCompulsory === 'boolean') course.isCompulsory = isCompulsory;

    db.saveState();
    return res.json({ success: true, course });
  }
);

apiRouter.patch(
  '/academics/courses/:id/assign-lecturer',
  authenticateToken,
  requireRoles('HOD'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { lecturerId } = req.body;
    const state = db.getState();
    const course = state.courses.find((c) => c.id === id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }
    if (!req.user!.departmentId || course.departmentId !== req.user!.departmentId) {
      return res.status(403).json({ success: false, message: 'You can only assign courses within your department.' });
    }
    const lecturerUser = lecturerId
      ? state.users.find((u) => u.id === lecturerId && u.role === 'LECTURER' && u.isActive)
      : undefined;
    if (lecturerId && !lecturerUser) {
      return res.status(400).json({ success: false, message: 'Select an active lecturer account.' });
    }
    course.lecturerId = lecturerUser?.id;
    course.lecturerName = lecturerUser?.fullName || 'Departmental Staff';
    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'COURSE_LECTURER_ASSIGNED',
      resource: 'COURSE',
      details: { courseId: course.id, code: course.code, lecturerName: course.lecturerName },
      ipAddress: req.ip,
    });
    return res.json({ success: true, course });
  }
);

apiRouter.delete(
  '/academics/courses/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'DEAN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.courses.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Course not found.' });
    state.courses.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Course deleted.' });
  }
);

// Schools CRUD
apiRouter.post(
  '/academics/schools',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { code, name, description, imageUrl } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'School code and name are required.' });
    }
    const newSchool = {
      id: 'sch-' + Date.now(),
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
      description: String(description || '').trim(),
      imageUrl: imageUrl || '',
    };
    db.getState().schools.push(newSchool);
    db.saveState();
    return res.status(201).json({ success: true, school: newSchool });
  }
);

apiRouter.put(
  '/academics/schools/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const school = db.getState().schools.find((s) => s.id === id);
    if (!school) return res.status(404).json({ success: false, message: 'School not found.' });
    const { code, name, description, imageUrl } = req.body;
    if (code !== undefined) school.code = String(code).toUpperCase().trim();
    if (name !== undefined) school.name = String(name).trim();
    if (description !== undefined) school.description = String(description).trim();
    if (imageUrl !== undefined) school.imageUrl = imageUrl;
    db.saveState();
    return res.json({ success: true, school });
  }
);

apiRouter.delete(
  '/academics/schools/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.schools.findIndex((s) => s.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'School not found.' });
    state.schools.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'School deleted.' });
  }
);

// Departments CRUD
apiRouter.post(
  '/academics/departments',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { schoolId, code, name } = req.body;
    if (!schoolId || !code || !name) {
      return res.status(400).json({ success: false, message: 'School, code, and name are required.' });
    }
    const newDept = {
      id: 'dept-' + Date.now(),
      schoolId,
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
    };
    db.getState().departments.push(newDept);
    db.saveState();
    return res.status(201).json({ success: true, department: newDept });
  }
);

apiRouter.put(
  '/academics/departments/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const dept = db.getState().departments.find((d) => d.id === id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found.' });
    const { schoolId, code, name } = req.body;
    if (schoolId !== undefined) dept.schoolId = schoolId;
    if (code !== undefined) dept.code = String(code).toUpperCase().trim();
    if (name !== undefined) dept.name = String(name).trim();
    db.saveState();
    return res.json({ success: true, department: dept });
  }
);

apiRouter.delete(
  '/academics/departments/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.departments.findIndex((d) => d.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Department not found.' });
    state.departments.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Department deleted.' });
  }
);

// Programmes CRUD
apiRouter.post(
  '/academics/programmes',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'DEAN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { departmentId, code, name, qualification, durationYears, description, requirements } = req.body;
    if (!departmentId || !code || !name) {
      return res.status(400).json({ success: false, message: 'Department, code, and name are required.' });
    }
    const newProg = {
      id: 'prog-' + Date.now(),
      departmentId,
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
      qualification: qualification || 'ND',
      durationYears: Number(durationYears) || 2,
      description: String(description || '').trim(),
      requirements: Array.isArray(requirements) ? requirements : [],
    };
    db.getState().programmes.push(newProg);
    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'PROGRAMME_CREATED',
      resource: 'PROGRAMME',
      details: { code: newProg.code, name: newProg.name },
      ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, programme: newProg });
  }
);

apiRouter.put(
  '/academics/programmes/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'DEAN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const prog = db.getState().programmes.find((p) => p.id === id);
    if (!prog) return res.status(404).json({ success: false, message: 'Programme not found.' });
    const { departmentId, code, name, qualification, durationYears, description, requirements } = req.body;
    if (departmentId !== undefined) prog.departmentId = departmentId;
    if (code !== undefined) prog.code = String(code).toUpperCase().trim();
    if (name !== undefined) prog.name = String(name).trim();
    if (qualification !== undefined) prog.qualification = qualification;
    if (durationYears !== undefined) prog.durationYears = Number(durationYears);
    if (description !== undefined) prog.description = String(description).trim();
    if (Array.isArray(requirements)) prog.requirements = requirements;
    db.saveState();
    return res.json({ success: true, programme: prog });
  }
);

apiRouter.delete(
  '/academics/programmes/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'DEAN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.programmes.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Programme not found.' });
    state.programmes.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Programme deleted.' });
  }
);

// ==================== ADMISSIONS ====================

apiRouter.get(
  '/admissions',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'ADMISSIONS_OFFICER'),
  (req: AuthenticatedRequest, res: Response) => {
    const { status, programmeId, session } = req.query;
    let list = db.getState().applications;

    if (status) list = list.filter((a) => a.status === status);
    if (programmeId) list = list.filter((a) => a.programmeId === programmeId);
    if (session) list = list.filter((a) => a.session === session);

    return res.json({ success: true, applications: list });
  }
);

apiRouter.get('/admissions/my-application', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const app = db.getState().applications.find((a) => a.userId === req.user!.id);
  if (!app) {
    return res.status(404).json({ success: false, message: 'No application record found for this user.' });
  }
  return res.json({ success: true, application: app });
});

apiRouter.post('/admissions/apply', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const state = db.getState();

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
    oLevelResults,
  } = req.body;

  const resolvedPhoto = photoUrl || existing?.photoUrl || user.photoUrl || '';
  if (photoUrl) {
    const u = state.users.find((usr) => usr.id === user.id);
    if (u) u.photoUrl = photoUrl;
  }

  const appNumber =
    existing?.applicationNumber ||
    `EDOCASTI/${state.settings.currentSession.slice(0, 4)}/APP-${String(state.applications.length + 100).padStart(5, '0')}`;

  const applicationData: AdmissionApplication = {
    id: existing?.id || 'app-' + Date.now(),
    applicationNumber: appNumber,
    userId: user.id,
    programmeId: programmeId || existing?.programmeId || 'prog-nd-agric',
    session: state.settings.currentSession,
    firstName: firstName || user.fullName.split(' ')[0],
    lastName: lastName || user.fullName.split(' ')[1] || '',
    otherNames: otherNames || '',
    gender: gender || 'Male',
    dob: dob || '2005-01-01',
    phone: phone || user.phone || '',
    email: user.email,
    photoUrl: resolvedPhoto,
    stateOfOrigin: stateOfOrigin || 'Edo State',
    lga: lga || 'Oredo',
    residentialAddress: residentialAddress || 'Benin City, Edo State',
    oLevelResults: oLevelResults || [
      { subject: 'English Language', grade: 'C4', examNumber: '5002991', examType: 'WAEC' },
      { subject: 'Mathematics', grade: 'B3', examNumber: '5002991', examType: 'WAEC' },
      { subject: 'Agricultural Science / Biology', grade: 'A1', examNumber: '5002991', examType: 'WAEC' },
      { subject: 'Chemistry', grade: 'B3', examNumber: '5002991', examType: 'WAEC' },
      { subject: 'Physics / Economics', grade: 'C5', examNumber: '5002991', examType: 'WAEC' },
    ],
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString(),
    screeningNotes: 'Application submitted and awaiting credential screening.',
  };

  if (existing) {
    const idx = state.applications.findIndex((a) => a.id === existing.id);
    state.applications[idx] = applicationData;
  } else {
    state.applications.push(applicationData);
  }

  db.saveState();
  db.logAudit({
    userId: user.id,
    userEmail: user.email,
    action: 'ADMISSION_APPLICATION_SUBMITTED',
    resource: 'APPLICATION',
    details: { applicationNumber: appNumber, programmeId },
    ipAddress: req.ip,
  });

  return res.json({ success: true, application: applicationData });
});

apiRouter.put(
  '/admissions/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'ADMISSIONS_OFFICER'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const app = db.getState().applications.find((a) => a.id === id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });
    Object.assign(app, req.body, { id: app.id });
    db.saveState();
    return res.json({ success: true, application: app });
  }
);

apiRouter.delete(
  '/admissions/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.applications.findIndex((a) => a.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Application not found.' });
    state.applications.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Application deleted.' });
  }
);

apiRouter.patch(
  '/admissions/:id/decision',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'ADMISSIONS_OFFICER'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status, screeningNotes } = req.body;
    const app = db.getState().applications.find((a) => a.id === id);

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    app.status = status;
    if (screeningNotes) app.screeningNotes = screeningNotes;
    app.reviewedBy = `${req.user!.fullName} (${req.user!.role})`;
    app.decisionAt = new Date().toISOString();

    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'ADMISSION_DECISION_RECORDED',
      resource: 'APPLICATION',
      details: { applicationId: id, status, decisionBy: app.reviewedBy },
      ipAddress: req.ip,
    });

    return res.json({ success: true, application: app });
  }
);

function calculateAdmissionFeeTotal(state: ReturnType<typeof db.getState>, programmeId: string, level: string, session: string): number | null {
  const applicableFees = state.feeSchedules.filter((fee) =>
    fee.session === session &&
    (!fee.level || fee.level === 'All' || fee.level === level) &&
    (!fee.programmeId || fee.programmeId === programmeId) &&
    Number.isFinite(Number(fee.amount)) && Number(fee.amount) >= 0
  );

  // General fees apply to every programme. A programme-specific fee replaces
  // a general fee in the same category for that programme/level, while general
  // fees in other categories remain applicable and are added to the total.
  const programmeCategories = new Set(
    applicableFees
      .filter((fee) => fee.programmeId === programmeId)
      .map((fee) => String(fee.category || '').trim().toLowerCase())
  );
  const feesToCharge = applicableFees.filter((fee) =>
    Boolean(fee.programmeId) || !programmeCategories.has(String(fee.category || '').trim().toLowerCase())
  );

  if (feesToCharge.length === 0) return null;
  const total = feesToCharge.reduce((sum, fee) => sum + Number(fee.amount), 0);
  return total > 0 ? total : null;
}

function isFeeManagementEnabled(): boolean {
  return process.env.FEE_MANAGEMENT_ENABLED === 'true';
}

function migrateApplicantToStudent(
  state: ReturnType<typeof db.getState>,
  app: AdmissionApplication,
  applicantUser: User,
  createLegacyInvoice = true
): Student {
  const prog = state.programmes.find((p) => p.id === app.programmeId);
  const dept = state.departments.find((d) => d.id === prog?.departmentId);
  const school = state.schools.find((s) => s.id === dept?.schoolId);

  const existingStudent = state.students.find((s) => s.userId === applicantUser.id);
  if (existingStudent) {
    if (!existingStudent.photoUrl && (app.photoUrl || applicantUser.photoUrl)) {
      existingStudent.photoUrl = app.photoUrl || applicantUser.photoUrl;
    }
    applicantUser.role = 'STUDENT';
    return existingStudent;
  }

  const admissionSession = app.session;
  const admissionLevel = `${prog?.qualification || 'ND'} I`;

  if (!admissionSession || !admissionSession.trim()) {
    throw new Error('The application admission session is missing.');
  }

  const matric = `EDOCASTI/${prog?.qualification || 'ND'}/${admissionSession.slice(0, 4)}/${String(state.students.length + 101).padStart(4, '0')}`;

  const studentRecord: Student = {
    id: 'std-' + Date.now(),
    matricNumber: matric,
    userId: applicantUser.id,
    photoUrl: app.photoUrl || applicantUser.photoUrl || '',
    programmeId: app.programmeId,
    departmentId: dept?.id || 'dept-agric',
    schoolId: school?.id || 'sch-agric',
    level: admissionLevel,
    sessionAdmitted: admissionSession,
    academicStatus: 'Good Standing',
    gender: app.gender,
    dob: app.dob,
    emergencyContact: app.phone,
    nextOfKin: 'Parent/Guardian',
    cgpa: 0.0,
    totalCreditsEarned: 0,
  };

  state.students.push(studentRecord);
  applicantUser.role = 'STUDENT';

  if (!applicantUser.photoUrl && app.photoUrl) {
    applicantUser.photoUrl = app.photoUrl;
  }

  // Legacy consolidated invoices are created only while the new
  // PostgreSQL fee system is disabled.
  if (createLegacyInvoice) {
    const legacyTotal = calculateAdmissionFeeTotal(
      state,
      app.programmeId,
      admissionLevel,
      admissionSession
    );

    if (legacyTotal === null) {
      throw new Error('No applicable legacy fee schedule exists for this admission.');
    }

    const inv: Invoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber: `INV/${admissionSession.slice(0, 4)}/${Math.floor(10000 + Math.random() * 90000)}`,
      studentId: studentRecord.id,
      session: admissionSession,
      title: `${studentRecord.level} Academic Session Consolidated Fees`,
      amount: legacyTotal,
      amountPaid: 0,
      status: 'UNPAID',
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    state.invoices.push(inv);
  }

  return studentRecord;
}

async function attemptAdmissionFeeActivation(
  app: AdmissionApplication,
  student: Student,
  actorUserId: string,
  ipAddress: string
): Promise<boolean> {
  if (!app.feeActivationRequiredAt) return true;

  try {
    const programme = db.getState().programmes.find((p) => p.id === app.programmeId);

    await activateAdmissionFeeObligations({
      applicationId: app.id,
      studentId: student.id,
      programmeId: app.programmeId,
      session: app.session,
      level: student.level || `${programme?.qualification || 'ND'} I`,
      activatedBy: actorUserId,
      ipAddress: ipAddress || 'unknown',
    });

    return true;
  } catch {
    // The admission remains accepted. The eligibility marker allows
    // an authorised administrator to retry this activation later.
    return false;
  }
}

apiRouter.post(
  '/admissions/:id/accept-offer',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;
    const state = db.getState();
    const app = state.applications.find((a) => a.id === id && a.userId === user.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or unauthorized.',
      });
    }

    if (app.status !== 'OFFERED') {
      return res.status(400).json({
        success: false,
        message: 'Only offered applications can be accepted.',
      });
    }

    if (!app.session || !app.session.trim()) {
      return res.status(400).json({
        success: false,
        message: 'The application admission session is missing. Contact the admissions office.',
      });
    }

    const feeEnabled = isFeeManagementEnabled();
    const programme = state.programmes.find((p) => p.id === app.programmeId);
    const admissionLevel = `${programme?.qualification || 'ND'} I`;
    const existingStudent = state.students.some((s) => s.userId === user.id);

    // Keep the old fee preflight only while the new fee system is disabled.
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
          message: `No applicable legacy fee schedule is configured for ${programme?.code || 'this programme'} (${admissionLevel}) for ${app.session}.`,
        });
      }
    }

    const applicantUser = state.users.find((u) => u.id === user.id) || user;

    try {
      app.status = 'ACCEPTED';

      const studentRecord = migrateApplicantToStudent(
        state,
        app,
        applicantUser,
        !feeEnabled
      );

      // Only a genuinely new student accepted while the feature is
      // enabled is marked for first-time admission fee activation.
      if (feeEnabled && !existingStudent) {
        app.feeActivationRequiredAt = new Date().toISOString();
      }

      db.saveState();

      const newToken = generateToken(applicantUser);

      let auditLogged = true;

      try {
        db.logAudit({
          userId: applicantUser.id,
          userEmail: applicantUser.email,
          action: 'ADMISSION_OFFER_ACCEPTED',
          resource: 'APPLICATION',
          details: {
            matricNumber: studentRecord.matricNumber,
            studentId: studentRecord.id,
            feeActivationRequired: Boolean(app.feeActivationRequiredAt),
          },
          ipAddress: req.ip,
        });
      } catch {
        auditLogged = false;
      }

      const activationSucceeded = await attemptAdmissionFeeActivation(
        app,
        studentRecord,
        applicantUser.id,
        req.ip || 'unknown'
      );

      const activationPending = Boolean(app.feeActivationRequiredAt) && !activationSucceeded;

      return res.status(activationPending ? 202 : 200).json({
        success: true,
        feeActivationPending: activationPending,
        message: activationPending
          ? 'Admission accepted. Fee activation is pending and can be retried by an authorised administrator.'
          : !auditLogged
            ? 'Admission accepted, but its audit entry could not be saved. Please notify an administrator.'
            : 'Admission offer accepted successfully! Account migrated to Student.',
        auditWarning: !auditLogged,
        student: studentRecord,
        token: newToken,
        user: {
          id: applicantUser.id,
          email: applicantUser.email,
          fullName: applicantUser.fullName,
          role: applicantUser.role,
          phone: applicantUser.phone,
          photoUrl: applicantUser.photoUrl,
        },
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Admission processing could not be completed. Please contact the admissions office.',
      });
    }
  }
);

apiRouter.post(
  '/admissions/:id/migrate-student',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'ADMISSIONS_OFFICER'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const app = state.applications.find((a) => a.id === id);

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const applicantUser = state.users.find((u) => u.id === app.userId);
    if (!applicantUser) {
      return res.status(404).json({
        success: false,
        message: 'Linked applicant user account not found.',
      });
    }

    if (app.status !== 'OFFERED' && app.status !== 'ACCEPTED') {
      return res.status(409).json({
        success: false,
        message: 'Only offered or already accepted applications can be migrated.',
      });
    }

    if (!app.session || !app.session.trim()) {
      return res.status(400).json({
        success: false,
        message: 'The application admission session is missing.',
      });
    }

    const feeEnabled = isFeeManagementEnabled();
    const programme = state.programmes.find((p) => p.id === app.programmeId);
    const admissionLevel = `${programme?.qualification || 'ND'} I`;
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
          message: `No applicable legacy fee schedule is configured for ${programme?.code || 'this programme'} (${admissionLevel}) for ${app.session}.`,
        });
      }
    }

    try {
      app.status = 'ACCEPTED';

      const studentRecord = migrateApplicantToStudent(
        state,
        app,
        applicantUser,
        !feeEnabled
      );

      if (feeEnabled && !existingStudent) {
        app.feeActivationRequiredAt = new Date().toISOString();
      }

      db.saveState();

      let auditLogged = true;

      try {
        db.logAudit({
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'APPLICANT_MIGRATED_TO_STUDENT',
          resource: 'STUDENT',
          details: {
            studentId: studentRecord.id,
            matricNumber: studentRecord.matricNumber,
            feeActivationRequired: Boolean(app.feeActivationRequiredAt),
          },
          ipAddress: req.ip,
        });
      } catch {
        auditLogged = false;
      }

      const activationSucceeded = await attemptAdmissionFeeActivation(
        app,
        studentRecord,
        req.user!.id,
        req.ip || 'unknown'
      );

      const activationPending = Boolean(app.feeActivationRequiredAt) && !activationSucceeded;

      return res.status(activationPending ? 202 : 200).json({
        success: true,
        feeActivationPending: activationPending,
        message: activationPending
          ? 'Student migration completed. Fee activation is pending and can be retried by an authorised administrator.'
          : !auditLogged
            ? 'Student migration completed, but its audit entry could not be saved. Please notify an administrator.'
            : 'Applicant migrated successfully.',
        auditWarning: !auditLogged,
        student: studentRecord,
        application: app,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Student migration could not be completed. Please try again or contact support.',
      });
    }
  }
);

// List pending or failed admission fee activations for authorised admission staff.
apiRouter.get(
  '/admissions/fee-activation-retries',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'ADMISSIONS_OFFICER'),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isFeeManagementEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'The new fee management system is not enabled.',
      });
    }

    try {
      const requestedLimit = Number(req.query.limit || 50);
      const items = await listRetryableAdmissionFeeActivations(requestedLimit);

      return res.json({
        success: true,
        items,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Admission fee activation records could not be loaded.',
      });
    }
  }
);
// Retry only applications explicitly marked as fee-eligible at acceptance.
apiRouter.post(
  '/admissions/:id/retry-fee-activation',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'ADMISSIONS_OFFICER'),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isFeeManagementEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'The new fee management system is not enabled.',
      });
    }

    const { id } = req.params;
    const state = db.getState();
    const app = state.applications.find((a) => a.id === id);

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    if (app.status !== 'ACCEPTED' || !app.feeActivationRequiredAt) {
      return res.status(409).json({
        success: false,
        message: 'This application is not marked for new fee activation.',
      });
    }

    const student = state.students.find((s) => s.userId === app.userId);

    if (!student || student.programmeId !== app.programmeId) {
      return res.status(409).json({
        success: false,
        message: 'The accepted application does not have a matching student record.',
      });
    }

    const succeeded = await attemptAdmissionFeeActivation(
      app,
      student,
      req.user!.id,
      req.ip || 'unknown'
    );

    if (!succeeded) {
      return res.status(503).json({
        success: false,
        message: 'Fee activation is still pending. Check the fee database and retry later.',
      });
    }

    return res.json({
      success: true,
      feeActivationPending: false,
      message: 'Admission fee obligations activated successfully.',
      applicationId: app.id,
      studentId: student.id,
    });
  }
);
// ==================== STUDENTS ====================

apiRouter.get(
  '/students',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'DEAN', 'HOD', 'LECTURER', 'EXAM_OFFICER', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { departmentId, level, search, programmeId } = req.query;
    const state = db.getState();
    let list = state.students.map((std) => {
      const usr = state.users.find((u) => u.id === std.userId);
      const app = state.applications.find((a) => a.userId === std.userId);
      const prog = state.programmes.find((p) => p.id === std.programmeId);
      const dept = state.departments.find((d) => d.id === std.departmentId);
      const sch = state.schools.find((s) => s.id === std.schoolId);
      return {
        ...std,
        fullName: usr?.fullName || 'Unknown Student',
        email: usr?.email || '',
        phone: usr?.phone || '',
        photoUrl: std.photoUrl || usr?.photoUrl || app?.photoUrl || '',
        programmeName: prog?.name || '',
        departmentName: dept?.name || '',
        schoolName: sch?.name || '',
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
    const role = req.user!.role;
    if (role === 'LECTURER') {
      const assignedCourseIds = new Set(state.courses.filter((c) => c.lecturerId === req.user!.id).map((c) => c.id));
      const enrolledStudentIds = new Set(
        state.registrations
          .filter((r) => r.courseIds.some((courseId) => assignedCourseIds.has(courseId)))
          .map((r) => r.studentId)
      );
      list = list.filter((s) => enrolledStudentIds.has(s.id));
    }
    if (role === 'HOD' || role === 'EXAM_OFFICER') {
      const departmentId = req.user!.departmentId;
      list = departmentId ? list.filter((s) => s.departmentId === departmentId) : [];
    }
    if (role === 'DEAN') {
      const schoolId = req.user!.schoolId;
      list = schoolId ? list.filter((s) => s.schoolId === schoolId) : [];
    }
    if (['HOD', 'DEAN', 'EXAM_OFFICER', 'LECTURER', 'BURSAR'].includes(role)) {
      list = list.map((student) => ({
        ...student,
        email: '',
        phone: '',
        photoUrl: '',
        gender: '',
        dob: '',
        emergencyContact: '',
        nextOfKin: '',
      }));
    }

    return res.json({ success: true, students: list });
  }
);

apiRouter.post(
  '/students',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { fullName, email, phone, password, programmeId, level, gender, dob, photoUrl } = req.body;
    if (!fullName || !email || !programmeId) {
      return res.status(400).json({ success: false, message: 'Full name, email, and programme are required.' });
    }
    const state = db.getState();
    let user = state.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim());
    if (!user) {
      user = {
        id: 'usr-std-' + Date.now(),
        email: String(email).toLowerCase().trim(),
        passwordHash: bcrypt.hashSync(password || 'Password123!', 10),
        fullName: String(fullName).trim(),
        role: 'STUDENT',
        phone: phone || '',
        photoUrl: photoUrl || '',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString(),
      };
      state.users.push(user);
    } else {
      user.role = 'STUDENT';
      if (photoUrl) user.photoUrl = photoUrl;
    }

    const prog = state.programmes.find((p) => p.id === programmeId);
    const dept = state.departments.find((d) => d.id === prog?.departmentId);
    const school = state.schools.find((s) => s.id === dept?.schoolId);
    const matric = `EDOCASTI/${prog?.qualification || 'ND'}/${state.settings.currentSession.slice(0, 4)}/${String(state.students.length + 101).padStart(4, '0')}`;
    const student: Student = {
      id: 'std-' + Date.now(),
      matricNumber: matric,
      userId: user.id,
      photoUrl: photoUrl || user.photoUrl || '',
      programmeId,
      departmentId: dept?.id || 'dept-agric',
      schoolId: school?.id || 'sch-agric',
      level: level || `${prog?.qualification || 'ND'} I`,
      sessionAdmitted: state.settings.currentSession,
      academicStatus: 'Good Standing',
      gender: gender || 'Male',
      dob: dob || '2004-01-01',
      emergencyContact: phone || '',
      nextOfKin: 'Parent/Guardian',
      cgpa: 0,
      totalCreditsEarned: 0,
    };
    state.students.push(student);
    db.saveState();
    return res.status(201).json({ success: true, student });
  }
);

apiRouter.put(
  '/students/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const student = state.students.find((s) => s.id === id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

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
      schoolId,
    } = req.body;
    if (matricNumber !== undefined) student.matricNumber = String(matricNumber).trim();
    if (level !== undefined) student.level = level;
    if (academicStatus !== undefined) student.academicStatus = academicStatus;
    if (cgpa !== undefined) student.cgpa = Number(cgpa);
    if (totalCreditsEarned !== undefined) student.totalCreditsEarned = Number(totalCreditsEarned);
    if (emergencyContact !== undefined) student.emergencyContact = emergencyContact;
    if (nextOfKin !== undefined) student.nextOfKin = nextOfKin;
    if (photoUrl !== undefined) student.photoUrl = photoUrl;
    if (programmeId !== undefined) student.programmeId = programmeId;
    if (departmentId !== undefined) student.departmentId = departmentId;
    if (schoolId !== undefined) student.schoolId = schoolId;

    const usr = state.users.find((u) => u.id === student.userId);
    if (usr) {
      if (fullName !== undefined) usr.fullName = String(fullName).trim();
      if (phone !== undefined) usr.phone = phone;
      if (photoUrl !== undefined) usr.photoUrl = photoUrl;
    }

    db.saveState();
    return res.json({ success: true, student });
  }
);

apiRouter.delete(
  '/students/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.students.findIndex((s) => s.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Student not found.' });
    state.students.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Student record deleted.' });
  }
);

apiRouter.get('/students/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const state = db.getState();
  const student = state.students.find((s) => s.userId === user.id);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
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
      photoUrl: student.photoUrl || user.photoUrl || app?.photoUrl || '',
      programmeName: prog?.name,
      departmentName: dept?.name,
      schoolName: school?.name,
    },
  });
});

// ==================== COURSE REGISTRATION ====================

apiRouter.get(
  '/registrations',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'EXAM_OFFICER', 'HOD'),
  (req: AuthenticatedRequest, res: Response) => {
  const { session, semester, studentId } = req.query;
  const state = db.getState();
  let list = state.registrations;
  const actorRole = req.user!.role;
  if (actorRole === 'EXAM_OFFICER' || actorRole === 'HOD') {
    const departmentId = req.user!.departmentId;
    const departmentCourseIds = new Set(state.courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
    list = departmentId
      ? list.filter((registration) => registration.courseIds.every((courseId) => departmentCourseIds.has(courseId)))
      : [];
  }
  if (session) list = list.filter((r) => r.session === session);
  if (semester) list = list.filter((r) => r.semester === semester);
  if (studentId) list = list.filter((r) => r.studentId === studentId);
  const registrations = list.map((registration) => {
    const student = state.students.find((s) => s.id === registration.studentId);
    const user = student ? state.users.find((u) => u.id === student.userId) : undefined;
    const courses = registration.courseIds
      .map((courseId) => state.courses.find((course) => course.id === courseId))
      .filter(Boolean)
      .map((course) => ({
        id: course!.id,
        code: course!.code,
        title: course!.title,
        creditUnits: course!.creditUnits,
        level: course!.level,
        semester: course!.semester,
        lecturerName: course!.lecturerName,
      }));
    return {
      ...registration,
      studentName: user?.fullName || 'Unknown Student',
      matricNumber: student?.matricNumber || '',
      programmeName: state.programmes.find((p) => p.id === student?.programmeId)?.name || '',
      departmentName: state.departments.find((d) => d.id === student?.departmentId)?.name || '',
      courses,
    };
  });
  return res.json({ success: true, registrations });
});

apiRouter.get('/registrations/my-registration', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const state = db.getState();
  const student = state.students.find((s) => s.userId === req.user!.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student record not found.' });
  }

  const reg = state.registrations.find(
    (r) =>
      r.studentId === student.id &&
      r.session === state.settings.currentSession &&
      r.semester === state.settings.currentSemester
  );

  return res.json({ success: true, registration: reg || null });
});

apiRouter.post('/registrations/register', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const state = db.getState();
  const student = state.students.find((s) => s.userId === req.user!.id);
  if (!student) {
    return res.status(403).json({ success: false, message: 'Only active students can register courses.' });
  }

  const { courseIds } = req.body;
  if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Must select at least one course.' });
  }

  // Calculate credit units
  const courses = state.courses.filter((c) => courseIds.includes(c.id));
  const totalCredits = courses.reduce((sum, c) => sum + c.creditUnits, 0);

  const existing = state.registrations.find(
    (r) =>
      r.studentId === student.id &&
      r.session === state.settings.currentSession &&
      r.semester === state.settings.currentSemester
  );

  if (existing && existing.status !== 'REJECTED') {
    return res.status(409).json({
      success: false,
      message: 'Your course registration has already been submitted. It cannot be changed unless it is rejected by the reviewing officer.',
      registration: existing,
    });
  }

  if (courses.length !== new Set(courseIds).size) {
    return res.status(400).json({ success: false, message: 'One or more selected courses are invalid.' });
  }

  const registrationData: CourseRegistration = {
    id: existing?.id || 'reg-' + Date.now(),
    studentId: student.id,
    session: state.settings.currentSession,
    semester: state.settings.currentSemester,
    level: student.level,
    courseIds,
    totalCredits,
    status: 'SUBMITTED',
    createdAt: new Date().toISOString(),
  };

  if (existing) {
    const idx = state.registrations.findIndex((r) => r.id === existing.id);
    state.registrations[idx] = registrationData;
  } else {
    state.registrations.push(registrationData);
  }

  db.saveState();
  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'COURSE_REGISTRATION_SUBMITTED',
    resource: 'REGISTRATION',
    details: { totalCredits, coursesCount: courseIds.length },
    ipAddress: req.ip,
  });

  return res.json({ success: true, registration: registrationData });
});

apiRouter.patch(
  '/registrations/:id/approve',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'HOD'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const reg = db.getState().registrations.find((r) => r.id === id);
    if (!reg) {
      return res.status(404).json({ success: false, message: 'Registration not found.' });
    }

    if (req.user!.role === 'HOD') {
      const departmentId = req.user!.departmentId;
      const allowedCourseIds = new Set(db.getState().courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
      if (!departmentId || !reg.courseIds.every((courseId) => allowedCourseIds.has(courseId))) return res.status(403).json({ success: false, message: 'You can only approve registrations for your department.' });
    }
    if (reg.status === 'APPROVED_BY_HOD') {
      return res.status(409).json({ success: false, message: 'This registration has already been approved.' });
    }
    if (reg.status !== 'SUBMITTED') {
      return res.status(400).json({ success: false, message: 'Only submitted registrations can be approved.' });
    }
    reg.status = 'APPROVED_BY_HOD';
    reg.approvedAt = new Date().toISOString();
    reg.approvedBy = `${req.user!.fullName} (${req.user!.role})`;

    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'COURSE_REGISTRATION_APPROVED',
      resource: 'REGISTRATION',
      details: { registrationId: id, approvedBy: reg.approvedBy },
      ipAddress: req.ip,
    });

    return res.json({ success: true, registration: reg });
  }
);

apiRouter.post(
  '/registrations/approve-bulk',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'HOD'),
  (req: AuthenticatedRequest, res: Response) => {
    const { registrationIds, session, semester } = req.body;
    const state = db.getState();
    if (!Array.isArray(registrationIds) && !session && !semester) {
      return res.status(400).json({ success: false, message: 'Provide registrationIds or a session/semester filter.' });
    }
    const selectedIds = Array.isArray(registrationIds) ? new Set(registrationIds) : null;
    const now = new Date().toISOString();
    let approvedCount = 0;
    for (const registration of state.registrations) {
      const selected = selectedIds
        ? selectedIds.has(registration.id)
        : (!session || registration.session === session) && (!semester || registration.semester === semester);
      const hodDepartmentId = req.user!.role === 'HOD' ? req.user!.departmentId : undefined;
      const hodCourseIds = hodDepartmentId ? new Set(state.courses.filter((course) => course.departmentId === hodDepartmentId).map((course) => course.id)) : null;
      const withinHodDepartment = req.user!.role !== 'HOD' || Boolean(hodDepartmentId && registration.courseIds.every((courseId) => Boolean(hodCourseIds?.has(courseId))));
      if (selected && withinHodDepartment && registration.status === 'SUBMITTED') {
        registration.status = 'APPROVED_BY_HOD';
        registration.approvedAt = now;
        registration.approvedBy = `${req.user!.fullName} (${req.user!.role})`;
        approvedCount++;
      }
    }
    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'COURSE_REGISTRATIONS_BULK_APPROVED',
      resource: 'REGISTRATION',
      details: { approvedCount, registrationIds: Array.isArray(registrationIds) ? registrationIds : undefined, session, semester },
      ipAddress: req.ip,
    });
    return res.json({ success: true, approvedCount });
  }
);

apiRouter.patch(
  '/registrations/:id/reject',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'HOD'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const reg = db.getState().registrations.find((r) => r.id === id);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found.' });
    if (req.user!.role === 'HOD') {
      const departmentId = req.user!.departmentId;
      const allowedCourseIds = new Set(db.getState().courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
      if (!departmentId || !reg.courseIds.every((courseId) => allowedCourseIds.has(courseId))) return res.status(403).json({ success: false, message: 'You can only reject registrations for your department.' });
    }
    reg.status = 'REJECTED';
    reg.approvedAt = new Date().toISOString();
    reg.approvedBy = `${req.user!.fullName} (${req.user!.role})`;
    db.saveState();
    return res.json({ success: true, registration: reg });
  }
);

apiRouter.put(
  '/registrations/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'HOD'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const reg = db.getState().registrations.find((r) => r.id === id);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found.' });
    if (req.user!.role === 'HOD') {
      const departmentId = req.user!.departmentId;
      const allowedCourseIds = new Set(db.getState().courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
      if (!departmentId || !reg.courseIds.every((courseId) => allowedCourseIds.has(courseId))) return res.status(403).json({ success: false, message: 'You can only edit registrations for your department.' });
    }
    if (reg.status === 'APPROVED_BY_HOD') {
      return res.status(409).json({ success: false, message: 'Approved registrations are locked against changes.' });
    }
    const { courseIds } = req.body;
    if (courseIds !== undefined) {
      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one course must be selected.' });
      }
      const state = db.getState();
      const courses = state.courses.filter((c) => courseIds.includes(c.id));
      if (courses.length !== new Set(courseIds).size) {
        return res.status(400).json({ success: false, message: 'One or more selected courses are invalid.' });
      }
      reg.courseIds = courseIds;
      reg.totalCredits = courses.reduce((sum, course) => sum + course.creditUnits, 0);
    }
    db.saveState();
    return res.json({ success: true, registration: reg });
  }
);

apiRouter.delete(
  '/registrations/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.registrations.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Registration not found.' });
    state.registrations.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Registration deleted.' });
  }
);

// ==================== RESULTS & EXAMINATIONS ====================

function recalculateStudentAcademicTotals(state: ReturnType<typeof db.getState>, studentId: string) {
  const studentResults = state.results.filter((r) => r.studentId === studentId && r.status === 'PUBLISHED');
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

apiRouter.get('/results', authenticateToken, requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'HOD', 'EXAM_OFFICER', 'LECTURER'), (req: AuthenticatedRequest, res: Response) => {
  const { courseId, session, semester, studentId, status } = req.query;
  let list = db.getState().results;

  if (courseId) list = list.filter((r) => r.courseId === courseId);
  if (session) list = list.filter((r) => r.session === session);
  if (semester) list = list.filter((r) => r.semester === semester);
  if (studentId) list = list.filter((r) => r.studentId === studentId);
  if (status) list = list.filter((r) => r.status === status);
  const state = db.getState();
  const role = req.user!.role;
  if (role === 'LECTURER') {
    const assignedCourseIds = new Set(state.courses.filter((c) => c.lecturerId === req.user!.id).map((c) => c.id));
    list = list.filter((r) => assignedCourseIds.has(r.courseId));
  }
  if (role === 'HOD' || role === 'EXAM_OFFICER') {
    const departmentId = req.user!.departmentId;
    const departmentCourseIds = new Set(state.courses.filter((course) => course.departmentId === departmentId).map((course) => course.id));
    list = departmentId ? list.filter((result) => departmentCourseIds.has(result.courseId)) : [];
  }

  return res.json({ success: true, results: list });
});

apiRouter.get(
  '/results/neon-attempts',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'LECTURER', 'EXAM_OFFICER'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const state = db.getState();
      const allowedStatuses = ['SUBMITTED', 'VERIFIED', 'APPROVED', 'PUBLISHED', 'INVALIDATED', 'CANCELLED'];
      const queryFilters = [
        ['studentId', req.query.studentId, 200],
        ['courseId', req.query.courseId, 200],
        ['session', req.query.session, 40],
      ] as const;
      for (const [label, value, maxLength] of queryFilters) {
        if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength)) {
          return res.status(400).json({ success: false, message: `Invalid ${label} filter.` });
        }
      }
      if (req.query.semester !== undefined
          && (typeof req.query.semester !== 'string'
            || !['First Semester', 'Second Semester'].includes(req.query.semester))) {
        return res.status(400).json({ success: false, message: 'Invalid semester filter.' });
      }
      if (req.query.status !== undefined
          && (typeof req.query.status !== 'string' || !allowedStatuses.includes(req.query.status))) {
        return res.status(400).json({ success: false, message: 'Invalid result status filter.' });
      }
      const filters = {
        studentId: typeof req.query.studentId === 'string' ? req.query.studentId.trim() : undefined,
        courseId: typeof req.query.courseId === 'string' ? req.query.courseId.trim() : undefined,
        academicSession: typeof req.query.session === 'string' ? req.query.session.trim() : undefined,
        semester: req.query.semester as 'First Semester' | 'Second Semester' | undefined,
      };
      const attempts = await listAcademicResultAttempts(filters);
      const assignedCourseIds = req.user!.role === 'LECTURER'
        ? new Set(state.courses.filter((course) => course.lecturerId === req.user!.id).map((course) => course.id))
        : null;
      const results = attempts
        .filter((attempt) => !assignedCourseIds || assignedCourseIds.has(String(attempt.course_id)))
        .filter((attempt) => req.query.status === undefined || attempt.latest_event_type === req.query.status)
        .map((attempt) => {
          const student = state.students.find((item) => item.id === attempt.student_id);
          const user = student ? state.users.find((item) => item.id === student.userId) : undefined;
          return {
            id: attempt.result_attempt_id,
            legacyResultId: attempt.legacy_result_id,
            courseId: attempt.course_id,
            studentId: attempt.student_id,
            matricNumber: student?.matricNumber || '',
            studentName: user?.fullName || 'Student',
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
              at: attempt.latest_event_at,
            },
            createdAt: attempt.created_at,
          };
        });
      return res.json({ success: true, results, source: 'NEON_ATTEMPT_LEDGER' });
    } catch {
      // Keep database and connection details out of API responses.
      return res.status(503).json({
        success: false,
        message: 'Neon result attempts are temporarily unavailable.',
      });
    }
  }
);

apiRouter.post(
  '/results/neon-attempts/:id/events',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'EXAM_OFFICER'),
  async (req: AuthenticatedRequest, res: Response) => {
    const resultAttemptId = String(req.params.id || '').trim();
    const { eventType, idempotencyKey, reason } = req.body || {};
    const allowedEvents = ['VERIFIED', 'APPROVED', 'PUBLISHED'] as const;

    if (!resultAttemptId || resultAttemptId.length > 200) {
      return res.status(400).json({ success: false, message: 'A valid result attempt ID is required.' });
    }
    if (typeof eventType !== 'string' || !allowedEvents.includes(eventType as typeof allowedEvents[number])) {
      return res.status(400).json({ success: false, message: 'Only VERIFIED, APPROVED, or PUBLISHED events may be recorded here.' });
    }
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.trim().length > 200) {
      return res.status(400).json({ success: false, message: 'A valid idempotency key is required.' });
    }
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 1000)) {
      return res.status(400).json({ success: false, message: 'The reason must be text no longer than 1000 characters.' });
    }

    try {
      const outcome = await appendAcademicResultEvent({
        resultAttemptId,
        eventType: eventType as typeof allowedEvents[number],
        actorUserId: req.user!.id,
        idempotencyKey: idempotencyKey.trim(),
        reason: typeof reason === 'string' ? reason.trim() : undefined,
      });
      // The Neon event is already committed. Audit only newly created events;
      // an audit-file failure must not turn a committed workflow action into a
      // misleading HTTP conflict that encourages an unsafe second action.
      if (outcome.created) {
        try {
          db.logAudit({
            userId: req.user!.id,
            userEmail: req.user!.email,
            action: `ACADEMIC_RESULT_${eventType}`,
            resource: 'ACADEMIC_RESULT_ATTEMPT',
            details: { resultAttemptId, eventId: outcome.event.id },
            ipAddress: req.ip,
          });
        } catch (auditError) {
          console.error('Failed to write audit log for committed academic result event.', {
            eventId: outcome.event.id,
            error: auditError instanceof Error ? auditError.message : 'Unknown audit error',
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
          createdAt: outcome.event.created_at,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'Academic result attempt not found.') {
        return res.status(404).json({ success: false, message: 'Academic result attempt not found.' });
      }
      // Database transition and idempotency failures are intentionally generic.
      return res.status(409).json({
        success: false,
        message: 'The result workflow transition was rejected. Check the current stage and use a new idempotency key only for a new action.',
      });
    }
  }
);

apiRouter.get('/results/my-results', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const state = db.getState();
  const student = state.students.find((s) => s.userId === req.user!.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student record not found.' });
  }

  // Only return PUBLISHED (Exam Officer approved) results to students
  const published = state.results.filter((r) => r.studentId === student.id && r.status === 'PUBLISHED');
  return res.json({ success: true, results: published });
});

apiRouter.post(
  '/results/score-entry',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'LECTURER'),
  (req: AuthenticatedRequest, res: Response) => {
    const { courseId, studentId, matricNumber, studentName, session, semester, caScore, examScore } = req.body;
    if (!courseId || !studentId) {
      return res.status(400).json({ success: false, message: 'Course and student must be specified.' });
    }

    const state = db.getState();
    const targetCourse = state.courses.find((c) => c.id === courseId);
    if (!targetCourse) return res.status(404).json({ success: false, message: 'Course not found.' });
    if (req.user!.role === 'LECTURER' && targetCourse.lecturerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'You can only enter scores for courses assigned to you.' });
    }
    const targetSession = session || state.settings.currentSession;
    const targetSemester = semester || state.settings.currentSemester;
    const ca = Math.max(0, Math.min(Number(caScore || 0), state.settings.caMaxMarks));
    const ex = Math.max(0, Math.min(Number(examScore || 0), state.settings.examMaxMarks));
    const total = ca + ex;
    const { grade, gradePoint } = computeGradeAndPoints(total);

    const existing = state.results.find(
      (r) => r.courseId === courseId && r.studentId === studentId && r.session === targetSession && r.semester === targetSemester
    );

    const isAutoPublishRole = ['SUPER_ADMIN', 'RECTOR', 'EXAM_OFFICER'].includes(req.user!.role);
    const nextStatus = existing?.status === 'PUBLISHED' && isAutoPublishRole ? 'PUBLISHED' : 'SUBMITTED';

    const resultRecord: AssessmentResult = {
      id: existing?.id || 'res-' + Date.now() + '-' + Math.floor(Math.random() * 100),
      courseId,
      studentId,
      matricNumber: matricNumber || 'EDOCASTI/ND/2024/0000',
      studentName: studentName || 'Student',
      session: targetSession,
      semester: targetSemester,
      caScore: ca,
      examScore: ex,
      totalScore: total,
      grade,
      gradePoint,
      status: nextStatus,
      submittedBy: `${req.user!.fullName} (${req.user!.role})`,
    };

    if (existing) {
      const idx = state.results.findIndex((r) => r.id === existing.id);
      state.results[idx] = resultRecord;
    } else {
      state.results.push(resultRecord);
    }

    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'RESULT_SCORE_ENTERED',
      resource: 'RESULT',
      details: { courseId, studentId, ca, exam: ex, total, grade },
      ipAddress: req.ip,
    });

    return res.json({ success: true, result: resultRecord });
  }
);

apiRouter.patch(
  '/results/:id/publish',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'EXAM_OFFICER'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const resItem = state.results.find((r) => r.id === id);
    if (!resItem) {
      return res.status(404).json({ success: false, message: 'Result not found.' });
    }

    resItem.status = 'PUBLISHED';
    resItem.publishedAt = new Date().toISOString();
    resItem.approvedBy = `${req.user!.fullName} (${req.user!.role})`;
    recalculateStudentAcademicTotals(state, resItem.studentId);

    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'RESULT_APPROVED_AND_PUBLISHED',
      resource: 'RESULT',
      details: { resultId: id, courseId: resItem.courseId, studentId: resItem.studentId },
      ipAddress: req.ip,
    });

    return res.json({ success: true, result: resItem });
  }
);

apiRouter.post(
  '/results/approve-bulk',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'EXAM_OFFICER'),
  (req: AuthenticatedRequest, res: Response) => {
    const { resultIds, courseId } = req.body || {};

    if (resultIds !== undefined && (!Array.isArray(resultIds) || resultIds.some((id: unknown) => typeof id !== 'string'))) {
      return res.status(400).json({ success: false, message: 'Result IDs must be an array of valid IDs.' });
    }

    const requestedIds = new Set<string>(resultIds || []);
    const hasCourseFilter = typeof courseId === 'string' && courseId.trim().length > 0;
    if (requestedIds.size === 0 && !hasCourseFilter) {
      return res.status(400).json({ success: false, message: 'Select submitted results or specify a course.' });
    }

    const state = db.getState();
    const now = new Date().toISOString();
    const touchedStudents = new Set<string>();
    const eligibleResults = state.results.filter((result) => {
      if (result.status !== 'SUBMITTED') return false;
      const matchesId = requestedIds.has(result.id);
      const matchesCourse = hasCourseFilter && result.courseId === courseId;
      return matchesId || matchesCourse;
    });

    for (const result of eligibleResults) {
      result.status = 'PUBLISHED';
      result.publishedAt = now;
      result.approvedBy = `${req.user!.fullName} (${req.user!.role})`;
      touchedStudents.add(result.studentId);
    }

    touchedStudents.forEach((studentId) => recalculateStudentAcademicTotals(state, studentId));
    if (eligibleResults.length > 0) db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'RESULTS_BULK_APPROVED',
      resource: 'RESULT',
      details: {
        count: eligibleResults.length,
        requestedCount: requestedIds.size,
        courseId: hasCourseFilter ? courseId : undefined,
        resultIds: eligibleResults.map((result) => result.id),
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      approvedCount: eligibleResults.length,
      skippedCount: Math.max(0, requestedIds.size - eligibleResults.length),
    });
  }
);

apiRouter.put(
  '/results/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'LECTURER'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const resItem = state.results.find((r) => r.id === id);
    if (!resItem) {
      return res.status(404).json({ success: false, message: 'Result not found.' });
    }
    const resultCourse = state.courses.find((c) => c.id === resItem.courseId);
    if (req.user!.role === 'LECTURER' && resultCourse?.lecturerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'You can only update results for courses assigned to you.' });
    }
    if (req.user!.role === 'LECTURER' && req.body.status !== undefined) {
      return res.status(403).json({ success: false, message: 'Lecturers cannot approve or publish results.' });
    }
    const { caScore, examScore, status } = req.body;
    if (caScore !== undefined) {
      resItem.caScore = Math.max(0, Math.min(Number(caScore), state.settings.caMaxMarks));
    }
    if (examScore !== undefined) {
      resItem.examScore = Math.max(0, Math.min(Number(examScore), state.settings.examMaxMarks));
    }
    resItem.totalScore = resItem.caScore + resItem.examScore;
    const { grade, gradePoint } = computeGradeAndPoints(resItem.totalScore);
    resItem.grade = grade;
    resItem.gradePoint = gradePoint;
    if (status !== undefined) {
      resItem.status = status;
      if (status === 'PUBLISHED' && !resItem.publishedAt) {
        resItem.publishedAt = new Date().toISOString();
      }
    }
    recalculateStudentAcademicTotals(state, resItem.studentId);
    db.saveState();
    return res.json({ success: true, result: resItem });
  }
);

apiRouter.delete(
  '/results/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'EXAM_OFFICER'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.results.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Result not found.' });
    state.results.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Result record deleted.' });
  }
);

// ==================== TRANSCRIPTS & FINAL CERTIFICATES (REGISTRAR) ====================

function computeHonoursClassification(cgpa: number): string {
  if (cgpa >= 3.5) return 'Distinction';
  if (cgpa >= 3.0) return 'Upper Credit';
  if (cgpa >= 2.5) return 'Lower Credit';
  if (cgpa >= 2.0) return 'Pass';
  return 'Probation / Incomplete';
}

apiRouter.get(
  '/documents',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const state = db.getState();
    const list = (state.issuedDocuments || []).map((doc) => {
      const inv = state.invoices.find((i) => i.id === doc.invoiceId);
      const publishedResults = state.results
        .filter((r) => r.studentId === doc.studentId && r.status === 'PUBLISHED')
        .map((r) => {
          const crs = state.courses.find((c) => c.id === r.courseId);
          return { ...r, courseCode: crs?.code || r.courseId, courseTitle: crs?.title || 'Course', creditUnits: crs?.creditUnits || 3 };
        });
      return {
        ...doc,
        paymentStatus: inv?.status || 'UNPAID',
        resultsSnapshot: publishedResults,
      };
    });
    return res.json({ success: true, documents: list });
  }
);

apiRouter.get('/documents/my-documents', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const state = db.getState();
  const student = state.students.find((s) => s.userId === req.user!.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
  }

  const usr = state.users.find((u) => u.id === student.userId);
  const admissionApp = state.applications.find((a) => a.userId === student.userId && a.status === 'ACCEPTED');
  const programme = state.programmes.find((p) => p.id === student.programmeId);
  const department = state.departments.find((d) => d.id === student.departmentId);
  const school = state.schools.find((s) => s.id === student.schoolId);
  const admissionLetter = admissionApp ? [{
    id: `admission-${admissionApp.id}`,
    studentId: student.id,
    type: 'ADMISSION_LETTER',
    title: 'Official Admission Letter',
    documentNumber: admissionApp.applicationNumber,
    matricNumber: student.matricNumber,
    studentName: usr?.fullName || admissionApp.firstName + ' ' + admissionApp.lastName,
    programmeName: programme?.name || 'National Diploma Programme',
    departmentName: department?.name || '',
    schoolName: school?.name || '',
    level: student.level,
    photoUrl: student.photoUrl || usr?.photoUrl || admissionApp.photoUrl || '',
    session: admissionApp.session,
    generatedAt: admissionApp.decisionAt || admissionApp.submittedAt,
    generatedBy: admissionApp.reviewedBy || 'Admissions Office',
    paymentStatus: 'NOT_REQUIRED',
    isUnlocked: true,
    remarks: 'Admission offer accepted. This letter confirms the student admission.',
  }] : [];
  const issuedDocs = (state.issuedDocuments || [])
    .filter((d) => d.studentId === student.id)
    .map((doc) => {
      const inv = state.invoices.find((i) => i.id === doc.invoiceId);
      const paymentStatus = inv?.status || 'UNPAID';
      const isUnlocked = paymentStatus === 'PAID';

      const publishedResults = isUnlocked
        ? state.results
            .filter((r) => r.studentId === student.id && r.status === 'PUBLISHED')
            .map((r) => {
              const crs = state.courses.find((c) => c.id === r.courseId);
              return {
                ...r,
                courseCode: crs?.code || r.courseId,
                courseTitle: crs?.title || 'Academic Course',
                creditUnits: crs?.creditUnits || 3,
              };
            })
        : undefined;

      return {
        ...doc,
        photoUrl: doc.photoUrl || student.photoUrl || usr?.photoUrl || '',
        paymentStatus,
        resultsSnapshot: publishedResults,
      };
    });
  const myDocs = [...admissionLetter, ...issuedDocs];

  return res.json({ success: true, documents: myDocs });
});

apiRouter.post(
  '/documents/generate',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId, type, feeAmount, remarks, classification } = req.body;
    if (!studentId || !type || !['TRANSCRIPT', 'FINAL_CERTIFICATE'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Valid studentId and document type (TRANSCRIPT or FINAL_CERTIFICATE) are required.' });
    }

    const state = db.getState();
    const student = state.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const usr = state.users.find((u) => u.id === student.userId);
    const prog = state.programmes.find((p) => p.id === student.programmeId);
    const dept = state.departments.find((d) => d.id === student.departmentId);
    const sch = state.schools.find((s) => s.id === student.schoolId);
    const app = state.applications.find((a) => a.userId === student.userId);

    const existing = (state.issuedDocuments || []).find((d) => d.studentId === studentId && d.type === type);
    if (existing) {
      return res.status(409).json({ success: false, message: `${type === 'TRANSCRIPT' ? 'Transcript' : 'Final Certificate'} has already been generated for this student.` });
    }

    const defaultFee =
      type === 'TRANSCRIPT'
        ? state.settings.transcriptFee || 10000
        : state.settings.certificateFee || 25000;
    const resolvedFee = feeAmount !== undefined ? Number(feeAmount) : defaultFee;

    const inv: Invoice = {
      id: 'inv-doc-' + Date.now(),
      invoiceNumber: `INV/${state.settings.currentSession.slice(0, 4)}/${Math.floor(10000 + Math.random() * 90000)}`,
      studentId: student.id,
      session: state.settings.currentSession,
      title: type === 'TRANSCRIPT' ? 'Official Academic Transcript Processing Fee' : 'Final Graduation Certificate Issuance Fee',
      amount: resolvedFee,
      amountPaid: resolvedFee <= 0 ? 0 : 0,
      status: resolvedFee <= 0 ? 'PAID' : 'UNPAID',
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    state.invoices.push(inv);

    const docNumber = `${type === 'TRANSCRIPT' ? 'TRN' : 'CERT'}/EDOCASTI/${new Date().getFullYear()}/${String((state.issuedDocuments?.length || 0) + 1).padStart(4, '0')}`;
    const doc: IssuedDocument = {
      id: 'doc-' + Date.now(),
      studentId: student.id,
      matricNumber: student.matricNumber,
      studentName: usr?.fullName || 'Student',
      programmeName: prog?.name || 'National Diploma Programme',
      departmentName: dept?.name || '',
      schoolName: sch?.name || '',
      level: student.level,
      photoUrl: student.photoUrl || usr?.photoUrl || app?.photoUrl || '',
      type,
      documentNumber: docNumber,
      title: type === 'TRANSCRIPT' ? 'Official Academic Transcript' : 'Final Diploma / Graduation Certificate',
      session: state.settings.currentSession,
      cgpa: student.cgpa,
      classification: classification || computeHonoursClassification(student.cgpa),
      remarks: remarks || 'Completed all academic & practical requirements in good standing.',
      feeAmount: resolvedFee,
      invoiceId: inv.id,
      generatedBy: `${req.user!.fullName} (${req.user!.role})`,
      generatedAt: new Date().toISOString(),
    };

    if (!state.issuedDocuments) state.issuedDocuments = [];
    state.issuedDocuments.unshift(doc);
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: `${type}_GENERATED`,
      resource: 'ISSUED_DOCUMENT',
      details: { documentNumber: docNumber, studentId: student.id, feeAmount: resolvedFee },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, document: { ...doc, paymentStatus: inv.status }, invoice: inv });
  }
);

apiRouter.put(
  '/documents/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const doc = (state.issuedDocuments || []).find((d) => d.id === id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
    const { classification, remarks, feeAmount } = req.body;
    if (classification !== undefined) doc.classification = classification;
    if (remarks !== undefined) doc.remarks = remarks;
    if (feeAmount !== undefined) {
      doc.feeAmount = Number(feeAmount);
      const inv = state.invoices.find((i) => i.id === doc.invoiceId);
      if (inv && inv.status !== 'PAID') inv.amount = Number(feeAmount);
    }
    db.saveState();
    return res.json({ success: true, document: doc });
  }
);

apiRouter.delete(
  '/documents/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = (state.issuedDocuments || []).findIndex((d) => d.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Document not found.' });
    state.issuedDocuments.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Issued document deleted.' });
  }
);

// ==================== FINANCE & PAYMENTS ====================

apiRouter.get('/finance/fee-schedules', (req, res) => {
  return res.json({ success: true, feeSchedules: db.getState().feeSchedules });
});

apiRouter.post(
  '/finance/fee-schedules',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { title, category, level, session, amount, programmeId } = req.body;
    const state = db.getState();
    const cleanTitle = String(title || '').trim();
    const cleanCategory = String(category || '').trim();
    const cleanSession = String(session || state.settings.currentSession || '').trim();
    const cleanLevel = String(level || 'All').trim();
    const allowedLevels = ['All', 'ND I', 'ND II', 'HND I', 'HND II'];
    const allowedCategories: FeeSchedule['category'][] = ['Tuition', 'Acceptance', 'Registration', 'Laboratory', 'Hostel', 'Other'];

    if (!cleanTitle || !cleanCategory || amount === undefined || !cleanSession) {
      return res.status(400).json({ success: false, message: 'Fee title, category, amount, and academic session are required.' });
    }
    if (!allowedCategories.includes(cleanCategory as FeeSchedule['category'])) {
      return res.status(400).json({ success: false, message: 'Select a valid fee category.' });
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Fee amount must be a valid non-negative number.' });
    }
    if (!allowedLevels.includes(cleanLevel)) {
      return res.status(400).json({ success: false, message: 'Select a valid fee level.' });
    }
    if (programmeId && !state.programmes.some((programme) => programme.id === String(programmeId))) {
      return res.status(400).json({ success: false, message: 'The selected programme does not exist.' });
    }
    const newFee: FeeSchedule = {
      id: 'fee-' + Date.now(),
      programmeId: programmeId ? String(programmeId) : undefined,
      title: cleanTitle,
      category: cleanCategory as FeeSchedule['category'],
      level: cleanLevel,
      session: cleanSession,
      amount: Number(amount),
    };
    db.getState().feeSchedules.push(newFee);
    db.saveState();
    return res.status(201).json({ success: true, feeSchedule: newFee });
  }
);

apiRouter.put(
  '/finance/fee-schedules/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const fee = state.feeSchedules.find((f) => f.id === id);
    if (!fee) return res.status(404).json({ success: false, message: 'Fee schedule item not found.' });

    const { title, category, level, session, amount, programmeId } = req.body;
    const allowedLevels = ['All', 'ND I', 'ND II', 'HND I', 'HND II'];
    const allowedCategories: FeeSchedule['category'][] = ['Tuition', 'Acceptance', 'Registration', 'Laboratory', 'Hostel', 'Other'];
    const updated = { ...fee };

    if (title !== undefined) updated.title = String(title).trim();
    if (category !== undefined) {
      const cleanCategory = String(category).trim();
      if (!allowedCategories.includes(cleanCategory as FeeSchedule['category'])) {
        return res.status(400).json({ success: false, message: 'Select a valid fee category.' });
      }
      updated.category = cleanCategory as FeeSchedule['category'];
    }
    if (level !== undefined) updated.level = String(level).trim();
    if (session !== undefined) updated.session = String(session).trim();
    if (programmeId !== undefined) updated.programmeId = programmeId ? String(programmeId) : undefined;
    if (amount !== undefined) updated.amount = Number(amount);

    if (!updated.title) return res.status(400).json({ success: false, message: 'Fee title cannot be empty.' });
    if (!updated.category) return res.status(400).json({ success: false, message: 'Fee category cannot be empty.' });
    if (!updated.session) return res.status(400).json({ success: false, message: 'Academic session cannot be empty.' });
    if (!allowedLevels.includes(String(updated.level || 'All'))) {
      return res.status(400).json({ success: false, message: 'Select a valid fee level.' });
    }
    if (!Number.isFinite(Number(updated.amount)) || Number(updated.amount) < 0) {
      return res.status(400).json({ success: false, message: 'Fee amount must be a valid non-negative number.' });
    }
    if (updated.programmeId && !state.programmes.some((programme) => programme.id === updated.programmeId)) {
      return res.status(400).json({ success: false, message: 'The selected programme does not exist.' });
    }

    Object.assign(fee, updated);
    db.saveState();
    return res.json({ success: true, feeSchedule: fee });
  }
);

apiRouter.delete(
  '/finance/fee-schedules/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.feeSchedules.findIndex((f) => f.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Fee schedule item not found.' });
    state.feeSchedules.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Fee item deleted.' });
  }
);

apiRouter.get('/finance/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'STUDENT' && !['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'BURSAR'].includes(user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to view the fee ledger.' });
  }
  const { studentId } = req.query;
  let list = db.getState().invoices;
  if (user.role === 'STUDENT') {
    const student = db.getState().students.find((s) => s.userId === user.id);
    list = list.filter((invoice) => invoice.studentId === student?.id);
  } else if (studentId) {
    list = list.filter((invoice) => invoice.studentId === studentId);
  }
  return res.json({ success: true, invoices: list });
});

apiRouter.post('/finance/pay', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { invoiceId, channel } = req.body;
  const state = db.getState();
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  const payingStudent = state.students.find((student) => student.userId === req.user!.id);
  if (req.user!.role !== 'STUDENT' || !payingStudent || invoice?.studentId !== payingStudent.id) {
    return res.status(403).json({ success: false, message: 'You can only pay invoices assigned to your own student account.' });
  }

  if (!invoice) {
    return res.status(404).json({ success: false, message: 'Invoice not found.' });
  }

  const remaining = invoice.amount - invoice.amountPaid;
  if (remaining <= 0) {
    return res.status(400).json({ success: false, message: 'Invoice is already fully settled.' });
  }

  // Create verified transaction record
  const ref = `EDOCASTI-TX-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
  const transaction: PaymentTransaction = {
    id: 'pay-' + Date.now(),
    reference: ref,
    invoiceId: invoice.id,
    studentId: invoice.studentId,
    amount: remaining,
    channel: channel || 'Remita',
    status: 'VERIFIED',
    providerReference: `RRR-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`,
    paidAt: new Date().toISOString(),
    verifiedBy: 'Automated Gateway Reconciler',
  };

  invoice.amountPaid = invoice.amount;
  invoice.status = 'PAID';

  state.payments.unshift(transaction);
  db.saveState();

  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'PAYMENT_SETTLED_VERIFIED',
    resource: 'FINANCE',
    details: { invoiceId: invoice.id, reference: ref, amount: remaining, channel: transaction.channel },
    ipAddress: req.ip,
  });

  return res.json({
    success: true,
    message: 'Payment verified and receipt generated successfully.',
    transaction,
    invoice,
  });
});

apiRouter.get(
  '/finance/payments',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    return res.json({ success: true, payments: db.getState().payments });
  }
);

apiRouter.post(
  '/finance/invoices',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId, title, amount, session, dueDate, status } = req.body;
    if (!studentId || !title || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Student, title, and amount are required.' });
    }
    const state = db.getState();
    const inv: Invoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber: `INV/${state.settings.currentSession.slice(0, 4)}/${Math.floor(10000 + Math.random() * 90000)}`,
      studentId,
      session: session || state.settings.currentSession,
      title: String(title).trim(),
      amount: Number(amount),
      amountPaid: status === 'PAID' ? Number(amount) : 0,
      status: status || 'UNPAID',
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    state.invoices.unshift(inv);
    db.saveState();
    return res.status(201).json({ success: true, invoice: inv });
  }
);

apiRouter.put(
  '/finance/invoices/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const inv = db.getState().invoices.find((i) => i.id === id);
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    const { title, amount, amountPaid, status, dueDate, session } = req.body;
    if (title !== undefined) inv.title = String(title).trim();
    if (amount !== undefined) inv.amount = Number(amount);
    if (amountPaid !== undefined) inv.amountPaid = Number(amountPaid);
    if (status !== undefined) inv.status = status;
    if (dueDate !== undefined) inv.dueDate = dueDate;
    if (session !== undefined) inv.session = session;
    db.saveState();
    return res.json({ success: true, invoice: inv });
  }
);

apiRouter.delete(
  '/finance/invoices/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.invoices.findIndex((i) => i.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    state.invoices.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Invoice deleted.' });
  }
);

apiRouter.delete(
  '/finance/payments/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.payments.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Payment not found.' });
    state.payments.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Payment record deleted.' });
  }
);

// ==================== ATTENDANCE ====================

apiRouter.get('/attendance', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.query;
  const user = req.user!;
  if (!['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'LECTURER'].includes(user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to view attendance records.' });
  }
  const state = db.getState();
  let list = state.attendance;
  if (user.role === 'LECTURER') {
    const assignedCourseIds = new Set(state.courses.filter((course) => course.lecturerId === user.id).map((course) => course.id));
    list = list.filter((record) => assignedCourseIds.has(record.courseId));
  }
  if (courseId) list = list.filter((record) => record.courseId === courseId);
  return res.json({ success: true, attendance: list });
});

apiRouter.post(
  '/attendance',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'LECTURER'),
  (req: AuthenticatedRequest, res: Response) => {
    const { courseId, type, topic, records } = req.body;
    if (!courseId || !topic) {
      return res.status(400).json({ success: false, message: 'Course and topic are required.' });
    }

    const state = db.getState();
    const assignedCourse = state.courses.find((course) => course.id === courseId);
    if (!assignedCourse) return res.status(404).json({ success: false, message: 'Course not found.' });
    if (req.user!.role === 'LECTURER' && assignedCourse.lecturerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'You can only record attendance for courses assigned to you.' });
    }
    const newSession: AttendanceSession = {
      id: 'att-' + Date.now(),
      courseId,
      lecturerId: req.user!.id,
      date: new Date().toISOString().split('T')[0],
      type: type || 'Lecture',
      topic,
      records: records || [],
    };

    state.attendance.unshift(newSession);
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'ATTENDANCE_SESSION_RECORDED',
      resource: 'ATTENDANCE',
      details: { courseId, topic, attendeesCount: records?.length || 0 },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, session: newSession });
  }
);

apiRouter.put(
  '/attendance/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'LECTURER', 'HOD'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const session = state.attendance.find((a) => a.id === id);
    if (!session) return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    if (req.user!.role === 'LECTURER' && session.lecturerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'You can only update attendance sessions you recorded.' });
    }
    const { topic, type, date } = req.body;
    if (topic !== undefined) session.topic = String(topic).trim();
    if (type !== undefined) session.type = type;
    if (date !== undefined) session.date = date;
    db.saveState();
    return res.json({ success: true, session });
  }
);

apiRouter.delete(
  '/attendance/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.attendance.findIndex((a) => a.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    state.attendance.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Attendance session deleted.' });
  }
);

// ==================== SUPPORT TICKETS ====================

apiRouter.get('/support', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let list = db.getState().supportTickets;
  if (user.role === 'STUDENT' || user.role === 'APPLICANT') {
    list = list.filter((ticket) => ticket.userId === user.id);
  } else if (user.role === 'BURSAR') {
    list = list.filter((ticket) => ticket.category === 'Bursary & Payments');
  } else if (user.role === 'ADMISSIONS_OFFICER') {
    list = list.filter((ticket) => ticket.category === 'Admissions');
  } else if (user.role === 'REGISTRAR') {
    list = list.filter((ticket) => ['Course Registration', 'Results'].includes(ticket.category));
  } else if (!['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'].includes(user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to view support queues.' });
  }
  return res.json({ success: true, tickets: list });
});

apiRouter.post('/support', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { subject, category, priority, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ success: false, message: 'Subject and message are required.' });
  }

  const state = db.getState();
  const ticketNumber = `TKT-${new Date().getFullYear()}-${String(state.supportTickets.length + 42).padStart(4, '0')}`;

  const ticket: SupportTicket = {
    id: 'tkt-' + Date.now(),
    ticketNumber,
    userId: user.id,
    userName: user.fullName,
    userEmail: user.email,
    subject: subject.trim(),
    category: category || 'Admissions',
    priority: priority || 'MEDIUM',
    status: 'OPEN',
    messages: [
      {
        sender: user.fullName,
        role: user.role,
        message: message.trim(),
        timestamp: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
  };

  state.supportTickets.unshift(ticket);
  db.saveState();

  db.logAudit({
    userId: user.id,
    userEmail: user.email,
    action: 'SUPPORT_TICKET_CREATED',
    resource: 'SUPPORT',
    details: { ticketNumber, category, subject },
    ipAddress: req.ip,
  });

  return res.status(201).json({ success: true, ticket });
});

apiRouter.post('/support/:id/reply', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;
  const user = req.user!;

  const ticket = db.getState().supportTickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found.' });
  }
  const supportRoles = ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'REGISTRAR', 'ADMISSIONS_OFFICER', 'BURSAR'];
  if (ticket.userId !== user.id && !supportRoles.includes(user.role)) {
    return res.status(403).json({ success: false, message: 'You can only reply to your own ticket or an authorized support queue.' });
  }
  if (ticket.userId !== user.id && user.role === 'BURSAR' && ticket.category !== 'Bursary & Payments') {
    return res.status(403).json({ success: false, message: 'This ticket is outside the Bursar support queue.' });
  }
  if (ticket.userId !== user.id && user.role === 'ADMISSIONS_OFFICER' && ticket.category !== 'Admissions') {
    return res.status(403).json({ success: false, message: 'This ticket is outside the Admissions support queue.' });
  }
  if (ticket.userId !== user.id && user.role === 'REGISTRAR' && !['Course Registration', 'Results'].includes(ticket.category)) {
    return res.status(403).json({ success: false, message: 'This ticket is outside the Registry support queue.' });
  }

  ticket.messages.push({
    sender: user.fullName,
    role: user.role,
    message: message.trim(),
    timestamp: new Date().toISOString(),
  });

  if (user.role !== 'STUDENT' && user.role !== 'APPLICANT' && ticket.status === 'OPEN') {
    ticket.status = 'IN_PROGRESS';
  }

  db.saveState();
  return res.json({ success: true, ticket });
});

apiRouter.patch(
  '/support/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'ADMISSIONS_OFFICER', 'BURSAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const ticket = db.getState().supportTickets.find((t) => t.id === id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    if (req.user!.role === 'BURSAR' && ticket.category !== 'Bursary & Payments') {
      return res.status(403).json({ success: false, message: 'This ticket is outside the Bursar support queue.' });
    }
    if (req.user!.role === 'ADMISSIONS_OFFICER' && ticket.category !== 'Admissions') {
      return res.status(403).json({ success: false, message: 'This ticket is outside the Admissions support queue.' });
    }
    if (req.user!.role === 'REGISTRAR' && !['Course Registration', 'Results'].includes(ticket.category)) {
      return res.status(403).json({ success: false, message: 'This ticket is outside the Registry support queue.' });
    }
    const { status, priority, subject, category } = req.body;
    if (status !== undefined) ticket.status = status;
    if (priority !== undefined) ticket.priority = priority;
    if (subject !== undefined) ticket.subject = String(subject).trim();
    if (category !== undefined) ticket.category = category;
    db.saveState();
    return res.json({ success: true, ticket });
  }
);

apiRouter.delete(
  '/support/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = state.supportTickets.findIndex((t) => t.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    state.supportTickets.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Support ticket deleted.' });
  }
);

// ==================== AUDIT TRAIL ====================

apiRouter.get(
  '/audit',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { action, search, limit = 50 } = req.query;
    let list = db.getState().auditLogs;

    if (action) list = list.filter((l) => l.action === action);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.userEmail?.toLowerCase().includes(q) ||
          l.resource.toLowerCase().includes(q)
      );
    }

    return res.json({ success: true, logs: list.slice(0, Number(limit)) });
  }
);

// ==================== DASHBOARD & EXECUTIVE ANALYTICS ====================

apiRouter.get('/dashboard/stats', authenticateToken, requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'), (req: AuthenticatedRequest, res: Response) => {
  const state = db.getState();
  const studentsCount = state.students.length;
  const applicantsCount = state.applications.length;
  const staffCount = state.users.filter((u) => ['LECTURER', 'HOD', 'DEAN', 'REGISTRAR', 'BURSAR'].includes(u.role)).length;
  const coursesCount = state.courses.length;

  const totalRevenue = state.payments
    .filter((p) => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingApplications = state.applications.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length;
  const pendingRegistrations = state.registrations.filter((r) => r.status === 'SUBMITTED').length;

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
      programmesCount: state.programmes.length,
    },
  });
});

// ==================== CONTENT MANAGEMENT MODULE (CMS) ====================

// --- News Articles ---

apiRouter.get('/cms/news', (req, res) => {
  const { category, status, sliderOnly, search } = req.query;
  let list = [...db.getState().newsArticles];

  if (category && category !== 'ALL') {
    list = list.filter((a) => a.category === category);
  }
  if (status && status !== 'ALL') {
    list = list.filter((a) => a.status === status);
  }
  if (sliderOnly === 'true') {
    list = list.filter((a) => a.isFeaturedInSlider && a.status === 'PUBLISHED');
  }
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q)
    );
  }

  // Sort latest first
  list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return res.json({ success: true, articles: list });
});

apiRouter.get('/cms/news/:id', (req, res) => {
  const { id } = req.params;
  const state = db.getState();
  const article = state.newsArticles.find((a) => a.id === id || a.slug === id);

  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found.' });
  }

  // Increment views
  article.views = (article.views || 0) + 1;
  db.saveState();

  return res.json({ success: true, article });
});

apiRouter.post(
  '/cms/news',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { title, summary, content, category, imageUrl, isFeaturedInSlider, status, author } = req.body;

    if (!title || !summary || !content) {
      return res.status(400).json({ success: false, message: 'Title, summary, and content are required.' });
    }

    const state = db.getState();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 80);

    const newArticle: NewsArticle = {
      id: 'news-' + Date.now(),
      title: title.trim(),
      slug: `${slug}-${Math.floor(Math.random() * 1000)}`,
      summary: summary.trim(),
      content: content.trim(),
      category: category || 'Academics',
      imageUrl: imageUrl || '',
      isFeaturedInSlider: Boolean(isFeaturedInSlider),
      status: status || 'PUBLISHED',
      author: author?.trim() || req.user!.fullName,
      publishedAt: new Date().toISOString(),
      views: 0,
    };

    state.newsArticles.unshift(newArticle);
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'NEWS_ARTICLE_CREATED',
      resource: 'CMS_NEWS',
      details: { articleId: newArticle.id, title: newArticle.title, status: newArticle.status },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, article: newArticle });
  }
);

apiRouter.put(
  '/cms/news/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { title, summary, content, category, imageUrl, isFeaturedInSlider, status, author } = req.body;

    const state = db.getState();
    const article = state.newsArticles.find((a) => a.id === id);

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    if (title) article.title = title.trim();
    if (summary) article.summary = summary.trim();
    if (content) article.content = content.trim();
    if (category) article.category = category;
    if (imageUrl !== undefined) article.imageUrl = imageUrl;
    if (isFeaturedInSlider !== undefined) article.isFeaturedInSlider = Boolean(isFeaturedInSlider);
    if (status) article.status = status;
    if (author) article.author = author.trim();

    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'NEWS_ARTICLE_UPDATED',
      resource: 'CMS_NEWS',
      details: { articleId: article.id, title: article.title },
      ipAddress: req.ip,
    });

    return res.json({ success: true, article });
  }
);

apiRouter.delete(
  '/cms/news/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const index = state.newsArticles.findIndex((a) => a.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    const removed = state.newsArticles.splice(index, 1)[0];
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'NEWS_ARTICLE_DELETED',
      resource: 'CMS_NEWS',
      details: { articleId: id, title: removed.title },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Article deleted successfully.' });
  }
);

apiRouter.patch(
  '/cms/news/:id/toggle-slider',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const article = state.newsArticles.find((a) => a.id === id);

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    article.isFeaturedInSlider = !article.isFeaturedInSlider;
    db.saveState();

    return res.json({ success: true, isFeaturedInSlider: article.isFeaturedInSlider });
  }
);

// --- Hero Slide Show ---

apiRouter.get('/cms/slides', (req, res) => {
  const { activeOnly } = req.query;
  let slides = [...db.getState().sliderSlides];

  if (activeOnly === 'true') {
    slides = slides.filter((s) => s.isActive);
  }

  slides.sort((a, b) => a.order - b.order);
  return res.json({ success: true, slides });
});

apiRouter.post(
  '/cms/slides',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
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
      isActive,
    } = req.body;

    if (!title || !subtitle) {
      return res.status(400).json({ success: false, message: 'Title and subtitle are required.' });
    }

    const state = db.getState();
    const newSlide: HeroSlide = {
      id: 'slide-' + Date.now(),
      title: title.trim(),
      subtitle: subtitle.trim(),
      badge: badge || 'College Update',
      bgGradient: bgGradient || 'from-emerald-950 via-emerald-900 to-slate-950',
      accentColor: accentColor || 'amber-400',
      bgColor: bgColor || '',
      bgSecondaryColor: bgSecondaryColor || '',
      textColor: textColor || '',
      subtitleColor: subtitleColor || '',
      accentHex: accentHex || '',
      ctaBgColor: ctaBgColor || '',
      ctaTextColor: ctaTextColor || '',
      secondaryBtnBgColor: secondaryBtnBgColor || '',
      secondaryBtnTextColor: secondaryBtnTextColor || '',
      footerBarBgColor: footerBarBgColor || '',
      imageUrl: imageUrl || '',
      ctaText: ctaText || 'Learn More',
      ctaTab: ctaTab || 'public',
      ctaSubSection: ctaSubSection || 'overview',
      iconName: iconName || 'Sparkles',
      order: order !== undefined ? Number(order) : state.sliderSlides.length + 1,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    };

    state.sliderSlides.push(newSlide);
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'HERO_SLIDE_CREATED',
      resource: 'CMS_SLIDER',
      details: { slideId: newSlide.id, title: newSlide.title },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, slide: newSlide });
  }
);

apiRouter.put(
  '/cms/slides/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const slide = state.sliderSlides.find((s) => s.id === id);

    if (!slide) {
      return res.status(404).json({ success: false, message: 'Slide not found.' });
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
      isActive,
    } = req.body;

    if (title !== undefined) slide.title = title.trim();
    if (subtitle !== undefined) slide.subtitle = subtitle.trim();
    if (badge !== undefined) slide.badge = badge.trim();
    if (bgGradient !== undefined) slide.bgGradient = bgGradient;
    if (accentColor !== undefined) slide.accentColor = accentColor;
    if (bgColor !== undefined) slide.bgColor = bgColor;
    if (bgSecondaryColor !== undefined) slide.bgSecondaryColor = bgSecondaryColor;
    if (textColor !== undefined) slide.textColor = textColor;
    if (subtitleColor !== undefined) slide.subtitleColor = subtitleColor;
    if (accentHex !== undefined) slide.accentHex = accentHex;
    if (ctaBgColor !== undefined) slide.ctaBgColor = ctaBgColor;
    if (ctaTextColor !== undefined) slide.ctaTextColor = ctaTextColor;
    if (secondaryBtnBgColor !== undefined) slide.secondaryBtnBgColor = secondaryBtnBgColor;
    if (secondaryBtnTextColor !== undefined) slide.secondaryBtnTextColor = secondaryBtnTextColor;
    if (footerBarBgColor !== undefined) slide.footerBarBgColor = footerBarBgColor;
    if (imageUrl !== undefined) slide.imageUrl = imageUrl;
    if (ctaText !== undefined) slide.ctaText = ctaText.trim();
    if (ctaTab !== undefined) slide.ctaTab = ctaTab;
    if (ctaSubSection !== undefined) slide.ctaSubSection = ctaSubSection;
    if (iconName !== undefined) slide.iconName = iconName;
    if (order !== undefined) slide.order = Number(order);
    if (isActive !== undefined) slide.isActive = Boolean(isActive);

    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'HERO_SLIDE_UPDATED',
      resource: 'CMS_SLIDER',
      details: { slideId: slide.id, title: slide.title },
      ipAddress: req.ip,
    });

    return res.json({ success: true, slide });
  }
);

apiRouter.delete(
  '/cms/slides/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const index = state.sliderSlides.findIndex((s) => s.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Slide not found.' });
    }

    const removed = state.sliderSlides.splice(index, 1)[0];
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'HERO_SLIDE_DELETED',
      resource: 'CMS_SLIDER',
      details: { slideId: id, title: removed.title },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Slide deleted successfully.' });
  }
);

// --- Page Builder Content ---

apiRouter.get('/cms/page-content', (req, res) => {
  return res.json({ success: true, pageContent: db.getState().pageContent });
});

apiRouter.put(
  '/cms/page-content',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const current = db.getState().pageContent;
    const updated = { ...current, ...req.body };
    db.getState().pageContent = updated;
    db.saveState();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'PAGE_CONTENT_UPDATED',
      resource: 'CMS_PAGE_BUILDER',
      details: { updatedFields: Object.keys(req.body) },
      ipAddress: req.ip,
    });

    return res.json({ success: true, pageContent: updated });
  }
);



