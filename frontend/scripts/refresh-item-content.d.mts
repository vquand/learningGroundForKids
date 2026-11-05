export interface CatalogRefreshResult {
  total: number;
  reviewed: number;
  unresolved: number;
  write: boolean;
}

export function refreshCatalogFiles(options?: {
  write?: boolean;
  limit?: number;
  title?: string;
  category?: string;
  wikidataOnly?: boolean;
  localOnly?: boolean;
  sourceOnly?: boolean;
  onlyInsufficient?: boolean;
  historyOnly?: boolean;
  vietnameseOnly?: boolean;
  englishOnly?: boolean;
}): Promise<CatalogRefreshResult>;

export interface CatalogSanitizeResult {
  total: number;
  updated: number;
  write: boolean;
}

export function sanitizeCatalogFiles(options?: { write?: boolean }): Promise<CatalogSanitizeResult>;
