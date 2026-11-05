import catalog from './catalog.json' with { type: 'json' };

type Environment = Record<string, string | undefined>;
export type ReadBlob = (key: string, storeId: string) => Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>;
type FailureReason = 'configuration' | 'session_unavailable' | 'session_invalid' | 'blob_missing' | 'blob_size' | 'blob_unavailable' | 'blob_stream';
type Dependencies = { env: Environment; fetcher: typeof fetch; readBlob: ReadBlob; reportFailure?: (reason: FailureReason) => void };
const privateHeaders = {
  'Cache-Control': 'private, no-cache',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};

function failure(status: number, message: string) {
  return new Response(message, { status, headers: { ...privateHeaders, 'Cache-Control': 'private, no-store' } });
}

function apiOrigin(value: string | undefined) {
  try {
    const url = new URL(value ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

function sessionCookie(request: Request, name: string) {
  const matches = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{1,256}$/.test(value) ? `${name}=${value}` : null;
}

async function readSession(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok || !response.body) throw new Error('Session unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 16384) throw new Error('Session too large');
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const session: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!session || typeof session !== 'object' || Array.isArray(session)) throw new Error('Invalid session');
    return session as Record<string, unknown>;
  } finally { await reader.cancel().catch(() => {}); }
}

/** Authored shared artwork only. Render remains the authority for every session. */
export function createArtworkHandler({ env, fetcher, readBlob, reportFailure = () => {} }: Dependencies) {
  function unavailable(status: number, reason: FailureReason) {
    reportFailure(reason);
    return failure(status, 'Artwork unavailable');
  }
  return async function handle(request: Request): Promise<Response> {
    if (!['GET', 'HEAD'].includes(request.method)) {
      const response = failure(405, 'Method not allowed');
      response.headers.set('Allow', 'GET, HEAD');
      return response;
    }
    const paths = new URL(request.url).searchParams.getAll('path');
    if (paths.length !== 1) return failure(400, 'One artwork path is required');
    const name = paths[0]!;
    if (!Object.hasOwn(catalog.entries, name)) return failure(404, 'Artwork not found');
    const entry = catalog.entries[name as keyof typeof catalog.entries];
    const origin = apiOrigin(env.RENDER_API_ORIGIN);
    const cookieName = env.SESSION_COOKIE_NAME ?? 'plg_session';
    const storeId = env.BLOB_STORE_ID;
    if (env.ARTWORK_BLOB_ENABLED !== 'true' || !/^store_[A-Za-z0-9]+$/.test(storeId ?? '') || !origin || !/^[A-Za-z0-9_-]+$/.test(cookieName)) {
      return unavailable(503, 'configuration');
    }
    const cookie = sessionCookie(request, cookieName);
    if (!cookie) return failure(401, 'Sign in required');
    try {
      const response = await fetcher(`${origin}/api/v1/auth/session`, {
        headers: { cookie, accept: 'application/json' },
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
      if (response.status === 401 || response.status === 403) return failure(response.status, 'Sign in required');
      const session = await readSession(response);
      if (session.authenticated === false) return failure(401, 'Sign in required');
      const user = session.user as { id?: unknown } | undefined;
      if (session.authenticated !== true || typeof user?.id !== 'string' || !user.id ||
          (session.parentPasswordRequired !== undefined && typeof session.parentPasswordRequired !== 'boolean')) {
        return unavailable(503, 'session_invalid');
      }
      if (session.parentPasswordRequired === true) return failure(403, 'Finish account setup first');
    } catch {
      // Never include upstream errors, cookies, or provider credentials in responses.
      return unavailable(503, 'session_unavailable');
    }
    const etag = `"${entry.sha256}"`;
    const headers = { ...privateHeaders, ETag: etag, 'Content-Type': entry.contentType, 'Content-Length': String(entry.size) };
    const matches = request.headers.get('if-none-match')?.split(',').map(value => value.trim().replace(/^W\//, ''));
    if (matches?.includes(etag) || matches?.includes('*')) {
      const conditional = new Headers(headers);
      conditional.delete('Content-Length');
      return new Response(null, { status: 304, headers: conditional });
    }
    if (request.method === 'HEAD') return new Response(null, { headers });
    try {
      const blob = await readBlob(entry.key, storeId!);
      if (!blob) return unavailable(404, 'blob_missing');
      if (blob.size !== entry.size) {
        await blob.body.cancel().catch(() => {});
        return unavailable(502, 'blob_size');
      }
      let size = 0;
      const bounded = blob.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          size += chunk.byteLength;
          if (size > entry.size) throw new Error('Artwork stream invalid');
          controller.enqueue(chunk);
        },
        flush() { if (size !== entry.size) throw new Error('Artwork stream invalid'); },
      }));
      // Redact provider stream errors too, after headers have been sent.
      const reader = bounded.getReader();
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = await reader.read();
            if (next.done) controller.close(); else controller.enqueue(next.value);
          } catch {
            reportFailure('blob_stream');
            controller.error(new Error('Artwork stream unavailable'));
          }
        },
        cancel(reason) { return reader.cancel(reason); },
      });
      return new Response(body, { headers });
    } catch { return unavailable(502, 'blob_unavailable'); }
  };
}
