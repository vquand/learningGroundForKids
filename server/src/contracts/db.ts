import type { UfoRepository } from '../ufo/repository.js';
import type { MathWallRepository } from '../math-wall/repository.js';
export interface FamilyRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  legalAcceptedAt?: Date | null;
  legalAcceptedVersion?: string | null;
  role: "family" | "admin" | string;
  isActive?: boolean;
  onboardingDismissed?: boolean;
  onboardingParentVisited?: boolean;
}

export interface CreateFamilyInput {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  legalAcceptedAt?: Date | null;
  legalAcceptedVersion?: string | null;
  role: "family" | "admin";
}

export interface ProfileRecord {
  id: string;
  name: string;
  emoji: string;
  color: string;
  public_id: string;
  native_country_code?: string | null;
  native_city?: string | null;
  avatar_type?: string | null;
  avatar_url?: string | null;
  avatar_frame?: string | null;
  tour_completed_at?: string | Date | null;
  created_at: string | Date;
  total_done: number;
  badge_count: number;
}

export interface CreateProfileInput {
  name: string;
  emoji: string;
  color: string;
  avatar_type?: "emoji" | "default" | "custom" | undefined;
  avatar_url?: string | undefined;
  avatar_frame?: string | null | undefined;
  native_country_code?: string | undefined;
  native_city?: string | undefined;
}

export interface UpdateProfileInput {
  name?: string | undefined;
  emoji?: string | undefined;
  color?: string | undefined;
  avatar_type?: "emoji" | "default" | undefined;
  avatar_url?: string | null | undefined;
  avatar_frame?: string | null | undefined;
  native_country_code?: string | null | undefined;
  native_city?: string | null | undefined;
}

export interface ItemSummaryRecord {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  country_code?: string | null;
  title: string;
  icon_slug: string;
  start_year?: number | null;
  end_year?: number | null;
  has_quiz: boolean;
  quiz_required: boolean;
}

export interface ItemMediaRecord {
  id: string;
  media_type: string;
  label?: string | null;
  filename: string;
  url?: string;
}

export interface ItemDetailRecord extends ItemSummaryRecord {
  translation?: {
    lang: string;
    title: string;
    description?: string | null;
    history?: string | null;
  };
  media: ItemMediaRecord[];
  available_languages: string[];
  recipe?: string | null;
  location_desc?: string | null;
  fun_facts?: unknown;
  audio_urls?: unknown;
  youtube_url?: string | null;
  trailer_url?: string | null;
  characters?: unknown;
  time_precision?: string | null;
  released_date?: string | null;
  rich_fields?: unknown;
  franchise_id?: string | null;
  franchise_siblings?: Array<{ id: string; title: string }>;
}

export interface CatalogTranslationInput {
  lang: string;
  title: string;
  description?: string | null | undefined;
  history?: string | null | undefined;
}

export interface CatalogMediaInput {
  media_type: string;
  label?: string | null | undefined;
  lang?: string | null | undefined;
  filename: string;
  sort_order: number;
}

export interface CatalogQuizQuestionInput {
  question_group_id?: string | null | undefined;
  lang: string;
  question: string;
  question_type: string;
  options: string[];
  correct_answers: number[];
  sort_order: number;
}

export interface CreateCatalogItemInput {
  id?: string | undefined;
  category: string;
  latitude: number;
  longitude: number;
  country_code?: string | null | undefined;
  icon_slug?: string | null | undefined;
  is_published: boolean;
  recipe?: string | null | undefined;
  location_desc?: string | null | undefined;
  fun_facts?: unknown | undefined;
  audio_urls?: unknown | undefined;
  youtube_url?: string | null | undefined;
  trailer_url?: string | null | undefined;
  characters?: unknown | undefined;
  start_year?: number | null | undefined;
  end_year?: number | null | undefined;
  time_precision?: string | null | undefined;
  released_date?: string | null | undefined;
  rich_fields?: Record<string, unknown> | undefined;
  franchise_id?: string | null | undefined;
  quiz_required: boolean;
  translations: CatalogTranslationInput[];
  media: CatalogMediaInput[];
  quiz_questions: CatalogQuizQuestionInput[];
}

