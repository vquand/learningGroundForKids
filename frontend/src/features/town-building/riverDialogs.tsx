import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText,uiMessage} from '../../i18n/uiText';
import {BASKET_DECORATIONS,BASKET_DECORATION_NAMES,BASKET_MESSAGES,type BasketDecoration,type BasketInbox,type BasketVisitor} from '../../../../server/src/town-building/basketCatalog';
import {type RaftItem} from '../../../../server/src/town-building/raftCatalog';
import {GiftArt,RiverArt,giftArtIndex,RiverItemArt,riverItemName} from './riverArt';
import type {TownRiverController} from './useTownRiver';
import {RiverReportPanel,RiverStats} from './riverStats';

export function RiverDialog({river}:{river:TownRiverController}){
 useUiLanguage();const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 const title=river.panel==='basket'?'River basket':river.panel==='visitors'?'While you were away…':'River raft';
 return <dialog ref={ref} className="town-river-dialog" aria-labelledby="river-dialog-title" onClose={river.close} onCancel={e=>{if(river.busy)e.preventDefault();}}>
  <header><h2 id="river-dialog-title">{river.panel==='basket'?<GiftArt index={0}/>:<RiverArt index={river.panel==='visitors'?1:0}/>} {uiText(title)}</h2><button type="button" aria-label={uiText('Close')} disabled={river.busy} onClick={river.close}>×</button></header>
  {river.panel!=='basket'&&!river.target&&<div className="town-river-tabs" role="group" aria-label={uiText('Raft pages')}>{(['raft','visitors','stats'] as const).map((tab,i)=><button type="button" key={tab} aria-pressed={river.panel===tab} onClick={()=>river.setPanel(tab)}><RiverArt index={[0,1,5][i]!}/>{uiText(['Sharing raft','Visitors','River diary'][i]!)}</button>)}</div>}
  {river.error&&<p role="alert" className="town-river-error">{uiText(river.error)}</p>}
  {river.panel==='basket'?<BasketPanel river={river}/>:river.raft.isPending?<p role="status">{uiText('Checking the sharing raft…')}</p>:river.raft.isError?<Retry retry={()=>void river.raft.refetch()}/>:river.panel==='visitors'?<RiverReportPanel report={river.raft.data?.report}/>:river.panel==='stats'?<RiverStats days={river.raft.data?.days??[]}/>:<RaftPanel river={river}/>}
 </dialog>;
}
function BasketPanel({river}:{river:TownRiverController}){
 if(river.basket.isPending)return <p role="status">{uiText('Checking the little basket…')}</p>;
 if(river.basket.isError)return <Retry retry={()=>void river.basket.refetch()}/>;
 if(river.target)return <GiftComposer river={river} state={river.basket.data as BasketVisitor}/>;
 const data=river.basket.data as BasketInbox;
 if(river.gift)return <div className="town-river-reveal"><GiftArt index={giftArtIndex[river.gift.decoration]}/><h3>{uiMessage('A surprise from {name}',{name:river.gift.senderName})}</h3><blockquote>{uiText(BASKET_MESSAGES[river.gift.message]!)}</blockquote><p>{uiText('This basket stays on the river for five days after delivery.')}</p><button type="button" onClick={river.close}>{uiText('Lovely!')}</button></div>;
 return <><p className="town-river-intro">{uiText('Friendly surprises are waiting on the river.')}</p><div className="town-basket-inbox">{(data.pending??[]).length?(data.pending??[]).map(g=><div className="town-basket-letter" key={g.id}><GiftArt index={0}/><strong>{uiMessage('From {name}',{name:g.senderName})}</strong><button type="button" disabled={river.busy} onClick={()=>void river.open(g.id)}>{uiText('Open surprise')}</button></div>):<div className="town-river-empty"><GiftArt index={1}/><p>{uiText('Your basket is waiting for a friendly surprise!')}</p></div>}</div>
  <footer><button type="button" disabled={river.busy||river.offset===0} onClick={()=>river.setOffset(Math.max(0,river.offset-5))}>{uiText('Previous')}</button><span>{Math.floor(river.offset/5)+1}</span><button type="button" disabled={river.busy||data.nextOffset==null} onClick={()=>river.setOffset(data.nextOffset!)}>{uiText('Next')}</button></footer></>;
}
function GiftComposer({river,state}:{river:TownRiverController;state:BasketVisitor}){
 const [decoration,setDecoration]=useState<BasketDecoration>('flowers'),[message,setMessage]=useState(0),[requestId]=useState(crypto.randomUUID());
 if(river.sent||!state.canSend)return <div className="town-river-reveal"><GiftArt index={0}/><h3>{uiText(river.sent?'Your surprise is waiting on the river!':state.reason==='waiting'?'Your surprise is still waiting to be opened.':state.reason==='full'?'This basket is full. Try another day.':'You can leave another surprise tomorrow.')}</h3><button type="button" onClick={river.close}>{uiText('Done')}</button></div>;
 return <><p className="town-river-intro">{uiText('Choose a little decoration and a friendly message.')}</p>
  <fieldset className="town-gift-decorations"><legend>{uiText('A little decoration')}</legend>{BASKET_DECORATIONS.map(d=><button type="button" disabled={river.busy} key={d} aria-pressed={decoration===d} onClick={()=>setDecoration(d)}><GiftArt index={giftArtIndex[d]}/><span>{uiText(BASKET_DECORATION_NAMES[d])}</span></button>)}</fieldset>
  <fieldset className="town-gift-messages"><legend>{uiText('A friendly message')}</legend>{BASKET_MESSAGES.map((m,i)=><button type="button" disabled={river.busy} key={m} aria-pressed={message===i} onClick={()=>setMessage(i)}>{uiText(m)}</button>)}</fieldset>
  <footer><span>{uiText('One surprise per friend each day. Free and just for fun!')}</span><button type="button" className="town-river-primary" disabled={river.busy} onClick={()=>void river.send({requestId,decoration,message})}>{uiText(river.busy?'Sending…':'Leave surprise')}</button></footer>
 </>;
}
function groupRaftItems(items:RaftItem[]){
 const groups=new Map<string,{kind:RaftItem['kind'];itemId:string;ids:string[]}>();
 for(const item of items){const key=item.kind+':'+item.itemId,group=groups.get(key)??{kind:item.kind,itemId:item.itemId,ids:[]};group.ids.push(item.id);groups.set(key,group);}
 return [...groups.values()];
}
function RaftPanel({river}:{river:TownRiverController}){
 const [page,setPage]=useState(0),[selected,setSelected]=useState<string[]>([]),attempt=useRef<{key:string;id:string}|null>(null);
 const state=river.raft.data,items=state?.items??[],groups=groupRaftItems(items),available=new Set(items.map(item=>item.id)),chosen=selected.filter(id=>available.has(id));
 useEffect(()=>{setPage(p=>Math.min(p,Math.max(0,Math.ceil(groups.length/5)-1)));},[groups.length]);
 if(river.raft.isPending)return <p role="status">{uiText('Checking the sharing raft…')}</p>;
 if(river.raft.isError||!state)return <Retry retry={()=>void river.raft.refetch()}/>;
 if(!state.unlocked)return <div className="town-river-reveal"><RiverArt index={0}/><h3>{uiText('Catch 50 fish with your own fishing rod to unlock this raft.')}</h3><strong className="town-raft-progress"><RiverArt index={2}/>{state.fishCaught} / 50</strong><p>{uiText('Only fish you catch yourself while fishing count. Fish from rafts do not. Once unlocked, it stays yours!')}</p><Link className="town-raft-fishing-link" to="/fishing">{uiText('Go fishing now')}</Link></div>;
 const empty=<div className="town-river-empty"><RiverArt index={0}/><p>{uiText('The raft is waiting for freshly caught fish and harvested vegetables.')}</p></div>;
 function add(group:typeof groups[number]){const next=group.ids.find(id=>!chosen.includes(id));if(next&&chosen.length<Math.min(5,state!.remainingToday))setSelected([...chosen,next]);}
 function remove(group:typeof groups[number]){const id=[...group.ids].reverse().find(id=>chosen.includes(id));if(id)setSelected(chosen.filter(value=>value!==id));}
 function pickup(){const key=[...chosen].sort().join(':');if(!attempt.current||attempt.current.key!==key)attempt.current={key,id:crypto.randomUUID()};void river.pick(chosen,attempt.current.id);}
 return <><p className="town-river-intro">{river.target?uiMessage('{count} of 30 pickups left today',{count:state.remainingToday}):uiMessage('{count} of 10 river spots filled',{count:items.length})}</p>
  {river.target?<><p className="town-river-intro">{uiText('Tap to add one. Choose up to five items.')}</p><div className="town-raft-inventory">
   <div className="town-raft-grid" aria-label={uiText('Available river items')}>{groups.length?groups.map(group=>{const count=group.ids.filter(id=>chosen.includes(id)).length,name=uiText(riverItemName(group.kind,group.itemId));return <div className="town-raft-tile" key={group.kind+group.itemId}>
    <button type="button" className="town-raft-add" aria-label={uiMessage('Add {name}',{name})} aria-pressed={count>0} disabled={river.busy||count===group.ids.length||chosen.length>=Math.min(5,state.remainingToday)} onClick={()=>add(group)}><RiverItemArt kind={group.kind} itemId={group.itemId}/><strong>{name}</strong><b className="town-raft-quantity">×{group.ids.length}</b>{count>0&&<span className="town-raft-selected-count">{uiMessage('{count} selected',{count})}</span>}</button>
   </div>;}):empty}</div>
   <aside className="town-raft-basket" aria-label={uiText('Your pickup basket')}><header><GiftArt index={1}/><strong>{uiText('Your basket')}</strong><b>{chosen.length} / 5</b></header><div className="town-raft-basket-items">{groups.filter(group=>group.ids.some(id=>chosen.includes(id))).map(group=><div key={group.kind+group.itemId}><RiverItemArt kind={group.kind} itemId={group.itemId}/><span title={uiText(riverItemName(group.kind,group.itemId))}>×{group.ids.filter(id=>chosen.includes(id)).length}</span><button type="button" disabled={river.busy} aria-label={uiMessage('Remove one {name} from basket',{name:uiText(riverItemName(group.kind,group.itemId))})} onClick={()=>remove(group)}>−</button></div>)}</div></aside>
  </div><footer><span>{uiText('Today and yesterday only. Daily limit resets at 00:00 UTC.')}</span><button type="button" className="town-river-primary" disabled={river.busy||chosen.length===0||chosen.length>state.remainingToday} onClick={pickup}>{uiText('Pick up')} ({chosen.length})</button></footer></>:<>
   <div className="town-raft-stock">{groups.length?groups.slice(page*5,page*5+5).map(group=><div className="town-raft-row" key={group.kind+group.itemId}><RiverItemArt kind={group.kind} itemId={group.itemId}/><strong>{uiText(riverItemName(group.kind,group.itemId))}</strong><b className="town-raft-owner-quantity">×{group.ids.length}</b></div>):empty}</div>
   <footer><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>{uiText('Previous')}</button><span>{uiText('Today and yesterday only. Daily limit resets at 00:00 UTC.')}</span><button type="button" disabled={groups.length<=(page+1)*5} onClick={()=>setPage(p=>p+1)}>{uiText('Next')}</button></footer>
  </>}
 </>;
}
function Retry({retry}:{retry:()=>void}){return <div className="town-river-empty" role="alert"><p>{uiText('We could not reach the river. Please try again.')}</p><button type="button" onClick={retry}>{uiText('Try again')}</button></div>;}
