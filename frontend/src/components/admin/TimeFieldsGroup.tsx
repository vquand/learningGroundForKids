import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { AdminItemFormData } from "../../types/admin";

const inputCls = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "text-xs font-medium text-gray-600";
const legendCls = "text-sm font-semibold text-gray-700 uppercase tracking-wide";

const PRECISION_OPTIONS = [
  { value: "", label: "-- Select --" },
  { value: "mya", label: "Millions of years ago (mya)" },
  { value: "kya", label: "Thousands of years ago (kya)" },
  { value: "century", label: "Century" },
  { value: "decade", label: "Decade" },
  { value: "year", label: "Year" },
  { value: "exact", label: "Exact" },
];

interface TimeFieldsGroupProps {
  startYear?: number | null;
  endYear?: number | null;
  timePrecision?: string | null;
  onFieldChange: <K extends keyof AdminItemFormData>(key: K, value: AdminItemFormData[K]) => void;
}

export function TimeFieldsGroup({ startYear, endYear, timePrecision, onFieldChange }: TimeFieldsGroupProps) {
  useUiLanguage();
  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <legend className={legendCls}>{uiText("Time Period")}</legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={`block mb-1 ${labelCls}`}>{uiText("Start Year (negative = BCE)")}</span>
          <input
            type="number"
            value={startYear ?? ""}
            onChange={(e) => onFieldChange("start_year", e.target.value ? parseInt(e.target.value, 10) : null)}
            placeholder="-65000000"
            className={`${inputCls} min-h-[48px]`}
          />
          <span className="text-xs text-gray-400 mt-1 block">{uiText("Negative = BCE (e.g., -65000000 for 65 million years ago)")}</span>
        </label>
        <label className="block">
          <span className={`block mb-1 ${labelCls}`}>{uiText("End Year (blank = still exists)")}</span>
          <input
            type="number"
            value={endYear ?? ""}
            onChange={(e) => onFieldChange("end_year", e.target.value ? parseInt(e.target.value, 10) : null)}
            placeholder="2026"
            className={`${inputCls} min-h-[48px]`}
          />
        </label>
      </div>
      <label className="block">
        <span className={`block mb-1 ${labelCls}`}>{uiText("Time Precision")}</span>
        <select
          value={timePrecision ?? ""}
          onChange={(e) => onFieldChange("time_precision", e.target.value || null)}
          className={inputCls}
        >
          {PRECISION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{uiText(opt.label)}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
