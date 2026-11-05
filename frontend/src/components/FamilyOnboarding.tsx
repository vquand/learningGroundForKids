import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { fetchFriendRequests } from '../api/social';
import { friendRequestQueryKey } from '../lib/friendRequestNotifications';
import { fetchProfiles } from '../api/profiles';
import { dismissOnboarding, fetchOnboarding, visitParentSpace } from '../api/onboarding';
import { useFamilyStore } from '../stores/familyStore';
import { familyQueryKey, familyScopedQuery, profileQueryKey } from '../lib/familyQueries';
import { useParentRequests } from '../hooks/useParentRequests';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import './familyOnboarding.css';

interface FamilyOnboardingProps {
  parentSpace?: boolean;
  onAddChild?: () => void;
  onAddFriends?: () => void;
}

export function FamilyOnboarding({ parentSpace = false, onAddChild, onAddFriends }: FamilyOnboardingProps) {
  useUiLanguage();
  const familyId = useFamilyStore(state => state.familyId);
  const active = useFamilyStore(state => state.session?.onboarding === true);
  const cache = useQueryClient();
  const location = useLocation();
  const requests = useParentRequests();
  const visitRequests = useParentRequests();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const key = familyQueryKey('family-onboarding', familyId);
  const status = useQuery({ queryKey: key, queryFn: familyScopedQuery(familyId, fetchOnboarding), enabled: active && !!familyId, staleTime: 0 });
  const profiles = useQuery({ queryKey: profileQueryKey(familyId), queryFn: familyScopedQuery(familyId, fetchProfiles), enabled: active && !!familyId });
  const friends = useQuery({ queryKey: friendRequestQueryKey(familyId), queryFn: familyScopedQuery(familyId, fetchFriendRequests), enabled: active && !!familyId });
  const profilesUpdated = profiles.dataUpdatedAt;
  const friendsUpdated = friends.dataUpdatedAt;
  useEffect(() => {
    if (active) void cache.invalidateQueries({ queryKey: familyQueryKey('family-onboarding', familyId) });
  }, [active, familyId, profilesUpdated, friendsUpdated, cache]);
  useEffect(() => {
    if (!active || !parentSpace) return;
    void visitRequests.run(() => visitParentSpace(), {
      success: () => { void cache.invalidateQueries({ queryKey: familyQueryKey('family-onboarding', familyId) }); setError(''); },
      error: () => setError('We couldn’t save this setup step. Please try again.'),
    });
  }, [active, parentSpace, familyId, visitRequests, cache, retry]);
  async function dismiss() {
    await requests.run(() => dismissOnboarding(), {
      start: () => { setPending(true); setError(''); },
      success: () => {
        // Callback is guarded against logout, family switches and parent locking.
        cache.setQueryData(key, status.data ? { ...status.data, dismissed: true } : undefined);
        useFamilyStore.setState(state => {
          if (!state.session) return {};
          const session = { ...state.session };
          delete session.onboarding;
          return { session };
        });
      },
      error: () => setError('We couldn’t hide the checklist. Please try again.'),
      finish: () => setPending(false),
    });
  }
  if (!active || (parentSpace && location.pathname !== '/parent') || status.data?.dismissed) return null;
  const data = status.data;
  const steps = data ? [
    { title: 'Create kid profiles', description: 'Give each child their own explorer and saved discoveries.', to: '/parent/children/new', action: 'Add Child', done: data.child_created, onClick: onAddChild },
    { title: 'Add child friends', description: 'Send a friend request using a friend’s code to connect your children.', to: '/parent/friends', action: 'Add friends', done: data.friend_request_created, onClick: onAddFriends },
    { title: 'Visit Parent Space', description: 'See reports, choose learning content, and manage your family.', to: '/parent', action: 'Open Parent Space', done: data.parent_visited, onClick: undefined },
  ] : [];
  const complete = steps.length > 0 && steps.every(step => step.done);
  return <section className="family-onboarding" aria-labelledby="family-onboarding-title">
    <div className="family-onboarding-heading"><div><h2 id="family-onboarding-title">{uiText('Welcome to your family’s learning world')}</h2><p>{uiText('A few small steps, then you’re ready to explore together.')}</p></div><button type="button" disabled={pending} onClick={() => void dismiss()}>{uiText('Skip')}</button></div>
    {data && <><p className="family-onboarding-count" role="status">{steps.filter(step => step.done).length}/{steps.length} {uiText('steps completed')}</p><ol>{steps.map(step => <li key={step.title} data-complete={step.done}><span className="family-onboarding-check" aria-label={uiText(step.done ? 'Completed' : 'To do')}>{step.done ? '✓' : '○'}</span><div><h3>{uiText(step.title)}</h3><p>{uiText(step.description)}</p>{step.onClick ? <button type="button" className="family-onboarding-action" onClick={step.onClick}>{uiText(step.done ? 'Review' : step.action)} <span aria-hidden="true">→</span></button> : <Link to={step.to}>{uiText(step.done ? 'Review' : step.action)} <span aria-hidden="true">→</span></Link>}</div></li>)}</ol>{complete && <button className="family-onboarding-finish" type="button" disabled={pending} onClick={() => void dismiss()}>{uiText('Finish setup')}</button>}</>}
    {status.isPending && <p role="status">{uiText('Loading your checklist…')}</p>}
    {(error || status.isError) && <p role="alert">{uiText(error || 'We couldn’t load your checklist. Please try again.')} <button type="button" onClick={() => { setRetry(value => value + 1); void status.refetch(); }}>{uiText('Try again')}</button></p>}
  </section>;
}
