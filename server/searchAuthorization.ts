const INSTITUTION_WIDE_SEARCH_ROLES = new Set([
  'SUPER_ADMIN',
  'INSTITUTION_ADMIN',
  'REGISTRAR',
  'RECTOR',
]);

const APPLICANT_SEARCH_ROLES = new Set([
  ...INSTITUTION_WIDE_SEARCH_ROLES,
  'ADMISSIONS_OFFICER',
]);

export function canSearchInstitutionStudents(role?: string): boolean {
  return Boolean(role && INSTITUTION_WIDE_SEARCH_ROLES.has(role));
}

export function canSearchApplicants(role?: string): boolean {
  return Boolean(role && APPLICANT_SEARCH_ROLES.has(role));
}
