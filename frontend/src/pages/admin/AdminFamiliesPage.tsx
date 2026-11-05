import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminFetchFamilies, adminFetchFamilyReports } from "../../api/admin";
import { useAdminStore } from "../../stores/adminStore";
import { useFamilyStore } from "../../stores/familyStore";
import { CreateFamilyForm } from "../../components/admin/CreateFamilyForm";
import { SetFamilyPasswordDialog } from "../../components/admin/SetFamilyPasswordDialog";
import { AdminFamilyLearning, AdminChildLearning } from '../../components/admin/AdminFamilyLearning';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { ChildFriendCode } from '../../components/ChildFriendCode';
import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
import type { ChildReport } from '../../api/parentReports';
import type {
  AdminFamilyProfileSummary,
  AdminFriendRequestSummary,
  FamilyOut,
} from "../../types/admin";

const PAGE_SIZE = 20;

function requestStatusClass(status: AdminFriendRequestSummary["status"]): string {
  if (status === "accepted") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  if (status === "cancelled") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-700";
}

function formatRequestScope(request: AdminFriendRequestSummary): string {
  return `${request.requesting_scope === "family" ? "family" : "kid"}-${
    request.target_scope === "family" ? "family" : "kid"
  }`;
}

function formatFromTo(request: AdminFriendRequestSummary): string {
  return `${request.requesting_label} -> ${request.target_label}`;
}

