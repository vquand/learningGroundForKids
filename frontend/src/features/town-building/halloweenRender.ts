import atlas from './halloweenAtlas.json' with { type: 'json' };
import type { HalloweenState } from '../../../../server/src/town-building/halloween';
import { ghostPosition, HALLOWEEN_GUESTS } from './halloween';
import { ghostJobPose, ghostFacing, stepGhostMotion } from './halloweenWorld';
import { GHOST_ATLAS } from './ghostAtlas';
import { drawGhostSprite } from './ghostAnimation';
import {drawHalloweenLantern,drawLanternGlow} from './lanternRender.ts';

type Images = Map<string, HTMLImageElement>;
interface Geometry { tile: number; offsetX: number; offsetY: number }
export type GhostMotion = Map<number, { x: number; y: number; returning?: boolean }>;
function lantern(ctx: CanvasRenderingContext2D, images: Images, variant: number, hookX: number, hookY: number, width: number) {
  const sheet = images.get('halloweenLanterns'), crop = atlas.lanterns.rects[variant % 6]!;
  if (!sheet?.complete || !sheet.naturalWidth) return;
  const height = width * crop[3]! / crop[2]!;
  ctx.drawImage(sheet, crop[0]!, crop[1]!, crop[2]!, crop[3]!, hookX - width / 2, hookY, width, height);
}
export function drawHalloweenLanterns(ctx: CanvasRenderingContext2D, images: Images, state: HalloweenState | undefined, geometry: Geometry) {
  const posts = images.get('halloweenPosts');
  if (!state || !posts?.complete || !posts.naturalWidth) return;
  for (const lamp of [...state.lanterns].sort((a, b) => a.x - b.x)) {
    drawHalloweenLantern(ctx,images,lamp,geometry);
  }
}
/** This entire layer is drawn after crops, shrubs, trees and ground residents. */
export function drawHalloweenGhosts(ctx: CanvasRenderingContext2D, images: Images, state: HalloweenState | undefined, activeSeconds: number, time: number, reduced: boolean, opacity: number, delta: number, motion: GhostMotion, geometry: Geometry) {
  if (opacity <= 0) return;
  const { tile, offsetX, offsetY } = geometry, sheet = images.get('halloweenGhosts'), original = images.get('ghosts');
  ctx.save(); ctx.globalAlpha = .92 * opacity;
  for (const [index, guest] of HALLOWEEN_GUESTS.entries()) {
    const job = state?.jobs.find(job => job.worker === index);
    if (!job || !sheet?.complete || !sheet.naturalWidth) {
      if (!original?.complete || !original.naturalWidth) continue;
      const helper=state?.workers?.find(w=>w.worker===index);
      const target=helper?{...helper.position,tilt:0}:ghostPosition(guest,time,reduced),previous=motion.get(index)??target;
      const point=stepGhostMotion(previous,target,delta,reduced);
      const moving=Math.hypot(target.x-point.x,target.y-point.y)>.05;
      if(sheet?.complete&&sheet.naturalWidth&&(helper||motion.get(index)?.returning&&moving)) {
        const crop=atlas['ghost-motion'].rects[reduced||!moving?0:Math.floor(time/110)%6]!,size=tile*1.3;
        drawGhostSprite(ctx,sheet,crop,offsetX+point.y*tile,offsetY+(point.x-.55)*tile,size,ghostFacing(previous,target));motion.set(index,{...point,returning:moving});continue;
      }
      const crop = GHOST_ATLAS.rects[index]!, scale = tile * 1.15 / Math.max(crop[2]!, crop[3]!);
      ctx.save(); ctx.translate(offsetX + point.y * tile, offsetY + (point.x - .55) * tile); ctx.rotate(target.tilt);
      ctx.drawImage(original, crop[0]!, crop[1]!, crop[2]!, crop[3]!, -crop[2]! * scale / 2, -crop[3]! * scale / 2, crop[2]! * scale, crop[3]! * scale); ctx.restore();
      motion.set(index, point); continue;
    }
    const pose = ghostJobPose(job, activeSeconds, time, reduced), previous = motion.get(index) ?? pose;
    const point=stepGhostMotion(previous,pose,delta,reduced); motion.set(index, {...point,returning:true});
    const facing=ghostFacing(previous,pose,pose.facing);
    const px = offsetX + point.y * tile, py = offsetY + (point.x - .55) * tile;
    const crop = atlas['ghost-motion'].rects[pose.frame]!, size = tile * 1.3;
    drawGhostSprite(ctx,sheet,crop,px,py,size,facing);
    if (pose.carrying) lantern(ctx, images, pose.variant, px + facing * tile * .35, py + tile * .12, tile * .5);
  }
  ctx.restore();
}
/** Warm halos are added after night tint, never baked into the reusable art. */
export function drawHalloweenGlow(ctx: CanvasRenderingContext2D, state: HalloweenState | undefined, geometry: Geometry, dark: boolean) {
  if (!dark || !state) return;
  for (const lamp of state.lanterns)drawLanternGlow(ctx,lamp,geometry,true);
}
