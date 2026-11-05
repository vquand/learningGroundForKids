export interface PublicationReviewItem {
  translations?: Array<{ lang: string; title?: string; description?: string | null; history?: string | null }>;
  fun_facts?: unknown;
  location_desc?: string | null;
  recipe?: string | null;
  rich_fields?: Record<string, unknown>;
}
export function reviewCatalogPublication(item: PublicationReviewItem): {
  reason: 'generated-filler-without-substantive-explanation' | 'too-little-explanatory-content' | 'short-description-recycled-as-facts' | null;
  description_words: number;
  substantive_words: number;
};
