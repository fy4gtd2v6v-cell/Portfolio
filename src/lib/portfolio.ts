import { AssetClass, Holding, PortfolioState, Purchase, quoteKey, Snapshot } from './types';
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

export interface PortfolioSummary {
  totalValue: number;
  /** cost of the holdings that have a price, so gain compares like with like */
  pricedCost: number;
  /** cost basis of all open positions */
  totalCost: number;
  /** unrealized gain of priced holdings */
  gain: number;
  gainPct?: number;
  realized: number;
  byClass: ClassSummary[];
  /** open positions without a price */
  unpriced: Holding[];
}

const CLASS_ORDER: AssetClass[] = ['metal', 'stock', 'crypto'];

export function summarize(state: PortfolioState): PortfolioSummary {
  const byClass = new Map<AssetClass, ClassSummary>();
  let totalValue = 0;
  let pricedCost = 0;
  let totalCost = 0;
  let realized = 0;
  const unpriced: Holding[] = [];

  for (const h of state.holdings) {
    const v = valueHolding(h, state);
    realized += v.realized;
    if (v.closed) continue;
    totalCost += v.cost;
    const c = byClass.get(h.assetClass) ?? { assetClass: h.assetClass, value: 0, cost: 0, count: 0 };
    c.count += 1;
    c.cost += v.cost;
    if (v.value === undefined) {
      unpriced.push(h);
    } else {
      c.value += v.value;
      totalValue += v.value;
      pricedCost += v.cost;
    }
    byClass.set(h.assetClass, c);
  }

  const gain = totalValue - pricedCost;
  return {
    totalValue,
    pricedCost,
    totalCost,
    gain,
    gainPct: pricedCost > 0 ? gain / pricedCost : undefined,
    realized,
    byClass: CLASS_ORDER.filter((c) => byClass.has(c)).map((c) => byClass.get(c)!),
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
    cost: round2(s.pricedCost),
    byClass: Object.fromEntries(s.byClass.map((c) => [c.assetClass, round2(c.value)])),
  };
  const history = state.history ?? [];
  const last = history[history.length - 1];
  if (last && last.date === date && JSON.stringify(last) === JSON.stringify(snap)) return state;
  const rest = history.filter((h) => h.date !== date);
  return { ...state, history: [...rest, snap].sort((a, b) => a.date.localeCompare(b.date)) };
}
