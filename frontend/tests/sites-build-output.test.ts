import assert from "node:assert/strict";
import test from "node:test";

import {
  createViteConfig,
  DEFAULT_LOCAL_API_ORIGIN,
  SITES_RUN_WORKER_FIRST,
  VERCEL_OUTPUT_DIRECTORY,
} from "../vite.config.ts";

function collectPluginNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectPluginNames);
  }

  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? [name] : [];
  }

  return [];
}

test("the Vercel target is a client-only build without transitional hosting plugins", async () => {
  const config = await createViteConfig({
    command: "build",
    mode: "vercel",
    isPreview: false,
    isSsrBuild: false,
  });
  const pluginNames = collectPluginNames(config.plugins);

  assert.equal(config.build?.outDir, VERCEL_OUTPUT_DIRECTORY);
  assert.equal(pluginNames.some((name) => name.startsWith("vite:react")), true);
  assert.equal(pluginNames.includes("cesium-copy"), true);
  assert.equal(pluginNames.some((name) => /cloudflare|openai|sites/i.test(name)), false);
});

test("Vercel development proxies same-origin API and media requests to the local Render server", async () => {
  const config = await createViteConfig({
    command: "serve",
    mode: "vercel",
    isPreview: false,
    isSsrBuild: false,
  });

  const proxy = config.server?.proxy as Record<string, { target?: string; changeOrigin?: boolean }>;
  assert.deepEqual(Object.keys(proxy).sort(), ["/api", "/media"]);
  assert.equal(proxy["/api"]?.target, DEFAULT_LOCAL_API_ORIGIN);
  assert.equal(proxy["/media"]?.target, DEFAULT_LOCAL_API_ORIGIN);
  assert.equal(proxy["/api"]?.changeOrigin, false);
  assert.equal(proxy["/media"]?.changeOrigin, false);
});

test("the transitional Sites target keeps API and media routes ahead of SPA fallback", () => {
  assert.deepEqual(SITES_RUN_WORKER_FIRST, [
    "/api/*",
    "/media/*",
  ]);
});
