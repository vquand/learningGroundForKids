// Run against an isolated, signed-in local test child with a started Daily Quiz.
// DAILY_QUIZ_ANSWER_FILE is a local server-fixture export, never a browser API key.
// This harness uses agent-browser exclusively; it does not attach to personal browsers.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const session = process.env.DAILY_QUIZ_BROWSER_SESSION ?? 'daily-quiz-playground';
const fixtureFile = process.env.DAILY_QUIZ_ANSWER_FILE;
assert.ok(fixtureFile, 'Provide the isolated local test child answer fixture');
const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
const normalizeClue = value => value.replace(/\s+/g, ' ').trim();
const clueAnswers = new Map(Object.entries(fixture.answers).map(([clue, answer]) => [normalizeClue(clue), answer]));
const celebration = ['A bright beginning!', 'Your streak is growing!', 'Three days of discovery!', 'You are shining all week!'][Math.floor((fixture.bonus ?? 0) / 2)];
const output = process.env.DAILY_QUIZ_BROWSER_OUTPUT ?? '/tmp/daily-quiz-browser';
mkdirSync(output, { recursive: true });
const cli = (...args) => execFileSync(process.env.AGENT_BROWSER_BIN ?? 'agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 60000 });
const snapshot = () => cli('snapshot', '-i');
const previousNetwork = new Set(cli('network', 'requests', '--filter', 'quiz/daily').split('\n'));
const viewports = [[1366, 768], [1024, 768], [1180, 820]];
function buttons(source) {
  return source.split('\n').flatMap(line => {
    const match = line.match(/- button "(.*)" .*ref=(e\d+)/);
    return match ? [{ name: JSON.parse(`"${match[1]}"`), ref: `@${match[2]}` }] : [];
  });
}
function clickNamed(name) {
  const button = buttons(snapshot()).find(button => button.name === name);
  assert.ok(button, `Missing visible button: ${name}`);
  cli('click', button.ref);
}
const evidence = [];
function bounds(state, screenshot = false) {
  for (const [width, height] of viewports) {
    cli('set', 'viewport', String(width), String(height));
    const raw = cli('eval', `JSON.stringify({viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],outside:[...document.querySelectorAll('button,a,select,input')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)}).map(el=>el.getAttribute('aria-label')||el.textContent.trim())})`);
    let value = JSON.parse(raw.trim());
    if (typeof value === 'string') value = JSON.parse(value);
    assert.deepEqual(value.document, value.viewport, `${state}: scrolling at ${width}×${height}`);
    assert.deepEqual(value.outside, [], `${state}: offscreen controls at ${width}×${height}`);
    evidence.push({ state, ...value });
    writeFileSync(path.join(output, 'bounds.json'), JSON.stringify(evidence, null, 2));
    if (screenshot) cli('screenshot', path.join(output, `${state}-${width}.png`));
  }
}
function complete(correct, prefix) {
  for (let step = 0; step < 8; step++) {
    const source = snapshot();
    const heading = source.match(/- heading "(.*)" \[level=2/);
    assert.ok(heading, 'Question heading is visible');
    const question = JSON.parse(`"${heading[1]}"`), answer = clueAnswers.get(normalizeClue(question));
    assert.notEqual(answer, undefined, 'Question belongs to the frozen server test fixture');
    const choices = buttons(source).filter(button => /^[A-D] /.test(button.name));
    assert.ok(choices.length >= 2 && choices.length <= 4);
    const choice = choices.find(button => correct ? button.name.slice(2) === answer : button.name.slice(2) !== answer);
    assert.ok(choice, 'Exactly one answer can be selected');
    const progress = source.match(/(\d) \/ 8/);
    assert.ok(progress);
    const index = Number(progress[1]);
    bounds(`${prefix}-question-${index}`, index === 1 || /What is this\?|Đây là gì\?/.test(question));
    if (correct && index === 8 && fixture.viewport) cli('set', 'viewport', ...fixture.viewport.map(String));
    cli('click', choice.ref);
    clickNamed(index === 8 ? 'Finish quiz' : 'Next question');
    if (index === 8) {
      cli('wait', '--text', correct ? celebration : 'You can try again!');
      if (correct) cli('screenshot', path.join(output, 'reward-flight.png'));
      bounds(`${prefix}-result`, true);
      return;
    }
    cli('wait', '--text', `${index + 1} / 8`);
  }
  throw Error('Quiz did not finish within eight questions');
}
if (fixture.name) {
  if (buttons(snapshot()).some(button => button.name === 'Back to Playground')) {
    clickNamed('Back to Playground');
    cli('wait', '--url', '**/playground');
    cli('wait', '--fn', 'Array.from(document.querySelectorAll("button")).some(button => button.getAttribute("aria-label") === "Back to profiles")');
  }
  if (buttons(snapshot()).some(button => button.name === 'Back to profiles')) clickNamed('Back to profiles');
  cli('wait', '--text', fixture.name);
  const child = buttons(snapshot()).find(button => button.name.includes(fixture.name));
  assert.ok(child, 'Isolated test child exists in the signed-in test family');
  cli('click', child.ref);
  cli('wait', '--fn', '!!document.querySelector(".daily-quiz-page, .activity-hub-page")');
  if (!cli('get', 'url').trim().endsWith('/daily-quiz')) {
    cli('wait', '--url', '**/playground');
    const dailyCard = buttons(snapshot()).find(button => button.name.startsWith('Daily Quiz '));
    assert.ok(dailyCard, 'Daily Quiz is present in Playground');
    cli('click', dailyCard.ref);
    cli('wait', '--url', '**/daily-quiz');
  }
  cli('wait', '--text', 'Your daily discovery');
}
if (!snapshot().includes('Daily discovery complete')) {
if (!/\d \/ 8/.test(snapshot())) {
  bounds('welcome', true);
  const setup = JSON.parse(cli('eval', 'JSON.stringify({balls:document.querySelectorAll(".daily-country-balls button").length,materials:document.querySelectorAll(".daily-welcome .daily-resources").length,badge:document.querySelectorAll(".daily-welcome .achievement-badge-art").length,storageInHeader:!!document.querySelector("header [data-town-storage]")})').trim());
  const setupView = typeof setup === 'string' ? JSON.parse(setup) : setup;
  assert.deepEqual(setupView, { balls: 2, materials: 0, badge: 0, storageInHeader: true });
  clickNamed('Tiếng Việt');
  clickNamed('English');
  clickNamed('Daily Quiz settings');
  cli('wait', '--text', 'Vocabulary settings');
  bounds('settings', true);
  clickNamed('Cancel');
  clickNamed('Start daily quiz');
  cli('wait', '--text', '1 / 8');
}
// A previous failed HTTP submission can be retried with its collected answers.
if (/\d \/ 8/.test(snapshot()) && buttons(snapshot()).some(button => button.name === 'Try Again')) {
  clickNamed('Try Again');
  cli('wait', '--text', 'You can try again!');
}
if (!snapshot().includes('You can try again!')) complete(false, 'failure');
else bounds('failure-result', true);
clickNamed('Try Again');
cli('wait', '--text', '1 / 8');
complete(true, 'success');
} else bounds('success-result', true);
assert.match(cli('get', 'text', 'body'), /Your learning rewards are in Town storage!/);
const payoutText = cli('eval', 'document.querySelector(".daily-resources strong").textContent');
assert.ok(payoutText.includes(`+ ${fixture.bonus ?? 0}`), 'Celebration shows base plus the server bonus');
clickNamed('Done');
cli('wait', '--text', 'Daily Done!');
bounds('completed-welcome', true);
// Reopening the page must not replay a resource receipt or offer another reward.
cli('reload');
// Active child identity deliberately stays in memory: select the owned child again.
cli('wait', '--text', "Who's joining today?");
const resumedChild = buttons(snapshot()).find(button => button.name.includes(fixture.name ?? 'Daily Quiz Learner'));
assert.ok(resumedChild, 'Reload requires the existing owned child selection');
cli('click', resumedChild.ref);
cli('wait', '--text', 'Daily Done!');
assert.equal(JSON.parse(cli('eval', 'document.querySelectorAll(".town-resource-flight").length').trim()), 0);
const network = cli('network', 'requests', '--filter', 'quiz/daily').split('\n').filter(line => !previousNetwork.has(line)).join('\n');
assert.doesNotMatch(network, /\(Fetch\) [45]\d\d/);
writeFileSync(path.join(output, 'bounds.json'), JSON.stringify(evidence, null, 2));
writeFileSync(path.join(output, 'network.log'), network);
writeFileSync(path.join(output, 'console.log'), cli('console'));
const errors = cli('errors');
writeFileSync(path.join(output, 'errors.log'), errors);
assert.ok(!errors.trim() || /No (?:page )?errors/i.test(errors), `Page errors: ${errors}`);
console.log(`Verified failure, retry, pass and receipt replay at all ${viewports.length} landscape sizes.`);
