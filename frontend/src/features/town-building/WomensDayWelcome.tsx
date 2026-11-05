import {useEffect,useRef,useState} from 'react';
import type {TownState} from '../../../../server/src/town-building/game';
import {womensDayRecord,womensDayIntroSeen} from '../../../../server/src/town-building/events/womensDay2026Model';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText} from '../../i18n/uiText';
import {WOMENS_DAY_CARDS} from './womensDayCards';
import {WOMENS_DAY_BLOB_ART} from './womensDayArt';
import './womensDay.css';
import {useTownRelaxing} from './TownRelaxingView';
export function WomensDayWelcome({events,localDate,ready,requested,onDismiss}:{events:TownState['events'];localDate:string;ready:boolean;requested:boolean;onDismiss:()=>void}){
 useUiLanguage();const dialog=useRef<HTMLDialogElement>(null),[dismissed,setDismissed]=useState<string[]>([]);
 const relaxing=useTownRelaxing();
 const active=womensDayRecord(events,localDate),day=Number(localDate.slice(-2)) as 19|20|21,card=WOMENS_DAY_CARDS[day];
 const open=Boolean(!relaxing&&ready&&active&&card&&(requested||!womensDayIntroSeen(events,localDate)&&!dismissed.includes(localDate)));
 useEffect(()=>{const element=dialog.current;if(open&&!element?.open)element?.showModal();else if(!open&&element?.open)element.close();},[open]);
 const dismiss=()=>{if(!open)return;setDismissed(previous=>[...previous,localDate]);onDismiss();};
 if(!card)return null;
 return <dialog ref={dialog} className="town-celebration-card" aria-labelledby="slime-card-title" aria-describedby="slime-card-body" onCancel={event=>{event.preventDefault();dismiss();}} onClose={dismiss}>
  <div className="town-celebration-card-inner" data-event-day={day}>
   <span className="town-celebration-card-date">{day}/10</span>
   <div className="town-celebration-card-art" aria-hidden="true">{[1,0,2].map(index=><svg key={index} viewBox={WOMENS_DAY_BLOB_ART.crops[index]!.join(' ')}><image href={WOMENS_DAY_BLOB_ART.source} width={WOMENS_DAY_BLOB_ART.width} height={WOMENS_DAY_BLOB_ART.height}/></svg>)}</div>
   <h2 id="slime-card-title">{uiText(card.title)}</h2><p id="slime-card-body">{uiText(card.body)}</p>
   <button type="button" autoFocus onClick={dismiss}>{uiText(card.button)}</button>
  </div>
 </dialog>;
}
