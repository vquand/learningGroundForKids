import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useState } from "react";
import { CATEGORIES } from "../../types/item";
import type { AdminItemFormData } from "../../types/admin";
import { TimeFieldsGroup } from "./TimeFieldsGroup";
import { RichFieldsEditor } from "./RichFieldsEditor";

interface ItemFormProps {
  initialData?: Partial<AdminItemFormData>;
  onSubmit: (data: AdminItemFormData) => void;
  submitLabel: string;
  loading?: boolean;
  extraButtons?: React.ReactNode;
}

const DEFAULT_DATA: AdminItemFormData = {
  category: "food",
  latitude: 0,
  longitude: 0,
  is_published: false,
};

const inputCls = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "text-xs font-medium text-gray-600";
const legendCls = "text-sm font-semibold text-gray-700 uppercase tracking-wide";

export function ItemForm({
  initialData,
  onSubmit,
  submitLabel,
  loading = false,
  extraButtons,
}: ItemFormProps) {
  useUiLanguage();
  const [form, setForm] = useState<AdminItemFormData>({
    ...DEFAULT_DATA,
    ...initialData,
  });

  // A new item or AI draft replaces the whole form, including absent fields.
  useEffect(() => {
    setForm({ ...DEFAULT_DATA, ...initialData });
  }, [initialData]);

  function setField<K extends keyof AdminItemFormData>(
    key: K,
    value: AdminItemFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  const category = form.category;
  const showFood = category === "food";
  const showMonumentLandmark =
    category === "monument" || category === "landmark" || category === "animal";
  const showMusic = category === "music";
  const showMovie = category === "movie";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Category */}
      <div className="bg-white rounded-lg shadow p-5 space-y-3">
        <legend className={legendCls}>{uiText("Category")}</legend>
        <select
          value={form.category}
          onChange={(e) => setField("category", e.target.value)}
          className={inputCls}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Location */}
      <div className="bg-white rounded-lg shadow p-5 space-y-3">
        <legend className={legendCls}>{uiText("Location")}</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("Latitude")}</span>
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setField("latitude", parseFloat(e.target.value) || 0)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("Longitude")}</span>
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setField("longitude", parseFloat(e.target.value) || 0)}
              className={inputCls}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("Country code")}</span>
            <input
              type="text"
              value={form.country_code ?? ""}
              onChange={(e) => setField("country_code", e.target.value || null)}
              placeholder="VN"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("Icon slug")}</span>
            <input
              type="text"
              value={form.icon_slug ?? ""}
              onChange={(e) => setField("icon_slug", e.target.value || null)}
              className={inputCls}
            />
          </label>
        </div>
      </div>

      {/* English Content */}
      <div className="bg-white rounded-lg shadow p-5 space-y-3">
        <legend className={legendCls}>{uiText("English Content")}</legend>
        <label className="block">
          <span className={`block mb-1 ${labelCls}`}>{uiText("Title (EN)")}</span>
          <input
            type="text"
            value={form.title_en ?? ""}
            onChange={(e) => setField("title_en", e.target.value || undefined)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={`block mb-1 ${labelCls}`}>{uiText("Description (EN)")}</span>
          <textarea
            value={form.description_en ?? ""}
            onChange={(e) => setField("description_en", e.target.value || null)}
            rows={3}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={`block mb-1 ${labelCls}`}>{uiText("History (EN)")}</span>
          <textarea
            value={form.history_en ?? ""}
            onChange={(e) => setField("history_en", e.target.value || null)}
            rows={3}
            className={inputCls}
          />
        </label>
      </div>

      {/* Vietnamese Content */}
      <div className="bg-white rounded-lg shadow p-5 space-y-3">
        <legend className={legendCls}>{uiText("Vietnamese Content")}</legend>
        <label className="block">
          <span className={`block mb-1 ${labelCls}`}>{uiText("Title (VI)")}</span>
          <input
            type="text"
            value={form.title_vi ?? ""}
            onChange={(e) => setField("title_vi", e.target.value || undefined)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={`block mb-1 ${labelCls}`}>{uiText("Description (VI)")}</span>
          <textarea
            value={form.description_vi ?? ""}
            onChange={(e) => setField("description_vi", e.target.value || null)}
            rows={3}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={`block mb-1 ${labelCls}`}>{uiText("History (VI)")}</span>
          <textarea
            value={form.history_vi ?? ""}
            onChange={(e) => setField("history_vi", e.target.value || null)}
            rows={3}
            className={inputCls}
          />
        </label>
      </div>

      {/* Time Period (Phase 7) */}
      <TimeFieldsGroup
        startYear={form.start_year}
        endYear={form.end_year}
        timePrecision={form.time_precision}
        onFieldChange={setField}
      />

      {/* Category-specific: Food */}
      {showFood && (
        <div className="bg-white rounded-lg shadow p-5 space-y-3">
          <legend className={legendCls}>{uiText("Food Fields")}</legend>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("Recipe")}</span>
            <textarea
              value={form.recipe ?? ""}
              onChange={(e) => setField("recipe", e.target.value || null)}
              rows={4}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("YouTube URL (cooking video)")}</span>
            <input
              type="text"
              value={form.youtube_url ?? ""}
              onChange={(e) => setField("youtube_url", e.target.value || null)}
              className={inputCls}
            />
          </label>
        </div>
      )}

      {/* Category-specific: Monument / Landmark */}
      {showMonumentLandmark && (
        <div className="bg-white rounded-lg shadow p-5 space-y-3">
          <legend className={legendCls}>{uiText("Monument / Landmark Fields")}</legend>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("Location description")}</span>
            <textarea
              value={form.location_desc ?? ""}
              onChange={(e) => setField("location_desc", e.target.value || null)}
              rows={3}
              className={inputCls}
            />
          </label>
          <div>
            <span className={labelCls}>{uiText("Fun facts")}</span>
            {(form.fun_facts ?? [""]).map((fact, i) => (
              <div key={i} className="flex gap-2 mt-1">
                <textarea
                  value={fact}
                  onChange={(e) => {
                    const updated = [...(form.fun_facts ?? [""])];
                    updated[i] = e.target.value;
                    setField("fun_facts", updated);
                  }}
                  rows={2}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...(form.fun_facts ?? [])];
                    updated.splice(i, 1);
                    setField("fun_facts", updated.length ? updated : null);
                  }}
                  className="text-red-500 hover:text-red-700 text-sm px-2"
                >
                  {uiText("Remove")}</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setField("fun_facts", [...(form.fun_facts ?? []), ""])
              }
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {uiText("+ Add fact")}</button>
          </div>
        </div>
      )}

      {/* Category-specific: Music */}
      {showMusic && (
        <div className="bg-white rounded-lg shadow p-5 space-y-3">
          <legend className={legendCls}>{uiText("Music Fields")}</legend>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("YouTube URL")}</span>
            <input
              type="text"
              value={form.youtube_url ?? ""}
              onChange={(e) => setField("youtube_url", e.target.value || null)}
              className={inputCls}
            />
          </label>
          <div>
            <span className={labelCls}>{uiText("Audio URLs")}</span>
            {(form.audio_urls ?? [{ url: "" }]).map((audio, i) => (
              <div key={i} className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={audio.url}
                  onChange={(e) => {
                    const updated = [...(form.audio_urls ?? [{ url: "" }])];
                    updated[i] = { ...updated[i], url: e.target.value };
                    setField("audio_urls", updated);
                  }}
                  placeholder={uiText("Audio URL")}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={audio.label ?? ""}
                  onChange={(e) => {
                    const updated = [...(form.audio_urls ?? [{ url: "" }])];
                    const current = updated[i]!;
                    updated[i] = { url: current.url ?? "", label: e.target.value || undefined };
                    setField("audio_urls", updated);
                  }}
                  placeholder={uiText("Label")}
                  className="w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...(form.audio_urls ?? [])];
                    updated.splice(i, 1);
                    setField("audio_urls", updated.length ? updated : null);
                  }}
                  className="text-red-500 hover:text-red-700 text-sm px-2"
                >
                  {uiText("Remove")}</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setField("audio_urls", [
                  ...(form.audio_urls ?? []),
                  { url: "" },
                ])
              }
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {uiText("+ Add audio URL")}</button>
          </div>
        </div>
      )}

      {/* Category-specific: Movie */}
      {showMovie && (
        <div className="bg-white rounded-lg shadow p-5 space-y-3">
          <legend className={legendCls}>{uiText("Movie Fields")}</legend>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("Trailer URL")}</span>
            <input
              type="text"
              value={form.trailer_url ?? ""}
              onChange={(e) => setField("trailer_url", e.target.value || null)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("Release Date")}</span>
            <input
              type="date"
              value={form.released_date ?? ""}
              onChange={(e) => setField("released_date", e.target.value || null)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("Franchise ID")}</span>
            <input
              type="text"
              value={form.franchise_id ?? ""}
              onChange={(e) => setField("franchise_id", e.target.value || null)}
              placeholder={uiText("e.g. paw-patrol, frozen")}
              className={inputCls}
            />
          </label>
          <div>
            <span className={labelCls}>{uiText("Characters")}</span>
            {(form.characters ?? [{ name: "" }]).map((char, i) => (
              <div key={i} className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={char.name}
                  onChange={(e) => {
                    const updated = [...(form.characters ?? [{ name: "" }])];
                    updated[i] = { ...updated[i], name: e.target.value };
                    setField("characters", updated);
                  }}
                  placeholder={uiText("Character name")}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={char.description ?? ""}
                  onChange={(e) => {
                    const updated = [...(form.characters ?? [{ name: "" }])];
                    const current = updated[i]!;
                    updated[i] = {
                      name: current.name ?? "",
                      image_url: current.image_url,
                      description: e.target.value || undefined,
                    };
                    setField("characters", updated);
                  }}
                  placeholder={uiText("Description")}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...(form.characters ?? [])];
                    updated.splice(i, 1);
                    setField("characters", updated.length ? updated : null);
                  }}
                  className="text-red-500 hover:text-red-700 text-sm px-2"
                >
                  {uiText("Remove")}</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setField("characters", [
                  ...(form.characters ?? []),
                  { name: "" },
                ])
              }
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {uiText("+ Add character")}</button>
          </div>
        </div>
      )}

      {/* Category-specific: Animal */}
      {category === "animal" && (
        <div className="bg-white rounded-lg shadow p-5 space-y-3">
          <legend className={legendCls}>{uiText("Animal Fields")}</legend>
          <label className="block">
            <span className={`block mb-1 ${labelCls}`}>{uiText("YouTube URL (nature video)")}</span>
            <input
              type="text"
              value={form.youtube_url ?? ""}
              onChange={(e) => setField("youtube_url", e.target.value || null)}
              className={inputCls}
            />
          </label>
        </div>
      )}

      {/* Rich Fields (Phase 8) */}
      <RichFieldsEditor
        category={form.category}
        richFields={(form.rich_fields ?? {}) as Record<string, unknown>}
        onChange={(updated) => setField("rich_fields", updated)}
      />

      {/* Published */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_published}
          onChange={(e) => setField("is_published", e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-gray-700">{uiText("Published (visible on kids' map)")}</span>
      </label>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-6 py-2 text-white font-semibold hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? uiText("Saving...") : submitLabel}
        </button>
        {extraButtons}
      </div>
    </form>
  );
}
