import type {AdventureEntry} from '../../../server/src/adventures/types.ts';
import {createCabbageRollSession,nextCabbageRoll,type CabbageRollOutcome} from '../../../server/src/town-building/cabbage-rolls.ts';
import {summarizeChild} from '../../../server/src/parent-reports/summary.ts';
/** Isolated reducer-backed preview. No real accounts, database, or production routes. */
import { createServer, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import * as wall from '../../../server/src/math-wall/game.ts';
import * as racing from '../../../server/src/road-racing/game.ts';
import { makeQuestion, QUESTION_ANIMALS, type QuestionAnimal } from '../../../server/src/road-racing/questions.ts';
import { wallReward } from '../../../server/src/town-building/rewards.ts';

let wallState = wall.emptyProgress(), raceState = racing.emptyProgress();
let finishOnTick = false, lastPlace = false, raceSequence = 0;
let cabbageState=createCabbageRollSession(), cabbage=false;
let multiplication = false;
let picture:QuestionAnimal|undefined;
let ordering = false, fixtureNow = Date.now();
const plugin: Plugin = {name: 'minigame-rewards-fixture', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/__reward-fixture') {
      cabbage=['undercooked','okay','perfect','burnt'].includes(url.searchParams.get('cabbage')??'');
      // Seed the verified-result boundary; DB tests execute the entire recipe.
      cabbageState={...createCabbageRollSession(),...(cabbage?{phase:'result' as const,rolls:3,arranged:3,outcome:url.searchParams.get('cabbage') as CabbageRollOutcome}:{})};
      wallState = wall.emptyProgress(); raceState = racing.emptyProgress();
      finishOnTick = false; lastPlace = url.searchParams.has('last');
      multiplication = url.searchParams.has('multiplication');
      ordering = url.searchParams.has('ordering'); fixtureNow = Date.now();
      picture = QUESTION_ANIMALS.find(animal=>animal===url.searchParams.get('picture'));
      if (ordering || picture) multiplication = true;
      res.end('Reset'); return;
    }
    if (!url.pathname.startsWith('/api/v1/profiles/profile-a/')) { next(); return; }
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname.endsWith('/adventures')) {
      const friends=url.searchParams.get('scope')==='friends',older=url.searchParams.has('cursor');
      const actor={id:friends?'friend-a':'profile-a',name:friends?'Mina':'Ada',emoji:'⭐',color:'green',avatar_type:null,avatar_url:null,avatar_frame:null};
      const entry=(id:string,kind:AdventureEntry['kind'],game:AdventureEntry['game'],count:number,subject:string,at:string):AdventureEntry=>({id,kind,game,count,data:{subject},occurred_at:at,profile:actor});
      const entries=older?[entry('older','town_built','town',1,'Normal house','2030-01-02T02:10:00Z')]:[
        entry(friends?'friend-road':'roads','town_built','town',friends?12:59,'Rocky road','2030-01-02T03:59:58Z'),
        friends?entry('words','ufo_solved','ufo',9,'CAT','2030-01-02T03:50:00Z'):entry('meals','meal_burnt','kitchen',3,'Cabbage rolls','2030-01-02T03:45:00Z')];
      res.end(JSON.stringify({entries,next_cursor:older?null:Buffer.from(JSON.stringify({at:'2030-01-02T03:45:00Z',id:'meals'})).toString('base64url')}));return;
    }
    if (url.pathname.endsWith('/achievement-groups')) {res.end(JSON.stringify(cabbage?summarizeChild({id:'profile-a',name:'Ada',emoji:'⭐',color:'blue',cabbage_rolls:cabbageState.achievements}).games:[]));return;}
    if (url.pathname.endsWith('/leaderboard')) {res.end('[]');return;}
    let input: any = {}; if (req.method === 'POST') {let body = ''; for await (const part of req) body += part; input = JSON.parse(body);}
    if (picture && input.action?.type === 'answer') fixtureNow += 200;
    const now = ordering || picture ? fixtureNow : Date.now();
    try {
      if (url.pathname.includes('/cabbage-rolls')) {
        let stamina=0;
        if(req.method==='POST') {
          if(input.revision!==cabbageState.revision)throw new Error('Stale recipe');
          const result=nextCabbageRoll(cabbageState,input.command,now);
          cabbageState=result.session;stamina=result.stamina;
        }
        res.end(JSON.stringify({...cabbageState,townReward:{stamina}}));return;
      }
      if (url.pathname.includes('/math-wall')) {
        const before = wallState.stats.passed;
        if (req.method === 'POST') {
          if (input.revision !== wallState.revision) throw new Error('Stale wall revision');
          wallState = input.settings ? wall.startSession(wallState, input.settings, now, () => 0) : wall.applyAction(wallState, input.action, now, () => 0);
          wallState.revision++;
        }
        const reward = wallState.stats.passed > before ? wallReward(wallState.session!.difficulty) : {};
        res.end(JSON.stringify({...wall.publicState(wallState, now), townReward: reward}));return;
      }
      if (url.pathname.includes('/road-racing')) {
        if (req.method === 'POST') {
          if (input.revision !== raceState.revision) throw new Error('Stale race revision');
          if (input.settings) {
            raceState = racing.startRace(raceState, input.settings, now, () => .5, `race-${++raceSequence}`);finishOnTick = !multiplication;
            if (multiplication) {
              raceState.race!.sequence = 5;
              raceState.race!.question = makeQuestion(input.settings.language,5,raceState.race!.seen,()=>.5);
              raceState.race!.seen.push(raceState.race!.question.key);
            }
            if (picture) {
              raceState.race!.sequence = 2;
              raceState.race!.question = makeQuestion(input.settings.language,2,QUESTION_ANIMALS.filter(animal=>animal!==picture).map(animal=>`picture:${animal}`),()=>.5);
              raceState.race!.seen.push(raceState.race!.question.key);
            }
            if (ordering) raceState.race!.racers.forEach((racer, index) => { racer.distance = (6-index)*10; });
          }
          else if (finishOnTick && input.action?.type === 'tick') {
            // Force an arrival through the real server reducer; keep the preview short.
            const player = raceState.race!.racers.find(racer => racer.player)!;
            player.distance = 1199.9;
            if (lastPlace) raceState.race!.racers.filter(racer => !racer.player).forEach((racer, i) => {racer.distance = 1200; racer.finishedAt = raceState.race!.updatedAt - 100 + i;});
            raceState = racing.act(raceState, input.action, now, () => .5);finishOnTick = false;
          } else raceState = racing.act(raceState, input.action ?? {type: 'leave'}, now, () => .5);
          raceState.revision++;
        }
        res.end(JSON.stringify(racing.publicState(raceState, now)));return;
      }
      res.statusCode = 404;res.end('{}');
    } catch(error) {res.statusCode = 409;res.end(JSON.stringify({error: {message: (error as Error).message}}));}
  });
}};
const server = await createServer({configFile: false, root: fileURLToPath(new URL('../../', import.meta.url)), cacheDir: '/tmp/plg-minigame-rewards-cache', plugins: [react(), plugin], server: {host: '127.0.0.1', port: 5192, strictPort: true}});
await server.listen();
console.log('Reward preview: http://127.0.0.1:5192/tests/browser/minigame-rewards-harness.html');
