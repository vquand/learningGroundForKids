import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainAt } from '../src/town-building/game.ts';
import { mapDefinition, mapPlacementError } from '../src/town-building/maps/registry.ts';
import { lakeTerrainAt } from '../src/town-building/maps/lake/terrain.ts';

test('legacy Town terrain is preserved by the shared map definition', () => {
    const counts:Record<string,number>={};
    for(let x=0;x<20;x++)for(let y=0;y<40;y++) {
        const actual=mapDefinition('town').terrainAt(x,y);
        assert.equal(actual,terrainAt(x,y));
        counts[actual]=(counts[actual]??0)+1;
    }
    assert.deepEqual(counts,{mountain:40,grass:640,river:120});
    assert.throws(()=>mapDefinition('unknown' as 'town'));
});

test('lake has a central deep half, left shore and protected connecting rivers', () => {
    const counts:Record<string,number>={};
    for(let x=0;x<20;x++)for(let y=0;y<40;y++) {
        const kind=lakeTerrainAt(x,y);counts[kind]=(counts[kind]??0)+1;
    }
    assert.ok(Math.abs(counts.deep!/800-.5)<.02,'deep water covers about half of the map');
    assert.equal(counts.grass,125);
    assert.equal(lakeTerrainAt(9,22),'grass');
    assert.equal(mapPlacementError(mapDefinition('lake'),{width:3,length:2},9,22,{depths:['grass']}),null);
    assert.match(mapPlacementError(mapDefinition('lake'),{width:2,length:3},9,22,{depths:['grass']})!,/land/);
    assert.equal(lakeTerrainAt(11,23),'grass');
    assert.equal(lakeTerrainAt(9,24),'deep');
    assert.match(mapPlacementError(mapDefinition('lake'),{width:3,length:2},9,22,{depths:['deep']})!,/deep/);
    assert.equal(lakeTerrainAt(16,0),'river');
    assert.equal(lakeTerrainAt(16,39),'river');
    assert.equal(lakeTerrainAt(8,5),'grass');
    assert.equal(lakeTerrainAt(8,8),'shallow');
    assert.equal(lakeTerrainAt(8,20),'deep');
});

test('deep water is one connected body with uneven borders and varying bend spacing',()=>{
    const cells=new Set<string>(),left:number[]=[],right:number[]=[];
    for(let row=0;row<20;row++){
        const deep=[];
        for(let column=0;column<40;column++)if(lakeTerrainAt(row,column)==='deep'){cells.add(`${row}:${column}`);deep.push(column);}
        left.push(Math.min(...deep));right.push(Math.max(...deep));
    }
    assert.ok(new Set(left).size>=3);assert.ok(new Set(right).size>=3);
    for(const border of [left,right]){
        const bends=border.flatMap((value,index)=>index&&value!==border[index-1]?[index]:[]);
        assert.ok(new Set(bends.slice(1).map((bend,index)=>bend-bends[index]!)).size>1,'bends do not repeat at one fixed interval');
    }
    const queue=[cells.values().next().value!],seen=new Set(queue);
    for(let i=0;i<queue.length;i++){
        const [row,column]=queue[i]!.split(':').map(Number);
        for(const [dr,dc]of [[-1,0],[1,0],[0,-1],[0,1]]){
            const key=`${row!+dr!}:${column!+dc!}`;
            if(cells.has(key)&&!seen.has(key)){seen.add(key);queue.push(key);}
        }
    }
    assert.equal(seen.size,cells.size,'the island and zigzags never split the deep lake into separate pools');
});

test('placement checks full footprints, map bounds and cardinal shore access', () => {
    const lake=mapDefinition('lake');
    assert.equal(mapPlacementError(lake,{width:3,length:4},6,1,{depths:['grass']}),null);
    assert.match(mapPlacementError(lake,{width:3,length:4},6,5,{depths:['grass']})!,/land/i);
    assert.match(mapPlacementError(lake,{width:3,length:4},18,1,{depths:['grass']})!,/inside/i);
    assert.equal(mapPlacementError(lake,{width:2,length:3},16,0,{depths:['shallow']}),null,'a river is shallow water');
    assert.match(mapPlacementError(lake,{width:2,length:3},16,0,{depths:['grass']})!,/river/i,'but never land');
    assert.match(mapPlacementError(mapDefinition('town'),{width:1,length:1},16,6,{depths:['shallow','deep']})!,/river friends/,'the basket spot stays reserved');
    assert.equal(mapPlacementError(lake,{width:2,length:3},8,7,{depths:['shallow'],shore:true}),null);
    assert.match(mapPlacementError(lake,{width:2,length:3},8,30,{depths:['shallow'],shore:true})!,/shore/i);
    assert.equal(mapPlacementError(lake,{width:2,length:3},8,11,{depths:['deep']}),null);
    assert.match(mapPlacementError(lake,{width:2,length:3},8,9,{depths:['deep']})!,/deep/i);
});
