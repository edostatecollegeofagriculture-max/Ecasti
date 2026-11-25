import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  InstitutionSettings,
  PageContent,
  HeroSlide,
  NewsArticle,
  School,
  Department,
  Programme,
  Course,
  FeeSchedule,
  Student,
  AdmissionApplication,
  User,
  AssessmentResult,
  CourseRegistration,
  Invoice,
  PaymentTransaction,
  AttendanceSession,
  SupportTicket,
  CalendarHighlight,
  FaqItem,
  CustomPageSection,
} from '../types';
import { SchoolLogo } from './SchoolLogo';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogIn,
  Layers,
  Building2,
  GraduationCap,
  BookOpen,
  Calendar,
  HelpCircle,
  Wallet,
  Sparkles,
  LayoutTemplate,
  Monitor,
  Tablet,
  Smartphone,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Lock,
  CheckCircle,
  RefreshCw,
  Award,
  ClipboardCheck,
  Receipt,
  MessageSquare,
  Pencil,
  Upload,
  Image as ImageIcon,
  Palette,
  RotateCcw,
} from 'lucide-react';
import { readImageFileAsDataUrl } from '../utils/imageUpload';
import { NIGERIA_LGAS } from '../utils/nigeriaLocations';
import { matchesWildcard } from '../utils/wildcard';
import {
  HERO_COLOR_PRESETS,
  HERO_COLOR_CONTROLS,
  EMPTY_HERO_COLORS,
  getHeroSlideStyles,
  hasCustomHeroBackground,
} from '../utils/heroTheme';

interface Props {
  onExitBuilder: () => void;
  onOpenLoginModal: () => void;
}

type ScopeFilter = 'all' | 'public' | 'academics' | 'finance' | 'people';

type SelectedItem =
  | { type: 'overview' }
  | { type: 'header' }
  | { type: 'settings' }
  | { type: 'slide'; id: string }
  | { type: 'newsHeader' }
  | { type: 'article'; id: string }
  | { type: 'rector' }
  | { type: 'schoolsHeader' }
  | { type: 'school'; id: string }
  | { type: 'department'; id: string }
  | { type: 'programme'; id: string }
  | { type: 'course'; id: string }
  | { type: 'calendarHeader' }
  | { type: 'calendarItem'; id: string }
  | { type: 'faqHeader' }
  | { type: 'faq'; id: string }
  | { type: 'footer' }
  | { type: 'customSection'; id: string }
  | { type: 'fee'; id: string }
  | { type: 'invoice'; id: string }
  | { type: 'result'; id: string }
  | { type: 'registration'; id: string }
  | { type: 'attendance'; id: string }
  | { type: 'ticket'; id: string }
  | { type: 'student'; id: string }
  | { type: 'application'; id: string }
  | { type: 'user'; id: string };

const FALLBACK_PAGE_CONTENT: PageContent = {
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
    'At EDOCASTI, we are committed to producing graduates equipped with real-world technical competence.',
  rectorParagraph2:
    'Through this portal, all institutional operations—from admissions to transcript issuance—are fully integrated.',
  rectorCtaText: 'Apply for 2025/2026 Session',
  rectorAvatarEmoji: '👨‍🏫',
  schoolsSectionKicker: 'Academic Offerings',
  schoolsSectionHeading: 'Schools, Faculties & Programmes',
  schoolsSectionSubheading:
    'Explore our accredited National Diploma (ND) and Higher National Diploma (HND) programmes.',
  calendarSectionKicker: 'Official Schedule',
  calendarSectionHeading: '2025/2026 Academic Calendar Highlights',
  calendarCurrentPeriodLabel: 'Current Period',
  calendarCurrentPeriodText: '',
  calendarAddHighlightLabel: 'Add Highlight',
  calendarBgColor: '#073f31',
  calendarBgSecondaryColor: '#0b5b43',
  calendarTextColor: '#ffffff',
  calendarAccentColor: '#fbbf24',
  calendarCardBgColor: 'rgba(255,255,255,0.05)',
  calendarCardBorderColor: 'rgba(255,255,255,0.10)',
  calendarItems: [],
  faqSectionKicker: 'Help & Guidance',
  faqSectionHeading: 'Frequently Asked Questions',
  faqs: [],
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

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero Slideshow',
  header: 'Main Header',
  news: 'News & Press Bulletins',
  rector: "Rector's Message",
  schools: 'Schools & Programmes',
  calendar: 'Academic Calendar',
  faqs: 'FAQs Accordion',
  footer: 'Campus Footer',
};

const ADMIN_EDIT_ROLES = ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR', 'REGISTRAR', 'BURSAR', 'ADMISSIONS_OFFICER', 'DEAN'];

