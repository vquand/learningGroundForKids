import { AppError } from '../errors.js';
import type { Cost } from '../town-building/game.js';
import { ROAD_ACHIEVEMENTS, achievementValue } from './achievements.js';
import { COURSE_LENGTH, terrainAt } from './course.js';
import { fromRoadRacingQuestion, roadRacingSeenKey } from '../questions/legacy.ts';
import { gradeQuestion } from '../questions/identity.ts';
import { publicQuestion } from '../questions/projection.ts';
import { ANIMALS, makeQuestion, type Animal, type Language, type Question } from './questions.js';
import type { RandomSource } from '../questions/types.ts';
export { ANIMALS, ANIMAL_NAMES } from './questions.js';
export type { Animal, Language } from './questions.js';
export type { Question } from './questions.js';
export { COURSE_LENGTH, TERRAIN, terrainAt } from './course.js';
export const LEASE_MS = 5000;
export const RACING_DIFFICULTIES = ['easy','medium','hard'] as const;
export type RacingDifficulty = typeof RACING_DIFFICULTIES[number];
export const OPPONENT_PACE:Record<RacingDifficulty,{base:number;step:number}> = {
  easy:{base:8.15,step:.13},
  medium:{base:8.7,step:.15},
  // This is the original launch balance, preserved as the hardest level.
  hard:{base:9.35,step:.17},
};
export interface Stats {
  finished:number;wins:number;podiums:number;last:number;charged:number;streak:number;bestStreak:number;correct:number;slowed:number;snailPodiums:number;
  friends:Record<string,number>;animalPodiums:Record<string,number>;
}
export interface Racer {animal:Animal;player:boolean;distance:number;speed:number;pace:number;finishedAt:number|null}
export type RaceFeedbackKind = 'correct'|'retry'|'retry-correct'|'forced';
export interface RaceFeedback {question:Question;answer:string;correct:boolean;at:number;kind:RaceFeedbackKind;forced:boolean}
export interface Race {
  id:string;language:Language;animal:Animal;difficulty:RacingDifficulty;status:'racing'|'finished'|'forfeited';racers:Racer[];
  startedAt:number;updatedAt:number;lastSeen:number;stacks:number[];slows:number[];peakStacks:number;peakSlows:number;slowed:boolean;correct:number;
  wrongAttempts:number;triedChoices:number[];
  question:Question;seen:string[];sequence:number;questionAt:number;place:number|null;
  feedback:null|RaceFeedback;
}
export interface Progress {revision:number;stats:Stats;earned:Record<string,string>;race:Race|null}
export type Settings = {animal:Animal;language:Language;difficulty:RacingDifficulty};
export type Action = {type:'tick'|'leave'}|{type:'answer';questionId:string;choice:number};
export function emptyProgress(): Progress {
  return {revision:0,stats:{finished:0,wins:0,podiums:0,last:0,charged:0,streak:0,bestStreak:0,correct:0,slowed:0,snailPodiums:0,friends:{},animalPodiums:{}},earned:{},race:null};
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}
function isLanguage(value: unknown): value is Language { return value === 'en' || value === 'vi'; }
function isQuestionSequence(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function isSafeNonnegative(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function isCurrentQuestion(value: unknown): value is Question {
  const source = record(value); const card = record(source?.card); const response = record(source?.response);
  if (!source || !card || typeof source.id !== 'string' || typeof source.key !== 'string'
    || (typeof source.answer !== 'string' && typeof source.answer !== 'number') || !response) return false;
  if (response.mode === 'typed') return true;
  if (response.mode !== 'choice' || !Array.isArray(response.choices) || !response.choices.every((choice) => typeof choice === 'string')
    || typeof response.correct !== 'number' || !Number.isSafeInteger(response.correct) || response.correct < 0 || response.correct >= response.choices.length) return false;
  if (card.kind === 'equation') {
    return Array.isArray(card.operands) && card.operands.every(isSafeNonnegative)
      && Array.isArray(card.operators) && card.operators.every((operator) => operator === '+' || operator === '−' || operator === '×' || operator === '÷')
      && (card.blank === 'result' || isSafeNonnegative(card.blank));
  }
  if (card.kind === 'compare') return isSafeNonnegative(card.left) && isSafeNonnegative(card.right);
  if (card.kind === 'picture') return typeof card.subject === 'string';
  if (card.kind === 'counting') return isSafeNonnegative(card.count) && card.picture === 'star';
  if (card.kind === 'venn') {
    const regions = record(card.regions);
    return Boolean(regions && isSafeNonnegative(regions.leftOnly) && isSafeNonnegative(regions.shared)
      && isSafeNonnegative(regions.rightOnly) && Array.isArray(card.items));
  }
  return false;
}
function sameChoiceResponse(value: unknown, response: Question['response']): boolean {
  const source = record(value);
  if (response.mode === 'typed') return source?.mode === 'typed';
  return source?.mode === 'choice' && Array.isArray(source.choices)
    && source.correct === response.correct
    && source.choices.length === response.choices.length
    && source.choices.every((choice, index) => choice === response.choices[index]);
}
function isFeedback(value: unknown): value is { question: unknown; answer: string; correct: boolean; at: number; kind?: unknown; forced?: unknown } {
  const source = record(value);
  return Boolean(source && typeof source.answer === 'string' && typeof source.correct === 'boolean'
    && typeof source.at === 'number' && source.question !== undefined);
}
function feedbackKind(value: { correct: boolean; kind?: unknown; forced?: unknown }): RaceFeedbackKind {
  if (value.kind === 'correct' || value.kind === 'retry' || value.kind === 'retry-correct' || value.kind === 'forced') return value.kind;
  return value.forced === true || !value.correct ? 'forced' : 'correct';
}
function expiryList(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((expiry): expiry is number => typeof expiry === 'number' && Number.isFinite(expiry)) : [];
}
function choiceList(value: unknown): number[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((choice): choice is number => Number.isInteger(choice) && choice >= 0 && choice <= 2))]
    : [];
}

