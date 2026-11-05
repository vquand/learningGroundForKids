import type { Dispatch, SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { CATEGORIES } from '../../types/item';
import type { ParentLessonSummary } from '../../types/parent';

interface SystemProps {
  filteredSystemLessons: ParentLessonSummary[]; visibleSystemLessons: ParentLessonSummary[];
  selectedSystemIds: string[]; setSelectedSystemIds: Dispatch<SetStateAction<string[]>>;
  busy: boolean; disable: (ids: string[], disabled: boolean) => Promise<void>;
  systemSearch: string; setSystemSearch: (value: string) => void;
  systemCategory: string; setSystemCategory: (value: string) => void;
  systemLessonPage: number; systemLessonPageCount: number; setSystemLessonPage: (page: number) => void;
  pageSize: number;
}
export function ParentSystemLessons({ filteredSystemLessons, visibleSystemLessons, selectedSystemIds,
  setSelectedSystemIds, busy, disable, systemSearch, setSystemSearch, systemCategory, setSystemCategory,
  systemLessonPage, systemLessonPageCount, setSystemLessonPage, pageSize }: SystemProps) {
  useUiLanguage();
  return (
  <section>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{uiText("System Lessons")}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {uiText("Filter the built-in lesson set, then disable or re-enable in bulk.")}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void disable(selectedSystemIds, true)}
          disabled={selectedSystemIds.length === 0 || busy}
          className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uiText("Disable Selected")}</button>
        <button
          type="button"
          onClick={() => void disable(selectedSystemIds, false)}
          disabled={selectedSystemIds.length === 0 || busy}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
        >
          {uiText("Enable Selected")}</button>
      </div>
    </div>

    <div className="mt-4 flex flex-col gap-3 md:flex-row">
      <input
        type="text"
        aria-label={uiText("Search system lessons")} value={systemSearch}
        onChange={(event) => setSystemSearch(event.target.value)}
        placeholder={uiText("Search system lessons")}
        className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
      />
      <select
        aria-label={uiText("Category")} value={systemCategory}
        onChange={(event) => setSystemCategory(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 md:w-48"
      >
        <option value="">{uiText("All categories")}</option>
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </div>

    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">
              <input
                type="checkbox"
                                aria-label={uiText("Select page of lessons")}
                checked={
                  visibleSystemLessons.length > 0 &&
                  visibleSystemLessons.every((lesson) => selectedSystemIds.includes(lesson.id))
                }
                onChange={(event) =>
                  setSelectedSystemIds((current) =>
                    event.target.checked
                      ? Array.from(
                          new Set([...current, ...visibleSystemLessons.map((lesson) => lesson.id)]),
                        )
                      : current.filter(
                          (id) => !visibleSystemLessons.some((lesson) => lesson.id === id),
                        ),
                  )
                }
              />
            </th>
            <th className="px-4 py-3">{uiText("Lesson")}</th>
            <th className="px-4 py-3">{uiText("Category")}</th>
            <th className="px-4 py-3">{uiText("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {visibleSystemLessons.map((lesson) => (
            <tr key={lesson.id} className="border-t border-gray-100">
              <td className="px-4 py-3">
                <input
                  type="checkbox" aria-label={`${uiText("Select lesson")}: ${lesson.title}`}
                  checked={selectedSystemIds.includes(lesson.id)}
                  onChange={(event) =>
                    setSelectedSystemIds((current) =>
                      event.target.checked
                        ? [...current, lesson.id]
                        : current.filter((id) => id !== lesson.id),
                    )
                  }
                />
              </td>
              <td className="px-4 py-3 font-medium text-gray-800"><Link to={`/parent/lists/exploring/${encodeURIComponent(lesson.id)}`}>{lesson.title}</Link></td>
              <td className="px-4 py-3 capitalize text-gray-600">{lesson.category}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    lesson.is_disabled_for_family
                      ? "bg-rose-100 text-rose-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {lesson.is_disabled_for_family ? uiText("Disabled for family") : uiText("Enabled")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <PaginationControls
      label="System lessons"
      page={systemLessonPage}
      pageCount={systemLessonPageCount}
      totalItems={filteredSystemLessons.length}
      pageSize={pageSize}
      onPageChange={setSystemLessonPage}
    />
  </section>
  );
}

interface CustomProps {
  visibleCustomLessons: ParentLessonSummary[]; customLessons: ParentLessonSummary[];
  familyId: string | null; customLessonPage: number; customLessonPageCount: number;
  setCustomLessonPage: (page: number) => void; setShareLesson: (lesson: ParentLessonSummary) => void;
  pageSize: number;
}
export function ParentCustomLessons({visibleCustomLessons,customLessons,familyId,customLessonPage,
  customLessonPageCount,setCustomLessonPage,setShareLesson,pageSize}: CustomProps) {
  useUiLanguage();
  return (
  <section>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{uiText("Custom Lessons")}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {uiText("Lessons your family created, including family-only and child-specific lessons.")}</p>
      </div>
    </div>

    {customLessons.length ? (
      <div className="mt-4 space-y-3">
        {visibleCustomLessons.map((lesson) => (
          <div
            key={lesson.id}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="text-base font-semibold" to={`/parent/lists/exploring/${encodeURIComponent(lesson.id)}`}>{lesson.title}</Link>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-gray-600">
                    {lesson.category}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      lesson.owner_family_id === familyId
                        ? "bg-sky-100 text-sky-700"
                        : "bg-violet-100 text-violet-700"
                    }`}
                  >
                    {lesson.owner_family_id === familyId
                      ? uiText("Created by your family")
                      : `Shared by ${lesson.owner_family_name ?? uiText("another family")}`}
                  </span>
                </div>
                {lesson.audiences.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lesson.audiences.map((audience) => (
                      <span
                        key={audience.id}
                        className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600"
                      >
                        {audience.scope === "profile"
                          ? `${audience.family_name}: ${audience.profile_name ?? uiText("Kid")}`
                          : `${audience.family_name}: whole family`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {lesson.can_edit && (
                  <Link
                    to={`/parent/lists/exploring/${encodeURIComponent(lesson.id)}/edit`}
                    className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    {uiText("Edit")}</Link>
                )}
                {lesson.can_share && (
                  <button
                    type="button"
                    onClick={() => {
                      setShareLesson(lesson);
                    }}
                    className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    {uiText("Share")}</button>
                )}
              </div>
            </div>
          </div>
        ))}
        <PaginationControls
          label="Custom lessons"
          page={customLessonPage}
          pageCount={customLessonPageCount}
          totalItems={customLessons.length}
          pageSize={pageSize}
          onPageChange={setCustomLessonPage}
        />
      </div>
    ) : (
      <p className="mt-4 text-sm text-gray-400">{uiText("No custom lessons yet.")}</p>
    )}
  </section>
  );
}

function PaginationControls({
  label,
  page,
  pageCount,
  totalItems,
  pageSize,
  onPageChange,
}: {
  label: string;
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  useUiLanguage();
  if (totalItems <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
      <p>
        {uiText(label)}: {start}-{end} {uiText(" of ")}{totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-full border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
        >
          {uiText("Previous")}</button>
        <span className="font-medium text-gray-700">
          {uiText("Page")}{page} {uiText(" of ")}{pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          className="rounded-full border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
        >
          {uiText("Next")}</button>
      </div>
    </div>
  );
}
