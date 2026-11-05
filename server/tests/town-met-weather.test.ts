import assert from 'node:assert/strict';
import test from 'node:test';
import { createEnvironmentService } from '../src/town-building/environment.js';
import { metWeatherFixture } from './met-weather-fixture.js';
import { halloweenWorkAllowed } from '../src/town-building/halloweenCalendar.js';
import { emptyTown } from '../src/town-building/game.js';
import { freshPatch } from '../src/town-building/garden.js';
import { tickMap } from '../src/town-building/mapTick.js';

const NOW = Date.parse('2026-10-30T13:15:00Z');
const city = { name: 'Hanoi', country_code: 'VN', latitude: 21.0245, longitude: 105.84117, timezone: 'Asia/Bangkok', feature_code: 'PPLC' };
const logger = { info() {}, warn() {} };

test('Town exposes the current hourly Celsius temperature without inventing missing readings', async () => {
  for (const temperatureC of [32.4, 0, -8.5, undefined]) {
    const snapshot = metWeatherFixture(NOW, temperatureC === undefined ? {} : { temperatureC });
    const second = snapshot.properties.timeseries[1];
    assert.ok(second);
    second.data.instant.details.air_temperature = 18;
    let now = NOW;
    const fetcher = (async (input: URL | string | Request) => String(input).includes('geocoding')
      ? Response.json({ results: [city] })
      : Response.json(snapshot, { headers: { Expires: new Date(NOW + 50 * 60_000).toUTCString() } })) as typeof fetch;
    const service = createEnvironmentService(fetcher, () => now, { logger });
    assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).temperatureC, temperatureC ?? null);
    now += 46 * 60_000;
    assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).temperatureC, 18);
  }
  const service = createEnvironmentService((async () => { throw new Error('offline'); }) as typeof fetch, () => NOW, { logger });
  assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).temperatureC, null);
});

test('Town omits invalid temperature units and values while preserving other weather', async () => {
  for (const [unit, value] of [['fahrenheit', 32], ['celsius', 500], ['celsius', -150]]) {
    const snapshot = metWeatherFixture(NOW, { temperatureC: Number(value), rain: 2, windSpeed: 3, cloudCover: 80 });
    snapshot.properties.meta.units.air_temperature = String(unit);
    const fetcher = (async (input: URL | string | Request) => String(input).includes('geocoding')
      ? Response.json({ results: [city] }) : Response.json(snapshot)) as typeof fetch;
    const env = await createEnvironmentService(fetcher, () => NOW, { logger }).get('kid', 'Hanoi', 'VN', '', false);
    assert.equal(env.weatherSource, 'live');
    assert.equal(env.temperatureC, null);
    assert.equal(env.precipitation, 'rain');
    assert.equal(env.cloudCover, 80);
    assert.equal(env.windSpeed, 10.8);
  }
});

test('MET validates every statistic independently, including its units', async () => {
  for (const stat of ['air_temperature', 'wind_speed', 'cloud_area_fraction', 'precipitation_amount'] as const) {
    for (const invalid of ['unit', 'range', 'missing', 'type'] as const) {
      const snapshot = metWeatherFixture(NOW, { temperatureC: 24, windSpeed: 3, cloudCover: 80, rain: 2 });
      if (invalid === 'unit') snapshot.properties.meta.units[stat] = 'wrong';
      for (const point of snapshot.properties.timeseries) {
        const details = stat === 'precipitation_amount' ? point.data.next_1_hours.details : point.data.instant.details;
        if (invalid === 'missing') Reflect.deleteProperty(details, stat);
        else if (invalid !== 'unit') Reflect.set(details, stat, invalid === 'type' ? '24' : -1000);
      }
      const fetcher = (async (input: URL | string | Request) => String(input).includes('geocoding')
        ? Response.json({ results: [city] }) : Response.json(snapshot)) as typeof fetch;
      const env = await createEnvironmentService(fetcher, () => NOW, { logger }).get('kid', 'Hanoi', 'VN', '', false);
      const label = `${stat}: ${invalid}`;
      assert.equal(env.temperatureC, stat === 'air_temperature' ? null : 24, label);
      assert.equal(env.windSpeed, stat === 'wind_speed' ? null : 10.8, label);
      assert.equal(env.cloudCover, stat === 'cloud_area_fraction' ? null : 80, label);
      assert.equal(env.precipitation, stat === 'precipitation_amount' ? null : 'rain', label);
    }
  }
});

