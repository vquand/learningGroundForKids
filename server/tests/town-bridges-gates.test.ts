import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown,type Entity,type TownState} from '../src/town-building/game.ts';
import {emptyLake,applyLakeCommand} from '../src/town-building/maps/lake/game.ts';
import {applyMapLandCommand} from '../src/town-building/maps/land.ts';
import {animalWalkable} from '../src/town-building/animalWorld.ts';
import {civWalkable} from '../src/town-building/civ.ts';
import {mapDefinition} from '../src/town-building/maps/registry.ts';

const morning={season:'autumn' as const,timeOfDay:'morning' as const,precipitation:'none' as const,localDate:'2026-10-20'};
function town():TownState{
    const state=emptyTown();state.maps={lake:emptyLake(1000)};
    state.materials={stamina:1000,wood:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};
    state.learnedIds=Array.from({length:40},(_,i)=>`item-${i}`);
    return state;
}
const line=(state:TownState,mapId:'town'|'lake',blueprintId:string,tiles:{x:number;y:number}[])=>applyMapLandCommand(state,{type:'land-action',mapId,command:{type:'build-line',blueprintId,tiles}},1000,`line-${blueprintId}-${tiles.length}`,morning);
const one=(state:TownState,mapId:'town'|'lake',command:Parameters<typeof applyMapLandCommand>[1] extends infer A?A extends {command:infer C}?C:never:never,id='one')=>applyMapLandCommand(state,{type:'land-action',mapId,command},1000,id,morning);
const bridgeAt=(entities:readonly Entity[],x:number,y:number)=>entities.find(e=>e.x===x&&e.y===y&&(e.blueprintId==='wood-bridge'||e.blueprintId==='stone-bridge'));

