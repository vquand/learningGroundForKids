import { createArtworkHandler } from '../server/artwork/handler.ts';
import { readArtworkBlob } from '../server/artwork/storage.ts';

export default {
  fetch: createArtworkHandler({
    env: process.env, fetcher: fetch, readBlob: readArtworkBlob,
    reportFailure(reason) { console.error('private_artwork_failure', { reason }); },
  }),
};
