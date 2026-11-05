import { getUiLanguage, type UiLanguage } from './uiLanguage.ts';

export type StudyGroup = 'subject' | 'pe' | 'club';

export interface StudyCatalogEntry {
  key: string;
  group: StudyGroup;
  en: string;
  vi: string;
  art: string;
}

const entries = [
  ['math', 'subject', 'Math', 'Toán'],
  ['vietnamese', 'subject', 'Vietnamese', 'Tiếng Việt'],
  ['english', 'subject', 'English', 'Tiếng Anh'],
  ['science', 'subject', 'Science', 'Khoa học'],
  ['history_geography', 'subject', 'History and Geography', 'Lịch sử và Địa lí'],
  ['nature_society', 'subject', 'Nature and Society', 'Tự nhiên và Xã hội'],
  ['art', 'subject', 'Art', 'Mĩ thuật'],
  ['music', 'subject', 'Music', 'Âm nhạc'],
  ['computer', 'subject', 'Computer Studies', 'Tin học'],
  ['technology', 'subject', 'Technology', 'Công nghệ'],
  ['ethics', 'subject', 'Ethics', 'Đạo đức'],
  ['handwriting_dictation', 'subject', 'Handwriting and Dictation', 'Tập viết và Chính tả'],
  ['reading', 'subject', 'Reading', 'Đọc sách'],
  ['life_skills', 'subject', 'Life Skills', 'Kĩ năng sống'],
  ['experiential_activities', 'subject', 'Experiential Activities', 'Hoạt động trải nghiệm'],
  ['homeroom', 'subject', 'Homeroom', 'Sinh hoạt lớp'],
  ['flag_salutation', 'subject', 'Flag Salutation', 'Chào cờ'],
  ['stem', 'subject', 'STEM', 'STEM'],
  ['coding', 'subject', 'Coding', 'Lập trình'],
  ['second_language', 'subject', 'Second Language', 'Ngoại ngữ 2'],
  ['craft', 'subject', 'Craft', 'Thủ công'],
  ['library', 'subject', 'Library', 'Thư viện'],
  ['self_study', 'subject', 'Self-study', 'Tự học'],
  ['extra_tutoring', 'subject', 'Extra Tutoring', 'Học thêm'],
  ['pe_swimming', 'pe', 'Swimming', 'Bơi lội'],
  ['pe_football', 'pe', 'Football', 'Bóng đá'],
  ['pe_basketball', 'pe', 'Basketball', 'Bóng rổ'],
  ['pe_badminton', 'pe', 'Badminton', 'Cầu lông'],
  ['pe_table_tennis', 'pe', 'Table Tennis', 'Bóng bàn'],
  ['pe_volleyball', 'pe', 'Volleyball', 'Bóng chuyền'],
  ['pe_gymnastics', 'pe', 'Gymnastics', 'Thể dục dụng cụ'],
  ['pe_athletics', 'pe', 'Athletics', 'Điền kinh'],
  ['pe_martial_arts', 'pe', 'Martial Arts', 'Võ thuật'],
  ['pe_dance', 'pe', 'Dance', 'Múa'],
  ['pe_cycling', 'pe', 'Cycling', 'Đạp xe'],
  ['pe_skating', 'pe', 'Inline Skating', 'Trượt patin'],
  ['club_flower_decoration', 'club', 'Flower Arranging Club', 'CLB Cắm hoa'],
  ['club_chess', 'club', 'Chess Club', 'CLB Cờ vua'],
  ['club_football', 'club', 'Football Club', 'CLB Bóng đá'],
  ['club_drawing', 'club', 'Drawing Club', 'CLB Vẽ'],
  ['club_piano', 'club', 'Piano Club', 'CLB Piano'],
  ['club_guitar', 'club', 'Guitar Club', 'CLB Guitar'],
  ['club_singing', 'club', 'Singing Club', 'CLB Hát'],
  ['club_coding', 'club', 'Coding Club', 'CLB Lập trình'],
  ['club_science', 'club', 'Science Club', 'CLB Khoa học'],
  ['club_debate', 'club', 'Debate Club', 'CLB Tranh biện'],
  ['club_reading', 'club', 'Reading Club', 'CLB Đọc sách'],
  ['club_english', 'club', 'English Club', 'CLB Tiếng Anh'],
  ['club_robotics', 'club', 'Robotics Club', 'CLB Robot'],
  ['club_cooking', 'club', 'Cooking Club', 'CLB Nấu ăn'],
  ['club_calligraphy', 'club', 'Calligraphy Club', 'CLB Thư pháp'],
  ['club_drama', 'club', 'Drama Club', 'CLB Kịch'],
  ['club_photography', 'club', 'Photography Club', 'CLB Nhiếp ảnh'],
  ['club_scouts', 'club', 'Scouts Club', 'CLB Hướng đạo'],
  ['club_origami', 'club', 'Origami Club', 'CLB Gấp giấy'],
] as const satisfies readonly (readonly [string, StudyGroup, string, string])[];

