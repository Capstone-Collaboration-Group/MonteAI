/** Matches the analytics API's cap for dashboard queries and chat suggestions. */
export const TOP_QUERY_LIMIT = 3;

export function clampTopQueryLimit(limit: number): number {
  return Number.isFinite(limit)
    ? Math.max(1, Math.min(TOP_QUERY_LIMIT, Math.trunc(limit)))
    : TOP_QUERY_LIMIT;
}

/** Presentation cleanup only; research eligibility is enforced by the server. */
export function normalizeQuerySuggestions(
  values: readonly string[] | null | undefined,
  limit = TOP_QUERY_LIMIT
): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();
  const cap = clampTopQueryLimit(limit);

  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string") continue;
    const text = value.replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;

    seen.add(key);
    suggestions.push(text);
    if (suggestions.length === cap) break;
  }

  return suggestions;
}
