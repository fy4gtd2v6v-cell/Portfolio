import { Currency, CURRENCIES, Holding, Metal, METAL_LABEL, MetalPrice, METALS, PortfolioState, Quote, quoteKey } from './types';
import { GRAMS_PER_TROY_OUNCE } from './units';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class PriceError extends Error {}

const ALPHA_VANTAGE = 'https://www.alphavantage.co/query';
const COINGECKO = 'https://api.coingecko.com/api/v3';
const FRANKFURTER = 'https://api.frankfurter.dev/v1/latest';
const GOLD_API = 'https://api.gold-api.com/price';

async function getJson(f: FetchFn, url: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await f(url, init);
  } catch {
    throw new PriceError('Keine Verbindung zum Kursdienst.');
  }
  if (res.status === 429) throw new PriceError('Zu viele Anfragen – bitte in einer Minute erneut versuchen.');
  if (!res.ok) throw new PriceError(`Kursdienst antwortet mit HTTP ${res.status}.`);
  return res.json();
}

// ---------- Crypto: CoinGecko ----------

function coingeckoHeaders(apiKey?: string): RequestInit | undefined {
  return apiKey ? { headers: { 'x-cg-demo-api-key': apiKey } } : undefined;
}

export interface LivePrice {
  price: number;
  /** change as a fraction (0.012 = +1.2 %), if the service reports one */
  changePct?: number;
}

/** Returns EUR prices and the 24 h change keyed by CoinGecko id. Ids without a price are missing from the result. */
export async function fetchCryptoPrices(ids: string[], apiKey = '', f: FetchFn = fetch): Promise<Record<string, LivePrice>> {
  if (ids.length === 0) return {};
  const url = `${COINGECKO}/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=eur&include_24hr_change=true`;
  const data = await getJson(f, url, coingeckoHeaders(apiKey));
  const out: Record<string, LivePrice> = {};
  for (const id of ids) {
    const eur = data?.[id]?.eur;
    const change = data?.[id]?.eur_24h_change;
    if (typeof eur === 'number') out[id] = { price: eur, changePct: typeof change === 'number' ? change / 100 : undefined };
  }
  return out;
}

export interface CryptoMatch {
  id: string;
  name: string;
  symbol: string;
}

export async function searchCrypto(query: string, apiKey = '', f: FetchFn = fetch): Promise<CryptoMatch[]> {
  const data = await getJson(f, `${COINGECKO}/search?query=${encodeURIComponent(query)}`, coingeckoHeaders(apiKey));
  return (data?.coins ?? []).slice(0, 10).map((c: any) => ({ id: c.id, name: c.name, symbol: String(c.symbol).toUpperCase() }));
}

// ---------- Stocks: Alpha Vantage ----------

function alphaVantageError(data: any): string | undefined {
  const msg = data?.Note ?? data?.Information ?? data?.['Error Message'];
  if (!msg) return undefined;
  if (/rate limit|frequency|25 requests|premium/i.test(msg)) {
    return 'Tageslimit von Alpha Vantage erreicht (kostenlos: 25 Abfragen pro Tag).';
  }
  if (/api ?key/i.test(msg)) return 'Alpha-Vantage-API-Key fehlt oder ist ungültig.';
  return String(msg);
}

