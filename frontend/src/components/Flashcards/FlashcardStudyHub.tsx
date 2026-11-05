import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchFlashcardDeck,
  fetchFlashcardDeckOptions,
} from "../../api/flashcards";
import { fetchItemQuizStatus } from "../../api/quiz";
import { useProgress } from "../../hooks/useProgress";
import type { FlashcardDeckOption } from "../../types/flashcard";
import type { ItemDetail } from "../../types/item";
import { FlashcardOverlay } from "./FlashcardOverlay";
import { familyQueryKey, familyScopedQuery } from "../../lib/familyQueries";
import { useFamilyStore } from "../../stores/familyStore";

interface FlashcardStudyHubProps {
  itemId: string;
  item: ItemDetail;
  lang: string;
  profileId: string;
}

export function FlashcardStudyHub({
  itemId,
  item,
  lang,
  profileId,
}: FlashcardStudyHubProps) {
  useUiLanguage();
  const progress = useProgress(profileId);
  const familyId = useFamilyStore((state) => state.familyId);
  const [activeOption, setActiveOption] = useState<FlashcardDeckOption | null>(null);

  const isQuizWip = progress.wip_item_ids.includes(itemId);

  const { data: deckOptions = [] } = useQuery({
    queryKey: ["flashcard-options", familyId, profileId, itemId, lang],
    queryFn: familyScopedQuery(familyId, () => fetchFlashcardDeckOptions(itemId, lang, profileId)),
    enabled: Boolean(familyId),
  });

  const { data: quizStatus } = useQuery({
    queryKey: familyQueryKey("quiz-status", familyId, itemId, profileId),
    queryFn: familyScopedQuery(familyId, () => fetchItemQuizStatus(profileId, itemId)),
    enabled: Boolean(familyId && item.has_quiz === true),
  });

  const { data: activeDeck, isLoading: deckLoading, error: deckError } = useQuery({
    queryKey: familyQueryKey("flashcard-deck", familyId, profileId, itemId, lang, activeOption?.theme_type, activeOption?.theme_value),
    queryFn: familyScopedQuery(familyId, () =>
      fetchFlashcardDeck(
        profileId,
        itemId,
        lang,
        activeOption!.theme_type,
        activeOption!.theme_value,
      )),
    enabled: Boolean(familyId && activeOption),
  });

  if (deckOptions.length === 0) return null;

  const shouldPromote = item.has_quiz === true && (!(quizStatus?.attempt_count ?? 0) || isQuizWip || !(quizStatus?.passed ?? false));
  const cardClass = shouldPromote
    ? "mt-6 rounded-[28px] border-2 border-sky-300 bg-gradient-to-br from-sky-50 via-cyan-50 to-white p-5 shadow-[0_0_16px_rgba(56,189,248,0.22)]"
    : "mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm";

  return (
    <>
      <div className={cardClass}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🃏</span>
              <span className="text-lg font-black text-slate-900">{uiText("Flashcard Study")}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {shouldPromote
                ? uiText("Warm up with cards before you take or retry the quiz.")
                : uiText("Quick study decks built from this item and related themes.")}
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 border border-sky-200">
            {deckOptions.length} {uiText(" deck")}{deckOptions.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid gap-3">
          {deckOptions.map((option) => (
            <button
              key={`${option.theme_type}:${option.theme_value}`}
              onClick={() => setActiveOption(option)}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-sky-300 hover:bg-sky-50/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{option.title}</p>
                <p className="mt-1 text-xs text-slate-500">{option.description}</p>
              </div>
              <div className="ml-3 text-right">
                <p className="text-sm font-bold text-slate-800">{option.available_cards} {uiText(" cards")}</p>
                <p className="text-xs text-slate-500">{option.item_count} {uiText(" items")}</p>
              </div>
            </button>
          ))}
        </div>

        {deckError && (
          <p className="mt-3 text-sm font-medium text-rose-600">
            {deckError instanceof Error ? deckError.message : uiText("Could not load flashcards")}
          </p>
        )}
      </div>

      {activeOption && deckLoading && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="rounded-3xl bg-white px-6 py-5 text-center shadow-xl">
            <p className="text-3xl mb-2">🃏</p>
            <p className="font-bold text-slate-900">{uiText("Loading study deck...")}</p>
          </div>
        </div>
      )}

      {activeOption && activeDeck && !deckLoading && (
        <FlashcardOverlay
          deck={activeDeck}
          profileId={profileId}
          focusItemId={itemId}
          lang={lang}
          onClose={() => setActiveOption(null)}
        />
      )}
    </>
  );
}
