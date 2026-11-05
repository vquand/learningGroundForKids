export type WeatherStage = 'geocoding' | 'forecast';
type FailureReason = 'HTTP_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE'
  | 'CITY_UNRESOLVED' | 'INVALID_TIMEZONE' | 'STALE_READING' | 'RATE_BUDGET' | 'PROVIDER_BACKOFF';

/** Only allowlisted metadata may reach logs; never retain URLs or provider bodies. */
export class WeatherLookupError extends Error {
  constructor(readonly stage: WeatherStage, readonly reason: FailureReason,
    readonly status?: number, readonly retryAt?: number, readonly networkCode?: string) { super(`Town weather ${stage}: ${reason}`); }
}

const MAX_BODY_BYTES = 262_144;
const NETWORK_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET']);
function networkCode(error: unknown): string | undefined {
  const values = [error, error instanceof Error && 'cause' in error ? error.cause : undefined];
  for (const value of values) {
    if (value && typeof value === 'object' && 'code' in value && typeof value.code === 'string' && NETWORK_CODES.has(value.code)) return value.code;
  }
  return undefined;
}
function retryAfter(value: string | null, now: number): number | undefined {
  if (!value) return undefined;
  const delay = /^\d+$/.test(value.trim()) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) && delay >= 0 ? now + Math.min(delay, 86_400_000) : undefined;
}

async function readJson(response: Response, stage: WeatherStage, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw new WeatherLookupError(stage, 'INVALID_RESPONSE');
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) throw new WeatherLookupError(stage, 'INVALID_RESPONSE');
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
    catch { throw new WeatherLookupError(stage, 'INVALID_RESPONSE'); }
  } finally { signal.removeEventListener('abort', cancel); cancel(); }
}

/** One deadline includes DNS/connect, headers and the entire bounded JSON body. */
export async function weatherProviderJson(fetcher: typeof fetch, url: URL, stage: WeatherStage,
  clock: () => number, timeoutMs: number, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new WeatherLookupError(stage, 'TIMEOUT')); controller.abort(); }, timeoutMs);
  });
  const work = async () => {
    const response = await fetcher(url, { signal: controller.signal, redirect: 'error', headers: { accept: 'application/json', ...headers } });
    if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw new WeatherLookupError(stage, 'TIMEOUT'); }
    if (!response.ok && response.status !== 304) {
      void response.body?.cancel().catch(() => {});
      throw new WeatherLookupError(stage, 'HTTP_ERROR', response.status, retryAfter(response.headers.get('Retry-After'), clock()));
    }
    const expires = Date.parse(response.headers.get('expires') ?? '');
    const modified = Date.parse(response.headers.get('last-modified') ?? '');
    return { body: response.status === 304 ? null : await readJson(response, stage, controller.signal), status: response.status,
      expiresAt: Number.isFinite(expires) ? expires : null,
      lastModified: Number.isFinite(modified) ? new Date(modified).toUTCString() : null };
  };
  try { return await Promise.race([work(), deadline]); }
  catch (error) {
    if (error instanceof WeatherLookupError) throw error;
    throw new WeatherLookupError(stage, controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR', undefined, undefined, networkCode(error));
  } finally { clearTimeout(timer); controller.abort(); }
}
