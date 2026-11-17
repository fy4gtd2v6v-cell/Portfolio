import { describe, expect, it } from 'vitest';
import { depotNames, depotOf, groupByDepot, NO_DEPOT, summarize } from './portfolio';
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

describe('depots', () => {
  const buy = (q: number, c: number) => [{ id: `${q}-${c}`, date: '2026-01-01', quantity: q, totalCost: c }];
  const state = () => {
    const s = emptyState();
    s.holdings = [
      { id: 'a', assetClass: 'stock', name: 'A', isin: 'US0000000001', account: 'ING', purchases: buy(1, 100) },
      { id: 'b', assetClass: 'stock', name: 'B', isin: 'US0000000002', account: 'Trade Republic', purchases: buy(2, 100) },
      { id: 'c', assetClass: 'cash', name: 'Trade Republic', balance: 50, purchases: [] },
      { id: 'd', assetClass: 'crypto', name: 'BTC', coinId: 'bitcoin', purchases: buy(0.01, 500) },
      { id: 'e', assetClass: 'stock', name: 'C', isin: 'US0000000003', account: 'ING', purchases: [...buy(1, 10), { id: 'x', kind: 'sell' as const, date: '2026-02-01', quantity: 1, totalCost: 12 }] },
    ];
    s.quotes = {
      'isin:US0000000001': { eurPrice: 120, price: 120, currency: 'EUR', source: 'api', updatedAt: 'x' },
      'isin:US0000000002': { eurPrice: 40, price: 40, currency: 'EUR', source: 'api', updatedAt: 'x' },
      'crypto:bitcoin': { eurPrice: 60000, price: 60000, currency: 'EUR', source: 'api', updatedAt: 'x' },
    };
    return s;
  };

  it('puts an account without depot into the depot of its name and manual positions last', () => {
    const s = state();
    expect(s.holdings.map(depotOf)).toEqual(['ING', 'Trade Republic', 'Trade Republic', NO_DEPOT, 'ING']);
  });

  it('sums value, invested and gain per depot, largest first; closed positions do not count', () => {
    const g = groupByDepot(state());
    expect(g.map((x) => [x.depot, x.count, x.value, x.cost, x.gain, x.holdings.length])).toEqual([
      ['Trade Republic', 2, 130, 100, -20, 2],
      ['ING', 1, 120, 100, 20, 2],
      [NO_DEPOT, 1, 600, 500, 100, 1],
    ]);
  });

  it('lists the depot names in use', () => {
    expect(depotNames(state())).toEqual(['ING', 'Trade Republic']);
  });
});
