import { ASSET_CLASSES, AssetClass, CATEGORIES, Category, categoryOf, Holding, PortfolioState, Purchase, quoteKey, Snapshot } from './types';
import { fineGrams } from './units';

const EPS = 1e-9;

export interface FifoResult {
  /** remaining quantity */
  quantity: number;
  /** cost basis of the remaining quantity */
  cost: number;
  /** gain realized by sales: proceeds minus FIFO cost of what was sold */
  realized: number;
  /** total proceeds from sales */
  proceeds: number;
  /** id of the first sale that sells more than was held at that date */
  oversoldBy?: string;
}

/** Transactions in chronological order; same-day entries keep their entry order. */
export function sortTransactions(txs: Purchase[]): Purchase[] {
  return txs.map((t, i) => [t, i] as const).sort((a, b) => a[0].date.localeCompare(b[0].date) || a[1] - b[1]).map(([t]) => t);
}

/**
 * Matches sales against purchases first-in-first-out (as German tax law
 * requires for securities, § 20 Abs. 4 S. 7 EStG).
 */
export function applyFifo(txs: Purchase[]): FifoResult {
  const lots: { qty: number; unitCost: number }[] = [];
  let realized = 0;
  let proceeds = 0;
  let oversoldBy: string | undefined;

  for (const t of sortTransactions(txs)) {
    if (t.kind !== 'sell') {
      if (t.quantity > 0) lots.push({ qty: t.quantity, unitCost: t.totalCost / t.quantity });
      continue;
    }
    let remaining = t.quantity;
    let soldCost = 0;
    while (remaining > EPS && lots.length) {
      const lot = lots[0];
      const take = Math.min(lot.qty, remaining);
      soldCost += take * lot.unitCost;
      lot.qty -= take;
      remaining -= take;
      if (lot.qty <= EPS) lots.shift();
    }
    if (remaining > EPS) oversoldBy ??= t.id;
    proceeds += t.totalCost;
    realized += t.totalCost - soldCost;
  }

  return {
    quantity: lots.reduce((s, l) => s + l.qty, 0),
    cost: lots.reduce((s, l) => s + l.qty * l.unitCost, 0),
    realized,
    proceeds,
    oversoldBy,
  };
}

export interface HoldingValuation {
  /** grams (gross) for metals, shares or coins otherwise; remaining after sales */
  quantity: number;
  /** metals only */
  fineGrams?: number;
  /** cost basis of the remaining quantity */
  cost: number;
  realized: number;
  closed: boolean;
  oversoldBy?: string;
  /** EUR per unit (per fine gram for metals) */
  unitPrice?: number;
  value?: number;
  gain?: number;
  gainPct?: number;
  priceUpdatedAt?: string;
  priceSource?: 'api' | 'manual';
}

export function valueHolding(h: Holding, state: PortfolioState): HoldingValuation {
  if (h.assetClass === 'cash') {
    // An account is simply worth its balance: no price, no purchase lots, no gain.
    const balance = h.balance ?? 0;
    return { quantity: balance, cost: balance, realized: 0, closed: false, unitPrice: 1, value: balance, priceUpdatedAt: h.balanceDate, priceSource: 'manual' };
  }
  const fifo = applyFifo(h.purchases);
  const closed = fifo.quantity <= EPS && h.purchases.length > 0;
  const quantity = closed ? 0 : fifo.quantity;
  const out: HoldingValuation = { quantity, cost: closed ? 0 : fifo.cost, realized: fifo.realized, closed, oversoldBy: fifo.oversoldBy };

  let units = quantity;
  if (h.assetClass === 'metal') {
    out.fineGrams = fineGrams(quantity, h.fineness ?? 1000);
    units = out.fineGrams;
    const p = h.metal ? state.metalPrices[h.metal] : undefined;
    if (p) {
      out.unitPrice = p.eurPerGram;
      out.priceUpdatedAt = p.updatedAt;
      out.priceSource = p.source ?? 'manual';
    }
  } else {
    const key = quoteKey(h);
    const q = key ? state.quotes[key] : undefined;
    if (q) {
      out.unitPrice = q.eurPrice;
      out.priceUpdatedAt = q.updatedAt;
      out.priceSource = q.source;
    }
  }

  if (closed) {
    out.value = 0;
  } else if (out.unitPrice !== undefined) {
    out.value = units * out.unitPrice;
    out.gain = out.value - out.cost;
    out.gainPct = out.cost > 0 ? out.gain / out.cost : undefined;
  }
  return out;
}

export interface ClassSummary {
  assetClass: AssetClass;
  value: number;
  cost: number;
  count: number;
}

export interface CategorySummary {
  category: Category;
  value: number;
  cost: number;
  count: number;
}

export interface PortfolioSummary {
  totalValue: number;
  /** cost of the holdings that have a price, so gain compares like with like */
  pricedCost: number;
  /** cost basis of all open positions (accounts are not an investment and stay out) */
  totalCost: number;
  /** sum of all account balances, included in totalValue */
  cashValue: number;
  /** unrealized gain of priced holdings */
  gain: number;
  gainPct?: number;
  realized: number;
  byClass: ClassSummary[];
  /** the same, split finer: shares vs. funds, each metal on its own */
  byCategory: CategorySummary[];
  /** open positions without a price */
  unpriced: Holding[];
}

