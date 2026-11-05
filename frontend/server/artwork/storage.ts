import { get } from '@vercel/blob';
import type { ReadBlob } from './handler.ts';

// The SDK obtains and refreshes OIDC from the connected Vercel project.
// Never forward a browser-provided authorization or OIDC header to Blob.
export const readArtworkBlob: ReadBlob = async (key, storeId) => {
  const result = await get(key, { access: 'private', storeId });
  if (!result || result.statusCode !== 200) return null;
  return { body: result.stream, size: result.blob.size };
};
