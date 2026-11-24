import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Breadcrumbs } from './components/Breadcrumbs';
import { PersonaSwitcherModal } from './components/PersonaSwitcherModal';
import { LoginModal } from './components/LoginModal';
import { PrintSlipModal } from './components/PrintSlipModal';
import { SchoolLogo } from './components/SchoolLogo';
import { KeyRound } from 'lucide-react';
import { canAccessWorkspace, getRoleHome } from './utils/roleAccess';

const PublicPortal = lazy(() => import('./views/PublicPortal').then((module) => ({ default: module.PublicPortal })));
const AdmissionsPortal = lazy(() => import('./views/AdmissionsPortal').then((module) => ({ default: module.AdmissionsPortal })));
const StudentPortal = lazy(() => import('./views/StudentPortal').then((module) => ({ default: module.StudentPortal })));
const LecturerPortal = lazy(() => import('./views/LecturerPortal').then((module) => ({ default: module.LecturerPortal })));
const AdminPortal = lazy(() => import('./views/AdminPortal').then((module) => ({ default: module.AdminPortal })));
const PageBuilder = lazy(() => import('./components/PageBuilder').then((module) => ({ default: module.PageBuilder })));

type PrintModalState = {
  isOpen: boolean;
  type: any;
  data: any;
};

const getWorkspaceForRole = getRoleHome;

const MainApp: React.FC = () => {
  const { user, settings } = useAuth();
  const [activeTab, setActiveTab] = useState('public');
  const [activeSubSection, setActiveSubSection] = useState<string | undefined>('overview');
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const [printModalState, setPrintModalState] = useState<PrintModalState>({
    isOpen: false,
    type: 'ADMISSION_LETTER',
    data: null,
  });

  // A changed identity or role must not inherit the previous account's portal.
  useEffect(() => {
    const destination = getWorkspaceForRole(user?.role);

    setActiveTab(destination.tab);
    setActiveSubSection(destination.section);
    setIsPersonaModalOpen(false);
    setIsLoginModalOpen(false);
    setPrintModalState((current) => ({ ...current, isOpen: false, data: null }));
  }, [user?.id, user?.email, user?.role]);

  const openPrintModal = (type: any, data: any) => {
    setPrintModalState({ isOpen: true, type, data });
  };

  const closePrintModal = () => {
    setPrintModalState((current) => ({ ...current, isOpen: false }));
  };

  const handleNavigate = (tab: string, subSection?: string) => {
    if (!canAccessWorkspace(user?.role, tab)) {
      const home = getRoleHome(user?.role);
      setActiveTab(home.tab);
      setActiveSubSection(home.section);
      return;
    }
    setActiveTab(tab);
    setActiveSubSection(subSection || 'overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 selection:bg-emerald-200 dark:selection:bg-emerald-900 selection:text-emerald-950 dark:selection:text-emerald-100 transition-colors duration-200 overflow-x-hidden">
      <div
        className="fixed inset-0 pointer-events-none select-none z-0 flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <SchoolLogo
          variant="watermark"
          size="min(75vw, 700px)"
          watermarkOpacity={0.04}
          className="transition-opacity duration-300"
        />
      </div>

      <Navbar
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        onOpenPersonaModal={() => setIsPersonaModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenPrintModal={openPrintModal}
      />

      {activeTab !== 'builder' && (
        <Breadcrumbs
          tab={activeTab}
          subSection={activeSubSection}
          onNavigate={handleNavigate}
        />
      )}

      <main className="relative z-10 flex-1">
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600 dark:text-slate-300" role="status">
              Loading portal...
            </div>
          }
        >
        {activeTab === 'public' && (
          <PublicPortal
            onGoToAdmissions={() => handleNavigate('admissions', 'form')}
            onGoToLogin={() => setIsLoginModalOpen(true)}
            onNavigateSection={handleNavigate}
          />
        )}

        {activeTab === 'admissions' && (
          <AdmissionsPortal
            onOpenPrintModal={openPrintModal}
            onGoToStudentWorkspace={() => handleNavigate('student', 'courses')}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
          />
        )}

        {activeTab === 'student' && (
          <StudentPortal onOpenPrintModal={openPrintModal} />
        )}

        {activeTab === 'lecturer' && <LecturerPortal />}

        {activeTab === 'admin' && (
          <AdminPortal
            onOpenPrintModal={openPrintModal}
            onOpenPageBuilder={() => handleNavigate('builder')}
          />
        )}

        {activeTab === 'builder' && canAccessWorkspace(user?.role, 'builder') && (
          <PageBuilder
            onExitBuilder={() => handleNavigate('public')}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
          />
        )}
        </Suspense>
      </main>


      <PersonaSwitcherModal
        isOpen={isPersonaModalOpen}
        onClose={() => setIsPersonaModalOpen(false)}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <PrintSlipModal
        isOpen={printModalState.isOpen}
        onClose={closePrintModal}
        type={printModalState.type}
        data={printModalState.data}
        settings={settings}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
