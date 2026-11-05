import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetchProfileActivities, adminFetchProfileJourney } from "../../api/admin";
import type { AdminActivity, AdminActivityType, AdminJourneyPeriod } from "../../types/admin";
import { AdminJourneyMap } from "./AdminJourneyMap";

export function ReportError({ error, retry }: { error: Error; retry: () => void }) {
  useUiLanguage();
  return <div role="alert" className="my-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
    <p>{error.message}</p>
    <button type="button" onClick={retry} className="mt-2 rounded-md border border-red-300 px-3 py-2 font-medium">{uiText("Retry")}</button>
  </div>;
}

function Pagination({ page, totalPages, disabled, noun, onPage }: {
  page: number; totalPages: number; disabled: boolean; noun: string; onPage: (page: number) => void;
}) {
  useUiLanguage();
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
    <p className="text-sm text-gray-600">{uiText("Page ")}{page} {uiText(" of ")}{Math.max(1, totalPages)}</p>
    <div className="flex gap-2">
      <button type="button" aria-label={`Previous ${noun} page`} disabled={disabled || page <= 1}
        onClick={() => onPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-40">{uiText("Previous")}</button>
      <button type="button" aria-label={`Next ${noun} page`} disabled={disabled || page >= totalPages}
        onClick={() => onPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-40">{uiText("Next")}</button>
    </div>
  </div>;
}

function ActivityDetails({ activity }: { activity: AdminActivity }) {
  useUiLanguage();
  if (activity.type === "completion") return <p>{uiText("Item completed")}</p>;
  if (activity.type === "quiz") return <p>{uiText("Quiz score: ")}{activity.score ?? 0}/{activity.total ?? 0}</p>;
  return <div>
    <p>{uiText("Flashcards · ")}{activity.theme_type}: {activity.theme_value}</p>
    <p>{activity.cards_shown ?? 0} {uiText(" cards · ")}{activity.got_it_count ?? 0} {uiText(" got it · ")}{activity.review_again_count ?? 0} {uiText(" review again")}</p>
  </div>;
}

interface ReportProps { familyId: string; profileId: string; scope: readonly unknown[] }

export function AdminActivityHistory({ familyId, profileId, scope }: ReportProps) {
  useUiLanguage();
  const filterId = useId();
  const [filter, setFilter] = useState({ type: "all" as AdminActivityType, page: 1 });
  const report = useQuery({ queryKey: [...scope, "activities", filter], retry: false,
    queryFn: ({ signal }) => adminFetchProfileActivities(familyId, profileId, { ...filter, page_size: 20 }, signal) });
  return <section aria-label={uiText("Activities")} className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h2 className="text-xl font-semibold text-gray-900">{uiText("Activity history")}</h2>
      <div className="text-sm text-gray-700"><label htmlFor={filterId}>{uiText("Activity type")}</label>
        <select id={filterId} value={filter.type} onChange={(event) => setFilter({ type: event.target.value as AdminActivityType, page: 1 })}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2">
          <option value="all">{uiText("All activity")}</option><option value="completion">{uiText("Item completions")}</option>
          <option value="quiz">{uiText("Quiz attempts")}</option><option value="flashcard">{uiText("Flashcard sessions")}</option>
        </select>
      </div>
    </div>
    <p className="mt-2 text-sm text-gray-600">{uiText("Recorded learning activity, newest first. Completion records are current progress, not a permanent audit of removed completions. Login and page-view events were not recorded.")}</p>
    {report.isPending && <p role="status" className="py-4">{uiText("Loading activity history...")}</p>}
    {report.error && <ReportError error={report.error} retry={() => { void report.refetch(); }} />}
    {report.data && <>
      <p role="status" className="my-4 text-sm text-gray-600">{report.data.total} {uiText(" recorded activities")}</p>
      {report.data.activities.length === 0 ? <p className="py-4 text-gray-600">{uiText("No activities found for this filter.")}</p>
        : <ol className="divide-y divide-gray-200">
          {report.data.activities.map((activity) => <li key={activity.id} className="break-words py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900">{activity.item_title ?? (activity.type === "quiz" && !activity.item_id ? uiText("Daily quiz") : activity.item_id ?? uiText("Flashcard study"))}</h3>
              <time dateTime={activity.occurred_at} className="text-sm text-gray-600">{new Date(activity.occurred_at).toLocaleString()}</time>
            </div>
            {activity.item_category && <p className="text-sm capitalize text-gray-600">{activity.item_category}</p>}
            <div className="mt-2 text-sm text-gray-700"><ActivityDetails activity={activity} /></div>
          </li>)}
        </ol>}
    </>}
    <Pagination page={filter.page} totalPages={report.data?.total_pages ?? 1} disabled={report.isFetching || Boolean(report.error)}
      noun="activities" onPage={(page) => setFilter((previous) => ({ ...previous, page }))} />
  </section>;
}

export function AdminProfileJourney({ familyId, profileId, scope }: ReportProps) {
  useUiLanguage();
  const filterId = useId();
  const [filter, setFilter] = useState({ period: "last7days" as AdminJourneyPeriod, page: 1 });
  const report = useQuery({ queryKey: [...scope, "journey", filter], retry: false,
    queryFn: ({ signal }) => adminFetchProfileJourney(familyId, profileId, { ...filter, page_size: 100 }, signal) });
  return <section aria-label={uiText("Journey")} className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h2 className="text-xl font-semibold text-gray-900">{uiText("Journey")}</h2>
      <div className="text-sm text-gray-700"><label htmlFor={filterId}>{uiText("Journey period")}</label>
        <select id={filterId} value={filter.period} onChange={(event) => setFilter({ period: event.target.value as AdminJourneyPeriod, page: 1 })}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2">
          <option value="today">{uiText("Today (UTC)")}</option><option value="yesterday">{uiText("Yesterday (UTC)")}</option>
          <option value="last3days">{uiText("Last 3 days")}</option><option value="last7days">{uiText("Last 7 days")}</option><option value="all">{uiText("All time")}</option>
        </select>
      </div>
    </div>
    <p className="mt-2 text-sm text-gray-600">{uiText("Completed items in learning order, oldest first. Lines connect catalog locations, not physical travel. Periods use UTC; timestamps below use your local timezone.")}</p>
    {report.isPending && <p role="status" className="py-4">{uiText("Loading journey...")}</p>}
    {report.error && <ReportError error={report.error} retry={() => { void report.refetch(); }} />}
    {report.data && <>
      <p role="status" className="my-4 text-sm text-gray-600">{report.data.total} {uiText(" completed places · Showing ")}{report.data.waypoints.length} {uiText(" on this page")}</p>
      {report.data.waypoints.length === 0 ? <p className="py-4 text-gray-600">{uiText("No completed items in this journey period.")}</p> : <>
        <p className="mb-3 text-sm text-gray-700">{uiText("Start: ")}<span>{report.data.origin.title}</span></p>
        <AdminJourneyMap waypoints={report.data.waypoints} startIndex={(filter.page - 1) * 100} />
        <ol aria-label={uiText("Journey stops")} start={(filter.page - 1) * 100 + 1} className="mt-4 list-inside list-decimal divide-y divide-gray-200">
          {report.data.waypoints.map((point) => <li key={point.item_id} className="break-words py-3">
            <span className="font-semibold text-gray-900">{point.title}</span>
            <p className="mt-1 text-sm capitalize text-gray-600">{point.category} · {point.latitude.toFixed(2)}, {point.longitude.toFixed(2)}</p>
            <time dateTime={point.done_at} className="text-sm text-gray-600">{new Date(point.done_at).toLocaleString()}</time>
          </li>)}
        </ol>
      </>}
    </>}
    <Pagination page={filter.page} totalPages={report.data?.total_pages ?? 1} disabled={report.isFetching || Boolean(report.error)}
      noun="journey" onPage={(page) => setFilter((previous) => ({ ...previous, page }))} />
  </section>;
}
