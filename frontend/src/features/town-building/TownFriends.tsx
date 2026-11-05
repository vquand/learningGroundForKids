import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useLocation,useNavigate,useSearchParams} from 'react-router-dom';
import {ProfileAvatar} from '../../components/ProfileAvatar';
import {fetchFriendTowns,type FriendTown} from '../../api/townVisits';
import {familyQueryKey,familyScopedQuery} from '../../lib/familyQueries';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText,uiMessage} from '../../i18n/uiText';
import {townDisplayName} from '../../../../server/src/town-building/game';
import {CivPicture,PROSPERITY_ART} from './civArt';
import {LakeStageArt} from './maps/lake/LakeArt';
import {LockIcon} from './TownActionIcons';
import './townVisits.css';

export function TownLevel({stage}:{stage:0|1|2|3}) {
  return <span className="town-friend-level" role="img" aria-label={uiText(['A seed for a new town','Your town is sprouting','Your town is budding','Your town is blooming'][stage]!)}>
    <CivPicture atlas={PROSPERITY_ART} index={stage}/>
  </span>;
}
export function TownFriendsButton({viewerId,family,currentTownId,disabled=false,onOpen,onClose}:{viewerId:string;family:string|null;currentTownId?:string;disabled?:boolean;onOpen?:()=>void;onClose?:()=>void}) {
  useUiLanguage();
  const [open,setOpen]=useState(false),[,setParams]=useSearchParams(),location=useLocation(),navigate=useNavigate();
  const close=()=>{setOpen(false);onClose?.();};
  function visit(id?:string){setOpen(false);if(location.pathname.startsWith('/town-building/lake'))navigate(`/town-building${id?'?visit='+encodeURIComponent(id):''}`);else setParams(id?{visit:id}:{});}
  return <>
    <button type="button" className="town-visit-button kid-nav-action" aria-label={uiText('Visit friends')} title={uiText('Visit friends')} aria-haspopup="dialog" disabled={disabled} onClick={()=>{onOpen?.();setOpen(true);}}>
      <svg className="town-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="2" strokeLinejoin="round"><path d="m2 14 8-8 8 8v13H3V14Z" fill="#d9e7c3"/><path d="m16 12 7-7 8 7v15H18V14" fill="#c5dfe8"/><path d="M8 27v-8h5v8m10 0v-9h5v9" fill="#fff5dc"/><path d="m12 5 4-3 4 3" strokeLinecap="round"/></svg>
    </button>
    {open&&<TownFriendsDialog viewerId={viewerId} family={family} currentTownId={currentTownId} onClose={close} onVisit={visit}/>}
  </>;
}
function TownFriendsDialog({viewerId,family,currentTownId,onClose,onVisit}:{viewerId:string;family:string|null;currentTownId?:string;onClose:()=>void;onVisit:(id?:string)=>void}) {
  const language=useUiLanguage(),dialog=useRef<HTMLDialogElement>(null),[offset,setOffset]=useState(0);
  const query=useQuery({queryKey:familyQueryKey('town-friends',family,viewerId,offset),queryFn:familyScopedQuery(family,()=>fetchFriendTowns(viewerId,offset)),retry:false,gcTime:0,staleTime:0});
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="town-visit-dialog" aria-labelledby="town-visit-title" onClose={onClose}>
    <header><h2 id="town-visit-title">{uiText('Visit a friend’s town')}</h2><button type="button" onClick={onClose} aria-label={uiText('Close')}>×</button></header>
    <div className="town-friend-list" aria-busy={query.isFetching}>
      {query.isPending?<p role="status">{uiText('Finding your friends’ towns…')}</p>:query.isError?<div role="alert"><p>{uiText('We could not find your friends’ towns. Please try again.')}</p><button type="button" onClick={()=>void query.refetch()}>{uiText('Try again')}</button></div>:query.data.towns.length===0?<p>{uiText('No friend towns yet. Ask your parent to connect with a friend.')}</p>:<><div className="town-friend-columns"><span className="town-friend-stages"><span className="town-friend-column-icon" role="img" aria-label={uiText('Town')} title={uiText('Town')}><svg className="town-icon" viewBox="0 0 48 40" aria-hidden="true" fill="none" stroke="#70513b" strokeWidth="2" strokeLinejoin="round"><path d="M3 19 12 11l9 8v17H3Z" fill="#d9e7c3"/><path d="m27 19 9-8 9 8v17H27Z" fill="#c5dfe8"/><path d="M14 13 24 3l10 10v23H14Z" fill="#f2d5ad"/><path d="M9 36v-9h5v9m19 0v-9h5v9M21 36V24h6v12" fill="#fff5dc"/><path d="M21 13h6v6h-6Z" fill="#c5dfe8"/></svg></span><span className="town-friend-column-icon" role="img" aria-label={uiText('Lake')} title={uiText('Lake')}><svg className="town-icon" viewBox="0 0 48 40" aria-hidden="true" fill="none" stroke="#70513b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22C3 10 17 7 27 10c4-6 16-2 17 5 10 15-3 22-20 22C12 37 2 33 3 22Z" fill="#c5dfe8"/><path d="M12 23h8m6 6h9m-12-12h7" stroke="#7da7ac"/><path d="M6 14V5m0 5L2 6m4 2 4-5" stroke="#829269"/></svg></span></span></div><ul>
        {query.data.towns.map(town=><FriendTownRow key={town.profile.id} town={town} current={town.profile.id===currentTownId} onVisit={()=>onVisit(town.profile.id)}/>)}
      </ul></>}
    </div>
    <footer>
      {currentTownId&&<button type="button" className="town-return-home" onClick={()=>onVisit()}>{uiText('Back to my town')}</button>}
      <nav aria-label={uiText('Friend town pages')}><button type="button" disabled={offset===0||query.isFetching} onClick={()=>setOffset(Math.max(0,offset-6))}>{uiText('Previous')}</button><span>{(Math.floor(offset/6)+1).toLocaleString(language)}</span><button type="button" disabled={query.isFetching||query.data?.nextOffset==null||query.isError} onClick={()=>setOffset(query.data!.nextOffset!)}>{uiText('Next')}</button></nav>
    </footer>
  </dialog>;
}
function FriendTownRow({town,current,onVisit}:{town:FriendTown;current:boolean;onVisit:()=>void}) {
  const p=town.profile;
  return <li className="town-friend-row">
    <ProfileAvatar profile={{emoji:p.emoji,color:p.color,avatar_type:p.avatar_type??undefined,avatar_url:p.avatar_url??undefined,avatar_frame:p.avatar_frame}} size="lg"/>
    <strong className="town-friend-name" title={p.name}>{p.name}</strong>
    <span className="town-friend-town" title={townDisplayName(town)}>{townDisplayName(town)}</span><span className="town-friend-stages"><TownLevel stage={town.prosperityStage}/><FriendLakeLevel stage={town.lakeStage??null}/></span>
    <button type="button" disabled={current} aria-label={uiMessage('Visit {name}’s town',{name:p.name})} onClick={onVisit}>{uiText(current?'Visiting':'Visit')}</button>
  </li>;
}
function FriendLakeLevel({stage}:{stage:0|1|2|null}){
  const label=uiText(stage===null?'Lake locked':['Lake · Egg stage','Lake · Small fish stage','Lake · Chubby fish stage'][stage]!);
  return <span className={`town-friend-lake ${stage===null?'is-locked':''}`} role="img" aria-label={label} title={label}><LakeStageArt stage={stage??0}/>{stage===null&&<span className="town-friend-lake-lock"><LockIcon/></span>}</span>;
}
