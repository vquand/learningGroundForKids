import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { catalogFingerprint, publicDirectory, verifiedCatalog } from './artwork-catalog.mjs';

const mode = process.argv[2] ?? '--plan';
if (!['--plan', '--upload', '--verify'].includes(mode) || process.argv.length > 3) throw new Error('Use --plan, --upload, or --verify.');

try {
  const catalog = await verifiedCatalog();
  const files = [...new Map(Object.entries(catalog.entries).map(([name, entry]) => [entry.key, { name, ...entry }])).values()];
  const bytes = files.reduce((sum, entry) => sum + entry.size, 0);
  console.log(`${files.length} unique private images, ${(bytes / 1048576).toFixed(1)} MiB. Mode: ${mode}.`);
  if (mode !== '--plan') {
    const storeId = process.env.BLOB_STORE_ID;
    if (!/^store_[A-Za-z0-9]+$/.test(storeId ?? '')) throw new Error('Set BLOB_STORE_ID and run with the connected Vercel project’s OIDC environment.');
    const { get, head, put, BlobNotFoundError } = await import('@vercel/blob');
    const auth = { storeId };
    for (const entry of files) {
      try {
        if (mode === '--upload') {
          let existing;
          try { existing = await head(entry.key, auth); }
          catch (error) { if (!(error instanceof BlobNotFoundError)) throw error; }
          if (existing) {
            if (existing.size !== entry.size) throw new Error('Existing object has a different size');
          } else {
            await put(entry.key, await readFile(new URL(entry.name, publicDirectory)), {
              ...auth, access: 'private', contentType: entry.contentType, addRandomSuffix: false, allowOverwrite: false,
            });
          }
        } else {
          const result = await get(entry.key, { ...auth, access: 'private', useCache: false });
          if (!result || result.statusCode !== 200) throw new Error('Missing object');
          const hash = createHash('sha256');
          let length = 0;
          for await (const chunk of result.stream) {
            length += chunk.length;
            if (length > entry.size) throw new Error('Unexpected object size');
            hash.update(chunk);
          }
          if (length !== entry.size || hash.digest('hex') !== entry.sha256) throw new Error('Object content mismatch');
        }
      } catch {
        throw new Error(`Artwork ${mode.slice(2)} failed for ${entry.name}. Check store access and object contents. No objects were overwritten or deleted.`);
      }
    }
    if (mode === '--verify') console.log(`ARTWORK_BLOB_VERIFIED_CATALOG=${storeId}:${catalogFingerprint(catalog)}`);
    else console.log('Upload complete. Run artwork:verify before enabling the private artwork build.');
  }
} catch (error) {
  // Only errors authored above reach output, never SDK request/credential details.
  console.error(error.message);
  process.exitCode = 1;
}
