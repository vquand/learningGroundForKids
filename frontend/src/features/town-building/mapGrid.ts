/** The same quiet placement grid is shared by every Town map's edit mode. */
export function drawMapGrid(ctx:CanvasRenderingContext2D,tile:number,x:number,y:number) {
    ctx.save();ctx.strokeStyle='rgba(87,68,53,.13)';ctx.lineWidth=.75;ctx.beginPath();
    for(let column=0;column<=40;column++){ctx.moveTo(x+column*tile,y);ctx.lineTo(x+column*tile,y+20*tile);}
    for(let row=0;row<=20;row++){ctx.moveTo(x,y+row*tile);ctx.lineTo(x+40*tile,y+row*tile);}
    ctx.stroke();ctx.restore();
}
