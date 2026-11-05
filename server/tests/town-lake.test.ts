import {lakeTerrainAt} from '../src/town-building/maps/lake/terrain.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown,type TownState} from '../src/town-building/game.ts';
import {emptyLake,applyLakeCommand,ensureLakeUnlock} from '../src/town-building/maps/lake/game.ts';
import {fishCapacity,LAKE_BLUEPRINTS} from '../src/town-building/water/catalog.ts';
import {BLUEPRINTS,MATERIALS,type Cost} from '../src/town-building/game.ts';
import {fishBehavior,fishGrowthMultiplier,feedingSources} from '../src/town-building/water/behavior.ts';
import {tickMap} from '../src/town-building/mapTick.ts';

function town():TownState {
    const state=emptyTown();state.maps={lake:emptyLake(1000)};
    for(const key of Object.keys(state.materials))state.materials[key as keyof typeof state.materials]=1000;
    state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};
    return state;
}
test('demolition releases stocked fish and plants without harvests, reserves, refunds or awards; moves preserve contents',()=>{
 for(const kind of ['nursery','friendly','floating-garden'] as const){
  let state=town();state.maps!.lake!.harvested=100;
  state=applyLakeCommand(state,{type:'build-raft',blueprintId:kind,x:8,y:7},1000,'raft',{});
  state=kind==='floating-garden'?applyLakeCommand(state,{type:'plant',raftId:'raft',plant:'water-spinach'},1000,'plant',{}):applyLakeCommand(state,{type:'stock',raftId:'raft',species:'P1'},1000,'fish',{P1:10});
  const raft=state.maps!.lake!.rafts[0]!;raft.plantGrowth=123;for(const fish of raft.fish)fish.growth=123;
  const contents=structuredClone({fish:raft.fish,plant:raft.plant,plantGrowth:raft.plantGrowth});
  state=applyLakeCommand(state,{type:'move-raft',raftId:'raft',x:11,y:7},1000,'move',{});
  const moved=state.maps!.lake!.rafts[0]!;assert.deepEqual({fish:moved.fish,plant:moved.plant,plantGrowth:moved.plantGrowth},contents);
  const before=structuredClone(state);
  state=applyLakeCommand(state,{type:'remove-raft',raftId:'raft'},1000,'release',{});
  assert.equal(state.maps!.lake!.rafts.length,0);assert.deepEqual(state.materials,before.materials);assert.deepEqual(state.maps!.lake!.reserve,before.maps!.lake!.reserve);
  assert.equal(state.maps!.lake!.harvested,before.maps!.lake!.harvested);assert.equal(state.maps!.lake!.collections,before.maps!.lake!.collections);assert.equal(state.maps!.lake!.plantsHarvested,before.maps!.lake!.plantsHarvested);assert.deepEqual(state.maps!.lake!.earned,before.maps!.lake!.earned);
  assert.throws(()=>applyLakeCommand(state,{type:'remove-raft',raftId:'raft'},1000,'retry',{}),/no longer/);
 }
});
test('new lake building material costs average about twenty percent above original Town buildings',()=>{
    const materials=(cost:Cost)=>([...MATERIALS,'wool'] as const).filter(m=>m!=='stamina').reduce((sum,m)=>sum+(cost[m]??0),0);
    const original=BLUEPRINTS.filter(b=>b.kind==='building'||b.kind==='garden');
    const baseline=original.reduce((sum,b)=>sum+materials(b.cost),0)/original.length;
    const lakeAverage=LAKE_BLUEPRINTS.reduce((sum,b)=>sum+materials(b.cost),0)/LAKE_BLUEPRINTS.length;
    assert.ok(Math.abs(lakeAverage/baseline-1.2)<.02,`Town ${baseline}; lake ${lakeAverage}`);
    for(const building of LAKE_BLUEPRINTS)assert.ok(Math.abs(materials(building.cost)/baseline-1.2)<.06,building.id);
});
test('Flower unlock is durable and never granted by a client or falling prosperity',()=>{
    let state=emptyTown();assert.equal(ensureLakeUnlock(state,1000).maps?.lake,undefined);
    for(const [i,blueprintId]of ['grocery','bakery','meat-shop','vegetable-shop','tools-smith','school','infirmary'].entries())
        state.entities.push({id:String(i),blueprintId,x:6,y:i*4,paidCost:{},civ:{phase:'ready',elapsedMs:0,routeKey:'',helpStep:0,helpAfterMs:0}});
    state=ensureLakeUnlock(state,1000);assert.ok(state.maps?.lake);
    state.entities=[];assert.equal(ensureLakeUnlock(state,2000).maps?.lake?.unlockedAt,1000);
});
test('stocking uses verified catches, habitat and species-sized slots without spending fishing inventory',()=>{
    let state=town();
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:8,y:12},1000,'a',{});
    assert.throws(()=>applyLakeCommand(state,{type:'stock',raftId:'a',species:'P3'},1000,'b',{P3:9}),/catch/i);
    state=applyLakeCommand(state,{type:'stock',raftId:'a',species:'P3'},1000,'b',{P3:10});
    assert.equal(state.maps!.lake!.rafts[0]!.fish.length,4);
    assert.equal(fishCapacity('P1'),16);
    assert.throws(()=>applyLakeCommand(state,{type:'stock',raftId:'a',species:'P3'},1000,'b',{P3:10}),/space|empty/i);
});
test('a batch crossing 100 harvests removes fish, retains reserve, unlocks friends and cannot replay',()=>{
    let state=town();
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:8,y:12},1000,'a',{});
    state=applyLakeCommand(state,{type:'stock',raftId:'a',species:'P3'},1000,'b',{P3:10});
    const lake=state.maps!.lake!;lake.harvested=96;
    for(const fish of lake.rafts[0]!.fish)fish.growth=300;
    state=applyLakeCommand(state,{type:'harvest-fish',raftId:'a',generation:lake.rafts[0]!.generation},1000,'c',{});
    assert.equal(state.maps!.lake!.harvested,100);
    assert.equal(state.maps!.lake!.reserve.P3,4);
    assert.equal(state.maps!.lake!.rafts[0]!.fish.length,0);
    assert.throws(()=>applyLakeCommand(state,{type:'harvest-fish',raftId:'a',generation:lake.rafts[0]!.generation},1000,'c',{}),/changed|ready/i);
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'friendly',x:8,y:7},1000,'d',{});
    const stamina=state.materials.stamina;
    state=applyLakeCommand(state,{type:'transfer-fish',raftId:'d',species:'P3'},1000,'e',{});
    assert.equal(state.maps!.lake!.rafts.find(r=>r.id==='d')!.fish.length,4);
    assert.equal(state.maps!.lake!.reserve.P3,0);
    assert.equal(state.maps!.lake!.harvested,100);assert.equal(state.materials.stamina,stamina);
});
test('growth never catches up offline or depends on weather/rest, and overlapping feeders cap at +20%',()=>{
    let state=town();
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:8,y:12},1000,'a',{});
    state=applyLakeCommand(state,{type:'stock',raftId:'a',species:'P3'},1000,'b',{P3:10});
    state.maps!.lake!.harvested=16;
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-insect-raiser',x:8,y:15},1000,'feeder',{});
    state=tickMap(state,'lake',1000,{season:'spring',timeOfDay:'morning',precipitation:'none'},true);
    state=tickMap(state,'lake',6000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false);
    for(const fish of state.maps!.lake!.rafts[0]!.fish)assert.ok(Math.abs(fish.growth-6)<1e-6);
    state=tickMap(state,'lake',60000,{season:'spring',timeOfDay:'morning',precipitation:'none'},true);
    for(const fish of state.maps!.lake!.rafts[0]!.fish)assert.ok(Math.abs(fish.growth-6)<1e-6);
    state=tickMap(state,'lake',61000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false);
    for(const fish of state.maps!.lake!.rafts[0]!.fish)assert.ok(Math.abs(fish.growth-7.2)<1e-6);
});

