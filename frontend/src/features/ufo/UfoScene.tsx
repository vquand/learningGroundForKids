import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useRef, useState } from 'react';
import type { UfoState } from '../../api/ufo';
import { AnimalSprite, ANIMALS } from './UfoArt';
export function UfoScene({ session, asleep, tick, interactive = false, onPet }: {
  session: NonNullable<UfoState['session']>;
  asleep: boolean;
  tick: number;
  interactive?: boolean;
  onPet?: () => void;
}) {
  useUiLanguage();

  const [petAt, setPetAt] = useState(0);

  const lastPet = useRef(0);

  const captured = session.status === 'captured';

  const petting = petAt > 0 && !captured;

  const pose = captured || petting || session.status === 'solved' ? 3 : asleep ? 2 : Math.floor(tick / 4) % 2;

  const animalName = ANIMALS.find(a => a.id === session.animal)?.name ?? 'animal';

  const bg = ['farm', 'forest', 'lake'].indexOf(session.background);

  const step = Math.min(9, session.danger);

  useEffect(() => {

    if (!petAt)
      return;

    const timeout = setTimeout(() => setPetAt(0), 1000);

    return () => clearTimeout(timeout);

  }, [petAt]);

  function pet() {

    const now = Date.now();

    if (!interactive || captured || now - lastPet.current < 1000)
      return;

    lastPet.current = now;

    setPetAt(now);

    onPet?.();

  }

  return <div className={`ufo-scene ${captured ? 'ufo-captured' : ''}`} role="group" aria-label={`${session.animal} in a ${session.background}. UFO danger ${session.danger} out of 10.${asleep ? uiText(" Your friend is napping.") : ''}`} style={{ backgroundPosition: `center ${bg * 50}%` }}>
    <div className="ufo-craft-position" style={{ left: `${87 - step * 37 / 9}%`, top: `${9 + step * 10 / 9}%`, width: `${8 + step * 15 / 9}%` }}>
      <div className="ufo-craft" />

      <div className={`ufo-beam ${session.danger >= 9 ? 'visible' : ''}`} />

      <div className="ufo-passenger">
        <AnimalSprite animal={session.animal} pose={3} surprised />
      </div>
    </div>

    <div className="ufo-ground" />

    <button type="button" className={`ufo-friend ufo-friend-button ${asleep && !petting ? 'sleeping' : ''} ${petting ? 'petted' : ''}`} aria-label={`Pet ${animalName}`} aria-disabled={petting} disabled={!interactive || captured} onClick={pet} onKeyDown={e => {
      if (e.repeat)
        e.preventDefault();
    }}>
      <AnimalSprite animal={session.animal} pose={pose} surprised={captured} />
      {asleep && !petting && !captured && <span className="ufo-zzz" aria-hidden="true">zzZ</span>}
      {petting && <svg key={petAt} data-pet-at={petAt} className="ufo-pet-heart" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 57C26 53 6 39 6 23C6 5 28 3 32 17C36 3 58 5 58 23C58 39 38 53 32 57Z" fill="currentColor" stroke="#cf6b86" strokeWidth="2" />
        <path d="M15 20C15 14 22 12 26 15" fill="none" stroke="#ffe3eb" strokeWidth="5" strokeLinecap="round" />
      </svg>}
    </button>
    {session.status === 'solved' && <div className="ufo-confetti" aria-hidden="true">✦　✧　★　✧　✦</div>}
  </div>;

}
