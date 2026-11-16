import { describe, expect, it } from 'vitest';
import { carryPrevDay, fetchEurRates, fetchMetalPricesEur, FetchFn, metalChangePct, refreshQuotes } from './prices';
import { emptyState, PortfolioState } from './types';

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function mockFetch(routes: Record<string, unknown>): FetchFn & { calls: string[] } {
  const calls: string[] = [];
  const f = ((url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    return key ? json(routes[key]) : json({}, 404);
  }) as FetchFn & { calls: string[] };
  f.calls = calls;
  return f;
}

const base = (): PortfolioState => ({
  ...emptyState(),
  settings: { alphaVantageKey: 'demo', coingeckoKey: '', metalMode: 'live', autoRefresh: true },
  holdings: [
    { id: '1', assetClass: 'crypto', name: 'Bitcoin', coinId: 'bitcoin', purchases: [] },
    { id: '2', assetClass: 'stock', name: 'Apple', symbol: 'AAPL', currency: 'USD', purchases: [] },
    { id: '3', assetClass: 'stock', name: 'SAP', symbol: 'SAP.DEX', currency: 'EUR', purchases: [] },
  ],
});

const now = () => new Date('2026-11-14T10:00:00Z');

describe('fetchEurRates', () => {
  it('inverts EUR-based rates', async () => {
    const f = mockFetch({ frankfurter: { rates: { USD: 1.25 } } });
    const r = await fetchEurRates(['USD', 'EUR'], f);
    expect(r).toEqual({ EUR: 1, USD: 0.8 });
  });
});

describe('refreshQuotes', () => {
  it('fetches crypto and stock prices and converts to EUR', async () => {
    const f = mockFetch({
      'simple/price': { bitcoin: { eur: 60000 } },
      frankfurter: { rates: { USD: 1.25 } },
      'symbol=AAPL': { 'Global Quote': { '05. price': '200.00' } },
      'symbol=SAP.DEX': { 'Global Quote': { '05. price': '230.50' } },
    });
    const r = await refreshQuotes(base(), { f, stockDelayMs: 0, now });
    expect(r.errors).toEqual([]);
    expect(r.updated).toBe(3);
    expect(r.quotes['crypto:bitcoin'].eurPrice).toBe(60000);
    expect(r.quotes['stock:AAPL']).toMatchObject({ price: 200, currency: 'USD', eurPrice: 160, source: 'api' });
    expect(r.quotes['stock:SAP.DEX'].eurPrice).toBe(230.5);
  });

  it('stops querying stocks once the Alpha Vantage quota is used up', async () => {
    const f = mockFetch({
      'simple/price': { bitcoin: { eur: 60000 } },
      frankfurter: { rates: { USD: 1.25 } },
      alphavantage: { Information: 'We have detected your API key as ... 25 requests per day.' },
    });
    const s = base();
    s.quotes['stock:SAP.DEX'] = { eurPrice: 1, price: 1, currency: 'EUR', source: 'manual', updatedAt: 'x' };
    const r = await refreshQuotes(s, { f, stockDelayMs: 0, now });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/Tageslimit/);
    expect(f.calls.filter((c) => c.includes('alphavantage'))).toHaveLength(1);
    expect(r.quotes['stock:SAP.DEX'].source).toBe('manual'); // kept
  });

  it('reports a missing API key', async () => {
    const s = base();
    s.settings.alphaVantageKey = '';
    const f = mockFetch({ 'simple/price': { bitcoin: { eur: 1 } }, frankfurter: { rates: { USD: 1 } } });
    const r = await refreshQuotes(s, { f, stockDelayMs: 0, now });
    expect(r.errors[0]).toMatch(/API-Key/);
  });
});

describe('metal prices', () => {
  const goldHolding = { id: 'g', assetClass: 'metal' as const, name: 'Barren', metal: 'gold' as const, fineness: 999.9, purchases: [] };
  const routes = {
    'price/XAU': { currency: 'USD', price: 3110.34768, symbol: 'XAU', updatedAt: '2026-11-15T17:11:57Z' },
    'price/XAG': { currency: 'USD', price: 31.1034768, symbol: 'XAG' },
    frankfurter: { rates: { USD: 1.25 } },
  };

  it('converts USD per troy ounce into EUR per gram', async () => {
    const p = await fetchMetalPricesEur(['gold', 'silver'], mockFetch(routes));
    expect(p.gold).toMatchObject({ source: 'api', updatedAt: '2026-11-15T17:11:57Z' });
    expect(p.gold!.eurPerGram).toBeCloseTo(80, 9); // 3110.35 $/oz * 0.8 €/$ / 31.1035 g
    expect(p.silver!.eurPerGram).toBeCloseTo(0.8, 9);
  });

  it('refreshes the metals of the holdings in live mode', async () => {
    const s = { ...emptyState(), holdings: [goldHolding] };
    const f = mockFetch(routes);
    const r = await refreshQuotes(s, { f, now });
    expect(r.errors).toEqual([]);
    expect(r.metalPrices.gold!.eurPerGram).toBeCloseTo(80, 9);
    expect(f.calls.some((c) => c.includes('XAG'))).toBe(false); // only metals that are held
  });

  it('leaves manual prices alone in manual mode', async () => {
    const s = { ...emptyState(), holdings: [goldHolding] };
    s.settings.metalMode = 'manual';
    s.metalPrices.gold = { eurPerGram: 75, updatedAt: 'x', source: 'manual' };
    const f = mockFetch(routes);
    const r = await refreshQuotes(s, { f, now });
    expect(r.metalPrices.gold!.eurPerGram).toBe(75);
    expect(f.calls).toEqual([]);
  });

  it('reports a metal the service cannot price and keeps the old value', async () => {
    const s = { ...emptyState(), holdings: [{ ...goldHolding, metal: 'platinum' as const }] };
    s.metalPrices.platinum = { eurPerGram: 40, updatedAt: 'x', source: 'api' };
    const r = await refreshQuotes(s, { f: mockFetch({ frankfurter: { rates: { USD: 1.25 } } }), now });
    expect(r.errors[0]).toMatch(/Edelmetalle/);
    expect(r.metalPrices.platinum!.eurPerGram).toBe(40);
  });
});

