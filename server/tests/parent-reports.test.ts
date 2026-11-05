import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeChild, summarizeFamily } from '../src/parent-reports/summary.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';
import { ACHIEVEMENT_GROUPS } from '../src/achievement-catalog.js';

const child = { id: 'kid-a', name: 'Ada', emoji: '⭐', color: '#456', exploring_completed: 5,
  category_counts: [5], item_passes: 1, daily_passes: 0, quiz_attempts: 3, quiz_passes: 1 };
const fishing = {
  stats: { caught: 22, questions: 30, casts: 28, garbage: 5 }, points: { pond: 60, river: 180 },
  discovered: { pond: ['P1', 'P2', 'P3', 'P4', 'P5', 'T1'], river: ['P1', 'T1', 'R1', 'R2', 'R3', 'R4', 'R5'] },
  earnedBaits: ['baby', 'beginner', 'leafy', 'chewy', 'bouncy', 'crunchy', 'master'],
  friendCatches: ['highland', 'capybara', 'cow'], earned: { 'fishing-first-nibble': '2026-10-19T00:00:00Z', 'forged-fishing-badge': '2026-10-19T00:00:00Z' },
  question: { answer: 99999 }, cast: { outcome: 'PRIVATE_FISHING_OUTCOME' },
};

test('fishing reports include all seven consistent badges and verified lifetime counters without private state', () => {
  const report = summarizeChild({ ...child, fishing });
  const game = report.games.find(game => game.id === 'fishing')!;
  assert.equal(game.name, 'Fishing Friends');
  assert.equal(game.scope, 'lifetime');
  assert.equal(game.recorded, true);
  assert.deepEqual(game.metrics.map(value => [value.key, value.value]), [['caught', 22], ['questions', 30], ['casts', 28], ['pondPoints', 60], ['riverPoints', 180], ['pondSpecies', 6], ['riverSpecies', 7], ['baits', 7], ['friends', 3]]);
  assert.equal(game.achievements.length, 7);
  assert.ok(game.achievements.every(badge => badge.earned));
  assert.equal(game.achievements[0]!.earned_at, '2026-10-19T00:00:00.000Z');
  const definition = ACHIEVEMENT_GROUPS.find(group => group.id === 'fishing')!;
  assert.deepEqual(game.achievements.map(({ earned, earned_at, ...badge }) => badge), definition.achievements);
  for (const secret of ['99999', 'PRIVATE_FISHING_OUTCOME', 'forged-fishing-badge', '"question"', '"cast"']) assert.equal(JSON.stringify(report).includes(secret), false);
});

test('malformed fishing progress cannot inflate species, math skills, companions or counters', () => {
  const report = summarizeChild({ ...child, fishing: {
    stats: { caught: '999', questions: Infinity, casts: -1 }, points: { pond: -60, river: '180' },
    discovered: { pond: ['P1', 'P1', 'R1', 'forged', null], river: ['P1', 'P2', 'forged'] },
    earnedBaits: ['baby', 'baby', 'forged', 1], friendCatches: ['cow', 'cow', 'forged', null],
    earned: { 'fishing-first-nibble': 'not a date', forged: '2026-10-19T00:00:00Z' },
  } });
  const game = report.games.find(game => game.id === 'fishing')!;
  assert.deepEqual(game.metrics.map(metric => metric.value), [0, 0, 0, 0, 0, 1, 1, 1, 1]);
  assert.ok(game.achievements.every(badge => !badge.earned));
  const absent = summarizeChild(child).games.find(game => game.id === 'fishing')!;
  assert.equal(absent.recorded, false);
  assert.ok(absent.achievements.every(badge => !badge.earned));
});
test('every minigame achievement group is included in parent and admin child reports', () => {
  const report = summarizeChild(child);
  for (const group of ACHIEVEMENT_GROUPS) {
    const game = report.games.find(game => game.id === group.id);
    assert.ok(game, `${group.id} must be included in the shared child report`);
    assert.deepEqual(game.achievements.map(badge => badge.id), group.achievements.map(badge => badge.id));
    if (group.earning === 'catalog-only') assert.ok(game.achievements.every(badge => !badge.earned && badge.earned_at === null));
  }
  const cabbage = report.games.find(game => game.id === 'cabbage-rolls');
  assert.ok(cabbage);
  assert.equal(cabbage.scope, 'lifetime');
  assert.equal(cabbage.recorded, false);
  assert.equal(cabbage.metrics[0]!.value, 0);
});

