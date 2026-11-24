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
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors duration-200">
      {/* Top Institutional Notification Bar */}
      <div className="bg-linear-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/40">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-amber-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {settings?.shortName || 'EDOCASTI'} PORTAL
          </span>
          <span className="hidden sm:inline text-emerald-200/60">•</span>
          <span className="hidden sm:inline text-emerald-100">
            {pageContent?.portalBannerText || 'Edo State College of Agriculture, Science and Technology, Iguoriakhi'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="bg-emerald-800/80 px-2 py-0.5 rounded border border-emerald-700 text-emerald-100">
            Session: <strong>{settings?.currentSession || '2025/2026'}</strong>
          </span>
          <span className="bg-emerald-800/80 px-2 py-0.5 rounded border border-emerald-700 text-emerald-100 hidden md:inline">
            {settings?.currentSemester || 'First Semester'}
          </span>
          {user && ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'].includes(user.role) && <button
            onClick={onOpenPersonaModal}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-0.5 rounded shadow-xs flex items-center gap-1 cursor-pointer transition"
            title="Fast switch between roles (Rector, Bursar, Lecturer, Student, etc.)"
          >
            <KeyRound className="w-3 h-3" /> Quick Switch Role
          </button>}
        </div>
      </div>

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
              <span className="font-black text-base sm:text-lg text-emerald-900 dark:text-emerald-400 tracking-tight">
                {settings?.shortName || 'EDOCASTI'}
              </span>
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                {pageContent?.portalBadgeText || 'Official Portal'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden xl:block">
              {settings?.institutionName || 'Edo State College of Agriculture, Science and Technology'}
            </p>
          </div>
        </div>

        {/* Persistent Global Search Bar */}
        {user && ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'].includes(user.role) && <div className="flex-1 max-w-md hidden md:block">
          <GlobalSearchBar onNavigate={(tab, sub) => setActiveTab(tab, sub)} onOpenPrintModal={onOpenPrintModal} />
        </div>}

        {/* Dynamic Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          {!user && <button
            onClick={() => setActiveTab('public')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'public'
                ? 'bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Public Info
          </button>}

          {(!user || canAccessWorkspace(user.role, 'admissions')) && <button
            onClick={() => setActiveTab('admissions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'admissions'
                ? 'bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  {user.fullName}
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase">
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
                className="p-2 text-slate-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
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
      <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-slate-100 dark:border-slate-800 gap-1 bg-slate-50 dark:bg-slate-900/90 text-xs">
        {!user && <button
          onClick={() => setActiveTab('public')}
          className={`px-3 py-1 rounded-md shrink-0 font-medium ${
            activeTab === 'public'
              ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          College Info
        </button>}
        {(!user || canAccessWorkspace(user.role, 'admissions')) && <button
          onClick={() => setActiveTab('admissions')}
          className={`px-3 py-1 rounded-md shrink-0 font-medium ${
            activeTab === 'admissions'
              ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-slate-700 dark:text-slate-300'
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
                : 'text-slate-700 dark:text-slate-300'
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
              : 'text-slate-700 dark:text-slate-300'
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
                  : 'text-slate-700 dark:text-slate-300'
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
