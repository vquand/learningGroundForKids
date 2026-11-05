import { coreRequest } from "./core.ts";
import type {
  FlashcardDeck,
  FlashcardDeckOption,
  FlashcardStudySessionInput,
  FlashcardThemeType,
} from "../types/flashcard";

function encode(value: string): string {
  return encodeURIComponent(value);
}

export async function fetchFlashcardDeckOptions(
  itemId: string,
  lang: string,
  profileId?: string,
): Promise<FlashcardDeckOption[]> {
  const profileQuery = profileId ? `&profile_id=${encode(profileId)}` : "";
  return coreRequest<FlashcardDeckOption[]>(
    `/api/v1/items/${encode(itemId)}/flashcards/options?lang=${encode(lang)}${profileQuery}`,
  );
}

export async function fetchFlashcardDeck(
  profileId: string,
  itemId: string,
  lang: string,
  themeType: FlashcardThemeType,
  themeValue: string,
): Promise<FlashcardDeck> {
  return coreRequest<FlashcardDeck>(
    `/api/v1/profiles/${encode(profileId)}/items/${encode(itemId)}/flashcards/deck` +
      `?lang=${encode(lang)}&theme_type=${encode(themeType)}&theme_value=${encode(themeValue)}`,
  );
}

export async function recordFlashcardStudySession(
  input: FlashcardStudySessionInput,
): Promise<void> {
  return coreRequest<void>(
    `/api/v1/profiles/${encode(input.profile_id)}/flashcard-study-sessions`,
    {
      method: "POST",
      body: JSON.stringify({
        ...(input.focus_item_id === undefined
          ? {}
          : { focus_item_id: input.focus_item_id }),
        theme_type: input.theme_type,
        theme_value: input.theme_value,
        lang: input.lang,
        viewed_flashcard_ids: input.viewed_flashcard_ids,
        responses: input.responses,
        started_at: input.started_at,
      }),
    },
  );
}
