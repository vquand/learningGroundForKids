import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown} from '../../server/src/town-building/game.ts';
import {emptyLake,applyLakeCommand} from '../../server/src/town-building/maps/lake/game.ts';
import {harvestChoice} from '../src/features/town-building/maps/lake/harvestChoice.ts';
function fixture(){const state=emptyTown();state.maps={lake:emptyLake(1000)};state.maps.lake!.rafts=[{id:'raft',blueprintId:'nursery',x:8,y:12,paidCost:{},generation:0,plant:null,plantGrowth:0,feeder:false,fish:[{id:'grown',species:'P3',growth:300}]}];return state;}
test('only a newly committed harvest of the last fish offers the harvested species',()=>{
 const before=fixture(),command={type:'harvest-fish' as const,raftId:'raft',generation:0},after=applyLakeCommand(before,command,1000,'harvest',{});
 assert.deepEqual(harvestChoice(before,after,'lake',command),{receipt:`raft:${after.revision}`,raftId:'raft',kind:'fish',type:'P3'});
 assert.equal(harvestChoice(after,after,'lake',command),undefined);
 const partial=fixture();partial.maps!.lake!.rafts[0]!.fish.push({id:'young',species:'P3',growth:30});
 assert.equal(harvestChoice(partial,applyLakeCommand(partial,command,1000,'harvest',{}),'lake',command),undefined);
 assert.equal(harvestChoice(before,after,'lake',{type:'stock',raftId:'raft',species:'P3'}),undefined);
});
test('a plant harvest offers its current type; initial reads, failed actions and removal do not',()=>{
 const before=fixture(),raft=before.maps!.lake!.rafts[0]!;raft.blueprintId='floating-garden';raft.fish=[];raft.plant='water-spinach';raft.plantGrowth=300;
 const command={type:'harvest-plant' as const,raftId:'raft',generation:0},after=applyLakeCommand(before,command,1000,'harvest',{});
 assert.deepEqual(harvestChoice(before,after,'lake',command),{receipt:`raft:${after.revision}`,raftId:'raft',kind:'plant',type:'water-spinach'});
 assert.equal(harvestChoice(before,before,'lake',command),undefined);
 const removed=structuredClone(after);removed.maps!.lake!.rafts=[];assert.equal(harvestChoice(before,removed,'lake',command),undefined);
});
