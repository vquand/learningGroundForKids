import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimalMoments,type MomentWorld} from '../src/features/town-building/animalMoments.ts';
import {ANIMAL_SPEED,createAnimalResidents,type AnimalResident} from '../src/features/town-building/animalWorld.ts';
import {freshPatch} from '../../server/src/town-building/garden.ts';
import {settleFarm} from '../../server/src/town-building/barn.ts';
import {emptyTown,type Entity,type TownAnimal} from '../../server/src/town-building/game.ts';

const day={precipitation:'none' as const,timeOfDay:'morning',isDay:true,season:'spring' as const};
const world=(entities:Entity[],extra:Partial<MomentWorld>={}):MomentWorld=>({mapId:'town',entities,rafts:[],weather:day,now:Date.now(),growthSeconds:0,...extra});
const residents=(entities:Entity[])=>createAnimalResidents(entities,[],{mapId:'town'});
const place=(a:AnimalResident,x:number,y:number)=>Object.assign(a,{x,y,path:[],pause:0,mode:'roaming',sleeping:false});
const run=(moments:AnimalMoments,animals:AnimalResident[],w:MomentWorld,seconds:number)=>{for(let t=0;t<seconds;t+=.05)moments.step(animals,w,.05,false);};

test('chicks follow hens, goslings follow geese, and lambs only come in spring',()=>{
    const entities:Entity[]=[{id:'geese',blueprintId:'coop',animal:'goose',x:4,y:24,paidCost:{}},{id:'hens',blueprintId:'coop',animal:'chicken',x:4,y:4,paidCost:{}},{id:'sheep',blueprintId:'farmhouse',animal:'sheep',x:4,y:12,paidCost:{}}];
    const animals=residents(entities),moments=new AnimalMoments();
    moments.step(animals,world(entities),.05,false);
    const shows=moments.decorate(animals,world(entities));
    assert.deepEqual(shows.filter(a=>a.look==='chick').length,2);assert.equal(shows.filter(a=>a.look==='gosling').length,2);assert.deepEqual(shows.filter(a=>a.look==='lamb').length,2);
    assert.ok(shows.filter(a=>['duckling','gosling','chick','lamb'].includes(a.look!)).every(a=>(a.scale??1)<1),'babies are small');
    const summer=new AnimalMoments(),w=world(entities,{weather:{...day,season:'summer'}});
    summer.step(animals,w,.05,false);assert.equal(summer.decorate(animals,w).filter(a=>a.look==='lamb').length,0);
});
test('sheep look fluffier as wool waits in their barn',()=>{
    let state=emptyTown();state.entities=[{id:'sheep',blueprintId:'farmhouse',animal:'sheep',x:4,y:12,paidCost:{}}];
    const start=Date.now()-60*3600000;state=settleFarm(state,start);
    const animals=residents(state.entities),moments=new AnimalMoments();
    const at=(hours:number)=>moments.decorate(animals,world(state.entities,{now:start+hours*3600000})).find(a=>a.species==='sheep')!;
    assert.equal(at(6).look,undefined);assert.equal(at(30).look,'fleece-medium');assert.equal(at(60).look,'fleece-full');
    assert.ok((at(60).scale??1)>(at(30).scale??1));
});
test('a goose honks at a dog that comes too close, and the dog hops back',()=>{
    const entities:Entity[]=[{id:'geese',blueprintId:'coop',animal:'goose',x:4,y:4,paidCost:{}},{id:'home',blueprintId:'house',x:4,y:9,paidCost:{},pets:['shiba-inu']}];
    const animals=residents(entities),goose=animals.find(a=>a.species==='goose')!,dog=animals.find(a=>a.species==='shiba-inu')!;
    place(goose,6.5,7.5);place(dog,6.5,8.5);
    const moments=new AnimalMoments();moments.step(animals,world(entities),.05,false);
    assert.equal(moments.bubbles[0]?.text,'honk');assert.ok(dog.path.length>0&&dog.running,'the dog runs off');
    assert.equal(moments.decorate(animals,world(entities)).find(a=>a.id===goose.id)!.flying,true,'the goose flaps its wings');
});
test('a cow may stop on a bridge to watch the fish, and people wait for it',()=>{
    const entities:Entity[]=[{id:'cows',blueprintId:'farmhouse',animal:'dairy-cow',x:12,y:10,paidCost:{}},...[16,17,18].map(x=>({id:`b${x}`,blueprintId:'wood-bridge',x,y:12,paidCost:{}}))];
    const animals=residents(entities),cow=animals.find(a=>a.species==='dairy-cow')!,moments=new AnimalMoments();
    let stopped=false;
    for(let attempt=0;attempt<20&&!stopped;attempt++){
        place(cow,15.5,12.5);cow.path=[{x:16.5,y:12.5},{x:17.5,y:12.5}];moments.step(animals,world(entities),.05,false);
        cow.x=16.5;moments.step(animals,world(entities),.05,false);
        stopped=moments.waitTiles(animals).has('16:12');
        cow.x=15.5;moments.step(animals,world(entities),.05,false);
    }
    assert.ok(stopped,'some crossings stop to look at the water');
    assert.equal(cow.direction,'front');
});
test('a rabbit hides in ripe corn with its ears showing, and a tap pops it out',()=>{
    const corn=freshPatch('summer');corn.crop='corn';for(const slot of corn.slots){slot.crop='corn';slot.growth=1e6;}
    const entities:Entity[]=[{id:'haven',blueprintId:'animal-habitat',animal:'rabbit',x:4,y:4,paidCost:{}},{id:'corn',blueprintId:'vegetable-patch',x:7,y:5,paidCost:{},garden:corn}];
    const animals=residents(entities),rabbit=animals.find(a=>a.species==='rabbit')!,moments=new AnimalMoments();
    for(const a of animals)if(a!==rabbit)place(a,2.5,2.5),a.pause=99;
    place(rabbit,7.5,4.5);rabbit.pause=0;
    for(let t=0;t<20&&!moments.hides.some(h=>h.arrived);t+=.05){moments.step(animals,world(entities),.05,false);if(rabbit.path.length){const next=rabbit.path.shift()!;rabbit.x=next.x;rabbit.y=next.y;}}
    const hide=moments.hides.find(h=>h.arrived)!;assert.ok(hide,'the rabbit reached the corn');
    const shown=moments.decorate(animals,world(entities)).find(a=>a.id===rabbit.id)!;assert.ok(shown.peek&&shown.peek<.5,'only the ears show');
    assert.equal(moments.tap({x:Math.floor(hide.x),y:Math.floor(hide.y)},animals),true);
    assert.equal(moments.decorate(animals,world(entities)).find(a=>a.id===rabbit.id)!.peek,undefined,'popped out');
});
test('grass grows faster near animals and grazers nibble tall tufts down to a stub',()=>{
    const entities:Entity[]=[{id:'cows',blueprintId:'farmhouse',animal:'dairy-cow',x:4,y:12,paidCost:{}}];
    const animals=residents(entities),moments=new AnimalMoments();
    moments.step(animals,world(entities),.05,false);
    assert.ok(moments.grass.length>5,'tufts grow on free grass near the barn');
    for(const tuft of moments.grass)tuft.growth=0;
    const crowded=moments.grass.reduce((best,t)=>animals.filter(a=>Math.hypot(a.x-t.x-.5,a.y-t.y-.5)<3).length>animals.filter(a=>Math.hypot(a.x-best.x-.5,a.y-best.y-.5)<3).length?t:best);
    const lonely=moments.grass.reduce((best,t)=>Math.min(...animals.map(a=>Math.hypot(a.x-t.x,a.y-t.y)))>Math.min(...animals.map(a=>Math.hypot(a.x-best.x,a.y-best.y)))?t:best);
    for(const a of animals)a.pause=99;
    run(moments,animals,world(entities),10);
    assert.ok(crowded.growth>lonely.growth,'animals nearby speed up growth');
    const cow=animals[0]!,tuft=moments.grass.find(t=>t!==crowded)!;tuft.growth=1;place(cow,tuft.x+.5,tuft.y+.5);cow.pause=0;
    moments.step(animals,world(entities),.05,false);
    assert.equal(tuft.growth,0,'nibbled to a stub');
});
test('animals queue one at a time at a farm gate',()=>{
    const entities:Entity[]=[{id:'sheep',blueprintId:'farmhouse',animal:'sheep',x:2,y:10,paidCost:{}},{id:'gate',blueprintId:'farm-gate',x:8,y:12,paidCost:{}}];
    const animals=residents(entities),[a,b]=animals.filter(r=>r.species==='sheep') as [AnimalResident,AnimalResident];
    place(a,8.5,12.5);place(b,7.5,12.5);b.path=[{x:8.5,y:12.5}];
    new AnimalMoments().step(animals,world(entities),.05,false);
    assert.ok(b.pause>0,'the second sheep waits for the gate to clear');
});
test('the owl watches the coop at night and hoots at a ghost',()=>{
    const entities:Entity[]=[{id:'hens',blueprintId:'coop',animal:'chicken',x:4,y:4,paidCost:{}},{id:'home',blueprintId:'house',x:4,y:8,paidCost:{},pets:['white-owl']}];
    const animals=residents(entities),owl=animals.find(a=>a.species==='white-owl')!;place(owl,6.5,6.5);
    const night=world(entities,{weather:{...day,timeOfDay:'night',isDay:false},ghosts:[{x:7,y:7}]});
    new AnimalMoments().step(animals,night,.05,false);
    const moments=new AnimalMoments();moments.step(animals,night,.05,false);
    assert.equal(moments.bubbles[0]?.text,'hoot');
});
test('fed animals show hearts; reduced motion keeps residents still',()=>{
    const entities:Entity[]=[{id:'cows',blueprintId:'farmhouse',animal:'dairy-cow',x:4,y:12,paidCost:{}}];
    const animals=residents(entities),moments=new AnimalMoments();
    moments.feed('cows',animals);moments.step(animals,world(entities),.05,false);
    assert.ok(moments.decorate(animals,world(entities)).filter(a=>a.hostId==='cows').every(a=>a.heart>0));
    const before=JSON.stringify(animals.map(a=>[a.x,a.y,a.path.length]));
    new AnimalMoments().step(animals,world(entities),.05,true);
    assert.equal(JSON.stringify(animals.map(a=>[a.x,a.y,a.path.length])),before);
});
test('ducklings glide every frame like their parent and never swim backward',async()=>{
    const {AnimalWorld}=await import('../src/features/town-building/sharedAnimalWorld.ts');
    const entities:Entity[]=[{id:'ducks',blueprintId:'coop',animal:'duck',x:13,y:22,paidCost:{}}];
    const animals=new AnimalWorld(),moments=new AnimalMoments();animals.sync(entities,{mapId:'town',rafts:[]});
    const w=world(entities,{weather:{...day,season:'summer'}}),prev=new Map<string,{x:number;y:number}>(),steps:Record<string,number[]>={duck:[],duckling:[]};let wrong=0,moving=0;
    for(let f=0;f<60*90;f++){
        animals.advance(1/60,w.weather);moments.step(animals.residents,w,1/60,false);
        for(const a of moments.decorate(animals.sample(),w)){
            const p=prev.get(a.id);prev.set(a.id,{x:a.x,y:a.y});if(!p)continue;
            const dx=a.x-p.x,dy=a.y-p.y,d=Math.hypot(dx,dy);if(d<1e-4||d>.5)continue;
            steps[a.look??a.species]?.push(d);
            // Backward = the shown sprite points against the motion along its own axis.
            if(a.look==='duckling'){moving++;const along=a.direction==='side'?dy*a.facing:a.direction==='front'?dx:-dx;if(along<-d*.3)wrong++;}
        }
    }
    const median=(v:number[])=>[...v].sort((a,b)=>a-b)[v.length>>1]!;
    assert.ok(moving>1000,'ducklings move on most frames');
    assert.ok(wrong/moving<.01,`ducklings face their motion (${wrong}/${moving} wrong)`);
    assert.ok(Math.abs(median(steps.duckling!)/median(steps.duck!)-1)<.25,'duckling steps are as even as the parent');
});
test('pigs forage at a reachable forest, hide briefly, carry and drop a mushroom, then it fades',()=>{
 const entities:Entity[]=[{id:'pigs',blueprintId:'farmhouse',animal:'pig',x:1,y:6,paidCost:{}}],animals=residents(entities),moments=new AnimalMoments(),w=world(entities);
 for(let t=0;t<300&&!moments.mushroomTrips.length;t+=.05)moments.step(animals,w,.05,false);assert.equal(moments.mushroomTrips.length,1,'one trip per farmhouse');
 const trip=moments.mushroomTrips[0]!,pig=animals.find(a=>a.id===trip.animalId)!;
 assert.ok(pig.allowed.has(`${Math.floor(trip.x)}:${Math.floor(trip.y)}`),'reachable cell');
 place(pig,trip.x,trip.y);moments.step(animals,w,.05,false);
 assert.equal(moments.decorate(animals,w).find(a=>a.id===pig.id)!.hidden,true);
 run(moments,animals,w,5);assert.equal(trip.phase,'returning');
 assert.equal(moments.decorate(animals,w).find(a=>a.id===pig.id)!.mushroom,trip.variant);
 place(pig,trip.home.x,trip.home.y);moments.step(animals,w,.05,false);
 assert.equal(moments.mushrooms.length,1);assert.equal(moments.mushroomTrips.length,0);
 assert.ok(moments.decorate(animals,w).find(a=>a.id===pig.id)!.heart>0);
 run(moments,animals,w,61);assert.equal(moments.mushrooms.length,0);
 assert.equal(entities[0]!.barn,undefined,'no server state or stock changed');
});
test('reduced motion and removed hosts cancel mushroom trips; unreachable forests never teleport pigs',()=>{
 const entities:Entity[]=[{id:'pigs',blueprintId:'farmhouse',animal:'pig',x:1,y:6,paidCost:{}}],animals=residents(entities),moments=new AnimalMoments(),w=world(entities);
 for(let t=0;t<300&&!moments.mushroomTrips.length;t+=.05)moments.step(animals,w,.05,false);assert.ok(moments.mushroomTrips.length);moments.step(animals,w,.05,true);assert.equal(moments.mushroomTrips.length,0);
 const enclosed=residents(entities);for(const a of enclosed)a.allowed=new Set([`${Math.floor(a.x)}:${Math.floor(a.y)}`]);
 const quiet=new AnimalMoments();run(quiet,enclosed,w,600);assert.equal(quiet.mushroomTrips.length,0);
 moments.step(animals,world([]),.05,false);assert.equal(moments.mushrooms.length,0);
});

