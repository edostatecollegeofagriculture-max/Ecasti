import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { NewsArticle, School, Department, Programme, PageContent } from '../types';
import { NewsSlideShow } from '../components/NewsSlideShow';
import { NewsArticleModal } from '../components/NewsArticleModal';
import { SchoolLogo } from '../components/SchoolLogo';
import { WildcardFilterBar } from '../components/WildcardFilterBar';
import { matchesWildcard } from '../utils/wildcard';
import {
  Calendar,
  CheckCircle,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface Props {
  onGoToAdmissions: () => void;
  onGoToLogin: () => void;
  onNavigateSection?: (tab: string, subSection?: string) => void;
}

const DEFAULT_PAGE_CONTENT: PageContent = {
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
    'Through this portal, all institutional operations—from transparent online admissions, fee settlements, continuous assessment entries, and transcript issuance—are fully integrated, transparent, and auditable.',
  rectorCtaText: 'Apply for 2025/2026 Session',
  rectorAvatarEmoji: '👨‍🏫',
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

export const PublicPortal: React.FC<Props> = ({ onGoToAdmissions, onNavigateSection }) => {
  const { settings, pageContent } = useAuth();
  const content = pageContent || DEFAULT_PAGE_CONTENT;

  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [newsCategory, setNewsCategory] = useState<string>('ALL');
  const [newsWildcard, setNewsWildcard] = useState('');
  const [schoolWildcard, setSchoolWildcard] = useState('');
  const [programmeWildcard, setProgrammeWildcard] = useState('');
  const [showSchools, setShowSchools] = useState(false);
  const [showProgrammes, setShowProgrammes] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);

  useEffect(() => {
    api
      .getNews({
        category: newsCategory !== 'ALL' ? newsCategory : undefined,
        status: 'PUBLISHED',
      })
      .then((res) => {
        if (res.success && res.articles) {
          setNewsArticles(res.articles);
        }
      })
      .catch((err) => console.error(err));
  }, [newsCategory]);

  useEffect(() => {
    Promise.all([
      api.getSchools().catch(() => ({ success: false, schools: [] })),
      api.getDepartments().catch(() => ({ success: false, departments: [] })),
      api.getProgrammes().catch(() => ({ success: false, programmes: [] })),
    ]).then(([schRes, deptRes, progRes]) => {
      if (schRes.success && schRes.schools) setSchools(schRes.schools);
      if (deptRes.success && deptRes.departments) setDepartments(deptRes.departments);
      if (progRes.success && progRes.programmes) setProgrammes(progRes.programmes);
    });
  }, []);

  const handleNavigate = (tab: string, subSection?: string) => {
    if (tab === 'admissions') {
      onGoToAdmissions();
    } else if (onNavigateSection) {
      onNavigateSection(tab, subSection);
    }
  };

  const hiddenSet = new Set(content.hiddenSections || []);
  const configuredSectionOrder = content.sectionOrder?.length
    ? content.sectionOrder
    : DEFAULT_PAGE_CONTENT.sectionOrder;
  // Always place the separate Programmes section immediately after Schools,
  // even when older saved Page Builder content has the previous section order.
  const sectionOrder = configuredSectionOrder
    .filter((key) => key !== 'programmes')
    .flatMap((key) => key === 'schools' ? ['schools', 'programmes'] : [key]);

  const getSchoolProgrammes = (schoolId: string) => {
    const deptIds = departments.filter((d) => d.schoolId === schoolId).map((d) => d.id);
    return programmes.filter((p) => deptIds.includes(p.departmentId));
  };

  const renderSection = (sectionKey: string) => {
    if (hiddenSet.has(sectionKey)) return null;

    if (sectionKey === 'hero') {
      return (
        <section key="hero" className="portal-section pt-5 sm:pt-8">
          <NewsSlideShow onNavigate={handleNavigate} />
        </section>
      );
    }

    if (sectionKey === 'news') {
      const filteredNews = newsArticles.filter((a) =>
        matchesWildcard(newsWildcard, a.title, a.summary, a.category, a.author)
      );
      return (
        <section key="news" className="portal-section space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                {content.newsSectionKicker}
              </div>
              <h2 className="portal-section-heading text-2xl sm:text-3xl mt-2">
                {content.newsSectionHeading}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['ALL', 'Admissions', 'Academics', 'Research & Farm', 'Notice'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setNewsCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    newsCategory === cat
                      ? 'bg-emerald-900 dark:bg-emerald-800 text-amber-300 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {cat === 'ALL' ? 'All Bulletins' : cat}
                </button>
              ))}
            </div>
          </div>

          <WildcardFilterBar
            query={newsWildcard}
            onQueryChange={setNewsWildcard}
            placeholder="Wildcard filter bulletins (e.g. *Admission* or *Farm*)..."
            totalCount={newsArticles.length}
            filteredCount={filteredNews.length}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNews.map((article) => (
              <div
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 hover:border-emerald-600 dark:hover:border-emerald-500 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                {article.imageUrl && (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300">
                        {article.category}
                      </span>
                      <span>
                        {new Date(article.publishedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 group-hover:text-emerald-800 dark:group-hover:text-amber-400 transition leading-snug line-clamp-2">
                      {article.title}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                      {article.summary}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate max-w-[180px] font-medium">{article.author}</span>
                    <span className="text-emerald-700 dark:text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition">
                      Read story <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (sectionKey === 'rector') {
      return (
        <section key="rector" className="portal-section">
          <div
            style={{
              backgroundColor: content.rectorBgColor || undefined,
              backgroundImage: content.rectorBackgroundImageUrl
                ? `linear-gradient(135deg, ${content.rectorBgColor || '#052e24'}dd, ${content.rectorBgSecondaryColor || '#064e3b'}cc), url(${content.rectorBackgroundImageUrl})`
                : content.rectorBgColor || content.rectorBgSecondaryColor
                  ? `linear-gradient(135deg, ${content.rectorBgColor || '#052e24'}, ${content.rectorBgSecondaryColor || '#064e3b'})`
                  : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: content.rectorTextColor || undefined,
              borderColor: content.rectorBorderColor || undefined,
            }}
            className="bg-linear-to-br from-[#075b43] via-[#086b4c] to-[#0d7655] rounded-2xl sm:rounded-3xl p-6 sm:p-10 lg:p-12 text-white border border-emerald-700/40 shadow-lg grid grid-cols-1 lg:grid-cols-3 gap-7 lg:gap-10 items-center"
          >
            <div className="lg:col-span-1 text-center space-y-3">
              <div className="relative inline-block">
                <div className="w-36 h-36 mx-auto rounded-full bg-emerald-900 text-white flex items-center justify-center font-bold text-4xl border-4 border-amber-400 shadow-xl overflow-hidden">
                  {content.rectorPhotoUrl ? (
                    <img
                      src={content.rectorPhotoUrl}
                      alt={content.rectorName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    content.rectorAvatarEmoji || '👨‍🏫'
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-amber-500 p-2 rounded-full text-slate-950 shadow-md">
                  <SchoolLogo size={28} />
                </div>
              </div>
              <div>
                <h3 className="font-black text-white text-lg" style={{ color: content.rectorTextColor || undefined }}>{content.rectorName}</h3>
                <p className="text-xs text-amber-300 font-bold uppercase tracking-wider" style={{ color: content.rectorAccentHex || undefined }}>{content.rectorTitle}</p>
                <p className="text-[11px] text-emerald-200 mt-1" style={{ color: content.rectorSubtitleColor || undefined }}>{content.rectorInstitution}</p>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <span className="inline-flex items-center gap-1.5 text-amber-300 text-xs font-bold uppercase tracking-wider" style={{ color: content.rectorAccentHex || undefined }}>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> {content.rectorKicker}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight" style={{ color: content.rectorTextColor || undefined }}>
                {content.rectorHeadline}
              </h2>
              <p className="text-sm text-emerald-100 leading-relaxed" style={{ color: content.rectorSubtitleColor || undefined }}>{content.rectorParagraph1}</p>
              <p className="text-sm text-emerald-100 leading-relaxed" style={{ color: content.rectorSubtitleColor || undefined }}>{content.rectorParagraph2}</p>

              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={onGoToAdmissions}
                  style={{ backgroundColor: content.rectorButtonBgColor || undefined, color: content.rectorButtonTextColor || undefined }}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  {content.rectorCtaText} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (sectionKey === 'schools') {
      const filteredSchools = schools.filter((sch) =>
        matchesWildcard(schoolWildcard, sch.code, sch.name, sch.description)
      );

      return (
        <section key="schools" className="portal-section space-y-7 sm:space-y-9">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
              {content.schoolsSectionKicker}
            </span>
            <h2 className="portal-section-heading text-3xl sm:text-4xl mt-2">
              Schools & Faculties
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Explore the College's academic schools and faculties.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowSchools((visible) => !visible)}
              aria-expanded={showSchools}
              aria-controls="public-schools-list"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white px-6 py-3 text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              {showSchools ? 'Hide Schools' : 'View Schools'}
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSchools ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showSchools && (
            <div id="public-schools-list" className="space-y-6">
              <WildcardFilterBar
                query={schoolWildcard}
                onQueryChange={setSchoolWildcard}
                placeholder="Search schools and faculties..."
                totalCount={schools.length}
                filteredCount={filteredSchools.length}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSchools.map((sch) => {
              return (
                <div
                  key={sch.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-sm hover:shadow-lg transition flex flex-col justify-between"
                >
                  {sch.imageUrl && (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img src={sch.imageUrl} alt={sch.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                          {sch.code}
                        </span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold">NBTE Accredited</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{sch.name}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">{sch.description}</p>

                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <button
                        onClick={onGoToAdmissions}
                        className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        View Admission Criteria <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
              })}
              </div>
            </div>
          )}
        </section>
      );
    }

    if (sectionKey === 'programmes') {
      const filteredProgrammes = programmes.filter((prog) => {
        const department = departments.find((dept) => dept.id === prog.departmentId);
        const school = department ? schools.find((item) => item.id === department.schoolId) : undefined;
        return matchesWildcard(
          programmeWildcard,
          prog.code,
          prog.name,
          prog.qualification,
          prog.description,
          department?.name || '',
          school?.name || ''
        );
      });

      return (
        <section key="programmes" className="portal-section space-y-7 sm:space-y-9">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
              Academic Offerings
            </span>
            <h2 className="portal-section-heading text-3xl sm:text-4xl mt-2">
              Programmes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Browse the available National Diploma (ND), Higher National Diploma (HND), and other programme listings.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowProgrammes((visible) => !visible)}
              aria-expanded={showProgrammes}
              aria-controls="public-programmes-list"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white px-6 py-3 text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              {showProgrammes ? 'Hide Programmes' : 'View Programmes'}
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showProgrammes ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showProgrammes && (
            <div id="public-programmes-list" className="space-y-6">
              <WildcardFilterBar
                query={programmeWildcard}
                onQueryChange={setProgrammeWildcard}
                placeholder="Search programmes, qualifications, departments or schools..."
                totalCount={programmes.length}
                filteredCount={filteredProgrammes.length}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredProgrammes.map((prog) => {
                  const department = departments.find((dept) => dept.id === prog.departmentId);
                  const school = department ? schools.find((item) => item.id === department.schoolId) : undefined;
                  return (
                    <div key={prog.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-4">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">{prog.code}</span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold">{prog.qualification}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{prog.name}</h3>
                      {prog.description && <p className="text-xs text-slate-600 dark:text-slate-300">{prog.description}</p>}
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        {school && <p>School: {school.name}</p>}
                        {department && <p>Department: {department.name}</p>}
                        <p>Duration: {prog.durationYears} Years</p>
                      </div>
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={onGoToAdmissions}
                          className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          View Admission Criteria <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredProgrammes.length === 0 && (
                  <p className="col-span-full text-center text-sm text-slate-500">No programmes match your search.</p>
                )}
              </div>
            </div>
          )}
        </section>
      );
    }

    if (sectionKey === 'calendar') {
      return (
        <section key="calendar" className="portal-section">
          <div className="bg-linear-to-br from-[#073f31] to-[#0b5b43] rounded-2xl sm:rounded-3xl p-6 sm:p-9 lg:p-10 text-white border border-emerald-800 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {content.calendarSectionKicker}
                </span>
                <h2 className="text-2xl font-bold mt-1">{content.calendarSectionHeading}</h2>
              </div>
              <span className="px-3 py-1 bg-emerald-800 text-emerald-200 text-xs font-semibold rounded-lg border border-emerald-600">
                Current Period: {settings?.currentSemester || 'First Semester'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {content.calendarItems.map((item) => (
                <div key={item.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Calendar className="w-4 h-4" /> {item.title}
                  </div>
                  <p className="text-xs text-slate-300">{item.description}</p>
                  <div className="text-[11px] text-emerald-400 font-semibold pt-2">{item.statusLabel}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (sectionKey === 'faqs') {
      return (
        <section key="faqs" className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
              {content.faqSectionKicker}
            </span>
            <h2 className="portal-section-heading text-2xl sm:text-3xl mt-2">
              {content.faqSectionHeading}
            </h2>
          </div>

          <div className="space-y-3">
            {content.faqs.map((faq, idx) => (
              <div
                key={faq.id || idx}
                className="border border-slate-200/90 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-emerald-800 dark:hover:text-emerald-400 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-lg">{activeFaq === idx ? '−' : '+'}</span>
                </button>
                {activeFaq === idx && (
                  <div className="px-4 pb-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (sectionKey === 'footer') {
      // The shared application footer is rendered by App.tsx on every page.
      return null;
    }

    const custom = (content.customSections || []).find((c) => c.id === sectionKey);
    if (custom && custom.isVisible) {
      const cardClass =
        custom.style === 'emerald'
          ? 'bg-emerald-950 text-white border border-emerald-800'
          : custom.style === 'dark'
          ? 'bg-slate-900 text-white border border-slate-800'
          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800';
      return (
        <section key={custom.id} className="portal-section">
          <div className={`rounded-3xl p-8 sm:p-10 grid grid-cols-1 ${custom.imageUrl ? 'lg:grid-cols-3 gap-8 items-center' : ''} ${cardClass}`}>
            <div className={custom.imageUrl ? 'lg:col-span-2' : ''}>
              {custom.kicker && (
                <div className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-1">
                  {custom.kicker}
                </div>
              )}
              <h2 className="text-2xl font-black mb-3">{custom.title}</h2>
              <p className="text-sm opacity-90 leading-relaxed max-w-3xl mb-5">{custom.body}</p>
              {custom.ctaText && (
                <button
                  onClick={() => handleNavigate(custom.ctaTab || 'public')}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-2 cursor-pointer"
                >
                  {custom.ctaText} <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {custom.imageUrl && (
              <div className="lg:col-span-1">
                <img
                  src={custom.imageUrl}
                  alt={custom.title}
                  className="w-full aspect-[16/10] object-cover rounded-xl border border-white/10 shadow-md"
                />
              </div>
            )}
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen space-y-16 sm:space-y-20 pb-12 bg-transparent">
      {sectionOrder.map((key) => renderSection(key))}

      {/* Render any visible custom sections not already in sectionOrder */}
      {(content.customSections || [])
        .filter((c) => c.isVisible && !sectionOrder.includes(c.id))
        .map((c) => renderSection(c.id))}

      <NewsArticleModal
        isOpen={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        article={selectedArticle}
      />
    </div>
  );
};
