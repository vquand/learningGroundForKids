import assert from "node:assert/strict";
import { test } from "node:test";
import { audienceFromSearch, publicRouteForSession, searchForAudience } from "../src/components/Landing/landingState.ts";
import { landingAchievements, landingMinigames } from "../src/components/Landing/landingContent.ts";
import { legalContent } from "../src/components/Landing/legalContent.ts";
import { hasReachedConsentEnd } from "../src/components/Landing/consentState.ts";

test("landing audience defaults to kids and stores parents in the URL", () => {
  assert.equal(audienceFromSearch(""), "kids");
  assert.equal(audienceFromSearch("?for=kids"), "kids");
  assert.equal(audienceFromSearch("?for=parents"), "parents");
  assert.equal(searchForAudience("?utm_source=family", "parents"), "?utm_source=family&for=parents");
  assert.equal(searchForAudience("?for=parents", "kids"), "");
});

test("public routing separates the landing page from the sign-in page", () => {
  assert.equal(publicRouteForSession("/", false), "/");
  assert.equal(publicRouteForSession("/login", false), "/login");
  assert.equal(publicRouteForSession("/login", true), "/");
});

test("consent becomes scrollable only at the end of the complete legal text", () => {
  assert.equal(hasReachedConsentEnd(0, 1000, 400), false);
  assert.equal(hasReachedConsentEnd(592, 1000, 400), true);
  assert.equal(hasReachedConsentEnd(0, 400, 400), true);
  assert.equal(hasReachedConsentEnd(0, 408, 400), true);
});

test("landing carousel uses one direct image per game and ends with a future-games card", () => {
  assert.equal(landingMinigames.length, 8);
  for (const game of landingMinigames) {
    assert.ok(game.id && game.title && game.blurb && game.skills.length > 0 && game.image && game.alt);
    assert.ok(!game.image.includes("atlas") && !game.image.includes("sprite"), `${game.id} must not use an atlas or sprite image`);
  }
});

test("landing achievement showcase uses the nine real achievement entries", () => {
  assert.equal(landingAchievements.length, 9);
  assert.deepEqual(landingAchievements.map(({ name, game, difficulty, description }) => ({ name, game, difficulty, description })), [
    { name: "First Nibble", game: "Fishing", difficulty: "easy", description: "Catch any fish once." },
    { name: "Number Miner", game: "InfiniDrill", difficulty: "easy", description: "Answer 10 main math puzzles correctly in one expedition." },
    { name: "Victory Lap", game: "Animal racing", difficulty: "hard", description: "Win ten Road Racing races." },
    { name: "First Waddle", game: "Waddle Wall", difficulty: "easy", description: "Pass your first wall." },
    { name: "MOO MOO NO NO", game: "Shoo Shoo UFO", difficulty: "medium", description: "Take 5 space trips with the dairy cow." },
    { name: "Sunny Thinker", game: "Waddle Wall", difficulty: "medium", description: "Pass 10 medium walls." },
    { name: "Deep Digger", game: "InfiniDrill", difficulty: "medium", description: "Reach 720 metres, the bottom of Earth layer 6, in one expedition." },
    { name: "Good Company", game: "Fishing", difficulty: "easy", description: "Complete a successful catch with all three animal friends." },
    { name: "Four in a Row", game: "Daily quiz", difficulty: "medium", description: "Pass four daily quizzes in a row within one week." },
  ]);
  for (const achievement of landingAchievements) {
    assert.ok(achievement.name && achievement.game && achievement.description && achievement.image);
    assert.match(achievement.difficulty, /^(easy|medium|hard)$/);
    assert.match(achievement.image, /^\/landing\/badges\/badge-[1-9]\.webp$/);
    assert.doesNotMatch(achievement.description, /—/);
  }
});

test("legal content keeps the approved promises and visible review markers", () => {
  const privacyText = JSON.stringify(legalContent.privacy);
  const termsText = JSON.stringify(legalContent.terms);
  assert.match(privacyText, /never sell your data/i);
  assert.match(privacyText, /support@example.com/);
  assert.match(privacyText, /\[date\]|\[providers\]|\[region\]/);
  assert.match(termsText, /\[liability wording needs legal review\]/);
});
