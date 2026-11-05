import type {TownState,Season} from '../../../../server/src/town-building/game.ts';
import {uiText} from '../../i18n/uiText';
import {MOMENT_ATLASES,type MomentFile} from './momentAtlas.ts';
import {SEASONS} from './townAtlas.ts';
import type {AnimalMoments} from './animalMoments.ts';

type Geometry={tile:number;x:number;y:number};
export function drawMomentSprite(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,file:MomentFile,index:number,cx:number,bottom:number,scale:number,alpha=1,rotate=0){
    const image=images.get(file);if(!image?.complete||!image.naturalWidth)return;
    const c=MOMENT_ATLASES[file].rects[index]!,w=c[2]*scale,h=c[3]*scale;
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(cx,bottom-h/2);if(rotate)ctx.rotate(rotate);ctx.drawImage(image,c[0],c[1],c[2],c[3],-w/2,-h/2,w,h);ctx.restore();
}
/** Shared overlay at the actual rendered head anchor; no frame-local objects or timers. */
export function drawShears(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,x:number,y:number,tile:number,clock:number,reduced:boolean){
    const crop=MOMENT_ATLASES['shears-v1'].rects[0];
    drawMomentSprite(ctx,images,'shears-v1',0,x,y-(reduced?0:Math.sin(clock*4)*tile*.035),tile*.35/Math.max(crop[2],crop[3]));
}
/** Grass tufts, leaf piles and pecked bugs: on the ground, under the animals. */
export function drawMomentGround(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,moments:AnimalMoments,g:Geometry,season:Season){
    const tile=g.tile,row=SEASONS.indexOf(season),grassScale=tile*.62/172;
    for(const tuft of moments.grass){
        const stage=tuft.growth<.15?0:tuft.growth<.4?1:tuft.growth<.75?2:3;
        drawMomentSprite(ctx,images,'grass-tufts-v1',row*4+stage,g.x+(tuft.y+.5)*tile,g.y+(tuft.x+.82)*tile,grassScale);
    }
    for(const m of moments.mushrooms)drawMomentSprite(ctx,images,'mushroom-v1',m.variant,g.x+m.y*tile,g.y+(m.x+.25)*tile,tile*.33/Math.max(...MOMENT_ATLASES['mushroom-v1'].rects[m.variant].slice(2)),Math.min(1,(60-m.age)/10));
    for(const pile of moments.leafPiles)drawMomentSprite(ctx,images,'leaf-piles-v1',pile.scattered?1:0,g.x+(pile.y+.5)*tile,g.y+(pile.x+.85)*tile,tile*.8/358);
    for(const peck of moments.pecks)if(peck.arrived&&peck.age<1.2)drawMomentSprite(ctx,images,'animal-icons-v1',4+peck.bug,g.x+(peck.y+.28)*tile,g.y+(peck.x+.62)*tile,tile*.26/358,Math.min(1,(1.2-peck.age)*3));
}
/** Honk and hoot bubbles, sparkles, flying leaves and summer splashes, over the animals. */
export function drawMomentOverlay(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,moments:AnimalMoments,g:Geometry,showStatus=true){
    const tile=g.tile;
    for(const splash of moments.splashes){
        const cx=g.x+splash.y*tile,cy=g.y+splash.x*tile,r=tile*(.15+splash.age*.35);
        ctx.save();ctx.globalAlpha=1-splash.age;ctx.strokeStyle='#e8f6f7';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(cx,cy,r,r*.35,0,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#e8f6f7';for(let i=0;i<3;i++){const a=i*2.1+splash.age*2;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r*.7,cy-tile*.1-Math.sin(splash.age*Math.PI)*tile*.2,tile*.035,0,Math.PI*2);ctx.fill();}
        ctx.restore();
    }
    for(const leaf of moments.leaves){
        const t=leaf.age/1.6,cx=g.x+(leaf.y+Math.cos(leaf.spin)*t*.9)*tile,cy=g.y+(leaf.x-Math.sin(t*Math.PI)*.7+.6)*tile;
        drawMomentSprite(ctx,images,'leaf-piles-v1',2,cx,cy,tile*.28/256,1-t,leaf.spin+t*4);
    }
    for(const s of showStatus?moments.sparkles:[]){
        const cx=g.x+s.y*tile,cy=g.y+(s.x+.3-s.age*.4)*tile,r=tile*.12*(1+s.age);
        ctx.save();ctx.globalAlpha=1-s.age/.9;ctx.fillStyle='#fff3b0';ctx.strokeStyle='#c9902f';ctx.lineWidth=1;
        for(const [dx,dy,k] of [[0,0,1],[.18,-.12,.6],[-.16,-.08,.5]] as const){const x=cx+dx*tile,y=cy+dy*tile,q=r*k;ctx.beginPath();ctx.moveTo(x,y-q);ctx.lineTo(x+q*.3,y-q*.3);ctx.lineTo(x+q,y);ctx.lineTo(x+q*.3,y+q*.3);ctx.lineTo(x,y+q);ctx.lineTo(x-q*.3,y+q*.3);ctx.lineTo(x-q,y);ctx.lineTo(x-q*.3,y-q*.3);ctx.closePath();ctx.fill();ctx.stroke();}
        ctx.restore();
    }
    for(const bubble of showStatus?moments.bubbles:[]){
        const text=uiText(bubble.text==='honk'?'Honk!':'Hoo-hoo!'),cx=g.x+bubble.y*tile,cy=g.y+(bubble.x-1.25-bubble.age*.2)*tile;
        ctx.save();ctx.globalAlpha=Math.min(1,(1.4-bubble.age)*3);ctx.font=`700 ${Math.max(10,tile*.34)}px "Nunito",system-ui,sans-serif`;
        const w=ctx.measureText(text).width+tile*.4,h=tile*.5;
        ctx.fillStyle='#fffaf0';ctx.strokeStyle='#6b4935';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(cx-w/2,cy-h/2,w,h,h/2);ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx-tile*.08,cy+h/2-1);ctx.lineTo(cx,cy+h/2+tile*.14);ctx.lineTo(cx+tile*.08,cy+h/2-1);ctx.fill();
        ctx.fillStyle='#5b3a2a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,cx,cy+1);ctx.restore();
    }
}

