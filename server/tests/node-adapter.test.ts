import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { AppDatabase } from "../src/contracts/db.js";

test("Node adapter supplies distinct socket addresses to the authentication limiter", async () => {
  const config = loadConfig({
    NODE_ENV: "test", DATABASE_URL: "postgresql://unused:unused@localhost/unused",
    AUTH_RATE_LIMIT_MAX: "1", ALLOWED_FORWARDED_HOSTS: "127.0.0.1",
  });
  const app = createApp({
    config,
    db: { auth: { async findFamilyByEmail() { return null; } } } as unknown as AppDatabase,
    clientAddress: (context) => getConnInfo(context).remote.address,
    logger: { info() {}, warn() {}, error() {} },
  });
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  if (!server.listening) await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const attempt = (localAddress: string, forwarded: string) => new Promise<number>((resolve, reject) => {
      const req = request({
        hostname: "127.0.0.1", port: address.port, localAddress, method: "POST",
        path: "/api/v1/auth/login",
        headers: { "content-type": "application/json", "x-forwarded-for": forwarded, connection: "close" },
      }, (res) => { res.resume(); res.once("end", () => resolve(res.statusCode!)); });
      req.on("error", reject);
      req.end(JSON.stringify({ email: "parent@example.test", password: "wrong password" }));
    });
    assert.equal(await attempt("127.0.0.2", "203.0.113.1"), 401);
    assert.equal(await attempt("127.0.0.2", "203.0.113.2"), 429);
    assert.equal(await attempt("127.0.0.3", "203.0.113.1"), 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
