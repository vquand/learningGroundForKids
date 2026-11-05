import assert from "node:assert/strict";
import test from "node:test";
import type { MinimalPluginContextWithoutEnvironment, Plugin } from "vite";
import { createAppTitlePlugin, createViteConfig } from "../vite.config.ts";

const HTML = "<html><head><title>Personal Learning Ground</title></head></html>";

async function transformedTitle(appName?: string): Promise<string> {
  const plugin = createAppTitlePlugin(appName);
  const result = await applyTitleTransform(plugin);
  const title = result.match(/<title>([^<]*)<\/title>/)?.[1];
  assert.ok(title, "the transformed document should contain a title");
  return title;
}

async function applyTitleTransform(plugin: Plugin): Promise<string> {
  const transform = plugin.transformIndexHtml;
  assert.ok(transform, "the app-title plugin should transform index.html");
  const handler = typeof transform === "function" ? transform : transform.handler;
  const result = await handler.call(
    {} as MinimalPluginContextWithoutEnvironment,
    HTML,
    { path: "/", filename: "index.html" },
  );
  if (typeof result !== "string") {
    throw new Error("the app-title plugin should return transformed HTML");
  }
  return result;
}

function isAppTitlePlugin(candidate: unknown): candidate is Plugin {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    !Array.isArray(candidate) &&
    "name" in candidate &&
    candidate.name === "app-title"
  );
}

function findAppTitlePlugin(config: Awaited<ReturnType<typeof createViteConfig>>): Plugin {
  const plugin = config.plugins?.find(isAppTitlePlugin);
  assert.ok(plugin, "Vercel config includes app-title");
  return plugin;
}

async function configuredTitle(appName: string | undefined): Promise<string> {
  const previous = process.env.APP_NAME;
  process.env.APP_NAME = appName ?? '';

  try {
    const config = await createViteConfig({ command: "build", mode: "vercel" });
    return await applyTitleTransform(findAppTitlePlugin(config));
  } finally {
    if (previous === undefined) delete process.env.APP_NAME;
    else process.env.APP_NAME = previous;
  }
}

test("app title falls back to Playing Ground when APP_NAME is missing", async () => {
  assert.equal(await transformedTitle(), "Playing Ground");
});

test("app title falls back to Playing Ground for empty and whitespace values", async () => {
  assert.equal(await transformedTitle(""), "Playing Ground");
  assert.equal(await transformedTitle("   \t\n"), "Playing Ground");
});

test("app title trims a configured custom value", async () => {
  assert.equal(await transformedTitle("  Study Garden  "), "Study Garden");
});

test("app title HTML-escapes special characters", async () => {
  assert.equal(
    await transformedTitle("A & <B> \"C'"),
    "A &amp; &lt;B&gt; &quot;C&#39;",
  );
});

test("app title treats replacement tokens as literal text", async () => {
  assert.equal(await transformedTitle("Price $& now"), "Price $&amp; now");
});

test("Vercel config uses the app title plugin for the build", async () => {
  const result = await configuredTitle(undefined);
  assert.match(result, /<title>Playing Ground<\/title>/);
});

test("Vercel config passes the APP_NAME environment override to the title plugin", async () => {
  assert.match(await configuredTitle("  Env Garden  "), /<title>Env Garden<\/title>/);
});