// Shearing: the wool a barn holds sets the fleece, and a collection walks the sheep in to be shorn.
const summer={...day,season:'summer' as const};
const at=(entities:Entity[],now:number,weather:MomentWorld['weather']=summer):MomentWorld=>world(entities,{now,weather});
const shearBarn=(stock:number,now:number):Entity[]=>[{id:'sheep',blueprintId:'farmhouse',animal:'sheep',x:4,y:12,paidCost:{},barn:{stock,progress:0,lastTick:now,fedUntil:0,generation:0,species:'sheep'}}];
test('wool stages: an empty basket is sheared, then plain, medium and full fleece',async()=>{
    const {fleeceLook}=await import('../src/features/town-building/animalMoments.ts');
    assert.equal(fleeceLook(0),'sheared');assert.equal(fleeceLook(3),undefined);assert.equal(fleeceLook(4),'fleece-medium');assert.equal(fleeceLook(7),'fleece-medium');assert.equal(fleeceLook(8),'fleece-full');assert.equal(fleeceLook(12),'fleece-full');
    const entities=shearBarn(0,Date.now()),animals=residents(entities);
    assert.equal(new AnimalMoments().decorate(animals,at(entities,Date.now())).find(a=>a.species==='sheep')!.look,'sheared','a freshly shorn barn');
});
test('a shorn sheep walks in wearing its old fleece, hides for a moment, then comes out sheared',()=>{
    const T=Date.now(),entities=shearBarn(12,T),animals=residents(entities),sheep=animals[0]!,shelter=sheep.shelter,moments=new AnimalMoments();
    // Start a few tiles from the barn door so the sheep really walks in.
    const start=[...sheep.allowed].map(k=>k.split(':').map(Number) as [number,number]).filter(([x,y])=>Math.hypot(x+.5-shelter.x,y+.5-shelter.y)>2.5).sort((p,q)=>Math.hypot(p[0]+.5-shelter.x,p[1]+.5-shelter.y)-Math.hypot(q[0]+.5-shelter.x,q[1]+.5-shelter.y))[0]!;
    place(sheep,start[0]+.5,start[1]+.5);
    const look=()=>moments.decorate(animals,at(entities,T)).find(a=>a.id===sheep.id)!;
    moments.step(animals,at(entities,T),.05,false);
    assert.equal(look().look,'fleece-full');
    moments.shear('sheep',12,animals);
    assert.equal(entities[0]!.barn!.stock,12,'animation does not empty server stock');
    let stage='walking',hidden=0,walked=0,exited=false;
    for(let t=0;t<40&&!exited;t+=.05){
        // The sheep walks its own route at its usual pace; the animal simulation itself is not run here.
        let d=ANIMAL_SPEED.sheep*.05;for(;sheep.path.length&&d>0;){const next=sheep.path[0]!,dist=Math.hypot(next.x-sheep.x,next.y-sheep.y);if(dist<=d){sheep.x=next.x;sheep.y=next.y;sheep.path.shift();d-=dist;}else{sheep.x+=(next.x-sheep.x)/dist*d;sheep.y+=(next.y-sheep.y)/dist*d;d=0;}}
        moments.step(animals,at(entities,T),.05,false);
        const shown=look();
        if(stage==='walking'){
            if(!shown.hidden){walked++;assert.equal(shown.look,'fleece-full','the old fleece is kept on the way in');continue;}
            assert.ok(Math.hypot(shown.x-shelter.x,shown.y-shelter.y)<.6,'hidden only once inside the barn door');stage='hidden';
        }
        if(stage==='hidden'){if(shown.hidden){hidden++;continue;}stage='out';assert.equal(shown.look,'sheared','comes out sheared');assert.ok(shown.heart>0,'hearts on the way out');exited=true;}
    }
    assert.ok(walked>5,'the sheep walked in first');
    assert.ok(hidden*.05>=1&&hidden*.05<=1.4,`hidden for about 1.2 s (${hidden*.05} s)`);
    assert.ok(exited,'the sheep came back out');
    for(let t=0;t<3;t+=.05)moments.step(animals,at(entities,T),.05,false);
    assert.equal(look().hidden,undefined,'out for good: the shear is finished');assert.equal(look().look,'sheared');
});
test('reduced motion: a shorn sheep does not walk, and the sheared look shows at once',()=>{
    const T=Date.now(),entities=shearBarn(12,T),animals=residents(entities),sheep=animals[0]!,moments=new AnimalMoments();let collected=0;
    place(sheep,sheep.x+.6,sheep.y);
    moments.step(animals,at(entities,T),.05,false);
    moments.shear('sheep',12,animals,()=>collected++);
    moments.step(animals,at(entities,T),.05,true);assert.equal(collected,1,'turning on reduced motion completes the pending collection');
    moments.step(animals,at(entities,T),.05,true);assert.equal(collected,1);
    const shown=moments.decorate(animals,at(entities,T)).find(a=>a.id===sheep.id)!;
    assert.equal(shown.look,'sheared');assert.equal(shown.hidden,undefined);assert.equal(sheep.path.length,0,'no walk');
});
test('wool collection waits for the last sheep to exit and fires only once',()=>{
    const T=Date.now(),entities=shearBarn(12,T),animals=residents(entities).filter(a=>a.species==='sheep').slice(0,2),moments=new AnimalMoments(),w=at(entities,T);let collected=0;
    assert.equal(animals.length,2);
    for(const a of animals)place(a,a.shelter.x,a.shelter.y);
    moments.shear('sheep',12,animals,()=>collected++);
    assert.equal(collected,0,'tapping does not collect');
    const [first,last]=animals as [AnimalResident,AnimalResident];
    last.path=[{x:last.x+1,y:last.y}];first.path=[];
    moments.step(animals,w,.05,false);run(moments,animals,w,1.3);
    assert.equal(collected,0,'the first sheep exiting does not collect');
    const shown=moments.decorate(animals,w);
    assert.equal(shown.find(a=>a.id===first.id)!.look,'sheared','exited sheep stays shorn before the server empties stock');
    assert.equal(shown.find(a=>a.id===last.id)!.look,'fleece-full','walking sheep retains its old fleece');
    last.path=[];moments.step(animals,w,.05,false);run(moments,animals,w,1.3);
    assert.equal(collected,1,'last exit collects');
    run(moments,animals,w,20);moments.finishShear('sheep');assert.equal(collected,1,'later frames and timeout do not duplicate collection');
});
for(const mapId of ['town','lake'] as const)test(`real sheep simulation enters the barn before hiding and exits before collection on ${mapId}`,async()=>{
    const {AnimalWorld}=await import('../src/features/town-building/sharedAnimalWorld.ts');
    const T=Date.now(),entities=shearBarn(12,T);Object.assign(entities[0]!,mapId==='lake'?{x:6,y:1}:{x:4,y:12});
    const animals=new AnimalWorld(),moments=new AnimalMoments(),w=at(entities,T);w.mapId=mapId;animals.sync(entities,{mapId,rafts:[]});
    let sheep=animals.residents.filter(a=>a.species==='sheep');assert.ok(sheep.length>1,'several real barn residents participate');
    for(let i=0;i<sheep.length;i++){
        const a=sheep[i]!,sites=[...a.allowed].map(k=>k.split(':').map(Number) as [number,number]).filter(([x,y])=>{const d=Math.hypot(x+.5-a.shelter.x,y+.5-a.shelter.y);return d>1.5&&d<3.5;});
        assert.ok(sites.length,'the map has reachable land outside the barn');const site=sites[i%sites.length]!;place(a,site[0]+.5,site[1]+.5);
    }
    // Initialize the normal sampling history after placing the test flock, then use the same advance/step/sample order as MapScene.
    animals.sync(entities,{mapId,rafts:[]});sheep=animals.residents.filter(a=>a.species==='sheep');moments.step(animals.residents,w,.05,false);
    let collected=0;const entered=new Set<string>(),exited=new Set<string>();
    moments.shear('sheep',12,animals.residents,()=>{
        collected++;
        const shows=moments.decorate(animals.sample(),w).filter(a=>a.species==='sheep');
        assert.ok(shows.every(a=>!a.hidden&&!a.shears&&a.look==='sheared'),'the request begins only after every sheep has emerged');
    });
    assert.equal(collected,0);assert.ok(sheep.every(a=>a.path.length),'the real route to the barn starts with a walk');
    for(let t=0;t<12&&collected===0;t+=.05){
        animals.advance(.05,w.weather);moments.step(animals.residents,w,.05,false);
        for(const a of moments.decorate(animals.sample(),w).filter(a=>a.species==='sheep')){
            if(a.hidden){entered.add(a.id);assert.ok(Math.hypot(a.x-(Math.floor(a.shelter.x)+.5),a.y-(Math.floor(a.shelter.y)+.5))<.12,`no hiding before arrival at the barn door: ${a.id} at ${a.x},${a.y}, shelter ${a.shelter.x},${a.shelter.y}, t=${t}`);assert.equal(a.look,'fleece-full','inside sheep still wears its pre-shear fleece');assert.equal(a.shears,undefined);}
            else if(entered.has(a.id)){exited.add(a.id);assert.equal(a.look,'sheared','exited sheep keeps its shorn preview despite uncollected server stock');}
            else{assert.equal(a.look,'fleece-full');assert.equal(a.shears,true);}
        }
    }
    assert.equal(collected,1,'normal movement completes without the safety timeout');assert.equal(entered.size,sheep.length);assert.equal(exited.size,sheep.length);assert.equal(entities[0]!.barn!.stock,12,'movement never writes server stock');
    for(let t=0;t<2;t+=.05){animals.advance(.05,w.weather);moments.step(animals.residents,w,.05,false);}
    assert.equal(collected,1);assert.ok(moments.decorate(animals.sample(),w).filter(a=>a.species==='sheep').every(a=>a.look==='sheared'),'preview remains held while the request is unresolved');
});
test('stuck sheep finish collection once at the 15 second safety deadline',()=>{
    const T=Date.now(),entities=shearBarn(12,T),animals=residents(entities),moments=new AnimalMoments(),w=at(entities,T);let collected=0;
    for(const a of animals)place(a,a.shelter.x+1,a.shelter.y);
    moments.shear('sheep',12,animals,()=>collected++);
    for(const a of animals)a.path=[{x:a.x+1,y:a.y}];
    run(moments,animals,w,14);assert.equal(collected,0);
    run(moments,animals,w,1.1);assert.equal(collected,1,'timeout includes walk and hide, rather than adding 1.2 seconds');
    assert.ok(moments.decorate(animals,w).filter(a=>a.species==='sheep').every(a=>a.look==='sheared'&&!a.hidden&&!a.shears));
    run(moments,animals,w,3);assert.equal(collected,1);
});
test('no roaming sheep, reduced motion and visit shortcuts collect immediately without walking',()=>{
    const T=Date.now(),entities=shearBarn(12,T);
    for(const shortcut of ['none','resting','reduced','visit']){
        const animals=shortcut==='none'?[]:residents(entities),moments=new AnimalMoments();let collected=0;
        for(const a of animals){place(a,a.shelter.x+1,a.shelter.y);if(shortcut==='resting')a.mode='resting';}
        moments.shear('sheep',12,animals,()=>collected++,shortcut==='reduced'||shortcut==='visit');
        assert.equal(collected,1,shortcut);assert.ok(animals.every(a=>!a.path.length),shortcut);
        moments.step(animals,at(entities,T),.05,shortcut==='reduced');assert.equal(collected,1);
        assert.ok(moments.decorate(animals,at(entities,T)).every(a=>!a.shears&&!a.hidden));
    }
});
test('shears show only during walk-in and old fleece is held inside until the shorn exit',()=>{
    const T=Date.now(),entities=shearBarn(12,T),animals=residents(entities).slice(0,1),sheep=animals[0]!,moments=new AnimalMoments(),w=at(entities,T);
    place(sheep,sheep.shelter.x+1,sheep.shelter.y);moments.shear('sheep',12,animals);
    const shown=()=>moments.decorate(animals,w).find(a=>a.id===sheep.id)!;
    assert.equal(shown().shears,true);assert.equal(shown().look,'fleece-full');
    place(sheep,sheep.shelter.x,sheep.shelter.y);moments.step(animals,w,.05,false);
    assert.equal(shown().shears,undefined);assert.equal(shown().hidden,true);assert.equal(shown().look,'fleece-full');
    run(moments,animals,w,1.3);assert.equal(shown().shears,undefined);assert.equal(shown().hidden,undefined);assert.equal(shown().look,'sheared');assert.ok(shown().heart>0);
    moments.resolveShear('sheep');assert.equal(shown().look,'fleece-full','failed request restores fleece while server stock remains');
    moments.shear('sheep',12,animals,undefined,true);entities[0]!.barn!.stock=0;moments.resolveShear('sheep');
    assert.equal(shown().look,'sheared','zero server stock keeps the shorn look after failure or success');
    entities[0]!.barn!.stock=4;assert.equal(shown().look,'fleece-medium','after acknowledgment the wool can grow back normally');
});
test('a shorn sheep draws as a plain sheep until its art has loaded, and every measured pose stays inside its own cell',async()=>{
    const {shornFallback}=await import('../src/features/town-building/animalSprite.ts');
    const {MOMENT_ATLASES}=await import('../src/features/town-building/momentAtlas.ts');
    assert.equal(shornFallback('sheared',new Map()),undefined,'missing art shows the plain sheep');
    assert.equal(shornFallback('fleece-full',new Map()),'fleece-full');
    assert.equal(shornFallback('huddle-sheared',new Map([['sheep-sheared-v2',{naturalWidth:0} as unknown as HTMLImageElement]])),undefined,'not yet loaded');
    assert.equal(shornFallback('sheared',new Map([['sheep-sheared-v2',{naturalWidth:2048} as unknown as HTMLImageElement]])),'sheared');
    const atlas=MOMENT_ATLASES['sheep-sheared-v2'];assert.equal(atlas.rects.length,8);assert.ok(atlas.rects.every(([x,y,w,h],i)=>x>=(i%4)*512&&x+w<=(i%4+1)*512&&y>=Math.floor(i/4)*512&&y+h<=(Math.floor(i/4)+1)*512),'each measured pose stays inside its own 512px cell');assert.equal(atlas.width,2048);assert.equal(atlas.height,1024);
});
test('a shorn sheep sets its sheared look immediately when the barn is empty and the sheep is resting',()=>{
    const T=Date.now(),entities=shearBarn(0,T),animals=residents(entities),sheep=animals[0]!,moments=new AnimalMoments();
    sheep.mode='resting';moments.step(animals,at(entities,T),.05,false);
    assert.equal(moments.decorate(animals,at(entities,T,{...summer,precipitation:'rain' as const})).find(a=>a.id===sheep.id)!.look,'huddle-sheared');
});
test('a sheep barn shows its wool basket as a progress bar, and milk and yarn the same way',async()=>{
    const {createServer}=await import('vite');const react=(await import('@vitejs/plugin-react')).default;const {fileURLToPath}=await import('node:url');
    const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});
    try{
        const {landProgress}=await server.ssrLoadModule('/src/features/town-building/buildingProgress.tsx');
        const T=Date.now(),barn=(animal:TownAnimal,stock:number):Entity=>({id:'barn',blueprintId:'farmhouse',animal,x:3,y:16,paidCost:{},barn:{stock,progress:0,lastTick:T,fedUntil:0,generation:0,species:animal}});
        const wool=landProgress(barn('sheep',3),T);
        assert.equal(wool.count,3);assert.equal(wool.label,'Next wool');assert.equal(wool.value,0);assert.equal(wool.max,1);
        assert.equal(landProgress(barn('sheep',12),T).label,'Wool basket full');assert.equal(landProgress(barn('sheep',12),T).value,1,'full at capacity');
        const half=landProgress(barn('sheep',0),T+3*3600000);assert.equal(half.count,0);assert.ok(Math.abs(half.value-.5)<1e-9,'half way to the next wool');
        assert.equal(landProgress(barn('dairy-cow',0),T).label,'Next milk');assert.equal(landProgress(barn('highland-cow',6),T).label,'Yarn basket full');
        assert.equal(landProgress(barn('pig',0),T),null,'pigs make nothing');
    }finally{await server.close();}
});