/** Convert old Road Racing saves before they reach game logic. */
export function normalizeProgress(progress: Progress, random: RandomSource = Math.random): Progress {
  const rawRace = progress.race as (Race & { question?: unknown; seen?: unknown; feedback?: unknown; stacks?: unknown; slows?: unknown; peakStacks?: unknown; peakSlows?: unknown; slowed?: unknown; wrongAttempts?: unknown; triedChoices?: unknown }) | null;
  const stats = {
    ...progress.stats,
    slowed: isSafeNonnegative(record(progress.stats)?.slowed) ? record(progress.stats)!.slowed as number : 0,
    snailPodiums: isSafeNonnegative(record(progress.stats)?.snailPodiums) ? record(progress.stats)!.snailPodiums as number : 0,
  };
  if (!rawRace) return { ...progress, stats };
  const seen = new Set((Array.isArray(rawRace.seen) ? rawRace.seen : []).flatMap((value) => {
    const key = roadRacingSeenKey(value);
    return key ? [key] : [];
  }));
  const language = isLanguage(rawRace.language) ? rawRace.language : 'en';
  const sequence = isQuestionSequence(rawRace.sequence) ? rawRace.sequence : 0;
  const convertedQuestion = fromRoadRacingQuestion(rawRace.question);
  const savedQuestion = record(rawRace.question);
  // Current-format questions are already server-owned, graded data. Keep the
  // persisted object when it validates so loading a race cannot rewrite its
  // opaque ID, response order, or card shape and then create a false stale
  // revision on the next action. Legacy shapes still use the converter.
  let question = convertedQuestion && isCurrentQuestion(rawRace.question)
    && savedQuestion?.id === convertedQuestion.id
    && savedQuestion.key === convertedQuestion.key
    && savedQuestion.answer === convertedQuestion.answer
    && sameChoiceResponse(savedQuestion.response, convertedQuestion.response)
    ? rawRace.question
    : convertedQuestion;
  if (!question) question = makeQuestion(language, sequence, [...seen], random);
  seen.add(question.key);

  let feedback: Race['feedback'] = null;
  if (isFeedback(rawRace.feedback)) {
    let feedbackQuestion = fromRoadRacingQuestion(rawRace.feedback.question);
    const savedQuestion = record(rawRace.feedback.question);
    const savedResponse = record(savedQuestion?.response);
    if (feedbackQuestion && savedResponse?.mode === 'choice' && Array.isArray(savedResponse.choices)
      && savedResponse.choices.every((choice): choice is string => typeof choice === 'string')) {
      const correct = savedResponse.choices.indexOf(rawRace.feedback.answer);
      if (correct >= 0) feedbackQuestion = { ...feedbackQuestion, response: { mode: 'choice', choices: savedResponse.choices, correct } };
    }
    if (feedbackQuestion) {
      const kind = feedbackKind(rawRace.feedback);
      feedback = { question: feedbackQuestion, answer: rawRace.feedback.answer, correct: rawRace.feedback.correct, at: rawRace.feedback.at, kind, forced: kind === 'forced' };
    }
  }
  return {
    ...progress,
    stats,
    race: {
      ...rawRace,
      language,
      sequence,
      stacks: expiryList(rawRace.stacks),
      slows: expiryList(rawRace.slows),
      peakStacks: isSafeNonnegative(rawRace.peakStacks) ? rawRace.peakStacks : 0,
      peakSlows: isSafeNonnegative(rawRace.peakSlows) ? rawRace.peakSlows : 0,
      slowed: rawRace.slowed === true,
      wrongAttempts: isSafeNonnegative(rawRace.wrongAttempts) ? Math.min(2, rawRace.wrongAttempts) : 0,
      triedChoices: choiceList(rawRace.triedChoices),
      question,
      seen: [...seen],
      feedback,
    },
  };
}
function fail(message:string):never {throw new AppError(409,'ROAD_RACING_ACTION_UNAVAILABLE',message);}
export function startRace(progress:Progress, settings:Settings, now:number, random:()=>number, id:string): Progress {
  const p = structuredClone(progress);
  if (p.race?.status === 'racing') forfeit(p);
  const others = ANIMALS.filter(a => a !== settings.animal);
  for(let i=others.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[others[i],others[j]]=[others[j]!,others[i]!];}
  const roster:Animal[] = others.slice(0,5), lane = Math.floor(random()*6); roster.splice(lane,0,settings.animal);
  const question = makeQuestion(settings.language,0,[],random);
  const pace=OPPONENT_PACE[settings.difficulty];
  let opponent=0;
  p.race={...settings,id,status:'racing',racers:roster.map(animal=>({animal,player:animal===settings.animal,distance:0,speed:0,pace:animal===settings.animal?0:pace.base+opponent++*pace.step,finishedAt:null})),
    startedAt:now,updatedAt:now,lastSeen:now,stacks:[],slows:[],peakStacks:0,peakSlows:0,slowed:false,correct:0,wrongAttempts:0,triedChoices:[],question,seen:[question.key],sequence:0,questionAt:now,place:null,feedback:null};
  return p;
}
export function payout(place:number): Cost {
  const ratio = place===1?1:place===2?1/1.3:place>=3&&place<=5?1/1.4*.95**(place-3):0;
  return ratio ? {stamina:Math.ceil(60*ratio),wood:Math.ceil(40*ratio),wool:Math.ceil(40*ratio)} : {};
}
export function forfeit(p:Progress) {if(p.race?.status==='racing'){p.race.status='forfeited';p.race.stacks=[];p.race.slows=[];p.stats.streak=0;}}
export function finishRace(p:Progress,place:number,now:number) {
  const r=p.race!; if(r.status!=='racing')return;
  r.status='finished';r.place=place;r.stacks=[];r.slows=[];
  const s=p.stats;s.finished++;s.correct+=r.correct;s.friends[r.animal]=(s.friends[r.animal]??0)+1;
  if(r.peakStacks===3)s.charged++;
  if(r.slowed)s.slowed++;
  if(place<=3&&r.peakSlows>=2)s.snailPodiums++;
  if(place<=3){s.podiums++;s.animalPodiums[r.animal]=(s.animalPodiums[r.animal]??0)+1;}
  if(place===1){s.wins++;s.streak++;s.bestStreak=Math.max(s.bestStreak,s.streak);}else s.streak=0;
  if(place===6)s.last++;
  for(const a of ROAD_ACHIEVEMENTS)if(!p.earned[a.id]&&achievementValue(s,a.progressKey)>=a.target)p.earned[a.id]=new Date(now).toISOString();
}
export function playerSpeed(buffCount:number, slowCount:number):number {
  const net = buffCount - slowCount;
  return net >= 0 ? 8 + 3 * net : 8 * 0.5 ** (-net);
}
function addBuff(r:Race, now:number) {
  if(r.stacks.length < 3 - r.slows.length) {
    r.stacks.push(now + 2000);
    r.peakStacks=Math.max(r.peakStacks,r.stacks.length);
  }
}
function addSlow(r:Race, now:number) {
  if(r.slows.length >= 3){r.slowed=true;r.peakSlows=Math.max(r.peakSlows,r.slows.length);return;}
  r.slows.push(now + 2000);r.slowed=true;r.peakSlows=Math.max(r.peakSlows,r.slows.length);
  while(r.stacks.length + r.slows.length > 3) {
    const soonest=Math.min(...r.stacks);
    r.stacks.splice(r.stacks.indexOf(soonest),1);
  }
}
const strengths:Record<Animal,[number,number,number]>={capybara:[1,1.1,.92],crocodile:[.85,1.3,.8],duck:[.96,1.1,1.05],goose:[1,1.03,1.1],cow:[1.12,.85,1],highland:[1.08,.9,1.03],chicken:[1.1,.85,1.1]};
export function terrainFactor(animal:Animal,distance:number) {
  const f=strengths[animal], i=terrainAt(distance)==='land'?0:terrainAt(distance)==='water'?1:2;
  // Normalize harmonic course speed: strengths change sections, not total odds.
  return f[i]*(.375/f[0]+.375/f[1]+.25/f[2]);
}
export function advance(p:Progress, now:number) {
  const r=p.race;if(!r||r.status!=='racing')return;
  if(now-r.lastSeen>LEASE_MS||now-r.startedAt>240000){forfeit(p);return;}
  while(r.updatedAt<now&&r.status==='racing') {
    const end=Math.min(now,r.updatedAt+50),dt=(end-r.updatedAt)/1000;
    const stacks=r.stacks.filter(expiry=>expiry>r.updatedAt).length;
    const slows=r.slows.filter(expiry=>expiry>r.updatedAt).length;
    for(const runner of r.racers) {
      if(runner.finishedAt!==null)continue;
      const target=(runner.player?playerSpeed(stacks,slows):runner.pace*(1+.035*Math.sin((r.updatedAt-r.startedAt)/7000+runner.pace)))*terrainFactor(runner.animal,runner.distance);
      runner.speed=target+(runner.speed-target)*Math.exp(-dt/0.45);
      const before=runner.distance; runner.distance=Math.min(COURSE_LENGTH,before+runner.speed*dt);
      if(runner.distance>=COURSE_LENGTH)runner.finishedAt=r.updatedAt+(COURSE_LENGTH-before)/Math.max(.001,runner.speed)*1000;
    }
    r.updatedAt=end;
    const player=r.racers.find(a=>a.player)!;
    if(player.finishedAt!==null)finishRace(p,1+r.racers.filter(a=>!a.player&&a.finishedAt!==null&&a.finishedAt<=player.finishedAt!).length,end);
  }
  r.stacks=r.stacks.filter(expiry=>expiry>now);r.slows=r.slows.filter(expiry=>expiry>now);
}
function issueNextQuestion(r:Race, random:()=>number, now:number) {
  r.sequence++;
  r.wrongAttempts=0;r.triedChoices=[];
  if(r.sequence>=400)return false;
  r.question=makeQuestion(r.language,r.sequence,r.seen,random);r.seen.push(r.question.key);r.questionAt=now;
  return true;
}
export function act(progress:Progress,action:Action,now:number,random:()=>number):Progress {
  const p=structuredClone(progress),r=p.race;if(!r)fail('Start a race first.');
  // A leave always forfeits before grading or simulating completion.
  if(action.type==='leave'){forfeit(p);return p;}
  if(r.status!=='racing')return p;
  if(action.type==='answer' && (r.question.response.mode !== 'choice'
    || !Number.isInteger(action.choice) || action.choice < 0 || action.choice >= r.question.response.choices.length
    || action.questionId!==r.question.id)) fail('This question has changed.');
  advance(p,now);if(r.status!=='racing')return p;
  if(action.type==='answer') {
    if(now-r.questionAt<180)fail('Wait for your question card.');
    const q=r.question;
    if (q.response.mode !== 'choice') fail('This question is not multiple choice.');
    const correct=gradeQuestion(q, action.choice);
    if(correct){
      const firstTry = r.wrongAttempts === 0;
      r.correct++;
      if(firstTry)addBuff(r,now);
      r.feedback={question:q,answer:q.response.choices[q.response.correct] ?? '',correct:true,at:now,kind:firstTry?'correct':'retry-correct',forced:false};
      if(!issueNextQuestion(r,random,now)){forfeit(p);return p;}
    } else {
      r.wrongAttempts++;
      if(!r.triedChoices.includes(action.choice))r.triedChoices.push(action.choice);
      if(r.wrongAttempts>=2){
        addSlow(r,now);
        r.feedback={question:q,answer:q.response.choices[q.response.correct] ?? '',correct:false,at:now,kind:'forced',forced:true};
        if(!issueNextQuestion(r,random,now)){forfeit(p);return p;}
      } else {
        r.feedback={question:q,answer:'',correct:false,at:now,kind:'retry',forced:false};
      }
    }
  }
  r.lastSeen=now;return p;
}
export function publicState(p:Progress,now:number) {
  const r=p.race;
  return {revision:p.revision,serverNow:now,stats:p.stats,earned:p.earned,race:r?{
    id:r.id,animal:r.animal,language:r.language,difficulty:r.difficulty??'hard',status:r.status,racers:r.racers.map(({pace:_pace,...runner})=>runner),
    startedAt:r.startedAt,updatedAt:r.updatedAt,stacks:r.stacks,slows:r.slows,slowed:r.slowed,peakSlows:r.peakSlows,
    wrongAttempts:r.wrongAttempts,triedChoices:r.triedChoices,attemptsLeft:Math.max(0,2-r.wrongAttempts),question:publicQuestion(r.question),
    correct:r.correct,place:r.place,
    feedback:r.feedback ? { ...r.feedback, question: publicQuestion(r.feedback.question) } : null,
    reward:r.status==='finished'?payout(r.place!):{},
  }:null};
}
export type PublicState=ReturnType<typeof publicState>;
