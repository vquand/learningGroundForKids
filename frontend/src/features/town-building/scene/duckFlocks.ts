import {duckCoops,duckDoorstep,duckDuty,duckPath,duckWaterRange,type DuckPoint,type WaterWorld} from '../../../../../server/src/town-building/water/ducks.ts';
import type {AnimalResident,AnimalWeather} from '../animalWorld';
interface Flock{coopId:string;allowed:Set<string>;birds:AnimalResident[];center:DuckPoint;route:DuckPoint[];clock:number;rest:number;strolls:number}
const cell=(point:DuckPoint)=>`${Math.floor(point.x)}:${Math.floor(point.y)}`;
/** A stable pseudo-random number for one stroll, so a flock's wandering needs no shared RNG. */
const unit=(seed:string)=>{let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>15;return(h>>>0)/4294967296;};
/** Cosmetic steering for water-duty flocks on any map: one compact school that paddles
 * slowly around its coop's water by day (rain changes nothing) and shelters at the
 * doorstep at night. The 30-second growth help is applied by the server tick, so
 * nothing here talks to the API. Land-duty ducks are left to the shared animal world. */
export class DuckFlocks{
    flocks:Flock[]=[];
    sync(world:WaterWorld,animals:AnimalResident[]){
        this.flocks=duckCoops(world.entities).filter(coop=>duckDuty(world,coop)==='water').flatMap(coop=>{
            const allowed=duckWaterRange(world,coop),birds=animals.filter(a=>a.hostId===coop.id&&a.species==='duck'),door=duckDoorstep(coop,allowed);
            if(!birds.length||!door)return[];
            const old=this.flocks.find(f=>f.coopId===coop.id);
            const center=old&&allowed.has(cell(old.center))?old.center:door;
            return[{coopId:coop.id,allowed,birds,center,route:[],clock:old?.clock??0,rest:old?.rest??0,strolls:old?.strolls??0}];
        });
    }
    steers(animal:AnimalResident){return this.flocks.some(f=>f.birds.includes(animal));}
    step(world:WaterWorld,delta:number,weather:AnimalWeather,reduced=false):void{
        const dt=Math.max(0,Math.min(.05,delta));
        for(const flock of this.flocks){
            const coop=duckCoops(world.entities).find(e=>e.id===flock.coopId);if(!coop)continue;
            const night=!weather.timeOfDay||['evening','night'].includes(weather.timeOfDay),door=duckDoorstep(coop,flock.allowed);
            if(!reduced)flock.clock+=dt;
            if(night){
                if(!flock.route.length)flock.route=door?duckPath(flock.allowed,flock.center,door)?.slice(1)??[]:[];
            }else if(!flock.route.length&&dt>0){
                // Rest a few seconds between strolls to a random tile of the flock's water.
                flock.rest=Math.max(0,flock.rest-dt);
                if(!flock.rest){
                    // Sometimes the flock paddles over to a floating garden for a nap on it.
                    const cells=[...flock.allowed],gardens=world.rafts.filter(r=>r.blueprintId==='floating-garden'),visit=gardens.length&&unit(`${flock.coopId}:garden:${flock.strolls}`)<.35;
                    const nearest=(r:typeof gardens[number])=>cells.map(c=>{const [cx,cy]=c.split(':').map(Number);return {c,d:Math.hypot(cx!+.5-(r.x+1),cy!+.5-(r.y+1.5))};}).sort((p,q)=>p.d-q.d)[0];
                    const garden=visit?nearest(gardens[Math.floor(unit(`${flock.coopId}:which:${flock.strolls}`)*gardens.length)]!):undefined;
                    const pick=garden&&garden.d<2.5?garden.c:cells[Math.floor(unit(`${flock.coopId}:${flock.strolls}`)*cells.length)]!;flock.strolls++;
                    const [x,y]=pick.split(':').map(Number);
                    flock.route=duckPath(flock.allowed,flock.center,{x:x!+.5,y:y!+.5})?.slice(1)??[];
                    flock.rest=3+unit(`${flock.coopId}:rest:${flock.strolls}`)*5;
                }
            }
            const next=flock.route[0];let dx=0,dy=0;
            if(next&&dt>0){dx=next.x-flock.center.x;dy=next.y-flock.center.y;const distance=Math.hypot(dx,dy),step=.65*dt;
                if(reduced){Object.assign(flock.center,flock.route.at(-1)!);flock.route=[];}
                else if(distance<=step){Object.assign(flock.center,next);flock.route.shift();}
                else{flock.center.x+=dx/distance*step;flock.center.y+=dy/distance*step;}
            }
            for(const [index,bird]of flock.birds.entries()){
                const offset={x:(index<2?-.24:.24),y:(index%2?-.29:.29)};
                let scale=1;while(scale>.01&&!flock.allowed.has(cell({x:flock.center.x+offset.x*scale,y:flock.center.y+offset.y*scale})))scale*=.5;
                bird.x=flock.center.x+offset.x*scale;bird.y=flock.center.y+offset.y*scale;bird.clock=flock.clock;bird.sleeping=night&&!flock.route.length;bird.inactive=false;bird.flying=false;bird.pause=0;
                if(Math.abs(dx)>Math.abs(dy))bird.direction=dx>0?'front':'back';else if(Math.abs(dy)>.001){bird.direction='side';bird.facing=dy>0?1:-1;}
                bird.path=!night||flock.route.length?[{...flock.center}]:[];
            }
        }
    }
}
