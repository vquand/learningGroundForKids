import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyBank, selectDailyQuestions, DEFAULT_MODES, dailyReward, initialProgress, recordDailyAnswers, SUBJECTS } from '../src/daily-quiz/game.js';

test('eight unique single-choice questions respect category cap for every vocabulary setting', () => {
  for (const modes of [DEFAULT_MODES, ...DEFAULT_MODES.map(mode => [mode])]) {
    for (let seed = 0; seed < 80; seed++) {
      const questions = selectDailyQuestions(buildDailyBank('en', modes), `kid:${seed}`);
      assert.equal(questions.length, 8);
      assert.equal(new Set(questions.map(q => q.id)).size, 8);
      const concepts = questions.flatMap(q => q.concept ? [q.concept] : []);
      assert.equal(new Set(concepts).size, concepts.length);
      const counts: Record<string, number> = {};
      for (const q of questions) {
        counts[q.subject] = (counts[q.subject] ?? 0) + 1;
        assert.ok(counts[q.subject]! <= 2);
        assert.equal(q.question_type, 'single');
        assert.equal(q.correct_answers.length, 1);
        assert.equal(new Set(q.options).size, q.options.length);
        if (q.subject.startsWith('vocabulary')) assert.equal(q.options.length, 3);
      }
      assert.deepEqual(questions, selectDailyQuestions(buildDailyBank('en', modes), `kid:${seed}`));
    }
  }
});
test('math difficulty has medium most often and both tails across days', () => {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (let seed = 0; seed < 1000; seed++) for (const q of selectDailyQuestions(buildDailyBank('en', DEFAULT_MODES), `${seed}`)) {
    if (q.subject === 'math') counts[q.level]++;
  }
  assert.ok(counts.medium > counts.easy && counts.medium > counts.hard);
  assert.ok(counts.easy > 100 && counts.hard > 100);
});
test('UTC streak resets after a gap and on Monday and caps at sixteen', () => {
  assert.equal(dailyReward('2026-10-19', '2026-10-18', 7).amount, 10);
  assert.equal(dailyReward('2026-10-20', '2026-10-19', 1).amount, 12);
  assert.equal(dailyReward('2026-10-21', '2026-10-20', 2).amount, 14);
  assert.equal(dailyReward('2026-10-22', '2026-10-21', 3).amount, 16);
  assert.equal(dailyReward('2026-10-25', '2026-10-24', 6).amount, 16);
  assert.equal(dailyReward('2026-10-23', '2026-10-21', 3).amount, 10);
});
test('failed retries count correct questions once and completed days cannot inflate progress', () => {
  const state = initialProgress();
  const questions = selectDailyQuestions(buildDailyBank('en', DEFAULT_MODES), 'sample');
  state.snapshot = { day: '2026-10-19', questions, correctIds: [], latest: null };
  const correct = questions.map(q => ({ question_id: q.id, chosen_answers: q.correct_answers }));
  recordDailyAnswers(state, '2026-10-19', correct.slice(0, 2).map(a => a.question_id), false);
  recordDailyAnswers(state, '2026-10-19', correct.map(a => a.question_id), true);
  const before = structuredClone(state);
  recordDailyAnswers(state, '2026-10-19', correct.map(a => a.question_id), true);
  assert.deepEqual(state, before);
  assert.equal(state.stats.completed, 1);
  assert.ok(Object.keys(state.categories).every(key => SUBJECTS.includes(key)));
});

test('all subjects and twenty hard math answers unlock only from distinct correct daily questions', () => {
  const state = initialProgress();
  for (let i = 0; i < 20; i++) {
    const day = `2026-10-${String(i + 1).padStart(2, '0')}`;
    const hard = buildDailyBank('en', DEFAULT_MODES).find(q => q.subject === 'math' && q.level === 'hard')!;
    state.snapshot = { day, questions: [hard], correctIds: [], latest: null };
    recordDailyAnswers(state, day, [], false);
    assert.equal(state.stats.hardMath, i);
    recordDailyAnswers(state, day, [hard.id], false);
    recordDailyAnswers(state, day, [hard.id], false);
    assert.equal(state.stats.hardMath, i + 1);
  }
  for (const [index, subject] of SUBJECTS.entries()) {
    const day = '2026-10-21';
    const question = { ...buildDailyBank('en', DEFAULT_MODES)[0]!, id: `subject:${index}`, subject };
    state.snapshot = { day, questions: [question], correctIds: [], latest: null };
    recordDailyAnswers(state, day, [question.id], false);
  }
  assert.equal(Object.keys(state.categories).length, SUBJECTS.length);
});

