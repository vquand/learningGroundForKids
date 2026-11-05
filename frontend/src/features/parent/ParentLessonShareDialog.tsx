import { useEffect, useRef, useState } from 'react';
import { shareParentLesson } from '../../api/parent';
import { useParentRequests } from '../../hooks/useParentRequests';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { ParentLessonSummary, ParentShareTargetFamily } from '../../types/parent';

export function ParentLessonShareDialog({ lesson, targets, loading, targetError, onClose, onSaved }: {
  lesson: ParentLessonSummary; targets: ParentShareTargetFamily[]; loading: boolean;
  targetError: string | null; onClose: () => void; onSaved: () => void;
}) {
  useUiLanguage();
  const dialog = useRef<HTMLDialogElement>(null), requests = useParentRequests();
  const [scope, setScope] = useState<'family' | 'profile'>('family');
  const [family, setFamily] = useState(''), [profile, setProfile] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const target = targets.find(target => target.family_id === family);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (!family && targets.length) setFamily(targets[0]!.family_id); }, [family, targets]);
  useEffect(() => { setProfile(target?.profiles[0]?.id ?? ''); }, [target]);
  async function save() {
    await requests.run(() => shareParentLesson(lesson.id, scope, family, scope === 'profile' ? profile : undefined), {
      start: () => { setBusy(true); setError(''); }, success: onSaved,
      error: caught => setError(caught instanceof Error ? caught.message : 'Could not share lesson'), finish: () => setBusy(false),
    });
  }
  return <dialog className="parent-dialog" ref={dialog} aria-labelledby="parent-share-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className="parent-section-heading"><h2 id="parent-share-title">{uiText('Share Lesson')}</h2><button type="button" className="parent-button parent-button-quiet" disabled={busy} onClick={onClose}>{uiText('Close')}</button></div><p>{lesson.title}</p>
    {loading && <p role="status">{uiText('Loading sharing destinations…')}</p>}
    {targetError && <p className="parent-alert" role="alert">{targetError}</p>}
    <form className="parent-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label>{uiText('Share with')}<select className="parent-input" value={scope} onChange={event => setScope(event.target.value as 'family' | 'profile')} disabled={busy}><option value="family">{uiText('Whole family')}</option><option value="profile">{uiText('One child')}</option></select></label>
      <label>{uiText('Target family')}<select className="parent-input" value={family} onChange={event => setFamily(event.target.value)} disabled={busy || !targets.length}>{targets.map(target => <option key={target.family_id} value={target.family_id}>{target.family_name}</option>)}</select></label>
      {scope === 'profile' && <label>{uiText('Child')}<select className="parent-input" value={profile} onChange={event => setProfile(event.target.value)} disabled={busy}>{(target?.profiles ?? []).map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>}
      {error && <p className="parent-alert" role="alert">{error}</p>}
      <div className="parent-form-actions"><button type="button" className="parent-button parent-button-quiet" disabled={busy} onClick={onClose}>{uiText('Cancel')}</button><button className="parent-button" disabled={busy || !family || (scope === 'profile' && !profile)}>{busy ? uiText('Sharing...') : uiText('Share Lesson')}</button></div>
    </form>
  </dialog>;
}
