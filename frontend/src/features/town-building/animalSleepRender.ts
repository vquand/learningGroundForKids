import {SHEEP_DREAM_ATLAS} from './sheepDreamAtlas.ts';
import {sheepDreamOpacity,sheepDreamPose,sleepLetters,type SleepGroup} from './animalSleep.ts';

function cloudPath(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number) {
    ctx.beginPath();ctx.moveTo(x+w*.16,y+h*.82);
    ctx.bezierCurveTo(x+w*.02,y+h*.84,x-w*.04,y+h*.55,x+w*.08,y+h*.48);
    ctx.bezierCurveTo(x+w*.02,y+h*.25,x+w*.20,y+h*.14,x+w*.30,y+h*.22);
    ctx.bezierCurveTo(x+w*.32,y-h*.05,x+w*.58,y-h*.08,x+w*.66,y+h*.14);
    ctx.bezierCurveTo(x+w*.82,y+h*.03,x+w*.98,y+h*.20,x+w*.90,y+h*.48);
    ctx.bezierCurveTo(x+w*1.04,y+h*.57,x+w*.98,y+h*.85,x+w*.84,y+h*.83);
    ctx.bezierCurveTo(x+w*.79,y+h*1.03,x+w*.57,y+h*1.03,x+w*.48,y+h*.90);
    ctx.bezierCurveTo(x+w*.34,y+h*1.05,x+w*.15,y+h,x+w*.16,y+h*.82);ctx.closePath();
}
/** Decorative sleep UI: nearby sheep replace zzZ with a six-pose jumping dream. */
export function drawAnimalSleep(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,groups:readonly SleepGroup[],timeMs:number,tile:number,offsetX:number,offsetY:number,width:number,height:number,zoom:number,reduced:boolean) {
    for(const group of groups){
        const px=offsetX+group.y*tile,py=offsetY+group.x*tile;
        if(px<-tile||px>width+tile||py<-tile||py>height+tile)continue;
        const dreamAlpha=group.sheep?sheepDreamOpacity(zoom):0;
        if(dreamAlpha>0){
            const w=Math.min(Math.max(42,tile*2.8),width-12),h=w*.66;
            const x=Math.max(6,Math.min(width-w-6,px-w/2));
            let y=py-tile*.85-h;if(y<6)y=Math.min(height-h-6,py+tile*.25);
            ctx.save();
            // Scale the cloud, thought dots, fence, sheep and strokes together.
            ctx.translate(px,py-tile*.6);ctx.scale(.5,.5);ctx.translate(-px,-py+tile*.6);
            ctx.globalAlpha=dreamAlpha;ctx.fillStyle='#fff9e9';ctx.strokeStyle='#826851';ctx.lineWidth=Math.max(1,tile*.055);
            for(const [dx,dy,r] of [[0,0,.09],[-.09,-.18,.13]]){
                ctx.beginPath();ctx.arc(px+dx!*tile,py+dy!*tile-tile*.6,tile*r!,0,Math.PI*2);ctx.fill();ctx.stroke();
            }
            cloudPath(ctx,x,y,w,h);ctx.fill();ctx.stroke();ctx.clip();
            const ground=y+h*.84,center=x+w*.5;
            ctx.strokeStyle='#b7c79a';ctx.lineWidth=Math.max(1,h*.05);ctx.beginPath();ctx.moveTo(x+w*.08,ground);ctx.lineTo(x+w*.92,ground);ctx.stroke();
            ctx.strokeStyle='#9b7553';ctx.lineWidth=Math.max(1.5,w*.032);ctx.lineCap='round';
            for(const lift of [.12,.25]){ctx.beginPath();ctx.moveTo(center-w*.13,ground-h*lift);ctx.lineTo(center+w*.13,ground-h*lift);ctx.stroke();}
            for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(center+side*w*.1,ground);ctx.lineTo(center+side*w*.1,ground-h*.34);ctx.stroke();}
            const pose=sheepDreamPose(timeMs,group.phase,reduced),atlas=SHEEP_DREAM_ATLAS,sheet=images.get(atlas.file);
            if(sheet?.complete&&sheet.naturalWidth){
                const frame=atlas.frames[pose.frame]!,c=frame.crop,scale=Math.min(w*.38/atlas.maxWidth,h*.36/atlas.maxHeight);
                ctx.globalAlpha=dreamAlpha*pose.alpha;
                ctx.drawImage(sheet,c[0],c[1],c[2],c[3],x+w*(.18+pose.x*.64)-frame.anchor[0]*scale,ground-h*.18-pose.lift*h-frame.anchor[1]*scale,c[2]*scale,c[3]*scale);
            }
            ctx.restore();
        }
        const letterAlpha=1-dreamAlpha;if(letterAlpha<=0)continue;
        const labelX=Math.max(5,Math.min(width-tile*.7,px+tile*.18)),labelY=py-tile*.65;
        ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
        for(const letter of sleepLetters(timeMs,group.phase,reduced)){
            ctx.globalAlpha=letter.alpha*letterAlpha;ctx.font=`800 ${Math.max(10,tile*letter.size)}px Nunito, sans-serif`;
            const x=labelX+letter.x*tile,y=labelY+letter.y*tile;
            ctx.strokeStyle='#665546';ctx.lineWidth=Math.max(2,tile*.09);ctx.strokeText(letter.letter,x,y);
            ctx.fillStyle='#fff3d5';ctx.fillText(letter.letter,x,y);
        }
        ctx.restore();
    }
}
