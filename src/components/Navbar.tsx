import React from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccessWorkspace } from '../utils/roleAccess';
import { GlobalSearchBar } from './GlobalSearchBar';
import { ThemeToggle } from './ThemeToggle';
import { SchoolLogo } from './SchoolLogo';
import {
  GraduationCap,
  Users,
  Building,
  Shield,
  FileText,
  LogOut,
  LogIn,
  KeyRound,
  CheckCircle2,
  Sparkles,
  Layers,
} from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string, subSection?: string) => void;
  onOpenPersonaModal: () => void;
  onOpenLoginModal: () => void;
  onOpenPrintModal: (type: any, data: any) => void;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  onOpenPersonaModal,
  onOpenLoginModal,
  onOpenPrintModal,
}) => {
  const { user, settings, pageContent, logout } = useAuth();

  return (
    <header
      style={{
        backgroundColor: pageContent?.headerBgColor || '#047857',
        backgroundImage: pageContent?.headerBackgroundImageUrl
          ? `linear-gradient(110deg, ${pageContent?.headerBgColor || '#047857'}eF, ${pageContent?.headerBgSecondaryColor || '#065f46'}eF), url(${pageContent.headerBackgroundImageUrl})`
          : `linear-gradient(110deg, ${pageContent?.headerBgColor || '#047857'}, ${pageContent?.headerBgSecondaryColor || '#065f46'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: pageContent?.headerTextColor || '#ffffff',
        borderColor: pageContent?.headerBorderColor || '#065f46',
      }}
      className="sticky top-0 z-40 border-b shadow-xs transition-colors duration-200"
    >
      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 sm:gap-6">
        {/* Logo and Brand */}
        <div
          onClick={() => { if (!user) setActiveTab('public'); }}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group shrink-0"
        >
          <SchoolLogo size={44} className="group-hover:scale-105 transition shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base sm:text-lg tracking-tight" style={{ color: pageContent?.headerAccentColor || '#fbbf24' }}>
                {settings?.shortName || 'EDOCASTI'}
              </span>
            </div>
            <p className="text-[11px] hidden xl:block" style={{ color: pageContent?.headerSubtitleColor || '#d1fae5' }}>
              {settings?.institutionName || 'Edo State College of Agriculture, Science and Technology'}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] sm:text-[11px]" style={{ color: pageContent?.headerSubtitleColor || '#d1fae5' }}>
              <span>Session: <strong className="font-bold" style={{ color: pageContent?.headerAccentColor || '#fbbf24' }}>{settings?.currentSession || '2025/2026'}</strong></span>
              <span className="opacity-60">•</span>
              <span className="font-semibold">{settings?.currentSemester || 'First Semester'}</span>
            </div>
          </div>
        </div>

        {/* Persistent Global Search Bar */}
        {user && ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'].includes(user.role) && <div className="flex-1 max-w-md hidden md:block">
          <GlobalSearchBar onNavigate={(tab, sub) => setActiveTab(tab, sub)} onOpenPrintModal={onOpenPrintModal} />
        </div>}

        {/* Dynamic Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-xl border" style={{ backgroundColor: pageContent?.headerNavBgColor || 'rgba(255,255,255,0.12)', borderColor: pageContent?.headerBorderColor || 'rgba(255,255,255,0.2)' }}>
          {!user && <button
            onClick={() => setActiveTab('public')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'public'
                ? 'bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-400 shadow-xs'
                : 'text-white/85 hover:text-white'
            }`}
          >
            Public Info
          </button>}

          {(!user || canAccessWorkspace(user.role, 'admissions')) && <button
            onClick={() => setActiveTab('admissions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'admissions'
                ? 'bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-400 shadow-xs'
                : 'text-white/85 hover:text-white'
            }`}
          >
            Admissions
          </button>}

          {user && canAccessWorkspace(user.role, 'student') && (
            <button
              onClick={() => setActiveTab('student')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'student'
                  ? 'bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-400 shadow-xs'
                  : 'text-white/85 hover:text-white'
              }`}
            >
              Student Portal
            </button>
          )}

          {user && canAccessWorkspace(user.role, 'lecturer') && (
              <button
                onClick={() => setActiveTab('lecturer')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'lecturer'
                    ? 'bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-400 shadow-xs'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                Faculty
              </button>
            )}

          {user && canAccessWorkspace(user.role, 'admin') && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'admin'
                    ? 'bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-400 shadow-xs'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                Management
              </button>
            )}

          {user && canAccessWorkspace(user.role, 'builder') && <button
            onClick={() => setActiveTab('builder')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'builder'
                ? 'bg-emerald-900 text-amber-300 shadow-xs'
                : 'text-emerald-800 dark:text-amber-400 hover:bg-white dark:hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Page Builder
          </button>}
        </nav>

        {/* Right Tools: Page Builder (sm-md quick access), Theme Toggle & User Account */}
        <div className="flex items-center gap-2 shrink-0">
          {user && ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'].includes(user.role) && <button
            onClick={onOpenPersonaModal}
            className="hidden xl:flex bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg shadow-xs items-center gap-1 cursor-pointer transition text-xs"
            title="Fast switch between roles (Rector, Bursar, Lecturer, Student, etc.)"
          >
            <KeyRound className="w-3 h-3" /> Quick Switch Role
          </button>}
          {user && canAccessWorkspace(user.role, 'builder') && <button
            onClick={() => setActiveTab('builder')}
            className={`lg:hidden hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'builder'
                ? 'bg-emerald-900 text-amber-300'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-amber-300 border border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Page Builder
          </button>}

          {/* Theme Toggle */}
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold leading-tight" style={{ color: pageContent?.headerTextColor || '#ffffff' }}>
                  {user.fullName}
                </div>
                <div className="text-[10px] font-semibold uppercase" style={{ color: pageContent?.headerSubtitleColor || '#d1fae5' }}>
                  {user.role.replace('_', ' ')}
                </div>
              </div>

              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.fullName}
                  className="w-8 h-8 rounded-lg object-cover border border-emerald-300 dark:border-emerald-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-bold flex items-center justify-center text-xs border border-emerald-300 dark:border-emerald-700">
                  {user.fullName.charAt(0)}
                </div>
              )}

              <button
                onClick={logout}
                className="p-2 text-white/80 hover:text-red-200 hover:bg-white/10 rounded-lg transition cursor-pointer"
                title="Logout from portal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Global Search Bar */}
      {user && ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'].includes(user.role) && <div className="md:hidden px-4 pb-2.5">
        <GlobalSearchBar onNavigate={(tab, sub) => setActiveTab(tab, sub)} onOpenPrintModal={onOpenPrintModal} />
      </div>}

      {/* Mobile Nav Tabs */}
      <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 border-t gap-1 text-xs" style={{ backgroundColor: 'rgba(0,0,0,0.12)', borderColor: pageContent?.headerBorderColor || 'rgba(255,255,255,0.2)' }}>
        {!user && <button
          onClick={() => setActiveTab('public')}
          className={`px-3 py-1 rounded-md shrink-0 font-medium ${
            activeTab === 'public'
              ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-white/85'
          }`}
        >
          College Info
        </button>}
        {(!user || canAccessWorkspace(user.role, 'admissions')) && <button
          onClick={() => setActiveTab('admissions')}
          className={`px-3 py-1 rounded-md shrink-0 font-medium ${
            activeTab === 'admissions'
              ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-white/85'
          }`}
        >
          Admissions
        </button>}
        {user && canAccessWorkspace(user.role, 'student') && (
          <button
            onClick={() => setActiveTab('student')}
            className={`px-3 py-1 rounded-md shrink-0 font-medium ${
              activeTab === 'student'
                ? 'bg-emerald-800 text-white dark:bg-emerald-700'
                : 'text-white/85'
            }`}
          >
            Student
          </button>
        )}
        {user && canAccessWorkspace(user.role, 'lecturer') && (
          <button
            onClick={() => setActiveTab('lecturer')}
            className={`px-3 py-1 rounded-md shrink-0 font-medium ${
              activeTab === 'lecturer'
                ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-white/85'
            }`}
          >
            Lecturer
          </button>
        )}
        {user && canAccessWorkspace(user.role, 'admin') && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1 rounded-md shrink-0 font-medium ${
                activeTab === 'admin'
                  ? 'bg-emerald-800 text-white dark:bg-emerald-700'
                  : 'text-white/85'
              }`}
            >
              Management
            </button>
          )}
        {user && canAccessWorkspace(user.role, 'builder') && <button
          onClick={() => setActiveTab('builder')}
          className={`px-3 py-1 rounded-md shrink-0 font-semibold flex items-center gap-1 ${
            activeTab === 'builder'
              ? 'bg-emerald-900 text-amber-300'
              : 'text-emerald-800 dark:text-amber-400'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Page Builder
        </button>}
      </div>
    </header>
  );
};
