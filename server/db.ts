import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Tests may point the JSON store at a disposable synthetic fixture. The
// default path remains unchanged for normal application runs.
const DB_FILE = process.env.EDOCASTI_DATA_FILE
  ? path.resolve(process.env.EDOCASTI_DATA_FILE)
  : path.resolve(process.cwd(), 'data', 'edocasti_db.json');
const DATA_DIR = path.dirname(DB_FILE);
const STAGING_DEMO_ONLY = process.env.EDOCASTI_STAGING_DEMO_ONLY === 'true';
const STAGING_RENDER_SERVICE_ID = 'srv-dc2cgr142hec73feeqg0';
const STAGING_INIT_MARKER = `${DB_FILE}.staging-demo-only-initialized`;
const STAGING_QUICK_ACCESS_EMAILS = new Set([
  'superadmin@edocasti.edu.ng',
  'dean@edocasti.edu.ng',
  'hod.agric@edocasti.edu.ng',
  'examofficer@edocasti.edu.ng',
  'lecturer.agric@edocasti.edu.ng',
  'registrar@edocasti.edu.ng',
  'bursar@edocasti.edu.ng',
  'admissions@edocasti.edu.ng',
  'student.agric@edocasti.edu.ng',
  'applicant.jerry@gmail.com',
]);

export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ipAddress?: string;
}

export interface InstitutionSettings {
  id: string;
  institutionName: string;
  shortName: string;
  motto: string;
  state: string;
  country: string;
  currentSession: string;
  currentSemester: string;
  admissionsOpen: boolean;
  courseRegistrationOpen: boolean;
  feePaymentRequiredForReg: boolean;
  contactEmail: string;
  contactPhone: string;
  address: string;
  caMaxMarks: number;
  examMaxMarks: number;
  logoUrl?: string;
  registrarSignatureUrl?: string;
  rectorSignatureUrl?: string;
  bursarSignatureUrl?: string;
  schoolStampUrl?: string;
  transcriptFee?: number;
  certificateFee?: number;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  phone?: string;
  photoUrl?: string;
  isActive: boolean;
  isLocked: boolean;
  failedLoginAttempts: number;
  departmentId?: string;
  schoolId?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface School {
  id: string;
  code: string;
  name: string;
  deanId?: string;
  description: string;
  imageUrl?: string;
}

export interface Department {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  hodId?: string;
}

export interface Programme {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  qualification: 'ND' | 'HND' | 'Certificate';
  durationYears: number;
  description: string;
  requirements: string[];
}

export interface Course {
  id: string;
  departmentId: string;
  programmeId?: string;
  code: string;
  title: string;
  creditUnits: number;
  level: string; // "ND I", "ND II", "HND I", "HND II"
  semester: 'First Semester' | 'Second Semester';
  lecturerId?: string;
  lecturerName?: string;
  isCompulsory: boolean;
}

export interface AdmissionApplication {
  id: string;
  applicationNumber: string;
  userId: string;
  programmeId: string;
  session: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  gender: string;
  dob: string;
  phone: string;
  email: string;
  photoUrl?: string;
  stateOfOrigin: string;
  lga: string;
  residentialAddress: string;
  oLevelResults: Array<{ subject: string; grade: string; examNumber: string; examType: string }>;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'OFFERED' | 'ACCEPTED' | 'REJECTED';
  screeningNotes?: string;
  reviewedBy?: string;
  submittedAt?: string;
  decisionAt?: string;
  feeActivationRequiredAt?: string;
}

export interface Student {
  id: string;
  matricNumber: string;
  userId: string;
  photoUrl?: string;
  programmeId: string;
  departmentId: string;
  schoolId: string;
  level: string;
  sessionAdmitted: string;
  academicStatus: 'Good Standing' | 'Probation' | 'Suspended' | 'Graduated';
  gender: string;
  dob: string;
  emergencyContact: string;
  nextOfKin: string;
  cgpa: number;
  totalCreditsEarned: number;
}

export interface CourseRegistration {
  id: string;
  studentId: string;
  session: string;
  semester: string;
  level: string;
  courseIds: string[];
  totalCredits: number;
  status: 'SUBMITTED' | 'APPROVED_BY_EXAM_OFFICER' | 'APPROVED_BY_HOD' | 'REJECTED';
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface AssessmentResult {
  id: string;
  courseId: string;
  studentId: string;
  matricNumber: string;
  studentName: string;
  session: string;
  semester: string;
  caScore: number; // 0-30 or 0-40
  examScore: number; // 0-70 or 0-60
  totalScore: number;
  grade: string;
  gradePoint: number;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'APPROVED' | 'PUBLISHED';
  submittedBy?: string;
  verifiedBy?: string;
  approvedBy?: string;
  publishedAt?: string;
}

export interface FeeSchedule {
  id: string;
  programmeId?: string; // null for general
  level?: string;
  session: string;
  title: string;
  category: 'Tuition' | 'Acceptance' | 'Registration' | 'Laboratory' | 'Hostel' | 'Other';
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  session: string;
  title: string;
  amount: number;
  amountPaid: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  dueDate: string;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  reference: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  channel: 'Remita' | 'Bank Transfer' | 'Interswitch' | 'Card';
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  providerReference: string;
  paidAt: string;
  verifiedBy?: string;
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  lecturerId: string;
  date: string;
  type: 'Lecture' | 'Laboratory' | 'Field Practical' | 'Workshop';
  topic: string;
  records: Array<{ studentId: string; matricNumber: string; studentName: string; isPresent: boolean }>;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: 'Admissions' | 'Course Registration' | 'Bursary & Payments' | 'Results' | 'Hostel' | 'ICT Support';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  messages: Array<{ sender: string; role: string; message: string; timestamp: string }>;
  createdAt: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: 'Admissions' | 'Academics' | 'Research & Farm' | 'Campus Life' | 'Notice';
  imageUrl?: string;
  isFeaturedInSlider: boolean;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  author: string;
  publishedAt: string;
  views: number;
}

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  bgGradient: string;
  accentColor: string;
  bgColor?: string;
  bgSecondaryColor?: string;
  textColor?: string;
  subtitleColor?: string;
  accentHex?: string;
  ctaBgColor?: string;
  ctaTextColor?: string;
  secondaryBtnBgColor?: string;
  secondaryBtnTextColor?: string;
  footerBarBgColor?: string;
  imageUrl?: string;
  ctaText: string;
  ctaTab: string;
  ctaSubSection: string;
  iconName: string;
  order: number;
  isActive: boolean;
}

export interface CalendarHighlight {
  id: string;
  title: string;
  description: string;
  statusLabel: string;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export interface CustomPageSection {
  id: string;
  kicker: string;
  title: string;
  body: string;
  ctaText: string;
  ctaTab: string;
  imageUrl?: string;
  style: 'light' | 'emerald' | 'dark';
  isVisible: boolean;
}

export interface PageContent {
  portalBannerText: string;
  portalBadgeText: string;
  newsSectionKicker: string;
  newsSectionHeading: string;
  rectorName: string;
  rectorTitle: string;
  rectorInstitution: string;
  rectorKicker: string;
  rectorHeadline: string;
  rectorParagraph1: string;
  rectorParagraph2: string;
  rectorCtaText: string;
  rectorAvatarEmoji: string;
  rectorPhotoUrl?: string;
  schoolsSectionKicker: string;
  schoolsSectionHeading: string;
  schoolsSectionSubheading: string;
  calendarSectionKicker: string;
  calendarSectionHeading: string;
  calendarItems: CalendarHighlight[];
  faqSectionKicker: string;
  faqSectionHeading: string;
  faqs: FaqItem[];
  footerBrandTitle: string;
  footerBrandSubtitle: string;
  footerDescription: string;
  footerLocationHeading: string;
  footerLocationAddress: string;
  footerContactHeading: string;
  sectionOrder: string[];
  hiddenSections: string[];
  customSections: CustomPageSection[];
}

export interface IssuedDocument {
  id: string;
  studentId: string;
  matricNumber: string;
  studentName: string;
  programmeName: string;
  departmentName?: string;
  schoolName?: string;
  level?: string;
  photoUrl?: string;
  type: 'TRANSCRIPT' | 'FINAL_CERTIFICATE';
  documentNumber: string;
  title: string;
  session: string;
  cgpa: number;
  classification: string;
  remarks?: string;
  feeAmount: number;
  invoiceId: string;
  generatedBy: string;
  generatedAt: string;
}

// ==================== FEE MANAGEMENT ENHANCEMENT (additive) ====================

export interface FeeCatalogItem {
  id: string;
  name: string;
  amount: number;
  feeType: 'ONE_TIME' | 'PER_SESSION';
  category: 'COMPULSORY' | 'OPTIONAL';
  isActive: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramFeeSchedule {
  id: string;
  programmeId: string;
  session: string;
  level: string;
  status: 'DRAFT' | 'PUBLISHED';
  isActive: boolean;
  createdAt: string;
  publishedAt?: string;
  createdBy: string;
}

export interface ProgramFeeScheduleItem {
  id: string;
  scheduleId: string;
  feeCatalogItemId: string;
  amountOverride?: number;
  feeNameSnapshot: string;
  feeCategorySnapshot: 'COMPULSORY' | 'OPTIONAL';
  feeTypeSnapshot: 'ONE_TIME' | 'PER_SESSION';
}

export interface StudentFeeObligation {
  id: string;
  studentId: string;
  programmeId: string;
  session: string;
  level: string;
  feeCatalogItemId: string;
  feeNameSnapshot: string;
  feeCategorySnapshot: 'COMPULSORY' | 'OPTIONAL';
  feeTypeSnapshot: 'ONE_TIME' | 'PER_SESSION';
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  dueDate?: string;
  source: 'ADMISSION' | 'NEW_SESSION';
  generatedAt: string;
}

export interface StudentPayment {
  id: string;
  receiptNumber: string;
  studentId: string;
  amount: number;
  method: string;
  recordedBy: string;
  recordedAt: string;
  notes?: string;
  session?: string;
}

export interface StudentPaymentAllocation {
  id: string;
  paymentId: string;
  obligationId: string;
  feeCatalogItemId: string;
  feeNameSnapshot: string;
  feeCategorySnapshot: 'COMPULSORY' | 'OPTIONAL';
  amountAllocated: number;
}

// ==================== END FEE MANAGEMENT ENHANCEMENT ====================
export interface DatabaseState {
  settings: InstitutionSettings;
  users: User[];
  schools: School[];
  departments: Department[];
  programmes: Programme[];
  courses: Course[];
  applications: AdmissionApplication[];
  students: Student[];
  registrations: CourseRegistration[];
  results: AssessmentResult[];
  feeSchedules: FeeSchedule[];
  invoices: Invoice[];
  payments: PaymentTransaction[];
  attendance: AttendanceSession[];
  supportTickets: SupportTicket[];
  auditLogs: AuditLog[];
  newsArticles: NewsArticle[];
  // Fee Management Enhancement (additive, optional for backward compatibility)
  feeCatalogItems?: FeeCatalogItem[];
  programFeeSchedules?: ProgramFeeSchedule[];
  programFeeScheduleItems?: ProgramFeeScheduleItem[];
  studentFeeObligations?: StudentFeeObligation[];
  studentPayments?: StudentPayment[];
  studentPaymentAllocations?: StudentPaymentAllocation[];  sliderSlides: HeroSlide[];
  pageContent: PageContent;
  issuedDocuments: IssuedDocument[];
}

function computeGradeAndPoints(total: number): { grade: string; gradePoint: number } {
  if (total >= 70) return { grade: 'A', gradePoint: 5.0 };
  if (total >= 60) return { grade: 'B', gradePoint: 4.0 };
  if (total >= 50) return { grade: 'C', gradePoint: 3.0 };
  if (total >= 45) return { grade: 'D', gradePoint: 2.0 };
  if (total >= 40) return { grade: 'E', gradePoint: 1.0 };
  return { grade: 'F', gradePoint: 0.0 };
}

export class DatabaseEngine {
  private state: DatabaseState;

