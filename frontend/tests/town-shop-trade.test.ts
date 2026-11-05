import test from 'node:test';
import assert from 'node:assert/strict';
import {shopErrorMessage,shopPaymentRows,shopPanelAfter,shopQuoteState,shopReceiptShouldAnimate,shopResultRows,cropSeasonTag,rackSlotForCrop} from '../src/features/town-building/shopTradeModel.ts';
import {VEGETABLE_RACK_ART,VEGETABLE_RACK_SLOTS,VEGETABLE_RACK_SIZE} from '../src/features/town-building/vegetableShopArt.ts';

test('shop payment rows expose labels and amounts, never hidden units',()=>{
    assert.deepEqual(shopPaymentRows([{item:'wool',amount:2},{item:'P3',amount:1},{item:'milk',amount:3}]),[
        {item:'wool',label:'Wool',amount:2},{item:'P3',label:'Pebble Carp',amount:1},{item:'milk',label:'Milk',amount:3},
    ]);
});

test('shop quote states prioritize storage room and affordability',()=>{
    const base={entityId:'shop',crop:'carrot' as const,quantity:1,revision:4,inSeason:true,units:4,payment:[],confirmation:'a'.repeat(64)};
    assert.equal(shopQuoteState(undefined),'none');
    assert.equal(shopQuoteState({...base,affordable:true,storageRoom:true}),'affordable');
    assert.equal(shopQuoteState({...base,affordable:false,storageRoom:true}),'not-affordable');
    assert.equal(shopQuoteState({...base,affordable:true,storageRoom:false}),'storage-full');
});

test('shop error codes map to friendly localized keys',()=>{
    assert.equal(shopErrorMessage('SHOP_QUOTE_CHANGED'),'The shop updated its offer. Please check the new payment.');
    assert.equal(shopErrorMessage('SHOP_NOT_AFFORDABLE'),'Not enough animal products yet');
    assert.equal(shopErrorMessage('SHOP_STORAGE_FULL'),'Storage is full for this vegetable');
    assert.equal(shopErrorMessage('SHOP_NOT_FOUND'),'This vegetable shop is not ready right now.');
    assert.equal(shopErrorMessage('TOWN_STALE'),'Your town changed. Sync and try again.');
    assert.equal(shopErrorMessage('OTHER'),null);
});

test('only newly committed shop receipts animate and result rows include bought and paid goods',()=>{
    const receipt={id:'shop:town:carrot:5',revision:5,mapId:'town' as const,crop:'carrot' as const,amount:2,spent:[{item:'wool' as const,amount:1}],reward:{crop:'carrot' as const,amount:2},duplicate:false};
    assert.equal(shopReceiptShouldAnimate(receipt),true);
    assert.equal(shopReceiptShouldAnimate({...receipt,duplicate:true}),false);
    assert.equal(shopReceiptShouldAnimate({...receipt,reward:{crop:'carrot',amount:0}}),false);
    assert.deepEqual(shopResultRows(receipt),[
        {item:'carrot',label:'Carrot',amount:2},{item:'wool',label:'Wool',amount:1},
    ]);
});

test('the approved rack keeps eight measured crate slots in a four by two grid',()=>{
    assert.match(VEGETABLE_RACK_ART,/vegetable-rack-v1\.png$/);
    assert.deepEqual(VEGETABLE_RACK_SIZE,{width:1024,height:775});
    assert.equal(VEGETABLE_RACK_SLOTS.length,8);
    assert.deepEqual(VEGETABLE_RACK_SLOTS.slice(0,4).map(slot=>slot.x),[.170,.391,.610,.831]);
    assert.deepEqual(VEGETABLE_RACK_SLOTS.map(slot=>slot.y),[.47,.47,.47,.47,.752,.752,.752,.752]);
    assert.deepEqual(rackSlotForCrop(7),{x:.831,y:.752});
});

test('rack season tags use planting season until the trusted quote answers',()=>{
    assert.deepEqual(cropSeasonTag('carrot','spring'),{season:'spring',outOfSeason:false});
    assert.deepEqual(cropSeasonTag('carrot','winter'),{season:'spring',outOfSeason:true});
    assert.deepEqual(cropSeasonTag('carrot','winter',undefined,true),{season:'spring',outOfSeason:false});
    assert.deepEqual(cropSeasonTag('carrot','spring',undefined,false),{season:'spring',outOfSeason:true});
});

test('shop panel state machine keeps the rack, buy and receipt states explicit',()=>{
    assert.equal(shopPanelAfter('rack','pick'),'buy');
    assert.equal(shopPanelAfter('buy','purchase-success'),'result');
    assert.equal(shopPanelAfter('result','back-to-rack'),'rack');
    assert.equal(shopPanelAfter('rack','purchase-success'),'rack');
});

test('a stale town revision refreshes the quote like a changed offer, other refusals do not',async()=>{
    const {shopErrorRefreshesQuote}=await import('../src/features/town-building/shopTradeModel.ts');
    assert.equal(shopErrorRefreshesQuote('TOWN_STALE'),true);
    assert.equal(shopErrorRefreshesQuote('SHOP_QUOTE_CHANGED'),true);
    assert.equal(shopErrorRefreshesQuote('SHOP_NOT_AFFORDABLE'),false);
});
