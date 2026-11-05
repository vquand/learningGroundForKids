/** Authoritative keys only. Labels and artwork belong to the frontend catalog. */
export const SUBJECT_KEYS = ['math', 'vietnamese', 'english', 'science', 'history_geography', 'nature_society', 'art', 'music', 'computer', 'technology', 'ethics', 'handwriting_dictation', 'reading', 'life_skills', 'experiential_activities', 'homeroom', 'flag_salutation', 'stem', 'coding', 'second_language', 'craft', 'library', 'self_study', 'extra_tutoring'] as const;
export const PE_KEYS = ['pe_swimming', 'pe_football', 'pe_basketball', 'pe_badminton', 'pe_table_tennis', 'pe_volleyball', 'pe_gymnastics', 'pe_athletics', 'pe_martial_arts', 'pe_dance', 'pe_cycling', 'pe_skating'] as const;
export const CLUB_KEYS = ['club_flower_decoration', 'club_chess', 'club_football', 'club_drawing', 'club_piano', 'club_guitar', 'club_singing', 'club_coding', 'club_science', 'club_debate', 'club_reading', 'club_english', 'club_robotics', 'club_cooking', 'club_calligraphy', 'club_drama', 'club_photography', 'club_scouts', 'club_origami'] as const;
export const STUDY_KEYS = [...SUBJECT_KEYS, ...PE_KEYS, ...CLUB_KEYS] as const;
export type StudyKey = typeof STUDY_KEYS[number];
export type StudyGroup = 'subject' | 'pe' | 'club';
export const STUDY_GROUPS: Readonly<Record<StudyGroup, readonly StudyKey[]>> = { subject: SUBJECT_KEYS, pe: PE_KEYS, club: CLUB_KEYS };
export const STUDY_GROUP_BY_KEY = Object.fromEntries(Object.entries(STUDY_GROUPS).flatMap(([group, keys]) => keys.map(key => [key, group]))) as Readonly<Record<StudyKey, StudyGroup>>;
// Reviewed keys for the Meals and Events slices. Labels and artwork belong to the frontend catalog.
export const MEAL_FOOD_KEYS = ['rice', 'sticky_rice', 'porridge', 'pho', 'noodles', 'fried_rice', 'banh_mi', 'sandwich', 'eggs', 'grilled_chicken', 'fried_chicken', 'pork', 'beef', 'fish', 'shrimp', 'tofu', 'vegetables', 'salad', 'soup', 'spring_rolls', 'dumplings', 'pizza', 'pasta', 'burger', 'fruit', 'banana', 'apple', 'orange', 'watermelon', 'yogurt', 'cheese', 'bread', 'cake', 'cookies', 'ice_cream', 'chocolate', 'milk_box', 'canned_milk', 'soy_milk', 'juice', 'water', 'tea', 'fish_fillet', 'grilled_fish', 'canned_fish', 'fish_soup', 'tomato', 'potato', 'cabbage', 'carrot', 'radish', 'water_spinach', 'malabar_spinach', 'mustard_greens', 'bok_choy', 'napa_cabbage', 'raw_beef', 'beef_plate', 'beef_stew', 'grilled_beef', 'raw_pork', 'pork_plate', 'braised_pork', 'grilled_pork', 'rotisserie_pork', 'raw_poultry', 'poultry_plate', 'poultry_soup', 'rotisserie_poultry', 'shrimp_plate', 'steamed_fish', 'fried_fish', 'raw_fish_fillet', 'steamed_carrot', 'stir_fried_water_spinach', 'malabar_spinach_soup', 'boiled_cabbage', 'grilled_pork_ribs', 'sausage', 'fast_food', 'vegetable_soup'] as const;
export type MealFoodKey = typeof MEAL_FOOD_KEYS[number];
/** One shared limit set for list items, renames and favorites, so they cannot drift apart. */
export const CALENDAR_NAME_MAX = 40;
export const LIBRARY_CAP = 60;
export const MEDICINE_METHOD_KEYS = ['tablet', 'capsule', 'syrup', 'drops', 'cream_tube', 'powder_in_water', 'inhaler', 'patch', 'eye_nose_drops'] as const;
export type MedicineMethodKey = typeof MEDICINE_METHOD_KEYS[number];
export const MEDICINE_COLOR_KEYS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white'] as const;
export type MedicineColorKey = typeof MEDICINE_COLOR_KEYS[number];
/** Hand-made artwork; dates come from system-events.ts. */
export const SYSTEM_EVENT_KEYS = ['tet', 'mid_autumn', 'halloween', 'christmas', 'national_day', 'womens_day_oct20', 'womens_day_mar8', 'teachers_day', 'childrens_day'] as const;
export type SystemEventKey = typeof SYSTEM_EVENT_KEYS[number];
export const GENERIC_EVENT_ICON_GROUPS = {
  outdoors: ['gardening', 'hiking', 'camping', 'beach', 'fishing', 'picnic', 'skiing', 'cycling_trip', 'kayaking', 'sightseeing', 'road_trip', 'train_trip', 'airplane_trip', 'boat_trip', 'zoo', 'aquarium', 'museum', 'amusement_park', 'playground', 'kite_flying', 'bird_watching', 'stargazing', 'swimming_pool', 'snow_play'],
  school: ['school_trip', 'exam', 'homework_due', 'library_visit', 'science_fair', 'sports_day', 'school_play', 'concert', 'recital', 'competition', 'graduation', 'parent_meeting'],
  family: ['birthday', 'party', 'sleepover', 'playdate', 'visit_grandparents', 'family_dinner', 'wedding', 'new_baby', 'pet_care', 'family_photo', 'video_call', 'volunteering'],
  health: ['doctor', 'dentist', 'haircut', 'vaccination', 'eye_check', 'medicine_time'],
  home: ['cleaning', 'cooking_together', 'baking', 'shopping', 'movie_night', 'game_night', 'painting', 'crafts', 'reading_time', 'music_lesson', 'dance_lesson', 'swimming_lesson', 'drawing_class', 'coding_class', 'tutoring', 'building_blocks', 'board_game', 'karaoke', 'photography_walk', 'puzzle'],
  celebrations: ['fireworks', 'new_year', 'lantern', 'gift', 'flowers', 'flag', 'trophy', 'medal', 'balloon', 'confetti', 'star', 'heart'],
} as const;
export type GenericEventIconGroup = keyof typeof GENERIC_EVENT_ICON_GROUPS;
export const GENERIC_EVENT_ICON_KEYS = Object.values(GENERIC_EVENT_ICON_GROUPS).flat() as unknown as readonly (typeof GENERIC_EVENT_ICON_GROUPS)[GenericEventIconGroup][number][];
/** A kid event may use any premade icon: study, meal or generic (not medicine, weather or system artwork). */
export const EVENT_ICON_KEYS = [...STUDY_KEYS, ...MEAL_FOOD_KEYS, ...GENERIC_EVENT_ICON_KEYS] as const;
