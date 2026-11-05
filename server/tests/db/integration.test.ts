import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { createDatabase } from "../../src/db/index.js";
import { buildCatalogSeed } from "../../src/db/catalog-seed.js";
import { runSeedTransaction } from "../../src/db/seed-runner.js";
import { assertSafeTestDatabaseUrl } from "../../src/db/test-database.js";
import { AppError } from "../../src/errors.js";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { verifyPassword } from "../../src/auth.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("quiz and flashcard repository integration", { skip: testDatabaseUrl ? false : "TEST_DATABASE_URL is not configured" }, async () => {
  const url = assertSafeTestDatabaseUrl(testDatabaseUrl!, [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
  ].filter((value): value is string => Boolean(value)), process.env.ALLOW_NONLOCAL_TEST_DATABASE);
  const setupPool = new Pool({ connectionString: url, max: 1, allowExitOnIdle: true });
  const db = createDatabase(url);
  try {
    const rollback = await readFile(new URL("../../drizzle/rollback_all.sql", import.meta.url), "utf8");
    await setupPool.query(rollback);
    await setupPool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await migrate(drizzle({ client: setupPool }), {
      migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    });
    const migratedTables = await setupPool.query<{ flashcards: string | null; sessions: string | null }>(
      "SELECT to_regclass('public.flashcards')::text AS flashcards, to_regclass('public.flashcard_study_sessions')::text AS sessions",
    );
    assert.deepEqual(migratedTables.rows[0], { flashcards: "flashcards", sessions: "flashcard_study_sessions" });

    // Root is a reserved account, not an email-based promotion of a family.
    for (const identity of [{ id: "ordinary", email: " ROOT@SYSTEM.LOCAL " }, { id: "root", email: "ordinary@example.test" }]) {
      await assert.rejects(() => db.auth.createFamily({ ...identity, displayName: "Conflict", passwordHash: "unchanged", role: "admin" }), /reserved/);
    }
    await setupPool.query("INSERT INTO families (id, email, display_name, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
      ["reserved-email-test", "root@system.local", "Conflict", "unchanged", "family"]);
    await assert.rejects(() => db.auth.createRootIfMissing("root-hash"), /reserved root account/);
    assert.equal((await db.auth.findFamilyByEmail("root@system.local"))?.role, "family");
    await setupPool.query("DELETE FROM families WHERE id = $1", ["reserved-email-test"]);
    const rootCreations = await Promise.all([db.auth.createRootIfMissing("root-hash"), db.auth.createRootIfMissing("root-hash")]);
    assert.equal(rootCreations.filter(Boolean).length, 1);
    assert.equal((await db.auth.findFamilyByEmail("root@system.local"))?.id, "root");
    assert.equal(await db.auth.createRootIfMissing("must-not-replace"), false);
    assert.equal((await db.auth.findFamilyByEmail("root@system.local"))?.passwordHash, "root-hash");
    for (const tokenHash of ["root-session-one", "root-session-two"]) {
      await db.auth.createSession({ tokenHash, familyId: "root", expiresAt: new Date(Date.now() + 60_000), expectedPasswordHash: "root-hash" });
    }
    assert.equal(await db.auth.replaceRootPassword("root-hash", "must-not-change", "not-a-session"), false);
    const rotations = await Promise.all([
      db.auth.replaceRootPassword("root-hash", "root-new-hash-one", "root-session-one"),
      db.auth.replaceRootPassword("root-hash", "root-new-hash-two", "root-session-two"),
    ]);
    assert.equal(rotations.filter(Boolean).length, 1);
    assert.equal(await db.auth.findFamilyBySessionHash("root-session-one", new Date()), null);
    assert.equal(await db.auth.findFamilyBySessionHash("root-session-two", new Date()), null);
    await assert.rejects(() => db.auth.createSession({ tokenHash: "late-old-login", familyId: "root", expiresAt: new Date(Date.now() + 60_000), expectedPasswordHash: "root-hash" }),
      (error: unknown) => error instanceof AppError && error.status === 401);
    const newHash = (await db.auth.findFamilyByEmail("root@system.local"))!.passwordHash;
    await db.auth.createSession({ tokenHash: "valid-new-login", familyId: "root", expiresAt: new Date(Date.now() + 60_000), expectedPasswordHash: newHash });
    assert.equal((await db.auth.findFamilyBySessionHash("valid-new-login", new Date()))?.id, "root");
    // A concurrent verified login is either issued before rotation and revoked,
    // or rejected after rotation; it must never leave a surviving old session.
    await Promise.allSettled([
      db.auth.replaceRootPassword(newHash, "root-final-hash", "valid-new-login"),
      db.auth.createSession({ tokenHash: "racing-login", familyId: "root", expiresAt: new Date(Date.now() + 60_000), expectedPasswordHash: newHash }),
    ]);
    assert.equal((await db.auth.findFamilyByEmail("root@system.local"))?.passwordHash, "root-final-hash");
    assert.equal(await db.auth.findFamilyBySessionHash("racing-login", new Date()), null);

    const ordinary = await db.auth.createFamily({ id: "password-target", email: "password-target@example.test", displayName: "Password Target", passwordHash: "original-hash", role: "family" });
    await db.auth.createSession({ tokenHash: "old-target-session", familyId: ordinary.id, expiresAt: new Date(Date.now() + 60_000), expectedPasswordHash: "original-hash" });
    assert.equal(await db.auth.setFamilyPassword({ targetId: ordinary.id, actorId: "root", passwordHash: "replacement-hash", reason: "Owner support request" }), "updated");
    assert.equal((await db.auth.findFamilyByEmail(ordinary.email))?.passwordHash, "replacement-hash");
    assert.equal(await db.auth.findFamilyBySessionHash("old-target-session", new Date()), null);
    await assert.rejects(() => db.auth.createSession({ tokenHash: "stale-target-login", familyId: ordinary.id, expiresAt: new Date(Date.now() + 60_000), expectedPasswordHash: "original-hash" }),
      (error: unknown) => error instanceof AppError && error.status === 401);
    const audit = await setupPool.query("SELECT actor_family_id, target_family_id, reason FROM family_password_audit WHERE target_family_id = $1", [ordinary.id]);
    assert.deepEqual(audit.rows, [{ actor_family_id: "root", target_family_id: ordinary.id, reason: "Owner support request" }]);
    assert.equal(await db.auth.setFamilyPassword({ targetId: "root", actorId: "root", passwordHash: "forbidden", reason: "No" }), "not_found");
    assert.equal(await db.auth.setFamilyPassword({ targetId: "missing", actorId: "root", passwordHash: "forbidden", reason: "No" }), "not_found");
    await setupPool.query("DELETE FROM family_password_audit WHERE target_family_id = $1", [ordinary.id]);

    // Exercise the actual operator migration command and persisted API flow,
    // not just mocks or direct repository calls.
    await setupPool.query("DELETE FROM families WHERE id = $1", ["root"]);
    const credentialDirectory = await mkdtemp(join(tmpdir(), "plg-root-cli-test-"));
    const credentialPath = join(credentialDirectory, "initial-password.txt");
    try {
      const runInitializer = () => promisify(execFile)(process.execPath,
        ["--import", "tsx", "scripts/migrate-root-account.ts"], {
          cwd: fileURLToPath(new URL("../../", import.meta.url)),
          env: { ...process.env, DATABASE_URL_UNPOOLED: url, ROOT_PASSWORD_FILE: credentialPath },
          timeout: 15_000,
        });
      const first = await runInitializer();
      const initialPassword = (await readFile(credentialPath, "utf8")).trimEnd();
      assert.equal(initialPassword.length, 43);
      assert.equal((await stat(credentialPath)).mode & 0o777, 0o600);
      assert.equal((first.stdout + first.stderr).includes(initialPassword), false);
      const initialHash = (await db.auth.findFamilyByEmail("root@system.local"))!.passwordHash;
      assert.equal(await verifyPassword(initialHash, initialPassword), true);
      const second = await runInitializer();
      assert.match(second.stdout, /Root already exists/);
      assert.equal((await db.auth.findFamilyByEmail("root@system.local"))!.passwordHash, initialHash);
      assert.equal((await readFile(credentialPath, "utf8")).trimEnd(), initialPassword);

      const fallbackPassword = "local test recovery password only";
      const api = createApp({ db, config: loadConfig({ NODE_ENV: "test", DATABASE_URL: url,
        ALLOWED_ORIGINS: "https://app.example.com", ALLOWED_FORWARDED_HOSTS: "app.example.com",
        ROOT_FALLBACK_PASSWORD: fallbackPassword }), logger: { info() {}, warn() {}, error() {} } });
      const login = (password: string) => api.request("https://app.example.com/api/v1/auth/login", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "root", password }),
      });
      const initialLogin = await login(initialPassword);
      assert.equal(initialLogin.status, 200);
      assert.equal((await initialLogin.json()).user.isRoot, true);
      const fallbackLogin = await login(fallbackPassword);
      assert.equal(fallbackLogin.status, 200);
      const cookies = [initialLogin, fallbackLogin].map((response) => response.headers.get("set-cookie")!.split(";")[0]!);
      const provision = (name: string) => api.request("https://app.example.com/api/v1/admin/families", {
        method: "POST", headers: { "content-type": "application/json", cookie: cookies[0]!, origin: "https://app.example.com" },
        body: JSON.stringify({ name, email: "provisioned@example.test", password: "local family initial password" }),
      });
      // Unique constraints handle concurrent provisioning as one creation and one conflict.
      const provisions = await Promise.all([provision("Provisioned family"), provision("Provisioned family")]);
      assert.deepEqual(provisions.map((response) => response.status).sort(), [201, 409]);
      const provisioned = await db.auth.findFamilyByEmail("provisioned@example.test");
      assert.equal(provisioned?.role, "family");
      assert.equal(await verifyPassword(provisioned!.passwordHash, "local family initial password"), true);
      assert.ok(provisions.every((response) => response.headers.get("set-cookie") === null));
      const rootSession = await api.request("https://app.example.com/api/v1/auth/session", { headers: { cookie: cookies[0]! } });
      assert.equal((await rootSession.json()).user.isRoot, true);
      const familyReport = (await db.admin.families()).find((entry) => entry.id === provisioned!.id)!;
      assert.equal(familyReport.email, "provisioned@example.test");
      assert.equal(familyReport.role, "family");
      assert.equal(familyReport.is_active, true);
      assert.deepEqual(familyReport.profiles, []);
      assert.equal("passwordHash" in familyReport, false);
      const update = await api.request("https://app.example.com/api/v1/admin/root/password", {
        method: "PATCH", headers: { "content-type": "application/json", cookie: cookies[0]!, origin: "https://app.example.com" },
        body: JSON.stringify({ newPassword: "local updated password only", confirmPassword: "local updated password only", fallbackPassword }),
      });
      assert.equal(update.status, 204);
      for (const cookie of cookies) {
        const session = await api.request("https://app.example.com/api/v1/auth/session", { headers: { cookie } });
        assert.deepEqual(await session.json(), { authenticated: false });
      }
      assert.equal((await login(initialPassword)).status, 401);
      assert.equal((await login("local updated password only")).status, 200);
      assert.equal((await login(fallbackPassword)).status, 200);
    } finally {
      await rm(credentialDirectory, { recursive: true, force: true });
    }

    await db.auth.createFamily({
      id: "family-profile-limit", email: "profile-limit@example.test",
      displayName: "Profile limit", passwordHash: "not-used", role: "family",
    });
    const profileInput = { name: "Learner", emoji: "🧪", color: "blue" };
    for (let index = 0; index < 4; index += 1) {
      await db.profiles.create("family-profile-limit", profileInput);
    }
    const profileCreations = await Promise.allSettled([
      db.profiles.create("family-profile-limit", profileInput),
      db.profiles.create("family-profile-limit", profileInput),
    ]);
    assert.equal(profileCreations.filter((result) => result.status === "fulfilled").length, 1);
    const profileConflict = profileCreations.find((result) => result.status === "rejected");
    assert.ok(profileConflict?.status === "rejected" && profileConflict.reason instanceof AppError);
    assert.equal(profileConflict.reason.status, 409);
    assert.equal(profileConflict.reason.code, "PROFILE_LIMIT_REACHED");
    assert.equal(profileConflict.reason.safeMessage, "Maximum 5 profiles allowed.");
    assert.equal(await db.profiles.count("family-profile-limit"), 5);
    await assert.rejects(() => db.profiles.create("family-profile-limit", profileInput),
      (error: unknown) => error instanceof AppError && error.code === "PROFILE_LIMIT_REACHED");

    await setupPool.query(
      "INSERT INTO families (id, email, display_name, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
      ["family-integration", "integration@example.test", "Integration", "not-used", "family"],
    );
    await setupPool.query(
      "INSERT INTO families (id, email, display_name, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
      ["family-target", "target@example.test", "Target", "not-used", "family"],
    );
    await setupPool.query(
      "INSERT INTO profiles (id, family_id, name, emoji, color, public_id) VALUES ($1, $2, $3, $4, $5, $6)",
      ["profile-integration", "family-integration", "Learner", "🧪", "blue", "INTEGRATE1"],
    );
    await setupPool.query(
      "INSERT INTO profiles (id, family_id, name, emoji, color, public_id) VALUES ($1, $2, $3, $4, $5, $6)",
      ["profile-target", "family-target", "Target", "🎯", "gold", "TARGET01"],
    );
    await setupPool.query(
      "INSERT INTO items (id, category, latitude, longitude, is_published, quiz_required) VALUES ($1, $2, $3, $4, true, true)",
      ["item-integration", "animal", 1, 2],
    );
    for (const lang of ["en", "vi"]) {
      for (let index = 0; index < 10; index += 1) {
        await setupPool.query(
          "INSERT INTO quiz_questions (id, item_id, lang, question, question_type, options, correct_answers, sort_order, is_active) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, true)",
          [`${lang}-q-${index}`, "item-integration", lang, `${lang} question ${index}`, "single", JSON.stringify(["A", "B"]), JSON.stringify([0]), index],
        );
      }
    }

    await setupPool.query(
      "INSERT INTO items (id, category, latitude, longitude, is_published, source_type, owner_family_id, quiz_required) VALUES ($1, $2, $3, $4, true, 'custom', $5, false)",
      ["item-owned-by-integration", "animal", 3, 4, "family-integration"],
    );
    await setupPool.query(
      "INSERT INTO item_translations (id, item_id, lang, title) VALUES ($1, $2, 'en', $3)",
      ["translation-owned-by-integration", "item-owned-by-integration", "Private lesson"],
    );
    await setupPool.query(
      "INSERT INTO item_media (id, item_id, media_type, filename) VALUES ($1, $2, 'image', $3), ($4, $5, 'image', $6)",
      ["media-system", "item-integration", "catalog/public.jpg", "media-private", "item-owned-by-integration", "families/private.jpg"],
    );
    await setupPool.query(
      "INSERT INTO items (id, category, latitude, longitude, is_published, source_type, owner_family_id, quiz_required) VALUES ($1, $2, $3, $4, false, 'custom', $5, false)",
      ["item-unpublished-snapshot", "animal", 5, 6, "family-integration"],
    );
    await setupPool.query(
      "INSERT INTO quiz_questions (id, item_id, lang, question, question_type, options, correct_answers, sort_order, is_active) VALUES ($1, $2, 'en', $3, 'single', $4::jsonb, $5::jsonb, 0, true)",
      ["unpublished-snapshot-question", "item-unpublished-snapshot", "Unpublished question", JSON.stringify(["A", "B"]), JSON.stringify([0])],
    );
    await setupPool.query(
      "INSERT INTO profile_progress (id, profile_id, item_id, category, done_at) VALUES ($1, $2, $3, $4, now())",
      ["progress-unpublished-snapshot", "profile-integration", "item-unpublished-snapshot", "animal"],
    );
    await setupPool.query(
      "INSERT INTO daily_quiz_snapshots (id, profile_id, snapshot_date, lang, question_ids) VALUES ($1, $2, $3, 'en', $4::jsonb)",
      ["snapshot-unpublished-item", "profile-integration", "2040-02-04", JSON.stringify(["unpublished-snapshot-question"])],
    );

    const flashcardSeed = buildCatalogSeed([{
      category: "animal",
      latitude: 10,
      longitude: 106,
      country_code: "VN",
      icon_slug: "animal",
      is_published: true,
      start_year: 2001,
      translations: [{
        lang: "en",
        title: "Integration Saola",
        description: "A rare forest animal from Vietnam.",
        history: "Scientists documented the saola in the twentieth century.",
      }],
      quiz_questions: Array.from({ length: 3 }, (_, index) => ({
        lang: "en",
        question: `Seed question ${index}`,
        question_type: "single",
        options: ["Correct", "Wrong"],
        correct_answers: [0],
        sort_order: index,
      })),
    }], {});
    const seedClient = await setupPool.connect();
    try {
      await runSeedTransaction(seedClient, flashcardSeed.statements);
    } finally {
      seedClient.release();
    }
    const flashcardItemId = flashcardSeed.itemIds[0]!;

    await db.ping();

    await setupPool.query(
      "INSERT INTO families (id, email, display_name, password_hash, role) VALUES ($1, $2, $3, $4, 'admin')",
      ["admin-integration", "admin-integration@example.test", "Admin", "not-used"],
    );
    const createdCatalogItem = await db.items.create({
      id: "item-api-created",
      category: "landmark",
      latitude: 10.25,
      longitude: 106.75,
      country_code: "VN",
      icon_slug: "landmark",
      is_published: false,
      location_desc: "A test catalog point.",
      fun_facts: ["Stored as JSONB."],
      rich_fields: { source: "integration-test" },
      quiz_required: true,
      translations: [{ lang: "en", title: "API-created landmark", description: "Created transactionally." }],
      media: [{ media_type: "image", filename: "landmarks/test.jpg", sort_order: 0 }],
      quiz_questions: [{
        question_group_id: "group-api",
        lang: "en",
        question: "Which country?",
        question_type: "single",
        options: ["Vietnam", "Canada"],
        correct_answers: [0],
        sort_order: 0,
      }],
    });
    assert.deepEqual(createdCatalogItem, {
      id: "item-api-created",
      category: "landmark",
      is_published: false,
      quiz_required: true,
      translation_count: 1,
      media_count: 1,
      quiz_question_count: 1,
    });
    const createdRows = await setupPool.query<{ translations: string; media: string; questions: string; source_type: string; owner_family_id: string | null }>(
      `SELECT
         (SELECT COUNT(*) FROM item_translations WHERE item_id = $1)::text AS translations,
         (SELECT COUNT(*) FROM item_media WHERE item_id = $1)::text AS media,
         (SELECT COUNT(*) FROM quiz_questions WHERE item_id = $1)::text AS questions,
         source_type,
         owner_family_id
       FROM items WHERE id = $1`,
      ["item-api-created"],
    );
    assert.deepEqual(createdRows.rows[0], {
      translations: "1",
      media: "1",
      questions: "1",
      source_type: "system",
      owner_family_id: null,
    });
    const adminCatalogItem = await db.items.getAdmin("item-api-created");
    assert.equal(adminCatalogItem?.is_published, false);
    assert.equal(adminCatalogItem?.source_type, "system");
    assert.equal(adminCatalogItem?.translations[0]?.title, "API-created landmark");
    assert.equal(adminCatalogItem?.quiz_questions[0]?.correct_answers[0], 0);
    assert.equal(adminCatalogItem?.quiz_questions[0]?.question_group_id, "group-api");
    assert.equal(await db.items.canReadMedia("family-integration", "catalog/public.jpg"), true);
    assert.equal(await db.items.canReadMedia("family-integration", "families/private.jpg"), true);
    assert.equal(await db.items.canReadMedia("family-target", "families/private.jpg"), false);
    assert.equal(await db.items.canReadMedia("family-target", "landmarks/test.jpg"), false);
    assert.equal(await db.items.canReadMedia("admin-integration", "landmarks/test.jpg", true), true);
    assert.equal(await db.items.canReadMedia("family-integration", "unknown.jpg"), false);
    assert.ok((await db.items.listAdmin(5000)).some((row) => row.id === "item-api-created"
      && row.category === "landmark" && row.title_en === "API-created landmark" && row.is_published === false));

    await assert.rejects(
      () => db.items.updateBatch([
        { id: "item-api-created", location_desc: "Should roll back." },
        { id: "item-does-not-exist", location_desc: "Missing." },
      ]),
      (error: unknown) => error instanceof Error && error.name === "AppError" && error.message === "Item item-does-not-exist was not found.",
    );
    assert.equal((await db.items.getAdmin("item-api-created"))?.location_desc, "A test catalog point.");

    const updatedCatalogItems = await db.items.updateBatch([
      {
        id: "item-api-created",
        location_desc: null,
        translations: [{ lang: "en", title: "Updated API-created landmark" }],
        media: [],
        quiz_questions: [],
      },
      { id: "item-integration", location_desc: "Updated in a batch." },
    ]);
    assert.deepEqual(updatedCatalogItems, [
      {
        id: "item-api-created",
        category: "landmark",
        is_published: false,
        quiz_required: true,
        translation_count: 1,
        media_count: 0,
        quiz_question_count: 0,
      },
      {
        id: "item-integration",
        category: "animal",
        is_published: true,
        quiz_required: true,
        translation_count: 0,
        media_count: 1,
        quiz_question_count: 20,
      },
    ]);
    const updatedAdminCatalogItem = await db.items.getAdmin("item-api-created");
    assert.equal(updatedAdminCatalogItem?.location_desc, null);
    assert.deepEqual(updatedAdminCatalogItem?.translations.map((value) => value.title), ["Updated API-created landmark"]);
    assert.deepEqual(updatedAdminCatalogItem?.media, []);
    assert.deepEqual(updatedAdminCatalogItem?.quiz_questions, []);

    await assert.rejects(
      () => db.items.create({
        id: "item-api-created",
        category: "animal",
        latitude: 0,
        longitude: 0,
        is_published: false,
        quiz_required: false,
        translations: [{ lang: "en", title: "Collision" }],
        media: [],
        quiz_questions: [],
      }),
      (error: unknown) => error instanceof Error && error.name === "AppError" && error.message === "An item with this id already exists.",
    );

    const ownerItems = await db.items.list({ familyId: "family-integration", limit: 100 });
    const recipientItems = await db.items.list({ familyId: "family-target", limit: 100 });
    const unrelatedItems = await db.items.list({ familyId: "family-unrelated", limit: 100 });
    assert.ok(ownerItems.some((value) => value.id === "item-owned-by-integration"));
    assert.ok(!recipientItems.some((value) => value.id === "item-owned-by-integration"));
    assert.ok(!unrelatedItems.some((value) => value.id === "item-owned-by-integration"));
    assert.equal(await db.items.get("item-owned-by-integration", "en", "family-target"), null);
    assert.equal(await db.items.getAdmin("item-owned-by-integration", "family-target"), null);
    assert.equal(await db.items.getAdmin("item-api-created", "family-integration"), null);
    assert.equal((await db.items.getAdmin("item-owned-by-integration", "family-integration"))?.id, "item-owned-by-integration");
    await assert.rejects(
      () => db.items.updateBatch([{ id: "item-owned-by-integration", category: "music" }], "family-target"),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );
    assert.equal((await db.items.getAdmin("item-owned-by-integration"))?.category, "animal");
    await assert.rejects(
      () => db.parent.shareLesson("family-integration", "item-owned-by-integration", {
        target_scope: "profile", target_family_id: "family-target", target_profile_id: "profile-target",
      }),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );
    assert.equal(await db.items.get("item-owned-by-integration", "en", "family-unrelated"), null);
    assert.equal(await db.quiz.getItemQuiz("item-owned-by-integration", "en", "family-unrelated"), null);
    await assert.rejects(
      () => db.quiz.submitItem("profile-target", "item-owned-by-integration", [], "family-unrelated"),
      (error: unknown) => error instanceof Error && error.name === "AppError" && error.message === "Item not found.",
    );
    assert.equal(await db.quiz.getItemQuiz("item-owned-by-integration", "en", "family-target"), null);
    assert.equal(await db.flashcards.getOptions("item-owned-by-integration", "en", "family-target"), null);
    assert.equal(
      await db.flashcards.getDeck("profile-target", "item-owned-by-integration", "en", "item", "item-owned-by-integration", "family-target"),
      null,
    );
    const newLearnerDaily = await db.quiz.getDailyQuiz("profile-integration", "en", "2040-02-04", "family-integration");
    assert.equal(newLearnerDaily?.questions.length, 8);
    assert.ok(newLearnerDaily?.questions.every(question => question.item_id !== "item-owned-by-integration"));

    const familyFriendRequest = await db.friendRequests.create("family-integration", {
      requesting_scope: "profile",
      requesting_profile_id: "profile-integration",
      target_code: " target01 ",
      target_scope: "family",
    });
    assert.equal(familyFriendRequest.requesting_family_id, "family-integration");
    assert.equal(familyFriendRequest.requesting_label, "Learner only");
    assert.equal(familyFriendRequest.target_family_id, "family-target");
    assert.equal(familyFriendRequest.target_profile_id, null);
    assert.equal(familyFriendRequest.target_code, "TARGET01");
    assert.equal(
      familyFriendRequest.requester_message,
      "Learner only wants to be friends with Target family (all kids now and later). Target code: TARGET01 (Target).",
    );
    const [listedFriendRequest]=await db.friendRequests.list("family-target",10);
    assert.ok(listedFriendRequest);
    const {requesting_party,target_party,...listedFields}=listedFriendRequest;
    assert.deepEqual(listedFields,familyFriendRequest);
    assert.equal(requesting_party?.name,'Learner');assert.equal(target_party?.name,'Target');
    assert.equal(requesting_party?.emoji,'🧪');
    assert.deepEqual(await db.friendRequests.list("family-unrelated", 10), []);
    await assert.rejects(
      () => db.friendRequests.create("family-integration", {
        requesting_scope: "profile",
        requesting_profile_id: "profile-integration",
        target_code: "TARGET01",
        target_scope: "family",
      }),
      (error: unknown) => error instanceof Error && error.name === "AppError" && error.message === "That friend request is already pending.",
    );
    await assert.rejects(
      () => db.friendRequests.create("family-integration", {
        requesting_scope: "profile",
        requesting_profile_id: "profile-target",
        target_code: "TARGET01",
        target_scope: "profile",
      }),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );

    const acceptedFamilyFriendRequest = await db.friendRequests.respond("family-target", familyFriendRequest.id, true);
    assert.equal(acceptedFamilyFriendRequest.status, "accepted");
    assert.equal(acceptedFamilyFriendRequest.responded_by_family_id, "family-target");
    assert.ok(acceptedFamilyFriendRequest.responded_at instanceof Date);
    assert.deepEqual((await db.parent.shareTargets("family-integration")).map((target) => target.family_id).sort(), [
      "family-integration", "family-target",
    ]);
    await assert.rejects(
      () => db.parent.shareLesson("family-target", "item-owned-by-integration", {
        target_scope: "family", target_family_id: "family-integration",
      }),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );
    await assert.rejects(
      () => db.parent.shareLesson("family-integration", "item-owned-by-integration", {
        target_scope: "profile", target_family_id: "family-target", target_profile_id: "profile-integration",
      }),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );
    await db.parent.shareLesson("family-integration", "item-owned-by-integration", {
      target_scope: "profile", target_family_id: "family-target", target_profile_id: "profile-target",
    });
    await db.parent.shareLesson("family-integration", "item-owned-by-integration", {
      target_scope: "profile", target_family_id: "family-target", target_profile_id: "profile-target",
    });
    assert.equal(await db.items.get("item-owned-by-integration", "en", "family-target"), null);
    assert.equal((await db.items.get("item-owned-by-integration", "en", "family-target", "profile-target"))?.id, "item-owned-by-integration");
    assert.equal(await db.quiz.getItemQuiz("item-owned-by-integration", "en", "family-target"), null);
    assert.ok(await db.quiz.getItemQuiz("item-owned-by-integration", "en", "family-target", "profile-target"));
    assert.deepEqual(await db.quiz.getItemStatus("profile-target", "item-owned-by-integration", "family-target"), {
      attempt_count: 0, passed: false, best_score: 0, best_total: 0, latest_score: 0, latest_total: 0,
    });
    assert.ok((await db.items.list({ familyId: "family-target", profileId: "profile-target", limit: 100 }))
      .some((item) => item.id === "item-owned-by-integration"));
    assert.equal(await db.items.canReadMedia("family-target", "families/private.jpg"), true);
    assert.equal(await db.items.get("item-owned-by-integration", "en", "family-target", "profile-integration"), null);
    const parentCatalog = await db.parent.catalog("family-integration");
    assert.ok(parentCatalog.system_lessons.some((lesson) => lesson.id === "item-integration"));
    assert.equal(await db.parent.setSystemDisabled("family-integration", ["item-integration"], true), 1);
    assert.equal(await db.items.get("item-integration", "en", "family-integration"), null);
    assert.equal(await db.items.canReadMedia("family-integration", "catalog/public.jpg"), false);
    assert.ok(await db.items.get("item-integration", "en", "family-target"));
    assert.ok((await db.parent.catalog("family-integration")).system_lessons
      .some((lesson) => lesson.id === "item-integration" && lesson.is_disabled_for_family));
    assert.equal(await db.parent.setSystemDisabled("family-integration", ["item-integration"], false), 1);
    assert.ok(await db.items.get("item-integration", "en", "family-integration"));
    await assert.rejects(
      () => db.friendRequests.respond("family-integration", familyFriendRequest.id, false),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );

    const racedRequest = await db.friendRequests.create("family-integration", {
      requesting_scope: "family",
      target_code: "TARGET01",
      target_scope: "profile",
    });
    const racedResponses = await Promise.allSettled([
      db.friendRequests.respond("family-target", racedRequest.id, true),
      db.friendRequests.respond("family-target", racedRequest.id, false),
    ]);
    assert.equal(racedResponses.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(racedResponses.filter((result) => result.status === "rejected").length, 1);

    const itemQuiz = await db.quiz.getItemQuiz("item-integration", "fr", "family-integration");
    assert.equal(itemQuiz?.questions.length, 10);
    assert.ok(itemQuiz?.questions.every((question) => question.lang === "en"));

    const answers = (lang: string, correctCount: number) => Array.from({ length: 10 }, (_, index) => ({
      question_id: `${lang}-q-${index}`,
      chosen_answers: [index < correctCount ? 0 : 1],
    }));
    const itemFail = await db.quiz.submitItem("profile-integration", "item-integration", answers("en", 7), "family-integration");
    assert.deepEqual(itemFail, { score: 7, total: 10, passed: false, new_badges: [] });
    assert.deepEqual(await db.progress.get("family-integration", "profile-integration", "item-integration"), { done: false });

    const itemPass = await db.quiz.submitItem("profile-integration", "item-integration", answers("en", 8), "family-integration");
    assert.deepEqual(itemPass, { score: 8, total: 10, passed: true, new_badges: [] });
    assert.deepEqual(await db.progress.get("family-integration", "profile-integration", "item-integration"), { done: true });
    assert.deepEqual(await db.quiz.getItemStatus("profile-integration", "item-integration", "family-integration"), {
      attempt_count: 2,
      passed: true,
      best_score: 8,
      best_total: 10,
      latest_score: 8,
      latest_total: 10,
    });

    const day = "2040-02-03";
    const firstDaily = await db.quiz.getDailyQuiz("profile-integration", "vi", day, "family-integration");
    const secondDaily = await db.quiz.getDailyQuiz("profile-integration", "en", day, "family-integration");
    const firstIds = firstDaily?.questions.map((question) => question.id);
    assert.equal(firstIds?.length, 8);
    assert.ok(firstDaily?.questions.every(question => question.correct_answers.length === 1));
    assert.deepEqual(secondDaily?.questions.map((question) => question.id), firstIds);

    await assert.rejects(
      () => db.quiz.submitDaily("profile-integration", day, answers("en", 10), "family-integration"),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );
    const dailyAnswers = firstDaily!.questions.map((question, index) => ({
      question_id: question.id,
      chosen_answers: index < 6 ? question.correct_answers : [(question.correct_answers[0]! + 1) % question.options.length],
    }));
    const dailyPass = await db.quiz.submitDaily("profile-integration", day, dailyAnswers, "family-integration");
    assert.equal(dailyPass.score, 6);
    assert.equal(dailyPass.total, 8);
    assert.equal(dailyPass.passed, true);
    assert.deepEqual(dailyPass.townReward, { wood: 10, stamina: 10, metal: 10 });
    const dailyFail = await db.quiz.submitDaily(
      "profile-integration",
      day,
      firstDaily!.questions.map(question => ({ question_id: question.id, chosen_answers: [(question.correct_answers[0]! + 1) % question.options.length] })),
      "family-integration",
    );
    assert.equal(dailyFail.score, 0);
    assert.equal(dailyFail.passed, false);
    assert.deepEqual(dailyFail.townReward, {});
    assert.deepEqual(await db.quiz.getDailyStatus("profile-integration", day, "family-integration"), {
      attempted_today: true,
      passed: true,
      score: 0,
      total: 8, day, streak: 1, bonus: 0, amount: 10,
    });

    const dailyAttemptRows = await setupPool.query<{ attempt_date: Date; completed_at: Date }>(
      "SELECT attempt_date, completed_at FROM quiz_attempts WHERE profile_id = $1 AND item_id IS NULL ORDER BY completed_at",
      ["profile-integration"],
    );
    assert.equal(dailyAttemptRows.rows.length, 1);
    assert.ok(dailyAttemptRows.rows.every((row) => row.attempt_date.toISOString().startsWith(`${day}T`)));
    assert.ok(dailyAttemptRows.rows.every((row) => Math.abs(Date.now() - row.completed_at.getTime()) < 60_000));

    await db.items.updateBatch([{ id: "item-integration", quiz_questions: [{
      lang: "en", question: "Replacement question", question_type: "single",
      options: ["New answer", "Wrong answer"], correct_answers: [0], sort_order: 0,
    }] }]);
    assert.deepEqual((await db.quiz.getDailyQuiz("profile-integration", "en", day, "family-integration"))
      ?.questions.map((question) => question.id), firstIds);
    const repeatedDaily = await db.quiz.submitDaily("profile-integration", day, dailyAnswers, "family-integration");
    assert.equal(repeatedDaily.passed, true);
    assert.deepEqual(repeatedDaily.townReward, {});
    assert.deepEqual((await db.quiz.getItemQuiz("item-integration", "en", "family-integration"))
      ?.questions.map((question) => question.question), ["Replacement question"]);

    const ownCompletions = await db.progress.listDetailed("family-integration", "profile-integration");
    assert.ok(ownCompletions.some((row) => row.item_id === "item-integration"));
    assert.deepEqual(await db.progress.listDetailed("family-target", "profile-integration"), []);
    assert.ok((await db.progress.badges("family-integration", "profile-integration"))
      .some((badge) => badge.badge_key === "quiz_first"));
    assert.deepEqual(await db.progress.badges("family-target", "profile-integration"), []);

    await setupPool.query(
      "INSERT INTO profile_progress (id, profile_id, item_id, category) VALUES ($1, $2, $3, $4)",
      ["target-visible-progress", "profile-target", "item-integration", "animal"],
    );
    const recent = await db.progress.recentVisible("family-integration", 10);
    assert.ok(recent.some((row) => row.family_id === "family-target" && row.profile_id === "profile-target"));
    assert.ok(recent.some((row) => row.family_id === "family-integration"));

    const options = await db.flashcards.getOptions(flashcardItemId, "fr", "family-integration");
    const itemOption = options?.find((option) => option.theme_type === "item");
    assert.deepEqual(itemOption, {
      theme_type: "item",
      theme_value: flashcardItemId,
      title: "Study This Item",
      description: "Quick cards for this place, food, song, or story.",
      available_cards: 5,
      item_count: 1,
    });
    const firstDeck = await db.flashcards.getDeck("profile-integration", flashcardItemId, "fr", "item", flashcardItemId, "family-integration");
    const secondDeck = await db.flashcards.getDeck("profile-integration", flashcardItemId, "fr", "item", flashcardItemId, "family-integration");
    assert.equal(firstDeck?.cards.length, 5);
    assert.ok(firstDeck?.cards.every((card) => card.lang === "en"));
    assert.deepEqual(secondDeck, firstDeck);

    const viewedIds = firstDeck!.cards.slice(0, 3).map((card) => card.id);
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    const study = await db.flashcards.createStudySession("profile-integration", {
      focus_item_id: flashcardItemId,
      theme_type: "item",
      theme_value: flashcardItemId,
      lang: "fr",
      viewed_flashcard_ids: viewedIds,
      responses: [
        { flashcard_id: viewedIds[0]!, rating: "got_it" },
        { flashcard_id: viewedIds[1]!, rating: "review_again" },
      ],
      started_at: startedAt,
    }, "family-integration");
    assert.equal(study.cards_shown, 3);
    assert.equal(study.got_it_count, 1);
    assert.equal(study.review_again_count, 1);
    const storedStudy = await setupPool.query<{
      profile_id: string;
      cards_shown: number;
      got_it_count: number;
      review_again_count: number;
      completed_at: Date;
    }>(
      "SELECT profile_id, cards_shown, got_it_count, review_again_count, completed_at FROM flashcard_study_sessions WHERE id = $1",
      [study.id],
    );
    assert.equal(storedStudy.rows[0]?.profile_id, "profile-integration");
    assert.equal(storedStudy.rows[0]?.cards_shown, 3);
    assert.equal(storedStudy.rows[0]?.got_it_count, 1);
    assert.equal(storedStudy.rows[0]?.review_again_count, 1);
    assert.ok(Math.abs(Date.now() - storedStudy.rows[0]!.completed_at.getTime()) < 60_000);

    await setupPool.query(
      "INSERT INTO flashcards (id, item_id, lang, front, back, is_published, source_type) VALUES ($1, $2, 'en', 'Hidden', 'Hidden', false, 'manual')",
      ["unpublished-card", flashcardItemId],
    );
    await assert.rejects(
      () => db.flashcards.createStudySession("profile-integration", {
        focus_item_id: flashcardItemId,
        theme_type: "item",
        theme_value: flashcardItemId,
        lang: "fr",
        viewed_flashcard_ids: ["unpublished-card"],
        responses: [],
        started_at: new Date(Date.now() - 1_000).toISOString(),
      }, "family-integration"),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );
    await assert.rejects(
      () => db.flashcards.getDeck("profile-integration", flashcardItemId, "en", "country", "US", "family-integration"),
      (error: unknown) => error instanceof Error && error.name === "AppError",
    );
    // Admin inspection restores every stored activity, without crossing the
    // selected family/profile pair or exposing answer payloads and credentials.
    await setupPool.query("INSERT INTO families (id, email, display_name, password_hash) VALUES ('report-family', 'report@example.test', 'Report family', 'private-hash')");
    await setupPool.query("INSERT INTO profiles (id, family_id, name, emoji, color, public_id) VALUES ('report-child', 'report-family', 'Report learner', '🌟', 'blue', 'REPORT01')");
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    for (let index = 0; index < 12; index++) {
      const id = `report-item-${String(index).padStart(2, "0")}`;
      const date = new Date(midnight);
      date.setUTCDate(date.getUTCDate() - index);
      await setupPool.query("INSERT INTO items (id, category, latitude, longitude, is_published) VALUES ($1, 'animal', $2, $3, false)", [id, index, index + 1]);
      await setupPool.query("INSERT INTO item_translations (id, item_id, lang, title) VALUES ($1, $2, 'vi', 'Vietnamese'), ($3, $2, 'en', $4)", [`${id}-vi`, id, `${id}-en`, `Report title ${index}`]);
      await setupPool.query("INSERT INTO profile_progress (id, profile_id, item_id, category, done_at) VALUES ($1, 'report-child', $2, 'animal', $3)", [`progress-${index}`, id, date]);
    }
    await setupPool.query("DELETE FROM item_translations WHERE id = 'report-item-05-en'");
    const beforeMidnight = new Date(+midnight - 1);
    const future = new Date(+midnight + 2 * 86_400_000);
    for (const [id, date] of [["boundary", beforeMidnight], ["future", future]] as const) {
      await setupPool.query("INSERT INTO items (id, category, latitude, longitude, is_published) VALUES ($1, 'animal', 0, 0, false)", [`report-${id}`]);
      await setupPool.query("INSERT INTO profile_progress (id, profile_id, item_id, category, done_at) VALUES ($1, 'report-child', $2, 'animal', $3)", [`progress-${id}`, `report-${id}`, date]);
    }
    for (let index = 0; index < 3; index++) {
      await setupPool.query("INSERT INTO quiz_attempts (id, profile_id, item_id, attempt_date, score, total, answers, completed_at) VALUES ($1, 'report-child', $2, $3, $4, $5, '[]', $3)",
        [`report-quiz-${index}`, index === 0 ? null : "report-item-00", midnight, index === 0 ? 0 : 8, index === 0 ? 0 : 10]);
    }
    for (let index = 0; index < 2; index++) {
      await setupPool.query("INSERT INTO flashcard_study_sessions (id, profile_id, focus_item_id, theme_type, theme_value, lang, cards_shown, got_it_count, review_again_count, responses, started_at, completed_at) VALUES ($1, 'report-child', $2, 'category', 'animal', 'en', 3, 2, 1, '[]', $3, $3)",
        [`report-flash-${index}`, index === 0 ? null : "report-item-00", midnight]);
    }
    const reportProfile = await db.admin.profile!("report-family", "report-child");
    assert.equal(reportProfile?.total_done, 14);
    assert.equal(reportProfile?.quiz_attempt_count, 3);
    assert.equal(reportProfile?.flashcard_session_count, 2);
    assert.equal(reportProfile?.badge_count, 4);
    assert.equal(Object.hasOwn(reportProfile!, "password_hash"), false);
    assert.equal(await db.admin.profile!("family-target", "report-child"), null);
    const events = await db.admin.activities!("report-family", "report-child", { page: 1, page_size: 100, type: "all" });
    assert.equal(events.total, 19);
    assert.equal(events.activities.length, 19);
    assert.equal(events.activities.filter((event) => event.type === "completion").length, 14);
    assert.equal(events.activities.find((event) => event.type === "quiz" && event.item_id !== null)?.score, 8);
    assert.equal(events.activities.find((event) => event.type === "flashcard")?.got_it_count, 2);
    assert.equal(events.activities.find((event) => event.type === "completion" && event.item_id === "report-item-00")?.item_title, "Report title 0");
    assert.equal(events.activities.find((event) => event.item_id === "report-item-05")?.item_title, "Vietnamese");
    assert.ok(events.activities.every((event) => !Object.hasOwn(event, "answers") && !Object.hasOwn(event, "responses")));
    const firstPage = await db.admin.activities!("report-family", "report-child", { page: 1, page_size: 5, type: "all" });
    const secondPage = await db.admin.activities!("report-family", "report-child", { page: 2, page_size: 5, type: "all" });
    assert.equal(firstPage.total_pages, 4);
    assert.deepEqual([...firstPage.activities, ...secondPage.activities].map((event) => event.id), events.activities.slice(0, 10).map((event) => event.id));
    // A page boundary splits events with the same timestamp. This expected
    // ordering is independent of the query under test.
    assert.deepEqual([...firstPage.activities, ...secondPage.activities].map((event) => event.id), [
      "completion:progress-future", "quiz:report-quiz-2", "quiz:report-quiz-1", "quiz:report-quiz-0",
      "flashcard:report-flash-1", "flashcard:report-flash-0", "completion:progress-0",
      "completion:progress-boundary", "completion:progress-1", "completion:progress-2",
    ]);
    assert.equal((await db.admin.activities!("report-family", "report-child", { page: 1, page_size: 20, type: "quiz" })).total, 3);
    assert.equal((await db.admin.activities!("family-target", "report-child", { page: 1, page_size: 20, type: "all" })).total, 0);
    assert.deepEqual((await db.admin.activities!("report-family", "report-child", { page: 99, page_size: 20, type: "all" })).activities, []);
    for (const [period, count] of [["today", 1], ["yesterday", 2], ["last3days", 4], ["last7days", 8], ["all", 13]] as const) {
      const journey = await db.admin.journey!("report-family", "report-child", { period, page: 1, page_size: 100 });
      assert.equal(journey.total, count, period);
      assert.ok(journey.waypoints.every((point, index, points) => index === 0 || +new Date(point.done_at) >= +new Date(points[index - 1]!.done_at)));
      assert.equal(journey.waypoints.some((point) => point.item_id === "report-future"), false);
      if (period === "yesterday") {
        assert.deepEqual(journey.waypoints.map((point) => point.item_id), ["report-item-01", "report-boundary"]);
        assert.equal(+new Date(journey.waypoints[0]!.done_at), +midnight - 86_400_000);
        assert.equal(+new Date(journey.waypoints[1]!.done_at), +midnight - 1);
      }
    }
    const journeyPage = await db.admin.journey!("report-family", "report-child", { period: "all", page: 2, page_size: 5 });
    assert.equal(journeyPage.total_pages, 3);
    assert.equal(journeyPage.waypoints.length, 5);
    assert.equal(journeyPage.waypoints[0]?.item_id, "report-item-06");
    assert.equal((await db.admin.journey!("family-target", "report-child", { period: "all", page: 1, page_size: 100 })).total, 0);

    // UFO dictionary loading is additive, rounds are snapshots, and writes serialize by revision.
    const ufo = db.ufo!;
    const alreadyLoaded = (await ufo.list()).length;
    assert.equal(await ufo.loadMaster(), 480 - alreadyLoaded);
    const apple = (await ufo.list()).find(w => w.word === 'APPLE')!;
    await ufo.save({...apple, clue:'A new clue kept by the administrator.'}, apple.id);
    assert.equal(await ufo.loadMaster(), 0);
    assert.equal((await ufo.list()).find(w => w.id === apple.id)?.clue, 'A new clue kept by the administrator.');
    await assert.rejects(() => ufo.save({...apple}), /already exists/);
    const initial = await ufo.get('profile-integration');
    const started = await ufo.mutate('profile-integration', initial.revision, {settings:{difficulty:'hard',animal:'cow',background:'farm'}});
    const persisted = await ufo.get('profile-integration');
    assert.deepEqual(persisted, started);
    const results = await Promise.allSettled([
      ufo.mutate('profile-integration', started.revision, {action:{type:'hint'}}),
      ufo.mutate('profile-integration', started.revision, {action:{type:'hint'}}),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const rejected = results.find(r => r.status === 'rejected');
    assert.ok(rejected?.status === 'rejected' && rejected.reason.code === 'UFO_STALE_SESSION');
    const after = await ufo.get('profile-integration');
    assert.equal(after.session?.hints, 0);
    await assert.rejects(() => ufo.mutate('profile-integration',after.revision,{action:{type:'hint'}}), /No hints remain/);
    const stored = await setupPool.query<{state: import('../../src/ufo/game.js').Progress}>('SELECT state FROM ufo_progress WHERE profile_id=$1',['profile-integration']);
    const activeWord = stored.rows[0]!.state.session!.word;
    await ufo.remove(activeWord.id);
    assert.deepEqual(await ufo.get('profile-integration'), after);
    assert.equal(await ufo.loadMaster(), 1);
    assert.equal((await ufo.list()).length, 480);
    const renamed = (await ufo.list()).find(w => w.word === 'APPLE')!;
    await ufo.save({...renamed,word:'APPLEFRIEND'},renamed.id);
    assert.equal(await ufo.loadMaster(),1);
    assert.ok((await ufo.list()).some(w => w.word === 'APPLEFRIEND' && w.id === renamed.id));
    assert.ok((await ufo.list()).some(w => w.word === 'APPLE' && w.id !== renamed.id));
    assert.equal((await ufo.get('profile-target')).session, null);
    const viStarted = await ufo.mutate('profile-integration', (await ufo.get('profile-integration')).revision, { settings: { language: 'vi', difficulty: 'easy', animal: 'cow', background: 'farm' } });
    assert.equal(viStarted.session?.language, 'vi');
    const viStored = await setupPool.query<{state: import('../../src/ufo/game.js').Progress}>('SELECT state FROM ufo_progress WHERE profile_id=$1', ['profile-integration']);
    const viWord = viStored.rows[0]!.state.session!.word;
    assert.equal(viWord.language, 'vi');
    const { guessKey } = await import('../../src/ufo/letters.js');
    let viRound = viStarted;
    for (const letter of new Set([...viWord.word].filter(letter => letter !== ' ').map(guessKey))) viRound = await ufo.mutate('profile-integration', viRound.revision, { action: { type: 'guess', letter } });
    assert.equal(viRound.session?.status, 'solved');
    assert.equal(viRound.session?.answer, viWord.word);
    const { townReward: verifiedWordReward, ...savedWordState } = viRound as typeof viRound & { townReward?: { wood: number; wool: number } };
    assert.deepEqual(verifiedWordReward, { wood: 2, wool: 1 });
    assert.deepEqual(await ufo.get('profile-integration'), savedWordState);
    const savedFrame = await db.profiles.update('family-integration', 'profile-integration', { avatar_frame: 'car' });
    assert.equal(savedFrame?.avatar_frame, 'car');


    // Math sessions persist, reject stale writes, and reveal only explicit kid friends.
    const { INFINIDRILL_ACHIEVEMENT_GROUP } = await import('../../src/achievement-catalog.js');
    const drill = db.infinidrill!;
    let drillState = await drill.mutate('profile-integration', 0, { type: 'replay' });
    const secret = (await setupPool.query<{ state: import('../../src/infinidrill/progress.js').Progress }>('SELECT state FROM infinidrill_progress WHERE profile_id=$1', ['profile-integration'])).rows[0]!.state;
    const command = { type: 'submit-answer' as const, questionId: secret.game!.currentQuestion!.id, answer: Number(secret.game!.currentQuestion!.answer) };
    const race = await Promise.allSettled([drill.mutate('profile-integration', drillState.revision, command), drill.mutate('profile-integration', drillState.revision, command)]);
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
    drillState = await drill.get('profile-integration');
    assert.ok(drillState.achievements.find(a => a.id === 'infinidrill-first-drill')?.earnedAt);
    const beforeMigration = drillState;
    await Promise.all([db.achievements!.sync(INFINIDRILL_ACHIEVEMENT_GROUP), db.achievements!.sync(INFINIDRILL_ACHIEVEMENT_GROUP)]);
    assert.equal((await db.achievements!.list()).length, 10);
    assert.deepEqual(await drill.get('profile-integration'), beforeMigration);
    await drill.mutate('profile-integration', drillState.revision, { type: 'replay' });
    assert.equal((await drill.get('profile-integration')).achievements.find(a => a.id === 'infinidrill-first-drill')?.earnedAt, drillState.achievements.find(a => a.id === 'infinidrill-first-drill')?.earnedAt);

    const math = db.mathWall!;
    const mathInitial = await math.get('profile-integration');
    const mathStarted = await math.mutate('profile-integration', mathInitial.revision, { settings: { animal: 'capybara', language: 'vi', wall: 'garden' } });
    assert.deepEqual((await math.get('profile-integration')).session, mathStarted.session);
    const mathWrites = await Promise.allSettled([
      math.mutate('profile-integration', mathStarted.revision, { action: { type: 'lane', lane: 0 } }),
      math.mutate('profile-integration', mathStarted.revision, { action: { type: 'lane', lane: 2 } }),
    ]);
    assert.equal(mathWrites.filter(r => r.status === 'fulfilled').length, 1);
    const staleMath = mathWrites.find(r => r.status === 'rejected');
    assert.ok(staleMath?.status === 'rejected' && staleMath.reason.code === 'MATH_WALL_STALE_SESSION');
    const mathRow = await setupPool.query<{ state: import('../../src/math-wall/game.js').Progress }>('SELECT state FROM math_wall_progress WHERE profile_id=$1', ['profile-integration']);
    const mathProgress = mathRow.rows[0]!.state;
    assert.equal(mathProgress.session!.question.response.mode, 'choice');
    mathProgress.session!.lane = mathProgress.session!.question.response.correct;
    mathProgress.session!.deadline = Date.now() - 1;
    await setupPool.query('UPDATE math_wall_progress SET state=$2 WHERE profile_id=$1', ['profile-integration', JSON.stringify(mathProgress)]);
    const scored = await math.mutate('profile-integration', mathProgress.revision, { action: { type: 'settle' } });
    assert.equal(scored.best, 1);
    assert.ok(scored.achievements.some(a => a.id === 'first' && a.earned));
    assert.equal((await math.get('profile-integration')).best, 1);
    const ownFamily = (await setupPool.query<{ family_id: string }>('SELECT family_id FROM profiles WHERE id=$1', ['profile-integration'])).rows[0]!.family_id;
    const friendCases = [
      ['direct', 'accepted', 'profile', 'profile', false],
      ['reverse', 'accepted', 'profile', 'profile', true],
      ['pending', 'pending', 'profile', 'profile', false],
      ['rejected', 'rejected', 'profile', 'profile', false],
      ['family', 'accepted', 'family', 'family', false],
      ['mixed', 'accepted', 'profile', 'family', false],
    ] as const;
    for (const [name, status, requestingScope, targetScope, reverse] of friendCases) {
      const kid = `math-${name}`, familyId = `math-family-${name}`;
      await setupPool.query("INSERT INTO families (id,email,display_name,password_hash,role) VALUES ($1,$2,$3,'unused','family')", [familyId, `${name}@math.example.test`, name]);
      await setupPool.query("INSERT INTO profiles (id,family_id,name,emoji,color,public_id) VALUES ($1,$2,$3,'🐮','blue',$1)", [kid, familyId, name]);
      const fromKid = reverse ? kid : 'profile-integration', toKid = reverse ? 'profile-integration' : kid;
      await setupPool.query(`INSERT INTO friend_requests (id,requesting_family_id,requesting_scope,requesting_profile_id,requesting_label,
        target_family_id,target_scope,target_profile_id,target_label,target_code,requester_message,status)
        VALUES ($1,$2,$3,$4,'From',$5,$6,$7,'To','CODE','Friends',$8)`,
      [`math-request-${name}`, reverse ? familyId : ownFamily, requestingScope, requestingScope === 'profile' ? fromKid : null,
        reverse ? ownFamily : familyId, targetScope, targetScope === 'profile' ? toKid : null, status]);
    }
    const board = await math.leaderboard('profile-integration');
    assert.equal(board.length, 3);
    assert.deepEqual(board.filter(r => !r.self).map(r => r.name).sort(), ['direct', 'reverse']);
    assert.equal(board[0]!.score, 1);
    assert.equal(board[0]!.self, true);
    assert.deepEqual((await math.leaderboard('math-pending')).map(r => r.name), ['pending']);
    assert.deepEqual((await math.leaderboard('math-family')).map(r => r.name), ['family']);

    // Complete a real server recipe, then race duplicate serves under the row lock.
    const {createCabbageRollRepository} = await import('../../src/town-building/cabbage-rolls.js');
    let cabbageNow=Date.now();
    const cabbageRepo=createCabbageRollRepository(setupPool,()=>cabbageNow);
    let cabbageState=await cabbageRepo.get('report-child');
    const cabbageAct=async(command:import('../../src/town-building/cabbage-rolls.js').CabbageRollCommand,ms=0)=>{
      cabbageNow+=ms;cabbageState=await cabbageRepo.mutate('report-child',cabbageState.revision,command);
    };
    await cabbageAct({type:'start'});
    for(let ingredient=0;ingredient<4;ingredient++) {
      if(ingredient===3)await cabbageAct({type:'peel'});
      for(let cut=0;cut<3;cut++)await cabbageAct({type:'chop'});
      await cabbageAct({type:'next'});
    }
    for(const index of [0,1,2,3])await cabbageAct({type:'add',index});
    await cabbageAct({type:'next'});
    for(const value of ['Salt','Pepper','Soy sauce'] as const)await cabbageAct({type:'season',value});
    for(const type of ['next','mix','cover-bowl','refrigerate','leaf','cover-steamer'] as const)await cabbageAct({type});
    await cabbageAct({type:'heat',value:'medium'});await cabbageAct({type:'steam-start'});
    await cabbageAct({type:'lift'},8000);await cabbageAct({type:'retrieve-filling'});
    for(let roll=0;roll<3;roll++) {
      await cabbageAct({type:'portion',value:'medium'});
      for(const edge of ['bottom','left','right','close'] as const)await cabbageAct({type:'fold',edge});
    }
    await cabbageAct({type:'next'});
    for(let roll=0;roll<3;roll++)await cabbageAct({type:'arrange'});
    await cabbageAct({type:'sauce'});await cabbageAct({type:'cover-pot'});
    await cabbageAct({type:'heat',value:'medium'});await cabbageAct({type:'cook'});await cabbageAct({type:'stop'},8000);
    assert.equal(cabbageState.achievements!.completed,0);
    const serves=await Promise.allSettled([cabbageRepo.mutate('report-child',cabbageState.revision,{type:'serve'}),cabbageRepo.mutate('report-child',cabbageState.revision,{type:'serve'})]);
    assert.equal(serves.filter(result=>result.status==='fulfilled').length,1);
    cabbageState=await createCabbageRollRepository(setupPool).get('report-child');
    assert.equal(cabbageState.achievements!.completed,1);assert.equal(cabbageState.achievements!.perfect,1);
    assert.equal(Object.keys(cabbageState.achievements!.earned).length,2);
    const receipt=await setupPool.query('SELECT count(*)::int AS total FROM town_reward_events WHERE profile_id=$1 AND event_id=$2',['report-child',`cabbage-roll:${cabbageState.sessionId}`]);
    assert.equal(receipt.rows[0].total,1);
    const {CABBAGE_ROLLS_ACHIEVEMENT_GROUP}=await import('../../src/achievement-catalog.js');
    await db.achievements!.sync(CABBAGE_ROLLS_ACHIEVEMENT_GROUP);await db.achievements!.sync(CABBAGE_ROLLS_ACHIEVEMENT_GROUP);
    assert.deepEqual((await cabbageRepo.get('report-child')).achievements,cabbageState.achievements);
    const reportCabbage=(await db.parentReports!.read('report-family')).children.find(c=>c.id==='report-child')!.games.find(g=>g.id==='cabbage-rolls')!;
    assert.equal(reportCabbage.earning,'server-verified');
    assert.deepEqual(reportCabbage.achievements.map(b=>b.earned),[true,false,false,true]);
    assert.deepEqual(reportCabbage.achievements.map(b=>b.current),[1,0,0,1]);
    assert.equal((await db.parentReports!.read('family-target')).children.some(c=>c.id==='report-child'),false);
    await cabbageAct({type:'replay'});assert.equal(cabbageState.achievements!.completed,1);

    assert.equal(await db.items.deleteAdmin("item-api-created"), true);
    assert.equal(await db.items.getAdmin("item-api-created"), null);
    assert.equal(await db.items.deleteAdmin("item-api-created"), false);
  } finally {
    await db.close?.();
    await setupPool.end();
  }
});