test('shared Parent and Admin projection includes Math Scientist at ten verified hard walls', () => {
  for (const hard of [9, 10, 11]) {
    const report = summarizeChild({ ...child, math_wall: { stats: { passed: hard, hard } } });
    const badges = report.games.find(game => game.id === 'waddle-wall')!.achievements;
    const badge = badges.find(badge => badge.id === 'waddle-wall-scientist');
    assert.ok(badge);
    assert.equal(badge.name, 'Math Scientist');
    assert.equal(badge.difficulty, 'hard');
    assert.equal(badge.target, 10);
    assert.equal(badge.earned, hard >= 10);
    assert.equal(badge.badge, '/minigames/math-quiz-wall/math-scientist.png');
  }
});
test('family reports include verified games and never expose private question or board data', () => {
  const report = summarizeChild({ ...child,
    ufo: { stats: { solved: 25, medium: 10, hard: 3, friends: { cow: 10 }, captures: {} }, session: { word: { word: 'PRIVATE' } } },
    math_wall: { best: 19, stats: { passed: 10, medium: 4, hard: 2, streak: 5 }, session: { question: { answer: 987 } } },
    infinidrill: { game: { depthMetres: 240, mainQuestionsCompleted: 12, ownedUpgradeIds: ['one'] }, earned: { 'infinidrill-first-drill': '2026-10-12T00:00:00Z', 'forged-id': '2026-10-12T00:00:00Z' } },
    miniku: { completed: 6, completedBySize: { '3': 4, '4': 1, '5': 1 }, board: { solution: [9, 8, 7] }, earned: { 'miniku-first-solve': '2026-10-12T00:00:00Z' } },
    town: { entities: [{ blueprintId: 'house' }, { blueprintId: 'dirt-road' },{blueprintId:'bakery',civ:{phase:'ready'}},{blueprintId:'grocery',civ:{phase:'waiting'}}], civ:{helpedTypes:['bakery','bakery','forged']},materials: { wood: 11 }, earned: { 'town-first-home': '2026-10-12T00:00:00Z','town-new-neighbor':'2026-10-16T00:00:00Z' } },
    drink_completions: 7, study_sessions: 2, cards_reviewed: 16,
  });
  assert.equal(report.exploring_badges, 3);
  const game = (id: string) => report.games.find(game => game.id === id)!;
  assert.equal(game('infinidrill-earth').scope, 'current-expedition');
  assert.equal(game('infinidrill-earth').metrics.find(metric => metric.key === 'depth')!.value, 240);
  assert.equal(game('miniku').metrics[0]!.value, 6);
  assert.equal(game('food-and-drink').metrics[0]!.value, 7);
  assert.equal(game('cooking').metrics[0]!.value, null);
  assert.ok(game('cooking').achievements.every(badge => !badge.earned));
  assert.equal(game('town-building').metrics[0]!.value, 3);
  assert.equal(game('town-building').metrics.find(m=>m.key==='neighbors')!.value,2);
  assert.equal(game('town-building').metrics.find(m=>m.key==='helpedTypes')!.value,1);
  const neighbors=game('town-building').achievements.filter(a=>['town-new-neighbor','town-helping-hand','town-lively-street'].includes(a.id));
  assert.equal(neighbors.length,3);assert.equal(neighbors[0]!.earned,true);
  assert.ok(neighbors.every(a=>a.badge==='/minigames/town-building/civ-badges-v1.png'));
  assert.ok(neighbors.slice(1).every(a=>!a.earned));
  assert.equal(game('town-building').metrics[1]!.value, 1);
  const text = JSON.stringify(report);
  for (const privateField of ['"solution":', '"answer":', 'PRIVATE', 'forged-id']) assert.equal(text.includes(privateField), false);
  const family = summarizeFamily([report], new Date('2026-10-13T00:00:00Z'));
  assert.equal(family.totals.children, 1);
  assert.equal(family.totals.earned_badges, report.earned_badges);
  assert.equal(family.totals.drink_completions, 7);
});

