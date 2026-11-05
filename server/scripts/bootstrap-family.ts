import argon2 from "argon2";
import { randomUUID } from "node:crypto";

import { bootstrapFamily, readBootstrapCredentials } from "../src/db/bootstrap.js";
import { createDatabase } from "../src/db/index.js";
import { requireUnpooledDatabaseUrl } from "../src/db/migration-url.js";

async function readPasswordFromStdin(): Promise<string> {
  if (process.env.BOOTSTRAP_PASSWORD !== undefined) return "";
  if (process.stdin.isTTY) {
    throw new Error("Provide the password through BOOTSTRAP_PASSWORD or pipe it on stdin.");
  }
  process.stdin.setEncoding("utf8");
  let value = "";
  for await (const chunk of process.stdin) value += chunk;
  return value;
}

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error("Bootstrap credentials must be supplied through environment variables or stdin, not command-line arguments.");
  }
  const credentials = readBootstrapCredentials(process.env, await readPasswordFromStdin());
  const db = createDatabase(requireUnpooledDatabaseUrl(process.env));
  const family = await bootstrapFamily(db, credentials, {
    id: randomUUID,
    hash: (password) => argon2.hash(password, { type: argon2.argon2id }),
  });
  process.stdout.write(`Created bootstrap admin for ${family.email}.\n`);
}

main().catch((error: unknown) => {
  const safeMessage = error instanceof Error && (
    error.message.includes("required")
    || error.message.includes("password")
    || error.message.includes("already exists")
    || error.message.includes("valid email")
    || error.message.includes("too long")
    || error.message.includes("direct endpoint")
    || error.message.includes("command-line")
  ) ? error.message : "Bootstrap failed.";
  process.stderr.write(`${safeMessage}\n`);
  process.exitCode = 1;
});
