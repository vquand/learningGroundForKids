import type { JourneyRoute } from "./journey";

export interface AdminItemSummary {
  id: string;
  category: string;
  is_published: boolean;
  title_en?: string;
  title_vi?: string;
  created_at?: string;
}

export type AdminCatalogRefreshJobStatus = "queued" | "running" | "completed" | "failed";

export interface AdminCatalogRefreshJob {
  job_id: string;
  status: AdminCatalogRefreshJobStatus;
  total_batches: number | null;
  completed_batches: number;
  updated_count: number;
  skipped_count: number;
  batches: number;
  error?: string;
}

export type AdminCatalogRefreshStatus = AdminCatalogRefreshJob | { status: "idle" };

export interface AdminCatalogItemDetail extends AdminItemFormData {
  id: string;
  translations: { lang: string; title: string; description?: string | null; history?: string | null }[];
  media: { id: string; media_type: string; label?: string | null; filename: string; sort_order: number }[];
  quiz_questions: unknown[];
}

export interface AdminStats {
  totalItems: number;
  publishedItems: number;
  unpublishedItems: number;
  itemsByCategory: Record<string, number>;
}

export interface AIGenerateRequest {
  category: string;
  name: string;
  url?: string;
}

export interface AIEnrichRequest {
  item_id: string;
  instructions: string;
}

export interface AIGenerateResponse {
  draft: Record<string, unknown>;
}

export interface AdminGenerateItemImageRequest {
  replace_existing?: boolean;
}

export interface AdminGenerateItemImageResponse {
  item_id: string;
  filename: string;
  url: string;
  source_page_title: string;
  source_image_url: string;
  replaced_media_id: string | null;
}

export interface AdminFriendRequestSummary {
  id: string;
  requesting_family_id: string;
  requesting_family_name: string;
  requesting_scope: "profile" | "family";
  requesting_profile_id: string | null;
  requesting_profile_name: string | null;
  requesting_label: string;
  target_family_id: string;
  target_family_name: string;
  target_scope: "profile" | "family";
  target_profile_id: string | null;
  target_profile_name: string | null;
  target_label: string;
  target_code: string;
  requester_message: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  responded_at: string | null;
  responded_by_family_id: string | null;
}

export interface AdminFamilyProfileSummary {
  recent_activities: {
    item_id: string;
    item_title: string;
    item_category: string;
    completed_at: string;
  }[];
  id: string;
  name: string;
  emoji: string;
  color: string;
  public_id: string | null;
  created_at: string;
  total_done: number;
  badge_count: number;
  total_items: number;
  completion_rate: number;
}

export interface FamilyOut {
  id: string;
  display_name: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  created_at: string;
  profile_count: number;
  accepted_request_count: number;
  pending_incoming_count: number;
  pending_outgoing_count: number;
  rejected_request_count: number;
  profiles: AdminFamilyProfileSummary[];
  friend_requests: AdminFriendRequestSummary[];
}

export interface AdminProfileDetail {
  id: string; name: string; emoji: string; color: string; public_id: string | null;
  created_at: string; family_id: string; family_name: string;
  total_done: number; badge_count: number; quiz_attempt_count: number; flashcard_session_count: number;
}

export type AdminActivityType = "all" | "completion" | "quiz" | "flashcard";
export interface AdminActivity {
  id: string; type: Exclude<AdminActivityType, "all">; occurred_at: string;
  item_id: string | null; item_title: string | null; item_category: string | null;
  score: number | null; total: number | null;
  theme_type: string | null; theme_value: string | null;
  cards_shown: number | null; got_it_count: number | null; review_again_count: number | null;
}
export interface AdminActivityPage {
  activities: AdminActivity[]; page: number; page_size: number; total: number; total_pages: number;
}
export type AdminJourneyPeriod = "today" | "yesterday" | "last3days" | "last7days" | "all";
export interface AdminJourneyPage extends JourneyRoute {
  total: number; page: number; page_size: number; total_pages: number;
}

export interface AdminAssessmentSummary {
  id: string;
  item_id: string;
  assessment_type: string;
  item_title: string;
  item_category: string;
  country_code: string | null;
  created_at: string;
  question_count: number;
  active_question_count: number;
  language_count: number;
  attempt_count: number;
  unique_profile_count: number;
  pass_rate: number;
  fail_rate: number;
  average_score_rate: number;
  average_time_seconds: number | null;
  latest_attempt_at: string | null;
}

export interface AdminAssessmentQuestion {
  id: string;
  item_id: string;
  question_group_id: string | null;
  lang: string;
  question_type: string;
  question: string;
  options: string[];
  correct_answers: number[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface AdminAssessmentPerformance {
  profile_id: string;
  profile_name: string;
  profile_emoji: string;
  profile_color: string;
  public_id: string | null;
  family_id: string | null;
  family_name: string;
  attempt_count: number;
  pass_count: number;
  fail_count: number;
  success_rate: number;
  fail_rate: number;
  average_score_rate: number;
  average_time_seconds: number | null;
  best_score: number;
  best_total: number;
  latest_score: number;
  latest_total: number;
  latest_completed_at: string | null;
}

export interface AdminAssessmentDetail extends AdminAssessmentSummary {
  questions: AdminAssessmentQuestion[];
  performance: AdminAssessmentPerformance[];
}

export interface AdminItemFormData {
  category: string;
  latitude: number;
  longitude: number;
  country_code?: string | null;
  icon_slug?: string | null;
  is_published: boolean;
  title_en?: string;
  title_vi?: string;
  description_en?: string | null;
  description_vi?: string | null;
  history_en?: string | null;
  history_vi?: string | null;
  recipe?: string | null;
  location_desc?: string | null;
  fun_facts?: string[] | null;
  audio_urls?: { label?: string; url: string }[] | null;
  youtube_url?: string | null;
  trailer_url?: string | null;
  characters?: { name: string; image_url?: string; description?: string }[] | null;
  start_year?: number | null;
  end_year?: number | null;
  time_precision?: string | null;
  released_date?: string | null;
  rich_fields?: Record<string, unknown> | null;
  franchise_id?: string | null;
  quiz_required?: boolean;
}