  constructor() {
    if (STAGING_DEMO_ONLY) {
      const expectedDataFile = path.resolve(process.cwd(), 'data', 'edocasti_db.json');
      const serviceGuardPassed = process.env.RENDER_SERVICE_ID === STAGING_RENDER_SERVICE_ID;
      const dataFileGuardPassed = path.resolve(process.env.EDOCASTI_DATA_FILE || '') === expectedDataFile;
      console.log('[EDOCASTI] staging guard checks', {
        serviceGuardPassed,
        dataFileGuardPassed,
        dataFileConfigured: Boolean(process.env.EDOCASTI_DATA_FILE),
      });
      if (!serviceGuardPassed || !dataFileGuardPassed) {
        throw new Error('Staging demo-only mode is restricted to the dedicated Ecasti staging service and its isolated data file.');
      }
    }
    this.ensureDataDir();
    try {
      this.state = this.loadDatabase();
    } catch (err) {
      if (STAGING_DEMO_ONLY) {
        console.error('[EDOCASTI] staging-only database initialization failed:', err instanceof Error ? err.message : 'unknown error');
      }
      throw err;
    }
  }

  private loadStagingDemoOnlyDatabase(): DatabaseState {
    // Once initialized, preserve data created by staging E2E tests. The marker
    // is written only after the first isolated demo-only reset succeeds.
    if (fs.existsSync(STAGING_INIT_MARKER) && fs.existsSync(DB_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as DatabaseState;
      } catch (err) {
        console.error('Staging demo-only database could not be read; rebuilding the isolated demo baseline.', err);
      }
    }

    let existing: Partial<DatabaseState> = {};
    if (fs.existsSync(DB_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as Partial<DatabaseState>;
      } catch {
        // The dedicated staging file is disposable; rebuild from source fixtures.
      }
    }

    const seed = this.generateSeedData();
    const usersByEmail = new Map<string, User>();
    for (const user of seed.users) {
      const email = user.email.toLowerCase();
      if (STAGING_QUICK_ACCESS_EMAILS.has(email)) usersByEmail.set(email, user);
    }
    if (Array.isArray(existing.users)) {
      for (const user of existing.users) {
        if (user && typeof user.email === 'string') {
          const email = user.email.toLowerCase();
          if (STAGING_QUICK_ACCESS_EMAILS.has(email)) usersByEmail.set(email, user);
        }
      }
    }

    const emptyPageContent: PageContent = {
      portalBannerText: '',
      portalBadgeText: '',
      newsSectionKicker: '',
      newsSectionHeading: '',
      rectorName: '',
      rectorTitle: '',
      rectorInstitution: '',
      rectorKicker: '',
      rectorHeadline: '',
      rectorParagraph1: '',
      rectorParagraph2: '',
      rectorCtaText: '',
      rectorAvatarEmoji: '',
      schoolsSectionKicker: '',
      schoolsSectionHeading: '',
      schoolsSectionSubheading: '',
      calendarSectionKicker: '',
      calendarSectionHeading: '',
      calendarItems: [],
      faqSectionKicker: '',
      faqSectionHeading: '',
      faqs: [],
      footerBrandTitle: '',
      footerBrandSubtitle: '',
      footerDescription: '',
      footerLocationHeading: '',
      footerLocationAddress: '',
      footerContactHeading: '',
      sectionOrder: [],
      hiddenSections: [],
      customSections: [],
    };

    const state: DatabaseState = {
      settings: existing.settings || seed.settings,
      users: Array.from(usersByEmail.values()),
      schools: [],
      departments: [],
      programmes: [],
      courses: [],
      applications: [],
      students: [],
      registrations: [],
      results: [],
      feeSchedules: [],
      invoices: [],
      payments: [],
      attendance: [],
      supportTickets: [],
      auditLogs: [],
      newsArticles: [],
      feeCatalogItems: [],
      programFeeSchedules: [],
      programFeeScheduleItems: [],
      studentFeeObligations: [],
      studentPayments: [],
      studentPaymentAllocations: [],
      sliderSlides: [],
      pageContent: emptyPageContent,
      issuedDocuments: [],
    };

    this.saveState(state);
    fs.writeFileSync(STAGING_INIT_MARKER, new Date().toISOString(), 'utf-8');
    return state;
  }