test('missing and malformed persisted counters stay safe without inventing unsupported progress', () => {
  const report = summarizeChild({ ...child, miniku: { completed: -10, completedBySize: { '3': '999' }, earned: null },
    infinidrill: { game: { mainQuestionsCompleted: Infinity, depthMetres: '9999' }, earned: { 'infinidrill-first-drill': 'invalid date' } } });
  assert.equal(report.games.find(game => game.id === 'miniku')!.metrics[0]!.value, 0);
  assert.equal(report.games.find(game => game.id === 'infinidrill-earth')!.metrics[0]!.value, 0);
  assert.ok(report.games.find(game => game.id === 'infinidrill-earth')!.achievements.every(badge => !badge.earned));
  assert.equal(report.games.find(game => game.id === 'cooking')!.recorded, false);
  assert.equal(report.games.find(game => game.id === 'shoo-shoo-ufo')!.recorded, false);
  assert.deepEqual(summarizeFamily([], new Date()).totals,
    { children: 0, exploring_completed: 0, quiz_attempts: 0, quiz_passes: 0, earned_badges: 0, study_sessions: 0, drink_completions: 0 });
});

test('report endpoints require parent access, scope to the session family, and hide foreign profiles', async () => {
  let elevated = false, reads = 0;
  const db = {
    auth: {
      async findFamilyBySessionHash() { return { id: 'family-a', email: 'parent@example.test', displayName: 'Family A', passwordHash: 'stored', role: 'family', isActive: true }; },
      async parentAccess() { return elevated ? { method: 'password', until: new Date(Date.now() + 10000) } : null; },
    },
    profiles: { async get(familyId: string, profileId: string) {
      assert.equal(familyId, 'family-a');
      return profileId === 'kid-a' ? { id: 'kid-a' } : null;
    } },
    parentReports: { async read(familyId: string) { reads++; assert.equal(familyId, 'family-a'); return summarizeFamily([summarizeChild({ ...child, fishing, cabbage_rolls:{completed:1,perfect:1}, math_wall: { stats: { passed: 10, hard: 10 } } })], new Date()); } },
    items: { async getParent(itemId: string, familyId: string) {
      assert.equal(familyId, 'family-a');
      return itemId === 'lesson-a' ? {id:itemId,owner_family_id:'family-a',can_edit:true,is_disabled_for_family:false,
        quiz_questions:[{question:'Private grading prompt',correct_answers:[1]}]} : null;
    } },
  } as unknown as AppDatabase;
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://unused:unused@localhost/unused', ALLOWED_ORIGINS: 'https://reports.example.test', ALLOWED_FORWARDED_HOSTS: 'reports.example.test' });
  const app = createApp({ config, db, logger: { info() {}, warn() {}, error() {} } });
  const request = (path: string, cookie = true) => app.request(`https://reports.example.test/api/v1/parent/reports${path}`, { headers: cookie ? { cookie: 'plg_session=opaque-test-session' } : {} });
  assert.equal((await request('', false)).status, 401);
  assert.equal((await request('')).status, 403);
  assert.equal(reads, 0);
  elevated = true;
  const response = await request('?family_id=family-b');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const parentReport = await response.json();
  assert.equal(parentReport.children[0].id, 'kid-a');
  const scientist = parentReport.children[0].games.find((game: { id: string }) => game.id === 'waddle-wall').achievements.find((badge: { id: string }) => badge.id === 'waddle-wall-scientist');
  assert.equal(scientist.earned, true);
  assert.equal(scientist.name, 'Math Scientist');
  assert.equal(scientist.badge, '/minigames/math-quiz-wall/math-scientist.png');
  const parentFishing = parentReport.children[0].games.find((game: { id: string }) => game.id === 'fishing');
  assert.equal(parentFishing.achievements.length, 7);
  assert.ok(parentFishing.achievements.every((badge: { earned: boolean }) => badge.earned));
  assert.equal((await request('/kid-a')).status, 200);
  assert.equal((await request('/kid-b')).status, 404);
  const content = await app.request('https://reports.example.test/api/v1/parent/content/lesson-a',{headers:{cookie:'plg_session=opaque-test-session'}});
  assert.equal(content.status,200);
  const item = await content.json();
  assert.equal(item.can_edit,true);
  assert.equal(item.quiz_questions,undefined);
  assert.equal(item.owner_family_id,undefined);
  assert.equal((await app.request('https://reports.example.test/api/v1/parent/content/foreign-lesson',{headers:{cookie:'plg_session=opaque-test-session'}})).status,404);
  assert.equal((await app.request('https://reports.example.test/api/v1/profiles/kid-a/achievement-groups')).status, 401);
  assert.equal((await app.request('https://reports.example.test/api/v1/profiles/kid-a/achievement-groups',{method:'POST',headers:{cookie:'plg_session=opaque-test-session'}})).status, 405);
  const achievementGroups = await app.request('https://reports.example.test/api/v1/profiles/kid-a/achievement-groups',{headers:{cookie:'plg_session=opaque-test-session'}});
  assert.equal(achievementGroups.status, 200);
  const groups = await achievementGroups.json() as Array<{ id: string; achievements: Array<{ id: string; earned: boolean }> }>;
  assert.deepEqual(groups.find(group => group.id === 'fishing'), parentFishing);
  const cabbage = groups.find(group => group.id === 'cabbage-rolls');
  assert.ok(cabbage);
  assert.deepEqual(cabbage.achievements.map(badge => [badge.id, badge.earned]), [
    ['cabbage-rolls-completed', true],
    ['cabbage-rolls-undercooked', false],
    ['cabbage-rolls-burnt', false],
    ['cabbage-rolls-perfect', true],
  ]);
  assert.equal((await app.request('https://reports.example.test/api/v1/profiles/kid-b/achievement-groups',{headers:{cookie:'plg_session=opaque-test-session'}})).status, 404);
  elevated = false;
  assert.equal((await request('/kid-a')).status, 403);
  assert.equal((await app.request('https://reports.example.test/api/v1/parent/content/lesson-a',{headers:{cookie:'plg_session=opaque-test-session'}})).status,403);
});