export interface CreatedCatalogItemRecord {
  id: string;
  category: string;
  is_published: boolean;
  quiz_required: boolean;
  translation_count: number;
  media_count: number;
  quiz_question_count: number;
}

export interface UpdateCatalogItemInput {
  id: string;
  category?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  country_code?: string | null | undefined;
  icon_slug?: string | null | undefined;
  is_published?: boolean | undefined;
  recipe?: string | null | undefined;
  location_desc?: string | null | undefined;
  fun_facts?: unknown | undefined;
  audio_urls?: unknown | undefined;
  youtube_url?: string | null | undefined;
  trailer_url?: string | null | undefined;
  characters?: unknown | undefined;
  start_year?: number | null | undefined;
  end_year?: number | null | undefined;
  time_precision?: string | null | undefined;
  released_date?: string | null | undefined;
  rich_fields?: Record<string, unknown> | null | undefined;
  franchise_id?: string | null | undefined;
  quiz_required?: boolean | undefined;
  translations?: CatalogTranslationInput[] | undefined;
  media?: CatalogMediaInput[] | undefined;
  quiz_questions?: CatalogQuizQuestionInput[] | undefined;
}

export interface AdminCatalogTranslationRecord extends CatalogTranslationInput {
  id: string;
}

export interface AdminCatalogMediaRecord extends CatalogMediaInput {
  id: string;
}

export interface AdminCatalogQuizQuestionRecord extends CatalogQuizQuestionInput {
  id: string;
  is_active: boolean;
}

export interface AdminCatalogItemRecord {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  country_code: string | null;
  icon_slug: string | null;
  is_published: boolean;
  source_type: string;
  owner_family_id: string | null;
  recipe: string | null;
  location_desc: string | null;
  fun_facts: unknown;
  audio_urls: unknown;
  youtube_url: string | null;
  trailer_url: string | null;
  characters: unknown;
  start_year: number | null;
  end_year: number | null;
  time_precision: string | null;
  released_date: string | null;
  rich_fields: unknown;
  franchise_id: string | null;
  quiz_required: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  translations: AdminCatalogTranslationRecord[];
  media: AdminCatalogMediaRecord[];
  quiz_questions: AdminCatalogQuizQuestionRecord[];
}

export interface AdminCatalogItemSummaryRecord {
  id: string;
  category: string;
  is_published: boolean;
  title_en?: string;
  title_vi?: string;
  created_at: string | Date;
}

export interface ProgressListRecord {
  done_item_ids: string[];
  wip_item_ids: string[];
}

export interface CompletionRecord {
  item_id: string;
  category: string;
  done_at: string | Date;
}

export interface RecentActivityRecord {
  family_id: string;
  family_name: string;
  profile_id: string;
  profile_name: string;
  profile_emoji: string;
  profile_color: string;
  avatar_type: string | null;
  avatar_url: string | null;
  avatar_frame: string | null;
  item_id: string;
  item_category: string;
  completed_at: string | Date;
}

export interface ProgressStatusRecord {
  done: boolean;
}

export interface BadgeRecord {
  id: string;
  badge_key: string;
  badge_type: string;
  milestone: number;
  earned_at: string | Date;
  name?: string;
  description?: string;
}

export interface MarkProgressRecord {
  status: "done" | "quiz_required";
  already_done: boolean;
  newly_earned_badges: BadgeRecord[];
}

