import assert from "node:assert/strict";
import test from "node:test";
import { assessmentPerformance, assessmentSummary } from "../src/admin-reports.js";

test("assessment summary preserves legacy pass and average metrics without fabricating time", () => {
  const item = { id: "item-1", category: "animal", countryCode: "VN", createdAt: new Date("2026-09-20T00:00:00Z") };
  const question = { id: "q1", itemId: "item-1", lang: "en", questionType: "single", question: "Where?",
    options: ["VN", "CA"], correctAnswers: [0], sortOrder: 0, isActive: true, createdAt: item.createdAt };
  const attempts = [
    { profileId: "p1", score: 1, total: 1, completedAt: new Date("2026-09-21T00:00:00Z") },
    { profileId: "p1", score: 0, total: 1, completedAt: new Date("2026-09-22T00:00:00Z") },
  ];
  assert.deepEqual(assessmentSummary(item, "Saola", [question], attempts), {
    id: "item-1", item_id: "item-1", assessment_type: "quiz", item_title: "Saola", item_category: "animal",
    country_code: "VN", created_at: item.createdAt, question_count: 1, active_question_count: 1,
    language_count: 1, attempt_count: 2, unique_profile_count: 1, pass_rate: 50,
    fail_rate: 50, average_score_rate: 50, average_time_seconds: null,
    latest_attempt_at: attempts[1]!.completedAt,
  });
  const [performance] = assessmentPerformance(attempts, [{ id: "p1", name: "Learner", emoji: "🌟",
    color: "blue", publicId: "P1", familyId: "f1", familyName: "Family" }]);
  assert.equal(performance?.success_rate, 50);
  assert.equal(performance?.best_score, 1);
  assert.equal(performance?.latest_score, 0);
  assert.equal(performance?.average_time_seconds, null);
});
