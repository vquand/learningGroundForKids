import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { uiText } from '../../../i18n/uiText';
import { CabbageSprite, foldSprite } from './CabbageArt';
import { Bowl, Filling } from './CabbageScenes';
import type { CabbageAction, CabbageGame, Fold } from './cabbageGame';
type Dispatch = (a: CabbageAction) => void;
export function MixingWheel({ game, dispatch }: { game: CabbageGame; dispatch: Dispatch }) {
  const drag = useRef<{ id: number; angle: number } | null>(null);
  function angle(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    // Normalize to the visible ellipse, rather than a screen-space circle.
    return Math.atan2((e.clientY - box.y - box.height * .43) / (box.height * .09), (e.clientX - box.x - box.width * .5) / (box.width * .27));
  }
  function release(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  const x = 50 + Math.cos(game.angle) * 18, y = 43 + Math.sin(game.angle) * 6;
  return <div className="cr-wheel cr-vessel-stage" onPointerDown={e => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault(); drag.current = { id: e.pointerId, angle: angle(e) }; e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerMove={e => {
    if (drag.current?.id !== e.pointerId) return;
    const next = angle(e); const delta = Math.atan2(Math.sin(next - drag.current.angle), Math.cos(next - drag.current.angle));
    drag.current.angle = next; dispatch({ type: 'turn', radians: delta });
  }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={() => { drag.current = null; }}>
    <Bowl><Filling game={game} mixed /><div className="cr-stir-guide" aria-hidden="true" />
      <CabbageSprite sheet="preparation" index={11} className="cr-stir-spoon" style={{ left: `${x}%`, top: `${y}%` }} />
    </Bowl>
    <button className="cr-stir-control" aria-label={uiText('Stir with drag or arrow keys')}
      onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); dispatch({ type: 'turn', radians: ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -Math.PI / 4 : Math.PI / 4 }); } }} />
  </div>;
}
export function FoldCanvas({ game, dispatch }: { game: CabbageGame; dispatch: Dispatch }) {
  const drag = useRef<{ id: number; edge: Fold; x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<{ edge: Fold; progress: number } | null>(null);
  const active = !!game.portion && !game.torn && game.rolls < 3;
  const readyToRoll = game.folds.includes('left') && game.folds.includes('right');
  function distance(e: PointerEvent<HTMLButtonElement>) {
    const start = drag.current!; const box = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - start.x) / box.width, dy = (e.clientY - start.y) / box.height;
    return { forward: start.edge === 'left' ? dx : start.edge === 'right' ? -dx : -dy, sideways: start.edge === 'left' || start.edge === 'right' ? dy : dx };
  }
  function release(e: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const start = drag.current;
    if (!start || start.id !== e.pointerId) return;
    const d = distance(e);
    drag.current = null; setPreview(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!cancelled && d.forward >= (start.edge === 'close' ? .35 : .14)) dispatch({ type: 'fold', edge: start.edge, overshot: d.forward > .9 || Math.abs(d.sideways) > .55 });
  }
  const rolling = preview?.edge === 'close';
  const sprite = rolling ? Math.min(7, Math.floor(preview.progress * 8)) : readyToRoll ? 0 : null;
  return <div className={`cr-fold-canvas${game.torn ? ' cr-fold-canvas--torn' : ''}`}>
    <CabbageSprite sheet="board" index={0} className="cr-fold-board" />
    <svg viewBox="0 0 100 100" className="cr-board-guides" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 47h12m-5-5 5 5-5 5 M86 47H74m5-5-5 5 5 5 M50 82V69m-5 5 5-5 5 5" /></g></svg>
    <button className="cr-leaf-touch" aria-label={uiText('Fold cabbage leaf')} disabled={!active}
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0 || !active) return;
        const box = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - box.x) / box.width, y = (e.clientY - box.y) / box.height;
        // Bottom edge starts both the first fold and the final upward roll.
        const edge: Fold | null = y >= .58 ? readyToRoll ? 'close' : 'bottom' : x <= .4 ? 'left' : x >= .6 ? 'right' : null;
        if (!edge || game.folds.includes(edge)) return;
        e.preventDefault(); drag.current = { id: e.pointerId, edge, x: e.clientX, y: e.clientY }; setPreview({ edge, progress: 0 }); e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={e => {
        if (drag.current?.id !== e.pointerId) return;
        setPreview({ edge: drag.current.edge, progress: Math.max(0, Math.min(1, distance(e).forward / (drag.current.edge === 'close' ? .4 : .3))) });
      }} onPointerUp={e => release(e)} onPointerCancel={e => release(e, true)} onLostPointerCapture={() => { drag.current = null; setPreview(null); }}
      onKeyDown={e => {
        const edge: Fold | null = e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowUp' ? readyToRoll ? 'close' : 'bottom' : e.key === 'Enter' || e.key === ' ' ? !game.folds.includes('bottom') ? 'bottom' : !game.folds.includes('left') ? 'left' : !game.folds.includes('right') ? 'right' : 'close' : null;
        if (edge) { e.preventDefault(); dispatch({ type: 'fold', edge }); }
      }}>
      <CabbageSprite sheet={sprite !== null ? 'rollProgress' : 'folding'} index={sprite ?? (game.rolls === 3 ? 6 : foldSprite(game))} className="cr-leaf" style={preview && !rolling ? { transform: `translate(${preview.edge === 'left' ? preview.progress * 8 : preview.edge === 'right' ? preview.progress * -8 : 0}%, ${preview.edge === 'bottom' ? preview.progress * -8 : 0}%)` } : undefined} />
    </button>
    {game.portion === 'small' && !game.folds.length && !game.torn && <CabbageSprite sheet="preparation" index={4} className="cr-small-filling" />}
  </div>;
}
export function IngredientDrop({ index, onAdd, children }: { index: number; onAdd: (index: number) => void; children: ReactNode }) {
  const pointer = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  function clearDrag(element: HTMLButtonElement) {
    pointer.current = null;
    element.style.removeProperty('--drag-x'); element.style.removeProperty('--drag-y');
  }
  return <button className="cr-ingredient" onClick={e => {
    if (e.detail === 0 || !suppressClick.current) onAdd(index);
    suppressClick.current = false;
  }} onPointerDown={e => {
    if (!e.isPrimary || e.button !== 0) return;
    suppressClick.current = false;
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerMove={e => {
    const drag = pointer.current;
    if (drag?.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved ||= Math.hypot(dx, dy) > 10;
    if (drag.moved) {
      e.currentTarget.style.setProperty('--drag-x', `${dx}px`);
      e.currentTarget.style.setProperty('--drag-y', `${dy}px`);
    }
  }} onPointerUp={e => {
    const drag = pointer.current;
    if (drag?.id !== e.pointerId) return;
    // Handle taps at pointer-up: touch browsers may omit the synthetic click.
    suppressClick.current = true;
    if (drag.moved) {
      const target = document.querySelector('[data-bowl-drop]')?.getBoundingClientRect();
      if (target && e.clientX >= target.x && e.clientX <= target.right && e.clientY >= target.y && e.clientY <= target.bottom) onAdd(index);
    }
    if (!drag.moved) onAdd(index);
    clearDrag(e.currentTarget);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }} onPointerCancel={e => { suppressClick.current = true; clearDrag(e.currentTarget); }}
    onLostPointerCapture={e => clearDrag(e.currentTarget)}>{children}</button>;
}
