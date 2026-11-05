import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  adminAIEnrich,
  adminAIGenerate,
  adminCreateItem,
  adminGenerateItemImage,
  adminGetItem,
  adminUpdateItem,
} from "../../api/admin";
import { ItemForm } from "../../components/admin/ItemForm";
import { AdminFlashcardEditor } from "../../components/admin/AdminFlashcardEditor";
import { AdminQuizEditor } from "../../components/admin/AdminQuizEditor";
import { useAdminStore } from "../../stores/adminStore";
import { CATEGORIES } from "../../types/item";
import type { AdminItemFormData } from "../../types/admin";

type EditorMode = "create" | "edit" | "enrich";

export function AdminItemEditorPage() {
  useUiLanguage();
  const access = useAdminStore((s) => s.access);
  const navigate = useNavigate();
  const location = useLocation();
  const { itemId } = useParams<{ itemId: string }>();

  const mode: EditorMode = useMemo(() => {
    if (!itemId) return "create";
    if (location.pathname.endsWith("/enrich")) return "enrich";
    return "edit";
  }, [itemId, location.pathname]);

  const [formSource, setFormSource] = useState<{
    key: string;
    data: Partial<AdminItemFormData>;
  } | null>(null);
  const editorKey = itemId ?? `create:${location.key}`;
  const initialData = formSource?.key === editorKey ? formSource.data : undefined;
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quizRequired, setQuizRequired] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);

  // AI generate form state (create mode)
  const [aiCategory, setAiCategory] = useState("food");
  const [aiName, setAiName] = useState("");
  const [aiUrl, setAiUrl] = useState("");

  // AI enrich state
  const [enrichInstructions, setEnrichInstructions] = useState("");

  // Track whether the next form submit should publish (true) or save as draft (false)
  const publishIntentRef = useRef(false);

  // Fetch existing item for edit/enrich modes
  useEffect(() => {
    setError(null);
    setSuccess(null);
    if ((mode === "edit" || mode === "enrich") && itemId && access === "admin") {
      let active = true;
      setLoading(true);
      void adminGetItem(itemId)
        .then((detail) => {
          if (!active) return;
          // Render returns every translation in one admin-only response.
          const mapped: Partial<AdminItemFormData> = {
            category: detail.category,
            latitude: detail.latitude,
            longitude: detail.longitude,
            country_code: detail.country_code,
            icon_slug: detail.icon_slug,
            is_published: detail.is_published,
            recipe: detail.recipe,
            location_desc: detail.location_desc,
            fun_facts: detail.fun_facts,
            audio_urls: detail.audio_urls,
            youtube_url: detail.youtube_url,
            trailer_url: detail.trailer_url,
            characters: detail.characters,
            start_year: detail.start_year,
            end_year: detail.end_year,
            time_precision: detail.time_precision,
            released_date: detail.released_date,
            rich_fields: detail.rich_fields,
            franchise_id: detail.franchise_id,
          };
          for (const translation of detail.translations) {
            const lang = translation.lang;
            if (lang === "en") {
              mapped.title_en = translation.title;
              mapped.description_en = translation.description;
              mapped.history_en = translation.history;
            } else if (lang === "vi") {
              mapped.title_vi = translation.title;
              mapped.description_vi = translation.description;
              mapped.history_vi = translation.history;
            }
          }
          setFormSource({ key: itemId, data: mapped });
          setQuizRequired(detail.quiz_required ?? true);
        })
        .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load item"); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }
    setLoading(false);
  }, [mode, itemId, access]);

  async function handleAIGenerate() {
    if (!aiName.trim()) return;
    setAiLoading(true);
    setError(null);
    try {
      const resp = await adminAIGenerate({
        category: aiCategory,
        name: aiName,
        url: aiUrl || undefined,
      });
      // Map AI draft to form data
      const draft = resp.draft as Record<string, unknown>;
      setFormSource({ key: editorKey, data: {
        category: (draft.category as string) ?? aiCategory,
        latitude: (draft.latitude as number) ?? 0,
        longitude: (draft.longitude as number) ?? 0,
        country_code: (draft.country_code as string) ?? undefined,
        title_en: (draft.title_en as string) ?? undefined,
        title_vi: (draft.title_vi as string) ?? undefined,
        description_en: (draft.description_en as string) ?? undefined,
        description_vi: (draft.description_vi as string) ?? undefined,
        history_en: (draft.history_en as string) ?? undefined,
        history_vi: (draft.history_vi as string) ?? undefined,
        recipe: (draft.recipe as string) ?? undefined,
        location_desc: (draft.location_desc as string) ?? undefined,
        fun_facts: (draft.fun_facts as string[]) ?? undefined,
        audio_urls: (draft.audio_urls as { label?: string; url: string }[]) ?? undefined,
        youtube_url: (draft.youtube_url as string) ?? undefined,
        trailer_url: (draft.trailer_url as string) ?? undefined,
        characters: (draft.characters as { name: string; image_url?: string; description?: string }[]) ?? undefined,
        is_published: false,
      } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAIEnrich() {
    if (!itemId || !enrichInstructions.trim()) return;
    setAiLoading(true);
    setError(null);
    try {
      const resp = await adminAIEnrich({
        item_id: itemId,
        instructions: enrichInstructions,
      });
      // Merge draft updates into existing form data
      const draft = resp.draft as Record<string, unknown>;
      setFormSource((prev) => ({
        key: editorKey,
        data: {
          ...(prev?.key === editorKey ? prev.data : {}),
          ...Object.fromEntries(Object.entries(draft).filter(([, v]) => v != null)),
        },
      }));
      setSuccess("AI enrichment applied. Review the updated fields below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI enrichment failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleToggleQuizRequired(value: boolean) {
    if (!itemId) return;
    try {
      await adminUpdateItem(itemId, { quiz_required: value });
      setQuizRequired(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quiz_required");
    }
  }

  async function handleGenerateItemImage(replaceExisting = false) {
    if (!itemId) return;
    setImageLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await adminGenerateItemImage(itemId, {
        replace_existing: replaceExisting,
      });
      setSuccess(
        `Generated SVG from ${resp.source_page_title} and saved it as item media.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setImageLoading(false);
    }
  }

  async function handleSubmit(data: AdminItemFormData) {
    const shouldPublish = publishIntentRef.current;
    publishIntentRef.current = false;
    setLoading(true);
    setError(null);
    try {
      if (mode === "create") {
        await adminCreateItem({ ...data, is_published: shouldPublish });
      } else if (itemId) {
        await adminUpdateItem(itemId, data);
      }
      const msg = shouldPublish ? "Item published!" : "Item saved!";
      navigate("/admin/content", { state: { success: msg } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  const modeLabel =
    mode === "create"
      ? "Create New Item"
      : mode === "enrich"
        ? "Enrich Item"
        : "Edit Item";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{modeLabel}</h1>
        <Link
          to="/admin/content"
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          {uiText("Back to Content")}</Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-green-700 text-sm">
          {success}
        </div>
      )}

      {(mode === "edit" || mode === "enrich") && itemId && (
        <div className="mb-8 rounded-lg bg-white shadow p-5 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            {uiText("Item Image")}</h2>
          <p className="mb-4 text-sm text-gray-600">
            {uiText("Find a raster image on Wikipedia, convert it into a softer cartoon-like SVG, and save it into this item&apos;s media.")}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleGenerateItemImage(false)}
              disabled={imageLoading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {imageLoading ? uiText("Generating image...") : uiText("Generate Cute SVG")}
            </button>
            <button
              type="button"
              onClick={() => handleGenerateItemImage(true)}
              disabled={imageLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uiText("Replace First Image")}</button>
          </div>
        </div>
      )}

      {/* AI Generate section (create mode) */}
      {mode === "create" && (
        <div className="mb-8 rounded-lg bg-white shadow p-5 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            {uiText("Generate with AI")}</h2>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {uiText("Category")}</label>
              <select
                value={aiCategory}
                onChange={(e) => setAiCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{uiText("Name")}</label>
              <input
                type="text"
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                placeholder={uiText("e.g. Pho")}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {uiText("URL (optional)")}</label>
              <input
                type="text"
                value={aiUrl}
                onChange={(e) => setAiUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleAIGenerate}
            disabled={aiLoading || !aiName.trim()}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {aiLoading ? "Generating (may take 30-60s)..." : uiText("Generate with AI")}
          </button>
        </div>
      )}

      {/* AI Enrich section (enrich mode) */}
      {mode === "enrich" && (
        <div className="mb-8 rounded-lg bg-white shadow p-5 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            {uiText("AI Enrichment")}</h2>
          <label className="block mb-3">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              {uiText("Instructions for AI")}</span>
            <textarea
              value={enrichInstructions}
              onChange={(e) => setEnrichInstructions(e.target.value)}
              placeholder={uiText("e.g. Add more fun facts, improve the Vietnamese description...")}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <button
            onClick={handleAIEnrich}
            disabled={aiLoading || !enrichInstructions.trim()}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {aiLoading ? "Enriching (may take 30-60s)..." : uiText("Enrich with AI")}
          </button>
        </div>
      )}

      {/* Item Form */}
      {mode !== "create" && !initialData ? (
        <p className="text-gray-500">{error ? uiText("Item could not be loaded.") : uiText("Loading item data...")}</p>
      ) : (
        <>
          <ItemForm
            key={editorKey}
            initialData={initialData}
            onSubmit={handleSubmit}
            submitLabel={
              mode === "create" ? uiText("Save as Draft") : uiText("Save Changes")
            }
            loading={loading}
            extraButtons={
              mode === "create" ? (
                <button
                  type="button"
                  onClick={(e) => {
                    publishIntentRef.current = true;
                    (e.currentTarget.closest("form") as HTMLFormElement | null)?.requestSubmit();
                  }}
                  disabled={loading}
                  className="rounded-md bg-green-600 px-6 py-2 text-white font-semibold hover:bg-green-500 disabled:opacity-50"
                >
                  {uiText("Publish")}</button>
              ) : undefined
            }
          />
          {/* Quiz editor: only available when editing an existing item */}
          {(mode === "edit" || mode === "enrich") && itemId && (
            <>
              <AdminQuizEditor
                itemId={itemId}
                quizRequired={quizRequired}
                onToggleQuizRequired={handleToggleQuizRequired}
              />
              <AdminFlashcardEditor
                itemId={itemId}
              />
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}

export default AdminItemEditorPage;