/** Latest price and the change since the previous close. */
export async function fetchStockPrice(symbol: string, apiKey: string, f: FetchFn = fetch): Promise<LivePrice> {
  if (!apiKey) throw new PriceError('Bitte in den Einstellungen einen Alpha-Vantage-API-Key eintragen.');
  const url = `${ALPHA_VANTAGE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const data = await getJson(f, url);
  const err = alphaVantageError(data);
  if (err) throw new PriceError(err);
  const quote = data?.['Global Quote'];
  const price = parseFloat(quote?.['05. price']);
  if (!Number.isFinite(price)) throw new PriceError(`Kein Kurs für „${symbol}“ gefunden.`);
  const change = parseFloat(quote?.['10. change percent']); // e.g. "1.0054%"
  return { price, changePct: Number.isFinite(change) ? change / 100 : undefined };
}

export interface StockMatch {
  symbol: string;
  name: string;
  region: string;
  currency: string;
}

export async function searchStocks(query: string, apiKey: string, f: FetchFn = fetch): Promise<StockMatch[]> {
  if (!apiKey) throw new PriceError('Bitte in den Einstellungen einen Alpha-Vantage-API-Key eintragen.');
  const url = `${ALPHA_VANTAGE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${encodeURIComponent(apiKey)}`;
  const data = await getJson(f, url);
  const err = alphaVantageError(data);
  if (err) throw new PriceError(err);
  return (data?.bestMatches ?? []).map((m: any) => ({
    symbol: m['1. symbol'],
    name: m['2. name'],
    region: m['4. region'],
    currency: m['8. currency'],
  }));
}

// ---------- Precious metals: gold-api.com (spot prices in USD per troy ounce, no key) ----------

const METAL_SYMBOL: Record<Metal, string> = { gold: 'XAU', silver: 'XAG', platinum: 'XPT', palladium: 'XPD' };

export interface MetalSpot {
  usdPerOunce: number;
  updatedAt?: string;
}

/** Spot prices keyed by metal. Metals the service cannot price are missing from the result. */
export async function fetchMetalSpots(metals: Metal[], f: FetchFn = fetch): Promise<Partial<Record<Metal, MetalSpot>>> {
  const out: Partial<Record<Metal, MetalSpot>> = {};
  const results = await Promise.allSettled(
    metals.map(async (m) => {
      const data = await getJson(f, `${GOLD_API}/${METAL_SYMBOL[m]}`);
      const price = data?.price;
      if (typeof price !== 'number' || !(price > 0) || (data.currency && data.currency !== 'USD')) return;
      const t = typeof data.updatedAt === 'string' && !Number.isNaN(Date.parse(data.updatedAt)) ? data.updatedAt : undefined;
      out[m] = { usdPerOunce: price, updatedAt: t };
    }),
  );
  // If nothing could be fetched at all, surface the reason (e.g. no connection).
  const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
  if (failed && Object.keys(out).length === 0) throw failed.reason;
  return out;
}

export function spotToEurPerGram(usdPerOunce: number, eurPerUsd: number): number {
  return (usdPerOunce * eurPerUsd) / GRAMS_PER_TROY_OUNCE;
}

// ---------- FX: Frankfurter (ECB rates, no key) ----------

/** Returns how many EUR one unit of each currency is worth. */
export async function fetchEurRates(currencies: Currency[], f: FetchFn = fetch): Promise<Partial<Record<Currency, number>>> {
  const foreign = [...new Set(currencies)].filter((c) => c !== 'EUR');
  const out: Partial<Record<Currency, number>> = { EUR: 1 };
  if (foreign.length === 0) return out;
  const data = await getJson(f, `${FRANKFURTER}?from=EUR&to=${foreign.join(',')}`);
  for (const c of foreign) {
    const perEur = data?.rates?.[c];
    if (typeof perEur === 'number' && perEur > 0) out[c] = 1 / perEur;
  }
  return out;
}

/** Live spot prices converted to EUR per gram, for the given metals. */
export async function fetchMetalPricesEur(metals: Metal[], f: FetchFn = fetch): Promise<Partial<Record<Metal, MetalPrice>>> {
  const [rates, spots] = await Promise.all([fetchEurRates(['USD'], f), fetchMetalSpots(metals, f)]);
  if (rates.USD === undefined) throw new PriceError('Kein Wechselkurs USD→EUR.');
  const now = new Date().toISOString();
  const out: Partial<Record<Metal, MetalPrice>> = {};
  for (const m of metals) {
    const spot = spots[m];
    if (spot) out[m] = { eurPerGram: spotToEurPerGram(spot.usdPerOunce, rates.USD), updatedAt: spot.updatedAt ?? now, source: 'api' };
  }
  return out;
}

let fxCache: { at: number; rates: Partial<Record<Currency, number>> } | undefined;

/** fetchEurRates with a small in-memory cache, so the automatic refresh does not ask for the same daily rates every minute. */
async function cachedEurRates(currencies: Currency[], f: FetchFn, maxAgeMs: number): Promise<Partial<Record<Currency, number>>> {
  if (maxAgeMs > 0 && fxCache && Date.now() - fxCache.at < maxAgeMs && currencies.every((c) => fxCache!.rates[c] !== undefined)) {
    return fxCache.rates;
  }
  const rates = await fetchEurRates(currencies, f);
  if (maxAgeMs > 0) fxCache = { at: Date.now(), rates: { ...fxCache?.rates, ...rates } };
  return rates;
}

const localDay = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * The metal price service reports no daily change, so we keep our own reference:
 * the last price we knew on an earlier day. `next` gets that reference attached.
 */
export function carryPrevDay(old: MetalPrice | undefined, next: MetalPrice): MetalPrice {
  if (!old) return next;
  const [oldDay, newDay] = [localDay(old.updatedAt), localDay(next.updatedAt)];
  if (oldDay && newDay && oldDay < newDay) return { ...next, prevDay: { date: oldDay, eurPerGram: old.eurPerGram } };
  return old.prevDay ? { ...next, prevDay: old.prevDay } : next;
}

/** Change of a metal price against the last earlier day we have a price for, as a fraction. */
export function metalChangePct(p: MetalPrice | undefined): number | undefined {
  if (!p?.prevDay || !(p.prevDay.eurPerGram > 0)) return undefined;
  return p.eurPerGram / p.prevDay.eurPerGram - 1;
}

export function isCurrency(c: string): c is Currency {
  return (CURRENCIES as string[]).includes(c);
}

// ---------- Refresh everything ----------

export interface RefreshResult {
  quotes: Record<string, Quote>;
  metalPrices: PortfolioState['metalPrices'];
  /** only the entries this run actually fetched, for merging into a state that may have changed meanwhile */
  changed: { quotes: Record<string, Quote>; metalPrices: PortfolioState['metalPrices'] };
  errors: string[];
  updated: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches live prices for all stock and crypto holdings.
 * Manual quotes are left untouched unless the API delivers a fresh price.
 */
export async function refreshQuotes(
  state: PortfolioState,
  opts: {
    f?: FetchFn;
    stockDelayMs?: number;
    now?: () => Date;
    metals?: Metal[];
    /** leave stocks out, e.g. for the automatic refresh: the free Alpha Vantage quota is 25 calls a day */
    skipStocks?: boolean;
    /** reuse exchange rates fetched less than this many ms ago (ECB rates change once a day) */
    fxMaxAgeMs?: number;
  } = {},
): Promise<RefreshResult> {
  const f = opts.f ?? fetch;
  const delay = opts.stockDelayMs ?? 1200;
  const now = (opts.now ?? (() => new Date()))().toISOString();
  const quotes = { ...state.quotes };
  const metalPrices = { ...state.metalPrices };
  const changed: RefreshResult['changed'] = { quotes: {}, metalPrices: {} };
  const errors: string[] = [];
  let updated = 0;

  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  const crypto = uniq(state.holdings.filter((h) => h.assetClass === 'crypto' && h.coinId).map((h) => h.coinId!));
  const stocks = opts.skipStocks
    ? []
    : state.holdings.filter((h): h is Holding & { symbol: string } => h.assetClass === 'stock' && !!h.symbol);
  const stockBySymbol = new Map(stocks.map((h) => [h.symbol.toUpperCase(), h]));

  if (crypto.length) {
    try {
      const prices = await fetchCryptoPrices(crypto, state.settings.coingeckoKey, f);
      for (const id of crypto) {
        if (prices[id] === undefined) {
          errors.push(`Krypto: kein Kurs für „${id}“.`);
          continue;
        }
        const key = quoteKey({ assetClass: 'crypto', coinId: id })!;
        quotes[key] = changed.quotes[key] = {
          eurPrice: prices[id].price, price: prices[id].price, currency: 'EUR', source: 'api', updatedAt: now, changePct: prices[id].changePct,
        };
        updated++;
      }
    } catch (e) {
      errors.push(`Krypto: ${(e as Error).message}`);
    }
  }

  // Metals: explicitly requested ones, or (in live mode) those of the open holdings.
  const metals =
    opts.metals ??
    (state.settings.metalMode === 'manual'
      ? []
      : METALS.filter((m) => state.holdings.some((h) => h.assetClass === 'metal' && h.metal === m)));

  let rates: Partial<Record<Currency, number>> = { EUR: 1 };
  const currencies: Currency[] = [...stocks.map((h) => h.currency ?? 'EUR'), ...(metals.length ? ['USD' as const] : [])];
  if (currencies.some((c) => c !== 'EUR')) {
    try {
      rates = await cachedEurRates(currencies, f, opts.fxMaxAgeMs ?? 0);
    } catch (e) {
      errors.push(`Wechselkurse: ${(e as Error).message}`);
    }
  }

  if (metals.length) {
    if (rates.USD === undefined) {
      errors.push('Edelmetalle: kein Wechselkurs USD→EUR.');
    } else {
      try {
        const spots = await fetchMetalSpots(metals, f);
        for (const m of metals) {
          const spot = spots[m];
          if (!spot) {
            errors.push(`Edelmetalle: kein Preis für ${METAL_LABEL[m]}.`);
            continue;
          }
          const price: MetalPrice = { eurPerGram: spotToEurPerGram(spot.usdPerOunce, rates.USD), updatedAt: spot.updatedAt ?? now, source: 'api' };
          metalPrices[m] = changed.metalPrices[m] = carryPrevDay(state.metalPrices[m], price);
          updated++;
        }
      } catch (e) {
        errors.push(`Edelmetalle: ${(e as Error).message}`);
      }
    }
  }

  if (stockBySymbol.size) {
    let first = true;
    for (const [symbol, h] of stockBySymbol) {
      if (!first && delay > 0) await sleep(delay); // Alpha Vantage free tier allows few calls per minute
      first = false;
      const currency = h.currency ?? 'EUR';
      const rate = rates[currency];
      if (rate === undefined) {
        errors.push(`${symbol}: kein Wechselkurs ${currency}→EUR.`);
        continue;
      }
      try {
        const { price, changePct } = await fetchStockPrice(symbol, state.settings.alphaVantageKey, f);
        quotes[quoteKey(h)!] = changed.quotes[quoteKey(h)!] = { eurPrice: price * rate, price, currency, source: 'api', updatedAt: now, changePct };
        updated++;
      } catch (e) {
        errors.push(`${symbol}: ${(e as Error).message}`);
        // A missing key or exhausted quota affects every following symbol too.
        if (/API-Key|Tageslimit/.test((e as Error).message)) break;
      }
    }
  }

  return { quotes, metalPrices, changed, errors, updated };
}
