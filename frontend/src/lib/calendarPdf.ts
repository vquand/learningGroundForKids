import type { CalendarWindow, CalendarWeatherResponse } from '../types/calendar';
import type { UiLanguage } from './uiLanguage';
import { uiText } from '../i18n/uiText';
import { buildCalendarExportPages, type CalendarExportEntry, type CalendarExportPage } from './calendarExportModel';
import { calendarPdfFile, type CalendarPdfImage } from './calendarPdfFile';

const FONT = 'Nunito, system-ui, sans-serif';
const MARGIN = 28, LABEL_WIDTH = 100, GAP = 6, HEADER = 104, ITEM_GAP = 7, ICON = 25, TEXT = 15, LINE = 19;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
interface EntryLayout { entry: CalendarExportEntry; lines: string[]; height: number }
interface CellLayout { main: EntryLayout[]; clubs: EntryLayout[]; mainHeight: number; clubHeight: number }
interface RowLayout { cells: CellLayout[]; height: number; clubHeight: number }
const sumHeight = (entries: EntryLayout[]) => entries.reduce((sum, e) => sum + e.height + ITEM_GAP, 0);
function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  // NFC keeps Vietnamese accents attached when long words need a hard wrap.
  return text.split('\n').flatMap(paragraph => {
    const lines: string[] = []; let line = '';
    for (const word of paragraph.split(/\s+/u)) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width <= width) { line = next; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const segment of word.normalize('NFC')) {
        if (line && context.measureText(line + segment).width > width) { lines.push(line); line = ''; }
        line += segment;
      }
    }
    if (line) lines.push(line);
    return lines;
  });
}
function pageLayout(context: CanvasRenderingContext2D, page: CalendarExportPage, width: number): RowLayout[] {
  context.font = `600 ${TEXT}px ${FONT}`;
  const cellWidth = (width - MARGIN * 2 - LABEL_WIDTH - GAP * 7) / 7;
  return page.rows.map(row => {
    const cells = row.cells.map(entries => {
      const layouts = entries.map(entry => { const lines = wrap(context, entry.label, cellWidth - ICON - 24); return { entry, lines, height: Math.max(ICON, lines.length * LINE) }; });
      const main = row.clubs ? layouts.filter(e => !e.entry.club) : layouts;
      const clubs = row.clubs ? layouts.filter(e => e.entry.club) : [];
      return { main, clubs, mainHeight: sumHeight(main), clubHeight: sumHeight(clubs) };
    });
    const clubHeight = Math.max(0, ...cells.map(c => c.clubHeight));
    const mainHeight = Math.max(0, ...cells.map(c => c.mainHeight));
    return { cells, clubHeight, height: Math.max(74, mainHeight + (clubHeight ? clubHeight + 14 : 0) + 16) };
  });
}
function dateLabel(date: string, language: UiLanguage): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, border?: string) {
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); }
}
async function loadArt(art: string, signal: AbortSignal): Promise<ImageBitmap> {
  if (!/^\/calendar\/icons\/[a-z0-9_/-]+\.webp$/.test(art)) throw new Error('Invalid calendar artwork.');
  const response = await fetch(art, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error('Could not load calendar artwork.');
  return createImageBitmap(await response.blob());
}
function drawPage(ctx: CanvasRenderingContext2D, page: CalendarExportPage, layout: RowLayout[], width: number, height: number, art: Map<string, ImageBitmap>, language: UiLanguage) {
  fillRect(ctx, 0, 0, width, height, '#fffdf7');
  ctx.textBaseline = 'top'; ctx.fillStyle = '#17324d'; ctx.font = `800 27px ${FONT}`; ctx.fillText(page.title, MARGIN, 22);
  ctx.font = `600 15px ${FONT}`; ctx.fillText(`${dateLabel(page.start, language)} – ${dateLabel(page.end, language)}`, MARGIN, 56);
  const cellWidth = (width - MARGIN * 2 - LABEL_WIDTH - GAP * 7) / 7;
  page.days.forEach((day, i) => {
    const x = MARGIN + LABEL_WIDTH + GAP + i * (cellWidth + GAP);
    fillRect(ctx, x, HEADER - 25, cellWidth, 48, day.today ? '#dff0e8' : day.weekday >= 6 ? '#fff0dc' : '#f0f5ec', '#c7d7c8');
    ctx.fillStyle = '#17324d'; ctx.font = `800 14px ${FONT}`; ctx.fillText(uiText(WEEKDAYS[day.weekday - 1] ?? 'Monday', language), x + 8, HEADER - 18);
    ctx.font = `600 13px ${FONT}`; ctx.fillText(dateLabel(day.date, language), x + 8, HEADER + 2);
  });
  let y = HEADER + 29;
  const extra = Math.max(0, (height - MARGIN - y - layout.reduce((sum, row) => sum + row.height + GAP, 0)) / layout.length);
  const drawEntry = (entry: EntryLayout, x: number, y: number) => {
    const image = art.get(entry.entry.art); if (image) ctx.drawImage(image, x, y, ICON, ICON);
    ctx.fillStyle = '#17324d'; ctx.font = `600 ${TEXT}px ${FONT}`;
    entry.lines.forEach((line, i) => ctx.fillText(line, x + ICON + 6, y + i * LINE + 1));
  };
  layout.forEach((row, index) => {
    const rowHeight = row.height + extra;
    fillRect(ctx, MARGIN, y, LABEL_WIDTH, rowHeight, '#e7efe5', '#c7d7c8');
    ctx.fillStyle = '#17324d'; ctx.font = `800 15px ${FONT}`;
    wrap(ctx, page.rows[index]!.label, LABEL_WIDTH - 16).forEach((line, i) => ctx.fillText(line, MARGIN + 8, y + 14 + i * LINE));
    row.cells.forEach((cell, i) => {
      const x = MARGIN + LABEL_WIDTH + GAP + i * (cellWidth + GAP); const day = page.days[i]!;
      fillRect(ctx, x, y, cellWidth, rowHeight, day.weekday >= 6 ? '#fff5e9' : '#f7faf4', day.today ? '#397367' : '#d5dfd0');
      let itemY = y + 8;
      cell.main.forEach(entry => { drawEntry(entry, x + 8, itemY); itemY += entry.height + ITEM_GAP; });
      if (cell.clubs.length) {
        const top = y + rowHeight - row.clubHeight - 14;
        ctx.strokeStyle = '#afc4b0'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x + 8, top); ctx.lineTo(x + cellWidth - 8, top); ctx.stroke(); ctx.setLineDash([]);
        itemY = y + rowHeight - cell.clubHeight - 6;
        cell.clubs.forEach(entry => { drawEntry(entry, x + 8, itemY); itemY += entry.height + ITEM_GAP; });
      }
    });
    y += rowHeight + GAP;
  });
}

