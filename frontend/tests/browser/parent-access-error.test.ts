import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const { chromium } = createRequire(import.meta.url)(process.env.PLG_PLAYWRIGHT_MODULE || "playwright");
let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin = "";

before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react()],
    root: fileURLToPath(new URL("../../", import.meta.url)),
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}),
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function pageFor(scenario: "permission" | "transient" | "admin", permissionStatus = 403) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.setDefaultTimeout(5_000);
  page.on("pageerror", (error: Error) => console.error("parent-access pageerror:", error.message));
  page.on("console", (message: any) => { if (message.type() === "error") console.error("parent-access console:", message.text()); });
  let statusReads = 0;
  let passwordPosts = 0;
  await page.route("**/api/v1/parent/access", async (route: any) => {
    statusReads += 1;
    if (scenario === "permission") {
      await route.fulfill({ status: permissionStatus, json: { error: { code: "FAMILY_REQUIRED", message: "A family account is required." } } });
      return;
    }
    if (scenario === "transient" && statusReads === 1) {
      await route.fulfill({ status: 500, json: { error: { code: "DATABASE_UNAVAILABLE", message: "The learning service is unavailable." } } });
      return;
    }
    await route.fulfill({ status: 200, json: {
      elevated: false,
      method: null,
      expires_at: null,
      passkeys_enabled: scenario !== "admin",
      passkeys_enrolled: scenario !== "admin",
    } });
  });
  await page.route("**/api/v1/parent/access/password", async (route: any) => {
    passwordPosts += 1;
    await route.fulfill({ status: 200, json: { elevated: true, method: "password", expires_at: new Date(Date.now() + 60_000).toISOString() } });
  });
  await page.goto(`${origin}/tests/browser/parent-access-error-harness.html?scenario=${scenario}`, { waitUntil: "domcontentloaded", timeout: 10_000 });
  return { page, reads: () => statusReads, passwordPosts: () => passwordPosts };
}

for (const permissionStatus of [400, 403]) {
  test(`parent permission HTTP ${permissionStatus} surfaces API error without granting children`, async () => {
    const { page, passwordPosts } = await pageFor("permission", permissionStatus);
    try {
      const alert = page.getByRole("alert");
      await alert.waitFor();
      assert.match(await alert.innerText(), /family account is required/i);
      assert.equal(await page.getByRole("textbox", { name: /password/i }).count(), 0);
      assert.equal(await page.getByTestId("parent-children").count(), 0);
      assert.equal(passwordPosts(), 0);
      assert.equal(await page.getByRole("button", { name: "Retry", exact: true }).count(), 1);
      assert.equal(await page.getByRole("link", { name: "Back to members", exact: true }).count(), 1);
    } finally {
      await page.close();
    }
  });
}

test("admin own-family status still requires password elevation before children", async () => {
  const { page, passwordPosts } = await pageFor("admin");
  try {
    await page.getByRole("heading", { name: "Enter Parent Space", exact: true }).waitFor();
    await page.getByLabel("Family password", { exact: true }).waitFor();
    assert.equal(await page.getByTestId("parent-children").count(), 0);
    await page.getByLabel("Family password", { exact: true }).fill("password");
    await page.getByRole("button", { name: "Enter Parent Space", exact: true }).click();
    await page.getByTestId("parent-children").waitFor();
    assert.equal(passwordPosts(), 1);
  } finally {
    await page.close();
  }
});

test("transient parent status errors retry in place and preserve password elevation", async () => {
  const { page, reads, passwordPosts } = await pageFor("transient");
  try {
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("button", { name: "Retry", exact: true }).count(), 1);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByRole("button", { name: "Use password instead", exact: true }).click();
    await page.getByLabel("Family password", { exact: true }).waitFor();
    assert.equal(reads(), 2);
    assert.equal(await page.getByLabel("Family password", { exact: true }).isDisabled(), false);
    await page.getByLabel("Family password", { exact: true }).fill("password");
    await page.getByRole("button", { name: "Enter Parent Space", exact: true }).click();
    await page.getByTestId("parent-children").waitFor();
    assert.equal(passwordPosts(), 1);
  } finally {
    await page.close();
  }
});
