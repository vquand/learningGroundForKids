import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Vercel config builds the static client and proxies Render routes", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ) as {
    $schema?: string;
    buildCommand?: string;
    outputDirectory?: string;
    routes?: Array<{
      src?: string;
      dest?: string;
      env?: string[];
      headers?: Record<string, string>;
      respectOriginCacheControl?: boolean;
      handle?: string;
      continue?: boolean;
    }>;
  };

  assert.equal(config.$schema, "https://openapi.vercel.sh/vercel.json");
  assert.deepEqual(Object.keys(config).sort(), [
    "$schema",
    "buildCommand",
    "outputDirectory",
    "routes",
  ].sort());
  assert.equal(config.buildCommand, "npm run build -- --mode vercel");
  assert.equal(config.outputDirectory, "dist/client");
  // Security headers apply to every response and fall through to the later routes.
  const security = config.routes?.at(0);
  assert.equal(security?.src, '/(.*)');
  assert.equal(security?.continue, true);
  const csp = security?.headers?.['Content-Security-Policy'] ?? '';
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "connect-src 'self' data: blob:"]) {
    assert.ok(csp.split('; ').includes(directive), `CSP is missing ${directive}`);
  }
  const scriptSrc = csp.split('; ').find((part) => part.startsWith('script-src ')) ?? '';
  // Cesium's bundled Emscripten glue (the 3D journey globe) calls new Function(), so 'unsafe-eval' is
  // required until that decoder is replaced. Inline scripts, remote hosts and wildcards stay forbidden.
  assert.ok(scriptSrc.includes("'unsafe-eval'"), 'the Cesium globe needs unsafe-eval');
  assert.ok(!/'unsafe-inline'|https?:|\*/.test(scriptSrc), 'script-src must stay strict apart from the Cesium eval');
  assert.equal(security?.headers?.['X-Frame-Options'], 'DENY');
  assert.equal(security?.headers?.['X-Content-Type-Options'], 'nosniff');
  assert.match(security?.headers?.['Strict-Transport-Security'] ?? '', /max-age=\d{7,}/);
  assert.ok(security?.headers?.['Referrer-Policy']);
  assert.ok(security?.headers?.['Permissions-Policy']);
  assert.equal(config.routes?.at(1)?.src, '/api/artwork');
  assert.equal(config.routes?.at(1)?.dest, '/api/artwork');
  assert.equal(config.routes?.at(1)?.headers?.['Vercel-CDN-Cache-Control'], 'no-store');
  assert.deepEqual(config.routes?.slice(2, 4), [
    {
      src: "/api/(.*)",
      dest: "${RENDER_API_ORIGIN}/api/$1",
      env: ["RENDER_API_ORIGIN"],
      respectOriginCacheControl: false,
      headers: {
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    },
    {
      src: "/media/(.*)",
      dest: "${RENDER_API_ORIGIN}/media/$1",
      env: ["RENDER_API_ORIGIN"],
    },
  ]);
  assert.deepEqual(config.routes?.at(4), { handle: "filesystem" });
  const artwork = config.routes?.at(5);
  assert.equal(artwork?.dest, '/api/artwork?path=$1');
  assert.equal(artwork?.headers?.['Vercel-CDN-Cache-Control'], 'no-store');
  assert.equal(artwork?.headers?.['Cache-Control'], 'private, no-cache');
  assert.ok(new RegExp(artwork!.src!).test('/minigames/town-building/buildings-minimal-v2.png'));
  assert.ok(!new RegExp(artwork!.src!).test('/media/profile-avatars/private.png'));
  assert.deepEqual(config.routes?.at(-1), {
    src: "/(.*)",
    dest: "/index.html",
  });
});
