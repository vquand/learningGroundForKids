import test from 'node:test';
import assert from 'node:assert/strict';
import {radiusArea,footprintInArea,terrainKind,AREA_EFFECTS,affects} from '../src/town-building/areaOfEffect.ts';
import {duckHelpArea,duckHelpCoverage,duckRaftInRange,DUCK_HELP_TILES} from '../src/town-building/water/ducks.ts';
import {mapDefinition} from '../src/town-building/maps/registry.ts';
import {chickenCoverage} from '../src/town-building/poultry.ts';
import {gardenAreaEffects,gardenInsectSources} from '../src/town-building/gardenEffects.ts';
import {feedingSources,fishGrowthMultiplier} from '../src/town-building/water/behavior.ts';
import {emptyLake} from '../src/town-building/maps/lake/game.ts';
import type {Entity} from '../src/town-building/game.ts';
import type {MapId} from '../src/town-building/maps/types.ts';

const terrainOf=(mapId:MapId,cells:ReadonlySet<string>)=>new Set([...cells].map(cell=>{const [x,y]=cell.split(':').map(Number);return terrainKind(mapDefinition(mapId).terrainAt(x!,y!));}));

test('areas are whole tiles of one terrain: land effects stay on land, water effects on water',()=>{
    // Town coop beside the river: chicken help never covers river tiles.
    const town=chickenCoverage([{id:'c',blueprintId:'coop',animal:'chicken',x:12,y:10,paidCost:{}}],'town')[0]!.cells;
    assert.ok(town.size>0);assert.deepEqual(terrainOf('town',town),new Set(['land']));
    // Lake shore coop: land only, even though the lake is within reach.
    const lake=chickenCoverage([{id:'c',blueprintId:'coop',animal:'chicken',x:6,y:5,paidCost:{}}],'lake')[0]!.cells;
    assert.deepEqual(terrainOf('lake',lake),new Set(['land']));
    const state=emptyLake(1000);
    state.rafts=[{id:'shore',blueprintId:'insect-raiser',x:8,y:6,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false}];
    assert.deepEqual(terrainOf('lake',feedingSources(state.rafts,'lake')[0]!.cells),new Set(['water']),'fish feeding reaches water tiles only');
    assert.deepEqual(terrainOf('lake',gardenInsectSources(state.rafts,'lake')[0]!.cells),new Set(['land']),'garden insects reach land tiles only');
});

test('an object is affected exactly when it stands on a covered tile',()=>{
    const coop:Entity={id:'coop',blueprintId:'coop',animal:'chicken',x:5,y:10,paidCost:{}};
    const cells=chickenCoverage([coop],'town')[0]!.cells;
    assert.ok(cells.has('6:14'));assert.equal(cells.has('6:15'),false);assert.equal(cells.has('7:15'),false);
    const patch=(y:number):Entity=>({id:`patch-${y}`,blueprintId:'vegetable-patch',x:6,y,paidCost:{}});
    assert.equal(gardenAreaEffects(patch(14),[coop,patch(14)],[],'town').chicken,true,'one covered tile is enough');
    assert.equal(gardenAreaEffects(patch(15),[coop,patch(15)],[],'town').chicken,false,'no covered tile, no buff');
    assert.equal(footprintInArea(radiusArea('town',{x:5,y:10,width:2,length:2},4,'land'),{x:6,y:15,width:2,length:2}),false);
});

test('every area effect uses a strict whitelist; special homes are never affected',()=>{
    for(const [id,effect]of Object.entries(AREA_EFFECTS)){
        assert.ok(effect.targets.length>0,id);
        for(const special of ['friendly','basket','river-basket','house','road'])assert.equal(affects(id as keyof typeof AREA_EFFECTS,special),false,`${id} must not affect ${special}`);
    }
    // Even fully inside a feeding area, the Fish home raft keeps normal growth.
    const lake=emptyLake(1000);
    lake.rafts=[{id:'feed',blueprintId:'floating-insect-raiser',x:8,y:12,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false}];
    const sources=feedingSources(lake.rafts,'lake');
    assert.equal(fishGrowthMultiplier({blueprintId:'nursery',x:7,y:11},sources),1.2);
    assert.equal(fishGrowthMultiplier({blueprintId:'friendly',x:7,y:11},sources),1);
    const coop:Entity={id:'d',blueprintId:'coop',animal:'duck',x:6,y:5,paidCost:{}};lake.land.entities=[coop];
    const area=duckHelpCoverage({mapId:'lake',entities:lake.land.entities,rafts:lake.rafts},coop),near=(blueprintId:'nursery'|'friendly')=>({id:blueprintId,blueprintId,x:6,y:9,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false});
    assert.equal(duckRaftInRange(area,near('nursery')),true);assert.equal(duckRaftInRange(area,near('friendly')),false);
});

test('the duck area is one shared rule on every map with water',()=>{
    const coop:Entity={id:'d',blueprintId:'coop',animal:'duck',x:13,y:4,paidCost:{}};
    const town=duckHelpArea('town',coop,[coop]);
    assert.equal(town.size,DUCK_HELP_TILES,'a Town duck coop beside the river shows its area even with nothing to help');
    assert.deepEqual(terrainOf('town',town),new Set(['water']));
    assert.equal(duckHelpArea('town',{...coop,x:6},[{...coop,x:6}]).size,0,'inland coops show nothing');
});
