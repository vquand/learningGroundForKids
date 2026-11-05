import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createProfile, fetchProfiles } from '../../api/profiles';
import { useFamilyStore } from '../../stores/familyStore';
import { familyQueryKey, familyScopedQuery, profileQueryKey } from '../../lib/familyQueries';
import { useParentRequests } from '../../hooks/useParentRequests';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { ParentHeading, ParentReportStatus, ChildAvatar } from './ParentReportViews';
import { ParentPasskeySettings } from '../../components/ParentPasskeySettings';
import { GooglePasswordSettings } from '../../components/GoogleAuth/GooglePasswordSettings';
import { ChildFriendCode } from '../../components/ChildFriendCode';

export function ParentChildren() {
  useUiLanguage();
  return <><ParentHeading title="Children" description="Each child has a profile, a growing collection, and a story of their own." action={<Link className="parent-button" to="/parent/children/new">+ {uiText('Add Child')}</Link>} /><ParentReportStatus>{report => report.children.length ? <div className="parent-children-grid">{report.children.map(child => <article className="parent-panel parent-profile-card" key={child.id}><ChildAvatar child={child} /><h2>{child.name}</h2><p>{child.exploring_completed} {uiText('items explored')} · {child.earned_badges} {uiText('badges earned')}</p><ChildFriendCode name={child.name} code={child.public_id} /><Link className="parent-button parent-button-quiet" to={`/parent/children/${encodeURIComponent(child.id)}`}>{uiText('View report')} ↗</Link></article>)}</div> : <div className="parent-panel parent-empty"><h2>{uiText('Room for their first discoveries')}</h2><p>{uiText('Add your first child to begin their learning journey.')}</p><Link className="parent-button" to="/parent/children/new">{uiText('Add Child')}</Link></div>}</ParentReportStatus></>;
}
export function ParentAddChild() {
  useUiLanguage();
  const navigate = useNavigate(), cache = useQueryClient();
  const familyId = useFamilyStore(state => state.familyId);
  const requests = useParentRequests();
  const [name, setName] = useState(''), [emoji, setEmoji] = useState('⭐'), [color, setColor] = useState('#6a8a65');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const profiles = useQuery({ queryKey: profileQueryKey(familyId), queryFn: familyScopedQuery(familyId, fetchProfiles), enabled: !!familyId });
  async function save() {
    await requests.run(async isCurrent => {
      const child = await createProfile({name:name.trim(),emoji,color});
      if (isCurrent()) await Promise.all([
        cache.invalidateQueries({queryKey:profileQueryKey(familyId)}),
        cache.invalidateQueries({queryKey:familyQueryKey('parent-reports',familyId),refetchType:'all'}),
      ]);
      return child;
    }, {
      start: () => { setBusy(true); setError(''); },
      success: child => navigate(`/parent/children/${encodeURIComponent(child.id)}`),
      error: caught => setError(caught instanceof Error ? caught.message : 'Could not create child'), finish: () => setBusy(false),
    });
  }
  return <><Link className="parent-back" to="/parent/children">← {uiText('Children')}</Link><ParentHeading title="Add Child" description="Start with a name and a little personality. They can personalize their avatar later." /><form className="parent-panel parent-form" onSubmit={event => { event.preventDefault(); void save(); }}><label>{uiText('Name')}<input className="parent-input" required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label><label>{uiText('Emoji')}<input className="parent-input" required maxLength={12} value={emoji} onChange={event => setEmoji(event.target.value)} /></label><label>{uiText('Color')}<input className="parent-input" type="color" value={color} onChange={event => setColor(event.target.value)} /></label>{error && <p role="alert" className="parent-alert">{error}</p>}{(profiles.data?.length ?? 0) >= 5 && <p>{uiText('Your family already has five child profiles.')}</p>}<div className="parent-form-actions"><Link className="parent-button parent-button-quiet" to="/parent/children">{uiText('Cancel')}</Link><button className="parent-button" disabled={busy || !name.trim() || (profiles.data?.length ?? 0) >= 5}>{busy ? uiText('Creating...') : uiText('Create Child')}</button></div></form></>;
}

export function ParentLists() {
  useUiLanguage();
  return <><ParentHeading title="Content lists" description="Choose what your family explores, and shape the puzzles they practise." /><div className="parent-list-hubs">
    <Link className="parent-panel parent-list-hub" to="/parent/lists/exploring"><span aria-hidden="true">◎</span><h2>{uiText('Exploring content')}</h2><p>{uiText('Browse system items, adjust availability, and create or share family lessons.')}</p><strong>{uiText('Manage items')} ↗</strong></Link>
    <Link className="parent-panel parent-list-hub" to="/parent/lists/miniku"><span aria-hidden="true">▦</span><h2>{uiText('Miniku puzzles')}</h2><p>{uiText('Create family puzzles, edit clues, and choose whether number hints are shown.')}</p><strong>{uiText('Manage puzzles')} ↗</strong></Link>
  </div><section className="parent-panel"><h2>{uiText('About the other activities')}</h2><p className="parent-report-note">{uiText('The other games use their own built-in content and progression. Their saved numbers and badge collections are available in child reports and achievements.')}</p><div className="parent-form-actions"><Link className="parent-button parent-button-quiet" to="/parent/children">{uiText('View child reports')}</Link><Link className="parent-button parent-button-quiet" to="/parent/achievements">{uiText('View achievements')}</Link></div></section></>;
}
export function ParentSettings() {
  useUiLanguage();
  return <><ParentHeading title="Parent settings" description="Keep Parent Space protected, and choose how you sign in." /><section className="parent-panel parent-account-settings"><GooglePasswordSettings /><ParentPasskeySettings /></section></>;
}
