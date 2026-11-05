import { coreRequest } from "./core.ts";
import type {
  QuizDailyStatus,
  QuizItemStatus,
  QuizOut,
  QuizQuestion,
  QuizSubmitRequest,
  QuizSubmitResponse,
} from "../types/quiz";

function encode(value: string): string {
  return encodeURIComponent(value);
}

function toPublicQuestion(question: QuizQuestion): QuizQuestion {
  return {
    id: question.id,
    ...(question.subject ? { subject: question.subject, lang: question.lang, level: question.level } : {}),
    ...(question.item_id === undefined ? {} : { item_id: question.item_id }),
    question_type: question.question_type,
    question: question.question,
    options: question.options,
    ...(question.answer_count === undefined ? {} : { answer_count: question.answer_count }),
    sort_order: question.sort_order,
  };
}

function toPublicQuiz(quiz: QuizOut): QuizOut {
  return {
    difficulty: quiz.difficulty,
    questions: quiz.questions.map(toPublicQuestion),
  };
}

export async function fetchItemQuiz(itemId: string, lang = "en", profileId?: string): Promise<QuizOut> {
  const profileQuery = profileId ? `&profile_id=${encode(profileId)}` : "";
  const quiz = await coreRequest<QuizOut>(
    `/api/v1/items/${encode(itemId)}/quiz?lang=${encode(lang)}${profileQuery}`,
  );
  return toPublicQuiz(quiz);
}

export async function fetchItemQuizStatus(
  profileId: string,
  itemId: string,
): Promise<QuizItemStatus> {
  return coreRequest<QuizItemStatus>(
    `/api/v1/profiles/${encode(profileId)}/quiz/items/${encode(itemId)}/status`,
  );
}

export async function submitItemQuiz(
  profileId: string,
  itemId: string,
  body: QuizSubmitRequest,
): Promise<QuizSubmitResponse> {
  return coreRequest<QuizSubmitResponse>(
    `/api/v1/profiles/${encode(profileId)}/quiz/items/${encode(itemId)}/submit`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function fetchDailyQuiz(profileId: string, lang = "en"): Promise<QuizOut> {
  const quiz = await coreRequest<QuizOut>(
    `/api/v1/profiles/${encode(profileId)}/quiz/daily?lang=${encode(lang)}`,
  );
  return toPublicQuiz(quiz);
}

export async function fetchDailyQuizStatus(profileId: string): Promise<QuizDailyStatus> {
  return coreRequest<QuizDailyStatus>(
    `/api/v1/profiles/${encode(profileId)}/quiz/daily/status`,
  );
}

export async function submitDailyQuiz(
  profileId: string,
  body: QuizSubmitRequest,
): Promise<QuizSubmitResponse> {
  return coreRequest<QuizSubmitResponse>(
    `/api/v1/profiles/${encode(profileId)}/quiz/daily/submit`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export type VocabularyMode = 'en-vi' | 'vi-en' | 'en-en' | 'vi-vi';
export async function fetchDailySettings(profileId: string): Promise<{ modes: VocabularyMode[] }> {
  return coreRequest(`/api/v1/profiles/${encode(profileId)}/quiz/daily/settings`);
}
export async function saveDailySettings(profileId: string, modes: VocabularyMode[]): Promise<{ modes: VocabularyMode[] }> {
  return coreRequest(`/api/v1/profiles/${encode(profileId)}/quiz/daily/settings`, { method: 'PUT', body: JSON.stringify({ modes }) });
}
