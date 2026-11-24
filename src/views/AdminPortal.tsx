import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccessAdminTab } from '../utils/roleAccess';
import { api, type FeeCatalogItem, type ProgramFeeSchedule, type ProgramFeeScheduleItem } from '../services/api';
import {
  AuditLog,
  Course,
  Department,
  School,
  Programme,
  Student,
  AdmissionApplication,
  CourseRegistration,
  FeeSchedule,
  Invoice,
  PaymentTransaction,
  AssessmentResult,
  IssuedDocument,
  AttendanceSession,
  SupportTicket,
  User,
} from '../types';
import { matchesWildcard } from '../utils/wildcard';
import { readImageFileAsDataUrl } from '../utils/imageUpload';
import { WildcardFilterBar } from '../components/WildcardFilterBar';
import { ContentManagementModule } from '../components/ContentManagementModule';
const AdminAnalyticsCharts = lazy(() => import('../components/AdminAnalyticsCharts'));
import {
  Shield,
  Settings,
  Users,
  BookOpen,
  Award,
  Wallet,
  Activity,
  Plus,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Layers,
  GraduationCap,
  UserCheck,
  ClipboardCheck,
  FileText,
  Database,
  Trash2,
  Edit,
  Upload,
  Menu,
  X,
  Printer,
  CheckCheck,
} from 'lucide-react';

interface Props {
  onOpenPrintModal: (type: any, data: any) => void;
  onOpenPageBuilder?: () => void;
}

type AdminTab =
  | 'analytics'
  | 'dean_curriculum'
  | 'hod_allocation'
  | 'exam_approvals'
  | 'registrar_docs'
  | 'finance'
  | 'global_crud'
  | 'users'
  | 'settings'
  | 'cms'
  | 'audit';

type CrudEntity =
  | 'users'
  | 'students'
  | 'applications'
  | 'schools'
  | 'departments'
  | 'programmes'
  | 'courses'
  | 'registrations'
  | 'results'
  | 'feeSchedules'
  | 'invoices'
  | 'documents'
  | 'attendance'
  | 'tickets';

const normalizeCourseLevel = (value?: string) => {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized
    .replace(/^NDI$/, 'ND1')
    .replace(/^NDII$/, 'ND2')
    .replace(/^HNDI$/, 'HND1')
    .replace(/^HNDII$/, 'HND2');
};

const normalizeCourseSemester = (value?: string) =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const ROLE_DEFAULT_TAB: Record<string, AdminTab> = {
  DEAN: 'dean_curriculum',
  HOD: 'hod_allocation',
  EXAM_OFFICER: 'exam_approvals',
  REGISTRAR: 'registrar_docs',
  BURSAR: 'finance',
  SUPER_ADMIN: 'analytics',
  INSTITUTION_ADMIN: 'analytics',
  RECTOR: 'analytics',
};