export interface AuthRepository {
  updateOnboarding(familyId: string, action: "dismiss" | "visit"): Promise<void>;
  findFamilyByEmail(email: string): Promise<FamilyRecord | null>;
  findFamilyById(id: string): Promise<FamilyRecord | null>;
  createFamily(input: CreateFamilyInput): Promise<FamilyRecord>;
  createRootIfMissing(passwordHash: string): Promise<boolean>;
  replaceRootPassword(expectedPasswordHash: string, passwordHash: string, sessionHash: string): Promise<boolean>;
  setFamilyPassword(input: { targetId: string; actorId: string; passwordHash: string; reason: string; expectedPasswordHash?: string }): Promise<"updated" | "not_found">;
  createSession(input: { tokenHash: string; familyId: string; expiresAt: Date; expectedPasswordHash?: string }): Promise<void>;
  findFamilyBySessionHash(tokenHash: string, now: Date): Promise<FamilyRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  parentAccess(tokenHash: string, familyId: string, now: Date): Promise<{ method: "password" | "passkey" | "google"; until: Date } | null>;
  grantParentAccess(tokenHash: string, familyId: string, until: Date, method: "password" | "passkey" | "google"): Promise<boolean>;
  lockParentAccess(input: { familyId: string; sessionHash: string; tokenHash: string }): Promise<Date | null>;
  finalizePasskeyLogin(input: { familyId: string; credentialId: string; previousCounter: number; nextCounter: number;
    tokenHash: string; expiresAt: Date }): Promise<boolean>;
  finalizePasskeyParentAccess(input: { familyId: string; credentialId: string; previousCounter: number;
    nextCounter: number; sessionHash: string; until: Date }): Promise<boolean>;
  listPasskeys(familyId: string): Promise<PasskeyRecord[]>;
  findPasskey(id: string): Promise<PasskeyRecord | null>;
  addPasskey(input: PasskeyRecord, sessionHash: string): Promise<void>;
  deletePasskey(id: string, familyId: string): Promise<{ removed: boolean; preferred: boolean }>;
  createPasskeyChallenge(input: PasskeyChallengeRecord): Promise<void>;
  consumePasskeyChallenge(tokenHash: string, purpose: PasskeyChallengeRecord["purpose"], now: Date): Promise<PasskeyChallengeRecord | null>;
}

export interface PasskeyRecord {
  id: string;
  familyId: string;
  publicKey: string;
  counter: number;
  transports: string[] | null;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  createdAt?: Date;
  lastUsedAt?: Date | null;
}

export interface PasskeyChallengeRecord {
  tokenHash: string;
  challenge: string;
  purpose: "login" | "parent" | "register";
  sessionHash: string | null;
  familyId: string | null;
  expiresAt: Date;
}

export interface ProfileRepository {
  list(familyId: string, limit: number): Promise<ProfileRecord[]>;
  count(familyId: string): Promise<number>;
  get(familyId: string, profileId: string): Promise<ProfileRecord | null>;
  create(familyId: string, input: CreateProfileInput): Promise<ProfileRecord>;
  update(familyId: string, profileId: string, input: UpdateProfileInput): Promise<ProfileRecord | null>;
  completeTour(familyId: string, profileId: string): Promise<ProfileRecord | null>;
  setAvatar(familyId: string, profileId: string, url: string): Promise<ProfileRecord | null>;
  delete(familyId: string, profileId: string): Promise<boolean>;
}

export type FriendRequestScope = "profile" | "family";
export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface FriendRequestRecord {
  requesting_party?: FriendRequestParty;
  target_party?: FriendRequestParty;
  id: string;
  requesting_family_id: string;
  requesting_scope: FriendRequestScope;
  requesting_profile_id: string | null;
  requesting_label: string;
  target_family_id: string;
  target_scope: FriendRequestScope;
  target_profile_id: string | null;
  target_label: string;
  target_code: string;
  requester_message: string;
  status: FriendRequestStatus;
  created_at: string | Date;
  responded_at: string | Date | null;
  responded_by_family_id: string | null;
}

export interface FriendRequestParty {
  name:string;emoji?:string;color?:string;avatar_type?:'default'|'custom'|'emoji'|null;
  avatar_url?:string|null;avatar_frame?:string|null;
}

export interface CreateFriendRequestInput {
  requesting_scope: FriendRequestScope;
  requesting_profile_id?: string | null | undefined;
  target_code: string;
  target_scope: FriendRequestScope;
}

