import { defineConfig } from "drizzle-kit";
import { requireUnpooledDatabaseUrl } from "./src/db/migration-url.js";

const databaseUrl = requireUnpooledDatabaseUrl(process.env);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});
