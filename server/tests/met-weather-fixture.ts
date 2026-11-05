export function metWeatherFixture(now: number, options: { rain?: number; snow?: number; cloudCover?: number; windSpeed?: number; isDay?: boolean; temperatureC?: number } = {}) {
  const hour = Math.floor(now / 3_600_000) * 3_600_000;
  const amount = (options.rain ?? 0) + (options.snow ?? 0);
  const symbol = options.snow ? 'snow' : options.rain ? 'rain' : `partlycloudy_${options.isDay ? 'day' : 'night'}`;
  return { properties: {
    meta: { updated_at: new Date(now).toISOString(), units: { cloud_area_fraction: '%', wind_speed: 'm/s', precipitation_amount: 'mm', air_temperature: 'celsius' } },
    timeseries: Array.from({ length: 4 }, (_, index) => ({ time: new Date(hour + index * 3_600_000).toISOString(), data: {
      instant: { details: { cloud_area_fraction: options.cloudCover ?? 40, wind_speed: options.windSpeed ?? 0, ...(options.temperatureC === undefined ? {} : { air_temperature: options.temperatureC }) } },
      next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: amount } },
    } })),
  } };
}
