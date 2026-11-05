import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
interface RichFieldsEditorProps {
  category: string;
  richFields: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "text-xs font-medium text-gray-600";
const legendCls =
  "text-sm font-semibold text-gray-700 uppercase tracking-wide";

export function RichFieldsEditor({
  category,
  richFields,
  onChange,
}: RichFieldsEditorProps) {
  useUiLanguage();
  function setRich(key: string, value: unknown) {
    onChange({ ...richFields, [key]: value });
  }

  if (category === "food") return <FoodFields richFields={richFields} setRich={setRich} />;
  if (category === "monument") return <MonumentFields richFields={richFields} setRich={setRich} />;
  if (category === "animal") return <AnimalFields richFields={richFields} setRich={setRich} />;
  if (category === "landmark") return <LandmarkFields richFields={richFields} setRich={setRich} />;
  if (category === "music") return <MusicFields richFields={richFields} setRich={setRich} />;
  if (category === "phenomenon") return <PhenomenonFields richFields={richFields} setRich={setRich} />;
  if (category === "movie") return <MovieFields richFields={richFields} setRich={setRich} />;

  return null;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                     */
/* ------------------------------------------------------------------ */

interface SectionProps {
  richFields: Record<string, unknown>;
  setRich: (key: string, value: unknown) => void;
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  useUiLanguage();
  return (
    <label className="block">
      <span className={`block mb-1 ${labelCls}`}>{uiText(label)}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Food                                                               */
/* ------------------------------------------------------------------ */

function FoodFields({ richFields, setRich }: SectionProps) {
  useUiLanguage();
  const ingredients = (richFields.ingredients as { name: string; quantity: string }[] | undefined) ?? [];
  const recipeSteps = (richFields.recipe_steps as string[] | undefined) ?? [];

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <legend className={legendCls}>{uiText("Rich Food Fields")}</legend>

      <TextInput
        label="Origin Date (e.g. ~1900, 500 BCE)"
        value={(richFields.origin_date as string) ?? ""}
        onChange={(v) => setRich("origin_date", v || undefined)}
      />

      <TextInput
        label="Inventor / Origin"
        value={(richFields.inventor as string) ?? ""}
        onChange={(v) => setRich("inventor", v || undefined)}
      />

      {/* Ingredients dynamic list */}
      <div>
        <span className={labelCls}>{uiText("Ingredients")}</span>
        {ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2 mt-1">
            <input
              type="text"
              value={ing.name}
              onChange={(e) => {
                const updated = [...ingredients];
                updated[i] = { name: e.target.value, quantity: updated[i]?.quantity ?? "" };
                setRich("ingredients", updated);
              }}
              placeholder={uiText("Name")}
              className={`flex-1 ${inputCls}`}
            />
            <input
              type="text"
              value={ing.quantity}
              onChange={(e) => {
                const updated = [...ingredients];
                updated[i] = { name: updated[i]?.name ?? "", quantity: e.target.value };
                setRich("ingredients", updated);
              }}
              placeholder={uiText("Quantity")}
              className={`w-32 ${inputCls}`}
            />
            <button
              type="button"
              onClick={() => {
                const updated = [...ingredients];
                updated.splice(i, 1);
                setRich("ingredients", updated.length ? updated : undefined);
              }}
              className="text-red-500 hover:text-red-700 text-sm px-2"
            >
              {uiText("Remove")}</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRich("ingredients", [...ingredients, { name: "", quantity: "" }])}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {uiText("+ Add ingredient")}</button>
      </div>

      {/* Recipe steps dynamic list */}
      <div>
        <span className={labelCls}>{uiText("Recipe Steps")}</span>
        {recipeSteps.map((step, i) => (
          <div key={i} className="flex gap-2 mt-1">
            <textarea
              value={step}
              onChange={(e) => {
                const updated = [...recipeSteps];
                updated[i] = e.target.value;
                setRich("recipe_steps", updated);
              }}
              rows={2}
              className={`flex-1 ${inputCls}`}
            />
            <button
              type="button"
              onClick={() => {
                const updated = [...recipeSteps];
                updated.splice(i, 1);
                setRich("recipe_steps", updated.length ? updated : undefined);
              }}
              className="text-red-500 hover:text-red-700 text-sm px-2"
            >
              {uiText("Remove")}</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRich("recipe_steps", [...recipeSteps, ""])}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {uiText("+ Add step")}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Monument                                                           */
/* ------------------------------------------------------------------ */

function MonumentFields({ richFields, setRich }: SectionProps) {
  useUiLanguage();
  const dims = (richFields.dimensions as Record<string, string> | undefined) ?? {};

  function setDim(key: string, value: string) {
    const updated = { ...dims };
    if (value) {
      updated[key] = value;
    } else {
      delete updated[key];
    }
    setRich("dimensions", Object.keys(updated).length ? updated : undefined);
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <legend className={legendCls}>{uiText("Rich Monument Fields")}</legend>

      <TextInput
        label="Construction Date"
        value={(richFields.construction_date as string) ?? ""}
        onChange={(v) => setRich("construction_date", v || undefined)}
      />
      <TextInput
        label="Ordered By"
        value={(richFields.ordered_by as string) ?? ""}
        onChange={(v) => setRich("ordered_by", v || undefined)}
      />
      <TextInput
        label="Designed By"
        value={(richFields.designed_by as string) ?? ""}
        onChange={(v) => setRich("designed_by", v || undefined)}
      />

      <div>
        <span className={labelCls}>{uiText("Dimensions")}</span>
        <div className="grid grid-cols-3 gap-2 mt-1">
          <input
            type="text"
            value={dims.height ?? ""}
            onChange={(e) => setDim("height", e.target.value)}
            placeholder={uiText("Height")}
            className={inputCls}
          />
          <input
            type="text"
            value={dims.width ?? ""}
            onChange={(e) => setDim("width", e.target.value)}
            placeholder={uiText("Width")}
            className={inputCls}
          />
          <input
            type="text"
            value={dims.area ?? ""}
            onChange={(e) => setDim("area", e.target.value)}
            placeholder={uiText("Area")}
            className={inputCls}
          />
        </div>
      </div>

      <TextInput
        label="Floor Plan URL"
        value={(richFields.floor_plan_url as string) ?? ""}
        onChange={(v) => setRich("floor_plan_url", v || undefined)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animal                                                             */
/* ------------------------------------------------------------------ */

const CLASSIFICATIONS = ["mammal", "insect", "fish", "bird", "reptile", "amphibian"];
const ENDANGERED_STATUSES = [
  "Least Concern",
  "Near Threatened",
  "Vulnerable",
  "Endangered",
  "Critically Endangered",
  "Extinct",
];

function AnimalFields({ richFields, setRich }: SectionProps) {
  useUiLanguage();
  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <legend className={legendCls}>{uiText("Rich Animal Fields")}</legend>

      <label className="block">
        <span className={`block mb-1 ${labelCls}`}>{uiText("Classification")}</span>
        <select
          value={(richFields.classification as string) ?? ""}
          onChange={(e) => setRich("classification", e.target.value || undefined)}
          className={inputCls}
        >
          <option value="">{uiText("-- Select --")}</option>
          {CLASSIFICATIONS.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </label>

      <TextInput
        label="Population"
        value={(richFields.population as string) ?? ""}
        onChange={(v) => setRich("population", v || undefined)}
        placeholder={uiText("e.g. ~10,000 or Extinct")}
      />

      <label className="block">
        <span className={`block mb-1 ${labelCls}`}>{uiText("Endangered Status")}</span>
        <select
          value={(richFields.endangered_status as string) ?? ""}
          onChange={(e) => setRich("endangered_status", e.target.value || undefined)}
          className={inputCls}
        >
          <option value="">{uiText("-- Select --")}</option>
          {ENDANGERED_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landmark                                                           */
/* ------------------------------------------------------------------ */

function LandmarkFields({ richFields, setRich }: SectionProps) {
  useUiLanguage();
  const stats = (richFields.key_stats as Record<string, string> | undefined) ?? {};

  function setStat(key: string, value: string) {
    const updated = { ...stats };
    if (value) {
      updated[key] = value;
    } else {
      delete updated[key];
    }
    setRich("key_stats", Object.keys(updated).length ? updated : undefined);
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <legend className={legendCls}>{uiText("Rich Landmark Fields")}</legend>

      <div>
        <span className={labelCls}>{uiText("Key Stats")}</span>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <input
            type="text"
            value={stats.height ?? ""}
            onChange={(e) => setStat("height", e.target.value)}
            placeholder={uiText("Height")}
            className={inputCls}
          />
          <input
            type="text"
            value={stats.width ?? ""}
            onChange={(e) => setStat("width", e.target.value)}
            placeholder={uiText("Width")}
            className={inputCls}
          />
          <input
            type="text"
            value={stats.depth ?? ""}
            onChange={(e) => setStat("depth", e.target.value)}
            placeholder={uiText("Depth")}
            className={inputCls}
          />
          <input
            type="text"
            value={stats.area ?? ""}
            onChange={(e) => setStat("area", e.target.value)}
            placeholder={uiText("Area")}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Music                                                              */
/* ------------------------------------------------------------------ */

function MusicFields({ richFields, setRich }: SectionProps) {
  useUiLanguage();
  const vocalists = (richFields.vocalists as string[] | undefined) ?? [];

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <legend className={legendCls}>{uiText("Rich Music Fields")}</legend>

      <TextInput
        label="Composer"
        value={(richFields.composer as string) ?? ""}
        onChange={(v) => setRich("composer", v || undefined)}
      />

      {/* Vocalists dynamic list */}
      <div>
        <span className={labelCls}>{uiText("Vocalists")}</span>
        {vocalists.map((vocalist, i) => (
          <div key={i} className="flex gap-2 mt-1">
            <input
              type="text"
              value={vocalist}
              onChange={(e) => {
                const updated = [...vocalists];
                updated[i] = e.target.value;
                setRich("vocalists", updated);
              }}
              placeholder={uiText("Vocalist name")}
              className={`flex-1 ${inputCls}`}
            />
            <button
              type="button"
              onClick={() => {
                const updated = [...vocalists];
                updated.splice(i, 1);
                setRich("vocalists", updated.length ? updated : undefined);
              }}
              className="text-red-500 hover:text-red-700 text-sm px-2"
            >
              {uiText("Remove")}</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRich("vocalists", [...vocalists, ""])}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {uiText("+ Add vocalist")}</button>
      </div>

      <label className="block">
        <span className={`block mb-1 ${labelCls}`}>{uiText("Release Year")}</span>
        <input
          type="number"
          value={(richFields.release_year as number) ?? ""}
          onChange={(e) =>
            setRich("release_year", e.target.value ? parseInt(e.target.value, 10) : undefined)
          }
          className={inputCls}
        />
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phenomenon                                                         */
/* ------------------------------------------------------------------ */

function PhenomenonFields({ richFields, setRich }: SectionProps) {
  useUiLanguage();
  const metrics = (richFields.kid_metrics as Record<string, string> | undefined) ?? {};

  function setMetric(key: string, value: string) {
    const updated = { ...metrics };
    if (value) {
      updated[key] = value;
    } else {
      delete updated[key];
    }
    setRich("kid_metrics", Object.keys(updated).length ? updated : undefined);
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <legend className={legendCls}>{uiText("Rich Phenomenon Fields")}</legend>

      <div>
        <span className={labelCls}>{uiText("Kid Metrics")}</span>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <input
            type="text"
            value={metrics.speed ?? ""}
            onChange={(e) => setMetric("speed", e.target.value)}
            placeholder={uiText("Speed")}
            className={inputCls}
          />
          <input
            type="text"
            value={metrics.temperature ?? ""}
            onChange={(e) => setMetric("temperature", e.target.value)}
            placeholder={uiText("Temperature")}
            className={inputCls}
          />
          <input
            type="text"
            value={metrics.richter_scale ?? ""}
            onChange={(e) => setMetric("richter_scale", e.target.value)}
            placeholder={uiText("Richter Scale")}
            className={inputCls}
          />
          <input
            type="text"
            value={metrics.wind_speed ?? ""}
            onChange={(e) => setMetric("wind_speed", e.target.value)}
            placeholder={uiText("Wind Speed")}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Movie                                                              */
/* ------------------------------------------------------------------ */

function MovieFields({ richFields, setRich }: SectionProps) {
  useUiLanguage();
  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <legend className={legendCls}>{uiText("Rich Movie Fields")}</legend>

      <label className="block">
        <span className={`block mb-1 ${labelCls}`}>{uiText("Story Blurb")}</span>
        <textarea
          value={(richFields.story_blurb as string) ?? ""}
          onChange={(e) => setRich("story_blurb", e.target.value || undefined)}
          rows={3}
          className={inputCls}
        />
      </label>
    </div>
  );
}
