/** Isolated in-memory fixture. Never connects to a real API or database. */
import {mapDefinition} from '../../../server/src/town-building/maps/registry.ts';
import {tickTownEvents,interactWomensDay} from '../../../server/src/town-building/events/index.ts';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {ACHIEVEMENT_GROUPS,achievementGroupStatus} from '../../../server/src/achievement-catalog.ts';
import {summarizeChild,summarizeFamily} from '../../../server/src/parent-reports/summary.ts';
const state=initialTown();
state.entities.push({id:'house2',blueprintId:'large-house',x:6,y:15,paidCost:{}},{id:'tree1',blueprintId:'lemon',x:3,y:17,paidCost:{}},{id:'tree2',blueprintId:'apple',x:9,y:27,paidCost:{}},{id:'chickens',blueprintId:'coop',x:6,y:23,paidCost:{}});
for(let y=4;y<31;y++)state.entities.push({id:`road-${y}`,blueprintId:'dirt-road',x:11,y,paidCost:{}});
const environment={season:'autumn',timeOfDay:'noon',isDay:true,localDate:'2026-10-20',timeZone:'Asia/Ho_Chi_Minh',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Home town'};
tickTownEvents(state,mapDefinition('town'),environment,0,300);
const installed:any[]=[];
const server=await createServer({configFile:false,root:fileURLToPath(new URL('../../',import.meta.url)),cacheDir:'/tmp/plg-womens-day-vite',plugins:[react(),{name:'womens-day-fixture',configureServer(server){server.middlewares.use((req,res,next)=>{
 if(req.url?.startsWith('/__event-fixture/day')){
  const value=new URL(req.url,'http://fixture.local').searchParams.get('day');
  if(!['19','20','21','22'].includes(value??'')){res.statusCode=400;res.end();return;}
  environment.localDate=`2026-10-${value}`;tickTownEvents(state,mapDefinition('town'),environment,0,300);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(environment));return;
 }
 if(!req.url?.startsWith('/api/'))return next();
 void(async()=>{
  const path=new URL(req.url!,'http://fixture.local').pathname;
  if(path.endsWith('/events/womens-day/action')){let body='';for await(const chunk of req)body+=chunk;interactWomensDay(state,environment,JSON.parse(body));}
  const child=summarizeChild({id:'profile-a',name:'Aha',emoji:'star',color:'pink',town:state}),group=ACHIEVEMENT_GROUPS.find(g=>g.id==='womens-day-2026')!;
  let data:unknown=[];
  if(path.endsWith('/environment'))data=environment;
  else if(path.endsWith('/reports'))data=summarizeFamily([child],new Date());
  else if(path.endsWith('/achievement-groups'))data=child.games;
  else if(path.endsWith('/achievements/migrate')){const pending=installed.length===0;installed.splice(0,installed.length,...group.achievements.map(b=>({...b,groupId:group.id})));data={groups:[achievementGroupStatus(group,installed)],migratedGroups:pending?1:0,installed:pending?group.achievements.length:0};}
  else if(path.endsWith('/admin/achievements'))data=[achievementGroupStatus(group,installed)];
  else if(path.includes('/town'))data={...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
 })().catch(error=>{res.statusCode=500;res.end(JSON.stringify({error:{message:String(error)}}));});
 });}}],server:{host:'127.0.0.1',port:5179,strictPort:true}});
await server.listen();console.log('Women’s Day fixture: http://127.0.0.1:5179/tests/browser/town-building-harness.html');
