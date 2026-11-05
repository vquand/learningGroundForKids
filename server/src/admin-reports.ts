import type { AdminAssessmentDetailRecord, AdminAssessmentSummaryRecord } from "./contracts/db.js";

export interface AssessmentItemRow {
  id: string;
  category: string;
  countryCode: string | null;
  createdAt: Date;
}

export interface AssessmentQuestionRow {
  id: string;
  itemId: string;
  lang: string;
  questionType: string;
  question: string;
  options: unknown;
  correctAnswers: unknown;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface AssessmentAttemptRow {
  profileId: string;
  score: number;
  total: number;
  completedAt: Date;
}

export interface AssessmentProfileRow {
  id: string;
  name: string;
  emoji: string;
  color: string;
  publicId: string | null;
  familyId: string;
  familyName: string;
}

function ratio(attempt: AssessmentAttemptRow): number {
  return attempt.total > 0 ? attempt.score / attempt.total : 0;
}

export function assessmentSummary(
  item: AssessmentItemRow,
  title: string,
  questions: AssessmentQuestionRow[],
  attempts: AssessmentAttemptRow[],
): AdminAssessmentSummaryRecord {
  const passCount = attempts.filter((attempt) => ratio(attempt) >= 0.8).length;
  const latest = attempts.reduce<Date | null>(
    (date, attempt) => !date || attempt.completedAt > date ? attempt.completedAt : date, null,
  );
  return {
    id: item.id,
    item_id: item.id,
    assessment_type: "quiz",
    item_title: title,
    item_category: item.category,
    country_code: item.countryCode,
    created_at: item.createdAt,
    question_count: questions.length,
    active_question_count: questions.filter((question) => question.isActive).length,
    language_count: new Set(questions.map((question) => question.lang)).size,
    attempt_count: attempts.length,
    unique_profile_count: new Set(attempts.map((attempt) => attempt.profileId)).size,
    pass_rate: attempts.length ? passCount / attempts.length * 100 : 0,
    fail_rate: attempts.length ? (attempts.length - passCount) / attempts.length * 100 : 0,
    average_score_rate: attempts.length
      ? attempts.reduce((total, attempt) => total + ratio(attempt), 0) / attempts.length * 100 : 0,
    average_time_seconds: null,
    latest_attempt_at: latest,
  };
}

export function assessmentPerformance(
  attempts: AssessmentAttemptRow[],
  profiles: AssessmentProfileRow[],
): AdminAssessmentDetailRecord["performance"] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const byProfile = new Map<string, AssessmentAttemptRow[]>();
  for (const attempt of attempts) {
    const rows = byProfile.get(attempt.profileId) ?? [];
    rows.push(attempt);
    byProfile.set(attempt.profileId, rows);
  }
  return [...byProfile].map(([profileId, rows]) => {
    const profile = profileById.get(profileId);
    const ordered = [...rows].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    const latest = ordered[0]!;
    const best = ordered.reduce((current, attempt) => ratio(attempt) > ratio(current) ? attempt : current, latest);
    const passCount = rows.filter((attempt) => ratio(attempt) >= 0.8).length;
    return {
      profile_id: profileId,
      profile_name: profile?.name ?? "Unknown kid",
      profile_emoji: profile?.emoji ?? "",
      profile_color: profile?.color || "#94A3B8",
      public_id: profile?.publicId ?? null,
      family_id: profile?.familyId ?? null,
      family_name: profile?.familyName ?? "Unknown family",
      attempt_count: rows.length,
      pass_count: passCount,
      fail_count: rows.length - passCount,
      success_rate: passCount / rows.length * 100,
      fail_rate: (rows.length - passCount) / rows.length * 100,
      average_score_rate: rows.reduce((total, attempt) => total + ratio(attempt), 0) / rows.length * 100,
      average_time_seconds: null,
      best_score: best.score,
      best_total: best.total,
      latest_score: latest.score,
      latest_total: latest.total,
      latest_completed_at: latest.completedAt,
    };
  }).sort((a, b) => b.success_rate - a.success_rate
    || +new Date(b.latest_completed_at!) - +new Date(a.latest_completed_at!));
}
