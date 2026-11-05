import {gateAxis,type Entity} from '../../../../server/src/town-building/game.ts';

/** farm-gate-v1.png (1024×256, four 256 cells): across closed/open, along closed/open. Each orientation shares
 * one box measured from the alpha bounds of both frames, so the gate swings without jumping. */
const GATE={across:{closed:[55,34,150,128],open:[311,34,150,128]},along:{closed:[577,31,88,195],open:[833,31,88,195]}} as const;
export interface GateMover {x:number;y:number}
/** Gates swing open while an animal, person or vehicle is passing within reach (tile units, tile centres at +.5). */
export function drawFarmGates(ctx:CanvasRenderingContext2D,image:HTMLImageElement|undefined,entities:readonly Entity[],movers:readonly GateMover[],tile:number,ox:number,oy:number,reach=.8) {
    if(!image?.complete||!image.naturalWidth)return;
    for(const gate of entities){
        if(gate.blueprintId!=='farm-gate')continue;
        const axis=gateAxis(entities,gate)??'across',open=movers.some(m=>Math.hypot(m.x-(gate.x+.5),m.y-(gate.y+.5))<reach);
        const crop=GATE[axis][open?'open':'closed'],cx=ox+(gate.y+.5)*tile;
        if(axis==='across'){const w=tile*1.04,h=w*crop[3]/crop[2];ctx.drawImage(image,crop[0],crop[1],crop[2],crop[3],cx-w/2,oy+(gate.x+.82)*tile-h,w,h);}
        else{const h=tile*1.3,w=h*crop[2]/crop[3];ctx.drawImage(image,crop[0],crop[1],crop[2],crop[3],cx-w/2,oy+(gate.x+1.05)*tile-h,w,h);}
    }
}
