import assert from 'node:assert/strict';
import test from 'node:test';
import {HARVEST_LABELS,harvestReceiptShouldAnimate,harvestResultRows,visibleHarvestCategories} from '../src/features/town-building/townHarvestAllModel.ts';

test('harvest-all buttons follow the server readiness projection without showing counts',()=>{
    assert.deepEqual(visibleHarvestCategories({plants:true,animals:false,fish:true}),['plants','fish']);
    assert.equal(HARVEST_LABELS.plants,'Harvest all plants on this map');
    assert.equal(HARVEST_LABELS.animals,'Harvest all animal products on this map');
});

test('harvest results preserve actual per-product rows and amounts',()=>{
    assert.deepEqual(harvestResultRows([
        {item:'egg',amount:10},{item:'wool',amount:20},{item:'carrot',amount:4},{item:'P3',amount:2},
    ]),[
        {item:'egg',label:'Egg',amount:10},{item:'wool',label:'Wool',amount:20},{item:'carrot',label:'Carrot',amount:4},{item:'P3',label:'Pebble Carp',amount:2},
    ]);
});

test('reward animation is gated to new receipts with a positive server reward',()=>{
    assert.equal(harvestReceiptShouldAnimate({duplicate:false,reward:{wood:2}}),true);
    assert.equal(harvestReceiptShouldAnimate({duplicate:true,reward:{wood:2}}),false);
    assert.equal(harvestReceiptShouldAnimate({duplicate:false,reward:{wood:0}}),false);
    assert.equal(harvestReceiptShouldAnimate(undefined),false);
});
