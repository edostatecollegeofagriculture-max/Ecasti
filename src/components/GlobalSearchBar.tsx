import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Search,
  X,
  GraduationCap,
  BookOpen,
  FileText,
  LayoutDashboard,
  ArrowRight,
  Printer,
  Sparkles,
} from 'lucide-react';

interface Props {
  onNavigate: (tab: string, subSection?: string) => void;
  onOpenPrintModal: (type: any, data: any) => void;
}

export const GlobalSearchBar: React.FC<Props> = ({ onNavigate, onOpenPrintModal }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'STUDENTS' | 'COURSES' | 'DOCUMENTS' | 'SECTIONS'>('ALL');
  const [results, setResults] = useState<{
    students: any[];
    applicants: any[];
    courses: any[];
    documents: any[];
    sections: any[];
  }>({
    students: [],
    applicants: [],
    courses: [],
    documents: [],
    sections: [],
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch search results with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isOpen) {
        setLoading(true);
        api
          .globalSearch(query)
          .then((res) => {
            if (res.success) {
              setResults(res.results);
            }
          })
          .catch((err) => console.error(err))
          .finally(() => setLoading(false));
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [query, isOpen]);

  const totalResultsCount =
    results.students.length +
    results.applicants.length +
    results.courses.length +
    results.documents.length +
    results.sections.length;

  const handleSelectStudent = (std: any) => {
    onNavigate('student');
    setIsOpen(false);
  };

  const handleSelectApplicant = (app: any) => {
    onNavigate('admissions');
    setIsOpen(false);
  };

  const handleSelectCourse = (crs: any) => {
    onNavigate('lecturer');
    setIsOpen(false);
  };

  const handleSelectDocument = (doc: any) => {
    setIsOpen(false);
    onOpenPrintModal(doc.slipType, {
      title: doc.title,
      applicationNumber: 'EDOCASTI/2025/APP-00109',
      matricNumber: 'EDOCASTI/ND/2024/0101',
      firstName: 'Blessing',
      lastName: 'Omorodion',
      programmeName: 'National Diploma in Agricultural Technology',
      level: 'ND I',
      totalCredits: 10,
      amount: 65000,
      reference: 'EDOCASTI-TX-882190',
    });
  };

  const handleSelectSection = (sec: any) => {
    onNavigate(sec.tab, sec.subSection);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      {/* Persistent Search Bar Input */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          placeholder="Search students, courses, official slips... (Ctrl+K)"
          className="w-full pl-9 pr-9 py-1.5 text-xs bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Instant Dropdown Search Results Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[min(30rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[500px] animate-in fade-in zoom-in-95 duration-100">
          {/* Category Tabs */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-1 overflow-x-auto text-[11px]">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition cursor-pointer ${
                activeCategory === 'ALL'
                  ? 'bg-emerald-800 text-white dark:bg-emerald-700'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              All Matches
            </button>
            <button
              onClick={() => setActiveCategory('STUDENTS')}
              className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition cursor-pointer ${
                activeCategory === 'STUDENTS'
                  ? 'bg-emerald-800 text-white dark:bg-emerald-700'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              Students & Applicants ({results.students.length + results.applicants.length})
            </button>
            <button
              onClick={() => setActiveCategory('COURSES')}
              className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition cursor-pointer ${
                activeCategory === 'COURSES'
                  ? 'bg-emerald-800 text-white dark:bg-emerald-700'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              Courses ({results.courses.length})
            </button>
            <button
              onClick={() => setActiveCategory('DOCUMENTS')}
              className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition cursor-pointer ${
                activeCategory === 'DOCUMENTS'
                  ? 'bg-emerald-800 text-white dark:bg-emerald-700'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              Official Slips ({results.documents.length})
            </button>
            <button
              onClick={() => setActiveCategory('SECTIONS')}
              className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition cursor-pointer ${
                activeCategory === 'SECTIONS'
                  ? 'bg-emerald-800 text-white dark:bg-emerald-700'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              Workspaces ({results.sections.length})
            </button>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-3 space-y-4 text-xs divide-y divide-slate-100 dark:divide-slate-800/80">
            {loading ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                Searching portal records...
              </div>
            ) : totalResultsCount === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 space-y-1">
                <div>No records match "{query}"</div>
                <div className="text-[11px] text-slate-400">
                  Try searching by course code (e.g. AGT 111), student matric number, or document type.
                </div>
              </div>
            ) : (
              <>
                {/* 1. Students & Applicants */}
                {(activeCategory === 'ALL' || activeCategory === 'STUDENTS') &&
                  (results.students.length > 0 || results.applicants.length > 0) && (
                    <div className="pt-2 first:pt-0 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2">
                        Students & Admission Applicants
                      </div>
                      {results.students.map((std) => (
                        <div
                          key={std.id}
                          onClick={() => handleSelectStudent(std)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 cursor-pointer transition group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                              <GraduationCap className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2">
                                <span>{std.fullName}</span>
                                <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                  {std.matricNumber}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {std.programmeName} • Level: {std.level} • CGPA: {std.cgpa}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold group-hover:translate-x-0.5 transition flex items-center gap-1">
                            Open <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      ))}

                      {results.applicants.map((app) => (
                        <div
                          key={app.id}
                          onClick={() => handleSelectApplicant(app)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50/70 dark:hover:bg-amber-950/30 cursor-pointer transition group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2">
                                <span>{app.fullName}</span>
                                <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                                  {app.applicationNumber}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {app.programmeName} • Status: <strong className="uppercase">{app.status}</strong>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold group-hover:translate-x-0.5 transition flex items-center gap-1">
                            Screen <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                {/* 2. Courses */}
                {(activeCategory === 'ALL' || activeCategory === 'COURSES') &&
                  results.courses.length > 0 && (
                    <div className="pt-2 first:pt-0 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2">
                        Courses & Academic Offerings
                      </div>
                      {results.courses.map((crs) => (
                        <div
                          key={crs.id}
                          onClick={() => handleSelectCourse(crs)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/70 dark:hover:bg-blue-950/30 cursor-pointer transition group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="font-mono text-emerald-800 dark:text-emerald-400">
                                  {crs.code}
                                </span>
                                <span>{crs.title}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {crs.creditUnits} Credit Units • {crs.level} • Lecturer: {crs.lecturerName || 'Faculty'}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition flex items-center gap-1">
                            View <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                {/* 3. Official Documents & Slips */}
                {(activeCategory === 'ALL' || activeCategory === 'DOCUMENTS') &&
                  results.documents.length > 0 && (
                    <div className="pt-2 first:pt-0 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2">
                        Official Institutional Documents & Printable Slips
                      </div>
                      {results.documents.map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => handleSelectDocument(doc)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 dark:hover:bg-purple-950/30 cursor-pointer transition group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300">
                              <Printer className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {doc.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {doc.category} • {doc.description}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-purple-700 dark:text-purple-400 font-semibold group-hover:translate-x-0.5 transition flex items-center gap-1">
                            Print Slip <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                {/* 4. Portal Workspaces */}
                {(activeCategory === 'ALL' || activeCategory === 'SECTIONS') &&
                  results.sections.length > 0 && (
                    <div className="pt-2 first:pt-0 space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 pb-1">
                        Portal Sections & Navigation Workspaces
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {results.sections.map((sec, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectSection(sec)}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-lg hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25 transition-colors group"
                          >
                            <span className="w-7 h-7 shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
                              <LayoutDashboard className="w-3.5 h-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                                {sec.title}
                              </span>
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                                {sec.description}
                              </span>
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Footer with shortcut tips */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Press <kbd className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px]">Esc</kbd> to exit search</span>
            <span>Real-time integrated query engine</span>
          </div>
        </div>
      )}
    </div>
  );
};
