import type { SeedStatement } from "./catalog-seed.js";

export interface SeedQueryClient {
  query(text: string, values?: readonly unknown[]): Promise<unknown>;
}

export async function runSeedTransaction(
  client: SeedQueryClient,
  statements: readonly SeedStatement[],
): Promise<void> {
  await client.query("BEGIN");
  try {
    for (const statement of statements) {
      await client.query(statement.text, statement.values);
    }
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original statement failure; rollback failure is secondary.
    }
    throw error;
  }
}
