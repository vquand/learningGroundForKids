import {useEffect,useId,useRef,useState} from 'react';
import type {TownResponse} from '../../api/town';
import {fetchTownDevelopment} from '../../api/development';
import type {DevelopmentProject} from '../../../../server/src/town-building/development';
import {BLUEPRINTS,MATERIALS} from '../../../../server/src/town-building/game';
import {LAKE_BLUEPRINTS,LAKE_FISH} from '../../../../server/src/town-building/water/catalog';
import {BlueprintArt,MaterialArt} from './TownArt';
import {LakeArt,LakeStageArt} from './maps/lake/LakeArt';
import {CivPicture,PROSPERITY_ART} from './civArt';
import {CloseIcon} from './TownActionIcons';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText,uiMessage} from '../../i18n/uiText';
import './developmentBoard.css';
export function DevelopmentBoard({state,profileId,map,open,onClose}:{state:TownResponse;profileId:string;map:'town'|'lake';open:boolean;onClose:()=>void}) {
    useUiLanguage();
    const ref=useRef<HTMLDialogElement>(null),title=useId();
    const [project,setProject]=useState<DevelopmentProject|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false);
    useEffect(()=>{if(!open)return;let alive=true;setLoading(true);setError(false);void fetchTownDevelopment(profileId).then(value=>{if(alive)setProject(value[map]??null);},()=>{if(alive)setError(true);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[open,profileId,map]);
    useEffect(()=>{if(open&&!ref.current?.open)ref.current?.showModal();else if(!open)ref.current?.close();},[open]);
    const stages=map==='town'?['Seed','Sprout','Bud','Flower']:['Fish egg','Small fish','Chubby fish'];
    const stage=project?.nextStage??project?.stage??0;
    return <dialog ref={ref} className="town-development-board" aria-labelledby={title} onCancel={event=>{event.preventDefault();onClose();}} onClose={()=>{if(open)onClose();}}>
      <header><div className="development-stage" aria-hidden="true">{map==='town'?<CivPicture atlas={PROSPERITY_ART} index={stage}/>:<LakeStageArt stage={stage}/>}</div><div><p>{uiText('Community project board')}</p><h2 id={title}>{uiText(map==='town'?'Growing our Town':'Growing our lake')}</h2></div><button className="development-close" aria-label={uiText('Close project board')} title={uiText('Close project board')} onClick={onClose}><CloseIcon/></button></header>
      {loading?<p className="development-intro">{uiText('Preparing your project board…')}</p>:error||!project?<p className="development-intro">{uiText('Project details are unavailable. Close this board and try again.')}</p>:project.nextStage===null?<div className="development-complete"><h3>{uiText('All growth stages complete!')}</h3><p>{uiText(map==='town'?'Your Town is blooming. Follow the river arrow to develop your lake!':'Your lake is happy and thriving. Keep welcoming fish and growing water plants!')}</p></div>:<>
        <p className="development-intro">{uiMessage('Next stage: {stage}',{stage:uiText(stages[project.nextStage]!)})}<br/><small>{uiText(map==='town'?'Here is one project to reach the next stage. Other business combinations can work too.':'Complete these goals to reach the next stage.')}</small></p>
        <ul className="development-goals">{project.goals.map(goal=>{
          const done=goal.have>=goal.need,b=BLUEPRINTS.find(b=>b.id===goal.blueprintId),lakeB=LAKE_BLUEPRINTS.find(b=>b.id===goal.lakeBlueprintId);
          return <li key={goal.id} data-complete={done}><div className="development-goal-art" aria-hidden="true">{b?<BlueprintArt blueprint={b}/>:lakeB?<LakeArt index={lakeB.art} garden={lakeB.id==='floating-garden'}/>:goal.fishId?<LakeArt fish index={LAKE_FISH[goal.fishId].art*4+2}/>:<span>{done?'✓':'☆'}</span>}</div><div className="development-goal-copy"><div className="development-goal-heading"><strong>{uiText(goal.label)}</strong><span aria-label={uiMessage('{count} of {total}',{count:goal.have,total:goal.need})}>{done?'✓':`${goal.have}/${goal.need}`}</span></div>{goal.hint&&<p>{uiText(goal.hint)}</p>}{goal.cost&&<div className="development-cost" aria-label={uiText('Materials to build')}>{MATERIALS.filter(m=>(goal.cost![m]??0)>0).map(m=><span key={m} title={uiMessage('{material}: need {need}, owned {owned}',{material:uiText(m),need:goal.cost![m]!,owned:state.materials[m]})}><MaterialArt material={m}/><b>{goal.cost![m]}</b></span>)}</div>}</div></li>;
        })}</ul>
      </>}
      <footer><p>{uiText('Take it one little project at a time.')}</p><button onClick={onClose}>{uiText("Let's build!")}</button></footer>
    </dialog>;
}
