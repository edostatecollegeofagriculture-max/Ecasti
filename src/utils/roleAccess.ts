export type PortalRole =
  | 'SUPER_ADMIN' | 'INSTITUTION_ADMIN' | 'RECTOR' | 'DEAN' | 'HOD'
  | 'EXAM_OFFICER' | 'REGISTRAR' | 'BURSAR' | 'ADMISSIONS_OFFICER'
  | 'LECTURER' | 'STUDENT' | 'APPLICANT';

export type AdminWorkspaceTab =
  | 'analytics' | 'dean_curriculum' | 'hod_allocation' | 'exam_approvals'
  | 'registrar_docs' | 'finance' | 'global_crud' | 'users' | 'settings'
  | 'cms' | 'audit';

const ADMIN_TAB_ROLES: Record<AdminWorkspaceTab, readonly string[]> = {
  analytics: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'],
  dean_curriculum: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'DEAN'],
  hod_allocation: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'DEAN', 'HOD'],
  exam_approvals: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'EXAM_OFFICER'],
  registrar_docs: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'],
  finance: ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'BURSAR'],
  global_crud: ['SUPER_ADMIN', 'INSTITUTION_ADMIN'],
  users: ['SUPER_ADMIN', 'INSTITUTION_ADMIN'],
  settings: ['SUPER_ADMIN', 'INSTITUTION_ADMIN'],
  cms: ['SUPER_ADMIN', 'INSTITUTION_ADMIN'],
  audit: ['SUPER_ADMIN', 'INSTITUTION_ADMIN'],
};

const DEFAULT_ADMIN_TAB: Partial<Record<string, AdminWorkspaceTab>> = {
  SUPER_ADMIN: 'analytics',
  INSTITUTION_ADMIN: 'analytics',
  RECTOR: 'analytics',
  DEAN: 'dean_curriculum',
  HOD: 'hod_allocation',
  EXAM_OFFICER: 'exam_approvals',
  REGISTRAR: 'registrar_docs',
  BURSAR: 'finance',
};

export function canAccessAdminTab(role: string | null | undefined, tab: string): boolean {
  if (!role || !(tab in ADMIN_TAB_ROLES)) return false;
  return ADMIN_TAB_ROLES[tab as AdminWorkspaceTab].includes(role);
}

export function getDefaultAdminTab(role: string | null | undefined): AdminWorkspaceTab | null {
  return role ? DEFAULT_ADMIN_TAB[role] || null : null;
}

export function canAccessWorkspace(role: string | null | undefined, tab: string): boolean {
  if (tab === 'public' || tab === 'admissions') return !role || role === 'APPLICANT' || role === 'ADMISSIONS_OFFICER' || role === 'SUPER_ADMIN' || role === 'INSTITUTION_ADMIN';
  if (!role) return false;
  if (tab === 'student') return role === 'STUDENT' || role === 'SUPER_ADMIN' || role === 'INSTITUTION_ADMIN';
  if (tab === 'lecturer') return ['LECTURER', 'HOD', 'DEAN', 'SUPER_ADMIN', 'INSTITUTION_ADMIN'].includes(role);
  if (tab === 'admin') return getDefaultAdminTab(role) !== null;
  if (tab === 'builder') return role === 'SUPER_ADMIN' || role === 'INSTITUTION_ADMIN';
  return false;
}

export function getRoleHome(role: string | null | undefined): { tab: string; section: string } {
  switch (role) {
    case 'STUDENT': return { tab: 'student', section: 'courses' };
    case 'LECTURER': return { tab: 'lecturer', section: 'overview' };
    case 'APPLICANT':
    case 'ADMISSIONS_OFFICER': return { tab: 'admissions', section: 'overview' };
    default:
      return getDefaultAdminTab(role)
        ? { tab: 'admin', section: getDefaultAdminTab(role)! }
        : { tab: 'public', section: 'overview' };
  }
}
