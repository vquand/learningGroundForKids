import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../../stores/profileStore';
import { useFamilyStore } from '../../stores/familyStore';
import { KidBackButton } from '../../components/KidBackButton';
import { TownRewardBar } from '../town-building/TownRewardBar';
import { MinigameBadgesButton } from '../achievements/MinigameBadgesButton';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText, uiMessage } from '../../i18n/uiText';
import { ANIMALS, ANIMAL_NAMES, type Animal, type Language } from '../../../../server/src/road-racing/questions';
import { ROAD_ACHIEVEMENTS } from '../../../../server/src/road-racing/achievements';
import type { RacingDifficulty } from '../../../../server/src/road-racing/game';
import { AchievementBadgeArt } from '../achievements/AchievementBadgeArt';
import { useRacingSession } from './useRacingSession';
import { RacingAnimal } from './RacingArt';
import { RacingScene } from './RacingScene';
import { RacingPodium } from './RacingPodium';
import { RacingQuiz } from './RacingQuiz';
import './racing.css';
export function RacingSession({profileId}:{profileId:string}) {
  const uiLanguage=useUiLanguage(),navigate=useNavigate(),game=useRacingSession(profileId);
  const [animal,setAnimal]=useState<Animal>('capybara'),[language,setLanguage]=useState<Language>('en'),[difficulty,setDifficulty]=useState<RacingDifficulty>('easy'),[setup,setSetup]=useState(false),[cardReady,setCardReady]=useState(false);
  const race=game.state?.race,running=race?.status==='racing',dialog=useRef<HTMLDialogElement>(null);
  const previousEarned=useRef<string[]>([]);
  useEffect(()=>{if(game.state&&!running)previousEarned.current=Object.keys(game.state.earned);},[game.state?.race?.id]);
  useEffect(()=>{setCardReady(false);const timer=setTimeout(()=>setCardReady(true),200);return()=>clearTimeout(timer);},[race?.question.id]);
  useEffect(()=>{if(!setup&&race?.status==='forfeited')dialog.current?.showModal();else dialog.current?.close();},[setup,race?.status]);
  useEffect(()=>{
    function key(e:KeyboardEvent){if(e.repeat||!running||game.busy||!cardReady||!['1','2','3'].includes(e.key))return;if((e.target as HTMLElement)?.closest('input,select,textarea,dialog'))return;e.preventDefault();void game.send({type:'answer',questionId:race!.question.id,choice:Number(e.key)-1});}
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[running,game.busy,cardReady,race?.question.id,game.send]);
  async function back(){await game.leave();navigate('/playground');}
  function replay(){dialog.current?.close();setSetup(true);}
  const header=<header className="kid-nav racing-nav"><KidBackButton onClick={()=>void back()}/><h1>{uiText('Road Racing')}</h1><TownRewardBar {...game.rewardReceipt} source=".racing-track, .racing-podium" onOpenStorage={()=>void game.leave()}/><MinigameBadgesButton groupIds={['road-racing']} disabled={running}/></header>;
  if(!game.state)return <div className="racing-page">{header}<main className="racing-loading"><h2>{uiText('Your friends are warming up…')}</h2>{game.error&&<><p role="alert">{uiText(game.error)}</p><button onClick={()=>void game.sync()} className="kid-nav-action">{uiText('Try again')}</button></>}</main></div>;
  const choose=setup||!race;
  const newBadges=ROAD_ACHIEVEMENTS.filter(a=>game.state!.earned[a.id]&&!previousEarned.current.includes(a.id));
  return <div className="racing-page">{header}
    {game.error&&<p className="racing-error" role="alert">{uiText(game.error)} <button type="button" onClick={()=>void game.sync()}>{uiText('Try again')}</button></p>}
    {choose?<main className="racing-setup">
      <div className="racing-setup-heading"><span className="racing-eyebrow">{uiText('Seven friends. One finish line.')}</span><h2>{uiText('Who’s ready to zoom?')}</h2><p>{uiText('Pick your racer. Quick answers give little bursts of speed.')}</p></div>
      <div className="racing-friends" role="group" aria-label={uiText('Choose your racer')}>{ANIMALS.map(friend=><button type="button" key={friend} className={animal===friend?'is-selected':''} aria-pressed={animal===friend} onClick={()=>setAnimal(friend)}><RacingAnimal animal={friend}/><span>{ANIMAL_NAMES[friend][uiLanguage==='vi'?1:0]}</span><b aria-hidden="true">{animal===friend?'✓':''}</b></button>)}</div>
      <div className="racing-setup-bottom"><div className="racing-how"><h3>{uiText('Little answers. Big zooms.')}</h3><p>{uiText('First-try answers boost your friend. Two wrong tries slow them down.')}</p><p>{uiText('Leaving the race means starting again.')}</p></div>
        <fieldset className="racing-difficulty"><legend>{uiText('Choose your difficulty')}</legend>{([
          ['easy','🥚','Egg','Easy'],['medium','🐣','Hatched','Medium'],['hard','🐔','Chicken','Hard'],
        ] as const).map(([value,icon,name,level])=><button type="button" key={value} aria-pressed={difficulty===value} onClick={()=>setDifficulty(value)}><span aria-hidden="true">{icon}</span><strong>{uiText(name)}</strong><small>{uiText(level)}</small></button>)}</fieldset>
        <fieldset className="racing-learning"><legend>{uiText('Question language')}</legend>{(['en','vi'] as const).map(lang=><button type="button" key={lang} aria-label={lang==='en'?uiText('English'):'Tiếng Việt'} aria-pressed={language===lang} onClick={()=>setLanguage(lang)}><span className={`racing-country-ball ${lang}`} aria-hidden="true"/></button>)}</fieldset>
        <button type="button" className="racing-primary" disabled={game.busy} onClick={()=>{setSetup(false);previousEarned.current=Object.keys(game.state!.earned);void game.start({animal,language,difficulty});}}>{uiText(game.busy?'Getting ready…':'Let’s race!')} <span aria-hidden="true">→</span></button>
      </div><p className="racing-setup-note">{uiText('About two minutes · Land, water & little rocks · Finish to collect rewards')}</p>
    </main>:<main className="racing-game">
      {race.status==='finished'?<RacingPodium race={race}/>:<RacingScene key={race.id} race={race} receivedAt={game.receivedAt}/>}
      {running?<RacingQuiz race={race} busy={game.busy||!cardReady} answer={choice=>void game.send({type:'answer',questionId:race.question.id,choice})}/>:race.status==='finished'?<section className="racing-results" aria-label={uiText('Race results')}>
        <div className="racing-result-title"><RacingAnimal animal={race.animal} face/><div><span className="racing-eyebrow">{uiText(race.place===1?'What a zoom!':race.place===6?'You took the scenic route!':'A wonderful race!')}</span><h2>{uiMessage('Place {place} of 6',{place:race.place!})}</h2></div></div>
        <div className="racing-rewards">{race.place===6?<p>{uiText('No resources this time. Your race still counts toward badges!')}</p>:<>{[['stamina','Stamina'],['wood','Wood'],['wool','Wool']].map(([key,label])=><span key={key}><strong>+{race.reward[key as 'wood']}</strong>{uiText(label!)}</span>)}</>}</div>
        {newBadges.length>0&&<div className="racing-earned" aria-label={uiText('New badges')}>{newBadges.slice(0,3).map(a=><span key={a.id}><AchievementBadgeArt source={a.badge} index={a.badgeIndex} columns={a.badgeColumns??1} rows={a.badgeRows??1} size={44}/>{uiText(a.name)}</span>)}{newBadges.length>3&&<span>{uiMessage('+{count} more badges',{count:newBadges.length-3})}</span>}</div>}
        <button type="button" className="racing-primary" onClick={replay}>{uiText('Race Again')} →</button>
      </section>:<div className="racing-forfeit-placeholder"><button className="racing-primary" onClick={replay}>{uiText('Race Again')}</button></div>}
    </main>}
    <dialog ref={dialog} className="racing-left-dialog" aria-labelledby="racing-left-title" onCancel={e=>e.preventDefault()}><RacingAnimal animal={race?.animal??animal} face/><h2 id="racing-left-title">{uiText('Aw, we missed you!')}</h2><p>{uiText('You stepped away, so this race won’t count. Your animal friend would love another try!')}</p><div><button className="racing-primary" onClick={replay}>{uiText('Race Again')}</button><KidBackButton onClick={()=>void back()}/></div></dialog>
  </div>;
}
export function RacingPage(){const id=useProfileStore(s=>s.activeProfileId),generation=useFamilyStore(s=>s.sessionGeneration);return id?<RacingSession key={`${generation}:${id}`} profileId={id}/>:null;}