/** Saved crop/grass droppings and flower bushes; reads never invent growth or a reward. */
export function drawServerHabits(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,state:TownState,g:Geometry,season:Season,time:number,reduced:boolean){
    const tile=g.tile;
    for(const b of state.bushes??[]){const index=SEASONS.indexOf(season),crop=MOMENT_ATLASES['flower-bush-v1'].rects[index]!;drawMomentSprite(ctx,images,'flower-bush-v1',index,g.x+(b.y+.5)*tile,g.y+(b.x+.85)*tile,tile*.66/Math.max(crop[2],crop[3]));}
    const props=[...(state.droppings??[])];
    for(const patch of state.entities)if(patch.garden?.poop){const {slot,at}=patch.garden.poop;props.push({x:patch.x+Math.floor(slot/2),y:patch.y+slot%2,at});}
    for(const p of props){
        const x=g.x+(p.y+.68)*tile,y=g.y+(p.x+.82)*tile,r=tile*.085;
        ctx.save();ctx.fillStyle='#976747';ctx.strokeStyle='#624431';ctx.lineWidth=Math.max(1,tile*.035);
        ctx.beginPath();ctx.ellipse(x,y,r,r*.85,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.lineWidth=Math.max(.65,tile*.018);ctx.lineCap='round';
        for(let i=0;i<2;i++){const dx=(i-.5)*r,wiggle=reduced?0:Math.sin(time/650+i*2)*r*.25;ctx.beginPath();ctx.moveTo(x+dx,y-r*1.5);ctx.bezierCurveTo(x+dx-r*.5+wiggle,y-r*2,x+dx+r*.5+wiggle,y-r*2.6,x+dx,y-r*3);ctx.stroke();}
        ctx.restore();
    }
}