test('a bridge crosses the Town river from bank to bank and costs its material per tile',()=>{
    const map=mapDefinition('town');
    assert.equal(map.terrainAt(15,12),'grass');assert.equal(map.terrainAt(19,12),'grass');
    const crossing=[16,17,18].map(x=>({x,y:12}));
    const wood=line(town(),'town','wood-bridge',crossing);
    assert.ok(crossing.every(t=>bridgeAt(wood.entities,t.x,t.y)));assert.equal(wood.materials.wood,1000-6);
    const stone=line(town(),'town','stone-bridge',crossing);assert.equal(stone.materials.rock,1000-6);
    assert.throws(()=>one(town(),'town',{type:'build',blueprintId:'wood-bridge',x:10,y:10}),/water/i,'bridges never stand on dry land');
    assert.throws(()=>one(town(),'town',{type:'build',blueprintId:'wood-bridge',x:16,y:6}),/river friends/,'reserved river tiles stay clear');
});
test('every new bridge reaches land somewhere; floating strokes are refused, docks and U-turns are fine',()=>{
    // (16,20) is river on all four sides.
    assert.throws(()=>one(town(),'town',{type:'build',blueprintId:'wood-bridge',x:16,y:20}),/Connect your bridge to land/);
    assert.throws(()=>line(town(),'town','wood-bridge',[{x:16,y:20},{x:16,y:21}]),/Connect your bridge to land/);
    // A stroke may start out on the water as long as it reaches the bank.
    assert.ok(bridgeAt(line(town(),'town','wood-bridge',[{x:16,y:20},{x:17,y:20}]).entities,16,20));
    // A tap beside an anchored bridge joins it.
    const dock=line(town(),'town','wood-bridge',[{x:17,y:20}]);
    assert.ok(bridgeAt(one(dock,'town',{type:'build',blueprintId:'stone-bridge',x:16,y:20}).entities,16,20));
    // A U-turn out over the Lake and back to the same shore.
    const uturn=line(town(),'lake','wood-bridge',[{x:3,y:7},{x:3,y:8},{x:4,y:8},{x:5,y:8},{x:5,y:7}]);
    assert.equal(uturn.maps!.lake!.land.entities.filter(e=>e.blueprintId==='wood-bridge').length,5);
});
test('an insect nest may stand on a bridge tile only with bridge on at least 3 of its 4 sides',()=>{
    const place=(bridges:[number,number][])=>{const state=town();state.maps!.lake!.land.entities.push(...bridges.map(([x,y],i)=>({id:`b${i}`,blueprintId:'wood-bridge',x,y,paidCost:{}})),{id:'under',blueprintId:'wood-bridge',x:4,y:13,paidCost:{}});return state;};
    // W W W / B N B / B B B
    const ok=applyLakeCommand(place([[4,12],[4,14],[5,12],[5,13],[5,14]]),{type:'build-raft',blueprintId:'insect-raiser',x:4,y:13,mapId:'lake'},1000,'nest',{});
    assert.ok(ok.maps!.lake!.rafts.some(r=>r.blueprintId==='insect-raiser'&&r.x===4&&r.y===13));
    // W W W / B N W / B B W
    assert.throws(()=>applyLakeCommand(place([[4,12],[5,12],[5,13]]),{type:'build-raft',blueprintId:'insect-raiser',x:4,y:13,mapId:'lake'},1000,'nest',{}),/at least 3 sides/);
    // The bridge under a nest cannot be removed while the nest stands on it.
    assert.throws(()=>one(ok,'lake',{type:'remove',entityId:'under'}),/insect nest/);
    assert.throws(()=>one(ok,'lake',{type:'remove-line',entityId:'b0'}),/insect nest/);
    assert.throws(()=>applyLakeCommand(place([[5,13]]),{type:'build-raft',blueprintId:'nursery',x:5,y:13,mapId:'lake'},1000,'n',{}),/occupied/,'floating rafts never sit under a bridge');
});
test('the middle of a straight fence line becomes a farm gate that animals, people and vehicles pass',()=>{
    let state=line(town(),'town','wooden-fence',[{x:10,y:10},{x:10,y:11},{x:10,y:12}]);
    const [end,middle]=[state.entities.find(e=>e.y===10)!,state.entities.find(e=>e.y===11)!];
    assert.throws(()=>one(state,'town',{type:'make-gate',entityId:end.id}),/both sides/);
    assert.throws(()=>one(state,'town',{type:'build',blueprintId:'farm-gate',x:12,y:20}),/farm gate from a fence/);
    const wood=state.materials.wood;
    state=one(state,'town',{type:'make-gate',entityId:middle.id});
    assert.equal(state.entities.find(e=>e.id===middle.id)!.blueprintId,'farm-gate');assert.equal(state.materials.wood,wood-3);
    const host:Entity={id:'farm',blueprintId:'farmhouse',x:6,y:8,paidCost:{},animal:'sheep'};
    const walk=animalWalkable([...state.entities,host],host,'sheep',{mapId:'town'});
    assert.ok(walk.has('10:11'),'sheep pass through the gate');assert.equal(walk.has('10:10'),false,'the fence still blocks');
    const people=civWalkable(state.entities,mapDefinition('town'));assert.ok(people.has('10:11'));assert.equal(people.has('10:12'),false);
    // The gate stays part of its fence line.
    const cleared=one(state,'town',{type:'remove-line',entityId:end.id});
    assert.equal(cleared.entities.some(e=>e.blueprintId==='farm-gate'||e.blueprintId==='wooden-fence'),false);
});
test('people and land animals cross the water on bridges',()=>{
    const state=line(town(),'town','wood-bridge',[16,17,18].map(x=>({x,y:12})));
    const host:Entity={id:'farm',blueprintId:'farmhouse',x:11,y:10,paidCost:{},animal:'dairy-cow'};
    const cows=animalWalkable([...state.entities,host],host,'dairy-cow',{mapId:'town'});
    assert.ok(cows.has('17:12'),'cows walk onto the bridge');assert.equal(cows.has('17:13'),false,'but not into the river');
    assert.ok(civWalkable(state.entities,mapDefinition('town')).has('17:12'));
});
