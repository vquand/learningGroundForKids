export function countWords(value: unknown): number;
export function truncateWords(value: unknown, maximum?: number): string;
export function isLikelyVietnamese(value: unknown): boolean;
export function isQualityDescription(value: unknown, options?: { language?: string }): boolean;
export function isPlaceholderText(value: unknown): boolean;
export function isInsufficientContent(value: unknown): boolean;
export function normalizeCatalogItem(item: any): any;
export function classifyCatalogCategory(value: unknown): string | null;
export function buildReviewedItem(item: any, source: any): any;
