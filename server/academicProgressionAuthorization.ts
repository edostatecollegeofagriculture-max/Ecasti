export type AcademicRole =
  | 'SUPER_ADMIN' | 'INSTITUTION_ADMIN' | 'REGISTRAR' | 'RECTOR'
  | 'DEAN' | 'HOD' | 'EXAM_OFFICER' | 'STUDENT' | string;

export interface AcademicActor {
  id: string;
  role: AcademicRole;
  departmentId?: string;
  schoolId?: string;
}

export interface AcademicStudentScope {
  userId: string;
  departmentId: string;
  schoolId: string;
}

const INSTITUTION_WIDE_ROLES = new Set([
  'SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'RECTOR',
]);

export function canReadStudentAcademicRecord(
  actor: AcademicActor | undefined,
  student: AcademicStudentScope
): boolean {
  if (!actor) return false;
  if (INSTITUTION_WIDE_ROLES.has(actor.role)) return true;
  if (actor.role === 'DEAN') {
    return Boolean(actor.schoolId && actor.schoolId === student.schoolId);
  }
  if (actor.role === 'HOD' || actor.role === 'EXAM_OFFICER') {
    return Boolean(actor.departmentId && actor.departmentId === student.departmentId);
  }
  if (actor.role === 'STUDENT') return actor.id === student.userId;
  return false;
}

export function canSubmitOwnStudentException(
  actor: AcademicActor | undefined,
  student: AcademicStudentScope
): boolean {
  if (!actor) return false;
  if (actor.role === 'STUDENT') return actor.id === student.userId;
  return ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'].includes(actor.role);
}

/** Rector and SUPER_ADMIN may approve; SUPER_ADMIN acts on behalf of the Rector. */
export function canApproveExtensionYearThreeManagementPass(
  actor: AcademicActor | undefined
): boolean {
  return actor?.role === 'RECTOR' || actor?.role === 'SUPER_ADMIN';
}

/** Shared requireRoles middleware grants SUPER_ADMIN a global bypass. */
export function hasRequiredAcademicRole(
  actor: AcademicActor | undefined,
  allowedRoles: readonly string[]
): boolean {
  if (!actor) return false;
  return actor.role === 'SUPER_ADMIN' || allowedRoles.includes(actor.role);
}