/** A purpose-built six-page document. It never captures the screen, navigation or editor controls. */
export async function exportCalendarPdf(data: CalendarWindow, language: UiLanguage, signal: AbortSignal, weather?: CalendarWeatherResponse): Promise<Blob> {
  const pages = buildCalendarExportPages(data, language, weather);
  await document.fonts.ready; signal.throwIfAborted();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable.');
  let width = 1190, height = 842;
  // Grow the landscape sheet for dense calendars; retain full labels and readable type instead of truncating entries.
  let layouts = pages.map(page => pageLayout(ctx, page, width));
  while (layouts.some(rows => HEADER + MARGIN + 32 + rows.reduce((sum, row) => sum + row.height + GAP, 0) > height)) {
    width = Math.ceil(width * 1.15); height = Math.ceil(width * 842 / 1190); layouts = pages.map(page => pageLayout(ctx, page, width));
    signal.throwIfAborted();
  }
  const images = new Map<string, ImageBitmap>();
  const urls = [...new Set(pages.flatMap(p => p.rows.flatMap(r => r.cells.flat().map(e => e.art))))];
  try {
    // Bounded decode concurrency and a reused canvas keep memory bounded on iPads.
    let cursor = 0;
    const loaded = await Promise.allSettled(Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (cursor < urls.length) { const url = urls[cursor++]!; images.set(url, await loadArt(url, signal)); }
    }));
    const failed = loaded.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    signal.throwIfAborted();
    const scale = Math.min(2, Math.sqrt(12_000_000 / (width * height)), 8192 / Math.max(width, height));
    canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
    const results: CalendarPdfImage[] = [];
    for (const [index, page] of pages.entries()) {
      signal.throwIfAborted(); ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawPage(ctx, page, layouts[index]!, width, height, images, language);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode calendar.')), 'image/jpeg', .94));
      results.push({ bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }
    signal.throwIfAborted(); return calendarPdfFile(results, width * 842 / 1190, height * 842 / 1190);
  } finally { images.forEach(image => image.close()); canvas.width = canvas.height = 0; }
}
