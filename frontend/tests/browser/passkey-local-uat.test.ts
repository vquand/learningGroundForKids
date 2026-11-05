import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";
import type { Browser, BrowserContext, Page, Response as PlaywrightResponse } from "playwright";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLG_PLAYWRIGHT_MODULE || "playwright");

const ORIGIN = "http://localhost:5175";
const FIXTURE = "/tmp/plg-passkey-fixture.json";
const API_ORIGIN = "http://127.0.0.1:10001";

async function waitFor(url: string, predicate: (response: Response) => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError = "not reached";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (predicate(response)) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready (${lastError})`);
}

function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  child.kill("SIGTERM");
  return new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 5_000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  });
}

async function startIsolatedServers(): Promise<() => Promise<void>> {
  const serverRoot = path.resolve(process.cwd(), "../server");
  const children: ChildProcess[] = [];
  const diagnostics: string[] = [];
  const capture = (name: string, child: ChildProcess) => {
    child.stderr?.on("data", (chunk: Buffer) => {
      const message = chunk.toString().trim();
      if (message) diagnostics.push(`${name}: ${message.slice(0, 2000)}`);
    });
  };
  const api = spawn(process.execPath, ["--env-file=.env_dev", "--import", "./scripts/local-db-guard.mjs", "--import", "tsx", "src/index.ts"], {
    cwd: serverRoot,
    env: {
      ...process.env,
      PORT: "10001",
      SERVER_HOST: "127.0.0.1",
      ALLOWED_ORIGINS: ORIGIN,
      ALLOWED_FORWARDED_HOSTS: "localhost,127.0.0.1",
      WEB_AUTHN_RP_ID: "localhost",
      WEB_AUTHN_ORIGIN: ORIGIN,
      AUTH_RATE_LIMIT_MAX: "100",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  children.push(api); capture("api", api);
  try {
    const viteBin = path.resolve(process.cwd(), "node_modules/vite/bin/vite.js");
    const vite = spawn(process.execPath, [viteBin, "--mode", "vercel", "--host", "localhost", "--port", "5175", "--strictPort"], {
      cwd: process.cwd(),
      env: { ...process.env, LOCAL_API_ORIGIN: API_ORIGIN },
      stdio: ["ignore", "ignore", "pipe"],
    });
    children.push(vite); capture("vite", vite);
    await waitFor(`${API_ORIGIN}/api/v1/health/ready`, (response) => response.status === 200, "isolated API");
    await waitFor(`${ORIGIN}/`, (response) => response.status === 200, "isolated Vite server");
  } catch (error) {
    await Promise.all(children.map(stopChild));
    const detail = diagnostics.length ? `\n${diagnostics.join("\n")}` : "";
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail}`);
  }
  return async () => { await Promise.all(children.map(stopChild)); };
}

