import { z } from 'zod';
import { geocodeHome } from '../geocode.js';
import { calendarDates, isCivilDate, weekday } from './dates.js';
import { weatherConfigSchema, type CalendarWeather, type WeatherDay, type WeatherIcon, type WeatherPeriod, type WeatherResponse } from './weather-contracts.js';

const MINUTE = 60_000, HOUR = 60 * MINUTE, CAPACITY = 500;
const MAX_BYTES = 1_048_576;
type Coordinates = { latitude: number; longitude: number };
type Geocoder = (city: string, country: string) => Promise<Coordinates | null>;
type Sample = { code: number; temp: number; wind: number; precipitation: number };
const groups: [WeatherIcon, number[]][] = [
  ['sunny', [0]], ['partly_cloudy', [1, 2]], ['cloudy', [3, 71, 72, 73, 74, 75, 76, 77, 85, 86]],
  ['fog', [45, 48]], ['drizzle', [51, 53, 55, 56, 57]], ['rain', [61, 63, 66, 80, 81]],
  ['heavy_rain', [65, 67, 82]], ['thunderstorm', [95, 96, 99]],
];
const mapping = new Map(groups.flatMap(([icon, codes]) => codes.map(code => [code, icon] as const)));
export function wmoIcon(code: number): WeatherIcon {
  const icon = mapping.get(code);
  if (!icon) throw new Error('Unsupported weather code');
  return icon;
}
const severity: WeatherIcon[] = ['sunny', 'hot', 'partly_cloudy', 'cloudy', 'windy', 'fog', 'drizzle', 'rain', 'heavy_rain', 'thunderstorm'];
export function aggregatePeriod(samples: Sample[], evening: boolean): WeatherPeriod {
  if (!samples.length) throw new Error('Missing period');
  let icon = samples.map(row => wmoIcon(row.code)).reduce((a, b) => severity.indexOf(a) >= severity.indexOf(b) ? a : b);
  const maxTemp = Math.max(...samples.map(row => row.temp));
  if (severity.indexOf(icon) < severity.indexOf('fog') && samples.every(row => row.precipitation === 0)
    && samples.some(row => row.wind >= 40)) icon = 'windy';
  if ((icon === 'sunny' || icon === 'partly_cloudy') && maxTemp >= 35) icon = 'hot';
  if (evening) {
    if (icon === 'hot' || ((icon === 'sunny' || icon === 'partly_cloudy') && samples.every(row => row.code === 0 || row.code === 1))) icon = 'clear_night';
    else if (icon === 'partly_cloudy') icon = 'cloudy_night';
  }
  return { icon, temp_c: Math.round(samples.reduce((sum, row) => sum + row.temp, 0) / samples.length) };
}
const providerSchema = z.object({ hourly: z.object({
  time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):00$/)).max(14 * 24),
  weather_code: z.array(z.number().int().refine(code => mapping.has(code))),
  temperature_2m: z.array(z.number().finite().min(-90).max(60)),
  wind_speed_10m: z.array(z.number().finite().min(0).max(500)),
  precipitation: z.array(z.number().finite().min(0).max(1000)),
}).superRefine((hourly, ctx) => {
  if (!hourly.time.length || [hourly.weather_code, hourly.temperature_2m, hourly.wind_speed_10m, hourly.precipitation].some(values => values.length !== hourly.time.length))
    ctx.addIssue({ code: 'custom', message: 'Invalid hourly lengths' });
}) });

async function readProvider(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.ok || response.redirected || !response.body) {
    await response.body?.cancel();
    throw new Error('Weather unavailable');
  }
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Weather body too large');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => {}); }
}

type Forecast = { days: WeatherDay[]; updated_at: string; received: number };
type CacheEntry = { retryAt: number; forecast: Forecast | null; pending?: Promise<Forecast | null> };
type GeoEntry = { expires: number; result: Coordinates | null; pending?: Promise<Coordinates | null> };
/** FIFO eviction (including failures); insertion order is deterministic, hits do not extend retention. */
function reserve<T extends { pending?: Promise<unknown> }>(cache: Map<string, T>, key: string, value: T): boolean {
  if (!cache.has(key) && cache.size >= CAPACITY) {
    const first = [...cache].find(([, entry]) => !entry.pending)?.[0];
    // Retain in-flight identities; saturated caches fail closed instead of duplicating requests.
    if (first === undefined) return false;
    cache.delete(first);
  }
  cache.set(key, value);
  return true;
}

// Shared across service instances: serialize actual Nominatim calls, one start per second.
let geocodeQueue: Promise<unknown> = Promise.resolve();
let lastGeocodeStart = 0;
function politeGeocode(request: typeof fetch, city: string, country: string): Promise<Coordinates | null> {
  const run = geocodeQueue.then(async () => {
    const wait = Math.max(0, lastGeocodeStart + 1000 - Date.now());
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastGeocodeStart = Date.now();
    return geocodeHome(city, country, { fetch: request, maxAttempts: 1 });
  });
  geocodeQueue = run.catch(() => null);
  return run;
}