test('small fish fill exactly sixteen slots and incompatible habitats do not spend or stock',()=>{
    let state=applyLakeCommand(town(),{type:'build-raft',blueprintId:'nursery',x:2,y:7},1000,'small',{});
    const snapshot=structuredClone(state);
    assert.throws(()=>applyLakeCommand(state,{type:'stock',raftId:'small',species:'P3'},1000,'wrong',{P3:10}),/deep/);
    assert.deepEqual(state,snapshot);
    state=applyLakeCommand(state,{type:'stock',raftId:'small',species:'P1'},1000,'minnows',{P1:10});
    assert.equal(state.maps!.lake!.rafts[0]!.fish.length,16);
    assert.throws(()=>applyLakeCommand(state,{type:'move-raft',raftId:'small',x:2,y:12},1000,'move',{}),/shallow/);
});

test('overlapping sources never stack and clear/resting/rain behavior follows the species clock',()=>{
    const source={id:'a',cells:new Set(['8:10'])};
    assert.equal(fishGrowthMultiplier({blueprintId:'nursery',x:7,y:9},[source,{...source,id:'b'}]),1.2);
    assert.equal(fishGrowthMultiplier({blueprintId:'nursery',x:0,y:0},[source]),1);
    assert.equal(fishGrowthMultiplier({blueprintId:'friendly',x:7,y:9},[source]),1,'the Fish home raft is special and never buffed');
    assert.equal(fishBehavior('R4',{timeOfDay:'morning',precipitation:'none'}).active,false);
    assert.equal(fishBehavior('R4',{timeOfDay:'night',precipitation:'none'}).active,true);
    assert.equal(fishBehavior('P1',{timeOfDay:'morning',precipitation:'rain'}).surface,false);
    assert.equal(fishBehavior('P1',{timeOfDay:'morning',precipitation:'none'}).surface,true);
});

