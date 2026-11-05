import {lakeTerrainAt} from '../../../../../../server/src/town-building/maps/lake/terrain.ts';
import {LAKE_FISH} from '../../../../../../server/src/town-building/water/catalog.ts';
import {fishBehavior,type FishEnvironment} from '../../../../../../server/src/town-building/water/behavior.ts';
import type {LakeRaft,LakeFish} from '../../../../../../server/src/town-building/maps/lake/types.ts';
const hash=(id:string)=>{let value=0;for(const c of id)value=(Math.imul(value,31)+c.charCodeAt(0))>>>0;return value;};
/** Cosmetic motion only; feeding eligibility uses the authoritative raft center. */
export function lakeFishPosition(raft:LakeRaft,fish:LakeFish,activeSeconds:number,environment?:FishEnvironment):{x:number;y:number} {
    const seed=hash(fish.id),phase=activeSeconds*.18+seed%100;
    const roaming=raft.blueprintId==='friendly';
    const slot=Math.max(0,raft.fish.findIndex(resident=>resident.id===fish.id)),columns=LAKE_FISH[fish.species].size==='small'?3:2;
    const home=roaming?{x:raft.x+1,y:raft.y+1.5}:{x:raft.x+.7+Math.floor(slot/columns)*.4,y:raft.y+(columns===3?.82:1)+(slot%columns)*(columns===3?.68:1)};
    if(environment&&fishBehavior(fish.species,environment).sheltered)return {x:home.x+Math.sin(phase*.25)*(roaming?.12:.035),y:home.y+Math.cos(phase*.25)*(roaming?.15:.05)};
    let x=home.x+Math.sin(phase)*(roaming?2.4:.04),y=home.y+Math.cos(phase*.73)*(roaming?3:.06);
    if(roaming) {
        x=Math.max(.5,Math.min(19.5,x));y=Math.max(8.1,Math.min(36.5,y));
        if(!LAKE_FISH[fish.species].homeDepths.includes(lakeTerrainAt(Math.floor(x),Math.floor(y)))) {
            let low=0,high=1;
            for(let i=0;i<10;i++){const middle=(low+high)/2,xx=home.x+(x-home.x)*middle,yy=home.y+(y-home.y)*middle;if(LAKE_FISH[fish.species].homeDepths.includes(lakeTerrainAt(Math.floor(xx),Math.floor(yy))))low=middle;else high=middle;}
            return {x:home.x+(x-home.x)*low,y:home.y+(y-home.y)*low};
        }
    }
    return {x,y};
}
