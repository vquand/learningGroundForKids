import { z } from 'zod';

export const WEATHER_API_BASE = 'https://api.open-meteo.com/v1/forecast';
/** Code-owned allowlist; configuration cannot expand it or supply URL parameters. */
export function isWeatherApiBase(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'api.open-meteo.com'
      && !url.port && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === '/v1/forecast';
  } catch { return false; }
}
export const weatherConfigSchema = z.object({
  apiBase: z.string().refine(isWeatherApiBase, 'Use the HTTPS allowlisted Open-Meteo forecast URL').default(WEATHER_API_BASE),
  timeoutMs: z.coerce.number().int().min(1).max(10_000).default(4_000),
});
export const WEATHER_ICONS = ['sunny', 'partly_cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'heavy_rain', 'thunderstorm', 'hot', 'windy', 'clear_night', 'cloudy_night'] as const;
export type WeatherIcon = typeof WEATHER_ICONS[number];
export interface WeatherPeriod { icon: WeatherIcon; temp_c: number }
export interface WeatherDay { date: string; morning: WeatherPeriod; afternoon: WeatherPeriod; evening: WeatherPeriod }
export interface WeatherResponse {
  status: 'ok' | 'unavailable' | 'no_location';
  location_label: string | null;
  updated_at: string | null;
  days: WeatherDay[];
}
export interface CalendarWeather {
  get(profile: { native_city?: string | null; native_country_code?: string | null }, now?: Date): Promise<WeatherResponse>;
}
