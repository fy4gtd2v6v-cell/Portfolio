export type AssetClass = 'metal' | 'stock' | 'crypto';
export type Metal = 'gold' | 'silver' | 'platinum' | 'palladium';
export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';

export const METALS: Metal[] = ['gold', 'silver', 'platinum', 'palladium'];
export const CURRENCIES: Currency[] = ['EUR', 'USD', 'GBP', 'CHF'];

export const METAL_LABEL: Record<Metal, string> = {
  gold: 'Gold',
  silver: 'Silber',
  platinum: 'Platin',
  palladium: 'Palladium',
};

export const CLASS_LABEL: Record<AssetClass, string> = {
  metal: 'Edelmetalle',
  stock: 'Aktien & ETFs',
  crypto: 'Krypto',
};

/**
 * One transaction. Quantity: grams (metal, gross weight), shares (stock), coins (crypto), always positive.
 * Buy: totalCost is the price paid incl. fees. Sell: totalCost is the proceeds after fees.
 */
export interface Purchase {
  id: string;
  /** missing in data saved before sales existed, means 'buy' */
  kind?: 'buy' | 'sell';
  date: string; // YYYY-MM-DD
  quantity: number;
  totalCost: number; // EUR
}

/** Daily record of the portfolio value, used for the history chart. */
export interface Snapshot {
  date: string; // YYYY-MM-DD
  value: number;
  /** open cost basis of the valued holdings */
  cost: number;
  byClass: Partial<Record<AssetClass, number>>;
}

export interface Holding {
  id: string;
  assetClass: AssetClass;
  name: string;
  /** metal only */
  metal?: Metal;
  /** metal only: fineness in per mille, e.g. 999.9 or 916.7 */
  fineness?: number;
  /** stock only: Alpha Vantage symbol, e.g. "AAPL" or "SAP.DEX" */
  symbol?: string;
  /** stock only: currency the exchange quotes in */
  currency?: Currency;
  /** crypto only: CoinGecko id, e.g. "bitcoin" */
  coinId?: string;
  purchases: Purchase[];
}

export interface MetalPrice {
  eurPerGram: number;
  updatedAt: string; // ISO
  /** missing in older data, means 'manual' */
  source?: 'api' | 'manual';
  /** the last price known from an earlier day, to show the change since then */
  prevDay?: { date: string; eurPerGram: number };
}

export interface Quote {
  eurPrice: number;
  /** price in the quote currency before conversion */
  price: number;
  currency: Currency;
  source: 'api' | 'manual';
  updatedAt: string; // ISO
  /** change reported by the price service, as a fraction: last 24 h (crypto) or since the previous close (stocks) */
  changePct?: number;
}

export interface Settings {
  alphaVantageKey: string;
  coingeckoKey: string;
  /** 'live': spot prices are fetched with the other quotes; 'manual': only prices typed in by hand */
  metalMode: 'live' | 'manual';
  /** refresh crypto and metal prices every minute while the app is open */
  autoRefresh: boolean;
}

export interface PortfolioState {
  version: 1;
  holdings: Holding[];
  metalPrices: Partial<Record<Metal, MetalPrice>>;
  /** keyed by quoteKey(holding) */
  quotes: Record<string, Quote>;
  history: Snapshot[];
  settings: Settings;
}

export function quoteKey(h: Pick<Holding, 'assetClass' | 'symbol' | 'coinId'>): string | undefined {
  if (h.assetClass === 'stock' && h.symbol) return `stock:${h.symbol.toUpperCase()}`;
  if (h.assetClass === 'crypto' && h.coinId) return `crypto:${h.coinId}`;
  return undefined;
}

export function emptyState(): PortfolioState {
  return {
    version: 1,
    holdings: [],
    metalPrices: {},
    quotes: {},
    history: [],
    settings: { alphaVantageKey: '', coingeckoKey: '', metalMode: 'live', autoRefresh: true },
  };
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