test('mature companions can return to reserve without another reward or harvest count',()=>{
    let state=town();state.maps!.lake!.harvested=100;state.maps!.lake!.reserve.P3=4;
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'friendly',x:8,y:7},1000,'home',{});
    state=applyLakeCommand(state,{type:'transfer-fish',raftId:'home',species:'P3'},1000,'fish',{});
    const stamina=state.materials.stamina,collections=state.maps!.lake!.collections;
    state=applyLakeCommand(state,{type:'reserve-fish',raftId:'home'},1000,'reserve',{});
    assert.equal(state.maps!.lake!.reserve.P3,4);assert.equal(state.maps!.lake!.rafts[0]!.fish.length,0);
    assert.equal(state.maps!.lake!.harvested,100);assert.equal(state.maps!.lake!.collections,collections);assert.equal(state.materials.stamina,stamina);
    assert.throws(()=>applyLakeCommand(state,{type:'reserve-fish',raftId:'home'},1000,'repeat',{}),/grown/);
});

test('floating insect raiser unlocks at 16 harvests and accepts shallow/deep water only',()=>{
    let state=town();
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'insect-raiser',x:8,y:6},1000,'shore',{});
    state.maps!.lake!.harvested=15;const before=structuredClone(state);
    assert.throws(()=>applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-insect-raiser',x:8,y:8},1000,'floating',{}),/Harvest 16 nursery fish/);
    assert.deepEqual(state,before);
    state.maps!.lake!.harvested=16;
    assert.throws(()=>applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-insect-raiser',x:9,y:6},1000,'land',{}),/water|shallow|deep/);
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-insect-raiser',x:8,y:8},1000,'floating',{});
    assert.ok(state.maps!.lake!.built.includes('floating-insect-raiser'));
    state=applyLakeCommand(state,{type:'move-raft',raftId:'floating',x:8,y:12},1000,'move',{});
    assert.equal(state.maps!.lake!.rafts.find(r=>r.id==='floating')!.y,12);
    assert.throws(()=>applyLakeCommand(state,{type:'move-raft',raftId:'shore',x:8,y:8},1000,'wrong',{}),/land|grass/);
    // A river is shallow water on every map, so water structures may use it.
    state=applyLakeCommand(state,{type:'move-raft',raftId:'floating',x:15,y:38},1000,'river',{});
    assert.equal(state.maps!.lake!.rafts.find(r=>r.id==='floating')!.x,15);
});
test('shore, floating and legacy attached sources share radius and never stack fish growth',()=>{
    let state=town();state.maps!.lake!.harvested=16;
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'insect-raiser',x:8,y:6},1000,'shore',{});
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-insect-raiser',x:8,y:8},1000,'floating',{});
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:9,y:7},1000,'nursery',{});
    state=applyLakeCommand(state,{type:'stock',raftId:'nursery',species:'P1'},1000,'fish',{P1:10});
    state.maps!.lake!.rafts.find(r=>r.id==='nursery')!.feeder=true; // Existing saves retain their prior source.
    const sources=feedingSources(state.maps!.lake!.rafts,'lake');
    assert.equal(sources.length,3);
    for(const s of sources)for(const cell of s.cells){const [x,y]=cell.split(':').map(Number);assert.ok(['shallow','deep'].includes(lakeTerrainAt(x!,y!)),'fish feeding stays on water');}
    assert.equal(fishGrowthMultiplier({blueprintId:'nursery',x:9,y:7},sources),1.2);
    assert.equal(fishGrowthMultiplier({blueprintId:'nursery',x:18,y:34},sources),1);
    state=tickMap(state,'lake',1000,{season:'spring',timeOfDay:'morning',precipitation:'none'},true);state=tickMap(state,'lake',6000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false);
    assert.ok(state.maps!.lake!.rafts.find(r=>r.id==='nursery')!.fish.every(f=>Math.abs(f.growth-6)<1e-6));
    state=applyLakeCommand(state,{type:'remove-raft',raftId:'floating'},6000,'remove',{});
    assert.equal(feedingSources(state.maps!.lake!.rafts,'lake').length,2);assert.equal(state.maps!.lake!.harvested,16);
});

