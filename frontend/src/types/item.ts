export const CATEGORIES = [
  "food",
  "monument",
  "landmark",
  "music",
  "movie",
  "phenomenon",
  "animal",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ItemSummary {
  id: string;
  category: Category;
  latitude: number;
  longitude: number;
  country_code?: string;
  title: string;
  icon_slug: string;
  start_year?: number;
  end_year?: number;
  has_quiz?: boolean;
  quiz_required: boolean;
}

export interface TranslationOut {
  lang: string;
  title: string;
  description?: string;
  history?: string;
}

export interface MediaOut {
  id: string;
  media_type: string;
  label?: string;
  filename: string;
  url: string;
}

export interface AudioUrlEntry {
  label?: string;
  url: string;
  type?: string;
}

export interface Character {
  name: string;
  image_url?: string;
  description?: string;
}

export interface FoodRichFields {
  ingredients?: { name: string; quantity: string }[];
  recipe_steps?: string[];
  origin_date?: string;
  inventor?: string;
  youtube_url?: string;
}

export interface MonumentRichFields {
  construction_date?: string;
  ordered_by?: string;
  designed_by?: string;
  dimensions?: Record<string, string>;
  floor_plan_url?: string;
}

export interface AnimalRichFields {
  classification?: string;
  population?: string;
  endangered_status?: string;
}

export interface LandmarkRichFields {
  key_stats?: Record<string, string>;
}

export interface MusicRichFields {
  composer?: string;
  vocalists?: string[];
  release_year?: number;
  related_movie_ids?: string[];
}

export interface PhenomenonRichFields {
  kid_metrics?: Record<string, string>;
}

export interface MovieRichFields {
  story_blurb?: string;
}

export interface FranchiseSibling {
  id: string;
  title: string;
}

export interface ItemDetail {
  id: string;
  category: Category;
  latitude: number;
  longitude: number;
  country_code?: string;
  translation?: TranslationOut;
  media: MediaOut[];
  available_languages: string[];
  recipe?: string;
  location_desc?: string;
  fun_facts?: string[];
  audio_urls?: AudioUrlEntry[];
  youtube_url?: string;
  trailer_url?: string;
  characters?: Character[];
  start_year?: number;
  end_year?: number;
  time_precision?: 'mya' | 'kya' | 'century' | 'decade' | 'year' | 'exact';
  released_date?: string;
  rich_fields?: Record<string, unknown>;
  franchise_id?: string;
  franchise_siblings?: FranchiseSibling[];
  has_quiz?: boolean;
  quiz_required?: boolean;
}
