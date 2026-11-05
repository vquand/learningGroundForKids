export type CoverageTone='gold'|'green'|'teal';
const TONES:Record<CoverageTone,{fill:string;edge:string}>={
 gold:{fill:'#f7d87930',edge:'#d9a94a'},green:{fill:'#8dc77830',edge:'#5f9a4c'},teal:{fill:'#86d5b936',edge:'#548b79'},
};
const areaPaths=new WeakMap<ReadonlySet<string>,{fill:Path2D;edge:Path2D}>();
/** Every area of effect is drawn as whole tiles with a running dashed border.
 * Paths are cached in world space; pan/zoom only transforms them. */
export function drawCoverageArea(ctx:CanvasRenderingContext2D,cells:ReadonlySet<string>,g:{x:number;y:number;tile:number},tone:CoverageTone='teal',time=0,reduced=false){
 if(!cells.size)return;
 let paths=areaPaths.get(cells);
 if(!paths){
  paths={fill:new Path2D(),edge:new Path2D()};
  const next=new Map<string,[number,number][]>(),point=(x:number,y:number)=>`${x},${y}`;
  for(const cell of cells){
   const [row,column]=cell.split(':').map(Number),x=column!,y=row!;
   paths.fill.rect(x,y,1,1);
   for(const [dx,dy,x1,y1,x2,y2]of [[-1,0,0,0,1,0],[0,1,1,0,1,1],[1,0,1,1,0,1],[0,-1,0,1,0,0]]){
    if(cells.has(`${row!+dx!}:${column!+dy!}`))continue;
    const from=point(x+x1!,y+y1!);next.set(from,[...next.get(from)??[],[x+x2!,y+y2!]]);
   }
  }
  // Chain clockwise boundary edges into closed loops so the dashes run continuously.
  for(const [start,ends]of next)while(ends.length){
   const [sx,sy]=start.split(',').map(Number);paths.edge.moveTo(sx!,sy!);
   let at=ends.pop()!;
   for(;;){paths.edge.lineTo(at[0],at[1]);const key=point(at[0],at[1]),more=next.get(key);if(key===start||!more?.length)break;at=more.pop()!;}
   paths.edge.closePath();
  }
  areaPaths.set(cells,paths);
 }
 const colors=TONES[tone];
 ctx.save();ctx.translate(g.x,g.y);ctx.scale(g.tile,g.tile);
 ctx.fillStyle=colors.fill;ctx.strokeStyle=colors.edge;ctx.lineWidth=2.5/g.tile;ctx.setLineDash([6/g.tile,5/g.tile]);
 // Edges are wound clockwise, so a growing offset runs the dashes around the area.
 ctx.lineDashOffset=reduced?0:-(time/45%11)/g.tile;
 ctx.fill(paths.fill);ctx.stroke(paths.edge);ctx.restore();
}
