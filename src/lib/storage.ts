import { emptyState, PortfolioState } from './types';

const KEY = 'portfolio-tracker:v1';

export function parseState(json: string): PortfolioState {
  const data = JSON.parse(json);
  if (!data || data.version !== 1 || !Array.isArray(data.holdings)) {
    throw new Error('Die Datei ist kein gültiger Portfolio-Export.');
  }
  const base = emptyState();
  return {
    ...base,
    ...data,
    metalPrices: data.metalPrices ?? {},
    quotes: data.quotes ?? {},
    settings: { ...base.settings, ...(data.settings ?? {}) },
  };
}

export function loadState(): PortfolioState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseState(raw) : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: PortfolioState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Export without API keys, so the backup file can be shared safely. */
export function exportState(state: PortfolioState): string {
  return JSON.stringify({ ...state, settings: { alphaVantageKey: '', coingeckoKey: '' } }, null, 2);
}
