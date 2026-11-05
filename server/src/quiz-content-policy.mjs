/** Shared by authoring, imports and serving. Applies to question text only. */
export const PLACEHOLDER_QUIZ_PATTERN = String.raw`associat(ed|e|ing)\s+with|gắn\s+liền\s+với|what\s+(kind|type)\s+of\s+learning\s+item\s+is|thuộc\s+loại\s+nội\s+dung(\s+học\s+tập)?\s+nào`;
const placeholder = new RegExp(PLACEHOLDER_QUIZ_PATTERN, 'iu');
export function isPlaceholderQuizQuestion(question) {
  return typeof question === 'string' && placeholder.test(question.normalize('NFKC'));
}

/** Keep surviving seed slots stable so removal never renumbers question/card IDs. */
export function reviewedQuizQuestions(questions) {
  const output = [];
  for (const [index, question] of questions.entries()) {
    if (isPlaceholderQuizQuestion(question.question)) continue;
    const slot = question.seed_index ?? index;
    if (!Number.isSafeInteger(slot) || slot < 0) throw new Error('Invalid quiz seed index');
    output.push(question.seed_index === undefined && slot === output.length ? question : { ...question, seed_index: slot });
  }
  return output;
}
