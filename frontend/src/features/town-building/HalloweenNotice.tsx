import { isHalloweenPreparation, isHalloweenNight } from '../../../../server/src/town-building/halloweenCalendar';
import { MAX_HALLOWEEN_LANTERNS, type HalloweenState } from '../../../../server/src/town-building/halloween';
import { useState } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText, uiMessage } from '../../i18n/uiText';
import { Sprite } from './TownArt';

export function HalloweenNotice({ localDate, holiday, busy, onGarden }: {
  localDate: string; holiday?: HalloweenState; busy: boolean; onGarden: () => void;
}) {
  useUiLanguage();
  const preparing = isHalloweenPreparation(localDate);
  // "Okay" hides this year's notice for its phase on this device; the lantern notice still appears on October 30-31.
  const key = `town-halloween-notice:${localDate.slice(0, 4)}:${preparing ? 'grow' : 'lanterns'}`;
  const [dismissed, setDismissed] = useState<string | null>(() => { try { return localStorage.getItem(key) ? key : null; } catch { return null; } });
  if (!preparing && !isHalloweenNight(localDate)) return null;
  if (dismissed === key) return null;
  const dismiss = () => { try { localStorage.setItem(key, '1'); } catch { /* private mode: hide for this visit only */ } setDismissed(key); };
  return <section className="town-halloween-notice" aria-label={uiText('Pumpkins for Halloween')}>
    <Sprite file="crop-growth" index={23} columns={4} rows={8}/>
    <div><strong>{uiText(preparing ? 'Grow pumpkins for our ghost friends!' : 'Our ghost friends are making lanterns!')}</strong>
      <p>{uiText(preparing
        ? 'Pumpkins grow in 5 active minutes. On October 30–31, friendly ghosts turn ripe pumpkins into lanterns on dry evenings and nights.'
        : 'Each ripe pumpkin makes one lantern and gives 2 stamina. Keep growing to light up your town! Lanterns leave on November 1.')}</p>
      {!preparing && <small>{uiMessage('{count}/{limit} lanterns around town', { count: holiday?.year === localDate.slice(0, 4) ? holiday.lanterns.length : 0, limit: MAX_HALLOWEEN_LANTERNS })}</small>}
    </div>
    <div className="town-halloween-actions">
      <button disabled={busy} onClick={onGarden}>{uiText('Grow pumpkins')}</button>
      <button onClick={dismiss}>{uiText('Okay')}</button>
    </div>
  </section>;
}
