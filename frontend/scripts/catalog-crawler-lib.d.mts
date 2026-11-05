export function canonicalCategory(value: unknown): string | null;

export function buildCatalogItem(
  category: string,
  metadata: Record<string, unknown>,
  countryPoolEn: string[],
  countryPoolVi: string[],
): Record<string, unknown>;

export function buildQuizQuestions(metadata: Record<string, unknown>): Array<Record<string, unknown>>;
