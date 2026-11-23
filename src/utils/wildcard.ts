/**
 * Matches a wildcard/glob query against one or more string/number fields.
 * Supports `*` (0 or more characters), `?` (single character), and space-separated terms (AND logic).
 */
export function matchesWildcard(query: string, ...fields: Array<string | number | undefined | null>): boolean {
  const raw = (query || '').trim().toLowerCase();
  if (!raw) return true;

  const haystack = fields
    .filter((f) => f !== undefined && f !== null)
    .map((f) => String(f).toLowerCase())
    .join(' | ');

  const tokens = raw.split(/\s+/).filter(Boolean);

  return tokens.every((token) => {
    if (token.includes('*') || token.includes('?')) {
      const escaped = token
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(escaped, 'i');
      // Test both combined haystack and individual fields for precise glob matching
      return (
        regex.test(haystack) ||
        fields.some((f) => f !== undefined && f !== null && regex.test(String(f)))
      );
    }
    return haystack.includes(token);
  });
}
