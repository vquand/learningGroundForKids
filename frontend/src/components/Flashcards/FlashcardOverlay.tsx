import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { recordFlashcardStudySession } from "../../api/flashcards";
import {
  buildFlashcardStudySessionInput,
  createFlashcardStudyState,
  rateFlashcard,
  viewFlashcard,
} from "../../types/flashcard";
import type {
  FlashcardDeck,
  FlashcardRating,
  FlashcardStudySessionInput,
  FlashcardStudyState,
} from "../../types/flashcard";

interface FlashcardOverlayProps {
  deck: FlashcardDeck;
  profileId: string;
  focusItemId: string;
  lang: string;
  onClose: () => void;
}

function randomize<T>(values: readonly T[]): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
  }
  return next;
}

export function FlashcardOverlay({
  deck,
  profileId,
  focusItemId,
  lang,
  onClose,
}: FlashcardOverlayProps) {
  useUiLanguage();
  const originalCards = useMemo(() => deck.cards, [deck.cards]);
  const [cards, setCards] = useState(deck.cards);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [session, setSession] = useState<FlashcardStudyState>(() =>
    createFlashcardStudyState(deck.cards[0]?.id, new Date().toISOString()),
  );
  const sessionRef = useRef(session);
  const submittedRef = useRef(false);
  const submissionPromiseRef = useRef<Promise<void> | null>(null);

  const persistMutation = useMutation({
    mutationFn: (input: FlashcardStudySessionInput) =>
      recordFlashcardStudySession(input),
  });

  const currentCard = cards[currentIdx];
  if (!currentCard) return null;

  function updateSession(nextSession: FlashcardStudyState) {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }

  function resetSession(nextCards: typeof cards) {
    if (submissionPromiseRef.current) return;
    const nextSession = createFlashcardStudyState(
      nextCards[0]?.id,
      new Date().toISOString(),
    );
    sessionRef.current = nextSession;
    setSession(nextSession);
    setCards(nextCards);
    setCurrentIdx(0);
    setShowBack(false);
    setShowSummary(false);
    setPersistError(null);
    submittedRef.current = false;
  }

  function navigateTo(nextIndex: number) {
    if (submissionPromiseRef.current) return;
    const boundedIndex = Math.max(0, Math.min(cards.length - 1, nextIndex));
    const nextCard = cards[boundedIndex];
    if (!nextCard) return;
    updateSession(viewFlashcard(sessionRef.current, nextCard.id));
    setCurrentIdx(boundedIndex);
    setShowBack(false);
  }

  function handleRate(rating: FlashcardRating) {
    if (submissionPromiseRef.current) return;
    let nextSession = rateFlashcard(sessionRef.current, currentCard!.id, rating);
    if (currentIdx < cards.length - 1) {
      const nextCard = cards[currentIdx + 1];
      if (nextCard) nextSession = viewFlashcard(nextSession, nextCard.id);
    }
    updateSession(nextSession);
    setShowBack(false);

    if (currentIdx >= cards.length - 1) {
      setShowSummary(true);
      return;
    }
    setCurrentIdx((index) => index + 1);
  }

  async function handleExit() {
    if (submittedRef.current) {
      onClose();
      return;
    }
    if (submissionPromiseRef.current) return;
    if (sessionRef.current.viewed_flashcard_ids.length === 0) {
      onClose();
      return;
    }

    const payload = buildFlashcardStudySessionInput({
      profile_id: profileId,
      focus_item_id: focusItemId,
      theme_type: deck.theme_type,
      theme_value: deck.theme_value,
      lang,
    }, sessionRef.current);

    setPersistError(null);
    const submission = persistMutation.mutateAsync(payload);
    submissionPromiseRef.current = submission;
    try {
      await submission;
      submittedRef.current = true;
      onClose();
    } catch (error) {
      setPersistError(
        error instanceof Error ? error.message : "Could not save this study session.",
      );
    } finally {
      submissionPromiseRef.current = null;
    }
  }

  const ratedCount = session.responses.length;
  const gotItCount = session.responses.filter((response) => response.rating === "got_it").length;
  const isSaving = persistMutation.isPending;
  const persistenceAlert = persistError ? (
    <div
      role="alert"
      className="mx-auto mb-4 w-full max-w-sm rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
    >
      {persistError} {uiText("Your session is still open; try again when ready.")}</div>
  ) : null;

  if (showSummary) {
    return (
      <div className="fixed inset-0 z-[2100] flex flex-col bg-gradient-to-b from-sky-600 via-cyan-500 to-emerald-400">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center text-white">
          <p className="text-6xl mb-4" aria-hidden="true">🃏</p>
          <h2 className="text-3xl font-bold mb-2">{uiText("Study session complete")}</h2>
          <p className="text-white/90 mb-6 max-w-sm">{deck.title}</p>
          {persistenceAlert}
          <div className="rounded-3xl bg-white/20 backdrop-blur px-6 py-5 w-full max-w-sm space-y-2">
            <p className="text-lg font-semibold">{ratedCount} {uiText(" cards rated")}</p>
            <p className="text-sm text-white/90">{gotItCount} {uiText(" marked “Got it”")}</p>
            <p className="text-sm text-white/90">{ratedCount - gotItCount} {uiText(" marked “Review again”")}</p>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => resetSession(originalCards)}
              disabled={isSaving}
              className="rounded-full bg-white px-6 py-3 font-bold text-sky-700 disabled:opacity-60"
            >
              {uiText("Restart")}</button>
            <button
              onClick={handleExit}
              disabled={isSaving}
              className="rounded-full bg-white/20 px-6 py-3 font-bold text-white border border-white/40 disabled:opacity-60"
            >
              {isSaving ? uiText("Saving...") : uiText("Back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2100] flex flex-col bg-[#f6fbff]">
      <div className="flex items-center gap-3 border-b border-sky-100 bg-white/90 px-4 py-3 backdrop-blur-sm">
        <button
          onClick={handleExit}
          disabled={isSaving}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 disabled:opacity-60"
          aria-label={isSaving ? uiText("Saving flashcard session") : uiText("Close flashcards")}
        >
          &#x2715;
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{deck.title}</p>
          <p className="truncate text-xs text-slate-500">
            {uiText("Card")}{currentIdx + 1} {uiText(" of ")}{cards.length}
          </p>
        </div>
        <button
          onClick={() => resetSession(randomize(originalCards))}
          disabled={isSaving}
          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 disabled:opacity-60"
        >
          {uiText("Shuffle")}</button>
      </div>

      <div className="px-4 pt-4">
        <div className="h-2 rounded-full bg-sky-100">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all"
            style={{ width: `${((currentIdx + 1) / cards.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {persistenceAlert}
        <button
          type="button"
          onClick={() => setShowBack((value) => !value)}
          disabled={isSaving}
          className="mx-auto flex min-h-[340px] w-full max-w-lg flex-col justify-between rounded-[28px] border border-sky-200 bg-white p-6 text-left shadow-[0_18px_60px_rgba(14,116,144,0.12)] disabled:opacity-60"
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
            <span>{showBack ? uiText("Answer") : uiText("Prompt")}</span>
            <span>{currentCard.item_title}</span>
          </div>
          <div className="space-y-4">
            <p className="text-3xl font-black leading-tight text-slate-900">
              {showBack ? currentCard.back : currentCard.front}
            </p>
            {showBack && currentCard.media_hint && (
              <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
                {uiText("Media hint:")}{currentCard.media_hint}
              </p>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-500">{uiText("Tap card to flip")}</p>
        </button>

        <div className="mx-auto mt-5 flex max-w-lg items-center justify-between gap-3">
          <button
            onClick={() => navigateTo(currentIdx - 1)}
            disabled={currentIdx === 0 || isSaving}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-40"
          >
            {uiText("Previous")}</button>
          <button
            onClick={() => resetSession(originalCards)}
            disabled={isSaving}
            className="rounded-full border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-bold text-sky-700 disabled:opacity-60"
          >
            {uiText("Restart")}</button>
          <button
            onClick={() => {
              if (currentIdx >= cards.length - 1) {
                setShowSummary(true);
                return;
              }
              navigateTo(currentIdx + 1);
            }}
            disabled={isSaving}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-60"
          >
            {uiText("Next")}</button>
        </div>
      </div>

      <div className="border-t border-sky-100 bg-white px-4 py-4">
        {showBack ? (
          <div className="mx-auto grid max-w-lg grid-cols-2 gap-3">
            <button
              onClick={() => handleRate("review_again")}
              disabled={isSaving}
              className="rounded-2xl bg-rose-50 px-4 py-4 text-base font-bold text-rose-700 border border-rose-200 disabled:opacity-60"
            >
              {uiText("Review Again")}</button>
            <button
              onClick={() => handleRate("got_it")}
              disabled={isSaving}
              className="rounded-2xl bg-emerald-50 px-4 py-4 text-base font-bold text-emerald-700 border border-emerald-200 disabled:opacity-60"
            >
              {uiText("Got It")}</button>
          </div>
        ) : (
          <div className="mx-auto max-w-lg rounded-2xl bg-sky-50 px-4 py-4 text-center text-sm font-semibold text-sky-800">
            {uiText("Flip the card, then choose whether you got it or want to review it again.")}</div>
        )}
      </div>
    </div>
  );
}
