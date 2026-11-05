import { getUiLanguage, type UiLanguage } from './uiLanguage.ts';
import { STUDY_CATALOG } from './calendarCatalog.ts';
import { MEAL_FOOD_CATALOG } from './calendarMealCatalog.ts';
import type { SystemEventKey } from '../types/calendarEvents.ts';
import { CALENDAR_EVENTS_COPY } from '../components/Calendar/calendarEventsCopy.ts';

/**
 * Premade icons for kid events. Keys must match server/src/calendar/catalog.ts; the parity test
 * server/tests/calendar-event-parity.test.ts fails when they drift. Labels are natural copy, not translations of keys.
 */
export interface EventIconEntry { key: string; en: string; vi: string; art: string; }
export interface SystemEventCatalogEntry extends EventIconEntry { key: SystemEventKey; }

export const GENERIC_EVENT_GROUPS = ['outdoors', 'school', 'family', 'health', 'home', 'celebrations'] as const;
export type GenericEventGroup = typeof GENERIC_EVENT_GROUPS[number];
export interface GenericEventCatalogEntry extends EventIconEntry { group: GenericEventGroup; }

/** Fallback artwork for an unknown key (only reachable if the server ever sends a key this build does not know). */
const UNKNOWN_EVENT_ART = '/calendar/icons/events/celebrations/star.webp';

const SYSTEM_EVENT_ROWS: readonly { key: SystemEventKey; en: string; vi: string }[] = [
  { key: 'tet', en: 'Tết (Lunar New Year)', vi: 'Tết Nguyên đán' },
  { key: 'mid_autumn', en: 'Mid-Autumn Festival', vi: 'Tết Trung thu' },
  { key: 'halloween', en: 'Halloween', vi: 'Halloween' },
  { key: 'christmas', en: 'Christmas', vi: 'Giáng sinh' },
  { key: 'national_day', en: 'National Day (2 Sep)', vi: 'Quốc khánh 2/9' },
  { key: 'womens_day_oct20', en: "Vietnamese Women's Day (20 Oct)", vi: 'Ngày Phụ nữ Việt Nam 20/10' },
  { key: 'womens_day_mar8', en: "International Women's Day (8 Mar)", vi: 'Ngày Quốc tế Phụ nữ 8/3' },
  { key: 'teachers_day', en: "Vietnamese Teachers' Day (20 Nov)", vi: 'Ngày Nhà giáo Việt Nam 20/11' },
  { key: 'childrens_day', en: "International Children's Day (1 Jun)", vi: 'Ngày Quốc tế Thiếu nhi 1/6' },
];

export const SYSTEM_EVENT_CATALOG: readonly SystemEventCatalogEntry[] = SYSTEM_EVENT_ROWS.map((entry) => ({
  ...entry,
  art: `/calendar/icons/events/system/${entry.key}.webp`,
}));

type GenericRow = readonly [key: string, group: GenericEventGroup, en: string, vi: string];