test('Town uses identified keyless MET Norway forecasts and exposes forecast times, never observations', async () => {
  const urls: string[] = [];
  const fetcher = (async (input: URL | string | Request, init?: RequestInit) => {
    const url = new URL(String(input)); urls.push(url.toString());
    if (url.hostname.startsWith('geocoding')) return Response.json({ results: [city] });
    assert.equal(url.hostname, 'api.met.no');
    assert.equal(url.pathname, '/weatherapi/locationforecast/2.0/compact');
    assert.equal(url.searchParams.get('lat'), '21.02');
    assert.equal(url.searchParams.get('lon'), '105.84');
    assert.match(new Headers(init?.headers).get('user-agent') ?? '', /PersonalLearningGround\/.*https:\/\//);
    assert.equal(url.searchParams.has('apikey'), false);
    return Response.json(metWeatherFixture(NOW, { windSpeed: 2.5, cloudCover: 80 }));
  }) as typeof fetch;
  const env = await createEnvironmentService(fetcher, () => NOW, { logger }).get('kid', 'Hanoi', 'VN', '', false);
  assert.equal(env.weatherSource, 'live');
  assert.equal(env.windSpeed, 9);
  assert.equal(env.cloudCover, 80);
  assert.equal(env.observedAt, null);
  assert.equal(env.weatherProvider, 'met-no');
  assert.equal(env.forecastValidAt, '2026-10-30T13:00:00.000Z');
  assert.equal(env.forecastUpdatedAt, new Date(NOW).toISOString());
  assert.ok(urls.every(url => !url.includes('api.open-meteo.com/v1/forecast')));
});

test('2000 profiles in ten cities share ten forecasts per ten-minute refresh', async () => {
  let now = NOW, geocodes = 0, forecasts = 0;
  const fetcher = (async (input: URL | string | Request) => {
    const url = new URL(String(input));
    if (url.hostname.startsWith('geocoding')) {
      geocodes++;
      return Response.json({ results: [{ ...city, name: url.searchParams.get('name') }] });
    }
    forecasts++;
    return Response.json(metWeatherFixture(now));
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => now, { logger });
  const refresh = () => Promise.all(Array.from({ length: 2000 }, (_, i) => service.get(`kid-${i}`, `City ${i % 10}`, 'VN', '', false)));
  assert.ok((await refresh()).every(env => env.weatherSource === 'live'));
  assert.equal(geocodes, 10); assert.equal(forecasts, 10);
  now += 599_999; await refresh(); assert.equal(forecasts, 10);
  now++; await refresh(); assert.equal(geocodes, 10); assert.equal(forecasts, 20);
});

test('MET Expires is honored; cached forecast advances to the current hour without another download', async () => {
  let now = NOW, calls = 0;
  const snapshot = metWeatherFixture(NOW);
  const second = snapshot.properties.timeseries[1];
  assert.ok(second);
  second.data.next_1_hours.details.precipitation_amount = 2;
  second.data.next_1_hours.summary.symbol_code = 'rain';
  const fetcher = (async (input: URL | string | Request) => {
    if (String(input).includes('geocoding')) return Response.json({ results: [city] });
    calls++;
    return Response.json(snapshot, { headers: { Expires: new Date(NOW + 50 * 60_000).toUTCString() } });
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => now, { logger });
  assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).precipitation, 'none');
  now += 46 * 60_000;
  const next = await service.get('other-kid', 'Hanoi', 'VN', '', false);
  assert.equal(next.weatherSource, 'live'); assert.equal(next.precipitation, 'rain'); assert.equal(calls, 1);
});

test('MET conditional requests accept 304 without losing the cached forecast', async () => {
  let now = NOW, calls = 0;
  const modified = new Date(NOW - 60_000).toUTCString();
  const fetcher = (async (input: URL | string | Request, init?: RequestInit) => {
    if (String(input).includes('geocoding')) return Response.json({ results: [city] });
    calls++;
    if (calls === 1) return Response.json(metWeatherFixture(NOW), { headers: { 'Last-Modified': modified } });
    assert.equal(new Headers(init?.headers).get('if-modified-since'), modified);
    return new Response(null, { status: 304, headers: { Expires: new Date(now + 20 * 60_000).toUTCString() } });
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => now, { logger });
  await service.get('kid', 'Hanoi', 'VN', '', false); now += 600_000;
  assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).weatherSource, 'live');
  assert.equal(calls, 2);
});

