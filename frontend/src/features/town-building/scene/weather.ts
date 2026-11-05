import type {Environment} from '../../../../../server/src/town-building/environment';

/** Rain and snow over every map; a calm tint replaces motion for reduced motion. */
export function drawPrecipitation(ctx:CanvasRenderingContext2D,environment:Environment,width:number,height:number,time:number,reduced:boolean){
    if((environment.precipitation==='rain'||environment.precipitation==='snow')&&!reduced){
        ctx.save();ctx.strokeStyle='rgba(220,244,255,.68)';ctx.fillStyle='rgba(255,255,250,.9)';ctx.lineWidth=1.5;
        for(let i=0;i<48;i++){
            const x=i*173%Math.max(1,width),y=(i*113+time*(environment.precipitation==='rain'?.22:.025))%Math.max(1,height);
            ctx.beginPath();
            if(environment.precipitation==='rain'){ctx.moveTo(x,y);ctx.lineTo(x-4,y+13);ctx.stroke();}
            else{ctx.arc(x+Math.sin(time/1400+i)*8,y,2,0,Math.PI*2);ctx.fill();}
        }
        ctx.restore();
    }
    if(environment.precipitation==='rain'&&reduced){ctx.fillStyle='rgba(110,148,161,.14)';ctx.fillRect(0,0,width,height);}
}
