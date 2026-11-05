import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { saveRootCredential } from "../../src/db/root-credential-file.js";

test("root credential file is private, exclusive, and outside the checkout", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plg-root-credential-test-"));
  const path = join(directory, "initial-password.txt");
  try {
    await saveRootCredential(path, "generated test password only");
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.equal(await readFile(path, "utf8"), "generated test password only\n");
    await assert.rejects(() => saveRootCredential(path, "replacement"));
    assert.equal(await readFile(path, "utf8"), "generated test password only\n");
    await assert.rejects(() => saveRootCredential("relative.txt", "replacement"), /absolute path/);
    await assert.rejects(() => saveRootCredential(new URL("../../should-not-exist.txt", import.meta.url).pathname, "replacement"), /outside the repository/);
    const target = join(directory, "target.txt");
    await writeFile(target, "unchanged");
    const link = join(directory, "symlink.txt");
    await symlink(target, link);
    await assert.rejects(() => saveRootCredential(link, "replacement"));
    assert.equal(await readFile(target, "utf8"), "unchanged");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
