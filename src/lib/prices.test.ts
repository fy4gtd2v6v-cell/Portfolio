import { describe, expect, it } from 'vitest';
import { fetchEurRates, FetchFn, refreshQuotes } from './prices';
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
  settings: { alphaVantageKey: 'demo', coingeckoKey: '' },
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
