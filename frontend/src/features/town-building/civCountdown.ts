import type {CivBusiness} from '../../../../server/src/town-building/civCatalog.ts';
import type {CivClock,workStatus} from '../../../../server/src/town-building/civ.ts';
export interface ReturnCountdown {remainingMs:number;durationMs:number}
export function returnCountdown(business:CivBusiness,statuses:ReturnType<typeof workStatus>[],clock:CivClock,clockAgeMs:number):ReturnCountdown|null {
    if(!statuses.length||statuses.some(status=>status.kind==='working'||status.kind==='unknown'))return null;
    const away=Math.min(...statuses.map(status=>status.returnInMs??Infinity));
    if(Number.isFinite(away))return {remainingMs:away,durationMs:30000+(business.icon%3)*15000};
    const time=/^(\d{2}):(\d{2})$/.exec(clock.localTime??'');if(!time)return null;
    const minutes=Number(time[1])*60+Number(time[2]);
    return {remainingMs:Math.max(0,(business.opens*60-minutes+1440)%1440*60000-clockAgeMs),durationMs:(24-business.closes+business.opens)*3600000};
}
export function countdownHands(countdown:ReturnCountdown) {
    const fraction=Math.max(0,Math.min(1,countdown.remainingMs/countdown.durationMs));
    return {long:-Math.PI/2+fraction*Math.PI*2,short:-Math.PI/2+fraction*Math.PI/6};
}
/** Remaining time decreases the angles: both hands sweep counterclockwise. No labels. */
export function drawCountdownClock(ctx:CanvasRenderingContext2D,x:number,y:number,radius:number,countdown:ReturnCountdown) {
    const hands=countdownHands(countdown);
    ctx.save();ctx.fillStyle='#fff8e7';ctx.strokeStyle='#72513a';ctx.lineWidth=Math.max(1,radius*.15);
    ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.lineCap='round';
    for(let i=0;i<12;i++){
        const angle=i*Math.PI/6;ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*radius*.81,y+Math.sin(angle)*radius*.81);
        ctx.lineTo(x+Math.cos(angle)*radius*.88,y+Math.sin(angle)*radius*.88);ctx.stroke();
    }
    for(const [angle,length] of [[hands.long,.68],[hands.short,.43]]){
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle!)*radius*length!,y+Math.sin(angle!)*radius*length!);ctx.stroke();
    }
    ctx.beginPath();ctx.arc(x,y,radius*.08,0,Math.PI*2);ctx.fillStyle='#72513a';ctx.fill();ctx.restore();
}
