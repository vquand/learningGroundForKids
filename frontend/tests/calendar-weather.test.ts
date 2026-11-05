import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CALENDAR_CHIP_GAP,
  CALENDAR_CHIP_HEIGHT,
  CALENDAR_WEATHER_STRIP_GAP,
  CALENDAR_WEATHER_STRIP_HEIGHT,
  buildWeatherAriaLabel,
  formatWeatherTemperature,
  visibleChipCount,
  weatherDisplayState,
  weatherForDateAndPeriod,
} from '../src/lib/calendarHelpers.ts';
import type { CalendarWeatherResponse } from '../src/types/calendar.ts';

const weather: CalendarWeatherResponse = {
  status: 'ok',
  location_label: 'Da Nang, VN',
  updated_at: '2026-10-29T00:00:00.000Z',
  days: [{
    date: '2026-10-29',
    morning: { icon: 'rain', temp_c: 26.6 },
    afternoon: { icon: 'hot', temp_c: 35.4 },
    evening: { icon: 'cloudy_night', temp_c: 27.2 },
  }],
};

test('calendar weather finds the requested date and period without inventing omitted dates', () => {
  assert.deepEqual(weatherForDateAndPeriod(weather, '2026-10-29', 'morning'), { icon: 'rain', temp_c: 26.6 });
  assert.deepEqual(weatherForDateAndPeriod(weather, '2026-10-29', 'evening'), { icon: 'cloudy_night', temp_c: 27.2 });
  assert.equal(weatherForDateAndPeriod(weather, '2026-10-30', 'morning'), undefined);
});

test('calendar weather status hides transient or unavailable weather and keeps no-location guidance', () => {
  assert.equal(weatherDisplayState(undefined, true, false), 'hidden');
  assert.equal(weatherDisplayState({ ...weather, status: 'unavailable', days: [] }), 'hidden');
  assert.equal(weatherDisplayState({ ...weather, status: 'no_location', days: [] }), 'no_location');
  assert.equal(weatherDisplayState(weather, false, true), 'hidden');
  assert.equal(weatherDisplayState(weather), 'ok');
});

test('calendar weather formats rounded temperatures and localized aria text', async () => {
  assert.equal(formatWeatherTemperature(26.6), '27°');
  assert.equal(formatWeatherTemperature(-2.4), '-2°');
  assert.equal(formatWeatherTemperature(Number.NaN), '');
  assert.equal(buildWeatherAriaLabel('{period}: {label}, {temperature} độ', 'Buổi sáng', weather.days[0]!.morning, 'vi'), 'Buổi sáng: Mưa, 27 độ');
  assert.equal(buildWeatherAriaLabel('{period}: {label}, {temperature} degrees', 'Morning', weather.days[0]!.morning, 'en'), 'Morning: Rain, 27 degrees');
});

test('calendar weather strip sits above the chip stack and only its height is reserved', () => {
  const fill = (count: number) => count * CALENDAR_CHIP_HEIGHT + (count - 1) * CALENDAR_CHIP_GAP;
  // Eight 28px chips with 2px gaps need 238px; the strip with its gap costs 24px more above them (262px in total).
  assert.equal(CALENDAR_CHIP_HEIGHT, 28);
  assert.equal(fill(8), 238);
  assert.equal(fill(8) + CALENDAR_WEATHER_STRIP_HEIGHT + CALENDAR_WEATHER_STRIP_GAP, 262);
  assert.equal(CALENDAR_WEATHER_STRIP_HEIGHT + CALENDAR_WEATHER_STRIP_GAP, 24);
  assert.equal(visibleChipCount(fill(8), 8, CALENDAR_CHIP_HEIGHT, CALENDAR_CHIP_GAP), 8);
  assert.equal(visibleChipCount(fill(8) - 1, 8, CALENDAR_CHIP_HEIGHT, CALENDAR_CHIP_GAP), 6);
});
