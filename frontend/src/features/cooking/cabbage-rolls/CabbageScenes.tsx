import type { ReactNode } from 'react';
import { CabbageSprite, MealArt } from './CabbageArt';
import { motionProgress, steamDuration, type CabbageGame } from './cabbageGame';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const visualProgress = (game: CabbageGame, kind: Parameters<typeof motionProgress>[1]) => reducedMotion() ? 1 : motionProgress(game, kind);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => n * n * (3 - 2 * n);
export function Bowl({ children, front = true }: { children?: ReactNode; front?: boolean }) {
  return <><CabbageSprite sheet="equipment" index={0} className="cr-vessel-bowl" />{children}{front && <CabbageSprite sheet="equipment" index={0} className="cr-vessel-bowl cr-bowl-front" />}</>;
}
const ingredientPositions = [[31, 39], [49, 39], [40, 34], [42, 43]];
export function Filling({ game, mixed = false }: { game: CabbageGame; mixed?: boolean }) {
  return <div className="cr-bowl-interior">{mixed && <CabbageSprite sheet="filling" index={0} className="cr-mixed-filling" style={{ opacity: Math.min(1, game.turns / 2) }} />}{game.added.map(index => {
    const dropping = game.motion?.kind === 'drop' && game.motion.index === index;
    if (dropping && motionProgress(game, 'drop') < .85) return null;
    const [x, y] = ingredientPositions[index]!;
    const offset = mixed ? Math.sin(game.angle + index * 1.57) * 5 : 0;
    return <CabbageSprite key={index} sheet="preparation" index={index + 4} className="cr-filling-pile" style={{ opacity: mixed ? Math.max(0, 1 - game.turns / 2) : 1, left: `${x! + offset}%`, top: `${y! + (mixed ? Math.cos(game.angle + index * 1.57) * 2 : 0)}%` }} />;
  })}</div>;
}
export function BowlScene({ game }: { game: CabbageGame }) {
  const drop = game.motion?.kind === 'drop' ? game.motion : null;
  const seasoning = game.motion?.kind === 'season' ? game.motion : null;
  const p = visualProgress(game, 'drop');
  const seasonP = visualProgress(game, 'season');
  return <div className="cr-bowl-drop cr-vessel-stage" data-bowl-drop>
    <Bowl><Filling game={game} />
      {drop && p < .85 && <CabbageSprite sheet="preparation" index={drop.index + 4} className="cr-falling-ingredient" style={{ left: `${ingredientPositions[drop.index]![0]}%`, top: `${3 + ease(p / .85) * 35}%`, scale: `${.85 + p * .15}` }} />}
    </Bowl>
    {seasoning && <div className="cr-season-pour" data-seasoning={seasoning.index}>
      <CabbageSprite sheet="utensils" index={seasoning.index} className="cr-season-tool" style={{ rotate: `${Math.sin(seasonP * Math.PI * 8) * 7}deg` }} />
      <div className={`cr-season-particles${seasoning.index === 2 ? ' cr-season-particles--soy' : ''}`}>
        {Array.from({ length: seasoning.index === 2 ? 5 : 12 }, (_, i) => <i key={i} style={{ left: `${34 + (i % 4) * 6}%`, top: `${20 + ((seasonP * 3 + i / 12) % 1) * 27}%`, background: seasoning.index === 0 ? '#fff5cf' : seasoning.index === 1 ? '#59402c' : '#704127' }} />)}
      </div>
    </div>}
  </div>;
}
function CoveredFillingBowl({ game, wrapProgress = 1 }: { game: CabbageGame; wrapProgress?: number }) {
  return <Bowl>
    <Filling game={game} mixed />
    <div className="cr-plastic-wrap" style={{ top: `${31 - (1 - wrapProgress) * 12}%`, opacity: .58 + wrapProgress * .42, transform: `scaleX(${.78 + wrapProgress * .22}) scaleY(${.9 + wrapProgress * .1})` }} aria-hidden="true"><i /><i /><i /></div>
  </Bowl>;
}
export function RestScene({ game }: { game: CabbageGame }) {
  const fridge = game.motion?.kind === 'fridge';
  const p = ease(visualProgress(game, fridge ? 'fridge' : 'cover-bowl'));
  return <div className="cr-rest-scene cr-vessel-stage">
    {fridge && <CabbageSprite sheet="utensils" index={p > .92 ? 11 : 10} className="cr-rest-fridge" />}
    <div className="cr-rest-bowl" style={fridge ? { transform: `translate(${-12 * p}%, ${-18 * p}%) scale(${1 - .69 * p})`, opacity: p > .92 ? 0 : 1 } : undefined}>
      {game.covered ? <CoveredFillingBowl game={game} wrapProgress={fridge ? 1 : p} /> : <Bowl><Filling game={game} mixed /></Bowl>}
    </div>
  </div>;
}
export function RetrieveScene({ game }: { game: CabbageGame }) {
  const moving = game.motion?.kind === 'retrieve';
  const p = moving ? ease(visualProgress(game, 'retrieve')) : 0;
  return <div className="cr-retrieve-scene cr-vessel-stage" data-retrieve-stage={moving ? 'moving' : 'waiting'}>
    <CabbageSprite sheet="utensils" index={moving ? 10 : 11} className="cr-rest-fridge" />
    {moving && <div className="cr-rest-bowl cr-retrieve-bowl" style={{ transform: `translate(${-12 * (1 - p)}%, ${-18 * (1 - p)}%) scale(${.31 + .69 * p})` }}>
      <CoveredFillingBowl game={game} />
    </div>}
  </div>;
}
export function Pot({ children, lid, active = false }: { children?: ReactNode; lid?: ReactNode; active?: boolean }) {
  return <div className={`cr-layered-pot${active ? ' cr-layered-pot--active' : ''}`}>
    <CabbageSprite sheet="pot" index={0} className="cr-pot-body" />
    {children}
    <CabbageSprite sheet="pot" index={0} className="cr-pot-body cr-pot-front" />
    {lid}
    {active && <div className="cr-steam" aria-hidden="true"><i /><i /><i /></div>}
  </div>;
}
export function PotLid({ progress = 1, lift = 0 }: { progress?: number; lift?: number }) {
  return <CabbageSprite sheet="pot" index={1} className="cr-matched-lid" style={{ top: `${30 - (1 - ease(progress)) * 20 - lift * 20}%`, opacity: 1 - lift }} />;
}
export function SteamScene({ game }: { game: CabbageGame }) {
  const ready = game.steamMs >= steamDuration(game.steamHeat);
  const p = visualProgress(game, 'cabbage');
  return <div className="cr-vessel-stage cr-steam-stage"><Pot active={game.steaming} lid={game.steamCovered && <PotLid progress={visualProgress(game, 'cover-steamer')} lift={ready ? .6 : 0} />}>
    {game.leaves > 0 && <CabbageSprite sheet="utensils" index={ready ? 9 : 8} className="cr-whole-cabbage" style={{ top: `${7 + ease(p) * 19}%`, visibility: game.steamCovered && !ready && motionProgress(game, 'cover-steamer') > .8 ? 'hidden' : 'visible' }} />}
  </Pot></div>;
}
export function SimmerScene({ game }: { game: CabbageGame }) {
  const arranging = game.motion?.kind === 'arrange';
  const p = ease(visualProgress(game, 'arrange'));
  const sauceP = visualProgress(game, 'sauce');
  return <div className="cr-vessel-stage"><Pot active={game.cooking} lid={game.potCovered && <PotLid progress={visualProgress(game, 'cover-pot')} />}>
    <div className="cr-pot-interior">
      {game.sauce && <div className="cr-tomato-surface" style={{ opacity: sauceP }} />}
      {Array.from({ length: game.arranged }, (_, i) => arranging && i === game.arranged - 1 && p < .8 ? null : <CabbageSprite key={i} sheet="folding" index={6} className="cr-inside-roll" style={{ left: `${28 + i * 15}%` }} />)}
    </div>
    {arranging && p < .85 && <CabbageSprite sheet="utensils" index={4} className="cr-placing-tongs" style={{ left: `${26 + game.motion!.index * 15}%`, top: `${p * 29}%` }} />}
    {game.motion?.kind === 'sauce' && <><CabbageSprite sheet="utensils" index={5} className="cr-pouring-ladle" style={{ rotate: `${sauceP * 35}deg` }} /><div className="cr-sauce-stream" style={{ opacity: sauceP > .3 && sauceP < .85 ? 1 : 0 }} /></>}
  </Pot></div>;
}
export function PlatingScene({ game }: { game: CabbageGame }) {
  if (reducedMotion()) return <MealArt outcome={game.outcome ?? 'perfect'} />;
  const elapsed = game.motion?.elapsed ?? 7600;
  const lift = clamp(elapsed / 1000);
  const transfer = clamp((elapsed - 1000) / 3900) * 3;
  const transferred = Math.min(3, Math.floor(transfer));
  const moving = transfer > 0 && transfer < 3;
  const travel = ease(transfer % 1);
  const pour = clamp((elapsed - 4900) / 2700);
  const ladleTravel = ease(clamp((pour - .2) / .35));
  const ladleY = 7 + 20 * ladleTravel - Math.sin(ladleTravel * Math.PI) * 8 + (pour < .2 ? Math.sin(pour / .2 * Math.PI) * 5 : 0);
  const x = 29 + (34 + transferred * 9) * travel;
  const y = 34 + 40 * travel - Math.sin(travel * Math.PI) * 23;
  return <div className="cr-plating-scene cr-vessel-stage" data-serving-stage={elapsed < 1000 ? 'open' : elapsed < 4900 ? 'transfer' : 'sauce'}>
    <div className="cr-serving-pot"><Pot lid={lift < 1 && <PotLid lift={lift} />}><div className="cr-pot-interior"><div className="cr-tomato-surface" />{Array.from({ length: 3 - transferred - (moving ? 1 : 0) }, (_, i) => <CabbageSprite key={i} sheet="folding" index={6} className="cr-inside-roll" style={{ left: `${28 + i * 15}%` }} />)}</div></Pot></div>
    <CabbageSprite sheet="utensils" index={6} className="cr-serving-plate" />
    {Array.from({ length: transferred }, (_, i) => <CabbageSprite key={i} sheet="folding" index={6} className="cr-plated-roll" style={{ left: `${54 + i * 10}%` }} />)}
    {moving && <CabbageSprite sheet="utensils" index={4} className="cr-transfer-tongs" style={{ left: `${x - 9}%`, top: `${y - 27}%` }} />}
    {pour > 0 && <>
      <CabbageSprite sheet="utensils" index={5} className="cr-serving-ladle" style={{ left: `${19 + ladleTravel * 40}%`, top: `${ladleY}%`, rotate: `${Math.max(0, pour - .5) * 80}deg` }} />
      {pour > .55 && <div className="cr-serving-sauce" style={{ height: `${(pour - .55) / .45 * 24}%` }} />}
      {pour > .8 && <div className="cr-finished-serving" style={{ opacity: (pour - .8) * 5 }}><MealArt outcome={game.outcome ?? 'perfect'} /></div>}
    </>}
  </div>;
}
