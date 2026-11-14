import { AssetClass, Holding, PortfolioState, quoteKey } from './types';
import { fineGrams } from './units';

export interface HoldingValuation {
  /** grams (gross) for metals, shares or coins otherwise */
  quantity: number;
  /** metals only */
  fineGrams?: number;
  cost: number;
  /** EUR per unit (per fine gram for metals) */
  unitPrice?: number;
  value?: number;
  gain?: number;
  gainPct?: number;
  priceUpdatedAt?: string;
  priceSource?: 'api' | 'manual';
}

export function valueHolding(h: Holding, state: PortfolioState): HoldingValuation {
  const quantity = h.purchases.reduce((s, p) => s + p.quantity, 0);
  const cost = h.purchases.reduce((s, p) => s + p.totalCost, 0);
  const out: HoldingValuation = { quantity, cost };

  let units = quantity;
  if (h.assetClass === 'metal') {
    out.fineGrams = fineGrams(quantity, h.fineness ?? 1000);
    units = out.fineGrams;
    const p = h.metal ? state.metalPrices[h.metal] : undefined;
    if (p) {
      out.unitPrice = p.eurPerGram;
      out.priceUpdatedAt = p.updatedAt;
      out.priceSource = 'manual';
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

  if (out.unitPrice !== undefined) {
    out.value = units * out.unitPrice;
    out.gain = out.value - cost;
    out.gainPct = cost > 0 ? out.gain / cost : undefined;
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
  totalCost: number;
  gain: number;
  gainPct?: number;
  byClass: ClassSummary[];
  unpriced: Holding[];
}

const CLASS_ORDER: AssetClass[] = ['metal', 'stock', 'crypto'];

export function summarize(state: PortfolioState): PortfolioSummary {
  const byClass = new Map<AssetClass, ClassSummary>();
  let totalValue = 0;
  let pricedCost = 0;
  let totalCost = 0;
  const unpriced: Holding[] = [];

  for (const h of state.holdings) {
    const v = valueHolding(h, state);
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
    byClass: CLASS_ORDER.filter((c) => byClass.has(c)).map((c) => byClass.get(c)!),
    unpriced,
  };
}