const GENERIC_ROWS = [
  ['gardening', 'outdoors', 'Gardening', 'Làm vườn'],
  ['hiking', 'outdoors', 'Hiking', 'Đi bộ đường dài'],
  ['camping', 'outdoors', 'Camping', 'Cắm trại'],
  ['beach', 'outdoors', 'Beach day', 'Đi biển'],
  ['fishing', 'outdoors', 'Fishing', 'Câu cá'],
  ['picnic', 'outdoors', 'Picnic', 'Dã ngoại'],
  ['skiing', 'outdoors', 'Skiing', 'Trượt tuyết'],
  ['cycling_trip', 'outdoors', 'Bike ride', 'Đạp xe chơi'],
  ['kayaking', 'outdoors', 'Kayaking', 'Chèo kayak'],
  ['sightseeing', 'outdoors', 'Sightseeing', 'Tham quan'],
  ['road_trip', 'outdoors', 'Road trip', 'Đi xa bằng ô tô'],
  ['train_trip', 'outdoors', 'Train trip', 'Đi tàu hỏa'],
  ['airplane_trip', 'outdoors', 'Plane trip', 'Đi máy bay'],
  ['boat_trip', 'outdoors', 'Boat trip', 'Đi thuyền'],
  ['zoo', 'outdoors', 'Zoo', 'Sở thú'],
  ['aquarium', 'outdoors', 'Aquarium', 'Thủy cung'],
  ['museum', 'outdoors', 'Museum', 'Bảo tàng'],
  ['amusement_park', 'outdoors', 'Amusement park', 'Công viên giải trí'],
  ['playground', 'outdoors', 'Playground', 'Sân chơi'],
  ['kite_flying', 'outdoors', 'Kite flying', 'Thả diều'],
  ['bird_watching', 'outdoors', 'Bird watching', 'Ngắm chim'],
  ['stargazing', 'outdoors', 'Stargazing', 'Ngắm sao'],
  ['swimming_pool', 'outdoors', 'Swimming pool', 'Bể bơi'],
  ['snow_play', 'outdoors', 'Snow play', 'Chơi tuyết'],
  ['school_trip', 'school', 'School trip', 'Đi học ngoại khóa'],
  ['exam', 'school', 'Test', 'Bài kiểm tra'],
  ['homework_due', 'school', 'Homework due', 'Nộp bài tập'],
  ['library_visit', 'school', 'Library visit', 'Đi thư viện'],
  ['science_fair', 'school', 'Science fair', 'Hội khoa học'],
  ['sports_day', 'school', 'Sports day', 'Ngày hội thể thao'],
  ['school_play', 'school', 'School play', 'Vở kịch ở trường'],
  ['concert', 'school', 'Concert', 'Buổi hòa nhạc'],
  ['recital', 'school', 'Recital', 'Buổi biểu diễn'],
  ['competition', 'school', 'Competition', 'Cuộc thi'],
  ['graduation', 'school', 'Graduation', 'Lễ tốt nghiệp'],
  ['parent_meeting', 'school', 'Parent meeting', 'Họp phụ huynh'],
  ['birthday', 'family', 'Birthday', 'Sinh nhật'],
  ['party', 'family', 'Party', 'Bữa tiệc'],
  ['sleepover', 'family', 'Sleepover', 'Ngủ lại nhà bạn'],
  ['playdate', 'family', 'Playdate', 'Hẹn chơi với bạn'],
  ['visit_grandparents', 'family', 'Visit grandparents', 'Thăm ông bà'],
  ['family_dinner', 'family', 'Family dinner', 'Bữa cơm gia đình'],
  ['wedding', 'family', 'Wedding', 'Đám cưới'],
  ['new_baby', 'family', 'New baby', 'Em bé mới'],
  ['pet_care', 'family', 'Pet care', 'Chăm thú cưng'],
  ['family_photo', 'family', 'Family photo', 'Chụp ảnh gia đình'],
  ['video_call', 'family', 'Video call', 'Gọi video'],
  ['volunteering', 'family', 'Volunteering', 'Làm tình nguyện'],
  ['doctor', 'health', 'Doctor visit', 'Đi khám bác sĩ'],
  ['dentist', 'health', 'Dentist', 'Khám răng'],
  ['haircut', 'health', 'Haircut', 'Cắt tóc'],
  ['vaccination', 'health', 'Vaccination', 'Tiêm chủng'],
  ['eye_check', 'health', 'Eye check', 'Khám mắt'],
  ['medicine_time', 'health', 'Medicine time', 'Giờ uống thuốc'],
  ['cleaning', 'home', 'Cleaning', 'Dọn dẹp'],
  ['cooking_together', 'home', 'Cooking together', 'Cùng nấu ăn'],
  ['baking', 'home', 'Baking', 'Làm bánh'],
  ['shopping', 'home', 'Shopping', 'Đi chợ'],
  ['movie_night', 'home', 'Movie night', 'Xem phim tối'],
  ['game_night', 'home', 'Game night', 'Chơi game tối'],
  ['painting', 'home', 'Painting', 'Vẽ tranh'],
  ['crafts', 'home', 'Crafts', 'Làm thủ công'],
  ['reading_time', 'home', 'Reading time', 'Giờ đọc sách'],
  ['music_lesson', 'home', 'Music lesson', 'Học nhạc'],
  ['dance_lesson', 'home', 'Dance lesson', 'Học nhảy'],
  ['swimming_lesson', 'home', 'Swimming lesson', 'Học bơi'],
  ['drawing_class', 'home', 'Drawing class', 'Lớp vẽ'],
  ['coding_class', 'home', 'Coding class', 'Lớp lập trình'],
  ['tutoring', 'home', 'Tutoring', 'Học thêm'],
  ['building_blocks', 'home', 'Building blocks', 'Xếp khối'],
  ['board_game', 'home', 'Board game', 'Cờ bàn'],
  ['karaoke', 'home', 'Karaoke', 'Hát karaoke'],
  ['photography_walk', 'home', 'Photo walk', 'Đi chụp ảnh'],
  ['puzzle', 'home', 'Puzzle', 'Xếp hình'],
  ['fireworks', 'celebrations', 'Fireworks', 'Pháo hoa'],
  ['new_year', 'celebrations', 'New Year', 'Năm mới'],
  ['lantern', 'celebrations', 'Lantern', 'Đèn lồng'],
  ['gift', 'celebrations', 'Gift', 'Quà'],
  ['flowers', 'celebrations', 'Flowers', 'Hoa'],
  ['flag', 'celebrations', 'Flag', 'Lá cờ'],
  ['trophy', 'celebrations', 'Trophy', 'Cúp'],
  ['medal', 'celebrations', 'Medal', 'Huy chương'],
  ['balloon', 'celebrations', 'Balloon', 'Bóng bay'],
  ['confetti', 'celebrations', 'Confetti', 'Giấy kim tuyến'],
  ['star', 'celebrations', 'Star', 'Ngôi sao'],
  ['heart', 'celebrations', 'Heart', 'Trái tim'],
] as const satisfies readonly GenericRow[];

