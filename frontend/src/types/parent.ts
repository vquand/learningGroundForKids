import type { AdminItemFormData } from "./admin";

export interface ParentLessonAudience {
  id: string;
  scope: "family" | "profile";
  family_id: string;
  family_name: string;
  profile_id?: string | null;
  profile_name?: string | null;
  created_at: string;
}

export interface ParentLessonSummary {
  id: string;
  category: string;
  title: string;
  country_code?: string | null;
  source_type: "system" | "custom";
  owner_family_id?: string | null;
  owner_family_name?: string | null;
  created_at?: string | null;
  is_published: boolean;
  is_disabled_for_family: boolean;
  can_edit: boolean;
  can_share: boolean;
  audiences: ParentLessonAudience[];
}

export interface ParentLessonCatalog {
  system_lessons: ParentLessonSummary[];
  custom_lessons: ParentLessonSummary[];
}

export interface ParentShareTargetProfile {
  id: string;
  name: string;
  public_id?: string | null;
}

export interface ParentShareTargetFamily {
  family_id: string;
  family_name: string;
  profiles: ParentShareTargetProfile[];
}

export interface ParentLessonCreateInput extends AdminItemFormData {
  target_scope: "family" | "profile";
  target_profile_id?: string;
}

export type ParentLessonUpdateInput = Partial<AdminItemFormData>;

export interface ParentLessonDetail {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  country_code?: string | null;
  icon_slug?: string | null;
  is_published: boolean;
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
  translations: { lang: string; title: string; description?: string | null; history?: string | null }[];
}

export interface ParentLessonEditorData {
  item?: ParentLessonDetail;
  catalog?: ParentLessonCatalog;
}

export interface ParentContentItem extends ParentLessonDetail {
  source_type: 'system' | 'custom';
  can_edit: boolean;
  is_disabled_for_family: boolean;
}
