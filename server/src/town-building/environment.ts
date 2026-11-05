import { createHash } from 'node:crypto';
import { z } from 'zod';
import { safeLogger, type Logger } from '../logger.js';
import { WeatherLookupError, weatherProviderJson, type WeatherStage } from './environmentProvider.js';
import { MET_FORECAST_URL, MET_USER_AGENT, metWeatherAt, parseMetForecast, type MetForecast } from './metWeather.js';
import type { Season } from './game.js';
export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';
export function homeClock(date:Date,timeZone:string):{localTime:string;timeOfDay:TimeOfDay} {
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
    const hour=Number(parts.find(p=>p.type==='hour')!.value);
    const minute=parts.find(p=>p.type==='minute')!.value;
    return {localTime:`${String(hour).padStart(2,'0')}:${minute}`,timeOfDay:hour>=5&&hour<11?'morning':hour>=11&&hour<14?'noon':hour>=14&&hour<17?'afternoon':hour>=17&&hour<20?'evening':'night'};
}
export type Precipitation = 'none' | 'rain' | 'snow';
export interface Environment {
    temperatureC?: number | null;
    windSpeed?: number|null;
    localTime?: string | null;
    timeOfDay?: TimeOfDay | null;
    cloudCover?: number | null;
    isDay?: boolean | null;
    season: Season;
    localDate: string;
    timeZone: string;
    precipitation: Precipitation | null;
    snowCover: boolean;
    weatherSource: 'live' | 'stale' | 'unavailable' | 'preview';
    /** Retained for compatibility; forecasts are not station observations. */
    observedAt: string | null;
    weatherProvider?: 'met-no';
    forecastValidAt?: string | null;
    forecastUpdatedAt?: string | null;
    expiresAt: string;
    canPreviewEnvironment: boolean;
    locationLabel: string;
}
export function seasonAt(date: Date, timeZone: string, latitude: number) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (key: string) => parts.find(p => p.type === key)!.value;
    const month = Number(part('month'));
    const north: Season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
    const opposite: Record<Season, Season> = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };
    return { season: latitude < 0 ? opposite[north] : north, localDate: `${part('year')}-${part('month')}-${part('day')}` };
}
/** A visitor sees the friend's own city weather and day/night clock, but never the home city label or preview capability. */
export const visitorEnvironment = (live: Environment): Environment => ({ ...live, locationLabel: '', canPreviewEnvironment: false });
export const storybookSnow = (profileId: string, date: string) => createHash('sha256').update(`${profileId}:${date}`).digest()[0]! % 4 === 0;
const citySchema = z.object({ results: z.array(z.object({ name: z.string(), country_code: z.string(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), timezone: z.string(), feature_code: z.string().optional() })).optional() });
interface City {
    name: string;
    country_code: string;
    latitude: number;
    longitude: number;
    timezone: string;
}
interface Reading {
    temperatureC: number | null;
    windSpeed?: number|null;
    cloudCover: number | null;
    isDay: boolean | null;
    city: City;
    precipitation: Precipitation | null;
    forecastValidAt: string;
    forecastUpdatedAt: string;
    fetchedAt: number;
    freshUntil: number;
}
interface WeatherCache {
    reading: Reading | null; forecast?: MetForecast; lastModified?: string;
    retryAt: number; failures: number;
}

