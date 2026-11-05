import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAchievementCatalog, migrateAchievementCatalog, type AchievementGroup } from '../../api/achievementCatalog';
import { AchievementBadgeArt } from '../../features/achievements/AchievementBadgeArt';
import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
export function AdminAchievementsPage() {
  useUiLanguage();
  const [groups, setGroups] = useState<AchievementGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    void fetchAchievementCatalog().then(value => { if (alive) setGroups(value); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Unable to load achievements.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);
  async function migrate() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await migrateAchievementCatalog();
      setGroups(result.groups);
      setMessage(result.migratedGroups === 0
        ? uiText('All achievement definitions are already up to date.')
        : uiMessage('{count} achievement definitions synced across {groups} {groupLabel}. Earned badges and player progress preserved.', {
            count: result.installed, groups: result.migratedGroups, groupLabel: uiText(result.migratedGroups === 1 ? 'group' : 'groups'),
          }));
    } catch (e) { setError(e instanceof Error ? e.message : uiText('Migration failed. You can retry safely.')); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-gray-50 px-4 pb-12 pt-6 sm:px-8"><div className="mx-auto max-w-7xl">
    <Link to="/admin" className="text-sm text-blue-600 hover:underline">{uiText("← Back to Dashboard")}</Link>
    <h1 className="mt-2 text-2xl font-bold text-gray-800">{uiText("Achievements")}</h1>
    <p className="mt-1 text-sm text-gray-600">{uiText("Reviewed minigame badges, unlock conditions, and difficulty levels.")}</p>
    <div className="mt-4 flex flex-wrap gap-3"><AdminRefreshButton refreshing={loading} disabled={busy} onRefresh={() => {
      setMessage(''); setReload(value => value + 1);
    }} /><button type="button" disabled={loading || busy || groups.length === 0} onClick={() => { void migrate(); }} className="min-h-11 rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-gray-700 disabled:opacity-50">{busy ? uiText("Migrating…") : uiText("Migrate achievement data")}</button></div>
    {error && <div className="my-4 rounded-lg border border-red-200 bg-red-50 p-4"><p role="alert" className="text-red-800">{error}</p><button type="button" onClick={() => setReload(value => value + 1)} disabled={!!busy} className="mt-2 min-h-11 rounded-md border border-red-300 px-4 text-sm font-semibold">{uiText("Reload catalog")}</button></div>}
    {message && <p role="status" className="my-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{message}</p>}
    {loading ? <p role="status" className="my-6">{uiText("Loading achievements…")}</p> : groups.length === 0 && !error ? <p className="my-6">{uiText("No achievement groups yet.")}</p> : groups.map(group => <section key={group.id} className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="mb-4"><div>
        <h2 className="text-xl font-bold text-gray-800">{uiText(group.name)}</h2>
        <p className="text-sm text-gray-600">{group.installed}/{group.achievements.length} {uiText(" definitions current · ")}{group.needsMigration ? uiText("Migration needed") : uiText("Up to date")} · {group.earning === 'server-verified' ? uiText("Earnable") : uiText("Catalog only")}</p>
      </div></div>
      <p className="mb-5 text-sm text-gray-600">{group.earning === 'server-verified'
        ? uiText("Installs or updates definitions automatically. Safe to repeat; earned badges and player progress are preserved. Badges unlock through server-verified gameplay.")
        : uiText("Installs or updates reviewed badge definitions. Earning is not active until this minigame has server-verified progress.")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{group.achievements.map(achievement => <article key={achievement.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-center">
        {achievement.badgeIndex === undefined ? <img src={achievement.badge} alt="" width="96" height="96" className="mx-auto" /> : <AchievementBadgeArt source={achievement.badge} index={achievement.badgeIndex} columns={achievement.badgeColumns ?? 1} rows={achievement.badgeRows ?? 1} />}
        <h3 className="mt-2 font-bold text-gray-800">{uiText(achievement.name)}</h3>
        <p className="my-2 text-xs font-semibold uppercase tracking-wide text-amber-900">{uiText(achievement.difficulty)}</p>
        <p className="text-sm text-gray-700">{uiText(achievement.description)}</p>
      </article>)}</div>
    </section>)}
  </div></main>;
}
