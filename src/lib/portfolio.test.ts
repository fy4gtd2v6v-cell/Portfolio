import { describe, expect, it } from 'vitest';
import { summarize, valueHolding } from './portfolio';
import { emptyState, Holding, PortfolioState } from './types';

const gold: Holding = {
  id: 'g', assetClass: 'metal', name: 'Goldbarren', metal: 'gold', fineness: 999.9,
  purchases: [
    { id: 'p1', date: '2024-01-01', quantity: 100, totalCost: 6000 },
    { id: 'p2', date: '2025-01-01', quantity: 50, totalCost: 4000 },
  ],
};
const btc: Holding = {
  id: 'b', assetClass: 'crypto', name: 'Bitcoin', coinId: 'bitcoin',
  purchases: [{ id: 'p3', date: '2024-01-01', quantity: 0.5, totalCost: 20000 }],
};
const sap: Holding = {
  id: 's', assetClass: 'stock', name: 'SAP', symbol: 'SAP.DEX', currency: 'EUR',
  purchases: [{ id: 'p4', date: '2024-01-01', quantity: 10, totalCost: 1500 }],
};

function state(): PortfolioState {
  return {
    ...emptyState(),
    holdings: [gold, btc, sap],
    metalPrices: { gold: { eurPerGram: 80, updatedAt: '2026-11-01T00:00:00Z' } },
    quotes: { 'crypto:bitcoin': { eurPrice: 50000, price: 50000, currency: 'EUR', source: 'api', updatedAt: '2026-11-01T00:00:00Z' } },
  };
}

describe('valueHolding', () => {
  it('values metals by fine grams and the manual price per gram', () => {
    const v = valueHolding(gold, state());
    expect(v.quantity).toBe(150);
    expect(v.fineGrams).toBeCloseTo(149.985, 6);
    expect(v.value).toBeCloseTo(149.985 * 80, 6);
    expect(v.cost).toBe(10000);
    expect(v.gain).toBeCloseTo(11998.8 - 10000, 6);
  });
  it('values crypto from quotes', () => {
    const v = valueHolding(btc, state());
    expect(v.value).toBe(25000);
    expect(v.gainPct).toBeCloseTo(0.25, 10);
  });
  it('leaves value undefined without a price', () => {
    expect(valueHolding(sap, state()).value).toBeUndefined();
  });
});

describe('summarize', () => {
  it('totals priced holdings and lists unpriced ones', () => {
    const s = summarize(state());
    expect(s.totalValue).toBeCloseTo(11998.8 + 25000, 6);
    expect(s.pricedCost).toBe(30000);
    expect(s.totalCost).toBe(31500);
    expect(s.unpriced.map((h) => h.id)).toEqual(['s']);
    expect(s.byClass.map((c) => c.assetClass)).toEqual(['metal', 'stock', 'crypto']);
  });
});