export interface FriendRequestRepository {
  canReadAvatar?(familyId:string,key:string):Promise<boolean>;
  list(familyId: string, limit: number): Promise<FriendRequestRecord[]>;
  create(familyId: string, input: CreateFriendRequestInput): Promise<FriendRequestRecord>;
  respond(familyId: string, requestId: string, accept: boolean): Promise<FriendRequestRecord>;
}

export interface ItemRepository {
  canReadMedia(familyId: string, key: string, isAdmin?: boolean): Promise<boolean>;
  list(input: { category?: string; familyId: string; profileId?: string; limit: number }): Promise<ItemSummaryRecord[]>;
  get(itemId: string, lang: string, familyId: string, profileId?: string): Promise<ItemDetailRecord | null>;
  create(input: CreateCatalogItemInput, options?: { ownerFamilyId: string; targetProfileId?: string }): Promise<CreatedCatalogItemRecord>;
  getParent?(itemId: string, familyId: string): Promise<(AdminCatalogItemRecord & { can_edit: boolean; is_disabled_for_family: boolean }) | null>;
  getAdmin(itemId: string, ownerFamilyId?: string): Promise<AdminCatalogItemRecord | null>;
  listAdmin(limit: number): Promise<AdminCatalogItemSummaryRecord[]>;
  updateBatch(input: UpdateCatalogItemInput[], ownerFamilyId?: string): Promise<CreatedCatalogItemRecord[]>;
  deleteAdmin(itemId: string): Promise<boolean>;
}

export interface CatalogSyncRepository {
  refresh(options?: {
    research?: boolean;
    onProgress?(progress: {
      total_batches: number;
      completed_batches: number;
      updated_count: number;
      skipped_count: number;
    }): void;
  }): Promise<{ updated_count: number; skipped_count: number; batches: number }>;
}

export interface ProgressRepository {
  list(familyId: string, profileId: string): Promise<ProgressListRecord>;
  listDetailed(familyId: string, profileId: string): Promise<CompletionRecord[]>;
  recentVisible(familyId: string, limit: number): Promise<RecentActivityRecord[]>;
  badges(familyId: string, profileId: string): Promise<BadgeRecord[]>;
  get(familyId: string, profileId: string, itemId: string): Promise<ProgressStatusRecord>;
  mark(familyId: string, profileId: string, itemId: string): Promise<MarkProgressRecord | null>;
  remove(familyId: string, profileId: string, itemId: string): Promise<boolean>;
}

export interface ParentShareTargetRecord {
  family_id: string;
  family_name: string;
  profiles: Array<{ id: string; name: string; public_id: string | null }>;
}

export interface ParentLessonSummaryRecord {
  id: string;
  category: string;
  title: string;
  country_code: string | null;
  source_type: "system" | "custom";
  owner_family_id?: string | null;
  owner_family_name?: string | null;
  created_at: string | Date;
  is_published: boolean;
  is_disabled_for_family: boolean;
  can_edit: boolean;
  can_share: boolean;
  audiences: Array<{
    id: string;
    scope: "family" | "profile";
    family_id: string;
    family_name: string;
    profile_id: string | null;
    profile_name: string | null;
    created_at: string | Date;
  }>;
}

export interface ParentLessonCatalogRecord {
  system_lessons: ParentLessonSummaryRecord[];
  custom_lessons: ParentLessonSummaryRecord[];
}

export interface ParentRepository {
  shareTargets(familyId: string): Promise<ParentShareTargetRecord[]>;
  catalog(familyId: string): Promise<ParentLessonCatalogRecord>;
  setSystemDisabled(familyId: string, itemIds: string[], disabled: boolean): Promise<number>;
  shareLesson(familyId: string, itemId: string, target: {
    target_scope: "family" | "profile";
    target_family_id: string;
    target_profile_id?: string | undefined;
  }): Promise<void>;
}

export interface AdminFriendRequestRecord extends FriendRequestRecord {
  requesting_family_name: string;
  requesting_profile_name: string | null;
  target_family_name: string;
  target_profile_name: string | null;
}