const CLASS_ORDER: AssetClass[] = ASSET_CLASSES;

export function summarize(state: PortfolioState): PortfolioSummary {
  const byClass = new Map<AssetClass, ClassSummary>();
  let totalValue = 0;
  let pricedCost = 0;
  let totalCost = 0;
  let realized = 0;
  let cashValue = 0;
  const unpriced: Holding[] = [];

  const byCategory = new Map<Category, CategorySummary>();
  for (const h of state.holdings) {
    const v = valueHolding(h, state);
    realized += v.realized;
    if (v.closed) continue;
    const cat = categoryOf(h);
    const k = byCategory.get(cat) ?? { category: cat, value: 0, cost: 0, count: 0 };
    k.count += 1;
    k.value += v.value ?? 0;
    if (h.assetClass !== 'cash') k.cost += v.cost;
    byCategory.set(cat, k);
    const c = byClass.get(h.assetClass) ?? { assetClass: h.assetClass, value: 0, cost: 0, count: 0 };
    c.count += 1;
    c.cost += v.cost;
    if (h.assetClass === 'cash') {
      c.value += v.value ?? 0;
      cashValue += v.value ?? 0;
      totalValue += v.value ?? 0;
      byClass.set(h.assetClass, c);
      continue;
    }
    totalCost += v.cost;
    if (v.value === undefined) {
      unpriced.push(h);
    } else {
      c.value += v.value;
      totalValue += v.value;
      pricedCost += v.cost;
    }
    byClass.set(h.assetClass, c);
  }

  const gain = totalValue - cashValue - pricedCost;
  return {
    totalValue,
    pricedCost,
    totalCost,
    cashValue,
    gain,
    gainPct: pricedCost > 0 ? gain / pricedCost : undefined,
    realized,
    byClass: CLASS_ORDER.filter((c) => byClass.has(c)).map((c) => byClass.get(c)!),
    byCategory: CATEGORIES.filter((c) => byCategory.has(c)).map((c) => byCategory.get(c)!),
    unpriced,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Records today's portfolio value in the history (one entry per day, later
 * values of the same day replace earlier ones). Skips days where an open
 * position has no price, so the chart never shows a misleading dip.
 * Returns the same object when nothing changed.
 */
export function withSnapshot(state: PortfolioState, date: string): PortfolioState {
  const s = summarize(state);
  if (s.unpriced.length > 0 || state.holdings.length === 0) return state;
  const snap: Snapshot = {
    date,
    value: round2(s.totalValue),
    // Balances count as their own "cost", so value minus cost stays the gain of the investments.
    cost: round2(s.pricedCost + s.cashValue),
    byClass: Object.fromEntries(s.byClass.map((c) => [c.assetClass, round2(c.value)])),
  };
  const history = state.history ?? [];
  const last = history[history.length - 1];
  if (last && last.date === date && JSON.stringify(last) === JSON.stringify(snap)) return state;
  const rest = history.filter((h) => h.date !== date);
  return { ...state, history: [...rest, snap].sort((a, b) => a.date.localeCompare(b.date)) };
}

// ---------- depots ----------

/** Group for positions without a depot, e.g. ones entered by hand. */
export const NO_DEPOT = 'Ohne Depot';

/** The depot a position belongs to. A cash account without one is its own depot (its name, e.g. "Trade Republic"). */
export function depotOf(h: Holding): string {
  return h.account?.trim() || (h.assetClass === 'cash' ? h.name.trim() : NO_DEPOT);
}

export interface DepotSummary {
  depot: string;
  holdings: Holding[];
  /** open positions (and accounts) */
  count: number;
  value: number;
  /** cost of priced investments, accounts excluded */
  cost: number;
  gain: number;
}

/** Positions grouped by depot, largest first; positions without depot last. */
export function groupByDepot(state: PortfolioState, holdings: Holding[] = state.holdings): DepotSummary[] {
  const groups = new Map<string, DepotSummary>();
  for (const h of holdings) {
    const depot = depotOf(h);
    const g = groups.get(depot) ?? { depot, holdings: [], count: 0, value: 0, cost: 0, gain: 0 };
    g.holdings.push(h);
    const v = valueHolding(h, state);
    if (!v.closed) {
      g.count++;
      g.value += v.value ?? 0;
      if (h.assetClass !== 'cash' && v.value !== undefined) {
        g.cost += v.cost;
        g.gain += v.value - v.cost;
      }
    }
    groups.set(depot, g);
  }
  return [...groups.values()].sort((a, b) => (a.depot === NO_DEPOT ? 1 : b.depot === NO_DEPOT ? -1 : b.value - a.value || a.depot.localeCompare(b.depot, 'de')));
}

/** All depot names in use, for suggestions. */
export function depotNames(state: PortfolioState): string[] {
  return [...new Set(state.holdings.map((h) => h.account?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'de'));
}