export const AdminPortal: React.FC<Props> = ({ onOpenPrintModal, onOpenPageBuilder }) => {
  const { user, settings, refreshSettings } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<AdminTab>(
    (user?.role && ROLE_DEFAULT_TAB[user.role]) || 'analytics'
  );
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  // Core data states
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [lecturers, setLecturers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [registrations, setRegistrations] = useState<CourseRegistration[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [issuedDocs, setIssuedDocs] = useState<IssuedDocument[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<FeeSchedule[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    if (user?.role && ROLE_DEFAULT_TAB[user.role]) {
      setActiveSubTab(ROLE_DEFAULT_TAB[user.role]);
    }
  }, [user?.role]);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    institutionName: settings?.institutionName || '',
    shortName: settings?.shortName || '',
    motto: settings?.motto || '',
    currentSession: settings?.currentSession || '2025/2026',
    currentSemester: settings?.currentSemester || 'First Semester',
    admissionsOpen: settings?.admissionsOpen ?? true,
    courseRegistrationOpen: settings?.courseRegistrationOpen ?? true,
    feePaymentRequiredForReg: settings?.feePaymentRequiredForReg ?? false,
    caMaxMarks: settings?.caMaxMarks || 40,
    examMaxMarks: settings?.examMaxMarks || 60,
    contactEmail: settings?.contactEmail || '',
    contactPhone: settings?.contactPhone || '',
    address: settings?.address || '',
    logoUrl: settings?.logoUrl || '',
    schoolStampUrl: settings?.schoolStampUrl || '',
    registrarSignatureUrl: settings?.registrarSignatureUrl || '',
    rectorSignatureUrl: settings?.rectorSignatureUrl || '',
    bursarSignatureUrl: settings?.bursarSignatureUrl || '',
    transcriptFee: settings?.transcriptFee ?? 15000,
    certificateFee: settings?.certificateFee ?? 25000,
  });

  useEffect(() => {
    if (settings) {
      setSettingsForm({
        institutionName: settings.institutionName || '',
        shortName: settings.shortName || '',
        motto: settings.motto || '',
        currentSession: settings.currentSession || '2025/2026',
        currentSemester: settings.currentSemester || 'First Semester',
        admissionsOpen: settings.admissionsOpen ?? true,
        courseRegistrationOpen: settings.courseRegistrationOpen ?? true,
        feePaymentRequiredForReg: settings.feePaymentRequiredForReg ?? false,
        caMaxMarks: settings.caMaxMarks || 40,
        examMaxMarks: settings.examMaxMarks || 60,
        contactEmail: settings.contactEmail || '',
        contactPhone: settings.contactPhone || '',
        address: settings.address || '',
        logoUrl: settings.logoUrl || '',
        schoolStampUrl: settings.schoolStampUrl || '',
        registrarSignatureUrl: settings.registrarSignatureUrl || '',
        rectorSignatureUrl: settings.rectorSignatureUrl || '',
        bursarSignatureUrl: settings.bursarSignatureUrl || '',
        transcriptFee: settings.transcriptFee ?? 15000,
        certificateFee: settings.certificateFee ?? 25000,
      });
    }
  }, [settings]);

  // Tab-specific filters
  const [deanQuery, setDeanQuery] = useState('');
  const [deanDeptFilter, setDeanDeptFilter] = useState('');
  const [deanLevelFilter, setDeanLevelFilter] = useState('');

  const [hodQuery, setHodQuery] = useState('');
  const [hodDeptFilter, setHodDeptFilter] = useState('');
  const [hodLecturerSelection, setHodLecturerSelection] = useState<Record<string, string>>({});

  const [examRegQuery, setExamRegQuery] = useState('');
  const [examRegStatusFilter, setExamRegStatusFilter] = useState('');
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<string[]>([]);
  const [reviewRegistration, setReviewRegistration] = useState<CourseRegistration | null>(null);
  const [editingRegistrationCourseId, setEditingRegistrationCourseId] = useState<string | null>(null);
  const [replacementRegistrationCourseId, setReplacementRegistrationCourseId] = useState('');
  const [registrationCourseBusy, setRegistrationCourseBusy] = useState(false);
  const [examResQuery, setExamResQuery] = useState('');
  const [examResCourseFilter, setExamResCourseFilter] = useState('');
  const [examResStatusFilter, setExamResStatusFilter] = useState('');
  const [publishingResults, setPublishingResults] = useState(false);

  const [docQuery, setDocQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [docForm, setDocForm] = useState({
    studentId: '',
    type: 'TRANSCRIPT' as 'TRANSCRIPT' | 'FINAL_CERTIFICATE',
    classification: '',
    remarks: '',
    feeAmount: 15000,
  });

  const [financeQuery, setFinanceQuery] = useState('');
  const [financeSubView, setFinanceSubView] = useState<'schedules' | 'invoices' | 'payments' | 'new_catalog' | 'new_schedules' | 'admission_retries'>('schedules');

  // Separate state for the new PostgreSQL fee-management module.
  const [newFeeCatalog, setNewFeeCatalog] = useState<FeeCatalogItem[]>([]);
  const [newFeeSchedules, setNewFeeSchedules] = useState<ProgramFeeSchedule[]>([]);
  const [selectedNewSchedule, setSelectedNewSchedule] = useState<ProgramFeeSchedule | null>(null);
  const [selectedNewScheduleItems, setSelectedNewScheduleItems] = useState<ProgramFeeScheduleItem[]>([]);
  const [newFeeBusy, setNewFeeBusy] = useState(false);
  const [newFeeError, setNewFeeError] = useState('');

  const [newFeeEditingId, setNewFeeEditingId] = useState<string | null>(null);
  const [newFeeForm, setNewFeeForm] = useState({
    name: '',
    amount: '0',
    feeType: 'PER_SESSION' as 'ONE_TIME' | 'PER_SESSION',
    category: 'COMPULSORY' as 'COMPULSORY' | 'OPTIONAL',
    description: '',
  });

  const [newScheduleForm, setNewScheduleForm] = useState({
    programmeId: '',
    session: settingsForm.currentSession || '2025/2026',
    level: 'ND I',
  });

  const [newScheduleItemForm, setNewScheduleItemForm] = useState({
    feeCatalogItemId: '',
    amountOverride: '',
    allocationPriority: '100',
  });
  const [editingNewScheduleItemId, setEditingNewScheduleItemId] = useState<string | null>(null);
  const [editingNewScheduleItemForm, setEditingNewScheduleItemForm] = useState({
    amountOverride: '',
    allocationPriority: '100',
  });
  const [admissionRetryItems, setAdmissionRetryItems] = useState<Array<{
    applicationId: string;
    studentId: string;
    programmeId: string;
    academicSession: string;
    level: string;
    status: 'PENDING' | 'FAILED';
    attempts: number;
    lastError: string | null;
    activatedAt: string;
  }>>([]);
  const [admissionRetryBusy, setAdmissionRetryBusy] = useState(false);
  const [admissionRetryingId, setAdmissionRetryingId] = useState<string | null>(null);
  const [admissionRetryError, setAdmissionRetryError] = useState('');
  const [usersQuery, setUsersQuery] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('');
  const [auditQuery, setAuditQuery] = useState('');

  // Dean Modals (Programmes & Courses)
  const [progModalOpen, setProgModalOpen] = useState(false);
  const [editingProgId, setEditingProgId] = useState<string | null>(null);
  const [progForm, setProgForm] = useState({
    departmentId: 'dept-agric',
    code: '',
    name: '',
    qualification: 'ND' as Programme['qualification'],
    durationYears: 2,
    description: '',
    requirementsText: '5 Credits in SSCE/WAEC/NECO including English & Mathematics',
  });

  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({
    code: '',
    title: '',
    creditUnits: 3,
    departmentId: 'dept-agric',
    programmeId: '',
    level: 'ND I',
    semester: 'First Semester' as Course['semester'],
    lecturerId: '',
    lecturerName: '',
    isCompulsory: true,
  });

  // User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'LECTURER' as User['role'],
    phone: '',
    departmentId: '',
  });

  // Finance modals
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState({
    title: '',
    category: 'Tuition',
    programmeId: '',
    level: 'ND I',
    session: '2025/2026',
    amount: 45000,
  });
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    studentId: '',
    title: '',
    amount: 25000,
    session: '2025/2026',
    dueDate: '2026-06-30',
  });

  // Super Admin Global CRUD State
  const [crudEntity, setCrudEntity] = useState<CrudEntity>('students');
  const [crudQuery, setCrudQuery] = useState('');
  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [crudMode, setCrudMode] = useState<'create' | 'edit'>('edit');
  const [crudDraft, setCrudDraft] = useState<Record<string, any>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        statsRes,
        schoolsRes,
        deptsRes,
        progsRes,
        coursesRes,
        lectRes,
        feeRes,
      ] = await Promise.all([
        api.getDashboardStats().catch(() => ({ success: false, stats: null })),
        api.getSchools().catch(() => ({ success: false, schools: [] })),
        api.getDepartments().catch(() => ({ success: false, departments: [] })),
        api.getProgrammes().catch(() => ({ success: false, programmes: [] })),
        api.getCourses().catch(() => ({ success: false, courses: [] })),
        api.getLecturers().catch(() => ({ success: false, lecturers: [] })),
        api.getFeeSchedules().catch(() => ({ success: false, feeSchedules: [] })),
      ]);

      if (statsRes.success && statsRes.stats) setStats(statsRes.stats);
      if (schoolsRes.success && schoolsRes.schools) setSchools(schoolsRes.schools);
      if (deptsRes.success && deptsRes.departments) setDepartments(deptsRes.departments);
      if (progsRes.success && progsRes.programmes) setProgrammes(progsRes.programmes);
      if (coursesRes.success && coursesRes.courses) setCourses(coursesRes.courses);
      if (lectRes.success && lectRes.lecturers) setLecturers(lectRes.lecturers);
      if (feeRes.success && feeRes.feeSchedules) setFeeSchedules(feeRes.feeSchedules);

      const [
        stdRes,
        regRes,
        resRes,
        docRes,
        invRes,
        attRes,
        tktRes,
      ] = await Promise.all([
        api.getStudents().catch(() => ({ success: false, students: [] })),
        api.getRegistrations().catch(() => ({ success: false, registrations: [] })),
        api.getResults().catch(() => ({ success: false, results: [] })),
        api.getIssuedDocuments().catch(() => ({ success: false, documents: [] })),
        api.getInvoices().catch(() => ({ success: false, invoices: [] })),
        api.getAttendance().catch(() => ({ success: false, attendance: [] })),
        api.getSupportTickets().catch(() => ({ success: false, tickets: [] })),
      ]);

      if (stdRes.success && stdRes.students) {
        setStudents(stdRes.students);
        if (!docForm.studentId && stdRes.students[0]) {
          setDocForm((prev) => ({ ...prev, studentId: stdRes.students[0].id }));
        }
      }
      if (regRes.success && regRes.registrations) setRegistrations(regRes.registrations);
      if (resRes.success && resRes.results) setResults(resRes.results);
      if (docRes.success && docRes.documents) setIssuedDocs(docRes.documents);
      if (invRes.success && invRes.invoices) setInvoices(invRes.invoices);
      if (attRes.success && attRes.attendance) setAttendance(attRes.attendance);
      if (tktRes.success && tktRes.tickets) setTickets(tktRes.tickets);

      if (user && ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'].includes(user.role)) {
        const [uRes, aRes, appRes] = await Promise.all([
          api.getUsers().catch(() => ({ success: false, users: [] })),
          api.getAuditLogs({ limit: 80 }).catch(() => ({ success: false, logs: [] })),
          api.getApplications().catch(() => ({ success: false, applications: [] })),
        ]);
        if (uRes.success && uRes.users) setUsersList(uRes.users);
        if (aRes.success && aRes.logs) setAuditLogs(aRes.logs);
        if (appRes.success && appRes.applications) setApplications(appRes.applications);
      }

      if (user && ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR', 'RECTOR'].includes(user.role)) {
        const pRes = await api.getPayments().catch(() => ({ success: false, payments: [] }));
        if (pRes.success && pRes.payments) setPayments(pRes.payments);
      }
    } catch (err: any) {
      notify(err.message || 'Failed to load management data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, user?.role]);

  // Role permission helper for sidebar visibility
  const role = user?.role || 'UNKNOWN';
  const safeActiveSubTab = canAccessAdminTab(role, activeSubTab)
    ? activeSubTab
    : (ROLE_DEFAULT_TAB[role] || 'analytics');
  const canManageAdmissionFeeActivations = [
    'SUPER_ADMIN',
    'INSTITUTION_ADMIN',
    'RECTOR',
    'REGISTRAR',
    'ADMISSIONS_OFFICER',
  ].includes(role);
  const isSuperAdmin = ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'].includes(role);

  const sidebarGroups: Array<{
    group: string;
    items: Array<{ id: AdminTab; label: string; icon: React.ReactNode; roles: string[] }>;
  }> = [
    {
      group: 'Overview',
      items: [
        {
          id: 'analytics',
          label: 'Executive Analytics',
          icon: <Activity className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'],
        },
      ],
    },
    {
      group: 'Academic Workflow',
      items: [
        {
          id: 'dean_curriculum',
          label: 'Dean: Programmes & Courses',
          icon: <GraduationCap className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'DEAN'],
        },
        {
          id: 'hod_allocation',
          label: 'HOD: Assign Lecturers',
          icon: <UserCheck className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'DEAN', 'HOD'],
        },
        {
          id: 'exam_approvals',
          label: user?.role === 'HOD' ? 'Course Registration Approvals' : user?.role === 'EXAM_OFFICER' ? 'Result Moderation & Publishing' : 'Academic Approvals',
          icon: <ClipboardCheck className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'HOD', 'EXAM_OFFICER'],
        },
      ],
    },
    {
      group: 'Registry & Bursary',
      items: [
        {
          id: 'registrar_docs',
          label: 'Registrar: Transcripts & Certs',
          icon: <FileText className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'],
        },
        {
          id: 'finance',
          label: 'Bursary & Fee Ledger',
          icon: <Wallet className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'BURSAR'],
        },
      ],
    },
    {
      group: 'System Control',
      items: [
        {
          id: 'global_crud',
          label: 'Super Admin Global CRUD',
          icon: <Database className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'],
        },
        {
          id: 'users',
          label: 'Users & RBAC',
          icon: <Users className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'REGISTRAR'],
        },
        {
          id: 'settings',
          label: 'Branding, Stamp & Rules',
          icon: <Settings className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'],
        },
        {
          id: 'cms',
          label: 'CMS & Newsroom',
          icon: <Layers className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'REGISTRAR'],
        },
        {
          id: 'audit',
          label: 'Security Audit Trail',
          icon: <Shield className="w-4 h-4" />,
          roles: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'REGISTRAR'],
        },
      ],
    },
  ];

  // ==================== HANDLERS ====================

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.updateSettings(settingsForm);
      if (res.success) {
        await refreshSettings();
        notify('Institution branding, stamp, signatures, and academic rules updated.');
      }
    } catch (err: any) {
      notify(err.message || 'Failed to update settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSettingUpload = async (
    field: 'logoUrl' | 'schoolStampUrl' | 'registrarSignatureUrl' | 'rectorSignatureUrl' | 'bursarSignatureUrl',
    file?: File
  ) => {
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file, {
        maxDimension: 600,
        preserveTransparency: true,
        quality: 0.9,
      });
      setSettingsForm((prev) => ({ ...prev, [field]: dataUrl }));
      notify('Image loaded into editor. Click "Save All Branding & Rules" to publish.');
    } catch (err: any) {
      notify(err.message || 'Failed to read image file.', 'error');
    }
  };

  // Dean: Programme & Course CRUD
  const openProgModal = (prog?: Programme) => {
    if (prog) {
      setEditingProgId(prog.id);
      setProgForm({
        departmentId: prog.departmentId,
        code: prog.code,
        name: prog.name,
        qualification: prog.qualification,
        durationYears: prog.durationYears,
        description: prog.description,
        requirementsText: (prog.requirements || []).join('\n'),
      });
    } else {
      setEditingProgId(null);
      setProgForm({
        departmentId: departments[0]?.id || 'dept-agric',
        code: '',
        name: '',
        qualification: 'ND',
        durationYears: 2,
        description: '',
        requirementsText: '5 Credits in SSCE/WAEC/NECO including English & Mathematics',
      });
    }
    setProgModalOpen(true);
  };

  const handleSaveProgramme = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      departmentId: progForm.departmentId,
      code: progForm.code.trim().toUpperCase(),
      name: progForm.name.trim(),
      qualification: progForm.qualification,
      durationYears: Number(progForm.durationYears),
      description: progForm.description.trim(),
      requirements: progForm.requirementsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (editingProgId) {
        await api.updateProgramme(editingProgId, payload);
        notify(`Programme ${payload.code} updated.`);
      } else {
        await api.createProgramme(payload);
        notify(`Programme ${payload.code} created by Dean of Academics.`);
      }
      setProgModalOpen(false);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to save programme', 'error');
    }
  };

  const openCourseModal = (crs?: Course) => {
    if (crs) {
      setEditingCourseId(crs.id);
      setCourseForm({
        code: crs.code,
        title: crs.title,
        creditUnits: crs.creditUnits,
        departmentId: crs.departmentId,
        programmeId: crs.programmeId || '',
        level: crs.level,
        semester: crs.semester,
        lecturerId: crs.lecturerId || '',
        lecturerName: crs.lecturerName || '',
        isCompulsory: crs.isCompulsory,
      });
    } else {
      setEditingCourseId(null);
      setCourseForm({
        code: '',
        title: '',
        creditUnits: 3,
        departmentId: departments[0]?.id || 'dept-agric',
        programmeId: '',
        level: 'ND I',
        semester: 'First Semester',
        lecturerId: '',
        lecturerName: '',
        isCompulsory: true,
      });
    }
    setCourseModalOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const lect = lecturers.find((l) => l.id === courseForm.lecturerId);
    const payload = {
      ...courseForm,
      code: courseForm.code.trim().toUpperCase(),
      lecturerName: lect ? lect.fullName : courseForm.lecturerName,
    };
    try {
      if (editingCourseId) {
        await api.updateCourse(editingCourseId, payload);
        notify(`Course ${payload.code} updated.`);
      } else {
        await api.createCourse(payload);
        notify(`Course ${payload.code} created.`);
      }
      setCourseModalOpen(false);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to save course', 'error');
    }
  };

  // HOD: Assign Course Lecturer
  const handleAssignLecturer = async (course: Course) => {
    const chosenLecturerId = hodLecturerSelection[course.id] ?? course.lecturerId ?? '';
    if (!chosenLecturerId) {
      notify('Select a lecturer from the dropdown first.', 'error');
      return;
    }
    const lect = lecturers.find((l) => l.id === chosenLecturerId);
    try {
      await api.assignCourseLecturer(course.id, {
        lecturerId: chosenLecturerId,
        lecturerName: lect?.fullName,
      });
      notify(`Assigned ${course.code} to ${lect?.fullName || 'Lecturer'}.`);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to assign lecturer', 'error');
    }
  };

  // Exam Officer: Registrations & Results
  const handleApproveRegistration = async (regId: string) => {
    try {
      await api.approveRegistration(regId);
      notify('Course registration approved by HOD.');
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to approve registration', 'error');
    }
  };

  const handleBulkApproveRegistrations = async (registrationIds: string[]) => {
    const pendingIds = Array.from(new Set(registrationIds)).filter((id) =>
      registrations.some((reg) => reg.id === id && reg.status === 'SUBMITTED')
    );
    if (pendingIds.length === 0) {
      notify('Select at least one pending registration to approve.', 'error');
      return;
    }
    try {
      const res = await api.approveRegistrationsBulk({ registrationIds: pendingIds });
      setSelectedRegistrationIds([]);
      notify(`Bulk approval completed: ${res.approvedCount} registration(s) approved.`);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Bulk registration approval failed', 'error');
    }
  };

  const handleRejectRegistration = async (regId: string) => {
    try {
      await api.rejectRegistration(regId);
      notify('Course registration rejected.');
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to reject registration', 'error');
    }
  };

  const handleSaveRegistrationCourse = async () => {
    if (!reviewRegistration || !editingRegistrationCourseId || !replacementRegistrationCourseId) return;
    if (reviewRegistration.status !== 'SUBMITTED') {
      notify('Only submitted registrations can be edited.', 'error');
      return;
    }
    const nextCourseIds = reviewRegistration.courseIds.map((id) =>
      id === editingRegistrationCourseId ? replacementRegistrationCourseId : id
    );
    if (new Set(nextCourseIds).size !== nextCourseIds.length) {
      notify('That course is already included in this registration.', 'error');
      return;
    }
    const nextTotalCredits = nextCourseIds.reduce((total, id) => {
      const course = courses.find((item) => item.id === id);
      return total + (Number(course?.creditUnits) || 0);
    }, 0);
    setRegistrationCourseBusy(true);
    try {
      const updated = {
        ...reviewRegistration,
        courseIds: nextCourseIds,
        totalCredits: nextTotalCredits,
      };
      await api.updateRegistration(reviewRegistration.id, updated);
      setReviewRegistration(updated);
      setEditingRegistrationCourseId(null);
      setReplacementRegistrationCourseId('');
      notify('Registered course updated successfully.');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to update registered course.', 'error');
    } finally {
      setRegistrationCourseBusy(false);
    }
  };

  const handleDeleteRegistrationCourse = async (courseId: string) => {
    if (!reviewRegistration) return;
    if (reviewRegistration.status !== 'SUBMITTED') {
      notify('Only submitted registrations can be edited.', 'error');
      return;
    }
    if (reviewRegistration.courseIds.length <= 1) {
      notify('A registration must contain at least one course. Reject the registration if it should not proceed.', 'error');
      return;
    }
    const course = courses.find((item) => item.id === courseId);
    const courseLabel = course ? `${course.code} — ${course.title}` : courseId;
    if (!window.confirm(`Remove ${courseLabel} from this student's registration?`)) return;

    const nextCourseIds = reviewRegistration.courseIds.filter((id) => id !== courseId);
    const nextTotalCredits = nextCourseIds.reduce((total, id) => {
      const item = courses.find((entry) => entry.id === id);
      return total + (Number(item?.creditUnits) || 0);
    }, 0);
    setRegistrationCourseBusy(true);
    try {
      const updated = {
        ...reviewRegistration,
        courseIds: nextCourseIds,
        totalCredits: nextTotalCredits,
      };
      await api.updateRegistration(reviewRegistration.id, updated);
      setReviewRegistration(updated);
      setEditingRegistrationCourseId(null);
      setReplacementRegistrationCourseId('');
      notify('Course removed from the registration.');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to remove course from registration.', 'error');
    } finally {
      setRegistrationCourseBusy(false);
    }
  };

  const handlePublishResult = async (resultId: string) => {
    try {
      await api.publishResult(resultId);
      notify('Result verified & published to student portal.');
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to publish result', 'error');
    }
  };

  const handleBulkPublishResults = async (resultIds: string[]) => {
    const submittedIds = [...new Set(resultIds)].filter((id) =>
      results.some((result) => result.id === id && result.status === 'SUBMITTED')
    );
    if (submittedIds.length === 0 || publishingResults) return;

    setPublishingResults(true);
    try {
      const res = await api.approveResultsBulk({ resultIds: submittedIds });
      if (res.approvedCount > 0) {
        notify(`Approved & published ${res.approvedCount} submitted result record(s) to students.`);
      } else {
        notify('No submitted results were available to publish.', 'error');
      }
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Bulk approval failed', 'error');
    } finally {
      setPublishingResults(false);
    }
  };

  // Registrar: Generate Transcript / Certificate
  const handleGenerateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.studentId) {
      notify('Please select a student.', 'error');
      return;
    }
    try {
      const res = await api.generateDocument({
        studentId: docForm.studentId,
        type: docForm.type,
        classification: docForm.classification || undefined,
        remarks: docForm.remarks || undefined,
        feeAmount: Number(docForm.feeAmount),
      });
      if (res.success) {
        notify(
          `${docForm.type === 'TRANSCRIPT' ? 'Official Transcript' : 'Final Certificate'} (${res.document.documentNumber}) generated. Invoice ₦${Number(res.invoice.amount).toLocaleString('en-NG')} issued for student payment.`
        );
        loadData();
      }
    } catch (err: any) {
      notify(err.message || 'Failed to generate document', 'error');
    }
  };

  // Users CRUD
  const openUserModal = (usr?: User) => {
    if (usr) {
      setEditingUserId(usr.id);
      setUserForm({
        email: usr.email,
        password: '',
        fullName: usr.fullName,
        role: usr.role,
        phone: usr.phone || '',
        departmentId: usr.departmentId || '',
      });
    } else {
      setEditingUserId(null);
      setUserForm({
        email: '',
        password: '',
        fullName: '',
        role: 'LECTURER',
        phone: '',
        departmentId: '',
      });
    }
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await api.updateUser(editingUserId, {
          fullName: userForm.fullName,
          role: userForm.role,
          phone: userForm.phone,
          departmentId: userForm.departmentId || undefined,
        });
        notify(`Account updated for ${userForm.fullName}.`);
      } else {
        await api.createUser(userForm);
        notify(`New account ${userForm.fullName} (${userForm.role}) created.`);
      }
      setShowUserModal(false);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to save user', 'error');
    }
  };

  // Finance CRUD
  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFeeId) {
        await api.updateFeeSchedule(editingFeeId, feeForm);
        notify('Fee schedule item updated.');
      } else {
        await api.createFeeSchedule(feeForm);
        notify('Fee schedule item created.');
      }
      setFeeModalOpen(false);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to save fee schedule', 'error');
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createInvoice(invoiceForm);
      notify('Student invoice issued.');
      setInvoiceModalOpen(false);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to create invoice', 'error');
    }
  };

  // ==================== FILTERED DATASETS ====================

  const filteredProgrammes = useMemo(
    () =>
      programmes.filter((p) => {
        if (deanDeptFilter && p.departmentId !== deanDeptFilter) return false;
        return matchesWildcard(deanQuery, p.code, p.name, p.qualification, p.description);
      }),
    [programmes, deanDeptFilter, deanQuery]
  );

  const filteredDeanCourses = useMemo(
    () =>
      courses.filter((c) => {
        if (deanDeptFilter && c.departmentId !== deanDeptFilter) return false;
        if (deanLevelFilter && c.level !== deanLevelFilter) return false;
        return matchesWildcard(deanQuery, c.code, c.title, c.level, c.semester, c.lecturerName);
      }),
    [courses, deanDeptFilter, deanLevelFilter, deanQuery]
  );

  const filteredHodCourses = useMemo(
    () =>
      courses.filter((c) => {
        if (hodDeptFilter && c.departmentId !== hodDeptFilter) return false;
        return matchesWildcard(hodQuery, c.code, c.title, c.level, c.lecturerName);
      }),
    [courses, hodDeptFilter, hodQuery]
  );

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      if (examRegStatusFilter && reg.status !== examRegStatusFilter) return false;
      const std = students.find((s) => s.id === reg.studentId);
      return matchesWildcard(
        examRegQuery,
        std?.fullName,
        std?.matricNumber,
        reg.level,
        reg.semester,
        reg.status
      );
    });
  }, [registrations, students, examRegStatusFilter, examRegQuery]);

  const pendingFilteredRegistrationIds = useMemo(
    () => filteredRegistrations.filter((reg) => reg.status === 'SUBMITTED').map((reg) => reg.id),
    [filteredRegistrations]
  );

  const allPendingRegistrationsSelected =
    pendingFilteredRegistrationIds.length > 0 &&
    pendingFilteredRegistrationIds.every((id) => selectedRegistrationIds.includes(id));

  const filteredExamResults = useMemo(() => {
    return results.filter((r) => {
      if (examResCourseFilter && r.courseId !== examResCourseFilter) return false;
      if (examResStatusFilter && r.status !== examResStatusFilter) return false;
      const crs = courses.find((c) => c.id === r.courseId);
      return matchesWildcard(
        examResQuery,
        r.studentName,
        r.matricNumber,
        r.grade,
        r.status,
        crs?.code,
        crs?.title
      );
    });
  }, [results, courses, examResCourseFilter, examResStatusFilter, examResQuery]);

  const filteredIssuedDocs = useMemo(() => {
    return issuedDocs.filter((doc) => {
      if (docTypeFilter && doc.type !== docTypeFilter) return false;
      return matchesWildcard(
        docQuery,
        doc.documentNumber,
        doc.studentName,
        doc.matricNumber,
        doc.programmeName,
        doc.paymentStatus
      );
    });
  }, [issuedDocs, docTypeFilter, docQuery]);

  const filteredUsers = useMemo(
    () =>
      usersList.filter((u) => {
        if (usersRoleFilter && u.role !== usersRoleFilter) return false;
        return matchesWildcard(usersQuery, u.fullName, u.email, u.role, u.phone);
      }),
    [usersList, usersRoleFilter, usersQuery]
  );

  const filteredAuditLogs = useMemo(
    () =>
      auditLogs.filter((l) =>
        matchesWildcard(auditQuery, l.userEmail, l.action, l.resource, JSON.stringify(l.details))
      ),
    [auditLogs, auditQuery]
  );

  // ==================== SUPER ADMIN GLOBAL CRUD HELPERS ====================

  const crudRecords = useMemo(() => {
    const map: Record<CrudEntity, any[]> = {
      users: usersList,
      students,
      applications,
      schools,
      departments,
      programmes,
      courses,
      registrations,
      results,
      feeSchedules,
      invoices,
      documents: issuedDocs,
      attendance,
      tickets,
    };
    const list = map[crudEntity] || [];
    return list.filter((item) =>
      matchesWildcard(
        crudQuery,
        ...Object.values(item).map((v) =>
          v !== null && typeof v === 'object' ? JSON.stringify(v) : v == null ? '' : String(v)
        )
      )
    );
  }, [
    crudEntity,
    crudQuery,
    usersList,
    students,
    applications,
    schools,
    departments,
    programmes,
    courses,
    registrations,
    results,
    feeSchedules,
    invoices,
    issuedDocs,
    attendance,
    tickets,
  ]);

  const openGlobalCrudCreate = () => {
    setCrudMode('create');
    const templates: Partial<Record<CrudEntity, Record<string, any>>> = {
      users: { fullName: '', email: '', password: 'Password123!', role: 'LECTURER', phone: '' },
      students: {
        fullName: '',
        email: '',
        phone: '',
        programmeId: programmes[0]?.id || 'prog-nd-agric',
        level: 'ND I',
        sessionAdmitted: settingsForm.currentSession,
        gender: 'Male',
      },
      schools: { code: '', name: '', description: '' },
      departments: { schoolId: schools[0]?.id || 'sch-agric', code: '', name: '' },
      programmes: {
        departmentId: departments[0]?.id || 'dept-agric',
        code: '',
        name: '',
        qualification: 'ND',
        durationYears: 2,
        description: '',
      },
      courses: {
        departmentId: departments[0]?.id || 'dept-agric',
        code: '',
        title: '',
        creditUnits: 3,
        level: 'ND I',
        semester: 'First Semester',
        lecturerName: '',
        isCompulsory: true,
      },
      feeSchedules: {
        title: '',
        category: 'Tuition',
        level: 'ND I',
        session: settingsForm.currentSession,
        amount: 20000,
      },
      invoices: {
        studentId: students[0]?.id || '',
        title: 'Institutional Levy',
        amount: 15000,
        session: settingsForm.currentSession,
        dueDate: '2026-06-30',
      },
    };
    setCrudDraft(templates[crudEntity] || {});
    setCrudModalOpen(true);
  };

  const openGlobalCrudEdit = (item: Record<string, any>) => {
    setCrudMode('edit');
    setCrudDraft({ ...item });
    setCrudModalOpen(true);
  };

  const handleGlobalCrudSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = crudDraft.id;
      if (crudMode === 'create') {
        if (crudEntity === 'users') await api.createUser(crudDraft);
        else if (crudEntity === 'students') await api.createStudent(crudDraft);
        else if (crudEntity === 'schools') await api.createSchool(crudDraft);
        else if (crudEntity === 'departments') await api.createDepartment(crudDraft);
        else if (crudEntity === 'programmes') await api.createProgramme(crudDraft);
        else if (crudEntity === 'courses') await api.createCourse(crudDraft);
        else if (crudEntity === 'feeSchedules') await api.createFeeSchedule(crudDraft);
        else if (crudEntity === 'invoices') await api.createInvoice(crudDraft);
        notify(`Created new record in ${crudEntity}.`);
      } else {
        if (crudEntity === 'users') await api.updateUser(id, crudDraft);
        else if (crudEntity === 'students') await api.updateStudent(id, crudDraft);
        else if (crudEntity === 'applications') await api.updateApplication(id, crudDraft);
        else if (crudEntity === 'schools') await api.updateSchool(id, crudDraft);
        else if (crudEntity === 'departments') await api.updateDepartment(id, crudDraft);
        else if (crudEntity === 'programmes') await api.updateProgramme(id, crudDraft);
        else if (crudEntity === 'courses') await api.updateCourse(id, crudDraft);
        else if (crudEntity === 'registrations') await api.updateRegistration(id, crudDraft);
        else if (crudEntity === 'results') await api.updateResult(id, crudDraft);
        else if (crudEntity === 'feeSchedules') await api.updateFeeSchedule(id, crudDraft);
        else if (crudEntity === 'invoices') await api.updateInvoice(id, crudDraft);
        else if (crudEntity === 'documents') await api.updateIssuedDocument(id, crudDraft);
        else if (crudEntity === 'attendance') await api.updateAttendanceSession(id, crudDraft);
        else if (crudEntity === 'tickets') await api.updateSupportTicket(id, crudDraft);
        notify(`Updated ${crudEntity} record (${id}).`);
      }
      setCrudModalOpen(false);
      loadData();
    } catch (err: any) {
      notify(err.message || 'CRUD operation failed.', 'error');
    }
  };

  const handleGlobalCrudDelete = async (entity: CrudEntity, id: string) => {
    try {
      if (entity === 'users') await api.deleteUser(id);
      else if (entity === 'students') await api.deleteStudent(id);
      else if (entity === 'applications') await api.deleteApplication(id);
      else if (entity === 'schools') await api.deleteSchool(id);
      else if (entity === 'departments') await api.deleteDepartment(id);
      else if (entity === 'programmes') await api.deleteProgramme(id);
      else if (entity === 'courses') await api.deleteCourse(id);
      else if (entity === 'registrations') await api.deleteRegistration(id);
      else if (entity === 'results') await api.deleteResult(id);
      else if (entity === 'feeSchedules') await api.deleteFeeSchedule(id);
      else if (entity === 'invoices') await api.deleteInvoice(id);
      else if (entity === 'documents') await api.deleteIssuedDocument(id);
      else if (entity === 'attendance') await api.deleteAttendanceSession(id);
      else if (entity === 'tickets') await api.deleteSupportTicket(id);
      setConfirmDeleteKey(null);
      notify(`Deleted record from ${entity}.`);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Delete operation failed.', 'error');
    }
  };

  // Recharts Chart Data
  const enrollmentData = useMemo(() => {
    const palette = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#0d9488'];
    return departments.map((dept, i) => ({
      name: dept.code,
      students: students.filter((s) => s.departmentId === dept.id).length || (i === 0 ? 12 : 6),
      fill: palette[i % palette.length],
    }));
  }, [departments, students]);

  const financialData = [
    { name: 'Tuition Fees', value: payments.reduce((a, b) => a + b.amount, 0) || 100000 },
    { name: 'Pending Invoices', value: invoices.filter((i) => i.status !== 'PAID').reduce((a, b) => a + (b.amount - b.amountPaid), 0) || 45000 },
  ];
  const COLORS = ['#059669', '#d97706'];

  const renderDeleteButton = (key: string, onConfirm: () => void) =>
    confirmDeleteKey === key ? (
      <div className="inline-flex items-center gap-1">
        <button
          onClick={onConfirm}
          className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded cursor-pointer"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirmDeleteKey(null)}
          className="px-1.5 py-1 bg-slate-200 dark:bg-slate-700 text-[10px] rounded cursor-pointer"
        >
          No
        </button>
      </div>
    ) : (
      <button
        onClick={() => setConfirmDeleteKey(key)}
        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg cursor-pointer"
        title="Delete record"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    );

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Page Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpenMobile(!sidebarOpenMobile)}
            className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
            aria-label="Toggle Management Sidebar"
          >
            {sidebarOpenMobile ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              {user?.role?.replace(/_/g, ' ')} · Institutional Management
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              EDOCASTI Governance &amp; Workflow Console
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenPageBuilder && isSuperAdmin && (
            <button
              onClick={onOpenPageBuilder}
              className="px-3.5 py-2 bg-emerald-900 hover:bg-emerald-800 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" /> Visual Page Builder
            </button>
          )}
          <button
            onClick={loadData}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-5 p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* MAIN SIDEBAR + CONTENT LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside
          className={`${
            sidebarOpenMobile ? 'block' : 'hidden'
          } lg:block w-full lg:w-64 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-5 lg:sticky lg:top-24 shadow-xs`}
        >
          {sidebarGroups.map((group) => {
            const visibleItems = group.items.filter((item) => canAccessAdminTab(role, item.id));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.group} className="space-y-1">
                <div className="px-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.group}
                </div>
                {visibleItems.map((item) => {
                  const active = safeActiveSubTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSubTab(item.id);
                        setSidebarOpenMobile(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer text-left ${
                        active
                          ? 'bg-emerald-900 text-amber-300 shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className={active ? 'text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </aside>

        {/* MAIN RIGHT WORKSPACE */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {/* ==================== 1. ANALYTICS ==================== */}
          {safeActiveSubTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase">Enrolled Students</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                    {students.length || stats?.studentsCount || 0}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold">Active Matriculated</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase">Programmes &amp; Courses</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                    {programmes.length} / {courses.length}
                  </div>
                  <span className="text-[11px] text-amber-600 font-semibold">Dean Curriculum</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase">Issued Certificates/Transcripts</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                    {issuedDocs.length}
                  </div>
                  <span className="text-[11px] text-slate-500">Registrar Registry</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase">Total Revenue Settled</span>
                  <div className="text-2xl font-black text-emerald-900 dark:text-amber-400 mt-1 tabular-nums">
                    ₦{Number(stats?.totalRevenue || payments.reduce((a, b) => a + b.amount, 0) || 100000).toLocaleString('en-NG')}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-semibold">Verified via Remita</span>
                </div>
              </div>

              <Suspense fallback={<div className="grid grid-cols-1 lg:grid-cols-2 gap-6" role="status" aria-label="Loading analytics charts"><div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" /><div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" /></div>}>
                <AdminAnalyticsCharts
                  enrollmentData={enrollmentData}
                  financialData={financialData}
                  colors={COLORS}
                />
              </Suspense>
            </div>
          )}

          {/* ==================== 2. DEAN OF ACADEMICS: PROGRAMMES & COURSES ==================== */}
          {activeSubTab === 'dean_curriculum' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Office of the Dean of Academics
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Accredited Programmes &amp; Course Curriculum
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => openProgModal()}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" /> Create Programme
                    </button>
                    <button
                      onClick={() => openCourseModal()}
                      className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" /> Create Course
                    </button>
                  </div>
                </div>

                <WildcardFilterBar
                  query={deanQuery}
                  onQueryChange={setDeanQuery}
                  placeholder="Wildcard filter programmes & courses (e.g. AGT*, *Fisheries*, ND*)..."
                  totalCount={programmes.length + courses.length}
                  filteredCount={filteredProgrammes.length + filteredDeanCourses.length}
                  facets={[
                    {
                      key: 'dept',
                      label: 'Department',
                      value: deanDeptFilter,
                      onChange: setDeanDeptFilter,
                      options: departments.map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` })),
                    },
                    {
                      key: 'level',
                      label: 'Course Level',
                      value: deanLevelFilter,
                      onChange: setDeanLevelFilter,
                      options: [
                        { value: 'ND I', label: 'ND I' },
                        { value: 'ND II', label: 'ND II' },
                        { value: 'HND I', label: 'HND I' },
                        { value: 'HND II', label: 'HND II' },
                      ],
                    },
                  ]}
                />
              </div>

              {/* Programmes Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Academic Programmes ({filteredProgrammes.length})
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="p-3">Code</th>
                        <th className="p-3">Programme Name</th>
                        <th className="p-3">Department</th>
                        <th className="p-3">Qualification</th>
                        <th className="p-3 text-center">Duration</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredProgrammes.map((prog) => {
                        const dept = departments.find((d) => d.id === prog.departmentId);
                        return (
                          <tr key={prog.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                              {prog.code}
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{prog.name}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{dept?.name || prog.departmentId}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded font-bold text-[11px]">
                                {prog.qualification}
                              </span>
                            </td>
                            <td className="p-3 text-center tabular-nums">{prog.durationYears} yrs</td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => openProgModal(prog)}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                                title="Edit Programme"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {isSuperAdmin &&
                                renderDeleteButton(`prog-${prog.id}`, async () => {
                                  await api.deleteProgramme(prog.id);
                                  setConfirmDeleteKey(null);
                                  notify('Programme deleted.');
                                  loadData();
                                })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Courses Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Approved Courses ({filteredDeanCourses.length})
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="p-3">Code</th>
                        <th className="p-3">Course Title</th>
                        <th className="p-3">Department</th>
                        <th className="p-3 text-center">Units</th>
                        <th className="p-3">Level · Semester</th>
                        <th className="p-3">Assigned Lecturer</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredDeanCourses.map((crs) => {
                        const dept = departments.find((d) => d.id === crs.departmentId);
                        return (
                          <tr key={crs.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-mono font-bold text-emerald-900 dark:text-emerald-400">
                              {crs.code}
                            </td>
                            <td className="p-3 font-semibold text-slate-900 dark:text-white">{crs.title}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{dept?.code || crs.departmentId}</td>
                            <td className="p-3 text-center font-bold tabular-nums">{crs.creditUnits}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">
                              {crs.level} · {crs.semester}
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300">
                              {crs.lecturerName || 'Unassigned (Pending HOD)'}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => openCourseModal(crs)}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                                title="Edit Course"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {renderDeleteButton(`crs-${crs.id}`, async () => {
                                await api.deleteCourse(crs.id);
                                setConfirmDeleteKey(null);
                                notify('Course deleted.');
                                loadData();
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 3. HOD: COURSE-TO-LECTURER ALLOCATION ==================== */}
          {activeSubTab === 'hod_allocation' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Head of Department (HOD) Workflow
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Assign Departmental Courses to Lecturers
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allocate each course created by the Dean of Academics to an academic lecturer for teaching, CA, and examination score entry.
                </p>
              </div>

              <WildcardFilterBar
                query={hodQuery}
                onQueryChange={setHodQuery}
                placeholder="Wildcard filter courses or lecturers (e.g. AGT*, *Okon*)..."
                totalCount={courses.length}
                filteredCount={filteredHodCourses.length}
                facets={[
                  {
                    key: 'dept',
                    label: 'Department',
                    value: hodDeptFilter,
                    onChange: setHodDeptFilter,
                    options: departments.map((d) => ({ value: d.id, label: d.name })),
                  },
                ]}
              />

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Course</th>
                      <th className="p-3">Level · Semester</th>
                      <th className="p-3">Current Lecturer</th>
                      <th className="p-3">Assign To Lecturer</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredHodCourses.map((crs) => (
                      <tr key={crs.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3">
                          <div className="font-mono font-bold text-emerald-900 dark:text-emerald-400">{crs.code}</div>
                          <div className="font-semibold text-slate-900 dark:text-white">{crs.title}</div>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {crs.level} · {crs.semester} ({crs.creditUnits}U)
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              crs.lecturerId
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {crs.lecturerName || 'Unassigned'}
                          </span>
                        </td>
                        <td className="p-3">
                          <select
                            value={hodLecturerSelection[crs.id] ?? crs.lecturerId ?? ''}
                            onChange={(e) =>
                              setHodLecturerSelection((prev) => ({ ...prev, [crs.id]: e.target.value }))
                            }
                            className="w-full max-w-[230px] p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          >
                            <option value="">-- Select Lecturer --</option>
                            {lecturers.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.fullName} ({l.role})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleAssignLecturer(crs)}
                            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs cursor-pointer whitespace-nowrap"
                          >
                            Assign Lecturer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== 4. EXAM OFFICER APPROVALS (COURSE REGS + RESULTS) ==================== */}
          {activeSubTab === 'exam_approvals' && (
            <div className="space-y-6">
              {/* Panel A: HOD course registration approval; full-access roles may also review */}
              {user?.role !== 'EXAM_OFFICER' && <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    HOD Registration Approval
                  </span>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Student Course Registration Approvals
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verify and approve courses registered by students before exam clearance slips are finalized.
                  </p>
                </div>

                <WildcardFilterBar
                  query={examRegQuery}
                  onQueryChange={setExamRegQuery}
                  placeholder="Wildcard filter registrations (e.g. *Eghosa*, EDOCASTI/*)..."
                  totalCount={registrations.length}
                  filteredCount={filteredRegistrations.length}
                  facets={[
                    {
                      key: 'status',
                      label: 'Status',
                      value: examRegStatusFilter,
                      onChange: setExamRegStatusFilter,
                      options: [
                        { value: 'SUBMITTED', label: 'Pending Approval (SUBMITTED)' },
                        { value: 'APPROVED_BY_HOD', label: 'Approved by HOD' },
                        { value: 'APPROVED_BY_HOD', label: 'Approved by HOD' },
                        { value: 'REJECTED', label: 'Rejected' },
                      ],
                    },
                  ]}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-200">
                    <label className="inline-flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={allPendingRegistrationsSelected}
                        disabled={pendingFilteredRegistrationIds.length === 0}
                        onChange={(e) =>
                          setSelectedRegistrationIds((current) =>
                            e.target.checked
                              ? Array.from(new Set([...current, ...pendingFilteredRegistrationIds]))
                              : current.filter((id) => !pendingFilteredRegistrationIds.includes(id))
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Select all filtered pending ({pendingFilteredRegistrationIds.length})
                    </label>
                    <span>{selectedRegistrationIds.filter((id) => pendingFilteredRegistrationIds.includes(id)).length} selected</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBulkApproveRegistrations(selectedRegistrationIds)}
                    disabled={!selectedRegistrationIds.some((id) => pendingFilteredRegistrationIds.includes(id))}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg inline-flex items-center gap-2"
                  >
                    <CheckCheck className="w-4 h-4" /> Approve Selected Registrations
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="p-3">Select</th>
                        <th className="p-3">Student</th>
                        <th className="p-3">Level · Period</th>
                        <th className="p-3">Registered Course Details</th>
                        <th className="p-3 text-center">Credits</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">HOD Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredRegistrations.map((reg) => {
                        const std = students.find((s) => s.id === reg.studentId);
                        const isPending = reg.status === 'SUBMITTED';
                        const isApproved =
                          reg.status === 'APPROVED_BY_EXAM_OFFICER' || reg.status === 'APPROVED_BY_HOD';
                        return (
                          <tr key={reg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3">
                              {isPending ? (
                                <input
                                  type="checkbox"
                                  aria-label={`Select registration for ${std?.fullName || reg.studentId}`}
                                  checked={selectedRegistrationIds.includes(reg.id)}
                                  onChange={(e) =>
                                    setSelectedRegistrationIds((current) =>
                                      e.target.checked
                                        ? [...current, reg.id]
                                        : current.filter((id) => id !== reg.id)
                                    )
                                  }
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {std?.fullName || reg.studentId}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500">
                                {std?.matricNumber || ''}
                              </div>
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">
                              {reg.level} · {reg.session} ({reg.semester})
                            </td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => setReviewRegistration(reg)}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900 font-bold text-xs hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                              >
                                Review Courses ({reg.courseIds.length})
                              </button>
                            </td>
                            <td className="p-3 text-center font-bold tabular-nums">{reg.totalCredits}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isApproved
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : reg.status === 'REJECTED'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {reg.status}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                              {isPending && (
                                <button
                                  onClick={() => handleApproveRegistration(reg.id)}
                                  className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle className="w-3 h-3" /> Approve
                                </button>
                              )}
                              {isPending && (
                                <button
                                  onClick={() => handleRejectRegistration(reg.id)}
                                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-3 h-3" /> Reject
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>}

              {/* Panel B: Exam Officer result moderation and publication */}
              {user?.role !== 'HOD' && <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Examination Officer Gate 2
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Lecturer CA &amp; Exam Score Moderation &amp; Publishing
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Results entered by lecturers remain hidden from students until approved and published here by the Exam Officer.
                    </p>
                  </div>

                  {filteredExamResults.some((r) => r.status === 'SUBMITTED') && (
                    <button
                      type="button"
                      disabled={publishingResults}
                      onClick={() =>
                        handleBulkPublishResults(
                          filteredExamResults.filter((r) => r.status === 'SUBMITTED').map((r) => r.id)
                        )
                      }
                      className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <CheckCheck className="w-4 h-4 text-amber-300" />
                      {publishingResults ? 'Publishing...' : 'Approve & Publish All Filtered Pending'}
                      {' '}({filteredExamResults.filter((r) => r.status === 'SUBMITTED').length})
                    </button>
                  )}
                </div>

                <WildcardFilterBar
                  query={examResQuery}
                  onQueryChange={setExamResQuery}
                  placeholder="Wildcard filter results (e.g. AGT*, *Blessing*, A)..."
                  totalCount={results.length}
                  filteredCount={filteredExamResults.length}
                  facets={[
                    {
                      key: 'course',
                      label: 'Course',
                      value: examResCourseFilter,
                      onChange: setExamResCourseFilter,
                      options: courses.map((c) => ({ value: c.id, label: `${c.code} · ${c.title}` })),
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      value: examResStatusFilter,
                      onChange: setExamResStatusFilter,
                      options: [
                        { value: 'SUBMITTED', label: 'Pending HOD (SUBMITTED)' },
                        { value: 'PUBLISHED', label: 'Published to Students' },
                        { value: 'DRAFT', label: 'Draft' },
                      ],
                    },
                  ]}
                />

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="p-3">Course</th>
                        <th className="p-3">Matric No</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3 text-center">CA / Exam</th>
                        <th className="p-3 text-center">Total</th>
                        <th className="p-3 text-center">Grade</th>
                        <th className="p-3">Approval Status</th>
                        <th className="p-3 text-right">Exam Officer Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredExamResults.map((r) => {
                        const crs = courses.find((c) => c.id === r.courseId);
                        return (
                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-bold font-mono text-emerald-900 dark:text-emerald-400">
                              {crs?.code || r.courseId}
                            </td>
                            <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{r.matricNumber}</td>
                            <td className="p-3 font-semibold uppercase text-slate-900 dark:text-white">
                              {r.studentName}
                            </td>
                            <td className="p-3 text-center tabular-nums">
                              {r.caScore} / {r.examScore}
                            </td>
                            <td className="p-3 text-center font-bold tabular-nums">{r.totalScore}</td>
                            <td className="p-3 text-center font-black text-emerald-800 dark:text-emerald-400">
                              {r.grade}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  r.status === 'PUBLISHED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {r.status === 'SUBMITTED' ? (
                                <button
                                  onClick={() => handlePublishResult(r.id)}
                                  className="px-3 py-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded text-xs cursor-pointer shadow-2xs whitespace-nowrap"
                                >
                                  Approve &amp; Publish
                                </button>
                              ) : (
                                <span className={`text-[11px] font-semibold ${r.status === 'PUBLISHED' ? 'text-emerald-700' : 'text-slate-500'}`}>
                                  {r.status === 'PUBLISHED' ? 'Published' : 'Draft — not eligible'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>}
            </div>
          )}

          {/* ==================== 5. REGISTRAR: TRANSCRIPTS & FINAL CERTIFICATES ==================== */}
          {activeSubTab === 'registrar_docs' && (
            <div className="space-y-6">
              {/* Generate Form */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Office of the College Registrar
                  </span>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Generate Student Transcript &amp; Final Certificate
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generating a Transcript or Final Certificate automatically issues an invoice. Students unlock &amp; download the official document immediately upon fee payment.
                  </p>
                </div>

                <form onSubmit={handleGenerateDocument} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Select Matriculated Student *
                    </label>
                    <select
                      required
                      value={docForm.studentId}
                      onChange={(e) => setDocForm({ ...docForm, studentId: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">-- Choose Student --</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} ({s.matricNumber} · {s.level} · CGPA {Number(s.cgpa).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Document Type *
                    </label>
                    <select
                      value={docForm.type}
                      onChange={(e) => {
                        const t = e.target.value as 'TRANSCRIPT' | 'FINAL_CERTIFICATE';
                        setDocForm({
                          ...docForm,
                          type: t,
                          feeAmount:
                            t === 'FINAL_CERTIFICATE'
                              ? settings?.certificateFee ?? 25000
                              : settings?.transcriptFee ?? 15000,
                        });
                      }}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="TRANSCRIPT">Official Academic Transcript</option>
                      <option value="FINAL_CERTIFICATE">Final Diploma Certificate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Processing Fee (₦) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={docForm.feeAmount}
                      onChange={(e) => setDocForm({ ...docForm, feeAmount: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Classification Override (Optional)
                    </label>
                    <input
                      type="text"
                      value={docForm.classification}
                      onChange={(e) => setDocForm({ ...docForm, classification: e.target.value })}
                      placeholder="Auto-computed from CGPA (e.g. Distinction, Upper Credit)..."
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Registrar Remarks
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={docForm.remarks}
                        onChange={(e) => setDocForm({ ...docForm, remarks: e.target.value })}
                        placeholder="e.g. Verified for NYSC / Institutional Transfer"
                        className="flex-1 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl cursor-pointer whitespace-nowrap"
                      >
                        Generate Document
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Issued Documents Register */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Issued Transcripts &amp; Final Certificates ({issuedDocs.length})
                </h3>

                <WildcardFilterBar
                  query={docQuery}
                  onQueryChange={setDocQuery}
                  placeholder="Wildcard filter documents (e.g. EDOCASTI-TR*, *PAID*, *Blessing*)..."
                  totalCount={issuedDocs.length}
                  filteredCount={filteredIssuedDocs.length}
                  facets={[
                    {
                      key: 'type',
                      label: 'Document Type',
                      value: docTypeFilter,
                      onChange: setDocTypeFilter,
                      options: [
                        { value: 'TRANSCRIPT', label: 'Transcripts' },
                        { value: 'FINAL_CERTIFICATE', label: 'Final Certificates' },
                      ],
                    },
                  ]}
                />

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="p-3">Doc Ref</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Student &amp; Matric</th>
                        <th className="p-3">Classification</th>
                        <th className="p-3 text-right">Fee (₦)</th>
                        <th className="p-3">Payment Gate</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredIssuedDocs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-500">
                            No transcripts or certificates generated yet. Use the form above to issue one.
                          </td>
                        </tr>
                      ) : (
                        filteredIssuedDocs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-mono font-bold text-emerald-900 dark:text-emerald-400">
                              {doc.documentNumber}
                            </td>
                            <td className="p-3 font-bold">
                              {doc.type === 'FINAL_CERTIFICATE' ? 'Final Certificate' : 'Transcript'}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">{doc.studentName}</div>
                              <div className="font-mono text-[11px] text-slate-500">{doc.matricNumber}</div>
                            </td>
                            <td className="p-3">
                              {doc.classification} (CGPA {Number(doc.cgpa).toFixed(2)})
                            </td>
                            <td className="p-3 text-right font-mono font-bold tabular-nums">
                              ₦{Number(doc.feeAmount).toLocaleString('en-NG')}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  doc.paymentStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {doc.paymentStatus || 'UNPAID'}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => onOpenPrintModal(doc.type, doc)}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3" /> Preview / Print
                              </button>
                              {renderDeleteButton(`doc-${doc.id}`, async () => {
                                await api.deleteIssuedDocument(doc.id);
                                setConfirmDeleteKey(null);
                                notify('Issued document removed.');
                                loadData();
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 6. BURSARY & FEE LEDGER ==================== */}
          {activeSubTab === 'finance' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Bursary Fee Schedules, Invoices &amp; Payments
                  </h2>
                  <p className="text-xs text-slate-500">
                    Manage institutional fee schedules, issue custom student invoices, and reconcile payment receipts.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setEditingFeeId(null);
                      setFeeForm({
                        title: '',
                        category: 'Tuition',
                        programmeId: '',
                        level: 'ND I',
                        session: settingsForm.currentSession,
                        amount: 45000,
                      });
                      setFeeModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Fee Item
                  </button>
                  <button
                    onClick={() => {
                      setInvoiceForm({
                        studentId: students[0]?.id || '',
                        title: '',
                        amount: 25000,
                        session: settingsForm.currentSession,
                        dueDate: '2026-06-30',
                      });
                      setInvoiceModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Issue Student Invoice
                  </button>
                </div>
              </div>

              <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                {(['schedules', 'invoices', 'payments', 'new_catalog', 'new_schedules', 'admission_retries'] as const).filter((view) => view !== 'admission_retries' || canManageAdmissionFeeActivations).map((view) => (
                  <button
                    key={view}
                    onClick={() => setFinanceSubView(view)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                      financeSubView === view
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {view === 'schedules'
                      ? `Legacy Schedules (${feeSchedules.length})`
                      : view === 'invoices'
                      ? `Invoices (${invoices.length})`
                      : view === 'payments'
                      ? `Payments (${payments.length})`
                      : view === 'new_catalog'
                      ? 'New Fee Catalog'
                      : view === 'new_schedules'
                      ? 'Programme Fee Schedules'
                      : 'Admission Fee Activations'}
                  </button>
                ))}
              </div>

              <WildcardFilterBar
                query={financeQuery}
                onQueryChange={setFinanceQuery}
                placeholder="Wildcard filter finance records (e.g. *Tuition*, INV-*, PAID)..."
              />

              {financeSubView === 'new_catalog' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">PostgreSQL Fee Catalog</h3>
                      <p className="text-xs text-slate-500">Manage reusable compulsory and optional fee definitions.</p>
                    </div>
                    <button
                      type="button"
                      disabled={newFeeBusy}
                      onClick={async () => {
                        setNewFeeBusy(true);
                        setNewFeeError('');
                        try {
                          const result = await api.getNewFeeCatalog({ includeInactive: true });
                          setNewFeeCatalog(result.items || []);
                        } catch (error: any) {
                          setNewFeeError(error.message || 'Unable to load the new fee catalog.');
                        } finally {
                          setNewFeeBusy(false);
                        }
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white disabled:opacity-50"
                    >
                      {newFeeBusy ? 'Loading...' : 'Refresh Catalog'}
                    </button>
                  </div>

                  {newFeeError && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
                      {newFeeError}
                      {newFeeError.includes('503') && ' The fee-management feature flag is still disabled, as intended during this UI stage.'}
                    </div>
                  )}

                  {['SUPER_ADMIN', 'BURSAR', 'RECTOR'].includes(role) && (
                    <form
                      className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const amount = Number(newFeeForm.amount);
                        if (!newFeeForm.name.trim() || !Number.isFinite(amount) || amount <= 0) {
                          notify('Enter a fee name and a valid amount greater than zero.', 'error');
                          return;
                        }

                        setNewFeeBusy(true);
                        setNewFeeError('');
                        try {
                          if (newFeeEditingId) {
                            await api.updateNewFeeCatalogItem(newFeeEditingId, {
                              name: newFeeForm.name.trim(),
                              amount,
                              feeType: newFeeForm.feeType,
                              category: newFeeForm.category,
                              description: newFeeForm.description,
                            });
                            notify('Fee catalog item updated.');
                          } else {
                            await api.createNewFeeCatalogItem({
                              name: newFeeForm.name.trim(),
                              amount,
                              feeType: newFeeForm.feeType,
                              category: newFeeForm.category,
                              description: newFeeForm.description,
                            });
                            notify('Fee catalog item created.');
                          }

                          setNewFeeEditingId(null);
                          setNewFeeForm({
                            name: '',
                            amount: '0',
                            feeType: 'PER_SESSION',
                            category: 'COMPULSORY',
                            description: '',
                          });
                          const result = await api.getNewFeeCatalog({ includeInactive: true });
                          setNewFeeCatalog(result.items || []);
                        } catch (error: any) {
                          setNewFeeError(error.message || 'Unable to save the fee catalog item.');
                        } finally {
                          setNewFeeBusy(false);
                        }
                      }}
                    >
                      <div className="md:col-span-2 font-bold text-sm text-slate-800 dark:text-white">
                        {newFeeEditingId ? 'Edit Fee Catalog Item' : 'Create Fee Catalog Item'}
                      </div>

                      <input
                        required
                        value={newFeeForm.name}
                        onChange={(event) => setNewFeeForm({ ...newFeeForm, name: event.target.value })}
                        placeholder="Fee name"
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-2 text-sm"
                      />

                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={newFeeForm.amount}
                        onChange={(event) => setNewFeeForm({ ...newFeeForm, amount: event.target.value })}
                        placeholder="Amount"
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-2 text-sm"
                      />

                      <select
                        value={newFeeForm.feeType}
                        onChange={(event) => setNewFeeForm({ ...newFeeForm, feeType: event.target.value as 'ONE_TIME' | 'PER_SESSION' })}
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-sm"
                      >
                        <option value="PER_SESSION">Per Session</option>
                        <option value="ONE_TIME">One Time</option>
                      </select>

                      <select
                        value={newFeeForm.category}
                        onChange={(event) => setNewFeeForm({ ...newFeeForm, category: event.target.value as 'COMPULSORY' | 'OPTIONAL' })}
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-sm"
                      >
                        <option value="COMPULSORY">Compulsory</option>
                        <option value="OPTIONAL">Optional</option>
                      </select>

                      <textarea
                        value={newFeeForm.description}
                        onChange={(event) => setNewFeeForm({ ...newFeeForm, description: event.target.value })}
                        placeholder="Description (optional)"
                        rows={2}
                        className="md:col-span-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-2 text-sm"
                      />

                      <div className="md:col-span-2 flex gap-2">
                        <button
                          type="submit"
                          disabled={newFeeBusy}
                          className="px-4 py-2 rounded-lg bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
                        >
                          {newFeeEditingId ? 'Save Changes' : 'Create Fee'}
                        </button>
                        {newFeeEditingId && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewFeeEditingId(null);
                              setNewFeeForm({
                                name: '',
                                amount: '0',
                                feeType: 'PER_SESSION',
                                category: 'COMPULSORY',
                                description: '',
                              });
                            }}
                            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold"
                          >
                            Cancel Edit
                          </button>
                        )}
                      </div>
                    </form>
                  )}

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 uppercase">
                        <tr>
                          <th className="p-3">Fee</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Status</th>
                          {['SUPER_ADMIN', 'BURSAR', 'RECTOR'].includes(role) && <th className="p-3">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {newFeeCatalog.map((item) => (
                          <tr key={item.id} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="p-3">
                              <div className="font-bold">{item.name}</div>
                              {item.description && <div className="text-slate-500">{item.description}</div>}
                            </td>
                            <td className="p-3">{Number(item.amount).toLocaleString()}</td>
                            <td className="p-3">{item.feeType === 'ONE_TIME' ? 'One Time' : 'Per Session'}</td>
                            <td className="p-3">{item.category}</td>
                            <td className="p-3">{item.isActive ? 'Active' : 'Inactive'}</td>
                            {['SUPER_ADMIN', 'BURSAR', 'RECTOR'].includes(role) && (
                              <td className="p-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewFeeEditingId(item.id);
                                      setNewFeeForm({
                                        name: item.name,
                                        amount: String(item.amount),
                                        feeType: item.feeType,
                                        category: item.category,
                                        description: item.description || '',
                                      });
                                    }}
                                    className="text-emerald-700 dark:text-emerald-400 font-bold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={newFeeBusy}
                                    onClick={async () => {
                                      setNewFeeBusy(true);
                                      setNewFeeError('');
                                      try {
                                        await api.updateNewFeeCatalogItem(item.id, { isActive: !item.isActive });
                                        const result = await api.getNewFeeCatalog({ includeInactive: true });
                                        setNewFeeCatalog(result.items || []);
                                        notify(item.isActive ? 'Fee item deactivated.' : 'Fee item activated.');
                                      } catch (error: any) {
                                        setNewFeeError(error.message || 'Unable to change fee status.');
                                      } finally {
                                        setNewFeeBusy(false);
                                      }
                                    }}
                                    className="text-amber-700 dark:text-amber-400 font-bold disabled:opacity-50"
                                  >
                                    {item.isActive ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={newFeeBusy}
                                    onClick={async () => {
                                      setNewFeeBusy(true);
                                      setNewFeeError('');
                                      try {
                                        const result = await api.deleteNewFeeCatalogItem(item.id);
                                        const refreshed = await api.getNewFeeCatalog({ includeInactive: true });
                                        setNewFeeCatalog(refreshed.items || []);
                                        notify(result.result?.deactivated
                                          ? 'This fee is already in use, so it was deactivated instead of deleted.'
                                          : 'Unused fee item deleted.');
                                      } catch (error: any) {
                                        setNewFeeError(error.message || 'Unable to delete fee item.');
                                      } finally {
                                        setNewFeeBusy(false);
                                      }
                                    }}
                                    className="text-red-700 dark:text-red-400 font-bold disabled:opacity-50"
                                  >
                                    Delete if unused
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                        {newFeeCatalog.length === 0 && (
                          <tr>
                            <td colSpan={['SUPER_ADMIN', 'BURSAR', 'RECTOR'].includes(role) ? 6 : 5} className="p-5 text-center text-slate-500">
                              No fee catalog records loaded. Use Refresh Catalog to load records.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {financeSubView === 'new_schedules' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Programme Fee Schedules</h3>
                      <p className="text-xs text-slate-500">Build fee schedules by programme, academic session and level.</p>
                    </div>
                    <button
                      type="button"
                      disabled={newFeeBusy}
                      onClick={async () => {
                        setNewFeeBusy(true);
                        setNewFeeError('');
                        try {
                          const result = await api.getNewFeeSchedules({ includeInactive: true });
                          setNewFeeSchedules(result.schedules || []);
                        } catch (error: any) {
                          setNewFeeError(error.message || 'Unable to load programme fee schedules.');
                        } finally {
                          setNewFeeBusy(false);
                        }
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white disabled:opacity-50"
                    >
                      {newFeeBusy ? 'Loading...' : 'Refresh Schedules'}
                    </button>
                  </div>

                  {newFeeError && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
                      {newFeeError}
                      {newFeeError.includes('503') && ' The fee-management feature flag is still disabled.'}
                    </div>
                  )}

                  {['SUPER_ADMIN', 'BURSAR', 'RECTOR'].includes(role) && (
                    <form
                      className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (!newScheduleForm.programmeId || !newScheduleForm.session.trim() || !newScheduleForm.level.trim()) {
                          notify('Select a programme and enter the session and level.', 'error');
                          return;
                        }
                        setNewFeeBusy(true);
                        setNewFeeError('');
                        try {
                          await api.createNewFeeSchedule({
                            programmeId: newScheduleForm.programmeId,
                            session: newScheduleForm.session.trim(),
                            level: newScheduleForm.level.trim(),
                          });
                          const result = await api.getNewFeeSchedules({ includeInactive: true });
                          setNewFeeSchedules(result.schedules || []);
                          notify('Draft programme fee schedule created.');
                        } catch (error: any) {
                          setNewFeeError(error.message || 'Unable to create programme fee schedule.');
                        } finally {
                          setNewFeeBusy(false);
                        }
                      }}
                    >
                      <select
                        required
                        value={newScheduleForm.programmeId}
                        onChange={(event) => setNewScheduleForm({ ...newScheduleForm, programmeId: event.target.value })}
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-sm"
                      >
                        <option value="">Select Programme</option>
                        {programmes.map((programme) => (
                          <option key={programme.id} value={programme.id}>{programme.name}</option>
                        ))}
                      </select>
                      <input
                        required
                        value={newScheduleForm.session}
                        onChange={(event) => setNewScheduleForm({ ...newScheduleForm, session: event.target.value })}
                        placeholder="Academic session"
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-2 text-sm"
                      />
                      <select
                        value={newScheduleForm.level}
                        onChange={(event) => setNewScheduleForm({ ...newScheduleForm, level: event.target.value })}
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-sm"
                      >
                        <option>ND I</option>
                        <option>ND II</option>
                        <option>HND I</option>
                        <option>HND II</option>
                        <option>Certificate</option>
                      </select>
                      <button
                        type="submit"
                        disabled={newFeeBusy}
                        className="rounded-lg bg-emerald-800 text-white p-2 text-xs font-bold disabled:opacity-50"
                      >
                        Create Draft
                      </button>
                    </form>
                  )}

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 uppercase">
                        <tr>
                          <th className="p-3">Programme</th>
                          <th className="p-3">Session</th>
                          <th className="p-3">Level</th>
                          <th className="p-3">Items</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newFeeSchedules.map((schedule) => (
                          <tr key={schedule.id} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="p-3">{programmes.find((p) => p.id === schedule.programmeId)?.name || schedule.programmeId}</td>
                            <td className="p-3">{schedule.session}</td>
                            <td className="p-3">{schedule.level}</td>
                            <td className="p-3">{schedule.itemCount}</td>
                            <td className="p-3">{Number(schedule.totalAmount).toLocaleString()}</td>
                            <td className="p-3">
                              {schedule.status} / {schedule.isActive ? 'Active' : 'Inactive'}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setNewFeeBusy(true);
                                    setNewFeeError('');
                                    try {
                                      const result = await api.getNewFeeSchedule(schedule.id);
                                      setSelectedNewSchedule(result.schedule || schedule);
                                      setSelectedNewScheduleItems(result.items || []);
                                    } catch (error: any) {
                                      setNewFeeError(error.message || 'Unable to load schedule details.');
                                    } finally {
                                      setNewFeeBusy(false);
                                    }
                                  }}
                                  className="font-bold text-emerald-700 dark:text-emerald-400"
                                >
                                  View Items
                                </button>
                                {['SUPER_ADMIN', 'BURSAR', 'RECTOR'].includes(role) && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={newFeeBusy}
                                      onClick={async () => {
                                        setNewFeeBusy(true);
                                        setNewFeeError('');
                                        try {
                                          await api.cloneNewFeeSchedule(schedule.id);
                                          const result = await api.getNewFeeSchedules({ includeInactive: true });
                                          setNewFeeSchedules(result.schedules || []);
                                          notify('Schedule cloned as a draft.');
                                        } catch (error: any) {
                                          setNewFeeError(error.message || 'Unable to clone schedule.');
                                        } finally {
                                          setNewFeeBusy(false);
                                        }
                                      }}
                                      className="font-bold text-sky-700 dark:text-sky-400"
                                    >
                                      Clone
                                    </button>
                                    <button
                                      type="button"
                                      disabled={newFeeBusy}
                                      onClick={async () => {
                                        setNewFeeBusy(true);
                                        setNewFeeError('');
                                        try {
                                          if (schedule.status === 'PUBLISHED') {
                                            await api.unpublishNewFeeSchedule(schedule.id);
                                          } else {
                                            await api.publishNewFeeSchedule(schedule.id);
                                          }
                                          const result = await api.getNewFeeSchedules({ includeInactive: true });
                                          setNewFeeSchedules(result.schedules || []);
                                          notify(schedule.status === 'PUBLISHED' ? 'Schedule returned to draft.' : 'Schedule published.');
                                        } catch (error: any) {
                                          setNewFeeError(error.message || 'Unable to change publication status.');
                                        } finally {
                                          setNewFeeBusy(false);
                                        }
                                      }}
                                      className="font-bold text-amber-700 dark:text-amber-400"
                                    >
                                      {schedule.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={newFeeBusy}
                                      onClick={async () => {
                                        setNewFeeBusy(true);
                                        setNewFeeError('');
                                        try {
                                          await api.setNewFeeScheduleActive(schedule.id, !schedule.isActive);
                                          const result = await api.getNewFeeSchedules({ includeInactive: true });
                                          setNewFeeSchedules(result.schedules || []);
                                          notify(schedule.isActive ? 'Schedule deactivated.' : 'Schedule activated.');
                                        } catch (error: any) {
                                          setNewFeeError(error.message || 'Unable to change schedule activation.');
                                        } finally {
                                          setNewFeeBusy(false);
                                        }
                                      }}
                                      className="font-bold text-red-700 dark:text-red-400"
                                    >
                                      {schedule.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {newFeeSchedules.length === 0 && (
                          <tr><td colSpan={7} className="p-5 text-center text-slate-500">No new fee schedules loaded. Use Refresh Schedules to load records.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {selectedNewSchedule && (
                    <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">Schedule Items</h4>
                          <p className="text-xs text-slate-500">
                            {selectedNewSchedule.session} · {selectedNewSchedule.level} · {selectedNewSchedule.status}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNewSchedule(null);
                            setSelectedNewScheduleItems([]);
                          }}
                          className="text-xs font-bold text-slate-600 dark:text-slate-300"
                        >
                          Close Details
                        </button>
                      </div>

                      {['SUPER_ADMIN', 'BURSAR', 'RECTOR'].includes(role) && selectedNewSchedule.status === 'DRAFT' && selectedNewSchedule.isActive && (
                        <form
                          className="grid grid-cols-1 md:grid-cols-4 gap-2"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            if (!newScheduleItemForm.feeCatalogItemId) {
                              notify('Select a fee catalog item.', 'error');
                              return;
                            }
                            const override = newScheduleItemForm.amountOverride.trim()
                              ? Number(newScheduleItemForm.amountOverride)
                              : null;
                            const priority = Number(newScheduleItemForm.allocationPriority);
                            if ((override !== null && (!Number.isFinite(override) || override <= 0)) ||
                                !Number.isInteger(priority) || priority < 0) {
                              notify('Enter a valid amount override and a non-negative whole-number priority.', 'error');
                              return;
                            }
                            setNewFeeBusy(true);
                            setNewFeeError('');
                            try {
                              await api.addNewFeeScheduleItem(selectedNewSchedule.id, {
                                feeCatalogItemId: newScheduleItemForm.feeCatalogItemId,
                                amountOverride: override,
                                allocationPriority: priority,
                              });
                              const detail = await api.getNewFeeSchedule(selectedNewSchedule.id);
                              setSelectedNewSchedule(detail.schedule || selectedNewSchedule);
                              setSelectedNewScheduleItems(detail.items || []);
                              const list = await api.getNewFeeSchedules({ includeInactive: true });
                              setNewFeeSchedules(list.schedules || []);
                              setNewScheduleItemForm({
                                feeCatalogItemId: '',
                                amountOverride: '',
                                allocationPriority: '100',
                              });
                              notify('Fee item added to draft schedule.');
                            } catch (error: any) {
                              setNewFeeError(error.message || 'Unable to add schedule item.');
                            } finally {
                              setNewFeeBusy(false);
                            }
                          }}
                        >
                          <select
                            required
                            value={newScheduleItemForm.feeCatalogItemId}
                            onChange={(event) => setNewScheduleItemForm({ ...newScheduleItemForm, feeCatalogItemId: event.target.value })}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-sm"
                          >
                            <option value="">Select active catalog fee</option>
                            {newFeeCatalog.filter((item) => item.isActive).map((item) => (
                              <option key={item.id} value={item.id}>{item.name} — {Number(item.amount).toLocaleString()}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={newScheduleItemForm.amountOverride}
                            onChange={(event) => setNewScheduleItemForm({ ...newScheduleItemForm, amountOverride: event.target.value })}
                            placeholder="Override (optional)"
                            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-2 text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={newScheduleItemForm.allocationPriority}
                            onChange={(event) => setNewScheduleItemForm({ ...newScheduleItemForm, allocationPriority: event.target.value })}
                            placeholder="Allocation priority"
                            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-2 text-sm"
                          />
                          <button type="submit" disabled={newFeeBusy} className="rounded-lg bg-emerald-800 text-white p-2 text-xs font-bold disabled:opacity-50">
                            Add Fee Item
                          </button>
                        </form>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800">
                            <tr>
                              <th className="p-2">Fee</th>
                              <th className="p-2">Category</th>
                              <th className="p-2">Base Amount</th>
                              <th className="p-2">Override</th>
                              <th className="p-2">Effective</th>
                              <th className="p-2">Priority</th>
                              {['SUPER_ADMIN', 'BURSAR', 'RECTOR'].includes(role) && selectedNewSchedule.status === 'DRAFT' && <th className="p-2">Action</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedNewScheduleItems.map((item) => (
                              <tr key={item.id} className="border-t border-slate-200 dark:border-slate-700">
                                <td className="p-2">{item.feeNameSnapshot}</td>
                                <td className="p-2">{item.feeCategorySnapshot}</td>
                                <td className="p-2">{Number(item.baseAmountSnapshot).toLocaleString()}</td>
                                <td className="p-2">
                                  {editingNewScheduleItemId === item.id ? (
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={editingNewScheduleItemForm.amountOverride}
                                      onChange={(event) => setEditingNewScheduleItemForm({ ...editingNewScheduleItemForm, amountOverride: event.target.value })}
                                      placeholder="Base amount"
                                      className="w-28 rounded border border-slate-300 dark:border-slate-600 bg-transparent p-1"
                                    />
                                  ) : (item.amountOverride == null ? '—' : Number(item.amountOverride).toLocaleString())}
                                </td>
                                <td className="p-2 font-bold">{Number(item.effectiveAmount).toLocaleString()}</td>
                                <td className="p-2">
                                  {editingNewScheduleItemId === item.id ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={editingNewScheduleItemForm.allocationPriority}
                                      onChange={(event) => setEditingNewScheduleItemForm({ ...editingNewScheduleItemForm, allocationPriority: event.target.value })}
                                      className="w-20 rounded border border-slate-300 dark:border-slate-600 bg-transparent p-1"
                                    />
                                  ) : item.allocationPriority}
                                </td>
                                {['SUPER_ADMIN', 'BURSAR', 'RECTOR'].includes(role) && selectedNewSchedule.status === 'DRAFT' && (
                                  <td className="p-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {editingNewScheduleItemId === item.id ? (
                                        <>
                                          <button
                                            type="button"
                                            disabled={newFeeBusy}
                                            onClick={async () => {
                                              const rawOverride = editingNewScheduleItemForm.amountOverride.trim();
                                              const override = rawOverride === '' ? null : Number(rawOverride);
                                              const priority = Number(editingNewScheduleItemForm.allocationPriority);

                                              if (
                                                (override !== null && (!Number.isFinite(override) || override <= 0 || !/^\d+(\.\d{1,2})?$/.test(rawOverride))) ||
                                                !Number.isInteger(priority) || priority < 0 || priority > 2147483647
                                              ) {
                                                notify('Enter a valid positive amount with up to 2 decimal places and a whole-number priority from 0 to 2147483647.', 'error');
                                                return;
                                              }

                                              setNewFeeBusy(true);
                                              setNewFeeError('');
                                              try {
                                                await api.updateNewFeeScheduleItem(selectedNewSchedule.id, item.id, {
                                                  amountOverride: override,
                                                  allocationPriority: priority,
                                                });
                                                const detail = await api.getNewFeeSchedule(selectedNewSchedule.id);
                                                setSelectedNewSchedule(detail.schedule || selectedNewSchedule);
                                                setSelectedNewScheduleItems(detail.items || []);
                                                const list = await api.getNewFeeSchedules({ includeInactive: true });
                                                setNewFeeSchedules(list.schedules || []);
                                                setEditingNewScheduleItemId(null);
                                                notify('Schedule item updated.');
                                              } catch (error: any) {
                                                setNewFeeError(error.message || 'Unable to update schedule item.');
                                              } finally {
                                                setNewFeeBusy(false);
                                              }
                                            }}
                                            className="font-bold text-emerald-700 dark:text-emerald-400 disabled:opacity-50"
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            disabled={newFeeBusy}
                                            onClick={() => setEditingNewScheduleItemId(null)}
                                            className="font-bold text-slate-600 dark:text-slate-300"
                                          >
                                            Cancel
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            disabled={newFeeBusy}
                                            onClick={() => {
                                              setEditingNewScheduleItemForm({
                                                amountOverride: item.amountOverride == null ? '' : String(item.amountOverride),
                                                allocationPriority: String(item.allocationPriority),
                                              });
                                              setEditingNewScheduleItemId(item.id);
                                            }}
                                            className="font-bold text-blue-700 dark:text-blue-400 disabled:opacity-50"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            disabled={newFeeBusy}
                                            onClick={async () => {
                                              setNewFeeBusy(true);
                                              setNewFeeError('');
                                              try {
                                                await api.removeNewFeeScheduleItem(selectedNewSchedule.id, item.id);
                                                const detail = await api.getNewFeeSchedule(selectedNewSchedule.id);
                                                setSelectedNewSchedule(detail.schedule || selectedNewSchedule);
                                                setSelectedNewScheduleItems(detail.items || []);
                                                const list = await api.getNewFeeSchedules({ includeInactive: true });
                                                setNewFeeSchedules(list.schedules || []);
                                                notify('Schedule item removed.');
                                              } catch (error: any) {
                                                setNewFeeError(error.message || 'Unable to remove schedule item.');
                                              } finally {
                                                setNewFeeBusy(false);
                                              }
                                            }}
                                            className="font-bold text-red-700 dark:text-red-400 disabled:opacity-50"
                                          >
                                            Remove
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                            {selectedNewScheduleItems.length === 0 && (
                              <tr><td colSpan={7} className="p-3 text-center text-slate-500">No items have been added to this schedule.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {financeSubView === 'admission_retries' && canManageAdmissionFeeActivations && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        Admission Fee Activation Monitor
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Review pending or failed fee activations. Retry each record individually after checking its status.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={admissionRetryBusy}
                      onClick={async () => {
                        setAdmissionRetryBusy(true);
                        setAdmissionRetryError('');
                        try {
                          const result = await api.getRetryableAdmissionFeeActivations(100);
                          setAdmissionRetryItems(result.items || []);
                        } catch (error) {
                          setAdmissionRetryError(
                            error instanceof Error ? error.message : 'Could not load admission fee activations.'
                          );
                        } finally {
                          setAdmissionRetryBusy(false);
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {admissionRetryBusy ? 'Loading...' : 'Refresh Activations'}
                    </button>
                  </div>

                  {admissionRetryError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      {admissionRetryError}
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="p-3">Application ID</th>
                          <th className="p-3">Student ID</th>
                          <th className="p-3">Programme</th>
                          <th className="p-3">Session / Level</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Attempts</th>
                          <th className="p-3">Last Error Code</th>
                          <th className="p-3">Last Activation</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admissionRetryItems.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-6 text-center text-slate-500">
                              No retryable admission fee activations loaded. Select Refresh Activations to check.
                            </td>
                          </tr>
                        ) : admissionRetryItems.map((item) => (
                          <tr key={item.applicationId} className="border-t border-slate-200 dark:border-slate-800">
                            <td className="p-3 font-mono">{item.applicationId}</td>
                            <td className="p-3 font-mono">{item.studentId}</td>
                            <td className="p-3">{item.programmeId}</td>
                            <td className="p-3">
                              <div>{item.academicSession}</div>
                              <div className="text-slate-500">{item.level}</div>
                            </td>
                            <td className="p-3">
                              <span className={`rounded px-2 py-1 font-bold ${
                                item.status === 'FAILED'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="p-3">{item.attempts}</td>
                            <td className="p-3">{item.lastError || '—'}</td>
                            <td className="p-3">
                              {item.activatedAt ? new Date(item.activatedAt).toLocaleString() : '—'}
                            </td>
                            <td className="p-3">
                              <button
                                type="button"
                                disabled={admissionRetryBusy || admissionRetryingId !== null}
                                onClick={async () => {
                                  setAdmissionRetryingId(item.applicationId);
                                  setAdmissionRetryError('');
                                  try {
                                    await api.retryAdmissionFeeActivation(item.applicationId);
                                    const refreshed = await api.getRetryableAdmissionFeeActivations(100);
                                    setAdmissionRetryItems(refreshed.items || []);
                                  } catch (error) {
                                    setAdmissionRetryError(
                                      error instanceof Error ? error.message : 'The activation retry did not complete.'
                                    );
                                  } finally {
                                    setAdmissionRetryingId(null);
                                  }
                                }}
                                className="rounded-lg bg-emerald-800 px-3 py-1.5 font-bold text-white disabled:opacity-50"
                              >
                                {admissionRetryingId === item.applicationId ? 'Retrying...' : 'Retry'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {financeSubView === 'schedules' && (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="p-3">Fee Title</th>
                        <th className="p-3">Programme</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Level</th>
                        <th className="p-3">Session</th>
                        <th className="p-3 text-right">Amount (₦)</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {feeSchedules
                        .filter((f) => matchesWildcard(financeQuery, f.title, f.category, f.level, f.amount))
                        .map((f) => (
                          <tr key={f.id}>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{f.title}</td>
                            <td className="p-3">{programmes.find((p) => p.id === f.programmeId)?.code || 'General'}</td>
                            <td className="p-3">{f.category}</td>
                            <td className="p-3">{f.level || 'All'}</td>
                            <td className="p-3">{f.session}</td>
                            <td className="p-3 text-right font-mono font-bold tabular-nums">
                              ₦{Number(f.amount).toLocaleString('en-NG')}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setEditingFeeId(f.id);
                                  setFeeForm({
                                    title: f.title,
                                    category: f.category,
                                    programmeId: f.programmeId || '',
                                    level: f.level || 'All',
                                    session: f.session,
                                    amount: f.amount,
                                  });
                                  setFeeModalOpen(true);
                                }}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {renderDeleteButton(`fee-${f.id}`, async () => {
                                await api.deleteFeeSchedule(f.id);
                                setConfirmDeleteKey(null);
                                notify('Fee schedule deleted.');
                                loadData();
                              })}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {financeSubView === 'invoices' && (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="p-3">Invoice No</th>
                        <th className="p-3">Student</th>
                        <th className="p-3">Title</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {invoices
                        .filter((inv) => {
                          const std = students.find((s) => s.id === inv.studentId);
                          return matchesWildcard(financeQuery, inv.invoiceNumber, inv.title, inv.status, std?.fullName, std?.matricNumber);
                        })
                        .map((inv) => {
                          const std = students.find((s) => s.id === inv.studentId);
                          return (
                            <tr key={inv.id}>
                              <td className="p-3 font-mono font-bold text-emerald-900 dark:text-emerald-400">
                                {inv.invoiceNumber}
                              </td>
                              <td className="p-3">
                                <div className="font-bold">{std?.fullName || inv.studentId}</div>
                                <div className="text-[11px] font-mono text-slate-500">{std?.matricNumber}</div>
                              </td>
                              <td className="p-3">{inv.title}</td>
                              <td className="p-3 text-right font-mono font-bold tabular-nums">
                                ₦{Number(inv.amount).toLocaleString('en-NG')}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    inv.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                              <td className="p-3 text-right whitespace-nowrap space-x-1">
                                {inv.status !== 'PAID' && (
                                  <button
                                    onClick={async () => {
                                      await api.updateInvoice(inv.id, { status: 'PAID', amountPaid: inv.amount });
                                      notify('Invoice marked as PAID.');
                                      loadData();
                                    }}
                                    className="px-2 py-1 bg-emerald-800 text-white rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                                {renderDeleteButton(`inv-${inv.id}`, async () => {
                                  await api.deleteInvoice(inv.id);
                                  setConfirmDeleteKey(null);
                                  notify('Invoice deleted.');
                                  loadData();
                                })}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {financeSubView === 'payments' && (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="p-3">Transaction Ref</th>
                        <th className="p-3">Student</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Channel</th>
                        <th className="p-3">Provider Ref</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {payments
                        .filter((p) => matchesWildcard(financeQuery, p.reference, p.providerReference, p.channel, p.studentId))
                        .map((p) => {
                          const std = students.find((s) => s.id === p.studentId);
                          return (
                            <tr key={p.id}>
                              <td className="p-3 font-mono font-bold text-emerald-900 dark:text-emerald-400">
                                {p.reference}
                              </td>
                              <td className="p-3">{std?.fullName || p.studentId}</td>
                              <td className="p-3 font-black tabular-nums">
                                ₦{Number(p.amount).toLocaleString('en-NG')}
                              </td>
                              <td className="p-3">{p.channel}</td>
                              <td className="p-3 font-mono text-slate-500">{p.providerReference}</td>
                              <td className="p-3">{new Date(p.paidAt).toLocaleDateString('en-GB')}</td>
                              <td className="p-3 text-right whitespace-nowrap space-x-1">
                                <button
                                  onClick={() => onOpenPrintModal('PAYMENT_RECEIPT', { ...p, student: std })}
                                  className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded font-semibold cursor-pointer"
                                >
                                  Receipt
                                </button>
                                {isSuperAdmin &&
                                  renderDeleteButton(`pay-${p.id}`, async () => {
                                    await api.deletePayment(p.id);
                                    setConfirmDeleteKey(null);
                                    notify('Payment transaction deleted.');
                                    loadData();
                                  })}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==================== 7. SUPER ADMIN GLOBAL CRUD HUB ==================== */}
          {activeSubTab === 'global_crud' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Super Admin Global Data Controller
                  </span>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Full Create / Read / Update / Delete Across All Collections
                  </h2>
                </div>
                {['users', 'students', 'schools', 'departments', 'programmes', 'courses', 'feeSchedules', 'invoices'].includes(
                  crudEntity
                ) && (
                  <button
                    onClick={openGlobalCrudCreate}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Create New {crudEntity}
                  </button>
                )}
              </div>

              {/* Entity Selector Pills */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['students', `Students (${students.length})`],
                    ['users', `Users (${usersList.length})`],
                    ['applications', `Applications (${applications.length})`],
                    ['schools', `Schools (${schools.length})`],
                    ['departments', `Departments (${departments.length})`],
                    ['programmes', `Programmes (${programmes.length})`],
                    ['courses', `Courses (${courses.length})`],
                    ['registrations', `Registrations (${registrations.length})`],
                    ['results', `Results (${results.length})`],
                    ['feeSchedules', `Fees (${feeSchedules.length})`],
                    ['invoices', `Invoices (${invoices.length})`],
                    ['documents', `Transcripts/Certs (${issuedDocs.length})`],
                    ['attendance', `Attendance (${attendance.length})`],
                    ['tickets', `Tickets (${tickets.length})`],
                  ] as Array<[CrudEntity, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCrudEntity(key);
                      setConfirmDeleteKey(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border transition ${
                      crudEntity === key
                        ? 'bg-emerald-900 text-amber-300 border-emerald-900'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <WildcardFilterBar
                query={crudQuery}
                onQueryChange={setCrudQuery}
                placeholder={`Wildcard search inside ${crudEntity} (supports * and ?)...`}
                filteredCount={crudRecords.length}
              />

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Primary Label</th>
                      <th className="p-3">Key Attributes</th>
                      <th className="p-3 text-right">CRUD Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {crudRecords.map((item) => {
                      const primary =
                        item.fullName ||
                        item.title ||
                        item.name ||
                        item.subject ||
                        item.invoiceNumber ||
                        item.documentNumber ||
                        item.applicationNumber ||
                        item.matricNumber ||
                        item.topic ||
                        item.id;
                      const secondary =
                        item.email ||
                        item.code ||
                        item.matricNumber ||
                        item.status ||
                        item.level ||
                        item.session ||
                        '';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-mono text-[11px] text-slate-500">{item.id}</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{primary}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 max-w-md truncate">
                            {secondary}{' '}
                            {item.role
                              ? `· ${item.role}`
                              : item.creditUnits
                              ? `· ${item.creditUnits} Units`
                              : item.amount !== undefined
                              ? `· ₦${Number(item.amount).toLocaleString('en-NG')}`
                              : item.totalScore !== undefined
                              ? `· ${item.totalScore} (${item.grade})`
                              : ''}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap space-x-1">
                            <button
                              onClick={() => openGlobalCrudEdit(item)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </button>
                            {renderDeleteButton(`crud-${crudEntity}-${item.id}`, () =>
                              handleGlobalCrudDelete(crudEntity, item.id)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== 8. USERS & RBAC ==================== */}
          {activeSubTab === 'users' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    User Account &amp; Role Management
                  </h2>
                  <p className="text-xs text-slate-500">
                    Provision institutional staff, update roles, lock/unlock accounts, or remove records.
                  </p>
                </div>

                <button
                  onClick={() => openUserModal()}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Provision New Account
                </button>
              </div>

              <WildcardFilterBar
                query={usersQuery}
                onQueryChange={setUsersQuery}
                placeholder="Wildcard filter users (e.g. *dean*, *@edocasti*)..."
                totalCount={usersList.length}
                filteredCount={filteredUsers.length}
                facets={[
                  {
                    key: 'role',
                    label: 'Role',
                    value: usersRoleFilter,
                    onChange: setUsersRoleFilter,
                    options: [
                      'SUPER_ADMIN',
                      'DEAN',
                      'HOD',
                      'EXAM_OFFICER',
                      'LECTURER',
                      'REGISTRAR',
                      'BURSAR',
                      'ADMISSIONS_OFFICER',
                      'RECTOR',
                      'STUDENT',
                      'APPLICANT',
                    ].map((r) => ({ value: r, label: r })),
                  },
                ]}
              />

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">{u.fullName}</td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{u.email}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-bold">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3">
                          {u.isLocked ? (
                            <span className="text-red-700 font-bold flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" /> Locked
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Active
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => openUserModal(u)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                            title="Edit User"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              await api.toggleUserStatus(u.id, { isLocked: !u.isLocked });
                              loadData();
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                          >
                            {u.isLocked ? (
                              <span className="inline-flex items-center gap-1">
                                <Unlock className="w-3 h-3" /> Unlock
                              </span>
                            ) : (
                              'Lock'
                            )}
                          </button>
                          {isSuperAdmin &&
                            u.id !== user?.id &&
                            renderDeleteButton(`usr-${u.id}`, async () => {
                              await api.deleteUser(u.id);
                              setConfirmDeleteKey(null);
                              notify('User deleted.');
                              loadData();
                            })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== 9. BRANDING, STAMP, SIGNATURES & ACADEMIC RULES ==================== */}
          {activeSubTab === 'settings' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Institutional Branding, Official Stamp, Signatures &amp; Rules
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Super Admin controls for institution logo, official school stamp, Registrar/Rector/Bursar signatures, document fees, and grading weights.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6 mt-6 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Institution Full Name
                    </label>
                    <input
                      type="text"
                      value={settingsForm.institutionName}
                      onChange={(e) => setSettingsForm({ ...settingsForm, institutionName: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Acronym / Short Name
                    </label>
                    <input
                      type="text"
                      value={settingsForm.shortName}
                      onChange={(e) => setSettingsForm({ ...settingsForm, shortName: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Current Academic Session
                    </label>
                    <input
                      type="text"
                      value={settingsForm.currentSession}
                      onChange={(e) => setSettingsForm({ ...settingsForm, currentSession: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Current Academic Period
                    </label>
                    <select
                      value={settingsForm.currentSemester}
                      onChange={(e) => setSettingsForm({ ...settingsForm, currentSemester: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                    >
                      <option value="First Semester">First Semester</option>
                      <option value="Second Semester">Second Semester</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      CA Maximum Mark
                    </label>
                    <input
                      type="number"
                      value={settingsForm.caMaxMarks}
                      onChange={(e) => setSettingsForm({ ...settingsForm, caMaxMarks: Number(e.target.value) })}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Exam Maximum Mark
                    </label>
                    <input
                      type="number"
                      value={settingsForm.examMaxMarks}
                      onChange={(e) => setSettingsForm({ ...settingsForm, examMaxMarks: Number(e.target.value) })}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Default Official Transcript Fee (₦)
                    </label>
                    <input
                      type="number"
                      value={settingsForm.transcriptFee}
                      onChange={(e) => setSettingsForm({ ...settingsForm, transcriptFee: Number(e.target.value) })}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Default Final Certificate Fee (₦)
                    </label>
                    <input
                      type="number"
                      value={settingsForm.certificateFee}
                      onChange={(e) => setSettingsForm({ ...settingsForm, certificateFee: Number(e.target.value) })}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Editable Images: Logo, School Stamp, Signatures */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Editable Institutional Logo, Official School Stamp &amp; Signatures
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(
                      [
                        ['logoUrl', 'Institution Official Logo'],
                        ['schoolStampUrl', 'Official School Stamp'],
                        ['registrarSignatureUrl', 'Registrar Signature'],
                        ['rectorSignatureUrl', 'Rector Signature'],
                        ['bursarSignatureUrl', 'Bursar Signature'],
                      ] as const
                    ).map(([field, label]) => (
                      <div
                        key={field}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-2.5"
                      >
                        <div className="font-bold text-slate-800 dark:text-slate-100">{label}</div>
                        <div className="h-20 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2">
                          {settingsForm[field] ? (
                            <img src={settingsForm[field]} alt={label} className="max-h-16 object-contain" />
                          ) : (
                            <span className="text-[11px] text-slate-400">Using default vector seal</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="px-2.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                            <Upload className="w-3 h-3" /> Upload PNG/JPG
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageSettingUpload(field, e.target.files?.[0])}
                              className="hidden"
                            />
                          </label>
                          {settingsForm[field] && (
                            <button
                              type="button"
                              onClick={() => setSettingsForm((prev) => ({ ...prev, [field]: '' }))}
                              className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-bold text-[11px] cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={settingsForm[field]}
                          onChange={(e) => setSettingsForm({ ...settingsForm, [field]: e.target.value })}
                          placeholder="Or paste image URL..."
                          className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.admissionsOpen}
                      onChange={(e) => setSettingsForm({ ...settingsForm, admissionsOpen: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Allow Online Admission Applications (Admissions Open)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.courseRegistrationOpen}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, courseRegistrationOpen: e.target.checked })
                      }
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Allow Online Student Course Registration
                    </span>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl cursor-pointer shadow-sm text-xs"
                  >
                    Save All Branding &amp; Rules
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ==================== 10. CMS ==================== */}
          {activeSubTab === 'cms' && <ContentManagementModule />}

          {/* ==================== 11. AUDIT TRAIL ==================== */}
          {activeSubTab === 'audit' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Security &amp; Operational Audit Trail
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tamper-resistant audit log capturing logins, grade submissions, document generation, and settings edits.
                  </p>
                </div>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold rounded-lg">
                  {filteredAuditLogs.length} Events
                </span>
              </div>

              <WildcardFilterBar
                query={auditQuery}
                onQueryChange={setAuditQuery}
                placeholder="Wildcard filter audit events (e.g. *TRANSCRIPT*, *dean*, RESULT_*)..."
                totalCount={auditLogs.length}
                filteredCount={filteredAuditLogs.length}
              />

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Actor / Email</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Resource</th>
                      <th className="p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-GB')}
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                          {log.userEmail || 'SYSTEM'}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{log.resource}</td>
                        <td className="p-3 text-slate-500 max-w-xs truncate" title={JSON.stringify(log.details)}>
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exam Officer: Student Course Registration Review */}
      {reviewRegistration && (() => {
        const reviewStudent = students.find((student) => student.id === reviewRegistration.studentId);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="registration-review-title">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Exam Officer · Gate 1</p>
                  <h2 id="registration-review-title" className="mt-1 text-lg font-black text-slate-900 dark:text-white">Registered Course Review</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{reviewStudent?.fullName || reviewRegistration.studentId}</p>
                  <p className="text-xs text-slate-500">{reviewStudent?.matricNumber || 'Matric number unavailable'} · {reviewRegistration.level} · {reviewRegistration.session} · {reviewRegistration.semester}</p>
                </div>
                <button type="button" onClick={() => setReviewRegistration(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Close course review">✕</button>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-100 text-[11px] uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="p-3">#</th><th className="p-3">Course code</th><th className="p-3">Course title</th><th className="p-3">Level</th><th className="p-3">Semester</th><th className="p-3 text-center">Units</th><th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {reviewRegistration.courseIds.map((courseId, index) => {
                      const course = courses.find((item) => item.id === courseId);
                      return (
                        <tr key={courseId}>
                          <td className="p-3 text-slate-500">{index + 1}</td>
                          <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-300">{course?.code || courseId}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">{course?.title || 'Course details unavailable'}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{course?.level || reviewRegistration.level}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{course?.semester || reviewRegistration.semester}</td>
                          <td className="p-3 text-center font-bold tabular-nums">{course?.creditUnits ?? '—'}</td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {reviewRegistration.status === 'SUBMITTED' && editingRegistrationCourseId === courseId ? (
                              <div className="flex min-w-[230px] items-center justify-end gap-2">
                                <select
                                  value={replacementRegistrationCourseId}
                                  onChange={(event) => setReplacementRegistrationCourseId(event.target.value)}
                                  disabled={registrationCourseBusy}
                                  className="max-w-[180px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                  aria-label={`Replace ${course?.code || courseId} with another course`}
                                >
                                  <option value="">Choose replacement</option>
                                  {courses
                                    .filter((item) =>
                                      item.id !== courseId &&
                                      !reviewRegistration.courseIds.includes(item.id) &&
                                      normalizeCourseLevel(item.level) === normalizeCourseLevel(reviewRegistration.level)
                                    )
                                    .sort((a, b) => {
                                      const aSameSemester = normalizeCourseSemester(a.semester) === normalizeCourseSemester(reviewRegistration.semester);
                                      const bSameSemester = normalizeCourseSemester(b.semester) === normalizeCourseSemester(reviewRegistration.semester);
                                      return Number(bSameSemester) - Number(aSameSemester) || a.code.localeCompare(b.code);
                                    })
                                    .map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.code} — {item.title} ({item.semester || 'Semester not set'})
                                      </option>
                                    ))}
                                </select>
                                <button type="button" onClick={handleSaveRegistrationCourse} disabled={registrationCourseBusy || !replacementRegistrationCourseId} className="rounded bg-emerald-700 px-2 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">Save</button>
                                <button type="button" onClick={() => { setEditingRegistrationCourseId(null); setReplacementRegistrationCourseId(''); }} disabled={registrationCourseBusy} className="rounded border border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-600 dark:border-slate-600 dark:text-slate-200">Cancel</button>
                              </div>
                            ) : reviewRegistration.status === 'SUBMITTED' ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => { setEditingRegistrationCourseId(courseId); setReplacementRegistrationCourseId(''); }}
                                  disabled={registrationCourseBusy}
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                                ><Edit className="h-3 w-3" /> Edit</button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRegistrationCourse(courseId)}
                                  disabled={registrationCourseBusy}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                                ><Trash2 className="h-3 w-3" /> Delete</button>
                              </div>
                            ) : <span className="text-[11px] text-slate-400">Locked</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800">
                    <tr><td colSpan={6} className="p-3 text-right font-bold text-slate-700 dark:text-slate-200">Total registered credits</td><td className="p-3 text-center font-black text-emerald-800 dark:text-emerald-300">{reviewRegistration.totalCredits}</td></tr>
                  </tfoot>
                </table>
              </div>

              {reviewRegistration.status === 'SUBMITTED' && courses.filter((item) =>
                !reviewRegistration.courseIds.includes(item.id) &&
                normalizeCourseLevel(item.level) === normalizeCourseLevel(reviewRegistration.level)
              ).length === 0 && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  No other courses are currently available for {reviewRegistration.level}. Add another course under Dean: Programmes &amp; Courses, then refresh this review to make it available as a replacement.
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{reviewRegistration.status}</span>
                <button type="button" onClick={() => setReviewRegistration(null)} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700">Close review</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== MODALS ==================== */}

      {/* Dean: Programme Modal */}
      {progModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {editingProgId ? 'Edit Academic Programme' : 'Dean: Create New Programme'}
              </h3>
              <button onClick={() => setProgModalOpen(false)} className="text-slate-400 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProgramme} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Department</label>
                <select
                  value={progForm.departmentId}
                  onChange={(e) => setProgForm({ ...progForm, departmentId: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Programme Code *</label>
                  <input
                    type="text"
                    required
                    value={progForm.code}
                    onChange={(e) => setProgForm({ ...progForm, code: e.target.value })}
                    placeholder="e.g. ND-CROP"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono uppercase bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Qualification</label>
                  <select
                    value={progForm.qualification}
                    onChange={(e) => setProgForm({ ...progForm, qualification: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="ND">ND</option>
                    <option value="HND">HND</option>
                    <option value="Certificate">Certificate</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1">Programme Name *</label>
                  <input
                    type="text"
                    required
                    value={progForm.name}
                    onChange={(e) => setProgForm({ ...progForm, name: e.target.value })}
                    placeholder="e.g. ND Crop Production Technology"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Duration (Yrs)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={progForm.durationYears}
                    onChange={(e) => setProgForm({ ...progForm, durationYears: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={progForm.description}
                  onChange={(e) => setProgForm({ ...progForm, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Entry Requirements (1 per line)</label>
                <textarea
                  rows={2}
                  value={progForm.requirementsText}
                  onChange={(e) => setProgForm({ ...progForm, requirementsText: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setProgModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  {editingProgId ? 'Save Changes' : 'Create Programme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dean: Course Modal */}
      {courseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {editingCourseId ? 'Edit Academic Course' : 'Dean: Create New Course'}
              </h3>
              <button onClick={() => setCourseModalOpen(false)} className="text-slate-400 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveCourse} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Course Code *</label>
                  <input
                    type="text"
                    required
                    value={courseForm.code}
                    onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                    placeholder="e.g. AGT 114"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono uppercase bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Credit Units *</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    required
                    value={courseForm.creditUnits}
                    onChange={(e) => setCourseForm({ ...courseForm, creditUnits: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Course Title *</label>
                <input
                  type="text"
                  required
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  placeholder="e.g. Introduction to Crop Protection"
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Department</label>
                  <select
                    value={courseForm.departmentId}
                    onChange={(e) => setCourseForm({ ...courseForm, departmentId: e.target.value })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Programme (Optional)</label>
                  <select
                    value={courseForm.programmeId}
                    onChange={(e) => setCourseForm({ ...courseForm, programmeId: e.target.value })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="">All Dept Programmes</option>
                    {programmes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Level</label>
                  <select
                    value={courseForm.level}
                    onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="ND I">ND I</option>
                    <option value="ND II">ND II</option>
                    <option value="HND I">HND I</option>
                    <option value="HND II">HND II</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Semester</label>
                  <select
                    value={courseForm.semester}
                    onChange={(e) => setCourseForm({ ...courseForm, semester: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="First Semester">First Semester</option>
                    <option value="Second Semester">Second Semester</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCourseModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  {editingCourseId ? 'Save Course' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Create/Edit Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {editingUserId ? 'Edit Institutional User' : 'Provision New Institutional Account'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Full Name &amp; Title *</label>
                <input
                  type="text"
                  required
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              {!editingUserId && (
                <>
                  <div>
                    <label className="block font-semibold mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Initial Password *</label>
                    <input
                      type="password"
                      required
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block font-semibold mb-1">Role *</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="LECTURER">LECTURER</option>
                  <option value="HOD">HOD</option>
                  <option value="DEAN">DEAN (Dean of Academics)</option>
                  <option value="EXAM_OFFICER">EXAM_OFFICER</option>
                  <option value="REGISTRAR">REGISTRAR</option>
                  <option value="BURSAR">BURSAR</option>
                  <option value="ADMISSIONS_OFFICER">ADMISSIONS_OFFICER</option>
                  <option value="RECTOR">RECTOR</option>
                  <option value="INSTITUTION_ADMIN">INSTITUTION_ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="STUDENT">STUDENT</option>
                  <option value="APPLICANT">APPLICANT</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  {editingUserId ? 'Update User' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fee Modal */}
      {feeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {editingFeeId ? 'Edit Fee Schedule Item' : 'Add Fee Schedule Item'}
              </h3>
              <button onClick={() => setFeeModalOpen(false)} className="text-slate-400 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveFee} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Fee Title *</label>
                <input
                  type="text"
                  required
                  value={feeForm.title}
                  onChange={(e) => setFeeForm({ ...feeForm, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Amount (₦) *</label>
                  <input
                    type="number"
                    required
                    value={feeForm.amount}
                    onChange={(e) => setFeeForm({ ...feeForm, amount: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Category *</label>
                  <select
                    required
                    value={feeForm.category}
                    onChange={(e) => setFeeForm({ ...feeForm, category: e.target.value })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="Tuition">Tuition</option>
                    <option value="Acceptance">Acceptance</option>
                    <option value="Registration">Registration</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Hostel">Hostel</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
                            <div>
                <label className="block font-semibold mb-1">Programme (optional)</label>
                <select
                  value={feeForm.programmeId}
                  onChange={(e) => setFeeForm({ ...feeForm, programmeId: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="">All programmes (general fee)</option>
                  {programmes.map((programme) => (
                    <option key={programme.id} value={programme.id}>
                      {programme.code} — {programme.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Academic Level *</label>
                  <select
                    required
                    value={feeForm.level}
                    onChange={(e) => setFeeForm({ ...feeForm, level: e.target.value })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="ND I">ND I</option>
                    <option value="ND II">ND II</option>
                    <option value="HND I">HND I</option>
                    <option value="HND II">HND II</option>
                    <option value="Certificate I">Certificate I</option>
                    <option value="All">All Levels</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Academic Session *</label>
                  <input
                    type="text"
                    required
                    value={feeForm.session}
                    onChange={(e) => setFeeForm({ ...feeForm, session: e.target.value })}
                    placeholder="2025/2026"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
<div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFeeModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-800 text-white font-bold rounded-lg cursor-pointer">
                  Save Fee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Issue Student Invoice</h3>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-slate-400 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Student *</label>
                <select
                  required
                  value={invoiceForm.studentId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.matricNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Invoice Description *</label>
                <input
                  type="text"
                  required
                  value={invoiceForm.title}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, title: e.target.value })}
                  placeholder="e.g. Field Practicum & Laboratory Levy"
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Amount (₦) *</label>
                  <input
                    type="number"
                    required
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Due Date</label>
                  <input
                    type="text"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-800 text-white font-bold rounded-lg cursor-pointer">
                  Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Generic CRUD Create/Edit Modal */}
      {crudModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl my-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm capitalize">
                {crudMode === 'create' ? `Create New ${crudEntity}` : `Edit ${crudEntity} Record`}
              </h3>
              <button onClick={() => setCrudModalOpen(false)} className="text-slate-400 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleGlobalCrudSave} className="space-y-3 text-xs max-h-[65vh] overflow-y-auto pr-1">
              {Object.entries(crudDraft)
                .filter(([key, val]) => key !== 'id' && typeof val !== 'object')
                .map(([key, val]) => (
                  <div key={key}>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {key}
                    </label>
                    {typeof val === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setCrudDraft({ ...crudDraft, [key]: e.target.checked })}
                        className="w-4 h-4 text-emerald-700 rounded"
                      />
                    ) : typeof val === 'number' ? (
                      <input
                        type="number"
                        step="any"
                        value={val}
                        onChange={(e) => setCrudDraft({ ...crudDraft, [key]: Number(e.target.value) })}
                        className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(val ?? '')}
                        onChange={(e) => setCrudDraft({ ...crudDraft, [key]: e.target.value })}
                        className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                      />
                    )}
                  </div>
                ))}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCrudModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save {crudEntity}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};



