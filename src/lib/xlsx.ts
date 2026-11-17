/**
 * Minimal reader for the first worksheet of an .xlsx file (Office Open XML).
 *
 * An .xlsx file is a ZIP archive of XML files. The archive is unpacked with the
 * browser's own DecompressionStream, so no third-party library is needed. Cell
 * values come back as text the CSV importer understands: numbers with a decimal
 * comma ("1,4952"), date cells as "YYYY-MM-DD".
 */

export class XlsxError extends Error {}

/** True when the bytes look like a ZIP archive (as every .xlsx file is). */
export function isZip(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  return b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

// ---------- ZIP ----------

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  offset: number;
}

function listEntries(buf: ArrayBuffer): Map<string, Entry> {
  const view = new DataView(buf);
  // End of central directory: at the end, possibly followed by a comment of up to 64 KB.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError('Die Datei ist keine gültige Excel-Datei (.xlsx).');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, Entry>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new XlsxError('Die Excel-Datei ist beschädigt.');
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buf, p + 46, nameLen));
    entries.set(name, { name, method, compressedSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(buf: ArrayBuffer, e: Entry): Promise<string> {
  const view = new DataView(buf);
  if (view.getUint32(e.offset, true) !== 0x04034b50) throw new XlsxError('Die Excel-Datei ist beschädigt.');
  const start = e.offset + 30 + view.getUint16(e.offset + 26, true) + view.getUint16(e.offset + 28, true);
  const data = new Uint8Array(buf, start, e.compressedSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new XlsxError('Diese Excel-Datei ist auf eine nicht unterstützte Art gepackt.');
  if (typeof DecompressionStream === 'undefined') {
    throw new XlsxError('Dieser Browser kann Excel-Dateien nicht entpacken. Bitte die Datei als CSV speichern oder einen aktuellen Browser verwenden.');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

// ---------- XML helpers ----------

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    return String.fromCodePoint(k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });
}

const attr = (tag: string, name: string): string | undefined => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decodeEntities(m[1]) : undefined;
};

/** All text of the <t> elements inside a fragment, without phonetic hints. */
function textOf(fragment: string): string {
  const clean = fragment.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  for (const m of clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) out += m[1] ?? '';
  return decodeEntities(out);
}

// ---------- workbook ----------

/** Built-in number formats that show dates (ECMA-376, 18.8.30). */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function dateStyles(stylesXml: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!stylesXml) return out;
  const custom = new Map<number, string>();
  for (const m of stylesXml.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attr(m[0], 'numFmtId'));
    const code = attr(m[0], 'formatCode') ?? '';
    custom.set(id, code);
  }
  const isDate = (id: number) => {
    if (BUILTIN_DATE_FORMATS.has(id)) return true;
    const code = custom.get(id);
    if (!code) return false;
    // Drop quoted text and [colour]/[locale] parts, then look for day/month/year/hour letters.
    const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    return /[dmyh]/i.test(bare);
  };
  const cellXfs = stylesXml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0] ?? '';
  let i = 0;
  for (const m of cellXfs.matchAll(/<xf\b[^>]*?(?:\/>|>)/g)) {
    if (isDate(Number(attr(m[0], 'numFmtId') ?? 0))) out.add(i);
    i++;
  }
  return out;
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? '';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel serial day (1900 system) → "YYYY-MM-DD". */
function serialToDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000); // 25569 = days from 1899-12-30 to 1970-01-01
  return new Date(ms).toISOString().slice(0, 10);
}

/** A number as the importer reads it: decimal comma, no exponent, no float noise. */
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  const s = (Math.round(n * 1e10) / 1e10).toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s.replace('.', ',');
}

function firstSheetPath(workbookXml: string | undefined, relsXml: string | undefined, names: string[]): string {
  const fallback = names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))[0];
  const sheetTag = workbookXml?.match(/<sheet\b[^>]*>/)?.[0];
  const rid = sheetTag ? attr(sheetTag, 'r:id') : undefined;
  if (rid && relsXml) {
    for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
      if (attr(m[0], 'Id') === rid) {
        const target = attr(m[0], 'Target') ?? '';
        const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
        if (names.includes(path)) return path;
      }
    }
  }
  if (!fallback) throw new XlsxError('In der Excel-Datei wurde kein Tabellenblatt gefunden.');
  return fallback;
}

/** Rows of the first worksheet as text cells. */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const entries = listEntries(buf);
  const read = async (name: string) => (entries.has(name) ? readEntry(buf, entries.get(name)!) : undefined);
  const [workbook, rels, shared, styles] = await Promise.all([
    read('xl/workbook.xml'),
    read('xl/_rels/workbook.xml.rels'),
    read('xl/sharedStrings.xml'),
    read('xl/styles.xml'),
  ]);
  const sheetXml = await read(firstSheetPath(workbook, rels, [...entries.keys()]));
  if (!sheetXml) throw new XlsxError('In der Excel-Datei wurde kein Tabellenblatt gefunden.');

  const strings = shared ? [...shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map((m) => textOf(m[1] ?? '')) : [];
  const dates = dateStyles(styles);

  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
    const rowNumber = Number(attr(`<row${rowMatch[1] ?? ''}>`, 'r') ?? rows.length + 1);
    const cells: string[] = [];
    let next = 0;
    for (const c of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = `<c${c[1]}>`;
      const inner = c[2] ?? '';
      const ref = attr(tag, 'r');
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      const type = attr(tag, 't') ?? 'n';
      const style = Number(attr(tag, 's') ?? 0);
      const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's') value = strings[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOf(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '');
      else if (type === 'str') value = decodeEntities(raw ?? '');
      else if (type === 'b') value = raw === '1' ? 'WAHR' : 'FALSCH';
      else if (type === 'e') value = '';
      else if (raw !== undefined && raw !== '') {
        const n = Number(raw);
        value = dates.has(style) && Number.isFinite(n) ? serialToDate(n) : formatNumber(n);
      }
      cells[col] = value.trim();
    }
    // Keep the row position, so empty rows in the sheet do not shift anything.
    while (rows.length < rowNumber - 1) rows.push([]);
    rows.push(Array.from(cells, (v) => v ?? ''));
  }
  return rows.filter((r) => r.some((v) => v !== ''));
}
