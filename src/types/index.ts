export type UserRole =
  | 'SUPER_ADMIN'
  | 'INSTITUTION_ADMIN'
  | 'RECTOR'
  | 'REGISTRAR'
  | 'ADMISSIONS_OFFICER'
  | 'DEAN'
  | 'HOD'
  | 'LECTURER'
  | 'EXAM_OFFICER'
  | 'BURSAR'
  | 'STUDENT'
  | 'APPLICANT';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  photoUrl?: string;
  isActive?: boolean;
  isLocked?: boolean;
  departmentId?: string;
  schoolId?: string;
  createdAt?: string;
  lastLogin?: string;
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
  /** Global application background logo opacity, stored as a 0–1 value. */
  logoWatermarkOpacity?: number;
  /** Optional editable JSON mapping of Nigerian states to LGAs. */
  nigeriaLocationDataJson?: string;
  registrarSignatureUrl?: string;
  rectorSignatureUrl?: string;
  bursarSignatureUrl?: string;
  schoolStampUrl?: string;
  transcriptFee?: number;
  certificateFee?: number;
}

export interface School {
  id: string;
  code: string;
  name: string;
  description: string;
  imageUrl?: string;
}

export interface Department {
  id: string;
  schoolId: string;
  code: string;
  name: string;
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
  level: string;
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
}

export interface Student {
  id: string;
  matricNumber: string;
  userId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  programmeId: string;
  programmeName?: string;
  departmentId: string;
  departmentName?: string;
  schoolId: string;
  schoolName?: string;
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
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  gradePoint: number;
  status: 'DRAFT' | 'SUBMITTED' | 'HOD_APPROVED' | 'VERIFIED' | 'APPROVED' | 'PUBLISHED';
  submittedBy?: string;
  hodApprovedBy?: string;
  hodApprovedAt?: string;
  verifiedBy?: string;
  approvedBy?: string;
  publishedAt?: string;
}

export interface FeeSchedule {
  id: string;
  programmeId?: string;
  level?: string;
  session: string;
  title: string;
  category: string;
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
  channel: string;
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

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
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
  backgroundColor?: string;
  borderColor?: string;
  titleColor?: string;
  descriptionColor?: string;
  statusColor?: string;
  iconColor?: string;
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
  rectorBackgroundImageUrl?: string;
  rectorBgColor?: string;
  rectorBgSecondaryColor?: string;
  rectorTextColor?: string;
  rectorSubtitleColor?: string;
  rectorAccentHex?: string;
  rectorBorderColor?: string;
  rectorButtonBgColor?: string;
  rectorButtonTextColor?: string;
  schoolsSectionKicker: string;
  schoolsSectionHeading: string;
  schoolsSectionSubheading: string;
  calendarSectionKicker: string;
  calendarSectionHeading: string;
  calendarCurrentPeriodLabel?: string;
  calendarCurrentPeriodText?: string;
  calendarAddHighlightLabel?: string;
  calendarBackgroundImageUrl?: string;
  calendarKickerColor?: string;
  calendarHeadingColor?: string;
  calendarButtonBgColor?: string;
  calendarButtonTextColor?: string;
  calendarBgColor?: string;
  calendarBgSecondaryColor?: string;
  calendarTextColor?: string;
  calendarAccentColor?: string;
  calendarCardBgColor?: string;
  calendarCardBorderColor?: string;
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
  footerContactPhone?: string;
  footerContactEmail?: string;
  footerBackgroundImageUrl?: string;
  footerBgColor?: string;
  footerBgSecondaryColor?: string;
  footerTextColor?: string;
  footerSubtitleColor?: string;
  footerAccentColor?: string;
  footerBorderColor?: string;
  footerIconColor?: string;
  headerBackgroundImageUrl?: string;
  headerBgColor?: string;
  headerBgSecondaryColor?: string;
  headerTextColor?: string;
  headerSubtitleColor?: string;
  headerAccentColor?: string;
  headerNavBgColor?: string;
  headerNavTextColor?: string;
  headerBorderColor?: string;
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
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  generatedBy: string;
  generatedAt: string;
  resultsSnapshot?: AssessmentResult[];
}