export function AdminFamiliesPage() {
  useUiLanguage();
  const access = useAdminStore((s) => s.access);
  const sessionGeneration = useFamilyStore((s) => s.sessionGeneration);
  const adminId = useFamilyStore((s) => s.familyId);
  const { familyId: selectedFamilyId } = useParams();
  const navigate = useNavigate();
  const [families, setFamilies] = useState<FamilyOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (access !== "admin") return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadFamilies() {
      try {
        const data = await adminFetchFamilies();
        if (!cancelled) {
          setFamilies(data);
          setSelectedProfileId((current) =>
            current && data.some((family) => family.profiles.some((profile) => profile.id === current))
              ? current
              : null,
          );
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load families");
          setLoading(false);
        }
      }
    }

    loadFamilies();
    return () => {
      cancelled = true;
    };
  }, [access, reload, sessionGeneration]);

  useEffect(() => { setSelectedProfileId(null); }, [selectedFamilyId]);
  useEffect(() => { setSettingPassword(false); setPasswordNotice(null); }, [selectedFamilyId]);

  const selectedFamily = useMemo(
    () => families.find((family) => family.id === selectedFamilyId) ?? null,
    [families, selectedFamilyId],
  );
  const selectedProfile = useMemo(
    () =>
      selectedFamily?.profiles.find((profile) => profile.id === selectedProfileId) ??
      selectedFamily?.profiles[0] ??
      null,
    [selectedFamily, selectedProfileId],
  );
  const learning = useQuery({
    queryKey: ['admin-inspection', adminId, sessionGeneration, selectedFamilyId, 'learning'],
    queryFn: ({ signal }) => adminFetchFamilyReports(selectedFamilyId!, signal),
    enabled: access === 'admin' && !!selectedFamily,
    retry: false, staleTime: 30_000,
  });
  const learningChild = !learning.error ? learning.data?.children.find(child => child.id === selectedProfile?.id) : undefined;
  const recentActivities = learningChild ? learningChild.latest_items.map(item => ({
    item_id: item.item_id, item_title: item.title, item_category: item.category, completed_at: item.completed_at,
  })) : selectedProfile?.recent_activities ?? [];
  useEffect(() => {
    if (selectedFamily) detailHeading.current?.focus();
  }, [selectedFamily]);
  const totalPages = Math.max(1, Math.ceil(families.length / PAGE_SIZE));
  const paginatedFamilies = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return families.slice(start, start + PAGE_SIZE);
  }, [currentPage, families]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-24 pt-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            to="/admin"
            className="mb-1 inline-block text-sm text-blue-600 hover:underline"
          >
            {uiText("&larr; Back to Dashboard")}</Link>
          <h1 className="text-2xl font-bold text-gray-800">{uiText("Families and Friend Links")}</h1>
          <p className="text-sm text-gray-500">
            {uiText("Each family login contains learner profiles. Open a family to inspect its profiles, journeys, activity, and friendships.")}</p>
          {access === "admin" && <div className="mt-4 flex flex-wrap gap-3">
            <AdminRefreshButton refreshing={loading || learning.isFetching} onRefresh={() => {
              setReload(value => value + 1);
              if (selectedFamily) void learning.refetch();
            }} />
            {!creating && <button type="button" onClick={() => setCreating(true)}
              className="min-h-11 rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">{uiText("Create family")}</button>}
          </div>}
        </div>

        {access === "admin" && creating && <CreateFamilyForm key={sessionGeneration} onCancel={() => setCreating(false)} onCreated={(id) => {
          setCreating(false);
          setReload((value) => value + 1);
          navigate(`/admin/families/${encodeURIComponent(id)}`);
        }} />}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && selectedFamilyId && !selectedFamily && (
          <p role="alert" className="mb-4 text-red-800">{uiText("Family not found. ")}<Link to="/admin/families" className="underline">{uiText("Return to the family list.")}</Link></p>
        )}

        {loading ? (
          <p className="text-gray-500">{uiText("Loading families...")}</p>
        ) : families.length === 0 ? (
          <p className="text-gray-400">{uiText("No families found.")}</p>
        ) : !selectedFamilyId ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">{uiText("Family")}</th>
                    <th className="px-4 py-3">{uiText("Kids")}</th>
                    <th className="px-4 py-3">{uiText("Accepted")}</th>
                    <th className="px-4 py-3">{uiText("Pending In")}</th>
                    <th className="px-4 py-3">{uiText("Pending Out")}</th>
                    <th className="px-4 py-3">{uiText("Rejected")}</th>
                    <th className="px-4 py-3">{uiText("Created")}</th>
                    <th className="px-4 py-3 text-right">{uiText("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFamilies.map((family) => (
                    <tr
                      key={family.id}
                      className="border-t border-gray-100 text-gray-700 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-800">{family.display_name}</p>
                          <p className="font-mono text-xs text-gray-400">{family.id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{family.profile_count}</td>
                      <td className="px-4 py-3">{family.accepted_request_count}</td>
                      <td className="px-4 py-3">{family.pending_incoming_count}</td>
                      <td className="px-4 py-3">{family.pending_outgoing_count}</td>
                      <td className="px-4 py-3">{family.rejected_request_count}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(family.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/admin/families/${encodeURIComponent(family.id)}`);
                          }}
                          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
                        >
                          {uiText("Detail")}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
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
          </div>
        ) : null}
      </div>

      {selectedFamily && (
        <aside aria-label={uiText("Family details")} className="mx-auto mt-6 max-w-7xl rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                  {uiText("Admin Family Detail Panel")}</p>
                <h2 ref={detailHeading} tabIndex={-1} className="mt-1 break-words text-2xl font-bold text-gray-900">
                  {selectedFamily.display_name}
                </h2>
                <p className="mt-1 font-mono text-xs text-gray-400">{selectedFamily.id}</p>
                <dl className="mt-3 space-y-1 break-all text-sm text-gray-600">
                  {selectedFamily.email && <div><dt className="inline font-medium">{uiText("Email: ")}</dt><dd className="inline">{selectedFamily.email}</dd></div>}
                  {selectedFamily.role && <div><dt className="inline font-medium">{uiText("Role: ")}</dt><dd className="inline">{selectedFamily.role}</dd></div>}
                  {selectedFamily.is_active !== undefined && <div><dt className="inline font-medium">{uiText("Status: ")}</dt><dd className="inline">{selectedFamily.is_active ? uiText("Active") : uiText("Inactive")}</dd></div>}
                  <div><dt className="inline font-medium">{uiText("Created: ")}</dt><dd className="inline">{new Date(selectedFamily.created_at).toLocaleDateString()}</dd></div>
                </dl>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {selectedFamily.role === "family" && <button type="button"
                  onClick={() => { setPasswordNotice(null); setSettingPassword(true); }}
                  className="min-h-11 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">{uiText("Set password")}</button>}
              <button
                type="button"
                onClick={() => {
                  navigate("/admin/families");
                }}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                {uiText("Close")}</button>
              </div>
            </div>
            {passwordNotice && <p role="status" className="mt-3 text-sm text-emerald-700">{passwordNotice}</p>}
          </div>

          <AdminFamilyLearning query={learning}/>

          <div className="grid gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <section className="min-w-0 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {uiText("Family Summary")}</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatCard label="Kids" value={selectedFamily.profile_count} />
                  <StatCard label="Accepted" value={selectedFamily.accepted_request_count} />
                  <StatCard label="Pending In" value={selectedFamily.pending_incoming_count} />
                  <StatCard label="Pending Out" value={selectedFamily.pending_outgoing_count} />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {uiText("Kids")}</h3>
                {selectedFamily.profiles.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-400">{uiText("No kids found in this family.")}</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedFamily.profiles.map((profile) => (
                      <KidCard
                        key={profile.id}
                        profile={profile}
                        learning={!learning.error ? learning.data?.children.find(child => child.id === profile.id) : undefined}
                        selected={selectedProfile?.id === profile.id}
                        onClick={() => setSelectedProfileId(profile.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="min-w-0 space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {selectedProfile && <ProfileAvatar size="lg" profile={learningChild ? { ...learningChild, avatar_url: learningChild.avatar_url ?? undefined } : selectedProfile}/>}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                        {uiText("Kid Spotlight")}</p>
                      <h3 className="mt-1 text-2xl font-bold text-gray-900">
                        {selectedProfile?.name ?? uiText("No kid selected")}
                      </h3>
                      {selectedProfile && <ChildFriendCode key={selectedProfile.id} name={selectedProfile.name} code={selectedProfile.public_id}/>}
                    </div>
                  </div>
                </div>

                {learningChild && <AdminChildLearning key={learningChild.id} child={learningChild}/>}

                <div className="mt-6">
                  {selectedProfile && <Link to={`/admin/families/${encodeURIComponent(selectedFamily.id)}/profiles/${encodeURIComponent(selectedProfile.id)}`}
                    className="mb-4 inline-block rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
                    {uiText("View journey and activity")}</Link>}
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {uiText("Latest 8 item completions")}</h4>
                  {!selectedProfile ? (
                    <p className="mt-3 text-sm text-gray-400">{uiText("Choose a kid to view activity details.")}</p>
                  ) : recentActivities.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-400">{uiText("No completed items recorded for this kid yet.")}</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-3">{uiText("Item")}</th>
                            <th className="px-4 py-3">{uiText("Category")}</th>
                            <th className="px-4 py-3">{uiText("Completed")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentActivities.map((activity) => (
                            <tr
                              key={`${activity.item_id}-${activity.completed_at}`}
                              className="border-t border-gray-100"
                            >
                              <td className="px-4 py-3 font-medium text-gray-800">
                                {activity.item_title}
                              </td>
                              <td className="px-4 py-3 capitalize text-gray-600">
                                {activity.item_category}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {new Date(activity.completed_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      {uiText("Friendships")}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {uiText("All family-family, family-kid, kid-family, and kid-kid relationships involving this family.")}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {selectedFamily.friend_requests.length} {uiText("links")}</span>
                </div>

                {selectedFamily.friend_requests.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-400">{uiText("No friendship links recorded for this family.")}</p>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3">{uiText("From ")}{"->"} {uiText(" To")}</th>
                          <th className="px-4 py-3">{uiText("Type")}</th>
                          <th className="px-4 py-3">{uiText("Status")}</th>
                          <th className="px-4 py-3">{uiText("Created")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFamily.friend_requests.map((request) => (
                          <tr key={request.id} className="border-t border-gray-100 align-top">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{formatFromTo(request)}</div>
                              <div className="mt-1 text-xs text-gray-500">
                                {request.requesting_family_name} {"->"} {request.target_family_name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{formatRequestScope(request)}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${requestStatusClass(
                                  request.status,
                                )}`}
                              >
                                {request.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {new Date(request.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        </aside>
      )}
      {selectedFamily && settingPassword && <SetFamilyPasswordDialog key={selectedFamily.id} familyId={selectedFamily.id}
        familyName={selectedFamily.display_name} onClose={() => setSettingPassword(false)}
        onSaved={() => { setSettingPassword(false); setPasswordNotice(`Password updated for ${selectedFamily.display_name}. Their previous sessions have ended.`); }} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{uiText(label)}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function KidCard({
  profile,
  learning,
  selected,
  onClick,
}: {
  profile: AdminFamilyProfileSummary;
  learning: ChildReport | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  useUiLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-xl border p-3 text-left transition ${
        selected
          ? "border-gray-900 bg-gray-900 text-white shadow-lg"
          : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <ProfileAvatar size="md" profile={learning ? { ...learning, avatar_url: learning.avatar_url ?? undefined } : profile}/>
        <div className="min-w-0">
          <p className={`font-semibold ${selected ? "text-white" : "text-gray-800"}`}>{profile.name}</p>
          {profile.public_id && (
            <p className={`mt-1 font-mono text-xs ${selected ? "text-gray-200" : "text-gray-500"}`}>
              {profile.public_id}
            </p>
          )}
          <p className={`mt-1 text-xs ${selected ? "text-gray-300" : "text-gray-400"}`}>
            {learning?.exploring_completed ?? profile.total_done} {uiText('items explored')} · {learning?.earned_badges ?? profile.badge_count} {uiText('badges earned')}
          </p>
        </div>
      </div>
    </button>
  );
}
