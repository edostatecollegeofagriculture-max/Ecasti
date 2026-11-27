export function canManageStagingDemoData(role: string | undefined): boolean {
  // Deliberately do not use the broad academic/global-access bypass: Rector and
  // Institution Admin must not inherit this Super Admin-only capability.
  return role === 'SUPER_ADMIN';
}
