import { describe, expect, it } from 'vitest';
import { buildXlsx, sheetFiles } from './xlsxTestFiles';
import { isZip, readXlsx, XlsxError } from './xlsx';

describe('readXlsx', () => {
  const files = sheetFiles(
    ['Name', 'Menge', 'Datum', 'Müller &amp; Söhne'],
    `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
     <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>33.4403</v></c><c r="C2" s="1"><v>46329</v></c></row>
     <row r="4"><c r="A4" t="inlineStr"><is><t>inline</t></is></c><c r="C4" s="2"><v>46000.75</v></c><c r="D4"><v>1.5E-3</v></c></row>`,
  );

  it('reads strings, numbers (decimal comma), dates and skips gaps', async () => {
    const rows = await readXlsx(await buildXlsx(files));
    expect(rows).toEqual([
      ['Name', 'Menge', 'Datum'],
      ['Müller & Söhne', '33,4403', '2026-11-03'],
      ['inline', '', '2025-12-09', '0,0015'],
    ]);
  });

  it('reads uncompressed archives too', async () => {
    expect((await readXlsx(await buildXlsx(files, false)))[1][1]).toBe('33,4403');
  });

  it('recognises ZIP files and rejects other data', async () => {
    expect(isZip(await buildXlsx(files))).toBe(true);
    const text = new TextEncoder().encode('Datum;Betrag').buffer as ArrayBuffer;
    expect(isZip(text)).toBe(false);
    await expect(readXlsx(text)).rejects.toBeInstanceOf(XlsxError);
  });
});
