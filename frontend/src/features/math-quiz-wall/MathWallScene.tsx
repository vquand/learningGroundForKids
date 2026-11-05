import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { MathAnimal, MathSession, WallStyle } from '../../api/mathWall';
import { AnimalSprite2D } from './AnimalSprite2D';
import { ANIMAL_NAMES, POSE_NAMES, type AnimalPose } from './animalSprites';
import { initialBuddyMotion, stepBuddyMotion, buddyPose } from './buddyMotion';
import { wallOutcome } from './wallOutcome';
import { wallOpeningFrame } from './wallOpening';
import { minecraftLayout } from './minecraftLayout';
import { WALL_MATERIALS, wallMaterialStyle, wallMaskStyle } from './wallMaterial';
import { getUiLanguage } from '../../lib/uiLanguage';

const WALL_COLORS = { easy: '#b6cf9e', medium: '#f1d382', hard: '#e8af7d' };
const LANE_LEFT = 16, LANE_WIDTH = 68 / 3;
interface Props { animal: MathAnimal; wall: WallStyle; session: MathSession | null; now: number; onLane: (lane: number) => void; disabled?: boolean }

export function MathWallScene(props: Props) {
  useUiLanguage();
  const host = useRef<HTMLDivElement>(null), actor = useRef<HTMLDivElement>(null), actorBody = useRef<HTMLDivElement>(null);
  const wall = useRef<HTMLDivElement>(null), celebration = useRef<HTMLDivElement>(null), splash = useRef<HTMLSpanElement>(null);
  const answers = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const [size, setSize] = useState(320), [pose, setPose] = useState<AnimalPose>(props.session ? 'rear' : 'right');
  const [assetError, setAssetError] = useState(false);
  const sizeRef = useRef(size); sizeRef.current = size;
  useEffect(() => {
    const resize = () => {
      if (!host.current) return;
      setSize(Math.max(1, Math.min(host.current.clientWidth, host.current.clientHeight)));
    };
    const observer = new ResizeObserver(resize); observer.observe(host.current!); resize();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let buddy = initialBuddyMotion(), previous = performance.now(), animation = 0;
    let displayedPose: AnimalPose = props.session ? 'rear' : 'right';
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const frame = (timestamp: number) => {
      const reducedMotion = motionPreference.matches;
      const dt = Math.min((timestamp - previous) / 1000, .05); previous = timestamp;
      const p = latest.current, s = p.session, board = sizeRef.current;
      const paused = s?.phase === 'paused' || s?.phase === 'finished';
      const target = ((s?.lane ?? 1) - 1) * 2.8;
      buddy = reducedMotion ? { ...initialBuddyMotion(), x: target, target } : stepBuddyMotion(buddy, target, dt, paused || Boolean(s?.result));
      if (s?.result) buddy = { ...buddy, x: target, target, phase: 'idle' };
      const nextPose = s?.result === 'splash' ? 'surprised' : s ? buddyPose(buddy) : 'right';
      if (nextPose !== displayedPose) { displayedPose = nextPose; setPose(nextPose); }
      const phase = s?.phase === 'paused' ? s.pausedFrom : s?.phase;
      const timeLeft = paused ? s!.remaining : s ? Math.max(0, s.deadline - p.now) : 10000;
      const progress = s ? Math.min(1, Math.max(0, 1 - timeLeft / ({ easy: 10000, medium: 15000, hard: 20000 }[s.difficulty]))) : .1;
      const resultProgress = phase === 'resolved' ? Math.min(1, Math.max(0, 1 - timeLeft / 2200)) : s?.phase === 'finished' && s.result ? 1 : 0;
      const outcome = s?.result ? wallOutcome(s.result, resultProgress) : { bottom: 36 + progress * 29, opacity: 1 };
      if (wall.current) {
        wall.current.style.top = outcome.bottom + '%';
        wall.current.style.opacity = String(outcome.opacity);
        wall.current.style.visibility = outcome.opacity > .01 ? 'visible' : 'hidden';
      }
      if (answers.current) {
        answers.current.style.top = outcome.bottom + '%';
        answers.current.style.opacity = String(outcome.opacity);
        answers.current.style.visibility = outcome.opacity > .01 ? 'visible' : 'hidden';
      }
      const x = 50 + buddy.x / 2.8 * LANE_WIDTH;
      const falling = s?.result === 'splash';
      const fall = Math.min(1, resultProgress * 2);
      if (actor.current) {
        actor.current.style.left = x + '%';
        actor.current.style.top = (65 + (falling ? fall * 23 : 0)) + '%';
        actor.current.style.zIndex = '8';
      }
      const bob = falling && !reducedMotion ? -Math.sin(resultProgress * Math.PI) * board * .025 : 0;
      const tilt = falling && !reducedMotion ? -12 * Math.sin(resultProgress * Math.PI) : 0;
      if (actorBody.current) {
        actorBody.current.style.transform = 'translateY(' + bob + 'px) rotate(' + tilt + 'deg)';
        actorBody.current.style.clipPath = falling ? 'inset(0 0 ' + Math.max(0, (resultProgress - .5) * 36) + '% 0)' : 'none';
      }
      if (celebration.current) {
        celebration.current.style.display = s?.result === 'pass' ? 'block' : 'none';
        celebration.current.style.left = (50 + target / 2.8 * LANE_WIDTH) + '%';
        celebration.current.querySelectorAll<HTMLElement>('.math-party-star').forEach((star, i) => {
          const angle = i * Math.PI * 2 / 7;
          const spread = board * (.065 + resultProgress * .025);
          star.style.transform = 'translate(-50%,-50%) translate(' + (Math.sin(angle) * spread) + 'px,' + (-board * (.13 + resultProgress * .04) + Math.cos(angle) * board * .05) + 'px) rotate(' + (i * 25 + resultProgress * 70) + 'deg) scale(' + Math.min(1, resultProgress * 4) + ')';
        });
        celebration.current.querySelectorAll<HTMLElement>('.math-party-flowers').forEach(flowers => {
          flowers.style.opacity = String(Math.min(1, resultProgress * 5));
          flowers.style.transform = 'scale(' + Math.min(1, resultProgress * 5) + ')';
        });
        const heart = celebration.current.querySelector<HTMLElement>('.math-party-heart');
        if (heart) heart.style.transform = 'translate(-50%,calc(-100% - ' + (board * (.155 + resultProgress * .03)) + 'px)) scale(' + (.8 + Math.sin(resultProgress * Math.PI) * .2) + ')';
      }
      if (splash.current) {
        splash.current.style.left = x + '%';
        splash.current.style.visibility = falling && resultProgress > .25 ? 'visible' : 'hidden';
        splash.current.style.transform = 'translate(-50%,-50%) scale(' + (.7 + Math.sin(resultProgress * Math.PI) * .35) + ')';
      }
      animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animation);
  }, [props.animal]);

  const s = props.session, vi = getUiLanguage() === 'vi', language = vi ? 1 : 0;
  const label = ANIMAL_NAMES[props.animal][language] + ', ' + (!s ? vi ? 'nhìn bên phải' : 'right view' : POSE_NAMES[pose][language]);
  const enabled = Boolean(s && s.phase === 'playing' && props.now < s.deadline && !props.disabled);
  const color = WALL_COLORS[s?.difficulty ?? 'easy'];
  const choices = s?.question.response.mode === 'choice' ? s.question.response.choices : ['4', '5', '6'];
  const actorSize = Math.max(36, size * .145);
  const wallFrame = wallOpeningFrame(s), contentTop = WALL_MATERIALS[props.wall].contentTop;
  const blocks = minecraftLayout(size * .68, size * (.68 / 3) * (1 - contentTop));
  return <div ref={host} className="math-arena" role="group" aria-label={vi ? 'Ba làn, tường đang tới và hồ nước' : uiText("Three answer lanes, an approaching wall, and a pool")}>
    <div className="math-flat-board" style={{ width: size, height: size, '--board-size': size + 'px' } as CSSProperties}>
      <img className="math-garden-background" src="/minigames/math-quiz-wall/arena-garden-v2.webp" alt="" aria-hidden="true" onError={() => setAssetError(true)} />
      {s && <div className="math-selected-path" aria-hidden="true" style={{ left: LANE_LEFT + s.lane * LANE_WIDTH + '%', width: LANE_WIDTH + '%' }} />}
      {s && [0, 1, 2].map(lane => <button key={lane} className="math-lane-zone" type="button" tabIndex={-1} aria-hidden="true" disabled={!enabled} style={{ left: LANE_LEFT + lane * LANE_WIDTH + '%', width: LANE_WIDTH + '%' }} onClick={() => props.onLane(lane)} />)}
      <div ref={wall} className={'math-moving-wall' + (props.wall === 'blocks' ? ' is-minecraft' : '')} data-wall-frame={wallFrame} aria-hidden="true" style={{ '--wall-color': color, ...(props.wall === 'blocks' ? wallMaskStyle(wallFrame) : {}) } as CSSProperties}>
        {props.wall === 'blocks' ? <span className="math-wall-art math-minecraft-grid" data-rows={blocks.rows} data-columns={blocks.columns} style={{ top: `${contentTop * 100}%`, gridTemplateColumns: 'repeat(' + blocks.columns + ',' + blocks.blockSize + 'px)', gridTemplateRows: 'repeat(' + blocks.rows + ',' + blocks.blockSize + 'px)' }}>
          {Array.from({ length: blocks.rows * blocks.columns }, (_, i) => <span key={i} className="math-minecraft-block" style={{ backgroundImage: 'url(/minigames/math-quiz-wall/' + (i < blocks.columns ? 'minecraft-grass-block.png' : 'minecraft-dirt-block.png') + ')' }} />)}
        </span> : <span className="math-wall-art" style={wallMaterialStyle(props.wall, wallFrame)} />}
      </div>
      <div ref={answers} className="math-wall-answers" aria-hidden="true" style={{ '--wall-color': color } as CSSProperties}>
        {[0, 1, 2].map(lane => <div key={lane} className={'math-wall-answer-zone' + (s?.result && s.correctLane === lane ? ' is-opening' : '')} onClick={() => enabled && props.onLane(lane)}>
          <span className="math-wall-answer">{choices[lane]}</span>
        </div>)}
      </div>
      <div ref={actor} className={'math-flat-actor' + (s?.result === 'splash' ? ' is-splash' : '')}>
        <span className="math-flat-shadow" aria-hidden="true" />
        <div ref={actorBody} className="math-flat-actor-body"><AnimalSprite2D animal={props.animal} pose={pose} size={actorSize} groundAligned label={label} walking={Boolean(s && !s.result && s.phase !== 'finished')} paused={s?.phase === 'paused'} /></div>
      </div>
      <div ref={celebration} className="math-flat-celebration" aria-hidden="true">
        <span className="math-garden-fx math-party-flowers left" /><span className="math-garden-fx math-party-flowers right" />
        {Array.from({ length: 7 }, (_, i) => <span key={i} className="math-garden-fx math-party-star" />)}
        <span className="math-garden-fx math-party-heart" />
      </div>
      <span ref={splash} className="math-garden-fx math-flat-splash" aria-hidden="true" />
      {s && <div className={'math-lane-buttons' + (s.result ? ' is-outcome' : '')} role="group" aria-label={vi ? 'Chọn làn' : uiText("Choose a lane")}>{choices.map((answer, lane) => <button type="button" key={lane} style={{ left: LANE_LEFT + (lane + .5) * LANE_WIDTH + '%', top: '72%' }} aria-pressed={s.lane === lane} aria-label={(vi ? 'Làn' : uiText("Lane")) + ' ' + (lane + 1) + ': ' + answer} disabled={!enabled} onClick={() => props.onLane(lane)}><kbd>{lane + 1}</kbd></button>)}</div>}
    </div>
    {assetError && <p role="alert" className="math-art-error">{vi ? 'Chưa tải được hình ảnh. Hãy tải lại trang để thử lại.' : uiText("The garden artwork could not load. Reload the page to try again.")}</p>}
  </div>;
}