test('development project boards list concrete tasks and never expose prosperity scoring',async()=>{
    const {townDevelopmentProject,lakeDevelopmentProject}=await import('../src/town-building/development.ts');
    const state=emptyTown();
    const townProject=townDevelopmentProject(state);
    assert.equal(townProject.stage,0);assert.ok(townProject.goals.length>0);
    assert.ok(townProject.goals.every(goal=>goal.label&&goal.need>0));
    state.maps={lake:emptyLake(1000)};
    const lakeProject=lakeDevelopmentProject(state)!;
    assert.ok(lakeProject.goals.some(goal=>goal.lakeBlueprintId==='floating-garden'));
    assert.doesNotMatch(JSON.stringify({town:townProject,lake:lakeProject}),/score|points|weight|threshold/i);
});
test('the Town development board never recommends a shop already open or built on the Lake',async()=>{
    const {townDevelopmentProject}=await import('../src/town-building/development.ts');
    const {freshCivHome}=await import('../src/town-building/civCatalog.ts');
    const state=emptyTown();state.maps={lake:emptyLake(1000)};
    const first=townDevelopmentProject(state).goals.find(goal=>goal.id.startsWith('open:'))!.blueprintId!;
    state.maps.lake!.land.entities.push({id:'lake-shop',blueprintId:first,x:2,y:2,paidCost:{},civ:{...freshCivHome(),phase:'ready'}});
    assert.ok(townDevelopmentProject(state).goals.every(goal=>goal.blueprintId!==first),'an open Lake shop is not recommended again');
    state.maps.lake!.land.entities[0]!.civ!.phase='waiting';
    const pending=townDevelopmentProject(state).goals.find(goal=>goal.blueprintId===first);
    if(pending)assert.equal(pending.cost,undefined,'a shop built on the Lake only needs connecting, not a second purchase');
});


test('lake names save one approved adjective and preserve lake progress and inventory',async()=>{
    const {LAKE_ADJECTIVES,DEFAULT_LAKE_ADJECTIVE,lakeDisplayName}=await import('../src/town-building/maps/lake/name.ts');
    const original=town(),before=structuredClone(original);
    assert.equal(original.maps!.lake!.adjective,DEFAULT_LAKE_ADJECTIVE);
    const renamed=applyLakeCommand(original,{type:'rename',adjective:'Gentle'},2000,'rename',{});
    assert.equal(renamed.maps!.lake!.adjective,'Gentle');
    assert.equal(lakeDisplayName('Mika',renamed.maps!.lake!.adjective),"Mika's Gentle lake");
    assert.equal(lakeDisplayName('James'),"James's Sunny lake");
    assert.equal(JSON.parse(JSON.stringify(renamed)).maps.lake.adjective,'Gentle');
    assert.deepEqual(renamed.materials,before.materials);assert.deepEqual(renamed.maps!.lake!.rafts,before.maps!.lake!.rafts);
    assert.equal(renamed.maps!.lake!.harvested,before.maps!.lake!.harvested);
    assert.deepEqual(original,before);assert.ok(LAKE_ADJECTIVES.includes('Gentle'));
    assert.throws(()=>applyLakeCommand(original,{type:'rename',adjective:'Unapproved' as 'Gentle'},2000,'bad',{}),/Choose a lake name/);
});
test('lake command boundary rejects forged owner names and removed raft feeder attachments',async()=>{
    const {z}=await import('zod');const {lakeActionSchema}=await import('../src/town-building/maps/lake/commands.ts');
    const schema=lakeActionSchema(z.never());
    assert.equal(schema.safeParse({type:'rename',adjective:'Golden'}).success,true);
    assert.equal(schema.safeParse({type:'rename',adjective:'Golden',ownerName:'Another child'}).success,false);
    assert.equal(schema.safeParse({type:'rename',adjective:'Free text'}).success,false);
    assert.equal(schema.safeParse({type:'attach-feeder',raftId:'nursery'}).success,false);
});

test('plant habitat previews match commands and failed planting preserves the garden',()=>{
    let state=applyLakeCommand(town(),{type:'build-raft',blueprintId:'floating-garden',x:12,y:15},1000,'garden',{});
    const before=structuredClone(state);
    assert.throws(()=>applyLakeCommand(state,{type:'plant',raftId:'garden',plant:'water-lily'},1000,'lily',{}),/shallow/);
    assert.deepEqual(state,before);
    state=applyLakeCommand(state,{type:'plant',raftId:'garden',plant:'soft-rush'},1000,'rush',{});
    assert.equal(state.maps!.lake!.rafts[0]!.plant,'soft-rush');
});
