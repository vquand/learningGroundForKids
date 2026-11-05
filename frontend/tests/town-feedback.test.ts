import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {drawPrecipitation} from '../src/features/town-building/scene/weather.ts';
import type {Environment} from '../../server/src/town-building/environment.ts';

test('Town feedback keeps failures visible and announced when a contextual card replaces the idle hint',async()=>{
 const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});
 try{
  const {TownMapFeedback}=await server.ssrLoadModule('/src/features/town-building/TownMapLayout.tsx');
  const render=(props:Record<string,unknown>)=>renderToStaticMarkup(createElement(TownMapFeedback,props));
  for(const contextual of [false,true]){
   const html=render({error:'Your town changed. Sync and try again.',tip:'Pick a tile.',contextual});
   assert.match(html,/role="alert"/);assert.match(html,/Your town changed/);assert.doesNotMatch(html,/hidden/);
  }
  assert.match(render({tip:'Pick a tile.',contextual:true}),/hidden/);
  const idle=render({tip:'Built! A little more of your map is ready.'});
  assert.match(idle,/role="status"/);assert.match(idle,/Built!/);assert.doesNotMatch(idle,/hidden/);
 }finally{await server.close();}
});

test('unknown precipitation never paints invented snow or rain',()=>{
 const calls:string[]=[],ctx=new Proxy({},{get:(_target,key)=>()=>calls.push(String(key)),set:()=>true}) as CanvasRenderingContext2D;
 for(const precipitation of [null,'none'] as const){drawPrecipitation(ctx,{precipitation} as Environment,100,100,1,false);assert.deepEqual(calls,[]);}
 for(const precipitation of ['rain','snow'] as const){calls.length=0;drawPrecipitation(ctx,{precipitation} as Environment,100,100,1,false);assert.ok(calls.includes(precipitation==='rain'?'stroke':'fill'));}
});