const normalizedCityName = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, '').toLowerCase();
const cityKey = (name: string, country: string) => JSON.stringify([country.trim().toUpperCase(), normalizedCityName(name)]);
const WEATHER_FRESH_MS = 600_000, WEATHER_STALE_MS = 3_600_000, MAX_CACHED_CITIES = 200;
/** Insert as most recently used, so size-bound eviction drops the least recently used key. */
function remember<K, V>(map: Map<K, V>, key: K, value: V) {
    map.delete(key);
    map.set(key, value);
    if (map.size > MAX_CACHED_CITIES) map.delete(map.keys().next().value!);
}
function retained(entry: WeatherCache | undefined, now: number): Reading | null {
    // Retain for an hour, or until MET's later Expires, which the client must not request before.
    if (!entry?.reading || !entry.forecast || now > Math.max(entry.reading.fetchedAt + WEATHER_STALE_MS, entry.reading.freshUntil)) return null;
    try { return { ...entry.reading, ...metWeatherAt(entry.forecast, now) }; }
    catch { return null; }
}
/** Instance-local bounded caches; neither city weather nor previews affect game revisions. */
export function createEnvironmentService(fetcher: typeof fetch = fetch, clock = () => Date.now(),
    options: { logger?: Pick<Logger, 'warn' | 'info'>; timeoutMs?: number } = {}) {
    const logger = options.logger ?? safeLogger;
    const providerBackoff = new Map<WeatherStage, number>();
    // Conservative rolling budgets cover both forecast and geocoding requests.
    const providerCalls: number[] = [];
    async function fetchProvider(url: URL, stage: WeatherStage, headers: Record<string, string> = {}) {
        const now = clock();
        const retryAt = providerBackoff.get(stage);
        if (retryAt && now < retryAt) throw new WeatherLookupError(stage, 'PROVIDER_BACKOFF', undefined, retryAt);
        while (providerCalls.length && providerCalls[0]! <= now - 86400000) providerCalls.shift();
        if (providerCalls.length >= 9000 || providerCalls.filter(at => at > now - 3600000).length >= 4500
            || providerCalls.filter(at => at > now - 60000).length >= 500) throw new WeatherLookupError(stage, 'RATE_BUDGET');
        providerCalls.push(now);
        try { return await weatherProviderJson(fetcher, url, stage, clock, options.timeoutMs ?? 4000, headers); }
        catch (error) {
            if (error instanceof WeatherLookupError && (error.status === 429 || error.retryAt))
                providerBackoff.set(stage, Math.max(clock() + 60_000, error.retryAt ?? 0));
            throw error;
        }
    }
    const cities = new Map<string, City>();
    const cache = new Map<string, WeatherCache>();
    const pending = new Map<string, Promise<Reading | null>>();
    const previews = new Map<string, {
        season: Season;
        precipitation: Precipitation;
        snowCover: boolean;
        until: number;
    }>();
    async function reading(cityName: string, country: string): Promise<Reading | null> {
        const key = cityKey(cityName, country);
        const now = clock();
        const entry = cache.get(key);
        if (entry && now < entry.retryAt) {
            remember(cache, key, entry);
            return retained(entry, now);
        }
        if (pending.has(key))
            return pending.get(key)!;
        const job = (async () => {
            let stage: WeatherStage = 'geocoding';
            try {
                let city = cities.get(key) ?? entry?.reading?.city;
                if (!city) {
                    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
                    url.searchParams.set('name', cityName.trim());
                    url.searchParams.set('count', '10');
                    const parsed = citySchema.safeParse((await fetchProvider(url, stage)).body);
                    if (!parsed.success) throw new WeatherLookupError(stage, 'INVALID_RESPONSE');
                    const result = parsed.data;
                    const matches = (result.results ?? []).filter(c => c.country_code.toUpperCase() === country.trim().toUpperCase());
                    const exact = matches.filter(c => normalizedCityName(c.name) === normalizedCityName(cityName));
                    // GeoNames PPLC is a national capital. Prefer it only for an exact name;
                    // fuzzy neighbouring localities/airports must not make Hanoi ambiguous.
                    const capitals = exact.filter(c => c.feature_code === 'PPLC');
                    const candidates = exact.length ? exact : matches;
                    const selected = capitals.length === 1 ? capitals[0] : candidates.length === 1 ? candidates[0] : undefined;
                    if (!selected)
                        throw new WeatherLookupError(stage, 'CITY_UNRESOLVED');
                    city = selected;
                    try { new Intl.DateTimeFormat('en', { timeZone: city.timezone }).format(); }
                    catch { throw new WeatherLookupError(stage, 'INVALID_TIMEZONE'); }
                    remember(cities, key, city);
                }
                stage = 'forecast';
                const url = new URL(MET_FORECAST_URL);
                // City-level precision improves privacy/cache reuse and stays below MET's four-decimal maximum.
                url.searchParams.set('lat', (Math.trunc(city.latitude * 100) / 100).toString());
                url.searchParams.set('lon', (Math.trunc(city.longitude * 100) / 100).toString());
                const request = (conditional: boolean) => fetchProvider(url, stage, { 'user-agent': MET_USER_AGENT,
                    ...(conditional && entry?.lastModified ? { 'if-modified-since': entry.lastModified } : {}) });
                const load = (response: Awaited<ReturnType<typeof request>>) => {
                    const forecast = response.status === 304 ? entry?.forecast : parseMetForecast(response.body);
                    if (!forecast) throw new WeatherLookupError(stage, 'INVALID_RESPONSE');
                    return { forecast, weather: metWeatherAt(forecast, clock()) };
                };
                let response = await request(true);
                let loaded: ReturnType<typeof load>;
                try { loaded = load(response); }
                catch (error) {
                    // A 304 keeps the old payload, which can age past the validity window; fetch a fresh one once.
                    if (response.status !== 304) throw error;
                    response = await request(false);
                    loaded = load(response);
                }
                const { forecast, weather } = loaded;
                const receivedAt = clock();
                const freshUntil = Math.max(receivedAt + WEATHER_FRESH_MS, response.expiresAt ?? 0);
                const value: Reading = { city, ...weather, fetchedAt: receivedAt, freshUntil };
                const lastModified = response.lastModified ?? entry?.lastModified;
                remember(cache, key, { reading: value, forecast, ...(lastModified ? { lastModified } : {}), retryAt: freshUntil, failures: 0 });
                if (entry?.failures) logger.info('Town weather lookup recovered', { code: 'TOWN_WEATHER_RECOVERED', durationMs: Math.max(0, receivedAt - now) });
                else if (!entry) logger.info('Town weather forecast available', { code: 'TOWN_WEATHER_MET_NO_READY', durationMs: Math.max(0, receivedAt - now) });
                return value;
            }
            catch (error) {
                const failure = error instanceof WeatherLookupError ? error : new WeatherLookupError(stage, 'NETWORK_ERROR');
                const failedAt = clock(), failures = (entry?.failures ?? 0) + 1;
                const delay = Math.min(300_000, 60_000 * 2 ** Math.min(failures - 1, 3));
                const retryAt = Math.max(failedAt + delay, failure.retryAt ?? providerBackoff.get(failure.stage) ?? 0);
                const value = retained(entry, failedAt);
                remember(cache, key, { ...entry, reading: value, retryAt, failures });
                if (failure.reason !== 'PROVIDER_BACKOFF') logger.warn(`Town weather lookup failed; retry in ${Math.ceil((retryAt - failedAt) / 1000)}s`, {
                    code: `TOWN_WEATHER_${failure.stage.toUpperCase()}_${failure.reason}${failure.networkCode ? `_${failure.networkCode}` : ''}`,
                    ...(failure.status ? { status: failure.status } : {}), durationMs: Math.max(0, failedAt - now),
                });
                return value;
            }
            finally {
                pending.delete(key);
            }
        })();
        pending.set(key, job);
        return job;
    }
    function project(profileId: string, cityName: string | undefined, country: string | undefined, r: Reading | null, previewKey: string, canPreviewEnvironment: boolean): Environment {
        const now = clock();
        const city = r?.city ?? (cityName && country ? cities.get(cityKey(cityName, country)) : undefined);
        const calendar = seasonAt(new Date(now), city?.timezone ?? 'UTC', city?.latitude ?? 0);
        const cover = calendar.season === 'winter' && storybookSnow(profileId, calendar.localDate);
        const precipitation = r ? r.precipitation : (cover ? 'snow' : 'none');
        const p = canPreviewEnvironment ? previews.get(previewKey) : undefined;
        if (p && p.until <= now)
            previews.delete(previewKey);
        const preview = p && p.until > now ? p : null;
        return { ...calendar, ...(city ? homeClock(new Date(now),city.timezone) : {localTime:null,timeOfDay:null}), windSpeed:r?.windSpeed??null, cloudCover:r?.cloudCover ?? null, isDay:r?.isDay ?? null, timeZone: city?.timezone ?? 'UTC', precipitation: preview?.precipitation ?? precipitation, snowCover: preview?.snowCover ?? (cover || precipitation === 'snow'), season: preview?.season ?? calendar.season, weatherSource: preview ? 'preview' : r && r.precipitation !== null ? (now >= r.freshUntil ? 'stale' : 'live') : 'unavailable',
            temperatureC: r?.temperatureC ?? null, observedAt: null, weatherProvider: 'met-no', forecastValidAt: r?.forecastValidAt ?? null, forecastUpdatedAt: r?.forecastUpdatedAt ?? null,
            expiresAt: new Date(Math.min(r?.freshUntil ?? now + WEATHER_FRESH_MS, preview?.until ?? Infinity)).toISOString(), canPreviewEnvironment, locationLabel: city ? `${city.name}, ${city.country_code}` : cityName && country ? `${cityName.trim()}, ${country.toUpperCase()}` : 'Default calendar · ask a parent to set your home city' };
    }
    return {
        /** Cached environment only; the home clock outlives weather freshness. Never fetches or applies previews. */
        peek(profileId: string, cityName?: string, country?: string): Environment {
            const r = cityName && country ? retained(cache.get(cityKey(cityName, country)), clock()) : null;
            const value = project(profileId, cityName, country, r, '', false);
            return value.timeOfDay ? value : { ...value, localDate: '' };
        },
        preview(key: string, value: {
            season: Season;
            precipitation: Precipitation;
            snowCover: boolean;
        } | null) {
            for (const [id, v] of previews)
                if (v.until <= clock())
                    previews.delete(id);
            if (value) {
                if (previews.size >= 200)
                    previews.delete(previews.keys().next().value!);
                previews.set(key, { ...value, until: clock() + 1800000 });
            }
            else
                previews.delete(key);
        },
        async get(profileId: string, cityName: string | undefined, country: string | undefined, previewKey: string, canPreviewEnvironment: boolean): Promise<Environment> {
            const r = cityName && country ? await reading(cityName, country) : null;
            return project(profileId, cityName, country, r, previewKey, canPreviewEnvironment);
        }
    };
}
