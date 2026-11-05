import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchProfiles } from '../../api/profiles';
import { fetchFriendRequests, createFriendRequest, respondFriendRequest } from '../../api/social';
import { FriendRequestModal } from '../../components/ProfilePicker/FriendRequestModal';
import { FriendRequestDecisionModal } from '../../components/ProfilePicker/FriendRequestDecisionModal';
import { familyScopedQuery, profileQueryKey } from '../../lib/familyQueries';
import { friendRequestQueryKey } from '../../lib/friendRequestNotifications';
import { useFamilyStore } from '../../stores/familyStore';
import { useParentRequests } from '../../hooks/useParentRequests';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { CreateFriendRequestInput, FriendRequest } from '../../types/social';
import { ParentHeading } from './ParentReportViews';

export function ParentFriends() {
  useUiLanguage();
  const familyId = useFamilyStore(state => state.familyId), cache = useQueryClient();
  const requests = useParentRequests();
  const [creating, setCreating] = useState(false), [decision, setDecision] = useState<FriendRequest | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: friendRequestQueryKey(familyId), queryFn: familyScopedQuery(familyId, fetchFriendRequests), enabled: !!familyId });
  const profiles = useQuery({ queryKey: profileQueryKey(familyId), queryFn: familyScopedQuery(familyId, fetchProfiles), enabled: !!familyId });
  const rows = (query.data ?? []).filter(request => request.requesting_family_id === familyId || request.target_family_id === familyId);
  const incoming = rows.filter(request => request.target_family_id === familyId && request.status === 'pending');
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
  async function act(request: () => Promise<unknown>) {
    await requests.run(request, { start: () => { setBusy(true); setError(''); }, success: () => { setCreating(false); setDecision(null); void cache.invalidateQueries({ queryKey: friendRequestQueryKey(familyId) }); }, error: caught => setError(caught instanceof Error ? caught.message : 'Could not update friend request'), finish: () => setBusy(false) });
  }
  const create = (input: CreateFriendRequestInput) => void act(() => createFriendRequest(input));
  const respond = (request: FriendRequest, accept: boolean) => void act(() => respondFriendRequest(request.id, accept));
  return <><ParentHeading title="Family links" description="Connect with other families, and review who can share learning with yours." action={<button className="parent-button" onClick={() => { setError(''); setCreating(true); }}>{uiText('Add Friend')}</button>} />
    {query.isPending && <p role="status">{uiText('Loading family links…')}</p>}{query.error && <div className="parent-alert" role="alert">{query.error.message}<button className="parent-button parent-button-quiet" onClick={() => void query.refetch()}>{uiText('Try again')}</button></div>}
    {error && !creating && !decision && <p className="parent-alert" role="alert">{error}</p>}
    {incoming.length > 0 && <section className="parent-panel"><h2>{uiText('Pending Requests')}</h2><div className="parent-request-list">{incoming.map(request => <article key={request.id}><p>{request.requester_message}</p><div className="parent-form-actions"><button className="parent-button" disabled={busy} onClick={() => { setError(''); setDecision(request); }}>{uiText('Accept')}</button><button className="parent-button parent-button-quiet" disabled={busy} onClick={() => respond(request, false)}>{uiText('Reject')}</button></div></article>)}</div></section>}
    <section className="parent-panel"><h2>{uiText('Friendship activity')}</h2>{!query.isPending && !rows.length && <div className="parent-empty">{uiText('No friendship activity yet.')}</div>}<div className="parent-request-list">{rows.slice((page - 1) * 10, page * 10).map(request => <article key={request.id}><strong>{request.requesting_label} → {request.target_label}</strong><span className={`parent-request-status is-${request.status}`}>{uiText(request.status)}</span><p>{uiText(request.requesting_scope === 'family' ? 'Family' : 'Child')} → {uiText(request.target_scope === 'family' ? 'Family' : 'Child')}</p></article>)}</div>{pageCount > 1 && <div className="parent-form-actions"><button className="parent-button parent-button-quiet" disabled={page === 1} onClick={() => setParams({ page: String(page - 1) })}>{uiText('Previous')}</button><span>{uiText('Page')} {page} / {pageCount}</span><button className="parent-button parent-button-quiet" disabled={page === pageCount} onClick={() => setParams({ page: String(page + 1) })}>{uiText('Next')}</button></div>}</section>
    {creating && <FriendRequestModal profiles={profiles.data ?? []} onClose={() => setCreating(false)} onSubmit={create} isSubmitting={busy} errorMessage={error || null} requireQuiz={false} />}
    {decision && <FriendRequestDecisionModal request={decision} onClose={() => setDecision(null)} onReject={() => respond(decision, false)} onAccept={() => respond(decision, true)} isSubmitting={busy} errorMessage={error || null} />}
  </>;
}
