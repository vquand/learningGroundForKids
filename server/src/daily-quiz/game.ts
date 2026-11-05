import { isPlaceholderQuizQuestion } from '../quiz-content-policy.mjs';
import type { QuizQuestionRecord, QuizSubmitAnswer } from '../contracts/db.js';
import { dailyAttemptDate, gradeQuizAnswers } from '../quiz.ts';

export const DEFAULT_MODES = ['en-vi', 'vi-en', 'en-en', 'vi-vi'] as const;
export type VocabularyMode = typeof DEFAULT_MODES[number];
/** Version one category list: future categories must not revoke existing awards. */
export const SUBJECTS: readonly string[] = ['math', 'vocabulary-en', 'vocabulary-vi', 'patterns', 'reasoning', 'animal', 'food', 'monument', 'landmark', 'music', 'movie', 'phenomenon', 'drink'];
export interface DailyQuestion extends QuizQuestionRecord { subject: string; level: 'easy' | 'medium' | 'hard'; mode?: VocabularyMode; recipeId?: string; concept?: string }
export interface DailyProgress {
  modes: VocabularyMode[];
  snapshot: { day: string; questions: DailyQuestion[]; correctIds: string[]; latest: { score: number; total: number } | null } | null;
  stats: { completed: number; bestWeekStreak: number; perfectWeeks: number; hardMath: number };
  categories: Record<string, number>;
  earned: Record<string, string>;
  lastPassed: string | null;
  weekStreak: number;
}
export function initialProgress(): DailyProgress {
  return { modes: [...DEFAULT_MODES], snapshot: null, stats: { completed: 0, bestWeekStreak: 0, perfectWeeks: 0, hardMath: 0 }, categories: {}, earned: {}, lastPassed: null, weekStreak: 0 };
}
export function dailyReward(day: string, lastPassed: string | null, previousStreak: number) {
  const date = dailyAttemptDate(day);
  const yesterday = new Date(date.getTime() - 86400000).toISOString().slice(0, 10);
  const streak = date.getUTCDay() !== 1 && lastPassed === yesterday ? previousStreak + 1 : 1;
  const bonus = Math.min(streak - 1, 3) * 2;
  return { streak, bonus, amount: 10 + bonus };
}
export function recordDailyAnswers(state: DailyProgress, day: string, correctIds: string[], passed: boolean) {
  if (!state.snapshot || state.snapshot.day !== day || state.lastPassed === day) return;
  const snapshot = state.snapshot;
  for (const q of snapshot.questions) {
    if (!correctIds.includes(q.id) || snapshot.correctIds.includes(q.id)) continue;
    snapshot.correctIds.push(q.id);
    state.categories[q.subject] = (state.categories[q.subject] ?? 0) + 1;
    if (q.subject === 'math' && q.level === 'hard') state.stats.hardMath++;
  }
  if (passed) {
    const reward = dailyReward(day, state.lastPassed, state.weekStreak);
    state.lastPassed = day;
    state.weekStreak = reward.streak;
    state.stats.completed++;
    state.stats.bestWeekStreak = Math.max(state.stats.bestWeekStreak, reward.streak);
    if (reward.streak === 7) state.stats.perfectWeeks++;
  }
}
export function dailyMetrics(state: Pick<DailyProgress, 'stats' | 'categories'>): Record<string, number> {
  return { dailyCompleted: state.stats.completed, dailyWeekStreak: state.stats.bestWeekStreak,
    dailyPerfectWeeks: state.stats.perfectWeeks, dailyHardMath: state.stats.hardMath,
    dailyCategories: SUBJECTS.filter(category => (state.categories[category] ?? 0) > 0).length };
}
export function makeDailyQuestion(id: string, subject: string, question: string, options: string[], level: DailyQuestion['level'] = 'medium', lang = 'en'): DailyQuestion {
  return { id: `daily-v1:${id}`, item_id: '', lang, question_type: 'single', question, options, correct_answers: [0], sort_order: 0, is_active: true, subject, level };
}

