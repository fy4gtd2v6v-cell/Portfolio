import { describe, expect, it } from 'vitest';
import { decodeBytes, detectDelimiter, normalizeHeader, parseAmount, parseCsv, parseDate } from './csv';

describe('decodeBytes', () => {
  it('reads UTF-8 (with BOM) and falls back to Windows-1252', () => {
    const utf8 = new TextEncoder().encode('﻿Währung;Stück');
    expect(decodeBytes(utf8.buffer as ArrayBuffer)).toBe('Währung;Stück');
    const latin1 = new Uint8Array([0x57, 0xe4, 0x68, 0x72, 0x75, 0x6e, 0x67, 0x3b, 0x80]); // "Währung;€" in Windows-1252
    expect(decodeBytes(latin1.buffer as ArrayBuffer)).toBe('Währung;€');
  });
});

describe('parseCsv', () => {
  it('detects the delimiter', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('Betrag;Text\n"1,50";"a, b"\n"2,50";"c"')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
  });
  it('handles quotes, doubled quotes, line breaks in fields and blank lines', () => {
    const rows = parseCsv('"Name";"Text"\r\n"Müller ""GmbH""";"Zeile 1\nZeile 2"\r\n\r\n"x";"a;b"\r\n');
    expect(rows).toEqual([['Name', 'Text'], ['Müller "GmbH"', 'Zeile 1\nZeile 2'], ['x', 'a;b']]);
  });
});

describe('parseAmount', () => {
  it('reads German and English notation', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('-1.234,56 EUR')).toBe(-1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('123,45-')).toBe(-123.45);
    expect(parseAmount('+50,00 €')).toBe(50);
    expect(parseAmount('2.500')).toBe(2500);
    expect(parseAmount('0.05')).toBe(0.05);
    expect(parseAmount('12,5 %')).toBe(12.5);
    expect(parseAmount("1'234.50")).toBe(1234.5);
    expect(parseAmount('33,930 Stk.')).toBe(33.93);
  });
  it('rejects text', () => {
    expect(parseAmount('')).toBeNaN();
    expect(parseAmount('n/a')).toBeNaN();
    expect(parseAmount('DE12345')).toBeNaN();
    expect(parseAmount('-')).toBeNaN();
  });
});

describe('parseDate', () => {
  it('reads the usual formats', () => {
    expect(parseDate('24.12.2025')).toBe('2025-12-24');
    expect(parseDate('24.12.25')).toBe('2025-12-24');
    expect(parseDate('1.2.2026')).toBe('2026-02-01');
    expect(parseDate('2025-12-24')).toBe('2025-12-24');
    expect(parseDate('2025-12-24T10:15:00Z')).toBe('2025-12-24');
    expect(parseDate('24/12/2025')).toBe('2025-12-24');
    expect(parseDate('24.12.2025 10:15')).toBe('2025-12-24');
  });
  it('rejects impossible dates and text', () => {
    expect(parseDate('31.02.2025')).toBeUndefined();
    expect(parseDate('13.13.2025')).toBeUndefined();
    expect(parseDate('Umsatz')).toBeUndefined();
    expect(parseDate('')).toBeUndefined();
  });
});

describe('normalizeHeader', () => {
  it('ignores case, umlaut spelling and punctuation', () => {
    expect(normalizeHeader('Währung')).toBe(normalizeHeader('WAEHRUNG'));
    expect(normalizeHeader('Stück/Nominale')).toBe('stuecknominale');
    expect(normalizeHeader('BIC (SWIFT-Code)')).toBe('bicswiftcode');
  });
});
