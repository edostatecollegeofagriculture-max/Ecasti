export interface ResultApprovalActor {
  role: string;
  departmentId?: string;
}

export interface ResultApprovalCourse {
  departmentId?: string;
}

export interface ResultApprovalRecord {
  status: string;
}

/** HODs may approve only lecturer-submitted results in their own department. */
export function canHodApproveResult(
  actor: ResultApprovalActor | undefined,
  course: ResultApprovalCourse | undefined,
  result: ResultApprovalRecord | undefined,
): boolean {
  return Boolean(
    actor?.role === 'HOD' &&
    actor.departmentId &&
    course &&
    course.departmentId === actor.departmentId &&
    result?.status === 'SUBMITTED'
  );
}

/** Exam Officers may moderate only HOD-approved results in their own department. */
export function canExamOfficerModerateResult(
  actor: ResultApprovalActor | undefined,
  course: ResultApprovalCourse | undefined,
  result: ResultApprovalRecord | undefined,
): boolean {
  if (!actor || result?.status !== 'HOD_APPROVED') return false;
  if (actor.role !== 'EXAM_OFFICER') return false;
  return Boolean(actor.departmentId && course && course.departmentId === actor.departmentId);
}

/** Publishing is blocked until the HOD approval stage has completed. */
export function isHodApprovedForPublication(result: ResultApprovalRecord | undefined): boolean {
  return result?.status === 'HOD_APPROVED';
}
