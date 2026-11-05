import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
let adventureCopy:(entry:AdventureEntry)=>string;
let setUiLanguage:(language:'en'|'vi')=>void;
let loadUiLanguage:(language:'en'|'vi')=>Promise<void>;
let server:Awaited<ReturnType<typeof createServer>>;
const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
before(async()=>{
  Object.defineProperty(globalThis,'document',{configurable:true,value:{documentElement:{lang:'en'}}});
  server=await createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),cacheDir:'/tmp/plg-adventure-copy-tests',server:{middlewareMode:true,hmr:false}});
  ({adventureCopy}=await server.ssrLoadModule('/src/components/Adventures/adventureCopy.ts'));
  ({setUiLanguage}=await server.ssrLoadModule('/src/lib/uiLanguage.ts'));
  ({loadUiLanguage}=await server.ssrLoadModule('/src/i18n/uiText.ts'));
});
after(async()=>{await server?.close();if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');});
import type {AdventureEntry} from '../src/api/adventures.ts';
const entry=(kind:AdventureEntry['kind'],count:number,data:AdventureEntry['data']):AdventureEntry=>({id:'hourly-test',kind,game:'town',count,data,occurred_at:'2030-01-02T03:59:58Z',profile:{id:'kid',name:'Ada',emoji:'⭐',color:'blue',avatar_type:null,avatar_url:null,avatar_frame:null}});
test('hourly journal copy shows totals and keeps singleton wording',()=>{
  setUiLanguage('en');
  assert.equal(adventureCopy(entry('town_built',59,{subject:'Rocky road'})),'Built 59 rocky roads');
  assert.equal(adventureCopy(entry('town_built',1,{subject:'Rocky road'})),'Built Rocky road');
  assert.equal(adventureCopy(entry('meal_burnt',3,{subject:'Cabbage rolls'})),'Burnt 3 batches of Cabbage rolls — another try awaits!');
  assert.equal(adventureCopy(entry('town_harvest',2,{amount:8})),'Harvested 8 vegetables');
  assert.equal(adventureCopy(entry('waddle_passed',4,{amount:20})),'Passed 4 Waddle Walls — best 20 points');
});
test('grouped journal copy is localized without translating child learning content',async()=>{
  await loadUiLanguage('vi');
  setUiLanguage('vi');
  try{
    assert.equal(adventureCopy(entry('town_built',59,{subject:'Rocky road'})),'Đã xây 59 đoạn đường đá');
    assert.equal(adventureCopy(entry('ufo_solved',3,{subject:'CAT'})),'Đã đoán đúng 3 từ');
  }finally{setUiLanguage('en');}
});
