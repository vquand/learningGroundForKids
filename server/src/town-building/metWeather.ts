import { z } from 'zod';
import { WeatherLookupError } from './environmentProvider.js';
import type { Precipitation } from './environment.js';

export const MET_FORECAST_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
export const MET_USER_AGENT = process.env.MET_USER_AGENT?.trim() || 'PersonalLearningGround/1.0 https://github.com/your-account/personalLearningGround';
const HOUR = 3_600_000;
const timestamp = z.string().datetime();
const symbol = z.string().regex(/^[a-z]+(?:_(?:day|night|polartwilight))?$/);
// Provider statistics are independent: a bad optional value never poisons its neighbours.
const stat = (min: number, max: number) => z.number().finite().min(min).max(max).optional().catch(undefined);
const unit = z.string().optional().catch(undefined);
const schema = z.object({ properties: z.object({
  meta: z.object({ updated_at: timestamp, units: z.object({ cloud_area_fraction: unit, wind_speed: unit, precipitation_amount: unit, air_temperature: unit }).catch({}) }),
  timeseries: z.array(z.object({ time: timestamp, data: z.object({
    instant: z.object({ details: z.object({ cloud_area_fraction: stat(0,100), wind_speed: stat(0,100), air_temperature: stat(-100,70) }).catch({}) }).catch({details:{}}),
    next_1_hours: z.object({ summary: z.object({ symbol_code: symbol.optional().catch(undefined) }).catch({}), details: z.object({ precipitation_amount: stat(0,1000) }).catch({}) }).optional().catch(undefined),
  }) })).min(1).max(500),
}) });
export type MetForecast = z.infer<typeof schema>;
export function parseMetForecast(value: unknown): MetForecast {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new WeatherLookupError('forecast', 'INVALID_RESPONSE');
  const times = parsed.data.properties.timeseries.map(point => Date.parse(point.time));
  if (times.some((time, index) => index > 0 && time <= (times[index - 1] ?? Infinity))) throw new WeatherLookupError('forecast', 'INVALID_RESPONSE');
  return parsed.data;
}

/** Use only the hourly interval containing now. Never divide a six-hour total or use a future dry interval. */
export function metWeatherAt(forecast: MetForecast, now: number) {
  const issuedAt = Date.parse(forecast.properties.meta.updated_at);
  if (issuedAt > now + 300_000 || now - issuedAt > 12 * HOUR) throw new WeatherLookupError('forecast', 'STALE_READING');
  const point = forecast.properties.timeseries.find(point => Date.parse(point.time) <= now && now < Date.parse(point.time) + HOUR);
  const period = point?.data.next_1_hours;
  if (!point) throw new WeatherLookupError('forecast', 'STALE_READING');
  const code = period?.summary.symbol_code ?? '', units = forecast.properties.meta.units, details = point.data.instant.details;
  const amount = units.precipitation_amount === 'mm' ? period?.details.precipitation_amount : undefined;
  const wet = amount !== undefined && (amount > 0 || /rain|snow|sleet/.test(code));
  const precipitation: Precipitation | null = amount === undefined || !code ? null : !wet ? 'none' : /snow|sleet/.test(code) ? 'snow' : 'rain';
  const wind = units.wind_speed === 'm/s' ? details.wind_speed : undefined;
  return { precipitation, cloudCover: units.cloud_area_fraction === '%' ? details.cloud_area_fraction ?? null : null,
    temperatureC: units.air_temperature === 'celsius' ? details.air_temperature ?? null : null,
    windSpeed: wind === undefined ? null : Math.round(wind * 36) / 10,
    isDay: code.endsWith('_night') ? false : code.endsWith('_day') ? true : null,
    forecastValidAt: new Date(point.time).toISOString(), forecastUpdatedAt: new Date(issuedAt).toISOString(),
  };
}
