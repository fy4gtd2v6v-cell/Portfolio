import { describe, expect, it } from 'vitest';
import { summarize } from './portfolio';
import { categoryOf, emptyState, Holding } from './types';

const stock = (name: string, securityType?: 'stock' | 'etf'): Holding => ({ id: name, assetClass: 'stock', name, securityType, purchases: [] });

describe('categoryOf', () => {
  it('separates shares from funds, by import data or by name', () => {
    expect(categoryOf(stock('NVIDIA'))).toBe('stock');
    expect(categoryOf(stock('MSCI World USD (Acc)'))).toBe('etf');
    expect(categoryOf(stock('iShares Core MSCI World'))).toBe('etf');
    expect(categoryOf(stock('Private Equity'))).toBe('etf');
    expect(categoryOf(stock('Some Fund', 'stock'))).toBe('stock'); // explicit choice wins
    expect(categoryOf(stock('Bloom Energy', 'etf'))).toBe('etf');
  });
  it('gives every metal its own category', () => {
    for (const metal of ['gold', 'silver', 'platinum', 'palladium'] as const) {
      expect(categoryOf({ assetClass: 'metal', metal, name: 'x' })).toBe(metal);
    }
    expect(categoryOf({ assetClass: 'crypto', name: 'BTC' })).toBe('crypto');
    expect(categoryOf({ assetClass: 'cash', name: 'Konto' })).toBe('cash');
  });
});

describe('summary by category', () => {
  it('splits classes into categories in chart order', () => {
    const s = emptyState();
    s.holdings = [
      { id: 'g', assetClass: 'metal', name: 'Gold', metal: 'gold', fineness: 1000, purchases: [{ id: 'p', date: '2026-01-01', quantity: 1, totalCost: 100 }] },
      { id: 's', assetClass: 'metal', name: 'Silber', metal: 'silver', fineness: 1000, purchases: [{ id: 'q', date: '2026-01-01', quantity: 10, totalCost: 10 }] },
      { id: 'c', assetClass: 'cash', name: 'Konto', balance: 50, purchases: [] },
    ];
    s.metalPrices = { gold: { eurPerGram: 110, updatedAt: 'x' }, silver: { eurPerGram: 1.5, updatedAt: 'x' } };
    const sum = summarize(s);
    expect(sum.byCategory.map((c) => [c.category, c.value, c.cost])).toEqual([['gold', 110, 100], ['silver', 15, 10], ['cash', 50, 0]]);
  });
});