test('Halloween reports retain verified yearly counts and Ghostly Sky after decorations expire',()=>{
 const report=summarizeChild({...child,town:{eventHistory:{'halloween-pumpkins':{'2026':{edition:'2026-v1',counters:{'lanterns-created':{count:21,receipts:['PRIVATE-RECEIPT']}}},'2027':{edition:'2026-v1',counters:{'lanterns-created':{count:5}}}}},earned:{'halloween-ghostly-sky':'2026-10-31T20:00:00Z'}}});
 const halloween=report.games.find(g=>g.id==='halloween')!;assert.equal(halloween.scope,'lifetime');assert.equal(halloween.recorded,true);assert.equal(halloween.metrics[0]!.value,26);assert.equal(halloween.metrics[1]!.value,21);assert.equal(halloween.achievements[0]!.earned,true);assert.equal(halloween.achievements[0]!.target,21);assert.equal(halloween.achievements[0]!.difficulty,'medium');
 assert.equal(JSON.stringify(report).includes('PRIVATE-RECEIPT'),false);
 const malformed=summarizeChild({...child,town:{eventHistory:{'halloween-pumpkins':{'2026':{edition:'2026-v1',counters:{'lanterns-created':{count:-21}}}}}}});
 assert.equal(malformed.games.find(g=>g.id==='halloween')!.metrics[0]!.value,0);
 assert.equal(malformed.games.find(g=>g.id==='halloween')!.achievements[0]!.earned,false);
});

