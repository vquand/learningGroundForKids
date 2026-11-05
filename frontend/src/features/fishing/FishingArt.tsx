import {FloatingHeart, HeartGlyph} from '../../components/emotes/HeartEmote';
import { useId, type ReactNode } from 'react';
import type { FishingBait, FishingCompanion, FishingFish } from '../../api/fishing';
import { BAITS, FISH } from './viewCatalog';

// Measured source windows keep the artwork centered and exclude neighboring
// sprites whose decoration extends into the nominal transparent grid gutter.
const CATCH_CROPS = [
  [15, 65, 332], [370, 45, 354], [718, 34, 378], [1098, 39, 350],
  [10, 371, 362], [366, 386, 352], [726, 363, 368], [1096, 374, 352],
  [3, 702, 365], [353, 693, 379], [725, 700, 380], [1102, 715, 328],
] as const;
const PROP_CROPS = [
  [77, 109, 244], [388, 75, 312], [738, 66, 314], [1089, 67, 326],
  [42, 385, 314], [378, 357, 350], [741, 388, 310], [1078, 368, 332],
  [23, 684, 320], [363, 688, 344], [720, 670, 354], [1079, 682, 336],
] as const;
/** Clip source coordinates, not just the outer SVG viewport: rectangular slots
 * otherwise expose neighboring sprites in preserveAspectRatio's side gutters. */
