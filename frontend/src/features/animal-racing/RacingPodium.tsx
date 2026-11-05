import type { CSSProperties } from 'react';
import type { RacingState } from '../../api/roadRacing';
import { ANIMAL_NAMES } from '../../../../server/src/road-racing/questions';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { RacingAnimal } from './RacingArt';
import { finalStandings } from './raceOrder';
import './racingPodium.css';

export function RacingPodium({race}:{race:NonNullable<RacingState['race']>}) {
  const language=useUiLanguage();
  const order=finalStandings(race.racers,race.place!);
  const name=(animal:typeof order[number]['animal'])=>ANIMAL_NAMES[animal][language==='vi'?1:0];
  return <section className="racing-podium" aria-label={uiText('Podium celebration')}>
    <div className="racing-podium-heading"><p className="racing-eyebrow">{uiText('A big cheer for every friend!')}</p><h2>{uiText('Our speedy stars')}</h2></div>
    <div className="racing-podium-confetti" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{'--piece':i} as CSSProperties}/>)}</div>
    <ol className="racing-podium-winners" aria-label={uiText('Top three friends')}>
      {order.slice(0,3).map((racer,index)=><li key={racer.animal} className={`racing-podium-winner place-${index+1} ${racer.player?'is-you':''}`} data-place={index+1} data-animal={racer.animal} aria-label={`${name(racer.animal)}, ${uiMessage('Place {place} of 6',{place:index+1})}${racer.player?', '+uiText('You'):''}`}>
        <div className="racing-podium-friend"><RacingAnimal animal={racer.animal}/>{racer.player&&<b>{uiText('You')}</b>}</div>
        <div className="racing-podium-step" aria-hidden="true"><span className="racing-podium-number">{index+1}</span><span className="racing-podium-name">{name(racer.animal)}</span></div>
      </li>)}
    </ol>
    <div className="racing-podium-crowd" role="list" aria-label={uiText('Friends cheering')}>
      {order.slice(3).map((racer,index)=><div key={racer.animal} role="listitem" className={`racing-cheering-friend ${racer.player?'is-you':''}`} data-animal={racer.animal} style={{'--cheer-delay':`${index*180}ms`} as CSSProperties} aria-label={`${name(racer.animal)}${racer.player?', '+uiText('You'):''}`}>
        <span className="racing-cheer-spark" aria-hidden="true">✦</span><RacingAnimal animal={racer.animal}/><span>{name(racer.animal)}{racer.player&&<b>{uiText('You')}</b>}</span>
      </div>)}
    </div>
  </section>;
}
