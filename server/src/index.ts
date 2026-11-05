import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createMediaStorage } from "./media.js";
import { createDatabase } from "./db/index.js";

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const media = createMediaStorage(config.s3);
const app = createApp({
  config,
  db,
  clientAddress: (context) => getConnInfo(context).remote.address,
  ...(media ? { media } : {}),
});

const server = serve({
  fetch: app.fetch,
  hostname: process.env.SERVER_HOST ?? "0.0.0.0",
  port: config.port,
});

process.on("SIGINT", () => {
  server.close();
});

process.on("SIGTERM", () => {
  server.close((error) => {
    if (error) process.exitCode = 1;
    process.exit();
  });
});