function SpriteArt({src,crop,width,height,className}:{src:string;crop:readonly[number,number,number,number];width:number;height:number;className:string}){
  const clipId=useId(),[x,y,w,h]=crop;
  return <svg aria-hidden="true" focusable="false" className={className} viewBox={crop.join(' ')} overflow="hidden">
    <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={x} y={y} width={w} height={h}/></clipPath></defs>
    <image href={src} width={width} height={height} clipPath={`url(#${clipId})`}/>
  </svg>;
}
function AtlasArt({ atlas, crop, className }: { atlas: 'catches' | 'props'; crop: readonly [number, number, number]; className: string }) {
  const [x,y,size]=crop;
  return <SpriteArt src={`/minigames/fishing/${atlas}.png`} crop={[x,y,size,size]} width={1448} height={1086} className={className}/>;
}
export interface FriendGreeting { companion: FishingCompanion; id: number }
export function ReadyFriendArt({ companion, greeting }: { companion: FishingCompanion; greeting?: FriendGreeting | null }) {
  const reaction = greeting?.companion === companion ? greeting.id : 0;
  return <span className="fishing-ready-friend" data-companion={companion} aria-hidden="true">
    <span key={`body:${reaction}`} className={`fishing-ready-body ${reaction ? 'is-greeting' : ''}`}>
      <img src={`/minigames/fishing/ready-${companion}.png`} alt="" draggable="false"/>
    </span>
    {reaction > 0 && <FloatingHeart key={`heart:${reaction}`} className="fishing-ready-heart"/>}
  </span>;
}
export function FriendArt({ companion, pose = 0, className = '' }: { companion: FishingCompanion; pose?: number; className?: string }) {
  // Lower poses sit 49px higher in the source sheet; shift their source window
  // to keep the feet on the same bank baseline throughout the reveal.
  const x = pose % 2 * 627, y = pose >= 2 ? 578 : 0;
  return <svg aria-hidden="true" focusable="false" className={`fishing-friend-art ${className}`} viewBox={`${x} ${y} 627 627`} overflow="hidden">
    <image href={`/minigames/fishing/${companion === 'highland' ? 'friend-highland-shaggy' : `friend-${companion}`}.png`} width="1254" height="1254"/>
  </svg>;
}
/** Curl up during an explicit break; keep active cast/float sprites out of the pause pose. */
export function SleepingFriendArt({ companion }: { companion: FishingCompanion }) {
  // Generated tails cross nominal gutters. These measured square windows keep
  // each entire friend while excluding the neighboring cow's tail fragment.
  const x = { highland: 0, capybara: 719, cow: 1440 }[companion];
  return <svg aria-hidden="true" focusable="false" className="fishing-sleeping-friend" data-companion={companion} viewBox={`${x} 0 724 724`} overflow="hidden">
    <image href="/minigames/fishing/sleeping-friends.png" width="2172" height="724"/>
  </svg>;
}
// Measured endpoints of the line painted into each idle/casting sprite, in the
// same source coordinates as FriendArt. Attach the float to that moving frame.
const LINE_ENDS = {
  highland: [[584, 400], [1217.5, 396]],
  capybara: [[557.5, 352], [1179.5, 318]],
  cow: [[582.5, 351], [1190.5, 354]],
} as const;
export function FishingFloat({ companion, pose }: { companion: FishingCompanion; pose: number }) {
  const casting = pose === 1;
  const [x, y] = LINE_ENDS[companion][casting ? 1 : 0];
  return <div className="fishing-float" aria-hidden="true" data-line-x={x} data-line-y={y}
    style={{ left: `${(x - (casting ? 627 : 0)) / 627 * 100}%`, top: `${y / 627 * 100}%` }}><i/><span/></div>;
}
export function CatchArt({ fishId, className = '' }: { fishId?: FishingFish | null; className?: string }) {
  const riverIndex = ['R1', 'R2', 'R3', 'R4', 'R5'].indexOf(fishId ?? '');
  if (riverIndex >= 0) return <SpriteArt src="/minigames/fishing/river-fish.png" crop={[riverIndex%3*512,Math.floor(riverIndex/3)*512,512,512]} width={1536} height={1024} className={`fishing-catch-art ${className}`}/>;
  const index = fishId ? FISH.findIndex(f => f.id === fishId) : 11;
  return <AtlasArt atlas="catches" crop={CATCH_CROPS[index] ?? CATCH_CROPS[11]} className={`fishing-catch-art ${className}`}/>;
}
export function PropArt({ index, className = '' }: { index: number; className?: string }) {
  return <AtlasArt atlas="props" crop={PROP_CROPS[index] ?? PROP_CROPS[0]} className={`fishing-prop-art ${className}`}/>;
}
export function BaitArt({ baitId }: { baitId: FishingBait }) {
  const riverIndex = ['bouncy', 'crunchy', 'master'].indexOf(baitId);
  if (riverIndex >= 0) return <svg aria-hidden="true" focusable="false" className="fishing-prop-art fishing-bait-art" viewBox={`${riverIndex * 724} 0 724 724`} overflow="hidden">
    <image href="/minigames/fishing/river-baits.png" width="2172" height="724"/>
  </svg>;
  return <PropArt index={BAITS.findIndex(b => b.id === baitId)} className="fishing-bait-art"/>;
}
export function BucketArt() {
  return <svg aria-hidden="true" focusable="false" className="fishing-bucket-art" viewBox="100 100 1080 1080">
    <image href="/minigames/fishing/fish-bucket.png" width="1280" height="1280"/>
  </svg>;
}
/** Keep the perch separate from the frog so expressions can change independently. */
export function PondFrog({ children }: { children?: ReactNode }) {
  return <div className="fishing-frog" aria-hidden="true">
    <img className="fishing-frog-leaf" src="/minigames/fishing/frog-lotus-leaf.png" alt="" draggable="false"/>
    <div className="fishing-frog-body">{children ?? <PropArt index={10}/>}</div>
  </div>;
}
export function FishingEmote({ kind }: { kind: 'heart' | 'sweat' | 'annoyed' }) {
  return <svg viewBox="0 0 100 100" className={`fishing-emote is-${kind}`} aria-hidden="true">
    {kind === 'heart' ? <HeartGlyph/> : kind === 'sweat' ? <path d="M50 12c0 0-27 35-27 51a27 27 0 0 0 54 0c0-16-27-51-27-51Z" fill="#b7dce8"/> : <>
      <g className="fishing-thought-bubble" fill="#fff7e8">
        <path d="M24 18C28 6 42 5 51 12C63 3 78 9 81 22C95 25 99 42 88 51C89 65 73 74 61 69C51 79 33 74 29 64C14 67 4 54 10 42C1 31 10 17 24 18Z"/>
        <circle cx="35" cy="82" r="6"/><circle cx="28" cy="95" r="3" strokeWidth="3"/>
      </g>
      <g className="fishing-thought-swirl"><path d="M29 38C40 18 75 24 73 42C72 60 39 63 32 47C26 33 53 25 62 37C70 48 51 56 44 46C39 39 50 34 55 40" fill="none" stroke="#927c9f" strokeWidth="5"/></g>
    </>}
  </svg>;
}
