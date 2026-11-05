import argon2 from "argon2";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";

import { createDatabase } from "../src/db/index.js";
import { requireUnpooledDatabaseUrl } from "../src/db/migration-url.js";

const fixturePath = "/tmp/plg-passkey-fixture.json";

interface Fixture {
  email: string;
  password: string;
  familyId: string;
  profileId: string | null;
}

function assertFixture(value: unknown): asserts value is Fixture {
  if (!value || typeof value !== "object") throw new Error("Existing fixture is invalid.");
  const fixture = value as Partial<Fixture>;
  if (typeof fixture.email !== "string" || typeof fixture.password !== "string"
    || typeof fixture.familyId !== "string"
    || (fixture.profileId !== null && typeof fixture.profileId !== "string")) {
    throw new Error("Existing fixture is invalid.");
  }
}

async function saveFixture(fixture: Fixture): Promise<void> {
  await writeFile(fixturePath, `${JSON.stringify(fixture)}\n`, { mode: 0o600 });
  await chmod(fixturePath, 0o600);
}

async function verifyExisting(db: ReturnType<typeof createDatabase>, fixture: Fixture): Promise<void> {
  const family = await db.auth.findFamilyById(fixture.familyId);
  if (!family || family.email !== fixture.email || family.role !== "family"
    || !(await argon2.verify(family.passwordHash, fixture.password))) {
    throw new Error("Existing fixture does not match the local family account; refusing to overwrite.");
  }
  if (!fixture.profileId) throw new Error("Existing fixture is incomplete; refusing to overwrite.");
  const profile = await db.profiles.get(fixture.familyId, fixture.profileId);
  if (!profile) throw new Error("Existing fixture profile was not found; refusing to overwrite.");
  process.stdout.write("fixture-reused\n");
}

async function main(): Promise<void> {
  const db = createDatabase(requireUnpooledDatabaseUrl(process.env));
  try {
    try {
      const existing = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
      assertFixture(existing);
      await verifyExisting(db, existing);
      return;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
        // No prior artifact: create the isolated fixture below.
      } else {
        throw error;
      }
    }

    const email = `passkey-${randomBytes(8).toString("hex")}@example.test`;
    const password = randomBytes(36).toString("base64url");
    const familyId = randomUUID();
    const fixture: Fixture = { email, password, familyId, profileId: null };
    await saveFixture(fixture);

    const family = await db.auth.createFamily({
      id: familyId,
      email,
      displayName: "Passkey UAT Family",
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: "family",
    });
    const profile = await db.profiles.create(family.id, {
      name: "Passkey Child",
      emoji: "🦊",
      color: "#2563eb",
      avatar_type: "emoji",
    });
    await saveFixture({ ...fixture, profileId: profile.id });
    process.stdout.write("fixture-created\n");
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Fixture creation failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