// Authored bilingual word meanings; distinct definitions avoid ambiguous distractors.
const WORDS = [
  ['apple', 'quả táo', 'A crunchy round fruit with a core, often red or green.', 'Loại quả tròn giòn, có lõi, thường có vỏ đỏ hoặc xanh.', 'noun'],
  ['book', 'quyển sách', 'Pages joined together for reading.', 'Các trang giấy đóng lại để đọc.', 'noun'],
  ['bridge', 'cây cầu', 'A structure that carries a path over a river or road.', 'Công trình nối lối đi qua sông hoặc đường.', 'noun'],
  ['cloud', 'đám mây', 'A mass of tiny water drops floating in the sky.', 'Khối những giọt nước nhỏ lơ lửng trên trời.', 'noun'],
  ['forest', 'khu rừng', 'A large area covered with trees.', 'Vùng đất rộng có nhiều cây mọc.', 'noun'],
  ['river', 'dòng sông', 'A natural stream of water flowing across land.', 'Dòng nước tự nhiên chảy trên đất liền.', 'noun'],
  ['window', 'cửa sổ', 'An opening with glass that lets light into a room.', 'Ô cửa thường có kính để lấy ánh sáng vào phòng.', 'noun'],
  ['pencil', 'bút chì', 'A writing tool with a graphite core.', 'Dụng cụ viết có lõi than chì.', 'noun'],
  ['blanket', 'cái chăn', 'A warm covering used on a bed.', 'Tấm phủ giữ ấm khi nằm ngủ.', 'noun'],
  ['garden', 'khu vườn', 'A place where people grow flowers or vegetables.', 'Nơi người ta trồng hoa hoặc rau.', 'noun'],
  ['bicycle', 'xe đạp', 'A two-wheeled vehicle moved by pedaling.', 'Xe hai bánh di chuyển bằng cách đạp bàn đạp.', 'noun'],
  ['umbrella', 'cái ô', 'A folding cover held above you to keep rain off.', 'Vật có thể gấp, cầm che trên đầu để tránh mưa.', 'noun'],
  ['whisper', 'nói thầm', 'To speak very quietly.', 'Nói với giọng rất nhỏ.', 'verb'],
  ['borrow', 'mượn', 'To use something and return it to its owner.', 'Dùng đồ của người khác rồi trả lại.', 'verb'],
  ['patient', 'kiên nhẫn', 'Able to wait calmly without getting upset.', 'Bình tĩnh chờ đợi mà không nóng giận.', 'adjective'],
  ['curious', 'tò mò', 'Wanting to learn or find out more.', 'Muốn tìm hiểu và biết thêm.', 'adjective'],
  ['generous', 'hào phóng', 'Willing to share or give to others.', 'Sẵn lòng chia sẻ hoặc cho người khác.', 'adjective'],
  ['careful', 'cẩn thận', 'Taking time to avoid mistakes or danger.', 'Chú ý để tránh sai sót hoặc nguy hiểm.', 'adjective'],
  ['smooth', 'nhẵn', 'Having an even surface without rough parts.', 'Có bề mặt đều, không gồ ghề.', 'adjective'],
  ['transparent', 'trong suốt', 'Allowing light through so things behind can be seen.', 'Cho ánh sáng đi qua để nhìn thấy vật phía sau.', 'adjective'],
  ['discover', 'khám phá', 'To find or learn something for the first time.', 'Tìm ra hoặc biết điều gì lần đầu tiên.', 'verb'],
] as const;
export function buildDailyBank(lang: string, modes: readonly VocabularyMode[]): DailyQuestion[] {
  const vi = lang === 'vi', bank: DailyQuestion[] = [];
  for (let a = 2; a <= 16; a++) for (let b = 2; b <= 9; b++) {
    const add = a + b, multiply = a * b;
    bank.push(makeDailyQuestion(`add:${a}:${b}`, 'math', `${a} + ${b} = ?`, [add, add + 1, add - 1].map(String), 'easy', lang));
    bank.push(makeDailyQuestion(`subtract:${a}:${b}`, 'math', `${add} − ${b} = ?`, [a, a + 1, a - 1].map(String), 'easy', lang));
    bank.push(makeDailyQuestion(`multiply:${a}:${b}`, 'math', `${a} × ${b} = ?`, [multiply, multiply + b, multiply - b].map(String), 'medium', lang));
    bank.push(makeDailyQuestion(`divide:${a}:${b}`, 'math', `${multiply} ÷ ${b} = ?`, [a, a + 1, a - 1].map(String), 'medium', lang));
    bank.push(makeDailyQuestion(`steps:${a}:${b}`, 'math', `(${a} + ${b}) × 3 = ?`, [add * 3, a + b * 3, add * 2].map(String), 'hard', lang));
    bank.push(makeDailyQuestion(`fraction:${a}:${b}`, 'math', vi ? `Một nửa của ${multiply * 2} là bao nhiêu?` : `What is one half of ${multiply * 2}?`, [multiply, multiply * 2, multiply + 1].map(String), 'hard', lang));
    const decimal = (a + b / 10).toFixed(1);
    bank.push(makeDailyQuestion(`decimal:${a}:${b}`, 'math', `${a}.0 + 0.${b} = ?`, [decimal, (a + b).toFixed(1), (a + b / 100).toFixed(2)], 'hard', lang));
  }
  for (const mode of modes) WORDS.forEach((word, i) => {
    const sourceVi = mode.startsWith('vi'), answerVi = mode.endsWith('vi');
    const clue = word[sourceVi ? 3 : 2];
    const column = answerVi ? 1 : 0;
    const others = WORDS.filter(candidate => candidate !== word && candidate[4] === word[4]);
    const options = [word, others[i % others.length]!, others[(i + 1) % others.length]!].map(candidate => candidate[column]);
    const prompt = `${clue}\n${sourceVi ? 'Đây là gì?' : 'What is this?'}`;
    bank.push({ ...makeDailyQuestion(`word-clue:${mode}:${i}`, answerVi ? 'vocabulary-vi' : 'vocabulary-en', prompt, options, i < 10 ? 'easy' : 'medium', sourceVi ? 'vi' : 'en'), mode, concept: `word:${i}` });
  });
  const shapes = vi ? ['hình tròn', 'ngôi sao', 'hình vuông', 'trái tim', 'hình tam giác', 'hình thoi'] : ['circle', 'star', 'square', 'heart', 'triangle', 'diamond'];
  for (let a = 0; a < shapes.length; a++) for (let b = 0; b < shapes.length; b++) {
    if (a === b) continue;
    const other = shapes.find(shape => shape !== shapes[a] && shape !== shapes[b])!;
    bank.push(makeDailyQuestion(`pattern:${a}:${b}`, 'patterns', `${vi ? 'Hình nào tiếp theo?' : 'Which shape comes next?'} ${shapes[a]}, ${shapes[b]}, ${shapes[a]}, ${shapes[b]}, ${shapes[a]}, …`, [shapes[b]!, shapes[a]!, other], 'easy', lang));
  }
  const reasoning = vi ? [
    ['Bạn muốn biết hôm nay là thứ mấy. Bạn xem gì?', 'Lịch', 'Thước kẻ', 'Cân'],
    ['Trời đang mưa. Vật nào giúp bạn tránh bị ướt?', 'Áo mưa', 'Kính râm', 'Quạt'],
    ['Bạn cần đo chiều dài một tờ giấy. Bạn dùng gì?', 'Thước kẻ', 'Nhiệt kế', 'Đồng hồ'],
    ['Bạn muốn biết một chiếc cặp nặng bao nhiêu. Bạn dùng gì?', 'Cân', 'Lịch', 'La bàn'],
    ['Bạn muốn biết còn bao lâu trước giờ học. Bạn xem gì?', 'Đồng hồ', 'Bản đồ', 'Kính lúp'],
    ['Bạn muốn quan sát một vật rất nhỏ. Bạn dùng gì?', 'Kính lúp', 'Cái ô', 'Cân'],
    ['Bạn muốn tìm đường đến thư viện. Bạn xem gì?', 'Bản đồ', 'Lịch', 'Nhiệt kế'],
    ['Bạn cần đo nhiệt độ không khí. Bạn dùng gì?', 'Nhiệt kế', 'Thước kẻ', 'La bàn'],
  ] : [
    ['You want to find out what day it is. What do you check?', 'A calendar', 'A ruler', 'A weighing scale'],
    ['It is raining. Which helps keep you dry?', 'A raincoat', 'Sunglasses', 'A fan'],
    ['You need to measure the length of a sheet of paper. What do you use?', 'A ruler', 'A thermometer', 'A clock'],
    ['You want to find out how heavy a schoolbag is. What do you use?', 'A weighing scale', 'A calendar', 'A compass'],
    ['You want to know how long until class starts. What do you check?', 'A clock', 'A map', 'A magnifying glass'],
    ['You want to see a very tiny object more clearly. What do you use?', 'A magnifying glass', 'An umbrella', 'A weighing scale'],
    ['You want to find the way to a library. What do you check?', 'A map', 'A calendar', 'A thermometer'],
    ['You need to measure the air temperature. What do you use?', 'A thermometer', 'A ruler', 'A compass'],
  ];
  reasoning.forEach(([prompt, ...options], i) => bank.push(makeDailyQuestion(`reason:${i}`, 'reasoning', prompt!, options, 'easy', lang)));
  return bank;
}
function randomFor(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return () => { hash += 0x6D2B79F5; let v = Math.imul(hash ^ hash >>> 15, 1 | hash); v ^= v + Math.imul(v ^ v >>> 7, 61 | v); return ((v ^ v >>> 14) >>> 0) / 4294967296; };
}
function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
}
function normalizedOption(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/^(?:an?|the|một)\s+/u, '').replace(/[.!?]+$/u, '').replace(/\s+/gu, ' ');
}
export function eligibleDailyQuestion(q: DailyQuestion): boolean {
  return !q.id.startsWith('daily-v1:word:') && q.question.length <= 240 && q.options.every(option => option.length <= 120)
    && q.correct_answers.length === 1 && q.options.length >= 2 && q.options.length <= 4
    && new Set(q.options.map(normalizedOption)).size === q.options.length
    && !isPlaceholderQuizQuestion(q.question);
}
/** Keep already-issued legacy questions fair when two options mean the same thing. */
export function gradeDailyAnswers(questions: DailyQuestion[], answers: QuizSubmitAnswer[]) {
  const gradingQuestions = questions.map(question => {
    const chosen = answers.find(answer => answer.question_id === question.id)?.chosen_answers;
    const expected = question.options[question.correct_answers[0]!];
    const selected = chosen?.length === 1 ? question.options[chosen[0]!] : undefined;
    return selected !== undefined && expected !== undefined && normalizedOption(selected) === normalizedOption(expected)
      ? { ...question, correct_answers: [chosen![0]!] } : question;
  });
  return gradeQuizAnswers(gradingQuestions, answers, .7);
}
export function selectDailyQuestions(bank: DailyQuestion[], seed: string): DailyQuestion[] {
  const random = randomFor(seed), groups = new Map<string, DailyQuestion[]>();
  for (const q of shuffle(bank, random)) {
    if (!eligibleDailyQuestion(q)) continue;
    groups.set(q.subject, [...(groups.get(q.subject) ?? []), { ...q, question_type: 'single' }]);
  }
  const subjects = shuffle([...groups.keys()], random), selected: DailyQuestion[] = [];
  for (let round = 0; round < 2; round++) for (const subject of subjects) {
    const candidates = groups.get(subject)!.filter(q => !q.concept || !selected.some(chosen => chosen.concept === q.concept));
    groups.set(subject, candidates);
    let index = 0;
    if (subject === 'math') {
      const roll = random(), level = roll < .25 ? 'easy' : roll < .75 ? 'medium' : 'hard';
      index = Math.max(0, candidates.findIndex(q => q.level === level));
    }
    const q = candidates.splice(index, 1)[0];
    if (q) selected.push(q);
    if (selected.length === 8) return shuffle(selected, random);
  }
  throw new Error('Not enough distinct daily question categories');
}