export interface AdminFamilyRecord {
  id: string;
  display_name: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  created_at: string | Date;
  profile_count: number;
  accepted_request_count: number;
  pending_incoming_count: number;
  pending_outgoing_count: number;
  rejected_request_count: number;
  profiles: Array<{
    id: string; name: string; emoji: string; color: string; public_id: string | null;
    created_at: string | Date; total_done: number; badge_count: number;
    total_items: number; completion_rate: number;
    recent_activities: Array<{ item_id: string; item_title: string; item_category: string; completed_at: string | Date }>;
  }>;
  friend_requests: AdminFriendRequestRecord[];
}

export interface AdminAssessmentSummaryRecord {
  id: string; item_id: string; assessment_type: "quiz"; item_title: string;
  item_category: string; country_code: string | null; created_at: string | Date;
  question_count: number; active_question_count: number; language_count: number;
  attempt_count: number; unique_profile_count: number; pass_rate: number;
  fail_rate: number; average_score_rate: number; average_time_seconds: number | null;
  latest_attempt_at: string | Date | null;
}

export interface AdminAssessmentDetailRecord extends AdminAssessmentSummaryRecord {
  questions: Array<{
    id: string; item_id: string; question_group_id: string | null; lang: string;
    question_type: string; question: string; options: string[]; correct_answers: number[];
    sort_order: number; is_active: boolean; created_at: string | Date;
  }>;
  performance: Array<{
    profile_id: string; profile_name: string; profile_emoji: string; profile_color: string;
    public_id: string | null; family_id: string | null; family_name: string;
    attempt_count: number; pass_count: number; fail_count: number;
    success_rate: number; fail_rate: number; average_score_rate: number;
    average_time_seconds: number | null; best_score: number; best_total: number;
    latest_score: number; latest_total: number; latest_completed_at: string | Date | null;
  }>;
}

export interface AdminFlashcardRecord {
  id: string; item_id: string; lang: string; front: string; back: string;
  media_hint: string | null; sort_order: number; is_published: boolean; source_type: string;
  created_at: string | Date; updated_at: string | Date;
}

export interface AdminQuizQuestionRecord {
  id: string; item_id: string; question_group_id: string | null; lang: string;
  question_type: string; question: string; options: string[]; correct_answers: number[];
  sort_order: number; is_active: boolean; created_at: string | Date;
}

export interface AdminReadRepository {
  families(): Promise<AdminFamilyRecord[]>;
  profile?(familyId: string, profileId: string): Promise<AdminProfileDetailRecord | null>;
  activities?(familyId: string, profileId: string, query: AdminActivityQuery): Promise<AdminActivityPage>;
  journey?(familyId: string, profileId: string, query: AdminJourneyQuery): Promise<AdminJourneyPage>;
  assessments(): Promise<AdminAssessmentSummaryRecord[]>;
  assessment(itemId: string): Promise<AdminAssessmentDetailRecord | null>;
  quizQuestions?(itemId: string): Promise<AdminQuizQuestionRecord[]>;
  createQuizQuestion?(itemId: string, input: {
    question_group_id?: string | null | undefined; lang: string; question_type: string; question: string; options: string[];
    correct_answers: number[]; sort_order: number; is_active: boolean;
  }): Promise<AdminQuizQuestionRecord>;
  deleteQuizQuestion?(questionId: string): Promise<boolean>;
  flashcards?(itemId: string): Promise<AdminFlashcardRecord[]>;
  createFlashcard?(itemId: string, input: {
    lang: string; front: string; back: string; media_hint?: string | null | undefined;
    sort_order: number; is_published: boolean; source_type: string;
  }): Promise<AdminFlashcardRecord>;
  updateFlashcard?(flashcardId: string, input: Partial<{
    lang: string | undefined; front: string | undefined; back: string | undefined; media_hint: string | null | undefined;
    sort_order: number | undefined; is_published: boolean | undefined; source_type: string | undefined;
  }>): Promise<AdminFlashcardRecord | null>;
  deleteFlashcard?(flashcardId: string): Promise<boolean>;
}

