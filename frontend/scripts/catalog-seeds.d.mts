export const CATALOG_SEED_DIR: string;
export const CATALOG_SEED_CATEGORIES: readonly string[];
export function listCatalogSeedFiles(categories?: readonly string[], seedDir?: string): Promise<string[]>;
export function loadCatalogSeeds(categories?: readonly string[], seedDir?: string): Promise<Array<Record<string, unknown>>>;
