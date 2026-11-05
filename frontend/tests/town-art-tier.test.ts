import assert from 'node:assert/strict';
import test from 'node:test';
import {devicePxPerTile,tierForDevicePxPerTile,upgradeTier,variantFile,variantWidth} from '../src/features/town-building/townArtTier.ts';
// @ts-expect-error plain ESM script
import {planTiers} from '../scripts/convert-town-art.mjs';

test('tier boundaries follow device pixels per tile',()=>{
    assert.equal(tierForDevicePxPerTile(27),'s');assert.equal(tierForDevicePxPerTile(48),'s');
    assert.equal(tierForDevicePxPerTile(54),'m');assert.equal(tierForDevicePxPerTile(96),'m');
    assert.equal(tierForDevicePxPerTile(97),'l');
});
test('geometry matches the scene tile size and caps the pixel ratio',()=>{
    assert.ok(Math.abs(devicePxPerTile(1366,1000,1,1)-1366/46)<0.01);
    assert.equal(devicePxPerTile(1366,700,2,3),devicePxPerTile(1366,700,2,2));
    assert.equal(devicePxPerTile(0,700,1,1),0);
});
test('tiers only upgrade',()=>{assert.equal(upgradeTier('m','s'),'m');assert.equal(upgradeTier('s','l'),'l');});
test('variants never upscale and alias equal tiers',()=>{
    assert.equal(variantWidth(1000,500,'s'),112);assert.equal(variantWidth(100,500,'l'),36);assert.equal(variantWidth(100,40,'l'),100);
    const small=planTiers(100,40);assert.deepEqual(small.tiers,{l:100});assert.deepEqual(small.aliases,{s:'l',m:'l'});
    assert.equal(variantFile('a',tierForDevicePxPerTile(10),{a:{baseWidth:100,baseHeight:1,pxPerTile:40,tiers:small.tiers,aliases:small.aliases}}),'a@l.webp');
    assert.equal(variantFile('missing','s',{}),null);
});

import {artBaseSize,registerArtScale,scaleSourceRect} from '../src/features/town-building/townArtScale.ts';
test('source rectangles scale exactly per axis, without widening',()=>{
    assert.deepEqual(scaleSourceRect(10,20,30,40,1),[10,20,30,40]);
    assert.deepEqual(scaleSourceRect(10,20,30,40,0.5),[5,10,15,20]);
    assert.deepEqual(scaleSourceRect(100,200,50,60,0.5,0.25),[50,50,25,15]);
});
test('registered variants report their base size',()=>{
    const image={naturalWidth:50,naturalHeight:25} as HTMLImageElement;
    registerArtScale(image,'a',{a:{baseWidth:100,baseHeight:50,pxPerTile:10,tiers:{}}});
    assert.deepEqual(artBaseSize(image),{width:100,height:50});
});
