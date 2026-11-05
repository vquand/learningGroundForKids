import assert from 'node:assert/strict';
import test from 'node:test';
import { createEnvironmentService } from '../src/town-building/environment.js';
import { metWeatherFixture } from './met-weather-fixture.js';
import type { SafeLogFields } from '../src/logger.js';

const NOW = Date.parse('2026-10-30T11:45:00Z');
const city = { name: 'Hanoi', country_code: 'VN', latitude: 21.0245, longitude: 105.84117, timezone: 'Asia/Bangkok', feature_code: 'PPLC' };
const forecast = (now = NOW) => Response.json(metWeatherFixture(now));
function logs() {
  const entries: { level: string; message: string; fields: SafeLogFields | undefined }[] = [];
  return { entries, logger: {
    warn: (message: string, fields?: SafeLogFields) => { entries.push({ level: 'warn', message, fields }); },
    info: (message: string, fields?: SafeLogFields) => { entries.push({ level: 'info', message, fields }); },
  } };
}

test('temporary lookup failure recovers after one minute with deduplicated requests and private diagnostics', async () => {
  let now = NOW, calls = 0;
  const log = logs();
  const fetcher = (async (input: URL | string | Request) => {
    calls++;
    if (calls === 1) throw new Error('private provider error: Hanoi kid-secret');
    return String(input).includes('geocoding') ? Response.json({ results: [city] }) : forecast(now);
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => now, { logger: log.logger });
  assert.equal((await service.get('kid-secret', 'Hanoi', 'VN', '', false)).weatherSource, 'unavailable');
  now += 59_000;
  await service.get('kid-secret', 'Hanoi', 'VN', '', false);
  assert.equal(calls, 1);
  now += 1_000;
  const recovered = await Promise.all(Array.from({ length: 8 }, () => service.get('kid-secret', 'Hanoi', 'VN', '', false)));
  assert.ok(recovered.every(value => value.weatherSource === 'live' && value.timeOfDay === 'evening'));
  assert.equal(calls, 3);
  assert.equal(log.entries.filter(entry => entry.level === 'warn').length, 1);
  assert.equal(log.entries.filter(entry => entry.fields?.code === 'TOWN_WEATHER_RECOVERED').length, 1);
  assert.doesNotMatch(JSON.stringify(log.entries), /Hanoi|kid-secret|private provider|latitude|longitude|https:\/\//);
});

test('HTTP 429 reports its stage and status, honors Retry-After, and keeps the known home clock', async () => {
  let now = NOW, calls = 0, offline = true;
  const log = logs();
  const fetcher = (async (input: URL | string | Request) => {
    calls++;
    if (String(input).includes('geocoding')) return Response.json({ results: [city] });
    return offline ? new Response('private upstream body', { status: 429, headers: { 'Retry-After': '180' } }) : forecast(now);
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => now, { logger: log.logger });
  const failed = await service.get('kid', 'Hanoi', 'VN', '', false);
  assert.equal(failed.weatherSource, 'unavailable');
  assert.equal(failed.localTime, '18:45');
  assert.equal(log.entries[0]?.fields?.code, 'TOWN_WEATHER_FORECAST_HTTP_ERROR');
  assert.equal(log.entries[0]?.fields?.status, 429);
  assert.doesNotMatch(JSON.stringify(log.entries), /private upstream body|Hanoi|kid/);
  now += 179_000;
  await service.get('kid', 'Hanoi', 'VN', '', false);
  assert.equal(calls, 2);
  offline = false; now += 1_000;
  assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).weatherSource, 'live');
  assert.equal(calls, 3);
});

test('failures back off exponentially and successful weather retains its ten-minute cache', async () => {
  let now = NOW, calls = 0, failing = true;
  const fetcher = (async (input: URL | string | Request) => {
    calls++;
    if (failing) return new Response('', { status: 503 });
    return String(input).includes('geocoding') ? Response.json({ results: [city] }) : forecast(now);
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => now, { logger: logs().logger });
  await service.get('kid', 'Hanoi', 'VN', '', false);
  now += 60_000;
  await service.get('kid', 'Hanoi', 'VN', '', false);
  assert.equal(calls, 2);
  now += 119_000;
  await service.get('kid', 'Hanoi', 'VN', '', false);
  assert.equal(calls, 2);
  failing = false; now += 1_000;
  assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).weatherSource, 'live');
  assert.equal(calls, 4);
  now += 599_000;
  assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).weatherSource, 'live');
  assert.equal(calls, 4);
});

test('invalid forecast payloads and stale forecast periods have distinct sanitized diagnostics', async () => {
  for (const [payload, code] of [
    [{ current: { time: NOW / 1000, rain: -1 } }, 'INVALID_RESPONSE'],
    [metWeatherFixture(NOW - 13 * 3_600_000), 'STALE_READING'],
  ] as const) {
    const log = logs();
    const fetcher = (async (input: URL | string | Request) => String(input).includes('geocoding') ? Response.json({ results: [city] }) : Response.json(payload)) as typeof fetch;
    const service = createEnvironmentService(fetcher, () => NOW, { logger: log.logger });
    assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).weatherSource, 'unavailable');
    assert.equal(log.entries[0]?.fields?.code, `TOWN_WEATHER_FORECAST_${code}`);
  }
});