export const PageBuilder: React.FC<Props> = ({ onExitBuilder, onOpenLoginModal }) => {
  const { user, settings: ctxSettings, pageContent: ctxPageContent, refreshSettings, refreshPageContent, switchPersona } =
    useAuth();

  const canEdit = Boolean(user && ADMIN_EDIT_ROLES.includes(user.role));

  // All live app data states (updated in real-time on left edit so right preview updates immediately)
  const [settings, setSettings] = useState<InstitutionSettings | null>(ctxSettings);
  const [pageContent, setPageContent] = useState<PageContent>(ctxPageContent || FALLBACK_PAGE_CONTENT);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<FeeSchedule[]>([]);

  // Operational records (fetched when signed in as privileged staff)
  const [students, setStudents] = useState<Student[]>([]);
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [registrations, setRegistrations] = useState<CourseRegistration[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const [selected, setSelected] = useState<SelectedItem>({ type: 'overview' });
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewWidth, setPreviewWidth] = useState<'full' | 'tablet' | 'mobile'>('full');
  const [activeSlidePreviewIdx, setActiveSlidePreviewIdx] = useState(0);
  const [ticketReplyDraft, setTicketReplyDraft] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAllAppInfo = async () => {
    setLoading(true);
    try {
      const [setRes, pcRes, slRes, newsRes, schRes, deptRes, progRes, crsRes, feeRes] = await Promise.all([
        api.getSettings().catch(() => ({ success: false, settings: null })),
        api.getPageContent().catch(() => ({ success: false, pageContent: null })),
        api.getSlides().catch(() => ({ success: false, slides: [] })),
        api.getNews().catch(() => ({ success: false, articles: [] })),
        api.getSchools().catch(() => ({ success: false, schools: [] })),
        api.getDepartments().catch(() => ({ success: false, departments: [] })),
        api.getProgrammes().catch(() => ({ success: false, programmes: [] })),
        api.getCourses().catch(() => ({ success: false, courses: [] })),
        api.getFeeSchedules().catch(() => ({ success: false, feeSchedules: [] })),
      ]);

      if (setRes.success && setRes.settings) setSettings(setRes.settings);
      if (pcRes.success && pcRes.pageContent) setPageContent(pcRes.pageContent);
      if (slRes.success && slRes.slides) setSlides(slRes.slides);
      if (newsRes.success && newsRes.articles) setArticles(newsRes.articles);
      if (schRes.success && schRes.schools) setSchools(schRes.schools);
      if (deptRes.success && deptRes.departments) setDepartments(deptRes.departments);
      if (progRes.success && progRes.programmes) setProgrammes(progRes.programmes);
      if (crsRes.success && crsRes.courses) setCourses(crsRes.courses);
      if (feeRes.success && feeRes.feeSchedules) setFeeSchedules(feeRes.feeSchedules);

      if (user && ADMIN_EDIT_ROLES.includes(user.role)) {
        const [stdRes, appRes, usrRes, resRes, regRes, invRes, payRes, attRes, tktRes] = await Promise.all([
          api.getStudents().catch(() => ({ success: false, students: [] })),
          api.getApplications().catch(() => ({ success: false, applications: [] })),
          api.getUsers().catch(() => ({ success: false, users: [] })),
          api.getResults().catch(() => ({ success: false, results: [] })),
          api.getRegistrations().catch(() => ({ success: false, registrations: [] })),
          api.getInvoices().catch(() => ({ success: false, invoices: [] })),
          api.getPayments().catch(() => ({ success: false, payments: [] })),
          api.getAttendance().catch(() => ({ success: false, attendance: [] })),
          api.getSupportTickets().catch(() => ({ success: false, tickets: [] })),
        ]);
        if (stdRes.success && stdRes.students) setStudents(stdRes.students);
        if (appRes.success && appRes.applications) setApplications(appRes.applications);
        if (usrRes.success && usrRes.users) setUsersList(usrRes.users);
        if (resRes.success && resRes.results) setResults(resRes.results);
        if (regRes.success && regRes.registrations) setRegistrations(regRes.registrations);
        if (invRes.success && invRes.invoices) setInvoices(invRes.invoices);
        if (payRes.success && payRes.payments) setPayments(payRes.payments);
        if (attRes.success && attRes.attendance) setAttendance(attRes.attendance);
        if (tktRes.success && tktRes.tickets) setTickets(tktRes.tickets);
      } else {
        setStudents([]);
        setApplications([]);
        setUsersList([]);
        setResults([]);
        setRegistrations([]);
        setInvoices([]);
        setPayments([]);
        setAttendance([]);
        setTickets([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAppInfo();
  }, [user?.id, user?.role]);

  useEffect(() => {
    setConfirmDeleteKey(null);
    setTicketReplyDraft('');
  }, [selected]);

  const isSelected = (type: SelectedItem['type'], id?: string) => {
    if (selected.type !== type) return false;
    if (!id) return true;
    return 'id' in selected && selected.id === id;
  };

  const outlineCls = (active: boolean) =>
    active
      ? 'ring-2 ring-amber-500 bg-amber-50/30 dark:bg-amber-950/20 shadow-md'
      : 'hover:ring-2 hover:ring-emerald-500/60 cursor-pointer';

  const matchesQuery = (...fields: Array<string | number | undefined>) => {
    return matchesWildcard(searchQuery, ...fields);
  };

  const renderImageEditor = (
    title: string,
    value: string | undefined,
    onChange: (nextVal: string) => void,
    options: { preserveTransparency?: boolean; maxDimension?: number; placeholder?: string } = {}
  ) => (
    <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> {title}
        </span>
        <div className="flex items-center gap-1.5">
          <label className="px-2 py-1 bg-emerald-800 hover:bg-emerald-900 text-white text-[10px] font-bold rounded cursor-pointer flex items-center gap-1">
            <Upload className="w-3 h-3" /> Upload
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const dataUrl = await readImageFileAsDataUrl(file, {
                    maxDimension: options.maxDimension || 1200,
                    preserveTransparency: Boolean(options.preserveTransparency),
                    quality: 0.85,
                  });
                  onChange(dataUrl);
                  showToast('success', `${title} uploaded. Click Save to persist.`);
                } catch (err: any) {
                  showToast('error', err.message || 'Failed to read image file.');
                }
              }}
              className="hidden"
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold rounded cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      {value && (
        <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center">
          <img src={value} alt={title} className="max-h-20 object-contain rounded" />
        </div>
      )}
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={options.placeholder || 'Paste image URL or upload file above...'}
        className={inputCls}
      />
    </div>
  );

  // ==================== SAVE & MUTATION HELPERS ====================

  const ensureCanEdit = () => {
    if (!canEdit) {
      showToast('error', 'Click "Quick Super Admin" on the left (or Sign In) to save changes.');
      return false;
    }
    return true;
  };

  const saveSettings = async () => {
    if (!settings || !ensureCanEdit()) return;
    setSaving(true);
    try {
      const [res, pcRes] = await Promise.all([
        api.updateSettings(settings),
        api.updatePageContent({
          portalBannerText: pageContent.portalBannerText,
          portalBadgeText: pageContent.portalBadgeText,
        }),
      ]);
      if (res.success) {
        setSettings(res.settings);
        await refreshSettings();
      }
      if (pcRes.success && pcRes.pageContent) {
        setPageContent(pcRes.pageContent);
        await refreshPageContent();
      }
      showToast('success', 'Institution settings & banner saved.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save institution settings.');
    } finally {
      setSaving(false);
    }
  };

  const savePageContent = async (updatedContent: PageContent = pageContent, successMsg = 'Page content saved.') => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updatePageContent(updatedContent);
      if (res.success) {
        setPageContent(res.pageContent);
        await refreshPageContent();
        showToast('success', successMsg);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save page content.');
    } finally {
      setSaving(false);
    }
  };

  const saveSlide = async (slide: HeroSlide) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateSlide(slide.id, slide);
      if (res.success) {
        setSlides((prev) => prev.map((s) => (s.id === slide.id ? res.slide : s)));
        showToast('success', 'Hero slide saved.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update slide.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlide = async () => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.createSlide({
        title: 'New Campus Highlight Banner',
        subtitle: 'Edit this headline, subtitle, gradient, and action button from the left inspector.',
        badge: 'Announcement',
        bgGradient: 'from-emerald-950 via-emerald-900 to-slate-950',
        accentColor: 'amber-400',
        ctaText: 'Explore Admissions',
        ctaTab: 'admissions',
        ctaSubSection: 'form',
        iconName: 'Sparkles',
        order: slides.length + 1,
        isActive: true,
      });
      if (res.success && res.slide) {
        setSlides((prev) => [...prev, res.slide]);
        setActiveSlidePreviewIdx(slides.length);
        setSelected({ type: 'slide', id: res.slide.id });
        showToast('success', 'New hero slide added.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add slide.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlide = async (id: string) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      await api.deleteSlide(id);
      setSlides((prev) => prev.filter((s) => s.id !== id));
      setActiveSlidePreviewIdx(0);
      setSelected({ type: 'overview' });
      showToast('success', 'Slide deleted.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete slide.');
    } finally {
      setSaving(false);
    }
  };

  const saveArticle = async (article: NewsArticle) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateNewsArticle(article.id, article);
      if (res.success) {
        setArticles((prev) => prev.map((a) => (a.id === article.id ? res.article : a)));
        showToast('success', 'News bulletin saved.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update news bulletin.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddArticle = async () => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.createNewsArticle({
        title: 'New Campus Press Release',
        summary: 'Short summary of this announcement shown on the public portal card.',
        content: 'Full official announcement details for students, applicants, and college staff.',
        category: 'Academics',
        status: 'PUBLISHED',
        isFeaturedInSlider: false,
        author: user?.fullName || 'Office of the Registrar',
      });
      if (res.success && res.article) {
        setArticles((prev) => [res.article, ...prev]);
        setSelected({ type: 'article', id: res.article.id });
        showToast('success', 'New news bulletin created.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create news bulletin.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      await api.deleteNewsArticle(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      setSelected({ type: 'overview' });
      showToast('success', 'News bulletin deleted.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete news bulletin.');
    } finally {
      setSaving(false);
    }
  };

  const saveSchool = async (school: School) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateSchool(school.id, school);
      if (res.success) {
        setSchools((prev) => prev.map((s) => (s.id === school.id ? res.school : s)));
        showToast('success', 'School updated.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update school.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSchool = async () => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.createSchool({
        code: `SCH-${schools.length + 1}`,
        name: 'New Academic School / Faculty',
        description: 'Describe the departments and hands-on focus of this school.',
      });
      if (res.success && res.school) {
        setSchools((prev) => [...prev, res.school]);
        setSelected({ type: 'school', id: res.school.id });
        showToast('success', 'New school added.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add school.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchool = async (id: string) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      await api.deleteSchool(id);
      setSchools((prev) => prev.filter((s) => s.id !== id));
      setSelected({ type: 'overview' });
      showToast('success', 'School deleted.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete school.');
    } finally {
      setSaving(false);
    }
  };

  const saveDepartment = async (dept: Department) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateDepartment(dept.id, dept);
      if (res.success) {
        setDepartments((prev) => prev.map((d) => (d.id === dept.id ? res.department : d)));
        showToast('success', 'Department updated.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update department.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDepartment = async (schoolId?: string) => {
    if (!ensureCanEdit()) return;
    const targetSchool = schoolId || schools[0]?.id;
    if (!targetSchool) return;
    setSaving(true);
    try {
      const res = await api.createDepartment({
        schoolId: targetSchool,
        code: `DPT${departments.length + 1}`,
        name: 'New Academic Department',
      });
      if (res.success && res.department) {
        setDepartments((prev) => [...prev, res.department]);
        setSelected({ type: 'department', id: res.department.id });
        showToast('success', 'New department created.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add department.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      await api.deleteDepartment(id);
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      setSelected({ type: 'overview' });
      showToast('success', 'Department deleted.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete department.');
    } finally {
      setSaving(false);
    }
  };

  const saveProgramme = async (prog: Programme) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateProgramme(prog.id, prog);
      if (res.success) {
        setProgrammes((prev) => prev.map((p) => (p.id === prog.id ? res.programme : p)));
        showToast('success', 'Programme saved.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update programme.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddProgramme = async (departmentId?: string) => {
    if (!ensureCanEdit()) return;
    const targetDept = departmentId || departments[0]?.id;
    if (!targetDept) return;
    setSaving(true);
    try {
      const res = await api.createProgramme({
        departmentId: targetDept,
        code: `PRG-${programmes.length + 1}`,
        name: 'ND New Academic Programme',
        qualification: 'ND',
        durationYears: 2,
        description: 'Accredited diploma programme combining classroom instruction with practical training.',
        requirements: ['5 Credits in SSCE/WAEC/NECO including English & Mathematics'],
      });
      if (res.success && res.programme) {
        setProgrammes((prev) => [...prev, res.programme]);
        setSelected({ type: 'programme', id: res.programme.id });
        showToast('success', 'New programme added.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add programme.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProgramme = async (id: string) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      await api.deleteProgramme(id);
      setProgrammes((prev) => prev.filter((p) => p.id !== id));
      setSelected({ type: 'overview' });
      showToast('success', 'Programme deleted.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete programme.');
    } finally {
      setSaving(false);
    }
  };

  const saveCourse = async (course: Course) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateCourse(course.id, course);
      if (res.success) {
        setCourses((prev) => prev.map((c) => (c.id === course.id ? res.course : c)));
        showToast('success', `Course ${res.course.code} updated.`);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update course.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCourse = async () => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.createCourse({
        departmentId: departments[0]?.id || 'dept-agric',
        code: `NEW ${100 + courses.length}`,
        title: 'New Course Offering',
        creditUnits: 3,
        level: 'ND I',
        semester: 'First Semester',
        lecturerName: 'Departmental Staff',
      });
      if (res.success && res.course) {
        setCourses((prev) => [...prev, res.course]);
        setSelected({ type: 'course', id: res.course.id });
        showToast('success', 'New course created.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create course.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      await api.deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
      setSelected({ type: 'overview' });
      showToast('success', 'Course deleted.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete course.');
    } finally {
      setSaving(false);
    }
  };

  const saveFeeSchedule = async (fee: FeeSchedule) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateFeeSchedule(fee.id, fee);
      if (res.success) {
        setFeeSchedules((prev) => prev.map((f) => (f.id === fee.id ? res.feeSchedule : f)));
        showToast('success', 'Fee item saved.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update fee item.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFee = async () => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.createFeeSchedule({
        title: 'New Institutional Fee Item',
        category: 'Tuition',
        level: 'ND I',
        session: settings?.currentSession || '2025/2026',
        amount: 10000,
      });
      if (res.success && res.feeSchedule) {
        setFeeSchedules((prev) => [...prev, res.feeSchedule]);
        setSelected({ type: 'fee', id: res.feeSchedule.id });
        showToast('success', 'New fee item added.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create fee item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFee = async (id: string) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      await api.deleteFeeSchedule(id);
      setFeeSchedules((prev) => prev.filter((f) => f.id !== id));
      setSelected({ type: 'overview' });
      showToast('success', 'Fee item deleted.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete fee item.');
    } finally {
      setSaving(false);
    }
  };

  const saveInvoice = async (inv: Invoice) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateInvoice(inv.id, {
        title: inv.title,
        amount: inv.amount,
        amountPaid: inv.amountPaid,
        status: inv.status,
        dueDate: inv.dueDate,
        session: inv.session,
      });
      if (res.success) {
        setInvoices((prev) => prev.map((i) => (i.id === inv.id ? res.invoice : i)));
        showToast('success', 'Invoice updated.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update invoice.');
    } finally {
      setSaving(false);
    }
  };

  const saveResult = async (resItem: AssessmentResult) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateResult(resItem.id, {
        caScore: resItem.caScore,
        examScore: resItem.examScore,
        status: resItem.status,
      });
      if (res.success) {
        setResults((prev) => prev.map((r) => (r.id === resItem.id ? res.result : r)));
        showToast('success', 'Assessment result updated.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update assessment result.');
    } finally {
      setSaving(false);
    }
  };

  const approveReg = async (regId: string) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.approveRegistration(regId);
      if (res.success) {
        setRegistrations((prev) => prev.map((r) => (r.id === regId ? res.registration : r)));
        showToast('success', 'Course registration approved.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to approve registration.');
    } finally {
      setSaving(false);
    }
  };

  const saveAttendance = async (att: AttendanceSession) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateAttendanceSession(att.id, {
        topic: att.topic,
        type: att.type,
        date: att.date,
      });
      if (res.success) {
        setAttendance((prev) => prev.map((a) => (a.id === att.id ? res.session : a)));
        showToast('success', 'Attendance session updated.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update attendance session.');
    } finally {
      setSaving(false);
    }
  };

  const saveTicket = async (tkt: SupportTicket) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateSupportTicket(tkt.id, {
        status: tkt.status,
        priority: tkt.priority,
        subject: tkt.subject,
        category: tkt.category,
      });
      if (res.success) {
        let latest = res.ticket;
        if (ticketReplyDraft.trim()) {
          const rep = await api.replySupportTicket(tkt.id, ticketReplyDraft.trim());
          if (rep.success) latest = rep.ticket;
          setTicketReplyDraft('');
        }
        setTickets((prev) => prev.map((t) => (t.id === tkt.id ? latest : t)));
        showToast('success', 'Support ticket saved.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update support ticket.');
    } finally {
      setSaving(false);
    }
  };

  const saveStudent = async (student: Student) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateStudent(student.id, {
        fullName: student.fullName,
        phone: student.phone,
        photoUrl: student.photoUrl,
        matricNumber: student.matricNumber,
        level: student.level,
        academicStatus: student.academicStatus,
        cgpa: student.cgpa,
        totalCreditsEarned: student.totalCreditsEarned,
        emergencyContact: student.emergencyContact,
        nextOfKin: student.nextOfKin,
      });
      if (res.success) {
        showToast('success', 'Student record updated.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update student record.');
    } finally {
      setSaving(false);
    }
  };

  const saveApplication = async (app: AdmissionApplication) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.reviewApplication(app.id, {
        status: app.status,
        screeningNotes: app.screeningNotes,
      });
      if (res.success) {
        setApplications((prev) => prev.map((a) => (a.id === app.id ? res.application : a)));
        showToast('success', 'Admission application decision saved.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save application decision.');
    } finally {
      setSaving(false);
    }
  };

  const saveUser = async (usr: User) => {
    if (!ensureCanEdit()) return;
    setSaving(true);
    try {
      const res = await api.updateUser(usr.id, {
        fullName: usr.fullName,
        phone: usr.phone,
        role: usr.role,
        isLocked: usr.isLocked,
        isActive: usr.isActive,
      });
      if (res.success) {
        setUsersList((prev) => prev.map((u) => (u.id === usr.id ? res.user : u)));
        showToast('success', 'User account saved.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  // Page Content Array Helpers
  const handleAddCalendarItem = async () => {
    const newItem: CalendarHighlight = {
      id: 'cal-' + Date.now(),
      title: 'New Academic Milestone',
      description: 'Provide schedule details and target student levels.',
      statusLabel: 'Upcoming',
    };
    const next = { ...pageContent, calendarItems: [...pageContent.calendarItems, newItem] };
    setPageContent(next);
    setSelected({ type: 'calendarItem', id: newItem.id });
    if (canEdit) await savePageContent(next, 'Calendar highlight added.');
  };

  const handleAddFaq = async () => {
    const newFaq: FaqItem = {
      id: 'faq-' + Date.now(),
      q: 'New Frequently Asked Question?',
      a: 'Provide a clear official response for applicants and students.',
    };
    const next = { ...pageContent, faqs: [...pageContent.faqs, newFaq] };
    setPageContent(next);
    setSelected({ type: 'faq', id: newFaq.id });
    if (canEdit) await savePageContent(next, 'FAQ added.');
  };

  const handleAddCustomSection = async () => {
    const newSec: CustomPageSection = {
      id: 'custom-' + Date.now(),
      kicker: 'Campus Highlight',
      title: 'New Custom Portal Section',
      body: 'Add announcements, research farm initiatives, scholarship notices, or campus spotlight details here.',
      ctaText: 'Learn More',
      ctaTab: 'admissions',
      style: 'emerald',
      isVisible: true,
    };
    const next: PageContent = {
      ...pageContent,
      customSections: [...(pageContent.customSections || []), newSec],
      sectionOrder: [...(pageContent.sectionOrder || []), newSec.id],
    };
    setPageContent(next);
    setSelected({ type: 'customSection', id: newSec.id });
    if (canEdit) await savePageContent(next, 'Custom section added to page.');
  };

  const moveSection = async (index: number, direction: -1 | 1) => {
    const order = [...(pageContent.sectionOrder || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= order.length) return;
    [order[index], order[targetIdx]] = [order[targetIdx], order[index]];
    const next = { ...pageContent, sectionOrder: order };
    setPageContent(next);
    if (canEdit) await savePageContent(next, 'Section order updated.');
  };

  const toggleSectionVisibility = async (sectionKey: string) => {
    const hidden = new Set(pageContent.hiddenSections || []);
    if (hidden.has(sectionKey)) hidden.delete(sectionKey);
    else hidden.add(sectionKey);
    const next = { ...pageContent, hiddenSections: Array.from(hidden) };
    setPageContent(next);
    if (canEdit) await savePageContent(next, 'Section visibility updated.');
  };

  const allSectionKeys = useMemo(() => {
    const baseOrder = pageContent.sectionOrder?.length
      ? [...pageContent.sectionOrder]
      : ['hero', 'news', 'rector', 'schools', 'calendar', 'faqs', 'footer'];
    (pageContent.customSections || []).forEach((c) => {
      if (!baseOrder.includes(c.id)) baseOrder.push(c.id);
    });
    return baseOrder;
  }, [pageContent.sectionOrder, pageContent.customSections]);

  const inputCls =
    'w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600';
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1';

  // ==================== LEFT PANEL INSPECTOR RENDERER ====================

  const renderLeftEditor = () => {
    if (selected.type === 'overview') {
      const totalItems =
        slides.length +
        articles.length +
        schools.length +
        departments.length +
        programmes.length +
        courses.length +
        feeSchedules.length +
        students.length +
        applications.length +
        usersList.length +
        results.length +
        invoices.length +
        tickets.length;

      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Click Any Information on the Right</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              All information across EDOCASTI is displayed on the right side. Click any block, card, school,
              programme, course, fee, student, or record to edit it here immediately.
            </p>
          </div>

          {/* Section Order & Visibility */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Public Page Sections Order
              </span>
              <button
                onClick={handleAddCustomSection}
                className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3 h-3" /> Add Section
              </button>
            </div>

            <div className="space-y-1.5">
              {allSectionKeys.map((key, idx) => {
                const custom = (pageContent.customSections || []).find((c) => c.id === key);
                const label = custom ? `Custom: ${custom.title}` : SECTION_LABELS[key] || key;
                const isHidden = (pageContent.hiddenSections || []).includes(key);
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs ${
                      isHidden
                        ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (custom) setSelected({ type: 'customSection', id: custom.id });
                        else if (key === 'rector') setSelected({ type: 'rector' });
                        else if (key === 'news') setSelected({ type: 'newsHeader' });
                        else if (key === 'schools') setSelected({ type: 'schoolsHeader' });
                        else if (key === 'calendar') setSelected({ type: 'calendarHeader' });
                        else if (key === 'faqs') setSelected({ type: 'faqHeader' });
                        else if (key === 'footer') setSelected({ type: 'footer' });
                        else if (key === 'hero' && slides[0]) setSelected({ type: 'slide', id: slides[0].id });
                      }}
                      className="text-left font-semibold truncate flex-1 hover:text-emerald-700 dark:hover:text-amber-400 cursor-pointer"
                    >
                      {label}
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveSection(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveSection(idx, 1)}
                        disabled={idx === allSectionKeys.length - 1}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleSectionVisibility(key)}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title={isHidden ? 'Show Section' : 'Hide Section'}
                      >
                        {isHidden ? (
                          <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Jump Categories */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
              App Information Directory ({totalItems} Items)
            </span>

            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <button
                onClick={() => setSelected({ type: 'header' })}
                className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-300 dark:border-emerald-800 hover:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
                  <Palette className="w-4 h-4" /> Main Header Appearance
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
              <button
                onClick={() => setSelected({ type: 'settings' })}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-600 bg-white dark:bg-slate-900 cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                  <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Institution Identity &amp; Rules
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => (slides[0] ? setSelected({ type: 'slide', id: slides[0].id }) : handleAddSlide())}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-600 bg-white dark:bg-slate-900 cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                  <LayoutTemplate className="w-4 h-4 text-amber-600" /> Hero Slideshow ({slides.length})
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => setSelected({ type: 'rector' })}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-600 bg-white dark:bg-slate-900 cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                  <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Rector&apos;s Profile &amp; Mission
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => (schools[0] ? setSelected({ type: 'school', id: schools[0].id }) : handleAddSchool())}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-600 bg-white dark:bg-slate-900 cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                  <GraduationCap className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Schools ({schools.length}), Depts ({departments.length}), Programmes ({programmes.length})
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => (courses[0] ? setSelected({ type: 'course', id: courses[0].id }) : handleAddCourse())}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-600 bg-white dark:bg-slate-900 cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                  <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Course Catalogue ({courses.length})
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => (feeSchedules[0] ? setSelected({ type: 'fee', id: feeSchedules[0].id }) : handleAddFee())}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-600 bg-white dark:bg-slate-900 cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                  <Wallet className="w-4 h-4 text-amber-600" /> Bursary Fee Schedules ({feeSchedules.length})
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // MAIN HEADER APPEARANCE EDITOR
    if (selected.type === 'header') {
      const headerColors = [
        ['Background Colour', 'headerBgColor', '#047857'],
        ['Secondary Background', 'headerBgSecondaryColor', '#065f46'],
        ['Main Text Colour', 'headerTextColor', '#ffffff'],
        ['Institution Subtitle Colour', 'headerSubtitleColor', '#d1fae5'],
        ['Brand Accent Colour', 'headerAccentColor', '#fbbf24'],
        ['Navigation Surface', 'headerNavBgColor', '#0b6b50'],
        ['Navigation Text Colour', 'headerNavTextColor', '#ffffff'],
        ['Border Colour', 'headerBorderColor', '#065f46'],
      ] as const;
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Portal Branding</span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Main Header Appearance</h3>
            </div>
            <button onClick={() => savePageContent()} disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Header'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Customize the main portal header background, typography, brand accent, navigation surface and border. Changes appear in the preview immediately.</p>
          {renderImageEditor('Header Background Image', pageContent.headerBackgroundImageUrl, (v) =>
            setPageContent({ ...pageContent, headerBackgroundImageUrl: v }), { maxDimension: 1800 }
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {headerColors.map(([label, key, fallback]) => (
              <label key={key} className="space-y-1">
                <span className={labelCls}>{label}</span>
                <div className="flex items-center gap-2">
                  <input type="color" value={(pageContent as any)[key] || fallback}
                    onChange={(e) => setPageContent({ ...pageContent, [key]: e.target.value })}
                    className="h-9 w-11 rounded border border-slate-300 dark:border-slate-700 bg-white p-1 cursor-pointer" />
                  <input type="text" value={(pageContent as any)[key] || ''}
                    onChange={(e) => setPageContent({ ...pageContent, [key]: e.target.value })}
                    placeholder={fallback} className={inputCls} />
                </div>
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setPageContent({
            ...pageContent, headerBackgroundImageUrl: '', headerBgColor: '', headerBgSecondaryColor: '',
            headerTextColor: '', headerSubtitleColor: '', headerAccentColor: '', headerNavBgColor: '',
            headerNavTextColor: '', headerBorderColor: '',
          })} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
            <RotateCcw className="w-3 h-3 inline mr-1" /> Reset appearance to defaults
          </button>
        </div>
      );
    }

    // 1. INSTITUTION SETTINGS EDITOR
    if (selected.type === 'settings' && settings) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Global System Profile
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Institution Settings</h3>
            </div>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Institution Full Name</label>
              <input
                type="text"
                value={settings.institutionName}
                onChange={(e) => setSettings({ ...settings, institutionName: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Short Acronym</label>
                <input
                  type="text"
                  value={settings.shortName}
                  onChange={(e) => setSettings({ ...settings, shortName: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Current Session</label>
                <input
                  type="text"
                  value={settings.currentSession}
                  onChange={(e) => setSettings({ ...settings, currentSession: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Motto</label>
              <input
                type="text"
                value={settings.motto}
                onChange={(e) => setSettings({ ...settings, motto: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Current Semester</label>
                <select
                  value={settings.currentSemester}
                  onChange={(e) => setSettings({ ...settings, currentSemester: e.target.value })}
                  className={inputCls}
                >
                  <option value="First Semester">First Semester</option>
                  <option value="Second Semester">Second Semester</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>State / Country</label>
                <input
                  type="text"
                  value={`${settings.state}, ${settings.country}`}
                  onChange={(e) => {
                    const [st, ct] = e.target.value.split(',').map((s) => s.trim());
                    setSettings({ ...settings, state: st || '', country: ct || settings.country });
                  }}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>CA Max Marks</label>
                <input
                  type="number"
                  value={settings.caMaxMarks}
                  onChange={(e) => setSettings({ ...settings, caMaxMarks: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Exam Max Marks</label>
                <input
                  type="number"
                  value={settings.examMaxMarks}
                  onChange={(e) => setSettings({ ...settings, examMaxMarks: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Contact Email</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="space-y-2">
              <label className={labelCls}>Applicant State &amp; LGA Dropdown Data (JSON)</label>
              <p className="text-[10px] text-slate-500">Edit the state-to-LGA mapping. Keep the JSON format: state names mapped to arrays of LGA names. Default dataset contains 37 states including FCT and 774 LGAs.</p>
              <textarea rows={10} value={settings.nigeriaLocationDataJson || JSON.stringify(NIGERIA_LGAS,null,2)} onChange={(e) => setSettings({ ...settings, nigeriaLocationDataJson: e.target.value })} className={inputCls + ' font-mono'} />
            </div>
            <div>
              <label className={labelCls}>Contact Phone</label>
              <input
                type="text"
                value={settings.contactPhone}
                onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Top Navbar Banner</label>
                <input
                  type="text"
                  value={pageContent.portalBannerText}
                  onChange={(e) => setPageContent({ ...pageContent, portalBannerText: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Portal Badge Text</label>
                <input
                  type="text"
                  value={pageContent.portalBadgeText}
                  onChange={(e) => setPageContent({ ...pageContent, portalBadgeText: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Campus Address</label>
              <textarea
                rows={2}
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="pt-2 space-y-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.admissionsOpen}
                  onChange={(e) => setSettings({ ...settings, admissionsOpen: e.target.checked })}
                  className="rounded text-emerald-700"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">Admissions Portal Open</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.courseRegistrationOpen}
                  onChange={(e) => setSettings({ ...settings, courseRegistrationOpen: e.target.checked })}
                  className="rounded text-emerald-700"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">Course Registration Open</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.feePaymentRequiredForReg}
                  onChange={(e) => setSettings({ ...settings, feePaymentRequiredForReg: e.target.checked })}
                  className="rounded text-emerald-700"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Require Fee Settlement Before Course Reg
                </span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Document Fees &amp; Editable Official Images (Logo, Stamp &amp; Signatures)
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>Transcript Fee (₦)</label>
                  <input
                    type="number"
                    value={settings.transcriptFee ?? 15000}
                    onChange={(e) => setSettings({ ...settings, transcriptFee: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Certificate Fee (₦)</label>
                  <input
                    type="number"
                    value={settings.certificateFee ?? 25000}
                    onChange={(e) => setSettings({ ...settings, certificateFee: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
              </div>
              {renderImageEditor('Institution Official Logo', settings.logoUrl, (v) => setSettings({ ...settings, logoUrl: v }), {
                preserveTransparency: true,
                maxDimension: 600,
              })}
              {renderImageEditor('Official School Stamp', settings.schoolStampUrl, (v) => setSettings({ ...settings, schoolStampUrl: v }), {
                preserveTransparency: true,
                maxDimension: 600,
              })}
              {renderImageEditor('Registrar Signature', settings.registrarSignatureUrl, (v) => setSettings({ ...settings, registrarSignatureUrl: v }), {
                preserveTransparency: true,
                maxDimension: 600,
              })}
              {renderImageEditor('Rector Signature', settings.rectorSignatureUrl, (v) => setSettings({ ...settings, rectorSignatureUrl: v }), {
                preserveTransparency: true,
                maxDimension: 600,
              })}
              {renderImageEditor('Bursar Signature', settings.bursarSignatureUrl, (v) => setSettings({ ...settings, bursarSignatureUrl: v }), {
                preserveTransparency: true,
                maxDimension: 600,
              })}
            </div>
          </div>
        </div>
      );
    }

    // 2. HERO SLIDE EDITOR
    if (selected.type === 'slide') {
      const slide = slides.find((s) => s.id === selected.id);
      if (!slide) return <p className="text-xs text-slate-500">Slide not found.</p>;
      const updateLocal = (patch: Partial<HeroSlide>) =>
        setSlides((prev) => prev.map((s) => (s.id === slide.id ? { ...s, ...patch } : s)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Hero Slideshow</span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit Hero Slide</h3>
            </div>
            <button
              onClick={() => saveSlide(slide)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Slide'}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Headline Title</label>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => updateLocal({ title: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Subtitle / Description</label>
              <textarea
                rows={3}
                value={slide.subtitle}
                onChange={(e) => updateLocal({ subtitle: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Badge Label</label>
                <input
                  type="text"
                  value={slide.badge}
                  onChange={(e) => updateLocal({ badge: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Display Order</label>
                <input
                  type="number"
                  value={slide.order}
                  onChange={(e) => updateLocal({ order: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>CTA Button Text</label>
                <input
                  type="text"
                  value={slide.ctaText}
                  onChange={(e) => updateLocal({ ctaText: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>CTA Target Tab</label>
                <select
                  value={slide.ctaTab}
                  onChange={(e) => updateLocal({ ctaTab: e.target.value })}
                  className={inputCls}
                >
                  <option value="public">Public Portal</option>
                  <option value="admissions">Admissions</option>
                  <option value="student">Student Portal</option>
                  <option value="lecturer">Faculty Portal</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Gradient Theme (Fallback)</label>
              <select
                value={slide.bgGradient}
                onChange={(e) => updateLocal({ bgGradient: e.target.value })}
                className={inputCls}
              >
                <option value="from-emerald-950 via-emerald-900 to-slate-950">Emerald &amp; Slate</option>
                <option value="from-slate-950 via-emerald-950 to-amber-950">Deep Forest &amp; Amber</option>
                <option value="from-emerald-900 via-teal-900 to-slate-900">Teal &amp; Agronomy Green</option>
                <option value="from-slate-900 via-indigo-950 to-slate-950">Midnight Academic</option>
              </select>
            </div>

            {/* Full Hero Color Customizer */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> Hero Background &amp; Element Colors
                </span>
                <button
                  type="button"
                  onClick={() => updateLocal(EMPTY_HERO_COLORS)}
                  className="px-2 py-1 text-[10px] font-bold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>

              {/* 1-Click Theme Presets */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Quick Presets</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {HERO_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => updateLocal(preset.colors)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-600 text-[11px] font-semibold text-slate-800 dark:text-slate-200 cursor-pointer transition"
                    >
                      <span>{preset.name}</span>
                      <span className="flex items-center gap-1">
                        {preset.swatch.map((hex, i) => (
                          <span
                            key={i}
                            style={{ backgroundColor: hex }}
                            className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600"
                          />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Color Pickers */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {HERO_COLOR_CONTROLS.map(({ key, label, fallback }) => {
                  const currentVal = slide[key] || '';
                  return (
                    <div key={key} className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">
                        {label}
                      </label>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1">
                        <input
                          type="color"
                          value={currentVal || fallback}
                          onChange={(e) => updateLocal({ [key]: e.target.value })}
                          className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                          title={`Pick ${label}`}
                        />
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) => updateLocal({ [key]: e.target.value })}
                          placeholder={fallback}
                          className="w-full text-[10px] font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {renderImageEditor('Slide Background Image', slide.imageUrl, (v) => updateLocal({ imageUrl: v }), {
              maxDimension: 1400,
            })}

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={slide.isActive}
                onChange={(e) => updateLocal({ isActive: e.target.checked })}
                className="rounded text-emerald-700"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Slide Active on Public Homepage</span>
            </label>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              {confirmDeleteKey === `slide-${slide.id}` ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteSlide(slide.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteKey(null)}
                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteKey(`slide-${slide.id}`)}
                  className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Slide
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 3. NEWS SECTION HEADER
    if (selected.type === 'newsHeader') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Section Copy
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">News Section Heading</h3>
            </div>
            <button
              onClick={() => savePageContent()}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div>
            <label className={labelCls}>Kicker</label>
            <input
              type="text"
              value={pageContent.newsSectionKicker}
              onChange={(e) => setPageContent({ ...pageContent, newsSectionKicker: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Main Heading</label>
            <input
              type="text"
              value={pageContent.newsSectionHeading}
              onChange={(e) => setPageContent({ ...pageContent, newsSectionHeading: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
      );
    }

    // 4. NEWS ARTICLE EDITOR
    if (selected.type === 'article') {
      const article = articles.find((a) => a.id === selected.id);
      if (!article) return <p className="text-xs text-slate-500">Article not found.</p>;
      const updateLocal = (patch: Partial<NewsArticle>) =>
        setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, ...patch } : a)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Press Bulletin
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit News Article</h3>
            </div>
            <button
              onClick={() => saveArticle(article)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Article
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Headline</label>
              <input
                type="text"
                value={article.title}
                onChange={(e) => updateLocal({ title: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Category</label>
                <select
                  value={article.category}
                  onChange={(e) => updateLocal({ category: e.target.value as NewsArticle['category'] })}
                  className={inputCls}
                >
                  <option value="Admissions">Admissions</option>
                  <option value="Academics">Academics</option>
                  <option value="Research & Farm">Research &amp; Farm</option>
                  <option value="Campus Life">Campus Life</option>
                  <option value="Notice">Notice</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={article.status}
                  onChange={(e) => updateLocal({ status: e.target.value as NewsArticle['status'] })}
                  className={inputCls}
                >
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Author / Office</label>
              <input
                type="text"
                value={article.author}
                onChange={(e) => updateLocal({ author: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Summary (Card Preview)</label>
              <textarea
                rows={2}
                value={article.summary}
                onChange={(e) => updateLocal({ summary: e.target.value })}
                className={inputCls}
              />
            </div>

            {renderImageEditor('Article Cover Image', article.imageUrl, (v) => updateLocal({ imageUrl: v }), {
              maxDimension: 1200,
            })}

            <div>
              <label className={labelCls}>Full Story Body</label>
              <textarea
                rows={5}
                value={article.content}
                onChange={(e) => updateLocal({ content: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              {confirmDeleteKey === `article-${article.id}` ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteArticle(article.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteKey(null)}
                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteKey(`article-${article.id}`)}
                  className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Article
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 5. RECTOR SECTION EDITOR
    if (selected.type === 'rector') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Leadership Block
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Rector&apos;s Message</h3>
            </div>
            <button
              onClick={() => savePageContent()}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Rector Full Name</label>
                <input
                  type="text"
                  value={pageContent.rectorName}
                  onChange={(e) => setPageContent({ ...pageContent, rectorName: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Avatar Icon</label>
                <input
                  type="text"
                  value={pageContent.rectorAvatarEmoji}
                  onChange={(e) => setPageContent({ ...pageContent, rectorAvatarEmoji: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Title / Office</label>
              <input
                type="text"
                value={pageContent.rectorTitle}
                onChange={(e) => setPageContent({ ...pageContent, rectorTitle: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Institution Subtitle</label>
              <input
                type="text"
                value={pageContent.rectorInstitution}
                onChange={(e) => setPageContent({ ...pageContent, rectorInstitution: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Kicker</label>
              <input
                type="text"
                value={pageContent.rectorKicker}
                onChange={(e) => setPageContent({ ...pageContent, rectorKicker: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Mission Headline</label>
              <input
                type="text"
                value={pageContent.rectorHeadline}
                onChange={(e) => setPageContent({ ...pageContent, rectorHeadline: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Paragraph 1</label>
              <textarea
                rows={3}
                value={pageContent.rectorParagraph1}
                onChange={(e) => setPageContent({ ...pageContent, rectorParagraph1: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Paragraph 2</label>
              <textarea
                rows={3}
                value={pageContent.rectorParagraph2}
                onChange={(e) => setPageContent({ ...pageContent, rectorParagraph2: e.target.value })}
                className={inputCls}
              />
            </div>

            {renderImageEditor('Rector Portrait Photo', pageContent.rectorPhotoUrl, (v) =>
              setPageContent({ ...pageContent, rectorPhotoUrl: v })
            )}

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Rector Message Appearance</h4>
                <p className="text-[10px] text-slate-500 mt-1">Customize the section background, image, text, accent, border and call-to-action colours.</p>
              </div>
              {renderImageEditor('Section Background Image', pageContent.rectorBackgroundImageUrl, (v) =>
                setPageContent({ ...pageContent, rectorBackgroundImageUrl: v }),
                { maxDimension: 1800 }
              )}
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  ['Background Colour', 'rectorBgColor', '#052e24'],
                  ['Secondary Background', 'rectorBgSecondaryColor', '#064e3b'],
                  ['Main Text Colour', 'rectorTextColor', '#ffffff'],
                  ['Paragraph Colour', 'rectorSubtitleColor', '#d1fae5'],
                  ['Accent Colour', 'rectorAccentHex', '#fbbf24'],
                  ['Border Colour', 'rectorBorderColor', '#f59e0b'],
                  ['Button Background', 'rectorButtonBgColor', '#f59e0b'],
                  ['Button Text', 'rectorButtonTextColor', '#0f172a'],
                ] as const).map(([label, key, fallback]) => (
                  <label key={key} className="space-y-1">
                    <span className={labelCls}>{label}</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={(pageContent as any)[key] || fallback}
                        onChange={(e) => setPageContent({ ...pageContent, [key]: e.target.value })}
                        className="h-9 w-11 rounded border border-slate-300 dark:border-slate-700 bg-white p-1 cursor-pointer" />
                      <input type="text" value={(pageContent as any)[key] || ''}
                        onChange={(e) => setPageContent({ ...pageContent, [key]: e.target.value })}
                        placeholder={fallback} className={inputCls} />
                    </div>
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => setPageContent({
                ...pageContent, rectorBackgroundImageUrl: '', rectorBgColor: '', rectorBgSecondaryColor: '',
                rectorTextColor: '', rectorSubtitleColor: '', rectorAccentHex: '', rectorBorderColor: '',
                rectorButtonBgColor: '', rectorButtonTextColor: '',
              })} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                Reset appearance to defaults
              </button>
            </div>

            <div>
              <label className={labelCls}>Button Text</label>
              <input
                type="text"
                value={pageContent.rectorCtaText}
                onChange={(e) => setPageContent({ ...pageContent, rectorCtaText: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      );
    }

    // 6. SCHOOLS HEADER
    if (selected.type === 'schoolsHeader') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Schools Section Heading</h3>
            <button
              onClick={() => savePageContent()}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div>
            <label className={labelCls}>Kicker</label>
            <input
              type="text"
              value={pageContent.schoolsSectionKicker}
              onChange={(e) => setPageContent({ ...pageContent, schoolsSectionKicker: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Heading</label>
            <input
              type="text"
              value={pageContent.schoolsSectionHeading}
              onChange={(e) => setPageContent({ ...pageContent, schoolsSectionHeading: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Subheading</label>
            <textarea
              rows={2}
              value={pageContent.schoolsSectionSubheading}
              onChange={(e) => setPageContent({ ...pageContent, schoolsSectionSubheading: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
      );
    }

    // 7. SCHOOL EDITOR
    if (selected.type === 'school') {
      const school = schools.find((s) => s.id === selected.id);
      if (!school) return <p className="text-xs text-slate-500">School not found.</p>;
      const updateLocal = (patch: Partial<School>) =>
        setSchools((prev) => prev.map((s) => (s.id === school.id ? { ...s, ...patch } : s)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Faculty / School
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit School</h3>
            </div>
            <button
              onClick={() => saveSchool(school)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save School
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>School Code</label>
              <input
                type="text"
                value={school.code}
                onChange={(e) => updateLocal({ code: e.target.value })}
                className={`${inputCls} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={labelCls}>School Name</label>
              <input
                type="text"
                value={school.name}
                onChange={(e) => updateLocal({ name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                rows={4}
                value={school.description}
                onChange={(e) => updateLocal({ description: e.target.value })}
                className={inputCls}
              />
            </div>

            {renderImageEditor('School Banner Image', school.imageUrl, (v) => updateLocal({ imageUrl: v }), {
              maxDimension: 1000,
            })}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => handleAddDepartment(school.id)}
                className="text-xs font-bold text-emerald-800 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Department to School
              </button>

              {confirmDeleteKey === `school-${school.id}` ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteSchool(school.id)}
                    className="px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDeleteKey(null)}
                    className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-xs rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteKey(`school-${school.id}`)}
                  className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 8. DEPARTMENT EDITOR
    if (selected.type === 'department') {
      const dept = departments.find((d) => d.id === selected.id);
      if (!dept) return <p className="text-xs text-slate-500">Department not found.</p>;
      const updateLocal = (patch: Partial<Department>) =>
        setDepartments((prev) => prev.map((d) => (d.id === dept.id ? { ...d, ...patch } : d)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Academic Unit
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit Department</h3>
            </div>
            <button
              onClick={() => saveDepartment(dept)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Dept
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Parent School</label>
              <select
                value={dept.schoolId}
                onChange={(e) => updateLocal({ schoolId: e.target.value })}
                className={inputCls}
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Department Code</label>
              <input
                type="text"
                value={dept.code}
                onChange={(e) => updateLocal({ code: e.target.value })}
                className={`${inputCls} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={labelCls}>Department Name</label>
              <input
                type="text"
                value={dept.name}
                onChange={(e) => updateLocal({ name: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => handleAddProgramme(dept.id)}
                className="text-xs font-bold text-emerald-800 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Programme
              </button>

              {confirmDeleteKey === `dept-${dept.id}` ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteDepartment(dept.id)}
                    className="px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDeleteKey(null)}
                    className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-xs rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteKey(`dept-${dept.id}`)}
                  className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 9. PROGRAMME EDITOR
    if (selected.type === 'programme') {
      const prog = programmes.find((p) => p.id === selected.id);
      if (!prog) return <p className="text-xs text-slate-500">Programme not found.</p>;
      const updateLocal = (patch: Partial<Programme>) =>
        setProgrammes((prev) => prev.map((p) => (p.id === prog.id ? { ...p, ...patch } : p)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Accredited Diploma
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit Programme</h3>
            </div>
            <button
              onClick={() => saveProgramme(prog)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Department</label>
              <select
                value={prog.departmentId}
                onChange={(e) => updateLocal({ departmentId: e.target.value })}
                className={inputCls}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Code</label>
                <input
                  type="text"
                  value={prog.code}
                  onChange={(e) => updateLocal({ code: e.target.value })}
                  className={`${inputCls} font-mono uppercase`}
                />
              </div>
              <div>
                <label className={labelCls}>Qualification</label>
                <select
                  value={prog.qualification}
                  onChange={(e) => updateLocal({ qualification: e.target.value as Programme['qualification'] })}
                  className={inputCls}
                >
                  <option value="ND">ND</option>
                  <option value="HND">HND</option>
                  <option value="Certificate">Certificate</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <label className={labelCls}>Programme Name</label>
                <input
                  type="text"
                  value={prog.name}
                  onChange={(e) => updateLocal({ name: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Duration (Yrs)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={prog.durationYears}
                  onChange={(e) => updateLocal({ durationYears: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Programme Description</label>
              <textarea
                rows={3}
                value={prog.description}
                onChange={(e) => updateLocal({ description: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Entry Requirements (One per line)</label>
              <textarea
                rows={3}
                value={(prog.requirements || []).join('\n')}
                onChange={(e) =>
                  updateLocal({
                    requirements: e.target.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className={inputCls}
              />
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              {confirmDeleteKey === `prog-${prog.id}` ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteProgramme(prog.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteKey(null)}
                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteKey(`prog-${prog.id}`)}
                  className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Programme
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 10. COURSE EDITOR
    if (selected.type === 'course') {
      const course = courses.find((c) => c.id === selected.id);
      if (!course) return <p className="text-xs text-slate-500">Course not found.</p>;
      const updateLocal = (patch: Partial<Course>) =>
        setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, ...patch } : c)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Course Catalogue
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit Course {course.code}</h3>
            </div>
            <button
              onClick={() => saveCourse(course)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Course
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Course Code</label>
                <input
                  type="text"
                  value={course.code}
                  onChange={(e) => updateLocal({ code: e.target.value })}
                  className={`${inputCls} font-mono uppercase`}
                />
              </div>
              <div>
                <label className={labelCls}>Credit Units</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={course.creditUnits}
                  onChange={(e) => updateLocal({ creditUnits: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Course Title</label>
              <input
                type="text"
                value={course.title}
                onChange={(e) => updateLocal({ title: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Department</label>
              <select
                value={course.departmentId}
                onChange={(e) => updateLocal({ departmentId: e.target.value })}
                className={inputCls}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Level</label>
                <select
                  value={course.level}
                  onChange={(e) => updateLocal({ level: e.target.value })}
                  className={inputCls}
                >
                  <option value="ND I">ND I</option>
                  <option value="ND II">ND II</option>
                  <option value="HND I">HND I</option>
                  <option value="HND II">HND II</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Semester</label>
                <select
                  value={course.semester}
                  onChange={(e) => updateLocal({ semester: e.target.value as Course['semester'] })}
                  className={inputCls}
                >
                  <option value="First Semester">First Semester</option>
                  <option value="Second Semester">Second Semester</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Assigned Lecturer</label>
              <input
                type="text"
                value={course.lecturerName || ''}
                onChange={(e) => updateLocal({ lecturerName: e.target.value })}
                className={inputCls}
              />
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={course.isCompulsory}
                onChange={(e) => updateLocal({ isCompulsory: e.target.checked })}
                className="rounded text-emerald-700"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Compulsory Core Course</span>
            </label>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              {confirmDeleteKey === `crs-${course.id}` ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteCourse(course.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteKey(null)}
                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteKey(`crs-${course.id}`)}
                  className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Course
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 11. CALENDAR HEADER & ITEM
    if (selected.type === 'calendarHeader') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Calendar Section Heading</h3>
            <button
              onClick={() => savePageContent()}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div>
            <label className={labelCls}>Kicker</label>
            <input
              type="text"
              value={pageContent.calendarSectionKicker}
              onChange={(e) => setPageContent({ ...pageContent, calendarSectionKicker: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Heading</label>
            <input type="text" value={pageContent.calendarSectionHeading} onChange={(e) => setPageContent({ ...pageContent, calendarSectionHeading: e.target.value })} className={inputCls} />
          </div>
          <div><label className={labelCls}>Current Period Label</label><input type="text" value={pageContent.calendarCurrentPeriodLabel ?? 'Current Period'} onChange={(e) => setPageContent({ ...pageContent, calendarCurrentPeriodLabel: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Current Period Text (blank uses active semester)</label><input type="text" value={pageContent.calendarCurrentPeriodText ?? ''} onChange={(e) => setPageContent({ ...pageContent, calendarCurrentPeriodText: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Add Highlight Button Text</label><input type="text" value={pageContent.calendarAddHighlightLabel ?? 'Add Highlight'} onChange={(e) => setPageContent({ ...pageContent, calendarAddHighlightLabel: e.target.value })} className={inputCls} /></div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
            <h4 className="text-xs font-black text-slate-900 dark:text-white">Calendar Heading & Button Appearance</h4>
            {renderImageEditor('Section Background Image', pageContent.calendarBackgroundImageUrl, (v) => setPageContent({ ...pageContent, calendarBackgroundImageUrl: v }), { maxDimension: 1800 })}
            <div className="grid grid-cols-2 gap-2.5">
              {([
                ['Kicker Text Colour','calendarKickerColor','#fbbf24'],
                ['Heading Text Colour','calendarHeadingColor','#ffffff'],
                ['Add Highlight Button','calendarButtonBgColor','#f59e0b'],
                ['Button Text Colour','calendarButtonTextColor','#0f172a'],
              ] as const).map(([label,key,fallback]) => (
                <label key={key} className="space-y-1">
                  <span className={labelCls}>{label}</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={(pageContent as any)[key] || fallback} onChange={(e) => setPageContent({ ...pageContent, [key]: e.target.value })} className="h-9 w-11 rounded border border-slate-300 dark:border-slate-700 bg-white p-1 cursor-pointer" />
                    <input type="text" value={(pageContent as any)[key] || ''} onChange={(e) => setPageContent({ ...pageContent, [key]: e.target.value })} placeholder={fallback} className={inputCls} />
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['calendarBgColor','Section Background','#073f31'],
              ['calendarBgSecondaryColor','Gradient End','#0b5b43'],
              ['calendarTextColor','Section Text','#ffffff'],
              ['calendarAccentColor','Accent / Highlight','#fbbf24'],
              ['calendarCardBgColor','Card Background','#164e3b'],
              ['calendarCardBorderColor','Card Border','#2f6b55'],
            ] as const).map(([key,label,fallback]) => (
              <div key={key}><label className={labelCls}>{label}</label><input type="color" value={(pageContent[key]?.startsWith('#') ? pageContent[key] : fallback)} onChange={(e) => setPageContent({ ...pageContent, [key]: e.target.value })} className={inputCls} /></div>
            ))}
          </div>
        </div>
      );
    }

    if (selected.type === 'calendarItem') {
      const item = pageContent.calendarItems.find((c) => c.id === selected.id);
      if (!item) return <p className="text-xs text-slate-500">Calendar highlight not found.</p>;
      const updateItem = (patch: Partial<CalendarHighlight>) =>
        setPageContent({
          ...pageContent,
          calendarItems: pageContent.calendarItems.map((c) => (c.id === item.id ? { ...c, ...patch } : c)),
        });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit Calendar Highlight</h3>
            <button
              onClick={() => savePageContent()}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div>
            <label className={labelCls}>Milestone Title</label>
            <input
              type="text"
              value={item.title}
              onChange={(e) => updateItem({ title: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              rows={3}
              value={item.description}
              onChange={(e) => updateItem({ description: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Status Label</label>
            <input type="text" value={item.statusLabel} onChange={(e) => updateItem({ statusLabel: e.target.value })} className={inputCls} />
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Highlight Colours</h4>
            {([
              ['backgroundColor','Card Background','#164e3b'],
              ['borderColor','Card Border','#2f6b55'],
              ['titleColor','Title Text','#fbbf24'],
              ['descriptionColor','Description Text','#cbd5e1'],
              ['statusColor','Status Text','#34d399'],
              ['iconColor','Icon','#fbbf24'],
            ] as const).map(([key,label,fallback]) => (
              <div key={key}><label className={labelCls}>{label}</label><input type="color" value={item[key] || fallback} onChange={(e) => updateItem({ [key]: e.target.value })} className={inputCls} /></div>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={async () => {
                const next = {
                  ...pageContent,
                  calendarItems: pageContent.calendarItems.filter((c) => c.id !== item.id),
                };
                setPageContent(next);
                setSelected({ type: 'overview' });
                if (canEdit) await savePageContent(next, 'Calendar highlight removed.');
              }}
              className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove Highlight
            </button>
          </div>
        </div>
      );
    }

    // 12. FAQ HEADER & ITEM
    if (selected.type === 'faqHeader') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">FAQ Section Heading</h3>
            <button
              onClick={() => savePageContent()}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div>
            <label className={labelCls}>Kicker</label>
            <input
              type="text"
              value={pageContent.faqSectionKicker}
              onChange={(e) => setPageContent({ ...pageContent, faqSectionKicker: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Heading</label>
            <input
              type="text"
              value={pageContent.faqSectionHeading}
              onChange={(e) => setPageContent({ ...pageContent, faqSectionHeading: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
      );
    }

    if (selected.type === 'faq') {
      const faq = pageContent.faqs.find((f) => f.id === selected.id);
      if (!faq) return <p className="text-xs text-slate-500">FAQ not found.</p>;
      const updateFaq = (patch: Partial<FaqItem>) =>
        setPageContent({
          ...pageContent,
          faqs: pageContent.faqs.map((f) => (f.id === faq.id ? { ...f, ...patch } : f)),
        });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit FAQ Item</h3>
            <button
              onClick={() => savePageContent()}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div>
            <label className={labelCls}>Question</label>
            <input
              type="text"
              value={faq.q}
              onChange={(e) => updateFaq({ q: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Answer</label>
            <textarea
              rows={4}
              value={faq.a}
              onChange={(e) => updateFaq({ a: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={async () => {
                const next = {
                  ...pageContent,
                  faqs: pageContent.faqs.filter((f) => f.id !== faq.id),
                };
                setPageContent(next);
                setSelected({ type: 'overview' });
                if (canEdit) await savePageContent(next, 'FAQ removed.');
              }}
              className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove FAQ
            </button>
          </div>
        </div>
      );
    }

    // 13. FOOTER EDITOR
    if (selected.type === 'footer') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Campus Footer</h3>
            <button
              onClick={() => savePageContent()}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Footer Brand Title</label>
              <input
                type="text"
                value={pageContent.footerBrandTitle}
                onChange={(e) => setPageContent({ ...pageContent, footerBrandTitle: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Footer Subtitle</label>
              <input
                type="text"
                value={pageContent.footerBrandSubtitle}
                onChange={(e) => setPageContent({ ...pageContent, footerBrandSubtitle: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Footer Description</label>
              <textarea
                rows={3}
                value={pageContent.footerDescription}
                onChange={(e) => setPageContent({ ...pageContent, footerDescription: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Location Heading</label>
              <input
                type="text"
                value={pageContent.footerLocationHeading}
                onChange={(e) => setPageContent({ ...pageContent, footerLocationHeading: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Location Address</label>
              <textarea
                rows={2}
                value={pageContent.footerLocationAddress}
                onChange={(e) => setPageContent({ ...pageContent, footerLocationAddress: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Helpdesk Column Heading</label>
              <input
                type="text"
                value={pageContent.footerContactHeading}
                onChange={(e) => setPageContent({ ...pageContent, footerContactHeading: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contact Phone</label>
              <input
                type="text"
                value={pageContent.footerContactPhone || settings?.contactPhone || ''}
                onChange={(e) => setPageContent({ ...pageContent, footerContactPhone: e.target.value })}
                placeholder="Use institution contact phone"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contact Email</label>
              <input
                type="email"
                value={pageContent.footerContactEmail || settings?.contactEmail || ''}
                onChange={(e) => setPageContent({ ...pageContent, footerContactEmail: e.target.value })}
                placeholder="Use institution contact email"
                className={inputCls}
              />
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Footer Appearance</h4>
                <p className="text-[10px] text-slate-500 mt-1">Customize the footer background, image, typography, accent, border and contact icon colours.</p>
              </div>
              {renderImageEditor('Footer Background Image', pageContent.footerBackgroundImageUrl, (v) =>
                setPageContent({ ...pageContent, footerBackgroundImageUrl: v }),
                { maxDimension: 1800 }
              )}
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  ['Background Colour', 'footerBgColor', '#022c22'],
                  ['Secondary Background', 'footerBgSecondaryColor', '#064e3b'],
                  ['Main Text Colour', 'footerTextColor', '#ffffff'],
                  ['Description Colour', 'footerSubtitleColor', '#a7f3d0'],
                  ['Accent Colour', 'footerAccentColor', '#fbbf24'],
                  ['Top Border Colour', 'footerBorderColor', '#f59e0b'],
                  ['Icon Colour', 'footerIconColor', '#fbbf24'],
                ] as const).map(([label, key, fallback]) => (
                  <label key={key} className="space-y-1">
                    <span className={labelCls}>{label}</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={(pageContent as any)[key] || fallback}
                        onChange={(e) => setPageContent({ ...pageContent, [key]: e.target.value })}
                        className="h-9 w-11 rounded border border-slate-300 dark:border-slate-700 bg-white p-1 cursor-pointer" />
                      <input type="text" value={(pageContent as any)[key] || ''}
                        onChange={(e) => setPageContent({ ...pageContent, [key]: e.target.value })}
                        placeholder={fallback} className={inputCls} />
                    </div>
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => setPageContent({
                ...pageContent, footerBackgroundImageUrl: '', footerBgColor: '', footerBgSecondaryColor: '',
                footerTextColor: '', footerSubtitleColor: '', footerAccentColor: '', footerBorderColor: '', footerIconColor: '',
              })} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                Reset appearance to defaults
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 14. CUSTOM SECTION EDITOR
    if (selected.type === 'customSection') {
      const custom = (pageContent.customSections || []).find((c) => c.id === selected.id);
      if (!custom) return <p className="text-xs text-slate-500">Custom section not found.</p>;
      const updateCustom = (patch: Partial<CustomPageSection>) =>
        setPageContent({
          ...pageContent,
          customSections: (pageContent.customSections || []).map((c) =>
            c.id === custom.id ? { ...c, ...patch } : c
          ),
        });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit Custom Section</h3>
            <button
              onClick={() => savePageContent()}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div>
            <label className={labelCls}>Kicker</label>
            <input
              type="text"
              value={custom.kicker}
              onChange={(e) => updateCustom({ kicker: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Section Title</label>
            <input
              type="text"
              value={custom.title}
              onChange={(e) => updateCustom({ title: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Body Text</label>
            <textarea
              rows={4}
              value={custom.body}
              onChange={(e) => updateCustom({ body: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={labelCls}>Button Text</label>
              <input
                type="text"
                value={custom.ctaText}
                onChange={(e) => updateCustom({ ctaText: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Theme Style</label>
              <select
                value={custom.style}
                onChange={(e) => updateCustom({ style: e.target.value as CustomPageSection['style'] })}
                className={inputCls}
              >
                <option value="emerald">Emerald Gradient</option>
                <option value="light">Light Surface</option>
                <option value="dark">Dark Slate</option>
              </select>
            </div>
          </div>
          {renderImageEditor('Custom Section Image', custom.imageUrl, (v) => updateCustom({ imageUrl: v }), {
            maxDimension: 1200,
          })}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={custom.isVisible}
              onChange={(e) => updateCustom({ isVisible: e.target.checked })}
              className="rounded text-emerald-700"
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Visible on Public Portal</span>
          </label>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={async () => {
                const next = {
                  ...pageContent,
                  customSections: (pageContent.customSections || []).filter((c) => c.id !== custom.id),
                  sectionOrder: (pageContent.sectionOrder || []).filter((k) => k !== custom.id),
                };
                setPageContent(next);
                setSelected({ type: 'overview' });
                if (canEdit) await savePageContent(next, 'Custom section deleted.');
              }}
              className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Custom Section
            </button>
          </div>
        </div>
      );
    }

    // 15. FEE SCHEDULE EDITOR
    if (selected.type === 'fee') {
      const fee = feeSchedules.find((f) => f.id === selected.id);
      if (!fee) return <p className="text-xs text-slate-500">Fee schedule not found.</p>;
      const updateLocal = (patch: Partial<FeeSchedule>) =>
        setFeeSchedules((prev) => prev.map((f) => (f.id === fee.id ? { ...f, ...patch } : f)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Bursary Schedule</span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit Fee Item</h3>
            </div>
            <button
              onClick={() => saveFeeSchedule(fee)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Fee
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Fee Title</label>
              <input
                type="text"
                value={fee.title}
                onChange={(e) => updateLocal({ title: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Amount (NGN)</label>
                <input
                  type="number"
                  value={fee.amount}
                  onChange={(e) => updateLocal({ amount: Number(e.target.value) })}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <input
                  type="text"
                  value={fee.category}
                  onChange={(e) => updateLocal({ category: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Target Level</label>
                <input
                  type="text"
                  value={fee.level || 'All'}
                  onChange={(e) => updateLocal({ level: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Session</label>
                <input
                  type="text"
                  value={fee.session}
                  onChange={(e) => updateLocal({ session: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              {confirmDeleteKey === `fee-${fee.id}` ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteFee(fee.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteKey(null)}
                    className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteKey(`fee-${fee.id}`)}
                  className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Fee Item
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 16. INVOICE EDITOR
    if (selected.type === 'invoice') {
      const inv = invoices.find((i) => i.id === selected.id);
      if (!inv) return <p className="text-xs text-slate-500">Invoice not found.</p>;
      const updateLocal = (patch: Partial<Invoice>) =>
        setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, ...patch } : i)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Student Invoice</span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{inv.invoiceNumber}</h3>
            </div>
            <button
              onClick={() => saveInvoice(inv)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Invoice
            </button>
          </div>
          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={inv.title}
              onChange={(e) => updateLocal({ title: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={labelCls}>Total Amount</label>
              <input
                type="number"
                value={inv.amount}
                onChange={(e) => updateLocal({ amount: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Amount Paid</label>
              <input
                type="number"
                value={inv.amountPaid}
                onChange={(e) => updateLocal({ amountPaid: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={inv.status}
                onChange={(e) => updateLocal({ status: e.target.value as Invoice['status'] })}
                className={inputCls}
              >
                <option value="UNPAID">UNPAID</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="PAID">PAID</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input
                type="text"
                value={inv.dueDate}
                onChange={(e) => updateLocal({ dueDate: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      );
    }

    // 17. ASSESSMENT RESULT EDITOR
    if (selected.type === 'result') {
      const r = results.find((item) => item.id === selected.id);
      if (!r) return <p className="text-xs text-slate-500">Result not found.</p>;
      const updateLocal = (patch: Partial<AssessmentResult>) =>
        setResults((prev) =>
          prev.map((item) => {
            if (item.id !== r.id) return item;
            const merged = { ...item, ...patch };
            merged.totalScore = Number(merged.caScore || 0) + Number(merged.examScore || 0);
            return merged;
          })
        );

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Examination Result
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{r.matricNumber}</h3>
            </div>
            <button
              onClick={() => saveResult(r)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Score
            </button>
          </div>
          <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg">
            <div className="font-bold text-slate-900 dark:text-white">{r.studentName}</div>
            <div className="text-slate-500 mt-0.5">
              {r.session} · {r.semester}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={labelCls}>CA Score (Max {settings?.caMaxMarks || 40})</label>
              <input
                type="number"
                min={0}
                max={settings?.caMaxMarks || 40}
                value={r.caScore}
                onChange={(e) => updateLocal({ caScore: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Exam Score (Max {settings?.examMaxMarks || 60})</label>
              <input
                type="number"
                min={0}
                max={settings?.examMaxMarks || 60}
                value={r.examScore}
                onChange={(e) => updateLocal({ examScore: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Approval Status</label>
            <select
              value={r.status}
              onChange={(e) => updateLocal({ status: e.target.value as AssessmentResult['status'] })}
              className={inputCls}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PUBLISHED">PUBLISHED</option>
            </select>
          </div>
        </div>
      );
    }

    // 18. COURSE REGISTRATION EDITOR
    if (selected.type === 'registration') {
      const reg = registrations.find((item) => item.id === selected.id);
      if (!reg) return <p className="text-xs text-slate-500">Registration not found.</p>;
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Course Enrolment
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{reg.id}</h3>
            </div>
            {reg.status !== 'APPROVED_BY_EXAM_OFFICER' && reg.status !== 'APPROVED_BY_HOD' && (
              <button
                onClick={() => approveReg(reg.id)}
                disabled={saving}
                className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approve Reg
              </button>
            )}
          </div>
          <div className="text-xs space-y-2">
            <div>
              <span className="font-bold">Level &amp; Period:</span> {reg.level} · {reg.session} ({reg.semester})
            </div>
            <div>
              <span className="font-bold">Total Credit Units:</span> {reg.totalCredits} Units ({reg.courseIds.length}{' '}
              Courses)
            </div>
            <div>
              <span className="font-bold">Status:</span> {reg.status}
            </div>
          </div>
        </div>
      );
    }

    // 19. ATTENDANCE SESSION EDITOR
    if (selected.type === 'attendance') {
      const att = attendance.find((a) => a.id === selected.id);
      if (!att) return <p className="text-xs text-slate-500">Attendance session not found.</p>;
      const updateLocal = (patch: Partial<AttendanceSession>) =>
        setAttendance((prev) => prev.map((a) => (a.id === att.id ? { ...a, ...patch } : a)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Attendance Register
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Edit Session</h3>
            </div>
            <button
              onClick={() => saveAttendance(att)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div>
            <label className={labelCls}>Topic Covered</label>
            <input
              type="text"
              value={att.topic}
              onChange={(e) => updateLocal({ topic: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={labelCls}>Session Type</label>
              <select
                value={att.type}
                onChange={(e) => updateLocal({ type: e.target.value as AttendanceSession['type'] })}
                className={inputCls}
              >
                <option value="Lecture">Lecture</option>
                <option value="Laboratory">Laboratory</option>
                <option value="Field Practical">Field Practical</option>
                <option value="Workshop">Workshop</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="text"
                value={att.date}
                onChange={(e) => updateLocal({ date: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      );
    }

    // 20. SUPPORT TICKET EDITOR
    if (selected.type === 'ticket') {
      const tkt = tickets.find((t) => t.id === selected.id);
      if (!tkt) return <p className="text-xs text-slate-500">Ticket not found.</p>;
      const updateLocal = (patch: Partial<SupportTicket>) =>
        setTickets((prev) => prev.map((t) => (t.id === tkt.id ? { ...t, ...patch } : t)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Helpdesk Ticket</span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{tkt.ticketNumber}</h3>
            </div>
            <button
              onClick={() => saveTicket(tkt)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Ticket
            </button>
          </div>
          <div>
            <label className={labelCls}>Subject</label>
            <input
              type="text"
              value={tkt.subject}
              onChange={(e) => updateLocal({ subject: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={tkt.status}
                onChange={(e) => updateLocal({ status: e.target.value as SupportTicket['status'] })}
                className={inputCls}
              >
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select
                value={tkt.priority}
                onChange={(e) => updateLocal({ priority: e.target.value as SupportTicket['priority'] })}
                className={inputCls}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Add Staff Reply (Optional)</label>
            <textarea
              rows={3}
              value={ticketReplyDraft}
              onChange={(e) => setTicketReplyDraft(e.target.value)}
              placeholder="Write official response to user..."
              className={inputCls}
            />
          </div>
        </div>
      );
    }

    // 21. STUDENT RECORD EDITOR
    if (selected.type === 'student') {
      const std = students.find((s) => s.id === selected.id);
      if (!std) return <p className="text-xs text-slate-500">Student not found.</p>;
      const updateLocal = (patch: Partial<Student>) =>
        setStudents((prev) => prev.map((s) => (s.id === std.id ? { ...s, ...patch } : s)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Student Record
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{std.matricNumber}</h3>
            </div>
            <button
              onClick={() => saveStudent(std)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Full Name</label>
              <input
                type="text"
                value={std.fullName || ''}
                onChange={(e) => updateLocal({ fullName: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Matric Number</label>
              <input
                type="text"
                value={std.matricNumber}
                onChange={(e) => updateLocal({ matricNumber: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Level</label>
                <select
                  value={std.level}
                  onChange={(e) => updateLocal({ level: e.target.value })}
                  className={inputCls}
                >
                  <option value="ND I">ND I</option>
                  <option value="ND II">ND II</option>
                  <option value="HND I">HND I</option>
                  <option value="HND II">HND II</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={std.academicStatus}
                  onChange={(e) => updateLocal({ academicStatus: e.target.value as Student['academicStatus'] })}
                  className={inputCls}
                >
                  <option value="Good Standing">Good Standing</option>
                  <option value="Probation">Probation</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Graduated">Graduated</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>CGPA</label>
                <input
                  type="number"
                  step="0.01"
                  max={4}
                  min={0}
                  value={std.cgpa}
                  onChange={(e) => updateLocal({ cgpa: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Credits Earned</label>
                <input
                  type="number"
                  value={std.totalCreditsEarned}
                  onChange={(e) => updateLocal({ totalCreditsEarned: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                type="text"
                value={std.phone || ''}
                onChange={(e) => updateLocal({ phone: e.target.value })}
                className={inputCls}
              />
            </div>
            {renderImageEditor('Student Passport Photo', std.photoUrl, (v) => updateLocal({ photoUrl: v }), {
              maxDimension: 600,
            })}
          </div>
        </div>
      );
    }

    // 22. APPLICATION EDITOR
    if (selected.type === 'application') {
      const app = applications.find((a) => a.id === selected.id);
      if (!app) return <p className="text-xs text-slate-500">Application not found.</p>;
      const updateLocal = (patch: Partial<AdmissionApplication>) =>
        setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, ...patch } : a)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Admissions</span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{app.applicationNumber}</h3>
            </div>
            <button
              onClick={() => saveApplication(app)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Decision
            </button>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg">
            <div className="font-bold text-slate-900 dark:text-white">
              {app.firstName} {app.lastName}
            </div>
            <div>
              {app.email} · {app.phone}
            </div>
            <div>
              {app.stateOfOrigin} ({app.lga})
            </div>
          </div>
          <div>
            <label className={labelCls}>Admission Status</label>
            <select
              value={app.status}
              onChange={(e) => updateLocal({ status: e.target.value as AdmissionApplication['status'] })}
              className={inputCls}
            >
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="OFFERED">OFFERED</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Screening Notes</label>
            <textarea
              rows={3}
              value={app.screeningNotes || ''}
              onChange={(e) => updateLocal({ screeningNotes: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
      );
    }

    // 23. USER / STAFF EDITOR
    if (selected.type === 'user') {
      const usr = usersList.find((u) => u.id === selected.id);
      if (!usr) return <p className="text-xs text-slate-500">User not found.</p>;
      const updateLocal = (patch: Partial<User>) =>
        setUsersList((prev) => prev.map((u) => (u.id === usr.id ? { ...u, ...patch } : u)));

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                User Account
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{usr.email}</h3>
            </div>
            <button
              onClick={() => saveUser(usr)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save User
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Full Name</label>
              <input
                type="text"
                value={usr.fullName}
                onChange={(e) => updateLocal({ fullName: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                type="text"
                value={usr.phone || ''}
                onChange={(e) => updateLocal({ phone: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <select
                value={usr.role}
                onChange={(e) => updateLocal({ role: e.target.value as User['role'] })}
                className={inputCls}
              >
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="INSTITUTION_ADMIN">INSTITUTION_ADMIN</option>
                <option value="RECTOR">RECTOR</option>
                <option value="REGISTRAR">REGISTRAR</option>
                <option value="ADMISSIONS_OFFICER">ADMISSIONS_OFFICER</option>
                <option value="DEAN">DEAN</option>
                <option value="HOD">HOD</option>
                <option value="LECTURER">LECTURER</option>
                <option value="EXAM_OFFICER">EXAM_OFFICER</option>
                <option value="BURSAR">BURSAR</option>
                <option value="STUDENT">STUDENT</option>
                <option value="APPLICANT">APPLICANT</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(usr.isLocked)}
                onChange={(e) => updateLocal({ isLocked: e.target.checked })}
                className="rounded text-red-600"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Account Locked</span>
            </label>
          </div>
        </div>
      );
    }

    return null;
  };

  // ==================== RIGHT CANVAS SECTIONS ====================

  const showSectionByScope = (domain: ScopeFilter) => scopeFilter === 'all' || scopeFilter === domain;
  const activeSlide = slides[activeSlidePreviewIdx] || slides[0];

  const previewContainerClass =
    previewWidth === 'mobile'
      ? 'max-w-[420px] mx-auto'
      : previewWidth === 'tablet'
      ? 'max-w-[768px] mx-auto'
      : 'w-full';

  return (
    <div className="lg:h-[calc(100vh-92px)] flex flex-col bg-slate-100 dark:bg-slate-950 lg:overflow-hidden">
      {/* Top Page Builder Control Bar */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onExitBuilder}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Exit Builder
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500 shrink-0" />
              <h1 className="text-sm font-black text-slate-900 dark:text-white truncate">
                EDOCASTI Visual Page &amp; App Information Builder
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Right side shows all app information · Click any item on the right to edit it on the left.
            </p>
          </div>
        </div>

        {/* Scope Filters & Viewport Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Wildcard filter (*, ?)..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-44 sm:w-52 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
            {(
              [
                ['all', 'All Info'],
                ['public', 'Public Page'],
                ['academics', 'Academics'],
                ['finance', 'Fees & Invoices'],
                ['people', 'People & Ops'],
              ] as Array<[ScopeFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setScopeFilter(key)}
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer whitespace-nowrap ${
                  scopeFilter === key
                    ? 'bg-emerald-800 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setPreviewWidth('full')}
              className={`p-1.5 rounded cursor-pointer ${
                previewWidth === 'full' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-amber-400 shadow-2xs' : 'text-slate-500'
              }`}
              title="Desktop Width"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPreviewWidth('tablet')}
              className={`p-1.5 rounded cursor-pointer ${
                previewWidth === 'tablet' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-amber-400 shadow-2xs' : 'text-slate-500'
              }`}
              title="Tablet Width"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPreviewWidth('mobile')}
              className={`p-1.5 rounded cursor-pointer ${
                previewWidth === 'mobile' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-amber-400 shadow-2xs' : 'text-slate-500'
              }`}
              title="Mobile Width"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={loadAllAppInfo}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            title="Reload all app data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-4 py-2.5 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-red-900 text-white border-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-300" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Split Workspace: LEFT = Editor Inspector, RIGHT = All App Information Canvas */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* LEFT SIDE: Contextual Information Editor */}
        <aside className="w-full lg:w-[400px] xl:w-[430px] shrink-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col lg:h-full min-h-0">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900 shrink-0">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Left Editor Inspector
            </span>
            {selected.type !== 'overview' && (
              <button
                onClick={() => setSelected({ type: 'overview' })}
                className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> All Sections
              </button>
            )}
          </div>

          {!canEdit && (
            <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-2 shrink-0">
              <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-200 leading-snug">
                Sign in with an Admin account to save edits and unlock Student, Exam, Invoice &amp; Staff records.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => switchPersona('superadmin@edocasti.edu.ng')}
                  className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3 text-amber-300" /> Quick Super Admin
                </button>
                <button
                  onClick={onOpenLoginModal}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3 h-3" /> Sign In
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">{renderLeftEditor()}</div>
        </aside>

        {/* RIGHT SIDE: Live Interactive Preview of ALL App Information */}
        <section className="flex-1 lg:h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className={`${previewContainerClass} space-y-8 transition-all duration-200 pb-12`}>
            {/* MAIN HEADER LIVE PREVIEW */}
            {showSectionByScope('public') && (
              <div
                onClick={() => setSelected({ type: 'header' })}
                style={{
                  backgroundColor: pageContent.headerBgColor || '#047857',
                  backgroundImage: pageContent.headerBackgroundImageUrl
                    ? `linear-gradient(110deg, ${pageContent.headerBgColor || '#047857'}eF, ${pageContent.headerBgSecondaryColor || '#065f46'}eF), url(${pageContent.headerBackgroundImageUrl})`
                    : `linear-gradient(110deg, ${pageContent.headerBgColor || '#047857'}, ${pageContent.headerBgSecondaryColor || '#065f46'})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  color: pageContent.headerTextColor || '#ffffff',
                  borderColor: pageContent.headerBorderColor || '#065f46',
                }}
                className={`rounded-xl border shadow-md overflow-hidden cursor-pointer transition ${outlineCls(isSelected('header'))}`}
              >
                <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <SchoolLogo size={42} />
                    <div className="min-w-0">
                      <div className="font-black text-base" style={{ color: pageContent.headerAccentColor || '#fbbf24' }}>
                        {settings?.shortName || 'EDOCASTI'}
                      </div>
                      <div className="text-[10px] sm:text-xs" style={{ color: pageContent.headerSubtitleColor || '#d1fae5' }}>
                        {settings?.institutionName || 'Edo State College of Agriculture, Science and Technology'}
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: pageContent.headerSubtitleColor || '#d1fae5' }}>
                        Session: <strong style={{ color: pageContent.headerAccentColor || '#fbbf24' }}>{settings?.currentSession || '2025/2026'}</strong>
                        <span className="mx-1.5 opacity-60">•</span>{settings?.currentSemester || 'First Semester'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['College Info', 'Admissions', 'Student Portal', 'Faculty', 'Management'].map((item) => (
                      <span key={item} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border"
                        style={{ backgroundColor: pageContent.headerNavBgColor || 'rgba(255,255,255,0.12)', color: pageContent.headerNavTextColor || '#ffffff', borderColor: pageContent.headerBorderColor || 'rgba(255,255,255,0.2)' }}>
                        {item}
                      </span>
                    ))}
                    <span className="px-3 py-1.5 rounded-lg bg-white text-emerald-900 text-[10px] font-bold">Sign In</span>
                  </div>
                </div>
                <div className="px-4 py-1.5 text-[10px] font-semibold border-t" style={{ backgroundColor: 'rgba(0,0,0,0.12)', borderColor: pageContent.headerBorderColor || 'rgba(255,255,255,0.2)', color: pageContent.headerSubtitleColor || '#d1fae5' }}>
                  Click to edit Main Header appearance
                </div>
              </div>
            )}

            {/* 1. PORTAL BANNER & INSTITUTION SETTINGS SUMMARY */}
            {showSectionByScope('public') &&
              settings &&
              matchesQuery(settings.institutionName, settings.shortName, settings.motto, settings.currentSession, settings.address, pageContent.portalBannerText) && (
                <div
                  onClick={() => setSelected({ type: 'settings' })}
                  className={`group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition ${outlineCls(
                    isSelected('settings')
                  )}`}
                >
                  {/* Mini Top Bar Preview */}
                  <div className="bg-emerald-950 text-white px-5 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate font-medium text-emerald-100">
                      {pageContent.portalBannerText}
                    </span>
                    <span className="font-bold text-amber-300">{pageContent.portalBadgeText}</span>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                      <div className="flex items-center gap-3">
                        <SchoolLogo size={40} />
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Institution Identity &amp; Rules · Click to Edit
                          </span>
                          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                            {settings.institutionName} ({settings.shortName})
                          </h2>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                        {settings.currentSession} · {settings.currentSemester}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] font-bold uppercase text-slate-500">Motto</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{settings.motto}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] font-bold uppercase text-slate-500">Grading Split</div>
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                          CA {settings.caMaxMarks} / Exam {settings.examMaxMarks}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] font-bold uppercase text-slate-500">Portals Status</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                          Admissions: {settings.admissionsOpen ? 'Open' : 'Closed'} · Reg:{' '}
                          {settings.courseRegistrationOpen ? 'Open' : 'Closed'}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] font-bold uppercase text-slate-500">Contact</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                          {settings.contactEmail}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* 2. PUBLIC PORTAL SECTIONS */}
            {showSectionByScope('public') && (
              <div className="space-y-8">
                {allSectionKeys.map((sectionKey) => {
                  const isHidden = (pageContent.hiddenSections || []).includes(sectionKey);

                  // HERO SLIDESHOW
                  if (sectionKey === 'hero') {
                    return (
                      <div key="hero" className={`space-y-3 ${isHidden ? 'opacity-50' : ''}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <LayoutTemplate className="w-4 h-4 text-amber-500" /> Hero Slideshow ({slides.length})
                            {isHidden && <span className="text-[10px] text-amber-600">(Hidden on Live Page)</span>}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {slides.map((s, idx) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  setActiveSlidePreviewIdx(idx);
                                  setSelected({ type: 'slide', id: s.id });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${
                                  isSelected('slide', s.id)
                                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                Slide {idx + 1}
                              </button>
                            ))}
                            <button
                              onClick={handleAddSlide}
                              className="px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Add Slide
                            </button>
                          </div>
                        </div>

                        {activeSlide && (() => {
                          const previewStyles = getHeroSlideStyles(activeSlide);
                          const customBg = hasCustomHeroBackground(activeSlide);
                          return (
                            <div
                              onClick={() => setSelected({ type: 'slide', id: activeSlide.id })}
                              style={previewStyles.containerStyle}
                              className={`relative overflow-hidden rounded-3xl ${
                                customBg ? '' : `bg-linear-to-r ${activeSlide.bgGradient}`
                              } text-white shadow-lg border-2 border-emerald-800/40 transition ${outlineCls(
                                isSelected('slide', activeSlide.id)
                              )}`}
                            >
                              <div
                                style={previewStyles.gradientLayerStyle}
                                className={`absolute inset-0 ${
                                  customBg ? '' : `bg-linear-to-r ${activeSlide.bgGradient}`
                                }`}
                              />
                              {activeSlide.imageUrl && (
                                <>
                                  <img
                                    src={activeSlide.imageUrl}
                                    alt={activeSlide.title}
                                    className="absolute inset-0 w-full h-full object-cover opacity-45"
                                  />
                                  <div
                                    style={previewStyles.imageTintStyle}
                                    className={`absolute inset-0 ${
                                      customBg ? '' : 'bg-linear-to-r from-emerald-950/90 via-emerald-950/75 to-slate-950/60'
                                    }`}
                                  />
                                </>
                              )}
                              <div className="relative z-10 p-8 sm:p-10">
                                <span
                                  style={previewStyles.badgeStyle}
                                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-3"
                                >
                                  <span
                                    style={previewStyles.dotAccentStyle}
                                    className="w-2 h-2 rounded-full bg-amber-400"
                                  />
                                  {activeSlide.badge} {!activeSlide.isActive && '(Inactive)'}
                                </span>
                                <h2
                                  style={previewStyles.titleStyle}
                                  className="text-2xl sm:text-3xl font-black leading-tight max-w-3xl"
                                >
                                  {activeSlide.title}
                                </h2>
                                <p
                                  style={previewStyles.subtitleStyle}
                                  className="text-sm text-emerald-100 mt-3 max-w-2xl leading-relaxed"
                                >
                                  {activeSlide.subtitle}
                                </p>
                                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                                  <span
                                    style={previewStyles.ctaStyle}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl"
                                  >
                                    {activeSlide.ctaText} <ChevronRight className="w-4 h-4" />
                                  </span>
                                  <span
                                    style={previewStyles.secondaryBtnStyle}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-900/80 text-white text-xs font-semibold rounded-xl border border-emerald-600/70"
                                  >
                                    Read Official Bulletin
                                  </span>
                                </div>
                              </div>
                              <div
                                style={previewStyles.footerBarStyle}
                                className="relative z-10 px-8 py-3 border-t border-emerald-800/40 bg-emerald-950/50 flex items-center justify-between text-[11px]"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span
                                    style={previewStyles.dotAccentStyle}
                                    className="w-6 h-1.5 rounded-full bg-amber-400"
                                  />
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                                </div>
                                <span style={previewStyles.subtitleStyle} className="text-emerald-200/80">
                                  Bottom Bar &amp; Notice Strip Theme
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }

                  // NEWS BULLETINS
                  if (sectionKey === 'news') {
                    const filteredArticles = articles.filter((a) =>
                      matchesQuery(a.title, a.summary, a.category, a.author)
                    );
                    return (
                      <div key="news" className={`space-y-4 ${isHidden ? 'opacity-50' : ''}`}>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div
                            onClick={() => setSelected({ type: 'newsHeader' })}
                            className={`p-2 -m-2 rounded-xl transition ${outlineCls(isSelected('newsHeader'))}`}
                          >
                            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                              {pageContent.newsSectionKicker}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                              {pageContent.newsSectionHeading}
                            </h2>
                          </div>

                          <button
                            onClick={handleAddArticle}
                            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Bulletin
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredArticles.map((art) => (
                            <div
                              key={art.id}
                              onClick={() => setSelected({ type: 'article', id: art.id })}
                              className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 transition flex flex-col justify-between ${outlineCls(
                                isSelected('article', art.id)
                              )}`}
                            >
                              <div>
                                {art.imageUrl && (
                                  <img
                                    src={art.imageUrl}
                                    alt={art.title}
                                    className="w-full h-28 object-cover rounded-xl mb-3 border border-slate-200 dark:border-slate-700"
                                  />
                                )}
                                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{art.category}</span>
                                  <span>{art.status}</span>
                                </div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2">
                                  {art.title}
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                                  {art.summary}
                                </p>
                              </div>
                              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                                {art.author}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // RECTOR MESSAGE
                  if (sectionKey === 'rector') {
                    return (
                      <div
                        key="rector"
                        onClick={() => setSelected({ type: 'rector' })}
                        style={{
                          backgroundColor: pageContent.rectorBgColor || undefined,
                          backgroundImage: pageContent.rectorBackgroundImageUrl
                            ? `linear-gradient(135deg, ${pageContent.rectorBgColor || '#052e24'}dd, ${pageContent.rectorBgSecondaryColor || '#064e3b'}cc), url(${pageContent.rectorBackgroundImageUrl})`
                            : pageContent.rectorBgColor || pageContent.rectorBgSecondaryColor
                              ? `linear-gradient(135deg, ${pageContent.rectorBgColor || '#052e24'}, ${pageContent.rectorBgSecondaryColor || '#064e3b'})`
                              : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          color: pageContent.rectorTextColor || undefined,
                          borderColor: pageContent.rectorBorderColor || undefined,
                        }}
                        className={`bg-linear-to-br from-emerald-950 via-emerald-900 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white border-2 border-amber-500/40 grid grid-cols-1 md:grid-cols-3 gap-6 items-center transition ${
                          isHidden ? 'opacity-50' : ''
                        } ${outlineCls(isSelected('rector'))}`}
                      >
                        <div className="text-center space-y-2">
                          <div className="w-24 h-24 mx-auto rounded-full bg-emerald-900 flex items-center justify-center text-3xl border-4 border-amber-400 overflow-hidden">
                            {pageContent.rectorPhotoUrl ? (
                              <img
                                src={pageContent.rectorPhotoUrl}
                                alt={pageContent.rectorName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              pageContent.rectorAvatarEmoji || '👨‍🏫'
                            )}
                          </div>
                          <div className="font-black text-base" style={{ color: pageContent.rectorTextColor || undefined }}>{pageContent.rectorName}</div>
                          <div className="text-[11px] text-amber-300 font-bold uppercase" style={{ color: pageContent.rectorAccentHex || undefined }}>{pageContent.rectorTitle}</div>
                          <div className="text-[11px] text-emerald-200" style={{ color: pageContent.rectorSubtitleColor || undefined }}>{pageContent.rectorInstitution}</div>
                        </div>
                        <div className="md:col-span-2 space-y-2.5">
                          <div className="text-xs font-bold uppercase tracking-wider text-amber-300" style={{ color: pageContent.rectorAccentHex || undefined }}>
                            {pageContent.rectorKicker}
                          </div>
                          <h3 className="text-xl font-black leading-snug" style={{ color: pageContent.rectorTextColor || undefined }}>{pageContent.rectorHeadline}</h3>
                          <p className="text-xs text-emerald-100 leading-relaxed" style={{ color: pageContent.rectorSubtitleColor || undefined }}>{pageContent.rectorParagraph1}</p>
                          <p className="text-xs text-emerald-100 leading-relaxed" style={{ color: pageContent.rectorSubtitleColor || undefined }}>{pageContent.rectorParagraph2}</p>
                          <span className="inline-block mt-2 px-4 py-2 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl" style={{ backgroundColor: pageContent.rectorButtonBgColor || undefined, color: pageContent.rectorButtonTextColor || undefined }}>
                            {pageContent.rectorCtaText}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // SCHOOLS, DEPARTMENTS & PROGRAMMES
                  if (sectionKey === 'schools') {
                    return (
                      <div key="schools" className={`space-y-4 ${isHidden ? 'opacity-50' : ''}`}>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div
                            onClick={() => setSelected({ type: 'schoolsHeader' })}
                            className={`p-2 -m-2 rounded-xl transition ${outlineCls(isSelected('schoolsHeader'))}`}
                          >
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                              {pageContent.schoolsSectionKicker}
                            </span>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                              {pageContent.schoolsSectionHeading}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {pageContent.schoolsSectionSubheading}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleAddSchool()}
                              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add School
                            </button>
                            <button
                              onClick={() => handleAddDepartment()}
                              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Dept
                            </button>
                            <button
                              onClick={() => handleAddProgramme()}
                              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Programme
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {schools
                            .filter((sch) => {
                              const schDepts = departments.filter((d) => d.schoolId === sch.id);
                              const schProgs = programmes.filter((p) => schDepts.some((d) => d.id === p.departmentId));
                              return (
                                matchesQuery(sch.name, sch.code, sch.description) ||
                                schDepts.some((d) => matchesQuery(d.name, d.code)) ||
                                schProgs.some((p) => matchesQuery(p.name, p.code))
                              );
                            })
                            .map((sch) => {
                              const schDepts = departments.filter((d) => d.schoolId === sch.id);
                              const schProgs = programmes.filter((p) => schDepts.some((d) => d.id === p.departmentId));
                              return (
                                <div
                                  key={sch.id}
                                  onClick={() => setSelected({ type: 'school', id: sch.id })}
                                  className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3 transition ${outlineCls(
                                    isSelected('school', sch.id)
                                  )}`}
                                >
                                  {sch.imageUrl && (
                                    <img
                                      src={sch.imageUrl}
                                      alt={sch.name}
                                      className="w-full h-28 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                                    />
                                  )}
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                                      {sch.code}
                                    </span>
                                    <span className="text-amber-600 dark:text-amber-400 font-bold">School Card</span>
                                  </div>
                                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{sch.name}</h3>
                                  <p className="text-xs text-slate-600 dark:text-slate-400">{sch.description}</p>

                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                      Departments (Click to Edit):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {schDepts.map((dept) => (
                                        <button
                                          key={dept.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelected({ type: 'department', id: dept.id });
                                          }}
                                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                                            isSelected('department', dept.id)
                                              ? 'bg-amber-500 text-slate-950 border-amber-500'
                                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-600'
                                          }`}
                                        >
                                          {dept.code} · {dept.name}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                      Programmes (Click to Edit):
                                    </span>
                                    {schProgs.map((prog) => (
                                      <div
                                        key={prog.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelected({ type: 'programme', id: prog.id });
                                        }}
                                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                                          isSelected('programme', prog.id)
                                            ? 'bg-amber-500/20 ring-1 ring-amber-500 text-slate-900 dark:text-white font-bold'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                        }`}
                                      >
                                        <span className="flex items-center gap-1.5">
                                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          {prog.name}
                                        </span>
                                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                                          {prog.qualification} · {prog.durationYears}y
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  }

                  // ACADEMIC CALENDAR HIGHLIGHTS
                  if (sectionKey === 'calendar') {
                    return (
                      <div
                        key="calendar"
                        style={{ backgroundImage: pageContent.calendarBackgroundImageUrl ? `linear-gradient(rgba(3,35,27,0.72), rgba(3,35,27,0.72)), url(${pageContent.calendarBackgroundImageUrl})` : `linear-gradient(135deg, ${pageContent.calendarBgColor || '#073f31'}, ${pageContent.calendarBgSecondaryColor || '#0b5b43'})`, backgroundSize: 'cover', backgroundPosition: 'center', color: pageContent.calendarTextColor || '#ffffff' }}
                        className={`rounded-3xl p-6 sm:p-8 border space-y-5 ${isHidden ? 'opacity-50' : ''}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div
                            onClick={() => setSelected({ type: 'calendarHeader' })}
                            className={`p-2 -m-2 rounded-xl transition ${outlineCls(isSelected('calendarHeader'))}`}
                          >
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: pageContent.calendarKickerColor || pageContent.calendarAccentColor || "#fbbf24" }}>
                              {pageContent.calendarSectionKicker}
                            </span>
                            <h2 className="text-xl font-bold mt-0.5" style={{ color: pageContent.calendarHeadingColor || pageContent.calendarTextColor || "#ffffff" }}>{pageContent.calendarSectionHeading}</h2>
                          </div>
                          <button
                            onClick={handleAddCalendarItem}
                            style={{ backgroundColor: pageContent.calendarButtonBgColor || "#f59e0b", color: pageContent.calendarButtonTextColor || "#0f172a" }} className="px-3 py-1.5 hover:brightness-110 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> {pageContent.calendarAddHighlightLabel || "Add Highlight"}
                          </button>
                        </div>

                        <div className="mb-1"><span className="px-3 py-1 rounded-lg text-xs font-semibold border" style={{ backgroundColor: pageContent.calendarCardBgColor || "rgba(255,255,255,0.05)", borderColor: pageContent.calendarCardBorderColor || "rgba(255,255,255,0.10)" }}>{pageContent.calendarCurrentPeriodLabel || "Current Period"}: {pageContent.calendarCurrentPeriodText || settings?.currentSemester || "First Semester"}</span></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {pageContent.calendarItems.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => setSelected({ type: 'calendarItem', id: item.id })}
                              style={{ backgroundColor: item.backgroundColor || pageContent.calendarCardBgColor || "rgba(255,255,255,0.05)", borderColor: item.borderColor || pageContent.calendarCardBorderColor || "rgba(255,255,255,0.10)" }}
                              className={`p-4 rounded-xl border space-y-2 transition ${outlineCls(
                                isSelected('calendarItem', item.id)
                              )}`}
                            >
                              <div className="flex items-center gap-2 font-bold text-sm" style={{ color: pageContent.calendarAccentColor || "#fbbf24" }}>
                                <Calendar className="w-4 h-4" style={{ color: item.iconColor || pageContent.calendarAccentColor || "#fbbf24" }} /> {item.title}
                              </div>
                              <p className="text-xs leading-relaxed text-justify [text-align-last:left]" style={{ color: item.descriptionColor || "#cbd5e1" }}>{item.description}</p>
                              <div className="text-[11px] font-semibold" style={{ color: item.statusColor || "#34d399" }}>{item.statusLabel}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // FAQs
                  if (sectionKey === 'faqs') {
                    return (
                      <div key="faqs" className={`space-y-4 ${isHidden ? 'opacity-50' : ''}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div
                            onClick={() => setSelected({ type: 'faqHeader' })}
                            className={`p-2 -m-2 rounded-xl transition ${outlineCls(isSelected('faqHeader'))}`}
                          >
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                              {pageContent.faqSectionKicker}
                            </span>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                              {pageContent.faqSectionHeading}
                            </h2>
                          </div>
                          <button
                            onClick={handleAddFaq}
                            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add FAQ
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {pageContent.faqs.map((faq) => (
                            <div
                              key={faq.id}
                              onClick={() => setSelected({ type: 'faq', id: faq.id })}
                              className={`p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition ${outlineCls(
                                isSelected('faq', faq.id)
                              )}`}
                            >
                              <div className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-white">
                                <HelpCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                                {faq.q}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 pl-6">{faq.a}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // FOOTER
                  if (sectionKey === 'footer') {
                    return (
                      <div
                        key="footer"
                        onClick={() => setSelected({ type: 'footer' })}
                        style={{
                          backgroundColor: pageContent.footerBgColor || undefined,
                          backgroundImage: pageContent.footerBackgroundImageUrl
                            ? `linear-gradient(135deg, ${pageContent.footerBgColor || '#022c22'}dd, ${pageContent.footerBgSecondaryColor || '#064e3b'}cc), url(${pageContent.footerBackgroundImageUrl})`
                            : pageContent.footerBgColor || pageContent.footerBgSecondaryColor
                              ? `linear-gradient(135deg, ${pageContent.footerBgColor || '#022c22'}, ${pageContent.footerBgSecondaryColor || '#064e3b'})`
                              : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          color: pageContent.footerTextColor || undefined,
                          borderColor: pageContent.footerBorderColor || undefined,
                        }}
                        className={`bg-emerald-950 text-white rounded-3xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 border-t-4 border-amber-500 transition ${
                          isHidden ? 'opacity-50' : ''
                        } ${outlineCls(isSelected('footer'))}`}
                      >
                        <div>
                          <div className="flex items-center gap-2.5 mb-2">
                            <SchoolLogo size={36} />
                            <div>
                              <div className="font-black text-amber-400 text-base" style={{ color: pageContent.footerAccentColor || undefined }}>{pageContent.footerBrandTitle}</div>
                              <div className="text-[10px] text-emerald-300" style={{ color: pageContent.footerSubtitleColor || undefined }}>{pageContent.footerBrandSubtitle}</div>
                            </div>
                          </div>
                          <p className="text-xs text-emerald-200 leading-relaxed" style={{ color: pageContent.footerSubtitleColor || undefined }}>{pageContent.footerDescription}</p>
                        </div>
                        <div className="space-y-1.5 text-xs text-emerald-200" style={{ color: pageContent.footerSubtitleColor || undefined }}>
                          <h4 className="font-bold text-white uppercase" style={{ color: pageContent.footerTextColor || undefined }}>{pageContent.footerLocationHeading}</h4>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" style={{ color: pageContent.footerIconColor || pageContent.footerAccentColor || undefined }} />
                            <span>{pageContent.footerLocationAddress}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs text-emerald-200" style={{ color: pageContent.footerSubtitleColor || undefined }}>
                          <h4 className="font-bold text-white uppercase" style={{ color: pageContent.footerTextColor || undefined }}>{pageContent.footerContactHeading}</h4>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-amber-400 shrink-0" style={{ color: pageContent.footerIconColor || pageContent.footerAccentColor || undefined }} />
                            <span>{pageContent.footerContactPhone || settings?.contactPhone || '+234 803 000 1234'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-amber-400 shrink-0" style={{ color: pageContent.footerIconColor || pageContent.footerAccentColor || undefined }} />
                            <span>{pageContent.footerContactEmail || settings?.contactEmail || 'admissions@edocasti.edu.ng'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // CUSTOM SECTIONS
                  const custom = (pageContent.customSections || []).find((c) => c.id === sectionKey);
                  if (custom) {
                    const cardClass =
                      custom.style === 'emerald'
                        ? 'bg-emerald-950 text-white border border-emerald-800'
                        : custom.style === 'dark'
                        ? 'bg-slate-900 text-white border border-slate-800'
                        : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800';
                    return (
                      <div
                        key={custom.id}
                        onClick={() => setSelected({ type: 'customSection', id: custom.id })}
                        className={`rounded-3xl p-6 sm:p-8 transition ${cardClass} ${
                          !custom.isVisible || isHidden ? 'opacity-50' : ''
                        } ${outlineCls(isSelected('customSection', custom.id))}`}
                      >
                        {custom.imageUrl && (
                          <img
                            src={custom.imageUrl}
                            alt={custom.title}
                            className="w-full max-h-56 object-cover rounded-2xl mb-4 border border-white/10"
                          />
                        )}
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-1">
                          {custom.kicker}
                        </div>
                        <h3 className="text-xl font-black mb-2">{custom.title}</h3>
                        <p className="text-xs opacity-90 leading-relaxed mb-4">{custom.body}</p>
                        {custom.ctaText && (
                          <span className="inline-block px-4 py-2 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl">
                            {custom.ctaText}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}

            {/* 3. ACADEMIC COURSE CATALOGUE & EXAM RESULTS */}
            {showSectionByScope('academics') && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Curriculum Data · Click Any Row to Edit
                      </span>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white">
                        Academic Course Catalogue ({courses.length})
                      </h2>
                    </div>
                    <button
                      onClick={handleAddCourse}
                      className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Course
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold text-[11px]">
                        <tr>
                          <th className="p-3">Code</th>
                          <th className="p-3">Title</th>
                          <th className="p-3 text-center">Units</th>
                          <th className="p-3">Level · Semester</th>
                          <th className="p-3">Lecturer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {courses
                          .filter((c) => matchesQuery(c.code, c.title, c.level, c.lecturerName))
                          .map((crs) => (
                            <tr
                              key={crs.id}
                              onClick={() => setSelected({ type: 'course', id: crs.id })}
                              className={`transition ${
                                isSelected('course', crs.id)
                                  ? 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-inset ring-amber-500'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer'
                              }`}
                            >
                              <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                                {crs.code}
                              </td>
                              <td className="p-3 font-semibold text-slate-900 dark:text-white">{crs.title}</td>
                              <td className="p-3 text-center font-mono font-bold tabular-nums">{crs.creditUnits}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">
                                {crs.level} · {crs.semester}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{crs.lecturerName}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {canEdit && results.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                        Senate &amp; Faculty Grades · Click Any Result to Edit
                      </span>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Award className="w-5 h-5 text-emerald-700 dark:text-emerald-400" /> Examination Results ({results.length})
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {results
                        .filter((r) => matchesQuery(r.studentName, r.matricNumber, r.grade, r.status))
                        .map((r) => {
                          const crs = courses.find((c) => c.id === r.courseId);
                          return (
                            <div
                              key={r.id}
                              onClick={() => setSelected({ type: 'result', id: r.id })}
                              className={`p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 transition ${outlineCls(
                                isSelected('result', r.id)
                              )}`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {crs?.code || r.courseId} · {r.studentName}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500">{r.matricNumber}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-mono font-black text-xs text-emerald-800 dark:text-emerald-400 tabular-nums">
                                  {r.totalScore} ({r.grade})
                                </div>
                                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">{r.status}</div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. BURSARY FEE SCHEDULES, INVOICES & PAYMENTS */}
            {showSectionByScope('finance') && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                      Bursary Configuration · Click Any Item to Edit
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Approved Fee Schedules ({feeSchedules.length})
                    </h2>
                  </div>
                  <button
                    onClick={handleAddFee}
                    className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Fee Item
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {feeSchedules
                    .filter((f) => matchesQuery(f.title, f.category, f.level, f.amount))
                    .map((fee) => (
                      <div
                        key={fee.id}
                        onClick={() => setSelected({ type: 'fee', id: fee.id })}
                        className={`p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 transition ${outlineCls(
                          isSelected('fee', fee.id)
                        )}`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">{fee.category}</span>
                          <span>{fee.level || 'All Levels'}</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white mt-1">{fee.title}</div>
                        <div className="font-mono font-black text-base text-emerald-900 dark:text-amber-400 mt-2 tabular-nums">
                          ₦{Number(fee.amount).toLocaleString('en-NG')}
                        </div>
                      </div>
                    ))}
                </div>

                {canEdit && invoices.length > 0 && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Student Invoices ({invoices.length}) · Verified Payments ({payments.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {invoices
                        .filter((inv) => matchesQuery(inv.invoiceNumber, inv.title, inv.status))
                        .map((inv) => (
                          <div
                            key={inv.id}
                            onClick={() => setSelected({ type: 'invoice', id: inv.id })}
                            className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 transition ${outlineCls(
                              isSelected('invoice', inv.id)
                            )}`}
                          >
                            <div className="min-w-0">
                              <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                {inv.invoiceNumber}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{inv.title}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono font-bold text-xs text-emerald-800 dark:text-amber-400 tabular-nums">
                                ₦{Number(inv.amount).toLocaleString('en-NG')}
                              </div>
                              <div className="text-[10px] font-bold text-slate-500">{inv.status}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. PEOPLE, STUDENTS, ADMISSIONS, ATTENDANCE & SUPPORT */}
            {showSectionByScope('people') && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Institutional Records · Click Any Item to Edit
                  </span>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Students, Admissions, Staff, Registrations &amp; Support
                  </h2>
                </div>

                {!canEdit ? (
                  <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-600" /> Protected Operational Records
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Sign in as an Admin or Registrar to view and edit student profiles, admission applications,
                        exam results, invoices, attendance, support tickets, and staff accounts here.
                      </p>
                    </div>
                    <button
                      onClick={() => switchPersona('superadmin@edocasti.edu.ng')}
                      className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-amber-300" /> Sign In as Super Admin
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Students */}
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                        Enrolled Students ({students.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {students
                          .filter((s) => matchesQuery(s.fullName, s.matricNumber, s.level, s.departmentName))
                          .map((std) => (
                            <div
                              key={std.id}
                              onClick={() => setSelected({ type: 'student', id: std.id })}
                              className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 transition ${outlineCls(
                                isSelected('student', std.id)
                              )}`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {std.fullName}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500">
                                  {std.matricNumber} · {std.level}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                  CGPA {Number(std.cgpa).toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-500">{std.academicStatus}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Applications */}
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                        Admission Applications ({applications.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {applications
                          .filter((a) => matchesQuery(a.firstName, a.lastName, a.applicationNumber, a.status))
                          .map((app) => (
                            <div
                              key={app.id}
                              onClick={() => setSelected({ type: 'application', id: app.id })}
                              className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 transition ${outlineCls(
                                isSelected('application', app.id)
                              )}`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {app.firstName} {app.lastName}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500">{app.applicationNumber}</div>
                              </div>
                              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
                                {app.status}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Staff / Users */}
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                        Staff &amp; Portal Users ({usersList.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {usersList
                          .filter((u) => matchesQuery(u.fullName, u.email, u.role))
                          .map((usr) => (
                            <div
                              key={usr.id}
                              onClick={() => setSelected({ type: 'user', id: usr.id })}
                              className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 transition ${outlineCls(
                                isSelected('user', usr.id)
                              )}`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {usr.fullName}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 truncate">{usr.email}</div>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                                {usr.role}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Course Registrations & Attendance */}
                    {(registrations.length > 0 || attendance.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> Course Registrations ({registrations.length})
                          </h3>
                          <div className="space-y-2">
                            {registrations.map((reg) => (
                              <div
                                key={reg.id}
                                onClick={() => setSelected({ type: 'registration', id: reg.id })}
                                className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs transition ${outlineCls(
                                  isSelected('registration', reg.id)
                                )}`}
                              >
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {reg.level} · {reg.totalCredits} Credits
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {reg.session} · {reg.semester}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                  {reg.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                            Attendance Sessions ({attendance.length})
                          </h3>
                          <div className="space-y-2">
                            {attendance.map((att) => (
                              <div
                                key={att.id}
                                onClick={() => setSelected({ type: 'attendance', id: att.id })}
                                className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs transition ${outlineCls(
                                  isSelected('attendance', att.id)
                                )}`}
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white truncate">{att.topic}</div>
                                  <div className="text-[11px] text-slate-500">
                                    {att.type} · {att.date}
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                  {att.records.length} students
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Support Tickets */}
                    {tickets.length > 0 && (
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-600" /> Support &amp; Helpdesk Tickets ({tickets.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {tickets
                            .filter((t) => matchesQuery(t.ticketNumber, t.subject, t.userName, t.status))
                            .map((tkt) => (
                              <div
                                key={tkt.id}
                                onClick={() => setSelected({ type: 'ticket', id: tkt.id })}
                                className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 transition ${outlineCls(
                                  isSelected('ticket', tkt.id)
                                )}`}
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                    {tkt.subject}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    {tkt.ticketNumber} · {tkt.userName}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
                                  {tkt.status}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