  private loadDatabase(): DatabaseState {
    if (STAGING_DEMO_ONLY) return this.loadStagingDemoOnlyDatabase();
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        let dirty = false;
        if (!parsed.newsArticles || !parsed.sliderSlides || !parsed.pageContent) {
          const fresh = this.generateSeedData();
          parsed.newsArticles = parsed.newsArticles || fresh.newsArticles;
          parsed.sliderSlides = parsed.sliderSlides || fresh.sliderSlides;
          parsed.pageContent = parsed.pageContent || fresh.pageContent;
          dirty = true;
        }
        // Ensure all 4 schools have departments & programmes seeded if absent
        const freshForAcademics = this.generateSeedData();
        if (parsed.departments && !parsed.departments.some((d: Department) => d.schoolId === 'sch-eng')) {
          for (const dept of freshForAcademics.departments) {
            if (!parsed.departments.some((d: Department) => d.id === dept.id)) {
              parsed.departments.push(dept);
              dirty = true;
            }
          }
        }
        if (parsed.programmes) {
          for (const prog of freshForAcademics.programmes) {
            if (!parsed.programmes.some((p: Programme) => p.id === prog.id)) {
              parsed.programmes.push(prog);
              dirty = true;
            }
          }
        }
        // Ensure Dean of Academics and Exam Officer users exist on existing DBs
        if (parsed.users) {
          for (const u of freshForAcademics.users) {
            if (!parsed.users.some((eu: User) => eu.email === u.email)) {
              parsed.users.push(u);
              dirty = true;
            }
          }
        }
        if (!parsed.issuedDocuments) {
          parsed.issuedDocuments = freshForAcademics.issuedDocuments;
          dirty = true;
        }
        // --- Fee Management Enhancement (additive, non-destructive) ---
        if (!parsed.feeCatalogItems)           { parsed.feeCatalogItems = []; dirty = true; }
        if (!parsed.programFeeSchedules)       { parsed.programFeeSchedules = []; dirty = true; }
        if (!parsed.programFeeScheduleItems)   { parsed.programFeeScheduleItems = []; dirty = true; }
        if (!parsed.studentFeeObligations)     { parsed.studentFeeObligations = []; dirty = true; }
        if (!parsed.studentPayments)           { parsed.studentPayments = []; dirty = true; }
        if (!parsed.studentPaymentAllocations) { parsed.studentPaymentAllocations = []; dirty = true; }
        // --- End fee enhancement ---
        if (parsed.settings) {
          if (parsed.settings.transcriptFee === undefined) {
            parsed.settings.transcriptFee = 10000;
            dirty = true;
          }
          if (parsed.settings.certificateFee === undefined) {
            parsed.settings.certificateFee = 25000;
            dirty = true;
          }
        }
        if (dirty) {
          this.saveState(parsed);
        }
        return parsed;
      } catch (err) {
        console.error('Failed to read db file, creating fresh seed...', err);
      }
    }
    const seed = this.generateSeedData();
    this.saveState(seed);
    return seed;
  }

  public saveState(customState?: DatabaseState) {
    this.ensureDataDir();
    const toSave = customState || this.state;
    fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    const entry: AuditLog = {
      id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.state.auditLogs.unshift(entry);
    if (this.state.auditLogs.length > 2000) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 2000);
    }
    this.saveState();
    return entry;
  }

