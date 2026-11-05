/** Local browser-test API. Executes the real authoritative reducer outside the browser. */
import type { Plugin } from 'vite';
import { applyCommand, emptyProgress, publicState, type FishingCommand } from '../../../server/src/fishing/game.ts';
import { equationCard } from '../../../server/src/questions/equation.ts';
import { gradeQuestion, makeQuestion } from '../../../server/src/questions/identity.ts';
import { FISHING_ACHIEVEMENT_GROUP } from '../../../server/src/achievement-catalog.ts';
import type { FishingQuestion } from '../../../server/src/fishing/types.ts';

type Scenario = string;

function scenarioQuestion(scenario: Scenario, id: string): FishingQuestion | null {
  const definition = scenario === 'missing-left'
    ? { level: 'add-2d' as const, operands: [30, 40], blank: 0 as const }
    : scenario === 'missing-right'
      ? { level: 'add-2d' as const, operands: [30, 40], blank: 1 as const }
      : scenario === 'large-question'
        ? { level: 'addsub-3d1d' as const, operands: [900, 9], blank: 'result' as const }
        : null;
  if (!definition) return null;
  const question = makeQuestion(equationCard(definition.level, definition.operands, ['+'], definition.blank), id, { mode: 'typed' });
  return { id: question.id, baitId: 'beginner', question, attempts: 0 };
}

export function fishingFixture() {
  let state = emptyProgress(), now = Date.now(), seq = 0, roll = 0, failNext = false, failAfterCommit = false, scenario = 'fresh';
  const reset = (nextScenario = 'fresh') => {
    state = emptyProgress(); now = Date.now(); scenario = nextScenario; roll = scenario === 'garbage' ? 99 : 0; failNext = false;
    if (scenario === 'large-question' || scenario === 'missing-left' || scenario === 'missing-right') state.selectedBait = 'beginner';
    if (scenario !== 'fresh') { state.bait.baby = 5; state.bait.leafy = 3; state.bait.chewy = 3; }
    if (scenario === 'graduate') state.points.pond = 59;
    if (scenario === 'single') state.bait = { ...emptyProgress().bait, baby: 1 };
    if (scenario === 'saved') { state.bait.baby = 1; state = applyCommand(state, { type: 'cast' }, now, () => 0, () => 'saved-cast'); }
    if (scenario === 'river') { state.points.pond = 60; state.location = 'river'; state.bait.master = 2; }
    if (scenario === 'multiplication') { state.points.pond = 60; state.location = 'river'; state.selectedBait = 'crunchy'; }
    if (scenario === 'turtle') state.selectedBait = 'leafy';
    if (scenario === 'learning-river') { state.points.pond = 60; state.location = 'river'; state.inventory.R1 = 2; }
    return publicState(state, now);
  };
  const action = (command: FishingCommand) => {
    now += command.type === 'tick' ? 1000 : 1;
    const seeded = command.type === 'question' ? scenarioQuestion(scenario, `fixture-question-${++seq}`) : null;
    if (seeded && command.type === 'question') {
      state.question = state.question?.baitId === command.baitId ? state.question : seeded;
      state.lastActivityAt = now;
    } else if (command.type === 'answer' && scenarioQuestion(scenario, 'preview')) {
      const question = state.question;
      if (!question || question.id !== command.questionId) throw new Error('This question is no longer active.');
      question.attempts++;
      if (gradeQuestion(question.question, command.answer)) {
        state.bait[question.baitId]++; state.stats.questions++; state.question = command.continuePractice ? scenarioQuestion(scenario, `fixture-question-${++seq}`) : null;
      }
      state.lastActivityAt = now;
    } else {
      state = applyCommand(state, command, now, max => max === 100 ? roll : 0, () => `fixture-${++seq}`);
    }
    state.revision++;
    return publicState(state, now);
  };
  const plugin: Plugin = { name: 'fishing-fixture', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/__fishing-fixture') {
        const params = url.searchParams; if (params.has('fail')) failNext = true;
        else if (params.has('failAfter')) failAfterCommit = true;
        else reset(params.get('scenario') ?? 'fresh');
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(publicState(state, now)));return;
      }
      if (!url.pathname.startsWith('/api/v1/profiles/profile-a/')) { next(); return; }
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname.endsWith('/achievement-groups')) {
        res.end(JSON.stringify([{ ...FISHING_ACHIEVEMENT_GROUP, achievements: FISHING_ACHIEVEMENT_GROUP.achievements.map(a => ({ ...a, earned: !!state.earned[a.id], earned_at: state.earned[a.id] ?? null })) }])); return;
      }
      if (!url.pathname.includes('/fishing')) { res.statusCode = 404; res.end('{}'); return; }
      if (req.method === 'GET') { res.end(JSON.stringify(publicState(state, now))); return; }
      let body = ''; for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body);
      if (failNext) { failNext = false; res.statusCode = 503; res.end(JSON.stringify({ error: { message: 'Fixture unavailable' } }));return; }
      if (payload.revision !== state.revision) { res.statusCode = 409; res.end(JSON.stringify({ error: { code:'FISHING_STALE',message:'Sync required' } })); return; }
      try { const nextState = action(payload.command); if (failAfterCommit && payload.command.type === 'answer') { failAfterCommit = false; res.statusCode = 503; res.end(JSON.stringify({ error: { message: 'Reply lost after commit' } })); } else res.end(JSON.stringify(nextState)); }
      catch (error) { res.statusCode = 409; res.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : 'Invalid command' } })); }
    });
  } };
  return { plugin, reset, action, state: () => structuredClone(state) };
}