test('daily bank IDs pass only the scoped single-selection request contract', async () => {
  const { dailyQuizSubmitSchema, quizSubmitSchema } = await import('../src/input.js');
  for (const question of buildDailyBank('en', DEFAULT_MODES)) {
    const input = { answers: [{ question_id: question.id, chosen_answers: [0] }] };
    assert.equal(dailyQuizSubmitSchema.safeParse(input).success, true);
    assert.equal(quizSubmitSchema.safeParse(input).success, false);
  }
  for (const answers of [
    [{ question_id: 'daily-v1:reason:0', chosen_answers: [0, 1] }],
    [{ question_id: 'daily-v1:reason:0', chosen_answers: [0.5] }],
    [{ question_id: 'https:untrusted', chosen_answers: [0] }],
    Array.from({ length: 9 }, () => ({ question_id: 'daily-v1:reason:0', chosen_answers: [0] })),
  ]) assert.equal(dailyQuizSubmitSchema.safeParse({ answers }).success, false);
});

test('daily selection excludes category filler and article-equivalent duplicate answers', async () => {
  const { eligibleDailyQuestion, gradeDailyAnswers, makeDailyQuestion } = await import('../src/daily-quiz/game.js');
  const ambiguous = makeDailyQuestion('old-catalog', 'animal', 'What kind of learning item is Hairy-eared dwarf lemur?', ['an animal', 'a song', 'a movie', 'animal']);
  assert.equal(eligibleDailyQuestion(ambiguous), false);
  assert.ok(selectDailyQuestions([...buildDailyBank('en', DEFAULT_MODES), ambiguous], 'ambiguous-catalog').every(question => question.id !== ambiguous.id));
  assert.equal(eligibleDailyQuestion({ ...ambiguous, question: 'Which animal is this?', options: ['an animal', 'a song', 'animal'] }), false);
  assert.equal(eligibleDailyQuestion({ ...ambiguous, question: 'Vượn thuộc loại nội dung học tập nào?', options: ['Động vật', 'Phim', 'Âm nhạc'] }), false);
  // A child already answering a frozen legacy question must not be penalized
  // for choosing the equivalent answer while the next open repairs the quiz.
  assert.equal(gradeDailyAnswers([ambiguous], [{ question_id: ambiguous.id, chosen_answers: [3] }]).passed, true);
  assert.equal(gradeDailyAnswers([ambiguous], [{ question_id: ambiguous.id, chosen_answers: [1] }]).passed, false);
});

test('vocabulary gives a description clue and three word choices in the selected languages', () => {
  const expected = {
    'en-en': { clue: 'A warm covering used on a bed.', answer: 'blanket', lang: 'en', subject: 'vocabulary-en' },
    'en-vi': { clue: 'A warm covering used on a bed.', answer: 'cái chăn', lang: 'en', subject: 'vocabulary-vi' },
    'vi-en': { clue: 'Tấm phủ giữ ấm khi nằm ngủ.', answer: 'blanket', lang: 'vi', subject: 'vocabulary-en' },
    'vi-vi': { clue: 'Tấm phủ giữ ấm khi nằm ngủ.', answer: 'cái chăn', lang: 'vi', subject: 'vocabulary-vi' },
  } as const;
  for (const mode of DEFAULT_MODES) {
    const question = buildDailyBank('en', [mode]).find(q => q.concept === 'word:8')!;
    const value = expected[mode];
    assert.equal(question.question, `${value.clue}\n${value.lang === 'en' ? 'What is this?' : 'Đây là gì?'}`);
    assert.equal(question.options.length, 3);
    assert.equal(question.options[question.correct_answers[0]!], value.answer);
    assert.equal(question.lang, value.lang);
    assert.equal(question.subject, value.subject);
    assert.ok(question.options.every(option => option.length < 30), 'choices are words, not descriptions');
    assert.ok(question.id.startsWith('daily-v1:word-clue:'));
  }
});