export class WeatherService implements CalendarWeather {
  private readonly request: typeof fetch;
  private readonly clock: () => Date;
  private readonly geocoder: Geocoder;
  private readonly config: z.infer<typeof weatherConfigSchema>;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly geocodes = new Map<string, GeoEntry>();
  constructor(options: { fetch?: typeof fetch; clock?: () => Date; geocoder?: Geocoder; config?: { apiBase?: string; timeoutMs?: number } } = {}) {
    this.request = options.fetch ?? fetch;
    this.clock = options.clock ?? (() => new Date());
    this.geocoder = options.geocoder ?? ((city, country) => politeGeocode(this.request, city, country));
    this.config = weatherConfigSchema.parse(options.config ?? {});
  }
  now(): Date { return this.clock(); }
  private async locate(city: string, country: string): Promise<Coordinates | null> {
    const key = JSON.stringify([city, country]);
    const now = this.clock().getTime();
    const cached = this.geocodes.get(key);
    if (cached?.pending) return cached.pending;
    if (cached && now < cached.expires) return cached.result;
    const entry: GeoEntry = { expires: 0, result: null };
    if (!reserve(this.geocodes, key, entry)) return null;
    entry.pending = Promise.resolve().then(() => this.geocoder(city, country)).then(result => {
      if (!result || !Number.isFinite(result.latitude) || Math.abs(result.latitude) > 90 || !Number.isFinite(result.longitude) || Math.abs(result.longitude) > 180) return null;
      return { latitude: Math.round(result.latitude * 10) / 10, longitude: Math.round(result.longitude * 10) / 10 };
    }).catch(() => null).then(result => {
      entry.result = result;
      entry.expires = this.clock().getTime() + (result ? 7 * 24 * HOUR : 5 * MINUTE);
      delete entry.pending;
      return result;
    });
    return entry.pending;
  }
  private async load(coords: Coordinates, now: Date): Promise<Forecast> {
    const window = calendarDates(now);
    const pastDays = weekday(window.today) - 1;
    const url = new URL(this.config.apiBase);
    url.search = new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude), hourly: 'weather_code,temperature_2m,wind_speed_10m,precipitation', timezone: 'auto', past_days: String(pastDays), forecast_days: String(14 - pastDays) }).toString();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Weather timeout')); }, this.config.timeoutMs);
    });
    const work = async (): Promise<Forecast> => {
      const response = await this.request(url.toString(), { signal: controller.signal, redirect: 'error', headers: { accept: 'application/json' } });
      if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw new Error('Weather timeout'); }
      const { hourly } = providerSchema.parse(await readProvider(response, controller.signal));
      const dates = new Map<string, Sample[][]>();
      let previous = '';
      hourly.time.forEach((time, i) => {
        const date = time.slice(0, 10), hour = Number(time.slice(11, 13));
        if (!isCivilDate(date) || time <= previous) throw new Error('Invalid weather time');
        previous = time;
        // A location in another time zone can shift local dates by a day: skip dates outside the calendar window.
        if (date < window.start || date > window.end || hour < 6) return;
        const periods = dates.get(date) ?? [[], [], []];
        const period = periods[Math.floor(hour / 6) - 1];
        const code = hourly.weather_code[i], temp = hourly.temperature_2m[i], wind = hourly.wind_speed_10m[i], precipitation = hourly.precipitation[i];
        if (!period || code === undefined || temp === undefined || wind === undefined || precipitation === undefined) throw new Error('Missing weather value');
        period.push({ code, temp, wind, precipitation });
        dates.set(date, periods);
      });
      const days: WeatherDay[] = [];
      for (const [date, periods] of dates) {
        const [morning, afternoon, evening] = periods;
        // Never invent a period or average incomplete hourly data.
        if (!morning || !afternoon || !evening || periods.some(period => period.length !== 6)) continue;
        days.push({ date, morning: aggregatePeriod(morning, false), afternoon: aggregatePeriod(afternoon, false), evening: aggregatePeriod(evening, true) });
      }
      if (!days.length) throw new Error('No covered weather days');
      const received = this.clock().getTime();
      return { days, received, updated_at: new Date(received).toISOString() };
    };
    try { return await Promise.race([work(), deadline]); }
    finally { clearTimeout(timer); controller.abort(); }
  }
  async get(profile: { native_city?: string | null; native_country_code?: string | null }, now = this.clock()): Promise<WeatherResponse> {
    const city = profile.native_city?.trim(), country = profile.native_country_code?.trim();
    const empty = (status: 'unavailable' | 'no_location', label: string | null): WeatherResponse => ({ status, location_label: label, updated_at: null, days: [] });
    if (!city || !country) return empty('no_location', null);
    const label = `${city}, ${country}`;
    const coords = await this.locate(city, country);
    if (!coords) return empty('unavailable', label);
    const key = `${coords.latitude},${coords.longitude}:${calendarDates(now).start}`;
    const time = this.clock().getTime();
    let entry = this.cache.get(key);
    if (!entry) { entry = { retryAt: 0, forecast: null }; if (!reserve(this.cache, key, entry)) return empty('unavailable', label); }
    if (!entry.pending && time >= entry.retryAt) {
      const target = entry;
      target.pending = this.load(coords, now).then(forecast => {
        target.forecast = forecast; target.retryAt = this.clock().getTime() + HOUR;
        return forecast;
      }).catch(() => { target.retryAt = this.clock().getTime() + 5 * MINUTE; return null; }).finally(() => { delete target.pending; });
    }
    if (entry.pending) await entry.pending;
    const forecast = entry.forecast;
    if (!forecast || this.clock().getTime() - forecast.received > 6 * HOUR) return empty('unavailable', label);
    return { status: 'ok', location_label: label, updated_at: forecast.updated_at, days: forecast.days };
  }
}
