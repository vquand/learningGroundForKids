import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { adminFetchFamilyReports, adminFetchProfile } from "../../api/admin";
import { AdminActivityHistory, AdminProfileJourney, ReportError } from "../../components/admin/AdminProfileReports";
import { useFamilyStore } from "../../stores/familyStore";
import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
import { AdminChildLearning } from '../../components/admin/AdminFamilyLearning';

export function AdminProfilePage() {
  useUiLanguage();
  const { familyId, profileId } = useParams();
  const sessionGeneration = useFamilyStore((state) => state.sessionGeneration);
  const adminId = useFamilyStore((state) => state.familyId);
  if (!familyId || !profileId) return <p role="alert">{uiText("A family and profile are required.")}</p>;
  return <ProfileInspection key={`${adminId}:${sessionGeneration}:${familyId}:${profileId}`}
    familyId={familyId} profileId={profileId} scope={["admin-inspection", adminId, sessionGeneration, familyId, profileId]} />;
}

function ProfileInspection({ familyId, profileId, scope }: { familyId: string; profileId: string; scope: readonly unknown[] }) {
  useUiLanguage();
  const cache = useQueryClient();
  const fetching = useIsFetching({ queryKey: scope });
  const profile = useQuery({ queryKey: [...scope, "profile"], retry: false,
    queryFn: ({ signal }) => adminFetchProfile(familyId, profileId, signal) });
  const learning = useQuery({ queryKey: [...scope, 'learning'], retry: false, enabled: !!profile.data,
    queryFn: ({ signal }) => adminFetchFamilyReports(familyId, signal) });
  const child = learning.data?.children.find(child => child.id === profileId);
  return <main className="min-h-screen bg-gray-50 px-4 pb-24 pt-6 sm:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/admin/families/${encodeURIComponent(familyId)}`} className="text-sm text-blue-700 hover:underline">{uiText("← Back to family")}</Link>
        <AdminRefreshButton refreshing={fetching > 0} onRefresh={() => { void cache.refetchQueries({ queryKey: scope, type: 'active' }); }} />
      </div>
      {profile.isPending && <p role="status" className="py-6">{uiText("Loading profile...")}</p>}
      {profile.error && <ReportError error={profile.error} retry={() => { void profile.refetch(); }} />}
      {profile.data && <>
        <header className="my-6 break-words">
          <h1 className="text-2xl font-bold text-gray-900">{profile.data.emoji} {profile.data.name}</h1>
          <p className="mt-1 text-gray-700">{profile.data.family_name}</p>
          <p className="font-mono text-sm text-gray-600">{profile.data.public_id}</p>
          <p className="mt-1 text-sm text-gray-600">{uiText("Read-only learner profile · Created ")}{new Date(profile.data.created_at).toLocaleDateString()}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Completed items", profile.data.total_done], ["Badges", profile.data.badge_count],
              ["Quiz attempts", profile.data.quiz_attempt_count], ["Flashcard sessions", profile.data.flashcard_session_count]].map(([label, value]) =>
                <div key={label} className="rounded-md border border-gray-200 bg-white p-3"><dt className="text-sm text-gray-600">{label}</dt><dd className="mt-1 text-xl font-semibold text-gray-900">{value}</dd></div>)}
          </dl>
        </header>
        {learning.isPending && <p role="status" className="my-4">{uiText('Loading learning progress…')}</p>}
        {learning.error && <ReportError error={learning.error} retry={() => { void learning.refetch(); }} />}
        {child && !learning.error && <div className="my-6"><AdminChildLearning child={child} /></div>}
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <AdminProfileJourney familyId={familyId} profileId={profileId} scope={scope} />
          <AdminActivityHistory familyId={familyId} profileId={profileId} scope={scope} />
        </div>
      </>}
    </div>
  </main>;
}
