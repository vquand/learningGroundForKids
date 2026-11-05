export interface ArtworkCatalog {
  version: number;
  entries: Record<string, { key: string; sha256: string; size: number; contentType: string }>;
}
export const publicDirectory: URL;
export const catalogFile: URL;
export function generateCatalog(): Promise<ArtworkCatalog>;
export function verifiedCatalog(): Promise<ArtworkCatalog>;
export function catalogFingerprint(catalog: ArtworkCatalog): string;
export function prepareArtworkBuild(outDir: string, env: Record<string, string | undefined>): Promise<void>;