describe('daily change', () => {
  it('reads the 24 h change for crypto and the change since the previous close for stocks', async () => {
    const f = mockFetch({
      'simple/price': { bitcoin: { eur: 60000, eur_24h_change: -2.5 } },
      frankfurter: { rates: { USD: 1.25 } },
      'symbol=AAPL': { 'Global Quote': { '05. price': '200.00', '10. change percent': '1.0054%' } },
      'symbol=SAP.DEX': { 'Global Quote': { '05. price': '230.50' } },
    });
    const r = await refreshQuotes(base(), { f, stockDelayMs: 0, now });
    expect(f.calls.find((c) => c.includes('simple/price'))).toContain('include_24hr_change=true');
    expect(r.quotes['crypto:bitcoin'].changePct).toBeCloseTo(-0.025, 10);
    expect(r.quotes['stock:AAPL'].changePct).toBeCloseTo(0.010054, 10);
    expect(r.quotes['stock:SAP.DEX'].changePct).toBeUndefined();
  });
});

describe('automatic refresh', () => {
  it('leaves stocks out and keeps their stored quotes', async () => {
    const s = base();
    s.quotes['stock:AAPL'] = { eurPrice: 150, price: 187.5, currency: 'USD', source: 'api', updatedAt: 'x' };
    const f = mockFetch({ 'simple/price': { bitcoin: { eur: 60000 } } });
    const r = await refreshQuotes(s, { f, now, skipStocks: true });
    expect(f.calls.some((c) => c.includes('alphavantage'))).toBe(false);
    expect(f.calls.some((c) => c.includes('frankfurter'))).toBe(false); // no stocks, no metals: no FX needed
    expect(r.quotes['stock:AAPL'].eurPrice).toBe(150);
    expect(r.quotes['crypto:bitcoin'].eurPrice).toBe(60000);
    expect(r.errors).toEqual([]);
  });

  it('reuses exchange rates within fxMaxAgeMs', async () => {
    const gold = { id: 'g', assetClass: 'metal' as const, name: 'Barren', metal: 'gold' as const, fineness: 999.9, purchases: [] };
    const s = { ...emptyState(), holdings: [gold] };
    const routes = { 'price/XAU': { currency: 'USD', price: 3110.34768 }, frankfurter: { rates: { USD: 1.25 } } };
    const f1 = mockFetch(routes);
    await refreshQuotes(s, { f: f1, now, fxMaxAgeMs: 60_000 });
    const f2 = mockFetch(routes);
    const r = await refreshQuotes(s, { f: f2, now, fxMaxAgeMs: 60_000 });
    expect(f1.calls.filter((c) => c.includes('frankfurter'))).toHaveLength(1);
    expect(f2.calls.filter((c) => c.includes('frankfurter'))).toHaveLength(0);
    expect(r.metalPrices.gold!.eurPerGram).toBeCloseTo(80, 9);
  });
});

describe('metal change against an earlier day', () => {
  const at = (iso: string, eurPerGram: number) => ({ eurPerGram, updatedAt: iso, source: 'api' as const });

  it('has no change on the first day', () => {
    const p = carryPrevDay(undefined, at('2026-11-16T10:00:00', 100));
    expect(p.prevDay).toBeUndefined();
    expect(metalChangePct(p)).toBeUndefined();
    const later = carryPrevDay(p, at('2026-11-16T18:00:00', 101));
    expect(later.prevDay).toBeUndefined();
  });

  it('remembers the last price of the earlier day and keeps it during the day', () => {
    const day1 = at('2026-11-16T18:00:00', 100);
    const morning = carryPrevDay(day1, at('2026-11-17T09:00:00', 102));
    expect(morning.prevDay).toEqual({ date: '2026-11-16', eurPerGram: 100 });
    expect(metalChangePct(morning)).toBeCloseTo(0.02, 10);
    const noon = carryPrevDay(morning, at('2026-11-17T12:00:00', 99));
    expect(noon.prevDay).toEqual({ date: '2026-11-16', eurPerGram: 100 });
    expect(metalChangePct(noon)).toBeCloseTo(-0.01, 10);
    const day3 = carryPrevDay(noon, at('2026-11-18T09:00:00', 99));
    expect(day3.prevDay).toEqual({ date: '2026-11-17', eurPerGram: 99 });
    expect(metalChangePct(day3)).toBeCloseTo(0, 10);
  });
});

describe('changed entries', () => {
  it('lists only what this run fetched', async () => {
    const s = base();
    s.quotes['stock:SAP.DEX'] = { eurPrice: 1, price: 1, currency: 'EUR', source: 'manual', updatedAt: 'x' };
    const f = mockFetch({ 'simple/price': { bitcoin: { eur: 60000 } } });
    const r = await refreshQuotes(s, { f, now, skipStocks: true });
    expect(Object.keys(r.changed.quotes)).toEqual(['crypto:bitcoin']);
    expect(r.changed.metalPrices).toEqual({});
    expect(r.quotes['stock:SAP.DEX'].source).toBe('manual'); // full copy still has it
  });
});
