import { describe, expect, it } from 'vitest';
import { rankSymbolMatches, searchTerm } from './symbols';

const m = (symbol: string, region: string, currency: string) => ({ symbol, name: symbol, region, currency });

describe('searchTerm', () => {
  it('strips share-class and currency noise from broker names', () => {
    expect(searchTerm('Junior Gold Miners USD (Acc)')).toBe('Junior Gold Miners');
    expect(searchTerm('MSCI World USD (Acc)')).toBe('MSCI World');
    expect(searchTerm('NVIDIA')).toBe('NVIDIA');
    expect(searchTerm('Bloom Energy')).toBe('Bloom Energy');
  });
});

describe('rankSymbolMatches', () => {
  const matches = [m('1ZB.FRK', 'Frankfurt', 'EUR'), m('0A4L.LON', 'United Kingdom', 'GBX'), m('BE', 'United States', 'USD'), m('1ZB.DEX', 'XETRA', 'EUR')];

  it('prefers the US listing for US shares', () => {
    expect(rankSymbolMatches(matches, 'US0937121079').map((x) => x.symbol)).toEqual(['BE', '1ZB.DEX', '1ZB.FRK']);
  });
  it('prefers Xetra in euros for everything else', () => {
    expect(rankSymbolMatches(matches, 'IE00BJ0KDQ92').map((x) => x.symbol)).toEqual(['1ZB.DEX', '1ZB.FRK', 'BE']);
  });
  it('drops prices in pence the app cannot convert', () => {
    expect(rankSymbolMatches(matches).some((x) => x.currency === 'GBX')).toBe(false);
  });
});
