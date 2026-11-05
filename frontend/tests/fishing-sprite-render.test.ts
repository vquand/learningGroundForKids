import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement,Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
test('fish atlas windows explicitly clip source pixels even in rectangular icon slots',async()=>{
 const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});
 try{
  const {CatchArt}=await server.ssrLoadModule('/src/features/fishing/FishingArt.tsx');
  const {FISH}=await server.ssrLoadModule('/src/features/fishing/viewCatalog.ts');
  const html=renderToStaticMarkup(createElement(Fragment,null,...FISH.map((fish:{id:string})=>createElement(CatchArt,{key:fish.id,fishId:fish.id}))));
  const sprites=[...html.matchAll(/<svg\b[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/g)];
  assert.equal(sprites.length,FISH.length);
  const ids=new Set<string>();
  for(const [,viewBox,content]of sprites){
   const clip=content!.match(/<clipPath id="([^"]+)" clipPathUnits="userSpaceOnUse"><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/);
   assert.ok(clip,`Missing source-window clip: ${viewBox}`);
   assert.equal(clip.slice(2).join(' '),viewBox);
   assert.ok(content!.includes(`clip-path="url(#${clip[1]})"`));
   assert.ok(!ids.has(clip[1]!));ids.add(clip[1]!);
  }
 }finally{await server.close();}
});
