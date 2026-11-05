import {drawCountdownClock,returnCountdown} from './civCountdown';
import { businessFor } from '../../../../server/src/town-building/civCatalog';
import { workStatus, type CivClock } from '../../../../server/src/town-building/civ';
import { entityFootprint, type Entity } from '../../../../server/src/town-building/game';
import { CIV_ART, drawCivPerson, type CivAtlas } from './civArt';
import { alongCivPath, stepCivWorld, type CivWorld } from './civWorld';

function sprite(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,atlas:CivAtlas,index:number,x:number,y:number,size:number) {
    const image=images.get(atlas.file),c=atlas.rects[index];if(!image?.complete||!image.naturalWidth||!c)return;
    const scale=size/Math.max(c[2]!,c[3]!);ctx.drawImage(image,c[0]!,c[1]!,c[2]!,c[3]!,x-c[2]!*scale/2,y-c[3]!*scale,c[2]!*scale,c[3]!*scale);
}
/** Decorative positions never feed completion, supplies, prosperity, or badges. */
/** `vehicles` collects each moving-in vehicle's tile position (centre at +.5), e.g. for farm gates to swing open. */
export function drawCivWorld(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,world:CivWorld,entities:Entity[],activeMs:number,clock:CivClock,delta:number,interpolationMs:number,tile:number,offsetX:number,offsetY:number,reduced:boolean,vehicles?:{x:number;y:number}[],showStatus=true) {
    stepCivWorld(world,entities,activeMs,clock,Math.min(delta,.05),reduced);
    const pixel=(p:{x:number;y:number})=>({x:offsetX+(p.y+.5)*tile,y:offsetY+(p.x+.75)*tile});
    for(const host of entities){const business=businessFor(host.blueprintId),plan=world.plans.get(host.id);if(!business||!plan||!host.civ)continue;
        if(host.civ.phase!=='ready'){
            const primary=world.people.find(p=>p.hostId===host.id&&!p.guest)!;
            const elapsed=plan.reachable?host.civ.elapsedMs+interpolationMs:primary.clock*1000;
            const driveMs=(Math.max(1,plan.drive.length)+3)*400;
            const drive=plan.drive.length?[-3,-2,-1].map(y=>({x:plan.drive[0]!.x,y})).concat(plan.drive):[plan.parking];
            const parked=reduced||elapsed>=driveMs;
            const position=alongCivPath(drive,parked?drive.length-1:elapsed/400),p=pixel(position);vehicles?.push({x:position.x+.5,y:position.y+.5});
            sprite(ctx,images,CIV_ART.vehicles,(business.vehicle==='truck'?4:0)+['right','left','down','up'].indexOf(position.direction),p.x,p.y,tile*1.6);
            if(plan.reachable&&elapsed>=driveMs&&host.civ.phase==='travelling'){
                const position=alongCivPath(plan.walk,reduced?plan.walk.length-1:(elapsed-driveMs)/650),p=pixel(position);
                business.workers.forEach((_,i)=>{const person=world.people.find(p=>p.id===`${host.id}:${i}`);if(person)drawCivPerson(ctx,images,{...person,direction:position.direction,mode:'carry'},p.x+i*tile*.25,p.y,tile,reduced);});
            }
        }else if(showStatus){
            const statuses=business.workers.map((_,i)=>workStatus(business,activeMs,clock,i));
            const countdown=returnCountdown(business,statuses,clock,world.clockAgeMs);
            if(countdown){
                const p=pixel({x:host.x-.5,y:host.y+(host.direction&&host.direction!=='front'?(entityFootprint(host).length-1)/2:business.id==='tools-smith'?1.5:1)});
                drawCountdownClock(ctx,p.x,p.y,Math.max(7,tile*.34),countdown);
            }
        }
    }
    for(const person of [...world.people].sort((a,b)=>a.x-b.x))if(person.visible){const p=pixel(person);drawCivPerson(ctx,images,person,p.x,p.y,tile,reduced);
        if(showStatus&&person.guest&&person.mode==='idle')sprite(ctx,images,CIV_ART.icons,person.purpose,p.x,p.y-tile*1.05,tile*.5);
    }
}
