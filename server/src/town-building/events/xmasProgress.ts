import { XMAS_EDITION, XMAS_EVENT_ID } from './xmas2026Model.ts';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export interface XmasYearSummary {
  year: string;
  total: number;
  distinctTypes: number;
  maxSimultaneous: number;
  snowmen: number;
  rabbits: number;
  owls: number;
  penguins: number;
}

export function xmasProgress(town: unknown) {
  const history = object(object(object(town).eventHistory)[XMAS_EVENT_ID]);
  const records: XmasYearSummary[] = Object.entries(history).flatMap(([year, raw]) => {
    const entry = object(raw);
    if (!/^\d{4}$/.test(year) || entry.edition !== XMAS_EDITION) return [];
    const total = typeof entry.total === 'number' && Number.isSafeInteger(entry.total) && entry.total >= 0 ? entry.total : 0;
    const byType = object(entry.byType);
    const builtTypes = Array.isArray(entry.builtTypes) ? entry.builtTypes : [];
    const maxSimultaneous = typeof entry.maxSimultaneous === 'number' && Number.isSafeInteger(entry.maxSimultaneous) && entry.maxSimultaneous >= 0 ? entry.maxSimultaneous : 0;
    const snowmen = typeof byType['snow-snowman'] === 'number' ? byType['snow-snowman'] : 0;
    const rabbits = typeof byType['snow-rabbit'] === 'number' ? byType['snow-rabbit'] : 0;
    const owls = typeof byType['snow-owl'] === 'number' ? byType['snow-owl'] : 0;
    const penguins = typeof byType['snow-penguin'] === 'number' ? byType['snow-penguin'] : 0;
    return [{
      year,
      total,
      distinctTypes: builtTypes.length,
      maxSimultaneous,
      snowmen,
      rabbits,
      owls,
      penguins,
    }];
  }).sort((a, b) => b.year.localeCompare(a.year));

  const bestDistinct = Math.max(0, ...records.map(r => r.distinctTypes));
  const bestSimultaneous = Math.max(0, ...records.map(r => r.maxSimultaneous));
  const bestSnowmen = Math.max(0, ...records.map(r => r.snowmen));
  const bestRabbits = Math.max(0, ...records.map(r => r.rabbits));
  const bestOwls = Math.max(0, ...records.map(r => r.owls));
  const bestPenguins = Math.max(0, ...records.map(r => r.penguins));
  const total = records.reduce((sum, r) => sum + r.total, 0);

  const metrics = {
    xmasSculptures: total,
    xmasDistinctTypes: bestDistinct,
    xmasSimultaneous: bestSimultaneous,
    xmasSnowmen: bestSnowmen,
    xmasRabbits: bestRabbits,
    xmasOwls: bestOwls,
    xmasPenguins: bestPenguins,
  };

  return {
    records,
    total,
    distinctTypes: bestDistinct,
    maxSimultaneous: bestSimultaneous,
    snowmen: bestSnowmen,
    rabbits: bestRabbits,
    owls: bestOwls,
    penguins: bestPenguins,
    metrics,
  };
}
