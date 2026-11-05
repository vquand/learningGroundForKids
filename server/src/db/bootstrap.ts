import type { AppDatabase, FamilyRecord } from "../contracts/db.js";
import { ROOT_ACCOUNT_EMAIL } from "../root-account.js";

export interface BootstrapCredentials {
  email: string;
  displayName: string;
  password: string;
}

export interface BootstrapDependencies {
  id(): string;
  hash(password: string): Promise<string>;
}

function requiredEnvironmentValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function readBootstrapCredentials(
  env: NodeJS.ProcessEnv,
  stdinPassword: string,
): BootstrapCredentials {
  const email = requiredEnvironmentValue(env, "BOOTSTRAP_EMAIL").toLowerCase();
  const displayName = requiredEnvironmentValue(env, "BOOTSTRAP_NAME");
  const password = env.BOOTSTRAP_PASSWORD ?? stdinPassword.replace(/\r?\n$/, "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new Error("BOOTSTRAP_EMAIL must be a valid email address.");
  }
  if (displayName.length > 120) throw new Error("BOOTSTRAP_NAME is too long.");
  if (password.length < 12 || password.length > 1024) {
    throw new Error("The bootstrap password must be between 12 and 1024 characters.");
  }
  return { email, displayName, password };
}

export async function bootstrapFamily(
  db: AppDatabase,
  credentials: BootstrapCredentials,
  dependencies: BootstrapDependencies,
): Promise<FamilyRecord> {
  if (credentials.email.trim().toLowerCase() === ROOT_ACCOUNT_EMAIL) {
    throw new Error("The root email is reserved; use db:init-root.");
  }
  if (await db.auth.findFamilyByEmail(credentials.email)) {
    throw new Error("A family with that email already exists; bootstrap refused.");
  }
  const passwordHash = await dependencies.hash(credentials.password);
  return db.auth.createFamily({
    id: dependencies.id(),
    email: credentials.email,
    displayName: credentials.displayName,
    passwordHash,
    role: "admin",
  });
}