test('20/10/2026 reports include four permanent badges and only that year’s verified distinct greetings',()=>{
 const town={earned:{'womens-day-2026-guest':'2026-10-20T00:00:00Z'},eventHistory:{'womens-day':{
  '2026':{edition:'2026-v1',counters:{'celebration-visited':{count:1,receipts:['visit']},'different-blobs-greeted':{count:7,receipts:Array.from({length:7},(_,i)=>`flower-${i+1}`)}}},
  '2027':{edition:'2026-v1',counters:{'different-blobs-greeted':{count:99,receipts:['PRIVATE_FUTURE_RECEIPT']}}},
 }}};
 const report=summarizeChild({...child,town}),group=report.games.find(g=>g.id==='womens-day-2026')!;
 assert.equal(group.name,'20/10/2026');assert.equal(group.achievements.length,4);assert.deepEqual(group.metrics.map(m=>m.value),[1,7]);assert.ok(group.achievements.every(a=>a.earned&&a.description.includes('2026')));assert.equal(JSON.stringify(report).includes('PRIVATE_FUTURE_RECEIPT'),false);
 const malformed=summarizeChild({...child,town:{eventHistory:{'womens-day':{'2026':{edition:'2026-v1',counters:{'different-blobs-greeted':{count:999,receipts:['flower-1','flower-1','forged',null]}}}}}}}).games.find(g=>g.id==='womens-day-2026')!;
 assert.equal(malformed.metrics[1]!.value,1);assert.ok(malformed.achievements.every(a=>!a.earned));
});

test('cabbage reports share verified counts, badge timestamps and progress across all views',()=>{
  const report=summarizeChild({...child,cabbage_rolls:{completed:4,undercooked:1,okay:1,perfect:1,burnt:1,earned:{'cabbage-rolls-perfect':'2026-10-22T00:00:00Z',forged:'2026-10-22T00:00:00Z'}}});
  const game=report.games.find(g=>g.id==='cabbage-rolls')!;
  assert.equal(game.earning,'server-verified');assert.equal(game.scope,'lifetime');assert.equal(game.recorded,true);
  assert.deepEqual(game.metrics.map(m=>m.value),[4,1,1,1]);
  assert.ok(game.achievements.every(b=>b.earned&&b.current!>=1));
  assert.equal(game.achievements[3]!.earned_at,'2026-10-22T00:00:00.000Z');
  assert.equal(JSON.stringify(game).includes('forged'),false);
  const legacy=summarizeChild({...child,cabbage_rolls:null}).games.find(g=>g.id==='cabbage-rolls')!;
  assert.equal(legacy.recorded,false);assert.ok(legacy.achievements.every(b=>!b.earned));
  const malformed=summarizeChild({...child,cabbage_rolls:{completed:-1,perfect:'99',burnt:Infinity}}).games.find(g=>g.id==='cabbage-rolls')!;
  assert.ok(malformed.achievements.every(b=>!b.earned));
});

test('Town reports read wool from shared item storage, never the removed material',()=>{
 const report=summarizeChild({...child,town:{materials:{wool:999,wood:7},storage:{wool:8}}});
 const town=report.games.find(g=>g.id==='town-building')!;
 assert.equal(town.metrics.find(m=>m.key==='wool')!.value,8);
 assert.equal(town.metrics.find(m=>m.key==='wood')!.value,7);
});

test('the report repository projects stored wool from the Town state (guard: summary reads town.storage.wool)',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/parent-reports/repository.ts',import.meta.url),'utf8');
 assert.match(source,/'storage',jsonb_build_object\('wool',t\.state#>'\{storage,wool\}'\)/);
});
