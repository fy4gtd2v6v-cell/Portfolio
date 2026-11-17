/** Reading bank export files: text decoding, CSV parsing, German numbers and dates. */

/** Bank exports are often ISO-8859-1/Windows-1252 rather than UTF-8; try UTF-8 strictly first. */
export function decodeBytes(buf: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1252').decode(buf);
  }
  return text.replace(/^﻿/, '');
}

/** The separator that splits the first lines most consistently. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 40);
  let best = ';';
  let bestScore = -1;
  for (const d of [';', ',', '\t', '|']) {
    const counts = lines.map((l) => splitLine(l, d).length - 1);
    const max = Math.max(0, ...counts);
    if (max === 0) continue;
    // Many lines with the same (maximal) number of separators = a table.
    const score = counts.filter((c) => c === max).length * max;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

function splitLine(line: string, delimiter: string): string[] {
  return parseCsv(line, delimiter)[0] ?? [];
}

/** RFC-4180 style parser: quoted fields, doubled quotes, line breaks inside quotes. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

/**
 * Amounts as banks write them: "1.234,56", "-1.234,56 EUR", "1,234.56", "123,45-", "12,5 %".
 * Returns NaN when the text is not a number.
 */
export function parseAmount(input: string): number {
  let s = (input ?? '').replace(/[\s ]/g, '').replace(/[€$%]|EUR|USD|GBP|CHF|Stk\.?|St\.?/gi, '');
  if (!s) return NaN;
  let negative = false;
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^-?[\d.,']+$/.test(s) || !/\d/.test(s)) return NaN;
  s = s.replace(/'/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: the later one is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // German files: a lone comma is the decimal separator.
    s = s.replace(/\./g, '').replace(/,(?=.*,)/g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ''); // "1.234" in a German file means 1234
  }
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : NaN;
}

/** "24.12.2025", "24.12.25", "2025-12-24", "2025-12-24T10:00:00Z", "24/12/2025" → "2025-12-24"; otherwise undefined. */
export function parseDate(input: string): string | undefined {
  const s = (input ?? '').trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})(?:\s.*)?$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += y < 70 ? 2000 : 1900;
  } else {
    return undefined;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Compare column titles regardless of case, umlaut spelling and punctuation: "Währung" = "Waehrung" = "WAEHRUNG". */
export function normalizeHeader(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}