test("local family passkey enrollment, login, and password fallback", { timeout: 120_000 }, async () => {
  let fixture: { email: string; password: string };
  try { fixture = JSON.parse(await readFile(FIXTURE, "utf8")) as { email: string; password: string }; }
  catch (error) { throw new Error(`Passkey fixture unavailable at ${FIXTURE}: ${error instanceof Error ? error.message : String(error)}`); }
  const stopServers = await startIsolatedServers();
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const responses: Array<{ path: string; status: number }> = [];
  const errors: string[] = [];
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    });
    context = await browser!.newContext({ baseURL: ORIGIN });
    page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on("response", (response: PlaywrightResponse) => {
      const url = new URL(response.url());
      if (url.origin === ORIGIN && url.pathname.startsWith("/api/")) responses.push({ path: url.pathname, status: response.status() });
    });
    page.on("pageerror", (error: Error) => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    const preAuthParentAccess = await page.request.get("/api/v1/parent/access");
    assert.ok([401, 403].includes(preAuthParentAccess.status()), `parent access must be denied before login (observed HTTP ${preAuthParentAccess.status()})`);
    await page.goto("/parent");
    await page.getByRole("heading", { name: "Welcome back, explorer!" }).waitFor();
    assert.ok(responses.some((r) => r.path === "/api/v1/auth/session" && r.status === 200), "session probe should complete");

    await page.getByLabel("Email", { exact: true }).fill(fixture.email);
    await page.getByLabel("Password", { exact: true }).fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).waitFor();
    assert.ok(responses.some((r) => r.path === "/api/v1/auth/login" && r.status === 200), "password login should return 200");

    await page.goto("/parent");
    await page.getByRole("heading", { name: "Enter Parent Space" }).waitFor();
    const initialPasswordToggle = page.getByRole("button", { name: "Use password instead", exact: true });
    if (await initialPasswordToggle.count()) await initialPasswordToggle.click();
    await page.getByLabel("Family password", { exact: true }).fill(fixture.password);
    await page.getByRole("button", { name: "Enter Parent Space", exact: true }).click();
    await page.getByRole("heading", { name: "Family dashboard", exact: true }).waitFor();
    assert.ok(responses.some((r) => r.path === "/api/v1/parent/access/password" && r.status === 200), "parent password elevation should succeed");

    await page.getByRole("button", { name: "Lock parent space", exact: true }).click();
    await page.getByRole("heading", { name: "Enter Parent Space", exact: true }).waitFor();
    assert.ok(responses.some((r) => r.path === "/api/v1/parent/access/lock" && r.status === 204), "manual parent lock should revoke the capability");

    const relockPasswordToggle = page.getByRole("button", { name: "Use password instead", exact: true });
    if (await relockPasswordToggle.count()) await relockPasswordToggle.click();
    await page.getByLabel("Family password", { exact: true }).fill(fixture.password);
    await page.getByRole("button", { name: "Enter Parent Space", exact: true }).click();
    await page.getByRole("heading", { name: "Family dashboard", exact: true }).waitFor();

    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "Parent sign-in" }).waitFor();
    await page.getByRole("button", { name: "Add passkey", exact: true }).click();
    await page.getByText("Passkey added. It will be offered first on this device.", { exact: true }).waitFor();
    assert.ok(responses.some((r) => r.path === "/api/v1/parent/passkeys/options" && r.status === 200), "registration options should be served");
    assert.ok(responses.some((r) => r.path === "/api/v1/parent/passkeys/verify" && r.status === 201), "real WebAuthn registration should verify");

    await page.goto("/");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.goto("/login");
    await page.getByRole("heading", { name: "Welcome back, explorer!" }).waitFor();
    await page.getByRole("button", { name: "Sign in with passkey", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).waitFor();
    assert.ok(responses.some((r) => r.path === "/api/v1/auth/passkey/options" && r.status === 200), "passkey login options should be served");
    assert.ok(responses.some((r) => r.path === "/api/v1/auth/passkey/verify" && r.status === 200), "real WebAuthn login should verify");

    await page.goto("/parent");
    await page.getByRole("heading", { name: "Enter Parent Space", exact: true }).waitFor();
    await page.getByRole("button", { name: "Continue with passkey", exact: true }).click();
    await page.getByRole("heading", { name: "Family dashboard", exact: true }).waitFor();
    assert.ok(responses.some((r) => r.path === "/api/v1/parent/access/passkey/verify" && r.status === 200), "parent passkey elevation should succeed separately");

    await page.getByRole("button", { name: "Lock parent space", exact: true }).click();
    await page.getByRole("heading", { name: "Enter Parent Space", exact: true }).waitFor();
    await page.goto("/");
    await page.getByRole("button", { name: "Sign out", exact: true }).waitFor();

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.goto("/login");
    await page.getByRole("heading", { name: "Welcome back, explorer!" }).waitFor();
    await page.getByRole("button", { name: "Use password instead", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(fixture.email);
    await page.getByLabel("Password", { exact: true }).fill(fixture.password);
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await page.getByRole("button", { name: "Sign out", exact: true }).waitFor();
    assert.ok(responses.filter((r) => r.path === "/api/v1/auth/login" && r.status === 200).length >= 2, "password fallback should remain available");
    assert.deepEqual(errors, []);
  } finally {
    if (page) await page.screenshot({ path: "/tmp/plg-passkey-local-uat.png" }).catch(() => undefined);
    try {
      await context?.close();
    } finally {
      try {
        await browser?.close();
      } finally {
        await stopServers();
      }
    }
  }
});
