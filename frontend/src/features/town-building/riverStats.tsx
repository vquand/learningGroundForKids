import {useState} from 'react';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText,uiMessage} from '../../i18n/uiText';
import type {RiverReport,RiverDay,RiverVisitSummary} from '../../../../server/src/town-building/raftCatalog';
import {GiftArt,RiverArt,giftArtIndex,RiverItemArt,riverItemName} from './riverArt';
export function RiverReportPanel({report}:{report:RiverReport|undefined}){
 const [page,setPage]=useState(0),[detail,setDetail]=useState<RiverVisitSummary|null>(null),[itemPage,setItemPage]=useState(0),rows=report?.visitors??[];
 if(detail)return <><h3 className="town-river-detail-title">{uiMessage('Shared with {name}',{name:detail.visitor.name})}</h3><div className="town-raft-stock">{detail.items.slice(itemPage*5,itemPage*5+5).map(item=><div className="town-raft-row" key={item.kind+item.itemId}><RiverItemArt kind={item.kind} itemId={item.itemId}/><strong>{uiText(riverItemName(item.kind,item.itemId))} ×{item.count}</strong></div>)}</div><footer><button type="button" onClick={()=>setDetail(null)}>{uiText('Back')}</button><button type="button" disabled={itemPage===0} onClick={()=>setItemPage(p=>p-1)}>{uiText('Previous')}</button><button type="button" disabled={(itemPage+1)*5>=detail.items.length} onClick={()=>setItemPage(p=>p+1)}>{uiText('Next')}</button></footer></>;
 return <><div className="town-river-totals"><RiverArt index={4}/><strong>+{report?.stamina??0}</strong><span>{uiText('stamina earned')}</span><RiverArt index={2}/><strong>{report?.items??0}</strong><span>{uiText(report?.items===1?'item shared':'items shared')}</span></div>
  {rows.length?<div className="town-river-visits">{rows.slice(page*3,page*3+3).map((row,i)=><article className="town-river-visit" key={`${row.visitor.id}-${i}`}><header><RiverArt index={1}/><strong>{row.visitor.name}</strong><span>{uiMessage(row.visits===1?'{count} visit':'{count} visits',{count:row.visits})}</span><span className="town-river-earned"><RiverArt index={4}/>+{row.stamina}</span></header><div className="town-river-visit-actions">
    <span className="town-river-left">{row.gifts>0?<><GiftArt index={giftArtIndex[(row.giftDecorations[0]??'flowers') as keyof typeof giftArtIndex]??0}/>{uiMessage(row.gifts===1?'Left {count} surprise':'Left {count} surprises',{count:row.gifts})}</>:<><GiftArt index={5}/>{uiText('No surprise left')}</>}</span>
    {row.items.length?<span className="town-river-taken">{uiText('Took')}{row.items.slice(0,4).map(item=><span key={item.kind+item.itemId} title={uiText(riverItemName(item.kind,item.itemId))}><RiverItemArt kind={item.kind} itemId={item.itemId}/><b>×{item.count}</b></span>)}{row.items.length>4&&<span>{uiMessage('+{count} more kinds',{count:row.items.length-4})}</span>}</span>:<span>{uiText('Just a friendly visit')}</span>}
    {row.items.length>0&&<button type="button" className="town-river-see-items" onClick={()=>{setItemPage(0);setDetail(row);}}>{uiText('See items')}</button>}
   </div></article>)}</div>:<div className="town-river-empty"><RiverArt index={1}/><p>{uiText('No river visits yet. Your friends are welcome any time!')}</p></div>}
  <footer><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>{uiText('Previous')}</button><span>{uiText('Your most recent return-to-town story')}</span><button type="button" disabled={(page+1)*3>=rows.length} onClick={()=>setPage(p=>p+1)}>{uiText('Next')}</button></footer>
 </>;
}
export function RiverStats({days}:{days:RiverDay[]}){
 const language=useUiLanguage(),sum=(key:'stamina'|'items'|'visits')=>days.reduce((n,d)=>n+d[key],0);
 return <><p className="town-river-intro">{uiText('Your last seven river days')}</p><div className="town-river-stat-cards">{(['stamina','items','visits'] as const).map((key,i)=><div key={key}><RiverArt index={[4,3,1][i]!}/><strong>{sum(key).toLocaleString(language)}</strong><span>{uiText(['Stamina earned','Items given away','Friendly visits'][i]!)}</span></div>)}</div>
  <div className="town-river-charts"><CrayonChart days={days} metric="stamina"/><CrayonChart days={days} metric="items"/></div>
 </>;
}
function CrayonChart({days,metric}:{days:RiverDay[];metric:'stamina'|'items'}){
 const language=useUiLanguage(),max=Math.max(1,...days.map(d=>d[metric])),colors=['#df9baf','#e9bf68','#8fb899','#9fc7db','#b7a0cf','#e6a879','#92bcb1'];
 return <figure className="town-crayon-chart"><figcaption><RiverArt index={metric==='stamina'?4:3}/>{uiText(metric==='stamina'?'Stamina earned':'Items given away')}</figcaption><svg viewBox="0 0 390 230" role="img" aria-label={uiText(metric==='stamina'?'Stamina earned over seven days':'Items shared over seven days')}>
  <path d="M23 15 21 186 374 188M25 16 24 183 375 185" fill="none" stroke="#8d7058" strokeWidth="2.5" strokeLinecap="round"/>
  {days.map((d,i)=>{const x=34+i*47,h=d[metric]/max*130,y=181-h,label=new Intl.DateTimeFormat(language==='vi'?'vi-VN':'en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(d.day+'T12:00:00Z'));return <g key={d.day}><title>{`${d.day}: ${d[metric]}`}</title><path d={`M${x} 182 ${x+1} ${y+2} ${x+31} ${y} ${x+33} 181Z`} fill={colors[i%7]} stroke={colors[i%7]} strokeWidth="6" strokeLinejoin="round"/><path d={`M${x+4} 181 ${x+3} ${y+4}M${x+28} ${y+4} ${x+30} 179`} stroke="#fff8" strokeWidth="2" strokeLinecap="round"/><text x={x+16} y={Math.max(17,y-10)} textAnchor="middle">{d[metric]}</text><text x={x+16} y="213" textAnchor="middle">{label}</text></g>;})}
 </svg></figure>;
}
