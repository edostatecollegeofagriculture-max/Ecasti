export type PortalRole =
  | 'SUPER_ADMIN' | 'INSTITUTION_ADMIN' | 'RECTOR' | 'DEAN' | 'HOD'
  | 'EXAM_OFFICER' | 'REGISTRAR' | 'BURSAR' | 'ADMISSIONS_OFFICER'
  | 'LECTURER' | 'STUDENT' | 'APPLICANT';

export type AdminWorkspaceTab =
  | 'analytics' | 'dean_curriculum' | 'hod_allocation' | 'exam_approvals' | 'registrar_docs' | 'finance' | 'global_crud' | 'users'
  | 'settings' | 'cms' | 'audit';

const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'RECTOR'] as const;

const ADMIN_TAB_ROLES: Record<AdminWorkspaceTab, readonly string[]> = {
  analytics: [...FULL_ACCESS_ROLES],
  dean_curriculum: [...FULL_ACCESS_ROLES, 'DEAN'],
  hod_allocation: [...FULL_ACCESS_ROLES, 'HOD'],
  exam_approvals: [...FULL_ACCESS_ROLES, 'HOD', 'EXAM_OFFICER'],
  registrar_docs: [...FULL_ACCESS_ROLES, 'REGISTRAR'],
  finance: [...FULL_ACCESS_ROLES, 'BURSAR'],
  global_crud: [...FULL_ACCESS_ROLES],
  users: [...FULL_ACCESS_ROLES],
  settings: [...FULL_ACCESS_ROLES],
  cms: [...FULL_ACCESS_ROLES],
  audit: [...FULL_ACCESS_ROLES],
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
  if (FULL_ACCESS_ROLES.includes(role as typeof FULL_ACCESS_ROLES[number])) return true;
  if (tab === 'public' || tab === 'admissions') return !role || role === 'APPLICANT' || role === 'ADMISSIONS_OFFICER';
  if (!role) return false;
  if (tab === 'student') return role === 'STUDENT';
  if (tab === 'lecturer') return role === 'LECTURER';
  if (tab === 'admin') return getDefaultAdminTab(role) !== null;
  if (tab === 'builder') return false;
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
