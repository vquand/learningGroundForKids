import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {REWARD_KINDS,type TownReward} from './townReward';
import {MilkIcon,YarnIcon} from './BarnUi';
import { MaterialArt,Sprite } from './TownArt';
import {CROPS} from '../../../../server/src/town-building/garden';
import './town.css';
import './townReward.css';

type Receipt = { id: number; reward: TownReward; fromX: number; fromY: number; toX: number; toY: number };
const DEFAULT_SOURCE = '.ufo-play, .food-drink-play, .cr-scene';

/** A modal dialog paints in the browser's top layer above anything in the body, so a flight started from inside one (the shop) must live in that dialog to be seen. */
const flightHost=():HTMLElement=>document.querySelector<HTMLElement>('dialog[open]:modal')??document.body;

/** Cosmetic receipts from successful server actions only. Reads/reloads never replay rewards. */
export function TownRewardBar({ reward = {}, event = 0, animate = true, source = DEFAULT_SOURCE, onOpenStorage, target:targetSelector, hideLink=false }: {
  reward?: TownReward;
  event?: number | string;
  animate?: boolean;
  source?: string;
  onOpenStorage?: () => void;
  target?:string;
  hideLink?:boolean;
}) {
  useUiLanguage();
  const storage = useRef<HTMLAnchorElement>(null), previous = useRef(event), sequence = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [notice, setNotice] = useState<TownReward | null>(null);
  useEffect(() => {
    if (event === previous.current) return;
    previous.current = event;
    const earned: TownReward = {};
    for (const material of REWARD_KINDS) {
      const count = reward[material];
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) earned[material] = count;
    }
    const cropReward=reward.cropReward;
    if(cropReward&&cropReward.amount>0)earned.cropReward=cropReward;
    if (!Object.keys(earned).length) return;
    const target = (targetSelector?document.querySelector(targetSelector):storage.current)?.getBoundingClientRect();
    const scene = storage.current?.closest('main, [class$="-page"], .infinidrill-root')?.querySelector(source)
      ?? document.querySelector(source);
    const bounds = scene?.getBoundingClientRect();
    const id = ++sequence.current;
    setNotice(earned);
    if (animate && target) setReceipts(all => [...all, {
      id, reward: earned,
      fromX: bounds ? bounds.left + bounds.width / 2 : innerWidth / 2,
      fromY: bounds ? bounds.top + bounds.height / 2 : innerHeight / 2,
      toX: target.left + target.width / 2, toY: target.top + target.height / 2,
    }]);
    const timer = setTimeout(() => {
      setReceipts(all => all.filter(receipt => receipt.id !== id));
      if (sequence.current === id) setNotice(null);
      timers.current = timers.current.filter(value => value !== timer);
    }, 2800);
    timers.current.push(timer);
  }, [event, reward, animate, source,targetSelector]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const text = notice ? [...REWARD_KINDS.filter(m => (notice[m] ?? 0) > 0).map(m => `+${notice[m]} ${uiText(m==='milk'?'Milk':m==='yarn'?'Yarn':m)}`), ...(notice.cropReward?[`+${notice.cropReward.amount} ${uiText(CROPS.find(crop=>crop.id===notice.cropReward!.crop)?.name??notice.cropReward.crop)}`]:[])].join(', ') : '';
  return <div className="town-reward-bar">
    {!hideLink&&<Link ref={storage} data-town-storage to="/town-building" onClick={onOpenStorage}>{uiText('Town storage →')}</Link>}
    <span className="town-reward-status" role="status">{text ? `${text} ${uiText('stored')}` : ''}</span>
    {receipts.length > 0 && createPortal(<div className="town-reward-flight-layer" aria-hidden="true">{receipts.flatMap(receipt => {
      const materials = REWARD_KINDS.filter(m => (receipt.reward[m] ?? 0) > 0);
      const entries=[...materials.map(material=>({kind:material,amount:receipt.reward[material],art:<>{material==='milk'?<MilkIcon/>:material==='yarn'?<YarnIcon/>:<MaterialArt material={material}/>}</>})), ...(receipt.reward.cropReward?[{kind:receipt.reward.cropReward.crop,amount:receipt.reward.cropReward.amount,art:<Sprite file="crop-growth" index={CROPS.findIndex(crop=>crop.id===receipt.reward.cropReward!.crop)*4+3} columns={4} rows={8}/>}]:[])];
      return entries.map((entry, index) => <span key={`${receipt.id}:${entry.kind}`} className="town-resource-flight" data-reward-kind={entry.kind} data-reward-event={receipt.id} style={{
        '--from-x': `${receipt.fromX + (index - (entries.length - 1) / 2) * 94}px`, '--from-y': `${receipt.fromY}px`,
        '--to-x': `${receipt.toX}px`, '--to-y': `${receipt.toY}px`, '--flight-delay': `${index * 100}ms`,
      } as CSSProperties}>{entry.art}<strong>+{entry.amount}</strong></span>);
    })}</div>, flightHost())}
  </div>;
}
