/** Picking a ticker symbol for a security known by ISIN and name, from Alpha Vantage search results. */
import { isCurrency, StockMatch } from './prices';

/** Search words from a broker's display name: "Junior Gold Miners USD (Acc)" → "Junior Gold Miners". */
export function searchTerm(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(USD|EUR|GBP|CHF|Acc|Dist|Inc|Thesaurierend|Ausschüttend|UCITS|ETF|A|Cl\.?\s*A|Class\s*A)\b\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Exchanges in the order we prefer them: the home market of US shares, otherwise Xetra in euros. */
function regionRank(region: string, isin?: string): number {
  const r = region.toLowerCase();
  const us = r === 'united states';
  const xetra = r === 'xetra';
  const frankfurt = r === 'frankfurt';
  if (isin?.startsWith('US')) return us ? 0 : xetra ? 1 : frankfurt ? 2 : 9;
  return xetra ? 0 : frankfurt ? 1 : us ? 2 : 9;
}

/**
 * Usable matches, best first. Only currencies the app can convert are kept
 * (London prices in pence, "GBX", are left out).
 */
export function rankSymbolMatches(matches: StockMatch[], isin?: string): StockMatch[] {
  return matches
    .filter((m) => isCurrency(m.currency))
    .map((m, i) => ({ m, i, rank: regionRank(m.region, isin) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i) // the service already sorts by match score
    .map((x) => x.m);
}
