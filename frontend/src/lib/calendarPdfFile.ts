/** Minimal PDF 1.4 container for separately composed calendar pages (JPEG image XObjects).
 * ISO 32000-1 sections 7.5 (file structure) and 8.9 (images). Offsets count bytes, never JS characters.
 */
export interface CalendarPdfImage { bytes: Uint8Array; width: number; height: number }
export function calendarPdfFile(pages: readonly CalendarPdfImage[], widthPoints: number, heightPoints: number): Blob {
  if (pages.length !== 6 || widthPoints <= heightPoints || !Number.isFinite(widthPoints) || heightPoints <= 0) throw new Error('Expected six landscape pages.');
  const encode = (value: string) => new TextEncoder().encode(value);
  const chunks: Uint8Array[] = [];
  let length = 0;
  const offsets: number[] = [0];
  const append = (value: string | Uint8Array) => { const bytes = typeof value === 'string' ? encode(value) : value; chunks.push(bytes); length += bytes.length; };
  const object = (id: number, body: () => void) => { offsets[id] = length; append(`${id} 0 obj\n`); body(); append('\nendobj\n'); };
  append('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, () => append('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, () => append(`<< /Type /Pages /Count 6 /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`));
  pages.forEach((page, index) => {
    const id = 3 + index * 3;
    object(id, () => append(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPoints.toFixed(2)} ${heightPoints.toFixed(2)}] /Resources << /XObject << /Calendar ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`));
    const stream = `q\n${widthPoints.toFixed(2)} 0 0 ${heightPoints.toFixed(2)} 0 0 cm\n/Calendar Do\nQ\n`;
    object(id + 1, () => append(`<< /Length ${encode(stream).length} >>\nstream\n${stream}endstream`));
    object(id + 2, () => { append(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`); append(page.bytes); append('\nendstream'); });
  });
  const xref = length;
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach(offset => append(`${String(offset).padStart(10, '0')} 00000 n \n`));
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}
