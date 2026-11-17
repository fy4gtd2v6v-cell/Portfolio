export type AssetClass = 'metal' | 'stock' | 'crypto' | 'cash';
/** Display and chart order. */
export const ASSET_CLASSES: AssetClass[] = ['metal', 'stock', 'crypto', 'cash'];
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

/**
 * What the user sees as "kind of asset": finer than AssetClass, one colour each.
 * The order is also the order in charts – chosen so neighbouring colours stay
 * distinguishable, including for colour-blind readers (checked with the palette validator).
 */
export type Category = 'stock' | 'etf' | 'gold' | 'silver' | 'platinum' | 'palladium' | 'cash' | 'crypto';
export const CATEGORIES: Category[] = ['stock', 'etf', 'gold', 'silver', 'platinum', 'palladium', 'cash', 'crypto'];
export const CATEGORY_LABEL: Record<Category, string> = {
  stock: 'Aktien',
  etf: 'ETFs & Fonds',
  gold: 'Gold',
  silver: 'Silber',
  platinum: 'Platin',
  palladium: 'Palladium',
  cash: 'Konten',
  crypto: 'Krypto',
};

/** Names that are almost always funds: used when the import did not say what a security is. */
const FUND_NAME_RE = /\bETF\b|\bETC\b|UCITS|MSCI|S&P\s?500|\((Acc|Dist)\)|Fonds|\bFunds?\b|ELTIF|iShares|Xtrackers|Vanguard|Amundi|Lyxor|SPDR|VanEck|Invesco|WisdomTree|Private Equity/i;

export function categoryOf(h: Pick<Holding, 'assetClass' | 'metal' | 'securityType' | 'name'>): Category {
  if (h.assetClass === 'metal') return h.metal ?? 'gold';
  if (h.assetClass === 'crypto') return 'crypto';
  if (h.assetClass === 'cash') return 'cash';
  return (h.securityType ?? (FUND_NAME_RE.test(h.name) ? 'etf' : 'stock')) === 'etf' ? 'etf' : 'stock';
}

export const CLASS_LABEL: Record<AssetClass, string> = {
  metal: 'Edelmetalle',
  stock: 'Aktien & ETFs',
  crypto: 'Krypto',
  cash: 'Konten',
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
  /** execution price per unit in EUR, if known (e.g. from an import) */
  price?: number;
  /** fees in EUR, already included in totalCost */
  fee?: number;
  /** short note, e.g. "Sparplan" */
  note?: string;
  /** identity from an import (transaction id or fingerprint), so the same trade is not imported twice */
  ref?: string;
}

/** What the app knows about a broker's cash account from imported transaction lists. */
export interface BrokerAccount {
  /** every imported row that moved money, so a later, overlapping file only adds what is new */
  refs: string[];
  cash: number;
  /** money paid for orders without shares yet, per security (ISIN or name) */
  pending: Record<string, { name: string; amount: number }>;
  /** whether open orders count towards the balance */
  withPending?: boolean;
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
  /** stock only: ISIN, e.g. from a bank import; identifies the security when no symbol is known */
  isin?: string;
  /**
   * The depot or provider holding the position ("ING", "Trade Republic", "Flexgold").
   * Imports only update positions of the same depot, so the same security in two depots stays two positions.
   */
  account?: string;
  /** stock only: share or fund/ETF; guessed from the name when missing */
  securityType?: 'stock' | 'etf';
  /** cash only: account balance in EUR */
  balance?: number;
  /** cash only: the day the balance refers to, YYYY-MM-DD */
  balanceDate?: string;
  /** cash only */
  iban?: string;
  /** cash only: running totals when the balance comes from a broker's transaction list */
  broker?: BrokerAccount;
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
  /** depots whose positions are folded away in the lists */
  collapsedDepots?: string[];
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

export function quoteKey(h: Pick<Holding, 'assetClass' | 'symbol' | 'coinId' | 'isin'>): string | undefined {
  if (h.assetClass === 'stock' && h.symbol) return `stock:${h.symbol.toUpperCase()}`;
  if (h.assetClass === 'stock' && h.isin) return `isin:${h.isin.toUpperCase()}`;
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
