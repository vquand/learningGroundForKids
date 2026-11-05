import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminFetchItems, adminLogout } from "../../api/admin";
import { useAdminStore } from "../../stores/adminStore";
import { useFamilyStore } from "../../stores/familyStore";
import type { AdminItemSummary, AdminStats } from "../../types/admin";
import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';

function computeStats(
  items: AdminItemSummary[],
): AdminStats {
  const publishedItems = items.filter((i) => i.is_published).length;
  const itemsByCategory: Record<string, number> = {};
  for (const item of items) {
    itemsByCategory[item.category] = (itemsByCategory[item.category] || 0) + 1;
  }
  return {
    totalItems: items.length,
    publishedItems,
    unpublishedItems: items.length - publishedItems,
    itemsByCategory,
  };
}

export function AdminDashboardPage() {
  useUiLanguage();
  const access = useAdminStore((s) => s.access);
  const clearSession = useFamilyStore((s) => s.clearSession);
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (access !== "admin") return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const items = await adminFetchItems();
        if (!cancelled) {
          setStats(computeStats(items));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [access, reload]);

  async function handleLogout() {
    try {
      await adminLogout();
      clearSession();
      navigate("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign out.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-24 pt-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-800">{uiText("Admin Dashboard")}</h1>
          <AdminRefreshButton refreshing={loading} onRefresh={() => setReload(value => value + 1)} />
          <button
            onClick={handleLogout}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            {uiText("Logout")}</button>
        </div>

        {loading && (
          <p className="text-gray-500">{uiText("Loading dashboard data...")}</p>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 mb-6">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <StatCard label="Total Items" value={stats.totalItems} />
              <StatCard label="Published" value={stats.publishedItems} />
              <StatCard label="Unpublished" value={stats.unpublishedItems} />
            </div>

            {/* Items by Category */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                {uiText("Items by Category")}</h2>
              {Object.keys(stats.itemsByCategory).length === 0 ? (
                <p className="text-gray-400">{uiText("No items yet")}</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(stats.itemsByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => (
                      <div
                        key={category}
                        className="flex items-center justify-between bg-gray-50 rounded-md px-4 py-2"
                      >
                        <span className="text-sm font-medium text-gray-600 capitalize">
                          {category}
                        </span>
                        <span className="text-sm font-bold text-gray-800">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

          </>
        )}

            {/* Navigation must not depend on item statistics succeeding. */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Link to="/admin/achievements" className="block rounded-lg bg-white p-6 shadow hover:shadow-md"><h3 className="mb-1 text-lg font-semibold text-gray-800">{uiText("Achievements")}</h3><p className="text-sm text-gray-500">{uiText("Review minigame badges and migrate achievement definitions")}</p></Link>
              <Link
                to="/admin/content"
                className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  {uiText("Content Authoring")}</h3>
                <p className="text-sm text-gray-500">
                  {uiText("Create and manage learning items")}</p>
              </Link>
              <Link
                to="/admin/families"
                className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  {uiText("Families and Kids")}</h3>
                <p className="text-sm text-gray-500">
                  {uiText("Inspect families, kids, completion progress, and friendship links in one place")}</p>
              </Link>
              <Link
                to="/admin/tests"
                className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  {uiText("Test")}</h3>
                <p className="text-sm text-gray-500">
                  {uiText("Inspect quiz content and kid performance from one assessment panel")}</p>
              </Link>
            </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  useUiLanguage();
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{uiText(label)}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}
