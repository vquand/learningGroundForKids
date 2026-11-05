export type SeasonalTheme =
  | "spring"
  | "summer"
  | "fall"
  | "winter"
  | "halloween"
  | "christmas"
  | "vietnam-national-day"
  | "tet";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const EVENT_DAYS_BEFORE = 3;
const EVENT_DAYS_AFTER = 1;

// Vietnamese Tết dates (UTC+7), which can differ from Chinese Lunar New Year.
const TET_DATES: Readonly<Record<number, string>> = {
  2026: "2026-02-17",
  2027: "2027-02-06",
  2028: "2028-01-26",
  2029: "2029-02-13",
  2030: "2030-02-02",
  2031: "2031-01-23",
  2032: "2032-02-11",
  2033: "2033-01-31",
  2034: "2034-02-19",
  2035: "2035-02-08",
  2036: "2036-01-28",
  2037: "2037-02-15",
  2038: "2038-02-04",
  2039: "2039-01-24",
  2040: "2040-02-12",
  2041: "2041-02-01",
  2042: "2042-01-22",
  2043: "2043-02-10",
  2044: "2044-01-30",
  2045: "2045-02-17",
  2046: "2046-02-06",
};

function getVietnamDate(date: Date): { year: number; month: number; day: number } | null {
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  if (!year || !month || !day) return null;
  return { year, month, day };
}

function isWithinEventWindow(currentDay: number, eventDay: number): boolean {
  const daysFromEvent = Math.round((currentDay - eventDay) / DAY_IN_MILLISECONDS);
  return daysFromEvent >= -EVENT_DAYS_BEFORE && daysFromEvent <= EVENT_DAYS_AFTER;
}

export function getSeasonalTheme(date = new Date()): SeasonalTheme | null {
  const vietnamDate = getVietnamDate(date);
  if (!vietnamDate) return null;

  const { year, month } = vietnamDate;
  const currentDay = Date.UTC(year, month - 1, vietnamDate.day);
  const tetDates = [TET_DATES[year - 1], TET_DATES[year], TET_DATES[year + 1]];

  for (const tetDate of tetDates) {
    if (!tetDate) continue;
    const [tetYear, tetMonth, tetDay] = tetDate.split("-").map(Number);
    if (isWithinEventWindow(currentDay, Date.UTC(tetYear!, tetMonth! - 1, tetDay!))) {
      return "tet";
    }
  }

  const fixedEvents: ReadonlyArray<{ theme: SeasonalTheme; month: number; day: number }> = [
    { theme: "vietnam-national-day", month: 9, day: 2 },
    { theme: "halloween", month: 10, day: 31 },
    { theme: "christmas", month: 12, day: 25 },
  ];

  for (const event of fixedEvents) {
    if (isWithinEventWindow(currentDay, Date.UTC(year, event.month - 1, event.day))) {
      return event.theme;
    }
  }

  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}
