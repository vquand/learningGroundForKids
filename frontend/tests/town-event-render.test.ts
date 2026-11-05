import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

test('Town visual adapters render only a registered supported server event occurrence',async()=>{
 const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});
 try{
  const {TownTimedEventLayers}=await server.ssrLoadModule('/src/features/town-building/TownTimedEventLayers.tsx');
  const {emptyTown}=await server.ssrLoadModule('../server/src/town-building/game.ts');
  const {tickTownEvents}=await server.ssrLoadModule('../server/src/town-building/events/index.ts');
  const {mapDefinition}=await server.ssrLoadModule('../server/src/town-building/maps/registry.ts');
  const town=emptyTown();tickTownEvents(town,mapDefinition('town'),{localDate:'2026-10-20',timeOfDay:'noon'},0,300);
  const props={canvas:{current:null},entities:[],images:new Map(),localDate:'2026-10-20',zoom:1,camera:{x:0,y:0},blocked:false};
  const render=(events:unknown,localDate=props.localDate)=>renderToStaticMarkup(createElement(TownTimedEventLayers,{...props,events,localDate}));
  assert.equal((render(town.events).match(/class="town-flower-friend"/g)??[]).length,7);
  assert.equal(render(undefined),'','calendar alone cannot activate an event');
  assert.equal(render(town.events,'2026-10-22'),'','expired decorations disappear before cleanup response');
  assert.equal(render(town.events,'2027-10-20'),'','stale occurrence cannot activate a later year');
  town.events['womens-day'].edition='unavailable';assert.equal(render(town.events),'','unknown editions never use the latest visuals');
 }finally{await server.close();}
});
