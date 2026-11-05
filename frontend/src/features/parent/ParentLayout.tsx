import { FamilyOnboarding } from '../../components/FamilyOnboarding';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useParentAccess } from '../../components/ParentGate';
import { useFamilyStore } from '../../stores/familyStore';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { clearParentQueryCache } from '../../lib/parentQueryCache';
import './parentSpace.css';

const navigation = [
  ['/parent', 'Dashboard', '◫'], ['/parent/children', 'Children', '♧'],
  ['/parent/achievements', 'Achievements', '✧'], ['/parent/lists', 'Content lists', '▤'],
  ['/parent/schedule', 'Adventure schedule', '◷'], ['/parent/friends', 'Family links', '↔'], ['/parent/settings', 'Settings', '⚙'],
] as const;

export function ParentLayout() {
  useUiLanguage();
  const familyName = useFamilyStore(state => state.familyName);
  const familyId = useFamilyStore(state => state.familyId);
  const generation = useFamilyStore(state => state.sessionGeneration);
  return <ParentShell key={`${familyId}:${generation}`} familyName={familyName} />;
}
function ParentShell({ familyName }: { familyName: string | null }) {
  useUiLanguage();
  const access = useParentAccess();
  const cache = useQueryClient();
  const location = useLocation();
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState('');
  const section = navigation.find(([path]) => path !== '/parent' && location.pathname.startsWith(path)) ?? navigation[0];
  async function lock() {
    setLocking(true); setError('');
    try { await access.lock(); await clearParentQueryCache(cache); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to lock Parent Space. Please try again.'); }
    finally { setLocking(false); }
  }
  return <div className="parent-space">
    <a className="parent-skip" href="#parent-main">{uiText('Skip to content')}</a>
    <aside className="parent-sidebar">
      <Link className="parent-brand" to="/parent"><span aria-hidden="true">⌂</span><span>{uiText('Parent Space')}<small>{familyName ?? uiText('Your family')}</small></span></Link>
      <nav aria-label={uiText('Parent navigation')}>{navigation.map(([path, label, icon]) => <NavLink key={path} to={path} end={path === '/parent'}><span aria-hidden="true">{icon}</span>{uiText(label)}</NavLink>)}</nav>
      <div className="parent-sidebar-footer"><p>{uiText('A little perspective on their big discoveries.')}</p><Link to="/">{uiText('Back to profile picker')} <span aria-hidden="true">↗</span></Link></div>
    </aside>
    <div className="parent-body">
      <header className="parent-toolbar"><nav aria-label={uiText('Breadcrumb')}><Link to="/parent">{uiText('Parent Space')}</Link><span aria-hidden="true">/</span><span>{uiText(section[1])}</span></nav><button className="parent-button parent-button-quiet" type="button" disabled={locking} onClick={() => void lock()}>{locking ? uiText('Locking…') : uiText('Lock parent space')}</button></header>
      {error && <p className="parent-alert" role="alert">{error}</p>}
      <main id="parent-main" className="parent-content"><FamilyOnboarding parentSpace /><Outlet /></main>
    </div>
  </div>;
}
