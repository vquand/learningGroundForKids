import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminDeleteItem, adminFetchItems, adminGetRefreshStatus, adminRefreshItems } from "../../api/admin";
import type { AdminCatalogRefreshJob } from "../../types/admin";
import { useAdminStore } from "../../stores/adminStore";
import { CATEGORIES } from "../../types/item";
import type { AdminItemSummary } from "../../types/admin";
import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';

const PAGE_SIZE = 20;

export function AdminContentPage() {
  useUiLanguage();
  const access = useAdminStore((s) => s.access);
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (access !== "admin") return;
    let alive = true;
    setLoading(true);
    setError(null);
    adminFetchItems()
      .then(value => { if (alive) setItems(value); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [access, reload]);

  async function handleDelete(itemId: string, title: string) {
    if (!confirm(`Delete "${title || itemId}"? This cannot be undone.`)) return;
    try {
      await adminDeleteItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    setRefreshMessage(null);
    try {
      let result: AdminCatalogRefreshJob = await adminRefreshItems();
      while (result.status === "queued" || result.status === "running") {
        const progress = result.total_batches === null
          ? ""
          : ` ${result.completed_batches}/${result.total_batches} batches`;
        setRefreshMessage(`Refreshing content…${progress}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const status = await adminGetRefreshStatus();
        if (status.status === "idle") throw new Error("Refresh status is unavailable.");
        result = status;
      }
      if (result.status === "failed") throw new Error(result.error ?? "Content refresh failed.");
      setRefreshMessage(result.updated_count === 0
        ? "Nothing to update."
        : `Updated ${result.updated_count} item${result.updated_count === 1 ? "" : "s"} in ${result.batches} batch${result.batches === 1 ? "" : "es"}.`);
      if (result.updated_count > 0) setItems(await adminFetchItems());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Content refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = categoryFilter
    ? items.filter((i) => i.category === categoryFilter)
    : items;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilterChange(value: string) {
    setCategoryFilter(value);
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-24 pt-6 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-800">{uiText("Content Management")}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <AdminRefreshButton refreshing={loading} disabled={refreshing} onRefresh={() => setReload(value => value + 1)} />
            <Link
              to="/admin"
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              {uiText("Back to Dashboard")}</Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
            >
              {refreshing ? uiText("Refreshing content…") : uiText("Refresh item content")}
            </button>
            <button
              onClick={() => navigate("/admin/content/new")}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
            >
              {uiText("+ Create New Item")}</button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-red-700 text-sm">
            {error}
          </div>
        )}

        {refreshMessage && (
          <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
            {refreshMessage}
          </div>
        )}

        {/* Category filter */}
        <div className="mb-4 flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{uiText("All categories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            {filtered.length} {uiText(" item")}{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <p className="text-gray-500">{uiText("Loading items...")}</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">{uiText("No items found.")}</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg bg-white shadow">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{uiText("Title")}</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{uiText("Category")}</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{uiText("Published")}</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{uiText("Created")}</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">{uiText("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-2 px-4 text-gray-800">
                        {item.title_en || item.title_vi || uiText("(untitled)")}
                      </td>
                      <td className="py-2 px-4 capitalize text-gray-600">{item.category}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${
                            item.is_published ? "bg-green-500" : "bg-red-400"
                          }`}
                          title={item.is_published ? uiText("Published") : uiText("Unpublished")}
                        />
                      </td>
                      <td className="py-2 px-4 text-gray-500">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="py-2 px-4 text-right space-x-3">
                        <button
                          onClick={() => navigate(`/admin/content/${item.id}/edit`)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          {uiText("Edit")}</button>
                        <button
                          onClick={() => navigate(`/admin/content/${item.id}/enrich`)}
                          className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                        >
                          {uiText("Enrich")}</button>
                        <button
                          onClick={() =>
                            handleDelete(item.id, item.title_en || item.title_vi || "")
                          }
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          {uiText("Delete")}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {uiText("Page")}{page} {uiText(" of ")}{totalPages} {uiText(" · showing ")}{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} {uiText(" of ")}{filtered.length}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {uiText("Previous")}</button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {uiText("Next")}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminContentPage;