test('missing, future-only or old forecast periods cannot invent dry weather', async () => {
  for (const variant of ['missing', 'future', 'old']) {
    const snapshot = metWeatherFixture(variant === 'old' ? NOW - 13 * 3_600_000 : variant === 'future' ? NOW + 3_600_000 : NOW);
    if (variant === 'missing') for (const point of snapshot.properties.timeseries) Reflect.deleteProperty(point.data, 'next_1_hours');
    const fetcher = (async (input: URL | string | Request) => String(input).includes('geocoding') ? Response.json({ results: [city] }) : Response.json(snapshot)) as typeof fetch;
    const env = await createEnvironmentService(fetcher, () => NOW, { logger }).get('kid', 'Hanoi', 'VN', '', false);
    assert.equal(env.weatherSource, 'unavailable');
    assert.equal(env.forecastValidAt, variant === 'missing' ? '2026-10-30T13:00:00.000Z' : null);
    if (variant === 'missing') { assert.equal(env.precipitation, null); assert.equal(env.cloudCover, 40); }
  }
});

test('profiles without a registered city generate no provider calls', async () => {
  let calls = 0;
  const service = createEnvironmentService((async () => { calls++; throw new Error('must not fetch'); }) as typeof fetch, () => NOW, { logger });
  assert.equal((await service.get('kid', undefined, 'VN', '', false)).weatherSource, 'unavailable');
  assert.equal(calls, 0);
});

test('MET dry night forecasts drive the real ghost simulation; wet or daylight forecasts cannot harvest', async () => {
  for (const kind of ['dry', 'rain', 'snow', 'day']) {
    const fetcher = (async (input: URL | string | Request) => String(input).includes('geocoding')
      ? Response.json({ results: [city] })
      : Response.json(metWeatherFixture(NOW, { rain: kind === 'rain' ? 2 : 0, snow: kind === 'snow' ? 1 : 0, isDay: kind === 'day' }))) as typeof fetch;
    const env = await createEnvironmentService(fetcher, () => NOW, { logger }).get('kid', 'Hanoi', 'VN', '', false);
    assert.equal(halloweenWorkAllowed(env), kind === 'dry');
    const garden = freshPatch('autumn'); garden.crop = 'pumpkin';
    garden.slots.forEach(slot => { slot.crop = 'pumpkin'; slot.growth = 300; });
    let state = tickMap({ ...emptyTown(), entities: [
      { id: 'home', blueprintId: 'house', x: 8, y: 10, paidCost: {} },
      { id: 'pumpkins', blueprintId: 'vegetable-patch', x: 10, y: 14, paidCost: {}, garden },
    ] }, 'town', NOW, env, true);
    for (let seconds = 5; seconds <= 120; seconds += 5) state = tickMap(state, 'town', NOW + seconds * 1000, env);
    assert.equal(state.halloween?.lanterns.length ?? 0, kind === 'dry' ? 4 : 0);
    assert.equal(state.materials.stamina, kind === 'dry' ? 8 : 0);
  }
});

test('different countries do not share a same-named city forecast', async () => {
  let forecasts = 0;
  const fetcher = (async (input: URL | string | Request) => {
    if (String(input).includes('geocoding')) return Response.json({ results: [city, { ...city, country_code: 'US', timezone: 'America/New_York' }] });
    forecasts++; return Response.json(metWeatherFixture(NOW));
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => NOW, { logger });
  const vietnam = await service.get('a', 'Hanoi', 'VN', '', false);
  const us = await service.get('b', 'Hanoi', 'US', '', false);
  assert.equal(forecasts, 2); assert.notEqual(vietnam.localTime, us.localTime);
});

test('a MET Expires beyond one hour keeps the reading and is honored before refetching', async () => {
  let now = NOW, forecastCalls = 0;
  const snapshot = metWeatherFixture(NOW, { temperatureC: 20 });
  const fetcher = (async (input: URL | string | Request) => {
    if (String(input).includes('geocoding')) return Response.json({ results: [city] });
    forecastCalls++;
    return Response.json(snapshot, { headers: { Expires: new Date(NOW + 3 * 3_600_000).toUTCString() } });
  }) as typeof fetch;
  const service = createEnvironmentService(fetcher, () => now, { logger });
  assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).temperatureC, 20);
  now += 61 * 60_000;
  assert.equal((await service.get('kid', 'Hanoi', 'VN', '', false)).temperatureC, 20);
  assert.equal(forecastCalls, 1);
  now += 2 * 3_600_000;
  await service.get('kid', 'Hanoi', 'VN', '', false);
  assert.equal(forecastCalls, 2);
});

test('a friend visit keeps the friend city clock but hides the label and preview capability', async () => {
  const { visitorEnvironment } = await import('../src/town-building/environment.js');
  const service = createEnvironmentService((async () => { throw new Error('offline'); }) as typeof fetch, () => NOW, { logger });
  const live = await service.get('kid', 'Hanoi', 'VN', '', true);
  const visit = visitorEnvironment({ ...live, timeZone: 'Asia/Bangkok' });
  assert.deepEqual([visit.timeZone, visit.locationLabel, visit.canPreviewEnvironment], ['Asia/Bangkok', '', false]);
});
