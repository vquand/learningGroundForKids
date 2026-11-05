/** Home-city calendar only. Halloween rewards never use device time or previews. */
export const isHalloweenPreparation = (date = '') => /^\d{4}-10-(?:27|28|29)$/.test(date);
export const isHalloweenNight = (date = '') => /^\d{4}-10-(?:30|31)$/.test(date);
export const isHalloweenPumpkinSeason = (date = '') => isHalloweenPreparation(date) || isHalloweenNight(date);
export interface HalloweenWeather {
  localDate?: string; timeOfDay?: string | null; isDay?: boolean | null;
  precipitation?: string | null; weatherSource?: string;
}
export function halloweenDark(weather: HalloweenWeather): boolean {
  return weather.isDay != null ? !weather.isDay : weather.timeOfDay === 'evening' || weather.timeOfDay === 'night';
}
export function halloweenWorkAllowed(weather: HalloweenWeather): boolean {
  return Boolean(weather.timeOfDay && isHalloweenNight(weather.localDate) && halloweenDark(weather)
    && weather.precipitation === 'none' && weather.weatherSource === 'live');
}
