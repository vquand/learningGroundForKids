import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { miningMaterialAt } from '../../../../server/src/town-building/rewards';
import { MaterialArt } from '../town-building/TownArt';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { TERRAIN_ATLAS, terrainSourceRect, TUNNEL_EDGES_ATLAS, tunnelEdgeSourceRect } from './assets';
import { pruneCaves, terrainMaterial, tunnelEdges, worldCells, worldVariant, worldViewport, type Cave } from './world';
import { depositAt } from '../../../../server/src/infinidrill/mining.ts';
import type { Excavation, LaserShot } from './types';

const WALL_COLORS = ['#604733', '#58422e', '#3f454e', '#30323f', '#412b32', '#532e26'];
const MATERIAL_NAMES = ['Loose dirt', 'Packed dirt', 'Rock', 'Deep rock', 'Rock + lava', "Earth's core"];
export interface DrillMovement {
  readonly id: string; readonly from: number; readonly to: number;
  readonly mined: number; readonly cave?: Cave;
  readonly laser?: LaserShot;
}

const EdgeArt = memo(function EdgeArt({ material, variant }: { material: number; variant: number }) {
  useUiLanguage();
  const rect = tunnelEdgeSourceRect(material, variant);
  return <svg viewBox={`0 0 ${rect.width} ${rect.height}`} preserveAspectRatio="none" aria-hidden="true">
    <svg width={rect.width} height={rect.height} overflow="hidden"><image href={TUNNEL_EDGES_ATLAS.src} x={-rect.x} y={-rect.y} width={TUNNEL_EDGES_ATLAS.width} height={TUNNEL_EDGES_ATLAS.height} /></svg>
  </svg>;
});

