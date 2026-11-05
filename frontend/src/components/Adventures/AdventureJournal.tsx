import { useEffect,useRef } from 'react';
import { createPortal } from 'react-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchAdventures } from '../../api/adventures';
import { useFamilyStore } from '../../stores/familyStore';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { familyQueryKey,familyScopedQuery } from '../../lib/familyQueries';
import { ProfileAvatar } from '../ProfileAvatar';
import { ActivityIcon } from '../ActivityIcon';
import { isAvatarFrameId } from '../../lib/avatarFrames';
import { adventureCopy } from './adventureCopy';
import './adventures.css';
export const ADVENTURE_ICON='/illustrations/adventures/journal-v1.webp';
function AdventureStream({profileId,scope}:{profileId:string;scope:'mine'|'friends'}){
  const language=useUiLanguage();
  const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const familyId=useFamilyStore(state=>state.familyId);
  const generation=useFamilyStore(state=>state.sessionGeneration);
  const feed=useInfiniteQuery({
    queryKey:familyQueryKey('adventures',familyId,generation,profileId,scope,language,timeZone),
    initialPageParam:null as string|null,
    queryFn:({pageParam})=>familyScopedQuery(familyId,()=>fetchAdventures(profileId,scope,language,pageParam,timeZone))(),
    getNextPageParam:page=>page.next_cursor,
    enabled:!!familyId,refetchOnMount:'always',retry:false,
  });
  const entries=feed.data?.pages.flatMap(page=>page.entries)??[];
  return <section className="adventure-stream" aria-labelledby={`adventures-${scope}`}>
    <h3 id={`adventures-${scope}`}>{uiText(scope==='mine'?'Your adventures':'Friends’ adventures')}</h3>
    {feed.isPending&&<p role="status">{uiText('Opening your adventure journal…')}</p>}
    {feed.isError&&<div role="alert"><p>{uiText('We couldn’t load these adventures. Please try again.')}</p><button type="button" onClick={()=>void feed.refetch()}>{uiText('Try again')}</button></div>}
    {!feed.isPending&&!feed.isError&&entries.length===0&&<p className="adventure-empty">{uiText(scope==='mine'?'Your next discovery starts a new story. Play a game to add an adventure!':'Friends’ new adventures will appear here once you connect and they play.')}</p>}
    <ol>{entries.map(entry=><li key={entry.id}>
      <div className="adventure-actor"><ProfileAvatar profile={{emoji:entry.profile.emoji,color:entry.profile.color,avatar_type:entry.profile.avatar_type==='custom'?'custom':'default',avatar_url:entry.profile.avatar_url??undefined,...(isAvatarFrameId(entry.profile.avatar_frame)?{avatar_frame:entry.profile.avatar_frame}:{})}} size="sm"/><span>{entry.profile.name}</span><span className="adventure-game-icon"><ActivityIcon activity={entry.game}/></span></div>
      <p>{adventureCopy(entry)}</p>
      <time dateTime={entry.occurred_at}>{new Intl.DateTimeFormat(language==='vi'?'vi-VN':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(entry.occurred_at))}</time>
    </li>)}</ol>
    {feed.hasNextPage&&<button type="button" disabled={feed.isFetchingNextPage} onClick={()=>void feed.fetchNextPage()}>{uiText(feed.isFetchingNextPage?'Loading…':'Older adventures')}</button>}
  </section>;
}
export function AdventureJournal({profileId,onClose}:{profileId:string;onClose:()=>void}){
  useUiLanguage();
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const previous=document.activeElement;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const element=dialog.current;
    element?.showModal();
    return ()=>{element?.close();document.body.style.overflow=previousOverflow;if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return createPortal(<dialog ref={dialog} className="adventure-journal" aria-labelledby="adventure-journal-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <header><img src={ADVENTURE_ICON} alt=""/><div><h2 id="adventure-journal-title">{uiText('Latest Adventures')}</h2><p>{uiText('Little discoveries, big stories.')}</p></div><button type="button" onClick={onClose} aria-label={uiText('Close adventure journal')}>×</button></header>
    <div className="adventure-journal-body"><AdventureStream profileId={profileId} scope="mine"/><AdventureStream profileId={profileId} scope="friends"/></div>
  </dialog>,document.body);
}
