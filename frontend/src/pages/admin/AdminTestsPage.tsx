import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetchTestDetail, adminFetchTests } from "../../api/admin";
import { useAdminStore } from "../../stores/adminStore";
import { CATEGORIES } from "../../types/item";
import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
import type {
  AdminAssessmentDetail,
  AdminAssessmentPerformance,
  AdminAssessmentQuestion,
  AdminAssessmentSummary,
} from "../../types/admin";

type DetailTab = "content" | "performance";
const PAGE_SIZE = 20;

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function formatScore(score: number, total: number): string {
  return total > 0 ? `${score}/${total}` : "0/0";
}

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "No attempts yet";
}

function formatAverageTime(value: number | null): string {
  if (value == null) return "Unavailable";
  if (value < 60) return `${Math.round(value)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds}s`;
}

export function AdminTestsPage() {
  useUiLanguage();
  const access = useAdminStore((s) => s.access);
  const [tests, setTests] = useState<AdminAssessmentSummary[]>([]);
  const [details, setDetails] = useState<Record<string, AdminAssessmentDetail>>({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("content");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (access !== "admin") return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadTests() {
      try {
        const data = await adminFetchTests();
        if (!cancelled) {
          setTests(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tests");
          setLoading(false);
        }
      }
    }

    loadTests();
    return () => {
      cancelled = true;
    };
  }, [access, reload]);

  useEffect(() => {
    if (access !== "admin" || !selectedTestId || details[selectedTestId]) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    adminFetchTestDetail(selectedTestId)
      .then((detail) => {
        if (!cancelled) {
          setDetails((current) => ({ ...current, [selectedTestId]: detail }));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : "Failed to load test detail");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [access, details, selectedTestId]);

  const selectedSummary = useMemo(
    () => tests.find((test) => test.item_id === selectedTestId) ?? null,
    [selectedTestId, tests],
  );
  const countryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          tests
            .map((test) => test.country_code?.toUpperCase())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [tests],
  );
  const filteredTests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return tests.filter((test) => {
      const matchesCategory = !categoryFilter || test.item_category === categoryFilter;
      const matchesCountry =
        !countryFilter || (test.country_code ?? "").toUpperCase() === countryFilter;
      const matchesSearch =
        !normalizedSearch || test.item_title.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesCountry && matchesSearch;
    });
  }, [categoryFilter, countryFilter, searchTerm, tests]);
  const totalPages = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
  const paginatedTests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTests.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredTests]);
  const selectedDetail = selectedTestId ? details[selectedTestId] ?? null : null;
  const questionsByLanguage = useMemo(() => {
    const groups = new Map<string, AdminAssessmentQuestion[]>();
    for (const question of selectedDetail?.questions ?? []) {
      const key = question.lang.toUpperCase();
      groups.set(key, [...(groups.get(key) ?? []), question]);
    }
    return Array.from(groups.entries());
  }, [selectedDetail]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, countryFilter, searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function openDetail(test: AdminAssessmentSummary) {
    setSelectedTestId(test.item_id);
    setActiveTab("content");
  }

  function closeDetail() {
    setSelectedTestId(null);
    setDetailError(null);
    setActiveTab("content");
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-24 pt-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            to="/admin"
            className="mb-1 inline-block text-sm text-blue-600 hover:underline"
          >
            {uiText("&larr; Back to Dashboard")}</Link>
          <h1 className="text-2xl font-bold text-gray-800">{uiText("Test")}</h1>
          <p className="text-sm text-gray-500">
            {uiText("Assessment directory for quiz-backed content, with detailed content and kid performance in one panel.")}</p>
          <div className="mt-4"><AdminRefreshButton refreshing={loading || detailLoading} onRefresh={() => {
            setDetails({});
            setReload(value => value + 1);
          }} /></div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">{uiText("Loading tests...")}</p>
        ) : tests.length === 0 ? (
          <p className="text-gray-400">{uiText("No assessments found.")}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {uiText("Search by Parent Item Name")}</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={uiText("Search tests by item title")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                />
              </div>
              <div className="w-full lg:w-56">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {uiText("Parent Category")}</label>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                >
                  <option value="">{uiText("All categories")}</option>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full lg:w-44">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {uiText("Country")}</label>
                <select
                  value={countryFilter}
                  onChange={(event) => setCountryFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                >
                  <option value="">{uiText("All countries")}</option>
                  {countryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full lg:w-36">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {uiText("Results")}</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
                  {filteredTests.length} / {tests.length}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">{uiText("Type")}</th>
                    <th className="px-4 py-3">{uiText("Title")}</th>
                    <th className="px-4 py-3">{uiText("Category")}</th>
                    <th className="px-4 py-3">{uiText("Country")}</th>
                    <th className="px-4 py-3">{uiText("Questions")}</th>
                    <th className="px-4 py-3">{uiText("Attempts")}</th>
                    <th className="px-4 py-3">{uiText("Kids")}</th>
                    <th className="px-4 py-3">{uiText("Pass Rate")}</th>
                    <th className="px-4 py-3">{uiText("Latest Attempt")}</th>
                    <th className="px-4 py-3 text-right">{uiText("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTests.map((test) => (
                    <tr
                      key={test.item_id}
                      className="border-t border-gray-100 text-gray-700 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                          {test.assessment_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-800">{test.item_title}</p>
                          <p className="font-mono text-xs text-gray-400">{test.item_id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize">{test.item_category}</td>
                      <td className="px-4 py-3 uppercase text-gray-600">
                        {test.country_code || uiText("Global")}
                      </td>
                      <td className="px-4 py-3">{test.active_question_count}/{test.question_count}</td>
                      <td className="px-4 py-3">{test.attempt_count}</td>
                      <td className="px-4 py-3">{test.unique_profile_count}</td>
                      <td className="px-4 py-3">{formatPercent(test.pass_rate)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatTimestamp(test.latest_attempt_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(test)}
                          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
                        >
                          {uiText("Detail")}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>

            {filteredTests.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-gray-500">
                  {uiText("Page")}{currentPage} {uiText(" of ")}{totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {uiText("Previous")}</button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {uiText("Next")}</button>
                </div>
              </div>
            )}

            {filteredTests.length === 0 && (
              <p className="mt-3 text-sm text-gray-500">{uiText("No tests match the current filters.")}</p>
            )}
          </>
        )}
      </div>

      {selectedTestId && (
        <button
          type="button"
          aria-label={uiText("Close admin test detail panel")}
          onClick={closeDetail}
          className="fixed inset-0 z-40 bg-black/45"
        />
      )}

      {selectedTestId && (
        <aside className="fixed inset-y-0 right-0 z-50 h-screen w-[90vw] overflow-y-auto border-l border-gray-200 bg-white shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                  {uiText("Admin Test Detail Panel")}</p>
                <h2 className="mt-1 text-2xl font-bold text-gray-900">
                  {selectedDetail?.item_title ?? selectedSummary?.item_title ?? uiText("Loading assessment")}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {(selectedDetail?.assessment_type ?? selectedSummary?.assessment_type ?? "quiz").toUpperCase()} · {" "}
                  {selectedDetail?.item_category ?? selectedSummary?.item_category ?? "unknown"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                {uiText("Close")}</button>
            </div>

            <div className="mt-4 flex gap-2">
              <TabButton
                active={activeTab === "content"}
                label="Content"
                onClick={() => setActiveTab("content")}
              />
              <TabButton
                active={activeTab === "performance"}
                label="Performance"
                onClick={() => setActiveTab("performance")}
              />
            </div>
          </div>

          <div className="px-6 py-6">
            {detailError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                {detailError}
              </div>
            )}

            {detailLoading && !selectedDetail ? (
              <p className="text-gray-500">{uiText("Loading detail...")}</p>
            ) : !selectedDetail ? (
              <p className="text-gray-400">{uiText("Select an assessment to inspect.")}</p>
            ) : activeTab === "content" ? (
              <div className="space-y-6">
                <div className="grid gap-3 md:grid-cols-5">
                  <StatCard label="Type" value={selectedDetail.assessment_type.toUpperCase()} />
                  <StatCard label="Languages" value={selectedDetail.language_count} />
                  <StatCard label="Questions" value={selectedDetail.question_count} />
                  <StatCard label="Active" value={selectedDetail.active_question_count} />
                  <StatCard label="Attempts" value={selectedDetail.attempt_count} />
                </div>

                {questionsByLanguage.length === 0 ? (
                  <p className="text-gray-400">{uiText("No assessment content found.")}</p>
                ) : (
                  questionsByLanguage.map(([lang, questions]) => (
                    <section key={lang} className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">{lang} {uiText(" Content")}</h3>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          {questions.length} {uiText(" question")}{questions.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="space-y-4">
                        {questions.map((question, index) => (
                          <QuestionCard key={question.id} index={index} question={question} />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-3 md:grid-cols-6">
                  <StatCard label="Attempts" value={selectedDetail.attempt_count} />
                  <StatCard label="Kids" value={selectedDetail.unique_profile_count} />
                  <StatCard label="Pass Rate" value={formatPercent(selectedDetail.pass_rate)} />
                  <StatCard label="Fail Rate" value={formatPercent(selectedDetail.fail_rate)} />
                  <StatCard label="Avg Score" value={formatPercent(selectedDetail.average_score_rate)} />
                  <StatCard label="Avg Time" value={formatAverageTime(selectedDetail.average_time_seconds)} />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{uiText("Kids Taking This")}</h3>
                    <p className="text-sm text-gray-500">
                      {uiText("Average time is unavailable because the current attempt data does not store duration.")}</p>
                  </div>

                  {selectedDetail.performance.length === 0 ? (
                    <p className="text-gray-400">{uiText("No kids have attempted this assessment yet.")}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-3">{uiText("Kid")}</th>
                            <th className="px-4 py-3">{uiText("Family")}</th>
                            <th className="px-4 py-3">{uiText("Attempts")}</th>
                            <th className="px-4 py-3">{uiText("Success Rate")}</th>
                            <th className="px-4 py-3">{uiText("Average Score")}</th>
                            <th className="px-4 py-3">{uiText("Best")}</th>
                            <th className="px-4 py-3">{uiText("Latest")}</th>
                            <th className="px-4 py-3">{uiText("Avg Time")}</th>
                            <th className="px-4 py-3">{uiText("Latest Attempt")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDetail.performance.map((row) => (
                            <PerformanceRow key={row.profile_id} row={row} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  useUiLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-gray-900 text-white"
          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
      }`}
    >
      {uiText(label)}
    </button>
  );
}

function QuestionCard({
  index,
  question,
}: {
  index: number;
  question: AdminAssessmentQuestion;
}) {
  useUiLanguage();
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
          Q{index + 1}
        </span>
        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
          {question.question_type}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            question.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {question.is_active ? "active" : "inactive"}
        </span>
      </div>
      <p className="text-base font-semibold text-gray-900">{question.question}</p>
      <div className="mt-4 space-y-2">
        {question.options.map((option, optionIndex) => {
          const isCorrect = question.correct_answers.includes(optionIndex);
          return (
            <div
              key={`${question.id}-${optionIndex}`}
              className={`rounded-xl border px-3 py-2 text-sm ${
                isCorrect
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <span className="font-medium">{String.fromCharCode(65 + optionIndex)}.</span> {option}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PerformanceRow({ row }: { row: AdminAssessmentPerformance }) {
  useUiLanguage();
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: `${row.profile_color}20` }}
          >
            {row.profile_emoji || "🙂"}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{row.profile_name}</p>
            <p className="font-mono text-xs text-gray-400">{row.public_id || row.profile_id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">{row.family_name}</td>
      <td className="px-4 py-3">{row.attempt_count}</td>
      <td className="px-4 py-3">{formatPercent(row.success_rate)}</td>
      <td className="px-4 py-3">{formatPercent(row.average_score_rate)}</td>
      <td className="px-4 py-3">{formatScore(row.best_score, row.best_total)}</td>
      <td className="px-4 py-3">{formatScore(row.latest_score, row.latest_total)}</td>
      <td className="px-4 py-3 text-gray-500">{formatAverageTime(row.average_time_seconds)}</td>
      <td className="px-4 py-3 text-gray-500">{formatTimestamp(row.latest_completed_at)}</td>
    </tr>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  useUiLanguage();
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{uiText(label)}</p>
      <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default AdminTestsPage;