const BlockArt = memo(function BlockArt({ material, variant }: { material: number; variant: number }) {
  useUiLanguage();
  const rect = terrainSourceRect(material, variant);
  return <svg viewBox={`0 0 ${rect.width} ${rect.height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <svg width={rect.width} height={rect.height} overflow="hidden"><image href={TERRAIN_ATLAS.src} x={-rect.x} y={-rect.y} width={TERRAIN_ATLAS.width} height={TERRAIN_ATLAS.height} /></svg>
  </svg>;
});

function LaserBeams({ shot, cellSize, tileSize }: { shot: LaserShot; cellSize: number; tileSize: number }) {
  useUiLanguage();
  const steps = shot.steps ?? [shot];
  const first = steps[0];
  const last = steps.at(-1);
  if (!first || !last) return null;
  const side = steps.length > 1 ? (last.left > first.left ? 1 : -1) : 0;
  const width = (shot.right - shot.left + 1) * cellSize;
  const height = (shot.to - shot.from) * tileSize;
  return <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    {Array.from({ length: first.right - first.left + 1 }, (_, beam) => {
      const points = steps.map(step => ({
        x: (step.left - shot.left + beam + .5) * cellSize,
        y: ((step.from + step.to) / 2 - shot.from) * tileSize,
      }));
      const start = points[0]!;
      const end = points.at(-1)!;
      const path = `M ${start.x - side * cellSize / 2} 0 ${points.map(point => `L ${point.x} ${point.y}`).join(' ')} L ${end.x + side * cellSize / 2} ${height}`;
      return <g key={beam}>
        <path className="infinidrill-laser-glow" d={path} pathLength={1} />
        <path className="infinidrill-laser-beam" d={path} pathLength={1} />
      </g>;
    })}
  </svg>;
}

/** Only the intersecting rows exist in the DOM. World coordinates keep tiles
 * stable while a single layer transform supplies smooth camera motion. */
export const InfinidrillWorldScene = memo(function InfinidrillWorldScene({ depth, level, worldSeed = 0, excavations, laserCuts, laserReach = 0, movement, reducedMotion, engineRunning = true, canPet = false, children, thought }: {
  depth: number; level: number; worldSeed?: number; excavations?: readonly Excavation[]; laserCuts?: readonly Excavation[]; movement: DrillMovement | null;
  reducedMotion: boolean; laserReach?: number; engineRunning?: boolean; canPet?: boolean; children: ReactNode; thought: ReactNode;
}) {
  useUiLanguage();
  const host = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 560, height: 668 });
  const [caves, setCaves] = useState<readonly Cave[]>([]);
  const [burst, setBurst] = useState<string | null>(null);
  const [hearts, setHearts] = useState<{ id: number; count: number } | null>(null);
  const heartSequence = useRef(0);
  useEffect(() => {
    if (!canPet) { setHearts(null); return; }
    if (!hearts) return;
    const timer = setTimeout(() => setHearts(null), 1400);
    return () => clearTimeout(timer);
  }, [hearts, canPet]);
  const reach = Math.max(laserReach, ...(laserCuts ?? []).map(cut => Math.max(Math.abs(cut.left), Math.abs(cut.right))));
  const view = worldViewport(depth, size.width, size.height, reach);
  const firstRow = view.rows[0]!;
  const lastRow = view.rows.at(-1)!;
  const activeCave = movement?.cave;
  const visibleCaves = caves.filter(cave => cave.end > firstRow && cave.start <= lastRow);
  // Gaps between server-recorded cuts are traversed caves, including after reload.
  if (excavations) {
    let end = 0;
    for (const band of excavations) {
      if (band.from > end && band.from > firstRow && end <= lastRow) visibleCaves.push({ start: end, end: band.from });
      end = band.to;
    }
    if (depth > end && depth > firstRow && end <= lastRow) visibleCaves.push({ start: end, end: depth });
  }
  if (activeCave && !visibleCaves.some(cave => cave.start === activeCave.start && cave.end === activeCave.end)) visibleCaves.push(activeCave);
  const visibleLaserCuts = movement?.laser && depth < movement.laser.from ? laserCuts?.slice(0, -(movement.laser.steps?.length ?? 1)) : laserCuts;
  const cells = worldCells(view, depth, visibleCaves, excavations, visibleLaserCuts);
  const edges = tunnelEdges(cells);
  const solid = cells.filter(cell => !cell.cleared).map(cell => ({ ...cell, deposit: !cell.mined ? depositAt(worldSeed, cell.row, cell.column) : null }));
  const wallBands: { start: number; end: number; material: number }[] = [];
  const openings = new Map<number, { row: number; first: number; last: number }>();
  for (const row of view.rows) {
    if (row < 0) continue;
    const material = terrainMaterial(row);
    const last = wallBands.at(-1);
    if (last && last.material === material) last.end = row + .5;
    else wallBands.push({ start: row, end: row + .5, material });
  }
  for (const cell of cells) {
    if (!cell.cleared) continue;
    const opening = openings.get(cell.row);
    if (opening) opening.last = cell.column;
    else openings.set(cell.row, { row: cell.row, first: cell.column, last: cell.column });
  }
  const material = terrainMaterial(Math.floor(depth));
  const moving = Boolean(movement);
  const falling = Boolean(activeCave);
  const machineWidth = Math.min(size.width * .52, size.height * .31, 320);
  const machineHeight = machineWidth * .94;
  const originOffset = (firstRow - view.cameraRow) * view.tileSize;

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth, height = element.clientHeight;
      if (width && height) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setCaves(previous => {
      let next = pruneCaves(previous, firstRow);
      if (activeCave && !next.some(cave => cave.start === activeCave.start && cave.end === activeCave.end)) next = [...next, activeCave];
      return next.length === previous.length && next.every((cave, index) => cave === previous[index]) ? previous : next;
    });
  }, [firstRow, activeCave?.start, activeCave?.end]);
  useEffect(() => {
    if (!movement || !movement.mined || reducedMotion) { setBurst(null); return; }
    setBurst(movement.id);
    const timer = setTimeout(() => setBurst(null), 1000);
    return () => clearTimeout(timer);
  }, [movement?.id, reducedMotion]);

  const fragments = useMemo(() => Array.from({ length: Math.min(12, (movement?.mined ?? 0) * 4) }, (_, index) => ({
    id: index, direction: index % 2 ? 1 : -1,
    reach: 1.2 + index % 3 * .35, lift: .3 + index % 4 * .22,
  })), [movement?.id, movement?.mined]);
  const sunY = (-3 - view.cameraRow) * view.tileSize;

  return <section ref={host} className={`infinidrill-scene infinidrill-world-scene ${moving ? 'is-drilling' : ''} ${falling ? 'has-cave-fall' : ''}`}
    aria-label={`Underground scene, ${MATERIAL_NAMES[material]}`} data-laser-reach={reach} data-camera-row={view.cameraRow} data-visible-rows={view.rows.length} data-visible-columns={view.columns} data-retained-caves={caves.length} data-world-depth={depth}>
    {view.skyHeight > 0 && <div className="infinidrill-world-sky" style={{ height: view.skyHeight }} data-world-surface="true">
      {sunY > -24 && sunY < view.skyHeight + 24 && <span className="infinidrill-world-sun" style={{ top: sunY }} />}
    </div>}
    <div className="infinidrill-world-layer" aria-hidden="true" style={{ transform: `translateY(${originOffset}px)` }}>
      {wallBands.map(band => <div key={`wall-${band.start}`} className="infinidrill-world-wall" data-world-row={band.start}
        style={{ top: (band.start - firstRow) * view.tileSize, height: (band.end - band.start) * view.tileSize, backgroundColor: WALL_COLORS[band.material] }}>
        <span style={{ backgroundSize: `${view.tileSize * 3}px ${view.tileSize * 3}px`, backgroundPosition: `0 ${-band.start * view.tileSize}px` }} />
      </div>)}
      {solid.map(cell => <div key={`${cell.row}:${cell.column}`} className="infinidrill-world-block" data-world-row={cell.row} data-world-column={cell.column} data-material={cell.material}
        style={{ width: view.cellSize, height: view.cellSize, left: size.width / 2 + (cell.column - .5) * view.cellSize, top: (cell.row - firstRow) * view.tileSize }}>
        <BlockArt material={cell.material} variant={worldVariant(cell.row, cell.column)} />
        {!cell.deposit && (miningMaterialAt(worldSeed,cell.row,cell.column)==='metal'||worldVariant(cell.row,cell.column)===0) && <span className="infinidrill-block-deposit" aria-hidden="true"><MaterialArt material={miningMaterialAt(worldSeed,cell.row,cell.column)}/></span>}
        {cell.deposit && <span className="infinidrill-block-deposit" data-deposit-kind={cell.deposit} aria-hidden="true">{cell.deposit === 'crystals' ? '💎' : '🪙'}</span>}
      </div>)}
      {Array.from(openings.values()).map(opening => <div key={`open-${opening.row}`} className="infinidrill-world-open" data-cleared-row={opening.row}
        style={{ width: (opening.last - opening.first + 1) * view.cellSize, height: view.cellSize, left: size.width / 2 + (opening.first - .5) * view.cellSize, top: (opening.row - firstRow) * view.tileSize }} />)}
      {edges.map(edge => {
        const left = size.width / 2 + (edge.column - .5) * view.cellSize;
        const top = (edge.row - firstRow) * view.tileSize;
        const vertical = edge.side === 'left' || edge.side === 'right';
        return <span key={`${edge.row}:${edge.column}:${edge.side}`} className="infinidrill-tunnel-edge" data-edge-side={edge.side} style={{
          width: view.cellSize, height: view.cellSize * .45,
          left: vertical ? left + (edge.side === 'right' ? .5 : -.5) * view.cellSize : left,
          top: vertical ? top + view.cellSize * .275 : top + (edge.side === 'bottom' ? .775 : -.225) * view.cellSize,
          transform: `rotate(${edge.side === 'left' ? 90 : edge.side === 'right' ? -90 : edge.side === 'top' ? 180 : 0}deg)`,
        }}><EdgeArt material={edge.material} variant={worldVariant(edge.row, edge.column)} /></span>;
      })}
      {movement?.laser && Math.abs(depth - movement.laser.from) < .001 && <div className="infinidrill-laser" data-laser-side={movement.laser.left + movement.laser.right < 0 ? 'left' : 'right'} style={{
        left: size.width / 2 + (movement.laser.left - .5) * view.cellSize,
        top: (movement.laser.from - firstRow) * view.tileSize,
        width: (movement.laser.right - movement.laser.left + 1) * view.cellSize,
        height: (movement.laser.to - movement.laser.from) * view.tileSize,
      }}><LaserBeams shot={movement.laser} cellSize={view.cellSize} tileSize={view.tileSize} />
      {(movement.laser.steps ?? [movement.laser]).map((step, index) => <span key={index} data-laser-step={index} data-laser-column={step.left} style={{
        left: (step.left - movement.laser!.left) * view.cellSize,
        top: (step.from - movement.laser!.from) * view.tileSize,
        width: (step.right - step.left + 1) * view.cellSize,
        height: (step.to - step.from) * view.tileSize,
      }} />)}</div>}
    </div>
    <div className={`infinidrill-world-drill ${engineRunning && !reducedMotion ? 'is-engine-running' : ''}`} style={{ width: machineWidth, height: machineHeight, left: size.width / 2 - machineWidth * .08, top: view.drillY - machineHeight }}>
      <div className="infinidrill-engine-shake"><div className={`infinidrill-world-motion ${moving ? falling ? 'is-falling' : 'is-bouncing' : ''}`}>{children}</div></div>
      {canPet && <button type="button" className="infinidrill-pet-machine" aria-label={uiText("Send hearts from the cabin")} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }} onClick={() => setHearts({ id: ++heartSequence.current, count: 1 + Math.floor(Math.random() * 5) })} />}
      {hearts && <div className="infinidrill-heart-burst" aria-hidden="true">{Array.from({ length: hearts.count }, (_, index) => {
        const offset = index - (hearts.count - 1) / 2;
        return <span key={`${hearts.id}:${index}`} className="infinidrill-chubby-heart" style={{ '--heart-x': `${offset * 32}px`, '--heart-y': `${-38 - (1 - Math.abs(offset) / Math.max(1, (hearts.count - 1) / 2)) * 24}px`, animationDelay: `${index * 40}ms` } as CSSProperties}>
          <svg viewBox="0 0 32 32"><path d="M16 28C12 24 3 18 3 11C3 3 12 2 16 8C20 2 29 3 29 11C29 18 20 24 16 28Z" /><path className="infinidrill-heart-shine" d="M8 10Q9 6 12 8" /></svg>
        </span>;
      })}</div>}
    </div>
    {burst && movement && <div className="infinidrill-debris-layer" aria-hidden="true">
      {fragments.map(fragment => <span key={`${burst}:${fragment.id}`} className="infinidrill-debris" style={{
        left: size.width / 2, top: view.drillY - view.tileSize * .25,
        width: view.cellSize * .6, height: view.cellSize * .6,
        '--debris-x': `${fragment.direction * fragment.reach * view.tileSize}px`, '--debris-y': `${-fragment.lift * view.tileSize}px`,
        '--debris-turn': `${fragment.direction * (35 + fragment.id * 8)}deg`, animationDelay: `${fragment.id % 4 * .03}s`,
      } as CSSProperties}><BlockArt material={terrainMaterial(movement.from)} variant={fragment.id % 3} /></span>)}
    </div>}
    <div className="infinidrill-world-shade" aria-hidden="true" />
    <div className="infinidrill-layer-tag">{MATERIAL_NAMES[material]}<small>{uiText("Level ")}{level} / 18</small></div>
    <div className="infinidrill-world-ruler" aria-hidden="true">
      {view.rows.filter(row => row >= 0 && row <= 360 && (row % 4 === 0 || row === 360)).map(row => {
        const y = (row - view.cameraRow) * view.tileSize;
        return y >= 8 && y < size.height - 12 ? <span key={row} style={{ top: y }}>{row === 0 ? uiText("Surface") : row === 360 ? uiText("Core") : `${row * 6} m`}</span> : null;
      })}
    </div>
    {thought}
  </section>;
});
