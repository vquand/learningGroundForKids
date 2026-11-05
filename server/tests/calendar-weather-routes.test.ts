import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// Any accidentally uninjected call must fail locally, never reach the network.
mock.method(globalThis, 'fetch', async () => { throw new Error('Real network forbidden in weather tests'); });
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { hashSessionToken } from '../src/auth.js';
import type { AppDatabase } from '../src/contracts/db.js';
import type { CalendarWeather } from '../src/calendar/weather-contracts.js';

const config = () => loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://unused:unused@localhost/unused', ALLOWED_ORIGINS: 'https://app.example', ALLOWED_FORWARDED_HOSTS: 'app.example' });
const logger = { info() {}, warn() {}, error() {} };

test('weather route authenticates including expired sessions, scopes ownership and guards methods', async () => {
  let expired = false, calls = 0, city: string | null = 'Saved City';
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return !expired && hash === hashSessionToken('token') ? { id: 'family-a', role: 'family' } : null; } },
    profiles: { async get(family: string, id: string) { assert.equal(family, 'family-a'); return id === 'kid-a' ? { id, native_city: city, native_country_code: 'VN' } : null; } },
  } as unknown as AppDatabase;
  let weather: CalendarWeather = { async get(profile, now) { calls++; assert.equal(profile.native_city, 'Saved City'); assert.equal(now?.toISOString(), '2026-10-29T03:00:00.000Z'); return { status: 'ok', location_label: 'Saved City, VN', updated_at: now!.toISOString(), days: [] }; } };
  const app = createApp({ db, config: config(), logger, weatherClock: () => new Date('2026-10-29T03:00:00Z'), weather: { get: (profile, now) => weather.get(profile, now) } });
  const send = (id = 'kid-a', token = 'token', method = 'GET') => app.request(`https://app.example/api/v1/profiles/${id}/calendar/weather?city=ignored&country=US`, { method, headers: { origin: 'https://app.example', cookie: token ? `plg_session=${token}` : '' } });
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const anon = await send('kid-a', '', method); assert.equal(anon.status, 401); assert.equal(anon.headers.get('cache-control'), 'no-store');
    expired = true; assert.equal((await send('kid-a', 'token', method)).status, 401); expired = false;
    for (const id of ['other-family-kid', 'missing']) assert.equal((await send(id, 'token', method)).status, 404);
    if (method !== 'GET') assert.equal((await send('kid-a', 'token', method)).status, 405);
  }
  assert.equal(calls, 0);
  const ok = await send(); assert.equal(ok.status, 200); assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await ok.json(), { status: 'ok', location_label: 'Saved City, VN', updated_at: '2026-10-29T03:00:00.000Z', days: [] });
  city = null;
  const missing = await send(); assert.equal(missing.status, 200); assert.deepEqual(await missing.json(), { status: 'no_location', location_label: null, updated_at: null, days: [] }); assert.equal(calls, 1);
  city = 'Saved City';
  weather = { async get() { throw new Error('secret upstream response'); } };
  const unavailable = await send(); assert.equal(unavailable.status, 200); assert.equal(unavailable.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await unavailable.json(), { status: 'unavailable', location_label: 'Saved City, VN', updated_at: null, days: [] });
});

test('createApp wires fake weather fetch/geocoder/clock and supports disabled weather', async () => {
  const profile = { id: 'kid', native_city: 'Saved City', native_country_code: 'VN' };
  const db = { auth: { async findFamilyBySessionHash() { return { id: 'family', role: 'family' }; } }, profiles: { async get() { return profile; } } } as unknown as AppDatabase;
  let fetches = 0, geocodes = 0;
  const app = createApp({ db, config: config(), logger, weatherClock: () => new Date('2026-10-29T03:00:00Z'), geocoder: async (city, country) => { geocodes++; assert.equal(city, 'Saved City'); assert.equal(country, 'VN'); return { latitude: 10.7749, longitude: 106.6941 }; }, weatherFetch: async url => { fetches++; assert.match(String(url), /latitude=10.8&longitude=106.7/); throw new Error('provider secret'); } });
  const request = (app: ReturnType<typeof createApp>) => app.request('https://app.example/api/v1/profiles/kid/calendar/weather', { headers: { cookie: 'plg_session=token' } });
  assert.equal((await request(app)).status, 200); assert.equal((await (await request(app)).json()).status, 'unavailable');
  assert.equal(fetches, 1); assert.equal(geocodes, 1);
  const disabled = createApp({ db, config: config(), logger, weather: null, weatherFetch: async () => { assert.fail('disabled fetch'); }, geocoder: async () => { assert.fail('disabled geocoder'); } });
  assert.equal((await (await request(disabled)).json()).status, 'unavailable');
});

test('configuration defaults and code-owned HTTPS allowlist/timeout bounds', () => {
  assert.deepEqual(config().weather, { apiBase: 'https://api.open-meteo.com/v1/forecast', timeoutMs: 4000 });
  const base = { DATABASE_URL: 'postgresql://unused@localhost/unused' };
  for (const url of ['http://api.open-meteo.com/v1/forecast', 'https://evil.example/v1/forecast', 'https://api.open-meteo.com.evil.example/v1/forecast', 'https://api.open-meteo.com:8443/v1/forecast', 'https://user@api.open-meteo.com/v1/forecast', 'https://api.open-meteo.com/v1/forecast?latitude=10.123', 'https://api.open-meteo.com/other', 'https://api.open-meteo.com/v1/forecast#fragment']) assert.throws(() => loadConfig({ ...base, WEATHER_API_BASE: url }));
  for (const timeout of ['0', '10001', 'NaN', '1.5']) assert.throws(() => loadConfig({ ...base, WEATHER_TIMEOUT_MS: timeout }));
  for (const timeout of ['1', '10000']) assert.equal(loadConfig({ ...base, WEATHER_TIMEOUT_MS: timeout }).weather?.timeoutMs, Number(timeout));
});
