import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminCreateFlashcard,
  adminDeleteFlashcard,
  adminFetchFlashcards,
  adminGenerateFlashcards,
  adminUpdateFlashcard,
} from "../../api/admin";
import type { AdminFlashcard } from "../../types/flashcard";
import { sessionQueryKey } from "../../lib/familyQueries";
import { useFamilyStore } from "../../stores/familyStore";

interface AdminFlashcardEditorProps {
  itemId: string;
}

const FLASHCARD_EDITOR_AVAILABLE = true;
const MIGRATION_MESSAGE = "Flashcard authoring is temporarily unavailable while its Render API is being migrated.";

type FlashcardDraft = Pick<AdminFlashcard, "lang" | "front" | "back" | "media_hint" | "sort_order" | "is_published" | "source_type">;

const DEFAULT_NEW: FlashcardDraft = {
  lang: "en",
  front: "",
  back: "",
  media_hint: "",
  sort_order: 0,
  is_published: false,
  source_type: "manual",
};

function CardEditor({
  card,
  itemId,
  onMove,
}: {
  card: AdminFlashcard;
  itemId: string;
  onMove: (card: AdminFlashcard, direction: -1 | 1) => Promise<void>;
}) {
  useUiLanguage();
  const qc = useQueryClient();
  const sessionGeneration = useFamilyStore((state) => state.sessionGeneration);
  const [draft, setDraft] = useState<FlashcardDraft>({
    lang: card.lang,
    front: card.front,
    back: card.back,
    media_hint: card.media_hint ?? "",
    sort_order: card.sort_order,
    is_published: card.is_published,
    source_type: card.source_type,
  });

  const saveMutation = useMutation({
    mutationFn: () => adminUpdateFlashcard(card.id, {
      ...draft,
      media_hint: draft.media_hint || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionQueryKey("admin-flashcards", sessionGeneration, itemId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminDeleteFlashcard(card.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionQueryKey("admin-flashcards", sessionGeneration, itemId) });
    },
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-gray-700 border border-gray-200">
            {draft.lang.toUpperCase()}
          </span>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-500 border border-gray-200">
            {draft.source_type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onMove(card, -1)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => void onMove(card, 1)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
          >
            ↓
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-gray-600">{uiText("Front")}</span>
          <textarea
            value={draft.front}
            onChange={(event) => setDraft((value) => ({ ...value, front: event.target.value }))}
            rows={3}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-gray-600">{uiText("Back")}</span>
          <textarea
            value={draft.back}
            onChange={(event) => setDraft((value) => ({ ...value, back: event.target.value }))}
            rows={4}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-gray-600">{uiText("Media Hint")}</span>
          <input
            value={draft.media_hint ?? ""}
            onChange={(event) => setDraft((value) => ({ ...value, media_hint: event.target.value }))}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-gray-600">{uiText("Language")}</span>
            <select
              value={draft.lang}
              onChange={(event) => setDraft((value) => ({ ...value, lang: event.target.value }))}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
            >
              <option value="en">{uiText("English")}</option>
              <option value="vi">{uiText("Vietnamese")}</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-gray-600">{uiText("Published")}</span>
            <select
              value={draft.is_published ? "published" : "draft"}
              onChange={(event) => setDraft((value) => ({ ...value, is_published: event.target.value === "published" }))}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
            >
              <option value="draft">{uiText("Draft")}</option>
              <option value="published">{uiText("Published")}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
        >
          {uiText("Delete")}</button>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {saveMutation.isPending ? uiText("Saving...") : uiText("Save Card")}
        </button>
      </div>
    </div>
  );
}

export function AdminFlashcardEditor({ itemId }: AdminFlashcardEditorProps) {
  useUiLanguage();
  const qc = useQueryClient();
  const sessionGeneration = useFamilyStore((state) => state.sessionGeneration);
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCard, setNewCard] = useState<FlashcardDraft>({ ...DEFAULT_NEW });
  const [error, setError] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: sessionQueryKey("admin-flashcards", sessionGeneration, itemId),
    queryFn: () => adminFetchFlashcards(itemId),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () => adminCreateFlashcard(itemId, {
      ...newCard,
      media_hint: newCard.media_hint || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionQueryKey("admin-flashcards", sessionGeneration, itemId) });
      setShowAddForm(false);
      setNewCard({ ...DEFAULT_NEW });
      setError(null);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const generateMutation = useMutation({
    mutationFn: () => adminGenerateFlashcards(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionQueryKey("admin-flashcards", sessionGeneration, itemId) });
      setError(null);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  async function moveCard(card: AdminFlashcard, direction: -1 | 1) {
    const sameLang = cards.filter((entry) => entry.lang === card.lang).sort((a, b) => a.sort_order - b.sort_order);
    const currentIndex = sameLang.findIndex((entry) => entry.id === card.id);
    const swapCard = sameLang[currentIndex + direction];
    if (!swapCard) return;
    await adminUpdateFlashcard(card.id, { sort_order: swapCard.sort_order });
    await adminUpdateFlashcard(swapCard.id, { sort_order: card.sort_order });
    await qc.invalidateQueries({ queryKey: sessionQueryKey("admin-flashcards", sessionGeneration, itemId) });
  }

  const grouped = {
    en: cards.filter((card) => card.lang === "en").sort((a, b) => a.sort_order - b.sort_order),
    vi: cards.filter((card) => card.lang === "vi").sort((a, b) => a.sort_order - b.sort_order),
  };

  if (!FLASHCARD_EDITOR_AVAILABLE) {
    return <p role="status" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{MIGRATION_MESSAGE}</p>;
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-gray-800">
          {uiText("🃏 Flashcards")}{cards.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {cards.length} {uiText("cards")}</span>
          )}
        </span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || cards.length > 0}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {generateMutation.isPending ? uiText("Generating...") : uiText("Generate Starter Cards")}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((value) => !value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700"
            >
              {showAddForm ? uiText("Hide New Card") : uiText("Add Card")}
            </button>
          </div>

          <p className="text-sm text-gray-500">
            {uiText("Theme decks in the child app are built automatically from the published item cards you manage here.")}</p>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {showAddForm && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-gray-600">{uiText("Front")}</span>
                  <textarea
                    value={newCard.front}
                    onChange={(event) => setNewCard((value) => ({ ...value, front: event.target.value }))}
                    rows={3}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-gray-600">{uiText("Back")}</span>
                  <textarea
                    value={newCard.back}
                    onChange={(event) => setNewCard((value) => ({ ...value, back: event.target.value }))}
                    rows={4}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-gray-600">{uiText("Language")}</span>
                    <select
                      value={newCard.lang}
                      onChange={(event) => setNewCard((value) => ({ ...value, lang: event.target.value }))}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                    >
                      <option value="en">{uiText("English")}</option>
                      <option value="vi">{uiText("Vietnamese")}</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-gray-600">{uiText("Published")}</span>
                    <select
                      value={newCard.is_published ? "published" : "draft"}
                      onChange={(event) => setNewCard((value) => ({ ...value, is_published: event.target.value === "published" }))}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                    >
                      <option value="draft">{uiText("Draft")}</option>
                      <option value="published">{uiText("Published")}</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !newCard.front.trim() || !newCard.back.trim()}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {createMutation.isPending ? uiText("Adding...") : uiText("Add Card")}
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-gray-500">{uiText("Loading flashcards...")}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {(["en", "vi"] as const).map((lang) => (
                <div key={lang} className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500">
                    {lang === "en" ? uiText("English") : uiText("Vietnamese")}
                  </h3>
                  {(grouped[lang] ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                      {uiText("No")}{lang.toUpperCase()} {uiText("flashcards yet.")}</div>
                  ) : (
                    grouped[lang].map((card) => (
                      <CardEditor
                        key={card.id}
                        card={card}
                        itemId={itemId}
                        onMove={moveCard}
                      />
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