test('a deadline covers stuck headers and a stalled body, including providers ignoring abort', async () => {
  for (const phase of ['headers', 'body']) {
    const log = logs();
    let canceled = false;
    const fetcher = (async () => phase === 'headers' ? new Promise<Response>(() => {}) : new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{')); },
      cancel() { canceled = true; },
    }))) as typeof fetch;
    const service = createEnvironmentService(fetcher, () => NOW, { logger: log.logger, timeoutMs: 10 });
    const result = await service.get('kid', 'Hanoi', 'VN', '', false);
    assert.equal(result.weatherSource, 'unavailable');
    assert.equal(log.entries[0]?.fields?.code, 'TOWN_WEATHER_GEOCODING_TIMEOUT');
    if (phase === 'body') assert.equal(canceled, true);
  }
});

test('HTTP-date Retry-After holds retries and forecast cooldown is shared across cities', async () => {
  let now = NOW, forecastCalls = 0;
  const fetcher = (async (input: URL | string | Request) => {
    const url = new URL(String(input));
    if (url.hostname.startsWith('geocoding')) return Response.json({ results: [{ ...city, name: url.searchParams.get('name') }] });
    forecastCalls++;
    return new Response('', { status: 429, headers: { 'Retry-After': new Date(NOW + 240_000).toUTCString() } });
  }) as typeof fetch;
  const log = logs(), service = createEnvironmentService(fetcher, () => now, { logger: log.logger });
  await service.get('kid', 'Hanoi', 'VN', '', false);
  await service.get('other-kid', 'Da Nang', 'VN', '', false);
  assert.equal(forecastCalls, 1);
  assert.equal(log.entries.filter(entry => entry.level === 'warn').length, 1);
  now += 239_000;
  await service.get('kid', 'Hanoi', 'VN', '', false);
  assert.equal(forecastCalls, 1);
  now += 1_000;
  await service.get('kid', 'Hanoi', 'VN', '', false);
  assert.equal(forecastCalls, 2);
});

test('failure retries cap at five minutes and malformed Retry-After cannot disable recovery', async () => {
  let now = NOW, calls = 0;
  const fetcher = (async () => { calls++; return new Response('', { status: 503, headers: { 'Retry-After': 'invalid-private-text' } }); }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => now, { logger: logs().logger });
  await service.get('kid', 'Hanoi', 'VN', '', false);
  for (const [index, delay] of [60_000, 120_000, 240_000, 300_000, 300_000].entries()) {
    now += delay - 1;
    await service.get('kid', 'Hanoi', 'VN', '', false);
    assert.equal(calls, index + 1);
    now++;
    await service.get('kid', 'Hanoi', 'VN', '', false);
    assert.equal(calls, index + 2);
  }
});

test('canonical city keys share weather across case, whitespace, accents and country casing', async () => {
  let calls = 0;
  const fetcher = (async (input: URL | string | Request) => {
    calls++;
    return String(input).includes('geocoding') ? Response.json({ results: [city] }) : forecast();
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => NOW, { logger: logs().logger });
  await service.get('kid', 'Hanoi', 'VN', '', false);
  const result = await service.get('other-kid', ' HÀ NỘI ', ' vn ', '', false);
  assert.equal(result.weatherSource, 'live');
  assert.equal(result.localTime, '18:45');
  assert.equal(calls, 2);
});

test('oversized provider JSON is rejected and old weather expires even during a long provider cooldown', async () => {
  let now = NOW, failing = false;
  const log = logs();
  const fetcher = (async (input: URL | string | Request) => {
    if (String(input).includes('geocoding')) return Response.json({ results: [city] });
    return failing ? new Response('', { status: 429, headers: { 'Retry-After': '7200' } }) : forecast(now);
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => now, { logger: log.logger });
  await service.get('kid', 'Hanoi', 'VN', '', false);
  failing = true; now += 900_000;
  assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).weatherSource, 'stale');
  now += 3_600_000;
  const expired = await service.get('kid', 'Hanoi', 'VN', '', false);
  assert.equal(expired.weatherSource, 'unavailable');
  assert.equal(expired.timeZone, 'Asia/Bangkok');
  assert.equal(expired.observedAt, null);
  const oversized = createEnvironmentService((async () => Response.json({ results: [], padding: 'x'.repeat(262_144) })) as typeof fetch, () => now, { logger: log.logger });
  assert.equal((await oversized.get('kid', 'Hanoi', 'VN', '', false)).weatherSource, 'unavailable');
  assert.equal(log.entries.at(-1)?.fields?.code, 'TOWN_WEATHER_GEOCODING_INVALID_RESPONSE');
});

test('network diagnostics retain allowlisted DNS/connect codes but exclude arbitrary provider errors', async () => {
  for (const code of ['EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'private-kid-secret']) {
    const log = logs();
    const fetcher = (async () => { throw new TypeError('private Hanoi URL', { cause: { code } }); }) as typeof fetch;
    const service = createEnvironmentService(fetcher, () => NOW, { logger: log.logger });
    await service.get('kid-secret', 'Hanoi', 'VN', '', false);
    assert.equal(log.entries[0]?.fields?.code, `TOWN_WEATHER_GEOCODING_NETWORK_ERROR${code === 'private-kid-secret' ? '' : `_${code}`}`);
    assert.doesNotMatch(JSON.stringify(log.entries), /Hanoi|private|kid-secret/);
  }
});