export interface AdminProfileDetailRecord {
  id: string; name: string; emoji: string; color: string; public_id: string | null;
  created_at: string | Date; family_id: string; family_name: string;
  total_done: number; badge_count: number; quiz_attempt_count: number; flashcard_session_count: number;
}

export interface AdminActivityQuery {
  page: number; page_size: number; type: "all" | "completion" | "quiz" | "flashcard";
}

export interface AdminActivityRecord {
  id: string; type: "completion" | "quiz" | "flashcard"; occurred_at: string | Date;
  item_id: string | null; item_title: string | null; item_category: string | null;
  score: number | null; total: number | null;
  theme_type: string | null; theme_value: string | null;
  cards_shown: number | null; got_it_count: number | null; review_again_count: number | null;
}

export interface AdminActivityPage {
  activities: AdminActivityRecord[]; page: number; page_size: number; total: number; total_pages: number;
}

export interface AdminJourneyQuery {
  period: "today" | "yesterday" | "last3days" | "last7days" | "all";
  page: number; page_size: number;
}

export interface AdminJourneyPage {
  origin: { latitude: number; longitude: number; title: string };
  waypoints: Array<{ kind: "item"; item_id: string; title: string; category: string;
    latitude: number; longitude: number; done_at: string | Date }>;
  exploredCount: number; total: number; page: number; page_size: number; total_pages: number;
}

export interface QuizQuestionRecord {
  id: string;
  item_id: string;
  lang: string;
  question_type: string;
  question: string;
  options: string[];
  correct_answers: number[];
  sort_order: number;
  is_active: boolean;
}

export interface QuizPublicQuestion {
  subject?: string;
  lang?: string;
  level?: string;
  id: string;
  item_id?: string;
  question_type: string;
  question: string;
  options: string[];
  answer_count: number;
  sort_order: number;
}

export interface QuizSetRecord {
  questions: QuizQuestionRecord[];
  difficulty: "Easy" | "Medium" | "Hard";
}

export interface QuizItemStatusRecord {
  attempt_count: number;
  passed: boolean;
  best_score: number;
  best_total: number;
  latest_score: number;
  latest_total: number;
}

export interface QuizDailyStatusRecord {
  day?: string;
  streak?: number;
  bonus?: number;
  amount?: number;
  attempted_today: boolean;
  passed: boolean;
  score: number;
  total: number;
}

export interface QuizSubmitAnswer {
  question_id: string;
  chosen_answers: readonly number[];
}

export interface QuizSubmitRecord {
  townReward?: import("../town-building/game.js").Cost;
  receiptId?: string | null;
  bonus?: number;
  streak?: number;
  alreadyRewarded?: boolean;
  score: number;
  total: number;
  passed: boolean;
  new_badges: BadgeRecord[];
}

export interface QuizRepository {
  getDailySettings?(profileId: string, familyId: string): Promise<{ modes: import("../daily-quiz/game.js").VocabularyMode[] }>;
  setDailySettings?(profileId: string, familyId: string, modes: import("../daily-quiz/game.js").VocabularyMode[]): Promise<{ modes: import("../daily-quiz/game.js").VocabularyMode[] }>;
  getItemQuiz(itemId: string, lang: string, familyId: string, profileId?: string): Promise<QuizSetRecord | null>;
  getItemStatus(profileId: string, itemId: string, familyId: string): Promise<QuizItemStatusRecord>;
  submitItem(profileId: string, itemId: string, answers: QuizSubmitAnswer[], familyId: string): Promise<QuizSubmitRecord>;
  getDailyQuiz(profileId: string, lang: string, day: string, familyId: string): Promise<QuizSetRecord | null>;
  getDailyStatus(profileId: string, day: string, familyId: string): Promise<QuizDailyStatusRecord>;
  submitDaily(profileId: string, day: string, answers: QuizSubmitAnswer[], familyId: string): Promise<QuizSubmitRecord>;
}

export type FlashcardThemeType = "item" | "country" | "continent" | "era" | "category";
export type FlashcardRating = "got_it" | "review_again";