  public generateSeedData(): DatabaseState {
    const passwordHash = bcrypt.hashSync('Password123!', 10);

    const settings: InstitutionSettings = {
      id: 'default',
      institutionName: 'Edo State College of Agriculture, Science and Technology, Iguoriakhi',
      shortName: 'EDOCASTI',
      motto: 'Excellence in Agriculture, Science & Technology',
      state: 'Edo State',
      country: 'Nigeria',
      currentSession: '2025/2026',
      currentSemester: 'First Semester',
      admissionsOpen: true,
      courseRegistrationOpen: true,
      feePaymentRequiredForReg: true,
      contactEmail: 'info@edocasti.edu.ng',
      contactPhone: '+234 803 000 1234',
      address: 'Iguoriakhi Campus, Benin-Lagos Expressway, Edo State, Nigeria',
      caMaxMarks: 40,
      examMaxMarks: 60,
      transcriptFee: 10000,
      certificateFee: 25000,
    };

    const schools: School[] = [
      {
        id: 'sch-agric',
        code: 'SAGR',
        name: 'School of Agricultural Technology',
        description: 'Pioneering agricultural mechanization, agronomy, livestock and crop breeding.',
      },
      {
        id: 'sch-applied',
        code: 'SAPS',
        name: 'School of Applied Sciences & Technology, Iguoriakhi',
        description: 'Advanced laboratories in computing, laboratory science, and biotechnology.',
      },
      {
        id: 'sch-eng',
        code: 'SENG',
        name: 'School of Engineering & Bio-Environmental Technology',
        description: 'Sustainable irrigation, soil conservation, bio-environmental, and agro-processing engineering.',
      },
      {
        id: 'sch-bus',
        code: 'SBMS',
        name: 'School of Business & Management Studies',
        description: 'Agribusiness, cooperative management, and rural enterprise development.',
      },
    ];

    const departments: Department[] = [
      { id: 'dept-agric', schoolId: 'sch-agric', code: 'AGT', name: 'Agricultural Technology & Agronomy' },
      { id: 'dept-animal', schoolId: 'sch-agric', code: 'AHP', name: 'Animal Health & Production Technology' },
      { id: 'dept-fish', schoolId: 'sch-agric', code: 'FIS', name: 'Fisheries & Aquaculture Technology' },
      { id: 'dept-cs', schoolId: 'sch-applied', code: 'COM', name: 'Computer Science & Software Systems' },
      { id: 'dept-slt', schoolId: 'sch-applied', code: 'SLT', name: 'Science Laboratory Technology (SLT)' },
      { id: 'dept-food', schoolId: 'sch-applied', code: 'FST', name: 'Food Science & Technology' },
      { id: 'dept-eng', schoolId: 'sch-eng', code: 'ABE', name: 'Agricultural & Bio-Environmental Engineering' },
      { id: 'dept-mech', schoolId: 'sch-eng', code: 'FMI', name: 'Farm Mechanization & Irrigation Technology' },
      { id: 'dept-coop', schoolId: 'sch-bus', code: 'CEM', name: 'Cooperative Economics & Management' },
      { id: 'dept-agribus', schoolId: 'sch-bus', code: 'ABM', name: 'Agribusiness Management' },
    ];

    const programmes: Programme[] = [
      {
        id: 'prog-nd-agric',
        departmentId: 'dept-agric',
        code: 'ND-AGT',
        name: 'National Diploma in Agricultural Technology',
        qualification: 'ND',
        durationYears: 2,
        description: 'Comprehensive practical training in modern mechanized farming, soil science, and crop production.',
        requirements: ['5 O-level credits including English, Mathematics, Chemistry, Agricultural Science or Biology'],
      },
      {
        id: 'prog-hnd-agric',
        departmentId: 'dept-agric',
        code: 'HND-AGT',
        name: 'Higher National Diploma in Agricultural Technology',
        qualification: 'HND',
        durationYears: 2,
        description: 'Advanced agronomy, agribusiness project execution, farm mechanization management.',
        requirements: ['National Diploma in Agricultural Technology with minimum Lower Credit and 1 year SIWES'],
      },
      {
        id: 'prog-nd-cs',
        departmentId: 'dept-cs',
        code: 'ND-COM',
        name: 'National Diploma in Computer Science',
        qualification: 'ND',
        durationYears: 2,
        description: 'Programming, web systems, database design, computer hardware, and agro-informatics.',
        requirements: ['5 O-level credits including English, Mathematics, Physics, and two other science subjects'],
      },
      {
        id: 'prog-hnd-cs',
        departmentId: 'dept-cs',
        code: 'HND-COM',
        name: 'Higher National Diploma in Computer Science',
        qualification: 'HND',
        durationYears: 2,
        description: 'Software engineering, systems architecture, cloud computing, and AI data systems.',
        requirements: ['ND in Computer Science with minimum Lower Credit and 1 year industrial experience'],
      },
      {
        id: 'prog-nd-slt',
        departmentId: 'dept-slt',
        code: 'ND-SLT',
        name: 'National Diploma in Science Laboratory Technology',
        qualification: 'ND',
        durationYears: 2,
        description: 'Applied biochemistry, analytical chemistry, microbiological techniques, instrumentation.',
        requirements: ['5 O-level credits including English, Mathematics, Biology, Chemistry, and Physics'],
      },
      {
        id: 'prog-nd-fst',
        departmentId: 'dept-food',
        code: 'ND-FST',
        name: 'National Diploma in Food Science and Technology',
        qualification: 'ND',
        durationYears: 2,
        description: 'Food processing, quality assurance, preservation biotechnology, and post-harvest engineering.',
        requirements: ['5 O-level credits including English, Mathematics, Chemistry, Biology or Agricultural Science'],
      },
      {
        id: 'prog-nd-animal',
        departmentId: 'dept-animal',
        code: 'ND-AHP',
        name: 'National Diploma in Animal Health and Production',
        qualification: 'ND',
        durationYears: 2,
        description: 'Livestock management, veterinary hygiene, ruminant and poultry nutrition, breeding.',
        requirements: ['5 O-level credits including English, Mathematics, Biology or Agricultural Science, Chemistry'],
      },
      {
        id: 'prog-nd-fish',
        departmentId: 'dept-fish',
        code: 'ND-FIS',
        name: 'National Diploma in Fisheries Technology',
        qualification: 'ND',
        durationYears: 2,
        description: 'Hatchery operations, fish feed formulation, pond management, and aquatic biology.',
        requirements: ['5 O-level credits including English, Mathematics, Biology or Agricultural Science, Chemistry'],
      },
      {
        id: 'prog-nd-eng',
        departmentId: 'dept-eng',
        code: 'ND-ABE',
        name: 'National Diploma in Agricultural & Bio-Environmental Engineering',
        qualification: 'ND',
        durationYears: 2,
        description: 'Irrigation architecture, tractor maintenance, bio-energy systems, and soil conservation infrastructure.',
        requirements: ['5 O-level credits including English, Mathematics, Physics, Chemistry, and Biology/Agric'],
      },
      {
        id: 'prog-nd-mech',
        departmentId: 'dept-mech',
        code: 'ND-FMI',
        name: 'National Diploma in Farm Mechanization & Irrigation Technology',
        qualification: 'ND',
        durationYears: 2,
        description: 'Precision tillage machinery, drip irrigation systems, and mechanized post-harvest equipment.',
        requirements: ['5 O-level credits including English, Mathematics, Physics, and Technical Drawing/Agric'],
      },
      {
        id: 'prog-nd-coop',
        departmentId: 'dept-coop',
        code: 'ND-CEM',
        name: 'National Diploma in Cooperative Economics & Management',
        qualification: 'ND',
        durationYears: 2,
        description: 'Agricultural value chain finance, rural cooperatives, microcredit, and enterprise governance.',
        requirements: ['5 O-level credits including English, Mathematics, Economics, and two relevant subjects'],
      },
      {
        id: 'prog-nd-agribus',
        departmentId: 'dept-agribus',
        code: 'ND-ABM',
        name: 'National Diploma in Agribusiness Management',
        qualification: 'ND',
        durationYears: 2,
        description: 'Agricultural market linkage, agro-commodity trading, supply chain logistics, and entrepreneurship.',
        requirements: ['5 O-level credits including English, Mathematics, Economics/Commerce, and Agric Science'],
      },
    ];

    const users: User[] = [
      {
        id: 'usr-superadmin',
        email: 'superadmin@edocasti.edu.ng',
        passwordHash,
        fullName: 'Engr. Osasere Igbinedion',
        role: 'SUPER_ADMIN',
        phone: '+234 802 111 2233',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-10T08:00:00Z',
      },
      {
        id: 'usr-admin',
        email: 'admin@edocasti.edu.ng',
        passwordHash,
        fullName: 'Dr. (Mrs) Ekiomado Omoruyi',
        role: 'INSTITUTION_ADMIN',
        phone: '+234 803 222 3344',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-11T08:00:00Z',
      },
      {
        id: 'usr-rector',
        email: 'rector@edocasti.edu.ng',
        passwordHash,
        fullName: 'Prof. Patrick O. Aghimien',
        role: 'RECTOR',
        phone: '+234 805 333 4455',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-10T09:00:00Z',
      },
      {
        id: 'usr-registrar',
        email: 'registrar@edocasti.edu.ng',
        passwordHash,
        fullName: 'Barr. Itohan Edokpayi',
        role: 'REGISTRAR',
        phone: '+234 806 444 5566',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-12T08:30:00Z',
      },
      {
        id: 'usr-admissions',
        email: 'admissions@edocasti.edu.ng',
        passwordHash,
        fullName: 'Mr. Jude Osahon',
        role: 'ADMISSIONS_OFFICER',
        phone: '+234 807 555 6677',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-12T09:00:00Z',
      },
      {
        id: 'usr-hod-agric',
        email: 'hod.agric@edocasti.edu.ng',
        passwordHash,
        fullName: 'Dr. Monday Osa-Egharevba',
        role: 'HOD',
        departmentId: 'dept-agric',
        schoolId: 'sch-agric',
        phone: '+234 808 666 7788',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-12T10:00:00Z',
      },
      {
        id: 'usr-dean',
        email: 'dean@edocasti.edu.ng',
        passwordHash,
        fullName: 'Prof. Eghosa Osagie',
        role: 'DEAN',
        schoolId: 'sch-agric',
        phone: '+234 808 111 4422',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-12T10:15:00Z',
      },
      {
        id: 'usr-examofficer',
        email: 'examofficer@edocasti.edu.ng',
        passwordHash,
        fullName: 'Dr. (Mrs) Osarugue Iyoha',
        role: 'EXAM_OFFICER',
        phone: '+234 808 222 5533',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-12T10:30:00Z',
      },
      {
        id: 'usr-lecturer-agric',
        email: 'lecturer.agric@edocasti.edu.ng',
        passwordHash,
        fullName: 'Dr. Osaze Obanor',
        role: 'LECTURER',
        departmentId: 'dept-agric',
        schoolId: 'sch-agric',
        phone: '+234 809 777 8899',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-14T08:00:00Z',
      },
      {
        id: 'usr-lecturer-cs',
        email: 'lecturer.cs@edocasti.edu.ng',
        passwordHash,
        fullName: 'Engr. Joy Akhere',
        role: 'LECTURER',
        departmentId: 'dept-cs',
        schoolId: 'sch-applied',
        phone: '+234 802 888 9900',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-14T08:30:00Z',
      },
      {
        id: 'usr-bursar',
        email: 'bursar@edocasti.edu.ng',
        passwordHash,
        fullName: 'Mr. Festus Ojo (FCA)',
        role: 'BURSAR',
        phone: '+234 803 999 0011',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-01-12T11:00:00Z',
      },
      {
        id: 'usr-student-1',
        email: 'student.agric@edocasti.edu.ng',
        passwordHash,
        fullName: 'Blessing Osasogie Omorodion',
        role: 'STUDENT',
        phone: '+234 810 111 2233',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-02-01T10:00:00Z',
      },
      {
        id: 'usr-student-2',
        email: 'student.cs@edocasti.edu.ng',
        passwordHash,
        fullName: 'Emanuel Kelvin Igbinoba',
        role: 'STUDENT',
        phone: '+234 812 222 3344',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-02-01T10:30:00Z',
      },
      {
        id: 'usr-applicant-1',
        email: 'applicant.jerry@gmail.com',
        passwordHash,
        fullName: 'Jerry Osamudiamen Idahosa',
        role: 'APPLICANT',
        phone: '+234 814 333 4455',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: '2025-03-01T12:00:00Z',
      },
    ];

    const courses: Course[] = [
      {
        id: 'crs-agt111',
        departmentId: 'dept-agric',
        code: 'AGT 111',
        title: 'Introduction to Agricultural Science & Agronomy',
        creditUnits: 3,
        level: 'ND I',
        semester: 'First Semester',
        lecturerId: 'usr-lecturer-agric',
        lecturerName: 'Dr. Osaze Obanor',
        isCompulsory: true,
      },
      {
        id: 'crs-agt112',
        departmentId: 'dept-agric',
        code: 'AGT 112',
        title: 'Principles of Crop Production & Soil Fertility',
        creditUnits: 3,
        level: 'ND I',
        semester: 'First Semester',
        lecturerId: 'usr-lecturer-agric',
        lecturerName: 'Dr. Osaze Obanor',
        isCompulsory: true,
      },
      {
        id: 'crs-agt113',
        departmentId: 'dept-agric',
        code: 'AGT 113',
        title: 'Farm Workshop Practice & Safety',
        creditUnits: 2,
        level: 'ND I',
        semester: 'First Semester',
        lecturerId: 'usr-hod-agric',
        lecturerName: 'Dr. Monday Osa-Egharevba',
        isCompulsory: true,
      },
      {
        id: 'crs-gns101',
        departmentId: 'dept-agric',
        code: 'GNS 101',
        title: 'Use of English & Communication Skills I',
        creditUnits: 2,
        level: 'ND I',
        semester: 'First Semester',
        lecturerName: 'General Studies Unit',
        isCompulsory: true,
      },
      {
        id: 'crs-com111',
        departmentId: 'dept-cs',
        code: 'COM 111',
        title: 'Introduction to Computing & Logic',
        creditUnits: 3,
        level: 'ND I',
        semester: 'First Semester',
        lecturerId: 'usr-lecturer-cs',
        lecturerName: 'Engr. Joy Akhere',
        isCompulsory: true,
      },
      {
        id: 'crs-com112',
        departmentId: 'dept-cs',
        code: 'COM 112',
        title: 'Computer Programming Using Python',
        creditUnits: 3,
        level: 'ND I',
        semester: 'First Semester',
        lecturerId: 'usr-lecturer-cs',
        lecturerName: 'Engr. Joy Akhere',
        isCompulsory: true,
      },
      {
        id: 'crs-slt111',
        departmentId: 'dept-slt',
        code: 'SLT 111',
        title: 'Laboratory Techniques & Chemical Safety',
        creditUnits: 3,
        level: 'ND I',
        semester: 'First Semester',
        lecturerName: 'SLT Faculty',
        isCompulsory: true,
      },
      {
        id: 'crs-ahp111',
        departmentId: 'dept-animal',
        code: 'AHP 111',
        title: 'Anatomy and Physiology of Farm Animals',
        creditUnits: 3,
        level: 'ND I',
        semester: 'First Semester',
        lecturerName: 'Animal Health Faculty',
        isCompulsory: true,
      },
    ];

    const students: Student[] = [
      {
        id: 'std-1',
        matricNumber: 'EDOCASTI/ND/2024/0101',
        userId: 'usr-student-1',
        programmeId: 'prog-nd-agric',
        departmentId: 'dept-agric',
        schoolId: 'sch-agric',
        level: 'ND I',
        sessionAdmitted: '2024/2025',
        academicStatus: 'Good Standing',
        gender: 'Female',
        dob: '2004-05-18',
        emergencyContact: 'Mr. Peter Omorodion (+234 803 444 8899)',
        nextOfKin: 'Mrs. Victoria Omorodion (Mother)',
        cgpa: 3.75,
        totalCreditsEarned: 22,
      },
      {
        id: 'std-2',
        matricNumber: 'EDOCASTI/ND/2024/0202',
        userId: 'usr-student-2',
        programmeId: 'prog-nd-cs',
        departmentId: 'dept-cs',
        schoolId: 'sch-applied',
        level: 'ND I',
        sessionAdmitted: '2024/2025',
        academicStatus: 'Good Standing',
        gender: 'Male',
        dob: '2003-11-24',
        emergencyContact: 'Chief G. O. Igbinoba (+234 802 555 7711)',
        nextOfKin: 'Chief G. O. Igbinoba (Father)',
        cgpa: 4.15,
        totalCreditsEarned: 24,
      },
    ];

    const applications: AdmissionApplication[] = [
      {
        id: 'app-001',
        applicationNumber: 'EDOCASTI/2025/APP-00109',
        userId: 'usr-applicant-1',
        programmeId: 'prog-nd-agric',
        session: '2025/2026',
        firstName: 'Jerry',
        lastName: 'Idahosa',
        otherNames: 'Osamudiamen',
        gender: 'Male',
        dob: '2005-08-14',
        phone: '+234 814 333 4455',
        email: 'applicant.jerry@gmail.com',
        stateOfOrigin: 'Edo State',
        lga: 'Oredo',
        residentialAddress: '14 Stadium Road, Benin City, Edo State',
        oLevelResults: [
          { subject: 'English Language', grade: 'C4', examNumber: '420199201', examType: 'WAEC' },
          { subject: 'Mathematics', grade: 'B3', examNumber: '420199201', examType: 'WAEC' },
          { subject: 'Agricultural Science', grade: 'A1', examNumber: '420199201', examType: 'WAEC' },
          { subject: 'Biology', grade: 'B2', examNumber: '420199201', examType: 'WAEC' },
          { subject: 'Chemistry', grade: 'C5', examNumber: '420199201', examType: 'WAEC' },
        ],
        status: 'OFFERED',
        screeningNotes: 'Candidate meets all departmental O-Level requirements with strong performance in Agric Science and Biology.',
        reviewedBy: 'Mr. Jude Osahon (Admissions Officer)',
        submittedAt: '2025-03-05T14:22:00Z',
        decisionAt: '2025-03-12T10:00:00Z',
      },
      {
        id: 'app-002',
        applicationNumber: 'EDOCASTI/2025/APP-00110',
        userId: 'usr-superadmin', // placeholder for secondary applicant demo
        programmeId: 'prog-nd-cs',
        session: '2025/2026',
        firstName: 'Courage',
        lastName: 'Enabulele',
        otherNames: 'Nosa',
        gender: 'Female',
        dob: '2005-03-20',
        phone: '+234 809 111 9922',
        email: 'courage.enabs@gmail.com',
        stateOfOrigin: 'Edo State',
        lga: 'Ikpoba-Okha',
        residentialAddress: '8 Upper Sakponba Road, Benin City',
        oLevelResults: [
          { subject: 'English Language', grade: 'B3', examNumber: '51928371', examType: 'NECO' },
          { subject: 'Mathematics', grade: 'A1', examNumber: '51928371', examType: 'NECO' },
          { subject: 'Physics', grade: 'B2', examNumber: '51928371', examType: 'NECO' },
          { subject: 'Chemistry', grade: 'B3', examNumber: '51928371', examType: 'NECO' },
          { subject: 'Computer Studies', grade: 'A1', examNumber: '51928371', examType: 'NECO' },
        ],
        status: 'SUBMITTED',
        screeningNotes: 'Pending credential verification by Admissions committee.',
        submittedAt: '2025-03-08T09:15:00Z',
      },
    ];

    const feeSchedules: FeeSchedule[] = [
      { id: 'fee-nd1-tuit', level: 'ND I', session: '2025/2026', title: 'School Tuition & Academic Fees', category: 'Tuition', amount: 45000 },
      { id: 'fee-nd1-acc', level: 'ND I', session: '2025/2026', title: 'Admission Acceptance Fee', category: 'Acceptance', amount: 15000 },
      { id: 'fee-nd1-lab', level: 'ND I', session: '2025/2026', title: 'Practical Farm & Laboratory Levy', category: 'Laboratory', amount: 12500 },
      { id: 'fee-nd1-ict', level: 'ND I', session: '2025/2026', title: 'ICT & Portal Service Fee', category: 'Registration', amount: 7500 },
    ];

    const invoices: Invoice[] = [
      {
        id: 'inv-001',
        invoiceNumber: 'INV/2025/08191',
        studentId: 'std-1',
        session: '2025/2026',
        title: 'ND I 2025/2026 Consolidated School Fees',
        amount: 65000,
        amountPaid: 65000,
        status: 'PAID',
        dueDate: '2025-11-30',
        createdAt: '2025-10-01T08:00:00Z',
      },
      {
        id: 'inv-002',
        invoiceNumber: 'INV/2025/08192',
        studentId: 'std-2',
        session: '2025/2026',
        title: 'ND I 2025/2026 Consolidated School Fees',
        amount: 65000,
        amountPaid: 35000,
        status: 'PARTIAL',
        dueDate: '2025-11-30',
        createdAt: '2025-10-01T08:00:00Z',
      },
    ];

    const payments: PaymentTransaction[] = [
      {
        id: 'pay-001',
        reference: 'EDOCASTI-TX-882190',
        invoiceId: 'inv-001',
        studentId: 'std-1',
        amount: 65000,
        channel: 'Remita',
        status: 'VERIFIED',
        providerReference: 'RRR-3991-8821-002',
        paidAt: '2025-10-05T11:45:00Z',
        verifiedBy: 'Mr. Festus Ojo (Bursar)',
      },
      {
        id: 'pay-002',
        reference: 'EDOCASTI-TX-882191',
        invoiceId: 'inv-002',
        studentId: 'std-2',
        amount: 35000,
        channel: 'Interswitch',
        status: 'VERIFIED',
        providerReference: 'ISW-9921-7712',
        paidAt: '2025-10-10T14:30:00Z',
        verifiedBy: 'Mr. Festus Ojo (Bursar)',
      },
    ];

    const registrations: CourseRegistration[] = [
      {
        id: 'reg-001',
        studentId: 'std-1',
        session: '2025/2026',
        semester: 'First Semester',
        level: 'ND I',
        courseIds: ['crs-agt111', 'crs-agt112', 'crs-agt113', 'crs-gns101'],
        totalCredits: 10,
        status: 'APPROVED_BY_HOD',
        approvedAt: '2025-10-15T10:00:00Z',
        approvedBy: 'Dr. Monday Osa-Egharevba (HOD)',
        createdAt: '2025-10-12T09:00:00Z',
      },
    ];

    const results: AssessmentResult[] = [
      {
        id: 'res-001',
        courseId: 'crs-agt111',
        studentId: 'std-1',
        matricNumber: 'EDOCASTI/ND/2024/0101',
        studentName: 'Blessing Osasogie Omorodion',
        session: '2025/2026',
        semester: 'First Semester',
        caScore: 34,
        examScore: 48,
        totalScore: 82,
        grade: 'A',
        gradePoint: 5.0,
        status: 'PUBLISHED',
        submittedBy: 'Dr. Osaze Obanor',
        verifiedBy: 'Dr. Monday Osa-Egharevba',
        approvedBy: 'Senate / Academic Board',
        publishedAt: '2026-02-10T12:00:00Z',
      },
      {
        id: 'res-002',
        courseId: 'crs-agt112',
        studentId: 'std-1',
        matricNumber: 'EDOCASTI/ND/2024/0101',
        studentName: 'Blessing Osasogie Omorodion',
        session: '2025/2026',
        semester: 'First Semester',
        caScore: 28,
        examScore: 41,
        totalScore: 69,
        grade: 'B',
        gradePoint: 4.0,
        status: 'PUBLISHED',
        submittedBy: 'Dr. Osaze Obanor',
        verifiedBy: 'Dr. Monday Osa-Egharevba',
        approvedBy: 'Senate / Academic Board',
        publishedAt: '2026-02-10T12:00:00Z',
      },
      {
        id: 'res-003',
        courseId: 'crs-com111',
        studentId: 'std-2',
        matricNumber: 'EDOCASTI/ND/2024/0202',
        studentName: 'Emanuel Kelvin Igbinoba',
        session: '2025/2026',
        semester: 'First Semester',
        caScore: 36,
        examScore: 50,
        totalScore: 86,
        grade: 'A',
        gradePoint: 5.0,
        status: 'PUBLISHED',
        submittedBy: 'Engr. Joy Akhere',
        verifiedBy: 'Head of Department',
        approvedBy: 'Senate / Academic Board',
        publishedAt: '2026-02-10T12:00:00Z',
      },
    ];

    const attendance: AttendanceSession[] = [
      {
        id: 'att-001',
        courseId: 'crs-agt111',
        lecturerId: 'usr-lecturer-agric',
        date: '2025-10-18',
        type: 'Field Practical',
        topic: 'Soil Profiling and Soil Horizon Identification at College Research Farm',
        records: [
          { studentId: 'std-1', matricNumber: 'EDOCASTI/ND/2024/0101', studentName: 'Blessing Osasogie Omorodion', isPresent: true },
        ],
      },
      {
        id: 'att-002',
        courseId: 'crs-com112',
        lecturerId: 'usr-lecturer-cs',
        date: '2025-10-20',
        type: 'Laboratory',
        topic: 'Data Types, Control Structures, and Functional Programming in Python',
        records: [
          { studentId: 'std-2', matricNumber: 'EDOCASTI/ND/2024/0202', studentName: 'Emanuel Kelvin Igbinoba', isPresent: true },
        ],
      },
    ];

    const supportTickets: SupportTicket[] = [
      {
        id: 'tkt-001',
        ticketNumber: 'TKT-2025-0041',
        userId: 'usr-student-1',
        userName: 'Blessing Osasogie Omorodion',
        userEmail: 'student.agric@edocasti.edu.ng',
        subject: 'Course Registration Slip print request after addition of elective',
        category: 'Course Registration',
        priority: 'MEDIUM',
        status: 'RESOLVED',
        messages: [
          {
            sender: 'Blessing Osasogie Omorodion',
            role: 'STUDENT',
            message: 'Good day Registry, my HOD approved my course registration but I need to ensure GNS 101 reflects correctly on my printed slip.',
            timestamp: '2025-10-16T11:00:00Z',
          },
          {
            sender: 'Registry Helpdesk',
            role: 'REGISTRAR',
            message: 'Hello Blessing, your course registration record has been updated and synchronized. You can now download the official slip directly from your portal dashboard.',
            timestamp: '2025-10-16T14:30:00Z',
          },
        ],
        createdAt: '2025-10-16T11:00:00Z',
      },
    ];

    const auditLogs: AuditLog[] = [
      {
        id: 'AUD-001',
        timestamp: '2025-01-10T08:00:00Z',
        userId: 'usr-superadmin',
        userEmail: 'superadmin@edocasti.edu.ng',
        action: 'SYSTEM_INITIALIZATION',
        resource: 'INSTITUTION_PROFILE',
        details: { message: 'Initialized EDOCASTI Portal system database and security core.' },
      },
      {
        id: 'AUD-002',
        timestamp: '2025-03-12T10:00:00Z',
        userId: 'usr-admissions',
        userEmail: 'admissions@edocasti.edu.ng',
        action: 'ADMISSION_OFFER_ISSUED',
        resource: 'APPLICATION_001',
        details: { applicantName: 'Jerry Idahosa', programme: 'ND-AGT', decision: 'OFFERED' },
      },
      {
        id: 'AUD-003',
        timestamp: '2025-10-05T11:45:00Z',
        userId: 'usr-bursar',
        userEmail: 'bursar@edocasti.edu.ng',
        action: 'PAYMENT_VERIFIED',
        resource: 'INV/2025/08191',
        details: { amount: 65000, reference: 'EDOCASTI-TX-882190', channel: 'Remita' },
      },
    ];

    const newsArticles: NewsArticle[] = [
      {
        id: 'news-001',
        title: 'Edo State Government Commissions Modernized Greenhouse & Tractor Mechanization Hub at Iguoriakhi',
        slug: 'edo-govt-commissions-modern-greenhouse-hub',
        summary: 'His Excellency commissions expanded 1,500-acre smart irrigation demonstration perimeter, automated climate greenhouses, and heavy farm equipment workshops.',
        content: 'In fulfillment of the agricultural transformation blueprint for Edo State, the executive governor has officially commissioned the expanded Iguoriakhi Campus mechanization complex. The modern infrastructure provides students of Agricultural Technology, Bio-Environmental Engineering, and Agronomy with hands-on exposure to mechanized seeders, automated harvesters, and solar-powered drip irrigation grids.',
        category: 'Research & Farm',
        isFeaturedInSlider: true,
        status: 'PUBLISHED',
        author: 'Information & Protocol Directorate',
        publishedAt: '2025-10-10T09:00:00Z',
        views: 1240,
      },
      {
        id: 'news-002',
        title: 'Academic Board Announces 2025/2026 Online Screening & Admission Criteria',
        slug: 'academic-board-releases-admissions-guidelines',
        summary: 'Prospective National Diploma (ND) and Higher National Diploma (HND) candidates can now apply and track real-time O-Level vetting online.',
        content: 'The College Admissions Committee wishes to inform the general public and prospective applicants that online registration for the 2025/2026 academic session has formally commenced. All candidates with minimum requirements in WAEC/NECO/NABTEB are invited to upload their biodata and examination credentials directly through the integrated portal.',
        category: 'Admissions',
        isFeaturedInSlider: true,
        status: 'PUBLISHED',
        author: 'Office of the College Registrar',
        publishedAt: '2025-10-08T11:30:00Z',
        views: 3820,
      },
      {
        id: 'news-003',
        title: 'EDOCASTI Computer Science & Agro-Informatics Faculty Deploys AI Crop Disease Diagnostics Model',
        slug: 'cs-department-deploys-ai-crop-diagnostics',
        summary: 'Innovative collaboration between School of Applied Sciences and School of Agricultural Technology yields real-time cassava and maize blight detection tool.',
        content: 'Staff and student researchers from the Department of Computer Science & Software Systems, in active collaboration with the Department of Agricultural Technology, have launched a pilot mobile-ready machine learning model capable of detecting early fungal blight and pest infestation from smartphone farm photos.',
        category: 'Research & Farm',
        isFeaturedInSlider: false,
        status: 'PUBLISHED',
        author: 'ICT & Applied Innovation Centre',
        publishedAt: '2025-09-28T14:15:00Z',
        views: 890,
      },
      {
        id: 'news-004',
        title: 'Bursary Notice: Seamless Remita Electronic Payment Reconciliation for Consolidated Fees',
        slug: 'bursary-electronic-fee-reconciliation-guidelines',
        summary: 'Students are advised to generate authenticated invoices via the portal and verify payments instantly without physical bank queuing.',
        content: 'The Bursary Directorate has streamlined all student fees collections. Payment references (RRR) are dynamically generated per enrolled semester, allowing instant verification and automated production of printable electronic bursary receipts recognized for examination hall clearance.',
        category: 'Notice',
        isFeaturedInSlider: false,
        status: 'PUBLISHED',
        author: 'Directorate of Bursary & Accounts',
        publishedAt: '2025-09-20T08:00:00Z',
        views: 1750,
      },
    ];

    const sliderSlides: HeroSlide[] = [
      {
        id: 'slide-01',
        title: 'Excellence in Agricultural Mechanization & Food Security',
        subtitle: 'Empowering Nigeriaâ€™s next generation of agronomists, bio-environmental engineers, and agro-technologists with world-class practical skills at Iguoriakhi Main Campus.',
        badge: '2025/2026 Admissions Open',
        bgGradient: 'from-emerald-950 via-emerald-900 to-slate-950',
        accentColor: 'amber-400',
        ctaText: 'Apply for Admission Online',
        ctaTab: 'admissions',
        ctaSubSection: 'form',
        iconName: 'Sparkles',
        order: 1,
        isActive: true,
      },
      {
        id: 'slide-02',
        title: '1,500-Acre Demonstration Farms & Modernized Greenhouses',
        subtitle: 'From automated drip-line irrigation to high-yield cassava multiplication and commercial poultry breeding, experience cutting-edge hands-on technical education.',
        badge: 'Research & Field Practicum',
        bgGradient: 'from-green-950 via-emerald-900 to-amber-950',
        accentColor: 'amber-300',
        ctaText: 'Explore Academic Programmes',
        ctaTab: 'public',
        ctaSubSection: 'programmes',
        iconName: 'Tractor',
        order: 2,
        isActive: true,
      },
      {
        id: 'slide-03',
        title: 'Fully Integrated Student Lifecycle & Digital Services',
        subtitle: 'Register semester course units, download HOD-cleared slips, check Senate-approved grades, settle fees via Remita, and access official transcripts 24/7.',
        badge: '100% Digital Campus',
        bgGradient: 'from-slate-950 via-emerald-950 to-slate-900',
        accentColor: 'emerald-400',
        ctaText: 'Enter Student Portal',
        ctaTab: 'student',
        ctaSubSection: 'courses',
        iconName: 'GraduationCap',
        order: 3,
        isActive: true,
      },
    ];

    const pageContent: PageContent = {
      portalBannerText: 'Edo State College of Agriculture, Science and Technology, Iguoriakhi',
      portalBadgeText: 'Official Portal',
      newsSectionKicker: 'Official Press Releases & College News',
      newsSectionHeading: 'Latest from the Campus & Research Stations',
      rectorName: 'Prof. Patrick O. Aghimien',
      rectorTitle: 'Rector & Provost',
      rectorInstitution: 'Edo State College of Agriculture, Science and Technology, Iguoriakhi',
      rectorKicker: 'Leadership & Institutional Mission',
      rectorHeadline: 'Fostering Practical Innovation in Agronomy, Food Security & Technology',
      rectorParagraph1:
        'At EDOCASTI, we are committed to producing graduates equipped with real-world technical competence. Our curricula blend rigorous classroom theory with mandatory field operations on our modernized 1,500-acre research farms, advanced science laboratories, and high-performance computing centers.',
      rectorParagraph2:
        'Through this portal, all institutional operationsâ€”from transparent online admissions, fee settlements, continuous assessment entries, and transcript issuanceâ€”are fully integrated, transparent, and auditable.',
      rectorCtaText: 'Apply for 2025/2026 Session',
      rectorAvatarEmoji: 'ðŸ‘¨â€ðŸ«',
      schoolsSectionKicker: 'Academic Offerings',
      schoolsSectionHeading: 'Schools, Faculties & Programmes',
      schoolsSectionSubheading:
        'Explore our accredited National Diploma (ND) and Higher National Diploma (HND) programmes.',
      calendarSectionKicker: 'Official Schedule',
      calendarSectionHeading: '2025/2026 Academic Calendar Highlights',
      calendarItems: [
        {
          id: 'cal-1',
          title: 'Admission & Screening',
          description: 'Online screening portal open for all UTME and direct ND/HND applicants across Edo State.',
          statusLabel: 'Ongoing',
        },
        {
          id: 'cal-2',
          title: 'Course Registration & Lectures',
          description: 'Course enrollment, timetable release, and mandatory farm workshop inductions for ND I and ND II.',
          statusLabel: 'Registration Open',
        },
        {
          id: 'cal-3',
          title: 'Continuous Assessment & Exams',
          description: 'Continuous assessment tests (40%), followed by semester written and laboratory practical examinations (60%).',
          statusLabel: 'Scheduled',
        },
      ],
      faqSectionKicker: 'Help & Guidance',
      faqSectionHeading: 'Frequently Asked Questions',
      faqs: [
        {
          id: 'faq-1',
          q: 'What are the basic admission requirements for National Diploma (ND) programmes?',
          a: 'Candidates must possess at least five (5) credit passes in SSCE/WAEC/NECO/NABTEB at not more than two sittings, including English Language, Mathematics, and three science subjects relevant to the chosen course (such as Agricultural Science/Biology, Chemistry, Physics).',
        },
        {
          id: 'faq-2',
          q: 'Is the admission form screening done entirely online?',
          a: 'Yes. Eligible candidates complete the online biodata, enter their verified O-Level grades, upload documents, and track their screening status directly through this portal.',
        },
        {
          id: 'faq-3',
          q: 'Where is the main campus of EDOCASTI located?',
          a: 'The college main campus is located along Benin-Lagos Expressway at Iguoriakhi, Ovia South-West LGA, Edo State, Nigeria, equipped with research farms and demonstration facilities.',
        },
        {
          id: 'faq-4',
          q: 'How do admitted students receive their admission letters and matriculate?',
          a: 'Once an applicant receives a provisional offer on the portal, they accept the offer online, settle the institutional acceptance fee, receive their matriculation number, and print their official admission letter.',
        },
      ],
      footerBrandTitle: 'EDOCASTI PORTAL',
      footerBrandSubtitle: 'Edo State College of Agriculture, Science & Technology, Iguoriakhi',
      footerDescription:
        'Official integrated educational management information system for Iguoriakhi Main Campus, Edo State, Nigeria. Accredited by NBTE.',
      footerLocationHeading: 'Main Campus Location',
      footerLocationAddress:
        'Iguoriakhi Main Campus, Benin-Lagos Expressway, Ovia South-West LGA, Edo State, Nigeria.',
      footerContactHeading: 'Helpdesk & Admissions',
      sectionOrder: ['hero', 'news', 'rector', 'schools', 'calendar', 'faqs', 'footer'],
      hiddenSections: [],
      customSections: [],
    };

    const issuedDocuments: IssuedDocument[] = [];

    return {
      settings,
      users,
      schools,
      departments,
      programmes,
      courses,
      applications,
      students,
      registrations,
      results,
      feeSchedules,
      invoices,
      payments,
      attendance,
      supportTickets,
      auditLogs,
      newsArticles,
      sliderSlides,
      pageContent,
      issuedDocuments,
      feeCatalogItems: [],
      programFeeSchedules: [],
      programFeeScheduleItems: [],
      studentFeeObligations: [],
      studentPayments: [],
      studentPaymentAllocations: [],    };
  }
}

export const db = new DatabaseEngine();
export { computeGradeAndPoints };

