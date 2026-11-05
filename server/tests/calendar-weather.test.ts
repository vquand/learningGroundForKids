import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// Any accidentally uninjected call must fail locally, never reach the network.
mock.method(globalThis, 'fetch', async () => { throw new Error('Real network forbidden in weather tests'); });
import { aggregatePeriod, wmoIcon, WeatherService } from '../src/calendar/weather.js';

const now = () => new Date('2026-10-29T03:00:00Z');
const profile = { native_city: 'Saigon', native_country_code: 'VN' };
const sample = (code = 0, temp = 30, wind = 0) => ({ code, temp, wind, precipitation: 0 });
export function provider(date = '2026-10-29') {
  return { hourly: { time: Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`), weather_code: Array(24).fill(0), temperature_2m: Array(24).fill(30), wind_speed_10m: Array(24).fill(0), precipitation: Array(24).fill(0) } };
}

test('WMO table maps every supported code and rejects unknown codes', () => {
  const groups = { sunny: [0], partly_cloudy: [1, 2], cloudy: [3, 71, 72, 73, 74, 75, 76, 77, 85, 86], fog: [45, 48], drizzle: [51, 53, 55, 56, 57], rain: [61, 63, 66, 80, 81], heavy_rain: [65, 67, 82], thunderstorm: [95, 96, 99] };
  for (const [icon, codes] of Object.entries(groups)) for (const code of codes) assert.equal(wmoIcon(code), icon);
  assert.throws(() => wmoIcon(100));
});

test('period severity, rounded mean, hot, wind, precipitation and night variants', () => {
  assert.deepEqual(aggregatePeriod([sample(0, 30), sample(0, 33)], false), { icon: 'sunny', temp_c: 32 });
  const order = [sample(95), sample(65), sample(61), sample(51), sample(45), sample(3, 30, 40), sample(3), sample(2), sample(0)];
  const icons = ['thunderstorm', 'heavy_rain', 'rain', 'drizzle', 'fog', 'windy', 'cloudy', 'partly_cloudy', 'sunny'];
  for (let i = 0; i < order.length; i++) assert.equal(aggregatePeriod(order.slice(i), false).icon, icons[i]);
  assert.equal(aggregatePeriod([sample(2, 36)], false).icon, 'hot');
  assert.equal(aggregatePeriod([sample(3, 36)], false).icon, 'cloudy');
  assert.equal(aggregatePeriod([{ ...sample(0, 30, 40), precipitation: 1 }], false).icon, 'sunny');
  for (const code of [0, 1]) assert.equal(aggregatePeriod([sample(code)], true).icon, 'clear_night');
  assert.equal(aggregatePeriod([sample(2)], true).icon, 'cloudy_night');
  assert.equal(aggregatePeriod([sample(2, 36)], true).icon, 'clear_night');
  assert.equal(aggregatePeriod([sample(61)], true).icon, 'rain');
  assert.equal(aggregatePeriod([sample(0, 30, 40)], true).icon, 'windy');
  assert.equal(aggregatePeriod([sample(45, 30, 40)], true).icon, 'fog');
});

test('weather sends exact rounded-only URL, aggregates local periods and omits missing dates', async () => {
  let calls = 0;
  const service = new WeatherService({ clock: now, geocoder: async () => ({ latitude: 10.7749, longitude: 106.6941 }), fetch: async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://api.open-meteo.com/v1/forecast?latitude=10.8&longitude=106.7&hourly=weather_code%2Ctemperature_2m%2Cwind_speed_10m%2Cprecipitation&timezone=auto&past_days=3&forecast_days=11');
    assert.equal(init?.redirect, 'error');
    return Response.json(provider());
  } });
  const result = await service.get(profile);
  assert.deepEqual(result, { status: 'ok', location_label: 'Saigon, VN', updated_at: now().toISOString(), days: [{ date: '2026-10-29', morning: { icon: 'sunny', temp_c: 30 }, afternoon: { icon: 'sunny', temp_c: 30 }, evening: { icon: 'clear_night', temp_c: 30 } }] });
  await service.get(profile); assert.equal(calls, 1);
});

test('success TTL, failure backoff and stale age are independent with a fake clock', async () => {
  let time = now().getTime(), calls = 0, fail = false;
  const service = new WeatherService({ clock: () => new Date(time), geocoder: async () => ({ latitude: 1, longitude: 2 }), fetch: async () => { calls++; if (fail) throw new Error('private provider error'); return Response.json(provider()); } });
  const first = await service.get(profile);
  time += 60 * 60_000 - 1; await service.get(profile); assert.equal(calls, 1);
  time++; fail = true;
  assert.deepEqual(await service.get(profile), first); assert.equal(calls, 2);
  time += 5 * 60_000 - 1; assert.deepEqual(await service.get(profile), first); assert.equal(calls, 2);
  time++; assert.deepEqual(await service.get(profile), first); assert.equal(calls, 3);
  time = now().getTime() + 6 * 60 * 60_000;
  assert.deepEqual(await service.get(profile), first);
  time++; assert.equal((await service.get(profile)).status, 'unavailable');
  time += 5 * 60_000; fail = false;
  const fresh = await service.get(profile); assert.equal(fresh.status, 'ok'); assert.notEqual(fresh.updated_at, first.updated_at);
});

test('negative forecast cache retries at five minutes and does not invent stale data', async () => {
  let time = now().getTime(), calls = 0;
  const service = new WeatherService({ clock: () => new Date(time), geocoder: async () => ({ latitude: 1, longitude: 2 }), fetch: async () => { calls++; throw new Error('provider'); } });
  assert.equal((await service.get(profile)).status, 'unavailable');
  time += 5 * 60_000 - 1; await service.get(profile); assert.equal(calls, 1);
  time++; await service.get(profile); assert.equal(calls, 2);
});

test('concurrent misses coalesce geocoding and forecasts, including shared rounded locations', async () => {
  let release!: () => void, geocodes = 0, calls = 0;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const service = new WeatherService({ clock: now, geocoder: async () => { geocodes++; await barrier; return { latitude: 1.02, longitude: 2.01 }; }, fetch: async () => { calls++; await barrier; return Response.json(provider()); } });
  const pending = Array.from({ length: 10 }, () => service.get(profile));
  await Promise.resolve(); release();
  assert.ok((await Promise.all(pending)).every(result => result.status === 'ok'));
  assert.equal(geocodes, 1); assert.equal(calls, 1);
  await service.get({ ...profile, native_city: 'Other City' }); assert.equal(geocodes, 2); assert.equal(calls, 1);
});

test('geocode success cache expires after seven days; failures cache for five minutes', async () => {
  let time = now().getTime(), geocodes = 0, fail = false;
  const service = new WeatherService({ clock: () => new Date(time), geocoder: async () => { geocodes++; return fail ? null : { latitude: 1, longitude: 2 }; }, fetch: async () => Response.json(provider(new Date(time).toISOString().slice(0, 10))) });
  await service.get(profile);
  time += 7 * 24 * 60 * 60_000 - 1; await service.get(profile); assert.equal(geocodes, 1);
  time++; fail = true; assert.equal((await service.get(profile)).status, 'unavailable'); assert.equal(geocodes, 2);
  time += 5 * 60_000 - 1; await service.get(profile); assert.equal(geocodes, 2);
  time++; fail = false; assert.equal((await service.get(profile)).status, 'ok'); assert.equal(geocodes, 3);
});

test('500-entry caches evict oldest insertion deterministically, without extending TTL on hits', async () => {
  let calls = 0, geocodes = 0;
  const service = new WeatherService({ clock: now, geocoder: async city => { geocodes++; return { latitude: Number(city) / 10, longitude: 2 }; }, fetch: async () => { calls++; return Response.json(provider()); } });
  const location = (i: number) => ({ ...profile, native_city: String(i) });
  for (let i = 0; i < 500; i++) await service.get(location(i));
  assert.equal(calls, 500); assert.equal(geocodes, 500);
  await service.get(location(0)); assert.equal(calls, 500);
  await service.get(location(500)); assert.equal(calls, 501);
  await service.get(location(0)); assert.equal(calls, 502); assert.equal(geocodes, 502);
  await service.get(location(2)); assert.equal(calls, 502);
});

test('cache key includes Vietnam Monday window and uses correct Sunday query counts', async () => {
  let time = new Date('2026-11-01T16:59:59Z').getTime(), calls = 0;
  const service = new WeatherService({ clock: () => new Date(time), geocoder: async () => ({ latitude: -10.76, longitude: -106.66 }), fetch: async url => {
    const parsed = new URL(String(url));
    assert.equal(parsed.searchParams.get('latitude'), '-10.8'); assert.equal(parsed.searchParams.get('longitude'), '-106.7');
    assert.equal(parsed.searchParams.get('past_days'), calls === 0 ? '6' : '0');
    assert.equal(parsed.searchParams.get('forecast_days'), calls === 0 ? '8' : '14');
    calls++; return Response.json(provider(calls === 1 ? '2026-11-01' : '2026-11-02'));
  } });
  await service.get(profile); time += 1000; await service.get(profile); assert.equal(calls, 2);
});

test('no location never calls providers; geocoder errors and invalid coordinates are unavailable', async () => {
  for (const missing of [{}, { native_city: '  ', native_country_code: 'VN' }, { native_city: 'City' }]) {
    const service = new WeatherService({ fetch: async () => { assert.fail('fetch'); }, geocoder: async () => { assert.fail('geocode'); } });
    assert.deepEqual(await service.get(missing), { status: 'no_location', location_label: null, updated_at: null, days: [] });
  }
  for (const result of [null, { latitude: NaN, longitude: 1 }, { latitude: 91, longitude: 1 }, { latitude: 1, longitude: 181 }]) {
    const service = new WeatherService({ clock: now, geocoder: async () => result, fetch: async () => { assert.fail('fetch'); } });
    assert.equal((await service.get(profile)).status, 'unavailable');
  }
  const service = new WeatherService({ clock: now, geocoder: async () => { throw new Error('secret'); }, fetch: async () => { assert.fail('fetch'); } });
  assert.equal((await service.get(profile)).status, 'unavailable');
});

test('provider JSON validation rejects all malformed or implausible responses', async t => {
  const cases: [string, (data: ReturnType<typeof provider>) => unknown][] = [
    ['length mismatch', data => { data.hourly.weather_code.pop(); return data; }],
    ['NaN', data => { data.hourly.temperature_2m[7] = NaN; return data; }],
    ['infinite', data => { data.hourly.wind_speed_10m[7] = Infinity; return data; }],
    ['temperature low', data => { data.hourly.temperature_2m[7] = -91; return data; }],
    ['temperature high', data => { data.hourly.temperature_2m[7] = 61; return data; }],
    ['negative rain', data => { data.hourly.precipitation[7] = -1; return data; }],
    ['unknown WMO', data => { data.hourly.weather_code[7] = 100; return data; }],
    ['wrong window', () => provider('2026-11-09')],
    ['invalid civil date', () => provider('2026-10-32')],
    ['wrong hour', data => { data.hourly.time[0] = '2026-10-29T24:00'; return data; }],
    ['wrong minutes', data => { data.hourly.time[0] = '2026-10-29T00:30'; return data; }],
    ['timezone suffix', data => { data.hourly.time[0] += 'Z'; return data; }],
    ['duplicates', data => { data.hourly.time[1] = data.hourly.time[0]!; return data; }],
    ['wrong types', data => ({ hourly: { ...data.hourly, temperature_2m: Array(24).fill('30') } })],
    ['empty data', () => ({ hourly: { time: [], weather_code: [], temperature_2m: [], wind_speed_10m: [], precipitation: [] } })],
  ];
  for (const [name, change] of cases) await t.test(name, async () => {
    const service = new WeatherService({ clock: now, geocoder: async () => ({ latitude: 1, longitude: 2 }), fetch: async () => Response.json(change(provider())) });
    assert.deepEqual(await service.get(profile), { status: 'unavailable', location_label: 'Saigon, VN', updated_at: null, days: [] });
  });
});

test('unknown fields are ignored, dates sorted and incomplete days omitted', async () => {
  const data = provider();
  data.hourly.time.push('2026-10-30T06:00'); data.hourly.weather_code.push(0); data.hourly.temperature_2m.push(30); data.hourly.wind_speed_10m.push(0); data.hourly.precipitation.push(0);
  const service = new WeatherService({ clock: now, geocoder: async () => ({ latitude: 1, longitude: 2 }), fetch: async () => Response.json({ ...data, ignored: 'untrusted', hourly: { ...data.hourly, other: [] } }) });
  assert.deepEqual((await service.get(profile)).days.map(day => day.date), ['2026-10-29']);
});

test('body cap covers streamed bodies and HTTP errors/redirects are unavailable', async () => {
  let cancelled = 0;
  const replies = [
    () => new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(1_048_577)); }, cancel() { cancelled++; } })),
    () => new Response('provider secret', { status: 503 }),
    () => new Response(null, { status: 302, headers: { location: 'https://other.example' } }),
    () => new Response('not JSON'),
    () => { const response = Response.json(provider()); Object.defineProperty(response, 'redirected', { value: true }); return response; },
  ];
  for (const reply of replies) {
    const service = new WeatherService({ clock: now, geocoder: async () => ({ latitude: 1, longitude: 2 }), fetch: async () => reply() });
    assert.equal((await service.get(profile)).status, 'unavailable');
  }
  assert.equal(cancelled, 1);
});

test('total timeout aborts stalled fetch and body, even when fake fetch ignores abort', async () => {
  for (const stallBody of [false, true]) {
    let signal: AbortSignal | null | undefined;
    const service = new WeatherService({ clock: now, config: { timeoutMs: 10 }, geocoder: async () => ({ latitude: 1, longitude: 2 }), fetch: async (_url, init) => {
      signal = init?.signal;
      return stallBody ? new Response(new ReadableStream<Uint8Array>()) : new Promise<Response>(() => {});
    } });
    assert.equal((await service.get(profile)).status, 'unavailable'); assert.equal(signal?.aborted, true);
  }
});

test('default geocoder has identified User-Agent, no redirects and only one attempt per miss', async () => {
  let calls = 0;
  const service = new WeatherService({ clock: now, fetch: async (url, init) => {
    calls++; assert.equal(new URL(String(url)).hostname, 'nominatim.openstreetmap.org');
    assert.equal(new Headers(init?.headers).get('user-agent'), 'personal-learning-ground/1.0');
    assert.equal(init?.redirect, 'error');
    return Response.json([]);
  } });
  assert.equal((await service.get(profile)).status, 'unavailable');
  await service.get(profile); assert.equal(calls, 1);
});


test('service validates injected configuration too, before any outbound call', () => {
  for (const apiBase of ['http://api.open-meteo.com/v1/forecast', 'https://other.example/v1/forecast'])
    assert.throws(() => new WeatherService({ config: { apiBase }, fetch: async () => { assert.fail('fetch'); } }));
  for (const timeoutMs of [0, 10001, NaN]) assert.throws(() => new WeatherService({ config: { timeoutMs } }));
});

test('saturated caches retain pending identities and coalesce instead of duplicating outbound work', async () => {
  let release!: () => void, geocodes = 0, calls = 0;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const service = new WeatherService({ clock: now, geocoder: async city => {
    geocodes++; await barrier; return { latitude: Number(city) / 10, longitude: 2 };
  }, fetch: async () => { calls++; return Response.json(provider()); } });
  const location = (i: number) => ({ ...profile, native_city: String(i) });
  const pending = Array.from({ length: 500 }, (_, i) => service.get(location(i)));
  await Promise.resolve();
  const same = service.get(location(0));
  assert.equal((await service.get(location(500))).status, 'unavailable');
  assert.equal(geocodes, 500);
  release();
  await Promise.all([...pending, same]);
  assert.equal(calls, 500); assert.equal(geocodes, 500);
});

test('period boundaries use provider local hour and exclude overnight hours', async () => {
  const data = provider();
  data.hourly.temperature_2m = data.hourly.time.map((_, h) => h < 6 ? -50 : h < 12 ? 20 : h < 18 ? 26 : 22);
  data.hourly.weather_code = data.hourly.time.map((_, h) => h < 6 ? 95 : h === 11 ? 61 : h === 17 ? 45 : h >= 18 ? 2 : 0);
  const service = new WeatherService({ clock: now, geocoder: async () => ({ latitude: 1, longitude: 2 }), fetch: async () => Response.json(data) });
  assert.deepEqual((await service.get(profile)).days, [{ date: '2026-10-29', morning: { icon: 'rain', temp_c: 20 }, afternoon: { icon: 'fog', temp_c: 26 }, evening: { icon: 'cloudy_night', temp_c: 22 } }]);
});

test('saturated forecast cache keeps pending requests coalesced', async () => {
  let release!: () => void, ready!: () => void, calls = 0;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { ready = resolve; });
  const service = new WeatherService({ clock: now, geocoder: async city => ({ latitude: Number(city) / 10, longitude: 2 }), fetch: async () => { calls++; if (calls === 500) ready(); await barrier; return Response.json(provider()); } });
  const location = (i: number) => ({ ...profile, native_city: String(i) });
  const pending = Array.from({ length: 500 }, (_, i) => service.get(location(i)));
  await started;
  assert.equal((await service.get(location(500))).status, 'unavailable');
  const same = service.get(location(0));
  release();
  assert.ok((await Promise.all([...pending, same])).every(result => result.status === 'ok'));
  assert.equal(calls, 500);
});

test('days outside the Vietnam window (location in another time zone) are skipped, not fatal', async () => {
  const merge = (...days: ReturnType<typeof provider>[]) => ({ hourly: Object.fromEntries(
    (['time', 'weather_code', 'temperature_2m', 'wind_speed_10m', 'precipitation'] as const).map(key => [key, days.flatMap(day => day.hourly[key] as unknown[])]),
  ) });
  // Window for 2026-10-29 (Thursday) is Mon 2026-10-26 .. Sun 2026-11-08; the provider adds one local day on each side.
  const body = merge(provider('2026-10-25'), provider('2026-10-29'), provider('2026-11-09'));
  const service = new WeatherService({ clock: now, geocoder: async () => ({ latitude: 21, longitude: 105.8 }), fetch: async () => Response.json(body) });
  const result = await service.get(profile);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.days.map(day => day.date), ['2026-10-29']);
});
