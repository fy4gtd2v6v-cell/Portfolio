import { encryptText, Envelope, parseEnvelope, Vault } from './crypto';
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
    history: Array.isArray(data.history) ? data.history : [],
    settings: { ...base.settings, ...(data.settings ?? {}) },
  };
}

export type Stored =
  | { kind: 'plain'; state: PortfolioState }
  | { kind: 'encrypted'; envelope: Envelope };

/** What is in the browser storage: readable data, or an encrypted envelope that needs the password. */
export function readStored(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { kind: 'plain', state: emptyState() };
    const envelope = parseEnvelope(raw);
    if (envelope) return { kind: 'encrypted', envelope };
    return { kind: 'plain', state: parseState(raw) };
  } catch {
    return { kind: 'plain', state: emptyState() };
  }
}

function write(value: string): boolean {
  try {
    localStorage.setItem(KEY, value);
    return true;
  } catch {
    return false;
  }
}

/** Saves the state; encrypted when a vault is given, otherwise as readable JSON. */
export async function saveState(state: PortfolioState, vault: Vault | null): Promise<boolean> {
  const json = JSON.stringify(state);
  if (!vault) return write(json);
  try {
    return write(JSON.stringify(await encryptText(vault, json)));
  } catch {
    return false;
  }
}

export function clearStored(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Export without API keys. Encrypted with the vault when password protection is on. */
export async function exportState(state: PortfolioState, vault: Vault | null): Promise<string> {
  const json = JSON.stringify({ ...state, settings: { ...state.settings, alphaVantageKey: '', coingeckoKey: '' } }, null, 2);
  return vault ? JSON.stringify(await encryptText(vault, json), null, 2) : json;
}