export const GENERIC_EVENT_CATALOG: readonly GenericEventCatalogEntry[] = GENERIC_ROWS.map(([key, group, en, vi]) => ({
  key,
  group,
  en,
  vi,
  art: `/calendar/icons/events/${group}/${key}.webp`,
}));

const STUDY_EVENT_ENTRIES: readonly EventIconEntry[] = STUDY_CATALOG.map(({ key, en, vi, art }) => ({ key, en, vi, art }));
const MEAL_EVENT_ENTRIES: readonly EventIconEntry[] = MEAL_FOOD_CATALOG.map(({ key, en, vi, art }) => ({ key, en, vi, art }));

export interface EventIconTab {
  id: 'study' | 'meals' | GenericEventGroup;
  /** Copy key (English source) for the tab label. */
  label: string;
  entries: readonly EventIconEntry[];
}

const EVENT_ICON_TAB_LABELS = CALENDAR_EVENTS_COPY.iconTabs;

function genericEntries(group: GenericEventGroup): readonly EventIconEntry[] {
  return GENERIC_EVENT_CATALOG.filter((entry) => entry.group === group);
}

/** Picker tabs in display order. A kid event can use a study, meal or generic icon (never a system or medicine icon). */
export const EVENT_ICON_TABS: readonly EventIconTab[] = [
  { id: 'study', label: EVENT_ICON_TAB_LABELS.study, entries: STUDY_EVENT_ENTRIES },
  { id: 'meals', label: EVENT_ICON_TAB_LABELS.meals, entries: MEAL_EVENT_ENTRIES },
  ...GENERIC_EVENT_GROUPS.map((group) => ({ id: group, label: EVENT_ICON_TAB_LABELS[group], entries: genericEntries(group) })),
];

/** Every key a kid event may store: study, meal and generic. Keys must be unique across the three. */
export const EVENT_ICON_ENTRIES: readonly EventIconEntry[] = EVENT_ICON_TABS.flatMap((tab) => tab.entries);

const EVENT_ICON_BY_KEY: ReadonlyMap<string, EventIconEntry> = new Map(EVENT_ICON_ENTRIES.map((entry) => [entry.key, entry]));
const SYSTEM_EVENT_BY_KEY: ReadonlyMap<string, SystemEventCatalogEntry> = new Map(SYSTEM_EVENT_CATALOG.map((entry) => [entry.key, entry]));

export const DEFAULT_EVENT_ICON_KEY = 'star';

/** Artwork and labels for a kid event icon. Unknown keys render as the key with fallback artwork. */
export function eventIconInfo(key: string): EventIconEntry {
  return EVENT_ICON_BY_KEY.get(key) ?? { key, en: key, vi: key, art: UNKNOWN_EVENT_ART };
}

export function eventIconLabel(key: string, language: UiLanguage = getUiLanguage()): string {
  const info = eventIconInfo(key);
  return language === 'vi' ? info.vi : info.en;
}

export function isEventIconKey(value: unknown): value is string {
  return typeof value === 'string' && EVENT_ICON_BY_KEY.has(value);
}

export function systemEventInfo(key: SystemEventKey): SystemEventCatalogEntry {
  return SYSTEM_EVENT_BY_KEY.get(key) ?? { key, en: key, vi: key, art: UNKNOWN_EVENT_ART };
}

export function systemEventLabel(key: SystemEventKey, language: UiLanguage = getUiLanguage()): string {
  const info = systemEventInfo(key);
  return language === 'vi' ? info.vi : info.en;
}
