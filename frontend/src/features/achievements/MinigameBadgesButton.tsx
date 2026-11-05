import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProfileAchievementGroups } from '../../api/achievementCatalog';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { AchievementBadgeArt } from './AchievementBadgeArt';
import { BadgeCard, BadgeCollection } from './BadgeCollection';
import { BadgesIconButton } from './BadgesIconButton';
import '../../components/kidControls.css';
import './minigameBadges.css';

/** A read-only, profile-owned collection. Games retain control of their pause state. */
export function MinigameBadgesButton({ groupIds, disabled = false, onOpen,onClose }: {
  groupIds: readonly string[]; disabled?: boolean; onOpen?: () => void;onClose?:()=>void;
}) {
  const familyId = useFamilyStore(state => state.familyId);
  const profileId = useProfileStore(state => state.activeProfileId);
  const generation = useFamilyStore(state => state.sessionGeneration);
  return <BadgesButton key={`${generation}:${familyId}:${profileId}`} groupIds={groupIds} disabled={disabled} onOpen={onOpen} onClose={onClose} familyId={familyId} profileId={profileId} />;
}

function BadgesButton({ groupIds, disabled, onOpen,onClose, familyId, profileId }: {
  groupIds: readonly string[]; disabled: boolean; onOpen?: () => void;onClose?:()=>void;
  familyId: string | null; profileId: string | null;
}) {
  useUiLanguage();
  const [open, setOpen] = useState(false), [page, setPage] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null), button = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const query = useQuery({
    queryKey: familyQueryKey('achievements', familyId, profileId, 'minigame-groups'),
    queryFn: familyScopedQuery(familyId, () => fetchProfileAchievementGroups(profileId!)),
    enabled: open && Boolean(familyId && profileId), staleTime: 0, retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  const groups = query.data?.filter(group => groupIds.includes(group.id)) ?? [];
  const badges = groups.flatMap(group => group.achievements.map(badge => ({ ...badge, earnable: group.earning === 'server-verified' })));
  const pages = Math.max(1, Math.ceil(badges.length / 3));
  const currentPage = Math.min(page, pages - 1);
  const earned = badges.filter(badge => badge.earnable && badge.earned).length;
  function close() { dialog.current?.close(); setOpen(false); button.current?.focus({ preventScroll: true });onClose?.(); }
  return <>
    <BadgesIconButton ref={button} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => { onOpen?.(); setPage(0); setOpen(true); }} />
    {open && createPortal(<dialog ref={dialog} className="minigame-badges-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => event.stopPropagation()}>
      <header className="minigame-badges-heading"><div><h2 id={titleId}>{uiText('Badges')}</h2><p>{groups.map(group => uiText(group.name)).join(' · ')}</p></div><button type="button" className="kid-nav-action" onClick={close} aria-label={uiText('Close badges')}>×</button></header>
      {!familyId || !profileId ? <p role="status">{uiText('Choose a profile to view your badges.')}</p>
        : query.isFetching ? <p role="status">{uiText('Loading badges...')}</p>
        : query.isError ? <div role="alert"><p>{uiText('Could not load badges. Please try again.')}</p><button type="button" className="kid-nav-action" onClick={() => void query.refetch()}>{uiText('Try again')}</button></div>
        : badges.length === 0 ? <p role="status">{uiText('No badges are available for this game yet.')}</p>
        : <>
          <p className="minigame-badges-summary">{uiMessage('{earned} of {total} earned', { earned, total: badges.length })}</p>
          {groups.some(group => group.earning === 'catalog-only') && <p className="minigame-badges-note">{uiText('These badges are not yet earnable. Progress is unavailable.')}</p>}
          <BadgeCollection>{badges.slice(currentPage * 3, currentPage * 3 + 3).map(badge => <BadgeCard key={badge.id}
            art={<AchievementBadgeArt source={badge.badge} index={badge.badgeIndex ?? 0} columns={badge.badgeColumns ?? 1} rows={badge.badgeRows ?? 1} />}
            name={uiText(badge.name)} description={uiText(badge.description)} difficulty={uiText(badge.difficulty)}
            earned={badge.earnable && badge.earned} status={<>{uiText(!badge.earnable ? 'Not yet earnable' : badge.earned ? 'Earned' : 'Not yet earned')}{badge.current !== undefined && <> · {badge.current}/{badge.target}</>}</>} />)}</BadgeCollection>
          <nav className="minigame-badges-pagination" aria-label={uiText('Badge pages')}>
            <button type="button" className="kid-nav-action" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{uiText('Previous')}</button>
            <span role="status">{uiMessage('Page {page} of {total}', { page: currentPage + 1, total: pages })}</span>
            <button type="button" className="kid-nav-action" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>{uiText('Next')}</button>
          </nav>
        </>}
    </dialog>, document.body)}
  </>;
}