export const STUDY_CATALOG: readonly StudyCatalogEntry[] = entries.map(([key, group, en, vi]) => ({
  key,
  group,
  en,
  vi,
  art: `/calendar/icons/study/${key}.webp`,
}));

/** Decorative row-label artwork for the Morning (top) and Afternoon (bottom) cards. */
export const CALENDAR_TIME_ICONS = {
  sunrise: '/calendar/icons/time/sunrise.webp',
  sunset: '/calendar/icons/time/sunset.webp',
} as const;

export type WeatherIconCatalogEntry = {
  key: WeatherIconKey;
  en: string;
  vi: string;
  art: string;
};

const weatherEntries = [
  ['sunny', 'Sunny', 'Nắng'],
  ['partly_cloudy', 'Partly cloudy', 'Ít mây'],
  ['cloudy', 'Cloudy', 'Nhiều mây'],
  ['fog', 'Fog', 'Sương mù'],
  ['drizzle', 'Drizzle', 'Mưa phùn'],
  ['rain', 'Rain', 'Mưa'],
  ['heavy_rain', 'Heavy rain', 'Mưa to'],
  ['thunderstorm', 'Thunderstorm', 'Dông'],
  ['clear_night', 'Clear night', 'Trời quang (đêm)'],
  ['hot', 'Hot', 'Nắng nóng'],
  ['windy', 'Windy', 'Gió'],
  ['cloudy_night', 'Cloudy night', 'Nhiều mây (đêm)'],
] as const satisfies readonly (readonly [string, string, string])[];

export type WeatherIconKey = typeof weatherEntries[number][0];

export const WEATHER_ICON_KEYS = weatherEntries.map(([key]) => key) as readonly WeatherIconKey[];
export const WEATHER_ICON_CATALOG: readonly WeatherIconCatalogEntry[] = weatherEntries.map(([key, en, vi]) => ({
  key,
  en,
  vi,
  art: `/calendar/icons/weather/${key}.webp`,
}));
export const WEATHER_ICON_LOOKUP = Object.fromEntries(
  WEATHER_ICON_CATALOG.map((entry) => [entry.key, entry]),
) as Readonly<Record<WeatherIconKey, WeatherIconCatalogEntry>>;

export type StudyKey = typeof entries[number][0];
export const STUDY_KEYS = entries.map(([key]) => key) as readonly StudyKey[];
export const STUDY_GROUP_BY_KEY = Object.fromEntries(
  entries.map(([key, group]) => [key, group]),
) as Readonly<Record<StudyKey, StudyGroup>>;

const STUDY_BY_KEY = new Map(STUDY_CATALOG.map((entry) => [entry.key, entry]));

export function studyLabel(key: StudyKey, language: UiLanguage = getUiLanguage()): string {
  const entry = STUDY_BY_KEY.get(key);
  return entry ? (language === 'vi' ? entry.vi : entry.en) : key;
}

export function isStudyKey(value: unknown): value is StudyKey {
  return typeof value === 'string' && STUDY_BY_KEY.has(value as StudyKey);
}

export function studyEntry(key: StudyKey): StudyCatalogEntry {
  return STUDY_BY_KEY.get(key)!;
}

export function weatherIconEntry(key: WeatherIconKey): WeatherIconCatalogEntry {
  return WEATHER_ICON_LOOKUP[key];
}
