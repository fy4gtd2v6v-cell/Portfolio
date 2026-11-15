import { describe, expect, it } from 'vitest';
import { applyFifo, summarize, valueHolding, withSnapshot } from './portfolio';
import { emptyState, Holding, PortfolioState, Purchase } from './types';

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

const buy = (id: string, date: string, quantity: number, totalCost: number): Purchase => ({ id, kind: 'buy', date, quantity, totalCost });
const sell = (id: string, date: string, quantity: number, totalCost: number): Purchase => ({ id, kind: 'sell', date, quantity, totalCost });

describe('applyFifo', () => {
  it('sells the oldest lots first', () => {
    // 100 g @ 60 €/g, then 50 g @ 80 €/g; sell 120 g for 9.600 €
    const r = applyFifo([buy('a', '2024-01-01', 100, 6000), buy('b', '2025-01-01', 50, 4000), sell('s', '2026-01-01', 120, 9600)]);
    expect(r.quantity).toBeCloseTo(30, 9);
    expect(r.cost).toBeCloseTo(2400, 9); // 30 g left from the 80 €/g lot
    expect(r.realized).toBeCloseTo(9600 - (6000 + 20 * 80), 9);
    expect(r.proceeds).toBe(9600);
    expect(r.oversoldBy).toBeUndefined();
  });
  it('orders by date, not by entry order', () => {
    const r = applyFifo([buy('b', '2025-01-01', 1, 200), sell('s', '2025-06-01', 1, 150), buy('a', '2024-01-01', 1, 100)]);
    expect(r.realized).toBeCloseTo(50, 9);
    expect(r.cost).toBeCloseTo(200, 9);
  });
  it('flags a sale that exceeds the holding at that date', () => {
    const r = applyFifo([sell('s', '2024-01-01', 1, 100), buy('a', '2024-06-01', 1, 50)]);
    expect(r.oversoldBy).toBe('s');
  });
  it('treats transactions without kind as purchases (old data)', () => {
    const r = applyFifo([{ id: 'x', date: '2024-01-01', quantity: 2, totalCost: 10 }]);
    expect(r.quantity).toBe(2);
  });
});

describe('closed positions', () => {
  it('have value 0, keep realized gain and are not reported as unpriced', () => {
    const st = state();
    st.holdings = [{ ...sap, purchases: [buy('a', '2024-01-01', 10, 1500), sell('b', '2025-01-01', 10, 2000)] }];
    const v = valueHolding(st.holdings[0], st);
    expect(v.closed).toBe(true);
    expect(v.value).toBe(0);
    expect(v.realized).toBe(500);
    const s = summarize(st);
    expect(s.unpriced).toEqual([]);
    expect(s.realized).toBe(500);
    expect(s.byClass).toEqual([]);
  });
});

describe('withSnapshot', () => {
  const priced = () => ({ ...state(), holdings: [gold, btc] });
  it('adds one entry per day and replaces it on later updates', () => {
    let st = withSnapshot(priced(), '2026-11-14');
    expect(st.history).toHaveLength(1);
    expect(st.history[0]).toMatchObject({ date: '2026-11-14', value: 36998.8, cost: 30000 });
    expect(withSnapshot(st, '2026-11-14')).toBe(st); // unchanged -> same object
    st = withSnapshot({ ...st, metalPrices: { gold: { eurPerGram: 90, updatedAt: 'x' } } }, '2026-11-14');
    expect(st.history).toHaveLength(1);
    expect(st.history[0].value).toBeCloseTo(149.985 * 90 + 25000, 2);
    st = withSnapshot(st, '2026-11-15');
    expect(st.history.map((h) => h.date)).toEqual(['2026-11-14', '2026-11-15']);
  });
  it('skips days with unpriced open positions', () => {
    const st = state(); // SAP has no price
    expect(withSnapshot(st, '2026-11-14')).toBe(st);
  });
});
