/**
 * Vietnamese lunisolar calendar (Ho Ngoc Duc algorithm), time zone UTC+7.
 * Pure arithmetic with no dependencies. Calibrated for Gregorian years 1900 to 2199,
 * so the Julian-calendar branch of the original algorithm is intentionally omitted.
 */

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  leap: boolean;
}

export const LUNAR_TIME_ZONE = 7;
export const LUNAR_MIN_YEAR = 1900;
export const LUNAR_MAX_YEAR = 2199;

const PI = Math.PI;
const DEG = PI / 180;
const SYNODIC_MONTH = 29.530588853;
const NEW_MOON_EPOCH = 2415021.076998695;
const MONTH11_EPOCH = 2415021;

function assertCalibratedYear(year: number): void {
  if (!Number.isInteger(year) || year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) {
    throw new Error(`Lunar calendar year must be an integer from ${LUNAR_MIN_YEAR} to ${LUNAR_MAX_YEAR}`);
  }
}

function julianDayFromCivil(day: number, month: number, year: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function civilFromJulianDay(jd: number): { day: number; month: number; year: number } {
  const alpha = Math.floor((jd - 1867216.25) / 36524.25);
  const a = jd + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { day, month, year };
}

/** Julian day number of the new moon for lunation index k, shifted to the local (UTC+7) day. */
function newMoonDay(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * DEG);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * DEG) + 0.0021 * Math.sin(2 * DEG * M);
  C1 += -0.4068 * Math.sin(Mpr * DEG) + 0.0161 * Math.sin(DEG * 2 * Mpr);
  C1 -= 0.0004 * Math.sin(DEG * 3 * Mpr);
  C1 += 0.0104 * Math.sin(DEG * 2 * F) - 0.0051 * Math.sin(DEG * (M + Mpr));
  C1 += -0.0074 * Math.sin(DEG * (M - Mpr)) + 0.0004 * Math.sin(DEG * (2 * F + M));
  C1 -= 0.0004 * Math.sin(DEG * (2 * F - M)) + 0.0006 * Math.sin(DEG * (2 * F + Mpr));
  C1 += 0.001 * Math.sin(DEG * (2 * F - Mpr)) + 0.0005 * Math.sin(DEG * (2 * Mpr + M));
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  const jdNew = jd1 + C1 - deltat;
  return Math.floor(jdNew + 0.5 + LUNAR_TIME_ZONE / 24);
}

/** Sun longitude in 30-degree segments (0 to 11) at local midnight of the given day. */
function sunLongitudeSegment(jdn: number): number {
  const T = (jdn - 2451545.5 - LUNAR_TIME_ZONE / 24) / 36525;
  const T2 = T * T;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(DEG * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(DEG * 2 * M) + 0.00029 * Math.sin(DEG * 3 * M);
  let L = (L0 + DL) * DEG;
  L -= 2 * PI * Math.floor(L / (2 * PI));
  return Math.floor((L / PI) * 6);
}

/** New moon day of the lunar month that contains the winter solstice (lunar month 11) of a year. */
function winterSolsticeMonthStart(year: number): number {
  const off = julianDayFromCivil(31, 12, year) - MONTH11_EPOCH;
  const k = Math.floor(off / SYNODIC_MONTH);
  let nm = newMoonDay(k);
  if (sunLongitudeSegment(nm) >= 9) nm = newMoonDay(k - 1);
  return nm;
}

/** Number of months from lunar month 11 to the leap month (0 when the year is not a leap year). */
function leapMonthOffset(month11Start: number): number {
  const k = Math.floor((month11Start - NEW_MOON_EPOCH) / SYNODIC_MONTH + 0.5);
  let last = 0;
  let i = 1;
  let arc = sunLongitudeSegment(newMoonDay(k + i));
  do {
    last = arc;
    i++;
    arc = sunLongitudeSegment(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Converts a Gregorian civil date (year, month 1-12, day) to a lunar date. */
export function solarToLunar(year: number, month: number, day: number): LunarDate {
  assertCalibratedYear(year);
  const dayNumber = julianDayFromCivil(day, month, year);
  // The index estimate can be one lunation too high near a new moon; the month start is the
  // last new moon on or before the day, so correct the estimate instead of yielding day 0.
  let k = Math.floor((dayNumber - NEW_MOON_EPOCH) / SYNODIC_MONTH);
  while (newMoonDay(k + 1) <= dayNumber) k++;
  while (newMoonDay(k) > dayNumber) k--;
  const monthStart = newMoonDay(k);

  let a11 = winterSolsticeMonthStart(year);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = year;
    a11 = winterSolsticeMonthStart(year - 1);
  } else {
    lunarYear = year + 1;
    b11 = winterSolsticeMonthStart(year + 1);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let leap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11);
    if (diff >= leapDiff) {
      lunarMonth = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}

/**
 * Converts a lunar date to its Gregorian civil date 'YYYY-MM-DD'. Throws when the
 * lunar date does not exist (for example day 30 of a short month, or a leap month
 * in a year without one).
 */
export function lunarToSolar(lunar: LunarDate): string {
  const { day, month, year, leap } = lunar;
  assertCalibratedYear(year);
  if (!Number.isInteger(day) || day < 1 || day > 30) throw new Error('Lunar day must be an integer from 1 to 30');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Lunar month must be an integer from 1 to 12');

  let a11: number;
  let b11: number;
  if (month < 11) {
    a11 = winterSolsticeMonthStart(year - 1);
    b11 = winterSolsticeMonthStart(year);
  } else {
    a11 = winterSolsticeMonthStart(year);
    b11 = winterSolsticeMonthStart(year + 1);
  }

  const k = Math.floor(0.5 + (a11 - NEW_MOON_EPOCH) / SYNODIC_MONTH);
  let offset = month - 11;
  if (offset < 0) offset += 12;
  if (b11 - a11 > 365) {
    const leapOffset = leapMonthOffset(a11);
    let leapMonth = leapOffset - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && month !== leapMonth) throw new Error(`Lunar year ${year} has no leap lunar month ${month}`);
    if (leap || offset >= leapOffset) offset += 1;
  } else if (leap) {
    throw new Error(`Lunar year ${year} has no leap lunar month ${month}`);
  }

  const monthStart = newMoonDay(k + offset);
  const { year: solarYear, month: solarMonth, day: solarDay } = civilFromJulianDay(monthStart + day - 1);
  const result = formatCivil(solarYear, solarMonth, solarDay);
  // The table-driven conversion silently rolls over invalid dates (for example lunar day 30
  // of a 29-day month), so the result must convert back to the same lunar date.
  const back = solarToLunar(solarYear, solarMonth, solarDay);
  if (back.day !== day || back.month !== month || back.year !== year || back.leap !== leap) {
    throw new Error(`Lunar date ${year}-${month}${leap ? ' leap' : ''}-${day} does not exist`);
  }
  return result;
}

function formatCivil(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