export interface FlashcardRecord {
  id: string;
  item_id: string;
  item_title: string;
  lang: string;
  front: string;
  back: string;
  media_hint?: string;
  sort_order: number;
  source_type: string;
}

export interface FlashcardDeckOptionRecord {
  theme_type: FlashcardThemeType;
  theme_value: string;
  title: string;
  description: string;
  available_cards: number;
  item_count: number;
}

export interface FlashcardDeckRecord extends FlashcardDeckOptionRecord {
  cards: FlashcardRecord[];
}

export interface FlashcardStudySessionInput {
  focus_item_id?: string | undefined;
  theme_type: FlashcardThemeType;
  theme_value: string;
  lang: string;
  viewed_flashcard_ids: string[];
  responses: Array<{ flashcard_id: string; rating: FlashcardRating }>;
  started_at: string;
}

export interface FlashcardStudySessionRecord {
  id: string;
  profile_id: string;
  focus_item_id?: string;
  theme_type: FlashcardThemeType;
  theme_value: string;
  lang: string;
  cards_shown: number;
  got_it_count: number;
  review_again_count: number;
  responses: Array<{ flashcard_id: string; rating: FlashcardRating }>;
  started_at: Date;
  completed_at: Date;
}

export interface FlashcardRepository {
  getOptions(itemId: string, lang: string, familyId: string, profileId?: string): Promise<FlashcardDeckOptionRecord[] | null>;
  getDeck(
    profileId: string,
    itemId: string,
    lang: string,
    themeType: FlashcardThemeType,
    themeValue: string,
    familyId: string,
  ): Promise<FlashcardDeckRecord | null>;
  createStudySession(profileId: string, input: FlashcardStudySessionInput, familyId: string): Promise<FlashcardStudySessionRecord>;
}

export interface AppDatabase {
  calendar?: import('../calendar/contracts.js').CalendarRepository;
  calendarPeople?: import('../calendar/participants.js').CalendarPeopleRepository;
  calendarEvents?: import('../calendar/events.js').CalendarEventsRepository;
  calendarMeals?: import('../calendar/meals.js').MealLibraryRepository;
  calendarNotifications?: import('../calendar/notifications.js').CalendarNotificationsRepository;
  schedules?: import('../schedule/repository.js').ScheduleRepository;
  explore?: import('../explore/contracts.js').ExploreRepository;
  adventures?: import('../adventures/repository.js').AdventureRepository;
  kitchen?: import('../kitchen/repository.js').KitchenRepository;
  parentReports?: import('../parent-reports/contracts.js').ParentReportRepository;
  googleAuth?: import("../google-auth/contracts.js").GoogleAuthRepository;
  minikuCatalog?: import('../miniku/catalog.js').MinikuCatalogRepository;
  drinks?: import('../town-building/drinks.js').DrinkRepository;
  cabbageRolls?: import('../town-building/cabbage-rolls.js').CabbageRollRepository;
  town?: import('../town-building/repository.js').TownRepository;
  townVisits?: import('../town-building/visits.js').TownVisitsRepository;
  townBaskets?: import('../town-building/baskets.js').TownBasketsRepository;
  townRaft?: import('../town-building/raft.js').TownRaftRepository;
  infinidrill?: import('../infinidrill/repository.js').InfinidrillRepository;
  miniku?: import('../miniku/repository.js').MinikuRepository;
  fishing?: import('../fishing/repository.js').FishingRepository;
  achievements?: import('../achievement-catalog.js').AchievementCatalogRepository;
  roadRacing?: import('../road-racing/repository.js').RoadRacingRepository;
  mathWall?: MathWallRepository;
  ufo?: UfoRepository;
  ping(): Promise<void>;
  close?(): Promise<void>;
  auth: AuthRepository;
  profiles: ProfileRepository;
  items: ItemRepository;
  catalog?: CatalogSyncRepository;
  progress: ProgressRepository;
  quiz: QuizRepository;
  flashcards: FlashcardRepository;
  friendRequests: FriendRequestRepository;
  parent: ParentRepository;
  admin: AdminReadRepository;
}
