import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const checker = join(root, "scripts/check-generated-artifacts.sh");

const check = (paths) => spawnSync("bash", [checker], { input: paths.join("\n"), encoding: "utf8" });

test("normal source, docs and production assets are allowed", () => {
  const result = check(["frontend/src/App.tsx", "docs/plans/x.md", "frontend/public/a.webp", "server/src/app.ts"]);
  assert.equal(result.status, 0, result.stderr);
});

test("generated evidence and the local output folder are blocked", () => {
  for (const path of [
    "output/animal-interactions/swim/measurements.json",
    "frontend/test-results/a/trace.zip",
    "frontend/playwright-report/index.html",
    "frontend/docs-explore-spider-debug.log",
    "docs/evidence/run.json",
    "docs/performance/bench.json",
    "frontend/coverage/lcov.info",
    "frontend/.test-tmp/x",
    "tests/run.trace.zip",
    "demo/recording.webm",
    "screenshots/home.png",
  ]) {
    const result = check([path]);
    assert.equal(result.status, 1, path);
    assert.match(result.stderr, /must stay local/);
  }
});

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
}

test("pre-push blocks artifacts that arrive through a merge, and pre-commit blocks direct commits", () => {
  const dir = mkdtempSync(join(tmpdir(), "plg-hooks-"));
  const bare = join(dir, "remote.git");
  const work = join(dir, "work");
  git(dir, "init", "-q", "--bare", "-b", "main", bare);
  git(dir, "clone", "-q", bare, work);
  mkdirSync(join(work, "scripts"), { recursive: true });
  cpSync(checker, join(work, "scripts/check-generated-artifacts.sh"));
  cpSync(join(root, ".githooks"), join(work, ".githooks"), { recursive: true });
  git(work, "config", "core.hooksPath", ".githooks");
  writeFileSync(join(work, "README.md"), "hi\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "init", "--no-verify");
  git(work, "push", "-q", "origin", "HEAD:main", "--no-verify");

  // A side branch carries artifacts (committed without the hook), then is merged.
  git(work, "checkout", "-q", "-b", "side");
  mkdirSync(join(work, "output/art"), { recursive: true });
  writeFileSync(join(work, "output/art/m.json"), "{}\n");
  git(work, "add", "-f", "-A");
  git(work, "commit", "-q", "-m", "side", "--no-verify");
  git(work, "checkout", "-q", "-b", "feature", "main");
  writeFileSync(join(work, "feature.txt"), "f\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "feature");
  git(work, "merge", "-q", "--no-ff", "--no-verify", "-m", "merge side", "side");
  const push = spawnSync("git", ["push", "origin", "feature"], { cwd: work, encoding: "utf8" });
  assert.notEqual(push.status, 0, "push with merged-in artifacts must fail");
  assert.match(push.stderr, /output\/art\/m\.json/);

  // Direct commit of an artifact is blocked by pre-commit.
  git(work, "checkout", "-q", "-b", "direct", "main");
  mkdirSync(join(work, "test-results"), { recursive: true });
  writeFileSync(join(work, "test-results/r.json"), "{}\n");
  git(work, "add", "-f", "-A");
  const commit = spawnSync("git", ["commit", "-m", "x"], { cwd: work, encoding: "utf8" });
  assert.notEqual(commit.status, 0);
  assert.match(commit.stderr, /test-results\/r\.json/);

  // A clean change still pushes (drop the blocked, still-staged artifact first).
  git(work, "reset", "-q");
  git(work, "clean", "-fdxq", "test-results");
  git(work, "checkout", "-q", "-b", "clean", "main");
  writeFileSync(join(work, "ok.txt"), "ok\n");
  git(work, "add", "ok.txt");
  git(work, "commit", "-q", "-m", "ok");
  const ok = spawnSync("git", ["push", "origin", "clean"], { cwd: work, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
});

function pushHook(cwd, localSha, remoteSha) {
  return spawnSync("bash", [join(cwd, ".githooks/pre-push")], {
    cwd,
    input: `refs/heads/x ${localSha} refs/heads/x ${remoteSha}\n`,
    encoding: "utf8",
  });
}

function makeRepo(branch) {
  const dir = mkdtempSync(join(tmpdir(), "plg-hooks-"));
  git(dir, "init", "-q", "-b", branch);
  mkdirSync(join(dir, "scripts"), { recursive: true });
  cpSync(checker, join(dir, "scripts/check-generated-artifacts.sh"));
  cpSync(join(root, ".githooks"), join(dir, ".githooks"), { recursive: true });
  writeFileSync(join(dir, "README.md"), "hi\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init", "--no-verify");
  return dir;
}

test("pre-push catches artifacts that were added and deleted again inside the same push", () => {
  const dir = makeRepo("main");
  const base = git(dir, "rev-parse", "HEAD").trim();
  mkdirSync(join(dir, "output"), { recursive: true });
  writeFileSync(join(dir, "output/m.json"), "{}\n");
  git(dir, "add", "-f", "-A");
  git(dir, "commit", "-q", "-m", "add", "--no-verify");
  git(dir, "rm", "-q", "-r", "output");
  git(dir, "commit", "-q", "-m", "remove", "--no-verify");
  const result = pushHook(dir, git(dir, "rev-parse", "HEAD").trim(), base);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /output\/m\.json/);
});

test("pre-push rejects instead of allowing when it cannot determine what the push adds", () => {
  const dir = makeRepo("dev"); // no main/origin/main to fall back on
  const result = pushHook(dir, git(dir, "rev-parse", "HEAD").trim(), "1234567890123456789012345678901234567890");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot determine what this push adds/);
});
