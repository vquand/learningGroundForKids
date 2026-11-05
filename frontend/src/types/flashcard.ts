import type { Category } from "./item";
import type { EraId } from "../lib/eras";

export type FlashcardThemeType = "item" | "country" | "continent" | "era" | "category";
export type FlashcardRating = "got_it" | "review_again";

export interface Flashcard {
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

export interface FlashcardDeck {
  theme_type: FlashcardThemeType;
  theme_value: string;
  title: string;
  description: string;
  cards: Flashcard[];
  available_cards: number;
  item_count: number;
}

export interface FlashcardDeckOption {
  theme_type: FlashcardThemeType;
  theme_value: string;
  title: string;
  description: string;
  available_cards: number;
  item_count: number;
}

export interface FlashcardDeckContext {
  itemId: string;
  category: Category;
  countryCode?: string;
  continent?: string;
  eraId?: EraId;
}

export interface FlashcardStudyResponse {
  flashcard_id: string;
  rating: FlashcardRating;
}

export interface FlashcardStudySessionInput {
  profile_id: string;
  focus_item_id?: string;
  theme_type: FlashcardThemeType;
  theme_value: string;
  lang: string;
  viewed_flashcard_ids: string[];
  responses: FlashcardStudyResponse[];
  started_at: string;
}

export interface FlashcardStudySessionMetadata {
  profile_id: string;
  focus_item_id?: string;
  theme_type: FlashcardThemeType;
  theme_value: string;
  lang: string;
}

export interface FlashcardStudyState {
  readonly viewed_flashcard_ids: readonly string[];
  readonly responses: readonly FlashcardStudyResponse[];
  readonly started_at: string;
}

export const MAX_VIEWED_FLASHCARD_IDS = 15;

function immutableStudyState(
  viewedFlashcardIds: readonly string[],
  responses: readonly FlashcardStudyResponse[],
  startedAt: string,
): FlashcardStudyState {
  return Object.freeze({
    viewed_flashcard_ids: Object.freeze([...viewedFlashcardIds]),
    responses: Object.freeze(responses.map((response) => Object.freeze({ ...response }))),
    started_at: startedAt,
  });
}

export function createFlashcardStudyState(
  firstFlashcardId: string | undefined,
  startedAt: string,
): FlashcardStudyState {
  return immutableStudyState(firstFlashcardId ? [firstFlashcardId] : [], [], startedAt);
}

export function viewFlashcard(
  state: FlashcardStudyState,
  flashcardId: string,
): FlashcardStudyState {
  if (!flashcardId || state.viewed_flashcard_ids.includes(flashcardId)) return state;
  if (state.viewed_flashcard_ids.length >= MAX_VIEWED_FLASHCARD_IDS) return state;
  return immutableStudyState(
    [...state.viewed_flashcard_ids, flashcardId],
    state.responses,
    state.started_at,
  );
}

export function rateFlashcard(
  state: FlashcardStudyState,
  flashcardId: string,
  rating: FlashcardRating,
): FlashcardStudyState {
  const viewedState = viewFlashcard(state, flashcardId);
  if (!viewedState.viewed_flashcard_ids.includes(flashcardId)) return viewedState;

  const existingIndex = viewedState.responses.findIndex(
    (response) => response.flashcard_id === flashcardId,
  );
  const nextResponse = { flashcard_id: flashcardId, rating };
  const responses = existingIndex === -1
    ? [...viewedState.responses, nextResponse]
    : viewedState.responses.map((response, index) =>
        index === existingIndex ? nextResponse : response,
      );
  return immutableStudyState(
    viewedState.viewed_flashcard_ids,
    responses,
    viewedState.started_at,
  );
}

export function buildFlashcardStudySessionInput(
  metadata: FlashcardStudySessionMetadata,
  state: FlashcardStudyState,
): FlashcardStudySessionInput {
  return {
    ...metadata,
    viewed_flashcard_ids: [...state.viewed_flashcard_ids],
    responses: state.responses.map((response) => ({ ...response })),
    started_at: state.started_at,
  };
}

export interface AdminFlashcard {
  id: string;
  item_id: string;
  lang: string;
  front: string;
  back: string;
  media_hint?: string;
  sort_order: number;
  is_published: boolean;
  source_type: string;
  created_at: string;
  updated_at: string;
}
