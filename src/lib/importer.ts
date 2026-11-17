/**
 * Turning bank export files into portfolio data.
 *
 * There are no fixed per-bank templates, because banks change their exports
 * and document them poorly. Instead the columns are recognised by their
 * titles (many known spellings), and the user can correct the mapping.
 */
import { normalizeHeader, parseAmount, parseCsv, parseDate } from './csv';
import { Holding, newId, PortfolioState, Purchase, quoteKey } from './types';

/** What a file contains. */
export type ImportKind = 'statement' | 'positions' | 'transactions';

export const KIND_LABEL: Record<ImportKind, string> = {
  statement: 'Kontoumsätze',
  positions: 'Depotbestand',
  transactions: 'Wertpapier-Transaktionen',
};

export interface FieldDef {
  key: string;
  label: string;
  /** known column titles, most specific first (compared via normalizeHeader) */
  names: string[];
}

/** Fields per kind, in the order they claim columns. */
export const FIELDS: Record<ImportKind, FieldDef[]> = {
  statement: [
    { key: 'date', label: 'Buchungsdatum', names: ['Buchungstag', 'Buchung', 'Buchungsdatum', 'Datum', 'Date', 'Booking date', 'Valutadatum', 'Valuta', 'Wertstellung'] },
    { key: 'balance', label: 'Saldo nach Buchung', names: ['Saldo nach Buchung', 'Saldo', 'Kontostand', 'Balance'] },
    { key: 'amount', label: 'Betrag', names: ['Betrag', 'Umsatz', 'Amount', 'Betrag (EUR)', 'Wert'] },
    { key: 'text', label: 'Verwendungszweck', names: ['Verwendungszweck', 'Buchungstext', 'Beschreibung', 'Description', 'Notiz'] },
    { key: 'info', label: 'Status', names: ['Info', 'Status'] },
    { key: 'account', label: 'Eigene Kontonummer / IBAN', names: ['Auftragskonto', 'Eigenes Konto', 'Kontonummer Auftraggeber', 'Konto'] },
  ],
  positions: [
    { key: 'isin', label: 'ISIN', names: ['ISIN'] },
    { key: 'name', label: 'Bezeichnung', names: ['Bezeichnung', 'Wertpapierbezeichnung', 'Wertpapiername', 'Wertpapier', 'Name', 'Titel', 'Instrument'] },
    { key: 'quantity', label: 'Stück', names: ['Stück/Nominale', 'Stück', 'Stueck', 'Nominale', 'Nominal', 'Anzahl', 'Bestand', 'Menge', 'Shares', 'Quantity', 'Stk'] },
    { key: 'costPrice', label: 'Einstandskurs (je Stück)', names: ['Einstandskurs', 'Kaufkurs', 'Einstandspreis', 'Kaufpreis', 'Durchschnittskurs', 'Durchschnittlicher Kaufkurs', 'Avg price', 'Average cost'] },
    { key: 'costTotal', label: 'Einstandswert (gesamt)', names: ['Einstandswert', 'Kaufwert', 'Einstandssumme', 'Kaufsumme', 'Investiert', 'Cost basis'] },
    { key: 'value', label: 'Kurswert (gesamt)', names: ['Kurswert', 'Marktwert', 'Aktueller Wert', 'Gesamtwert', 'Wert', 'Value', 'Market value'] },
    { key: 'price', label: 'Aktueller Kurs (je Stück)', names: ['Kurs', 'Aktueller Kurs', 'Letzter Kurs', 'Preis', 'Price'] },
    { key: 'currency', label: 'Währung', names: ['Währung', 'Waehrung', 'Currency'] },
  ],
  transactions: [
    { key: 'date', label: 'Datum', names: ['Datum', 'Date', 'Buchungstag', 'Buchung', 'Handelstag', 'Ausführungsdatum', 'Datetime', 'Zeitpunkt'] },
    { key: 'type', label: 'Art (Kauf/Verkauf)', names: ['Typ', 'Type', 'Transaktionstyp', 'Transaktionsart', 'Transaktion', 'Art', 'Umsatzart', 'Kategorie', 'Category', 'Transaction type'] },
    { key: 'isin', label: 'ISIN', names: ['ISIN'] },
    { key: 'name', label: 'Bezeichnung', names: ['Bezeichnung', 'Wertpapier', 'Wertpapiername', 'Name', 'Titel', 'Instrument', 'Asset'] },
    { key: 'quantity', label: 'Stück', names: ['Stück', 'Stueck', 'Stück/Nominale', 'Nominale', 'Anzahl', 'Menge', 'Shares', 'Quantity'] },
    { key: 'amount', label: 'Betrag (gesamt)', names: ['Betrag', 'Wert', 'Gesamt', 'Gesamtbetrag', 'Amount', 'Total', 'Kurswert'] },
    { key: 'price', label: 'Kurs (je Stück)', names: ['Kurs', 'Preis', 'Price', 'Ausführungskurs'] },
  ],
};

/** Which fields a kind cannot do without. `name|isin` means one of the two. */
const REQUIRED: Record<ImportKind, string[]> = {
  statement: ['date', 'amount|balance'],
  positions: ['name|isin', 'quantity'],
  transactions: ['date', 'type', 'name|isin', 'quantity'],
};

/** field key → column index, or -1 when not assigned */
export type Mapping = Record<string, number>;

export interface ParsedFile {
  /** lines above the table, e.g. the account details ING puts first */
  preamble: string[][];
  header: string[];
  rows: string[][];
}

const ALL_NAMES = new Set(
  Object.values(FIELDS).flatMap((defs) => defs.flatMap((d) => d.names.map(normalizeHeader))),
);

/** Finds the table inside the file: the title row is the one that looks most like column titles. */
export function parseFile(text: string): ParsedFile {
  const all = parseCsv(text);
  let headerIndex = -1;
  let best = 1;
  all.slice(0, 40).forEach((row, i) => {
    const hits = row.filter((c) => ALL_NAMES.has(normalizeHeader(c))).length;
    if (hits > best) {
      best = hits;
      headerIndex = i;
    }
  });
  if (headerIndex < 0) headerIndex = all.findIndex((r) => r.filter((c) => c !== '').length >= 2);
  if (headerIndex < 0) return { preamble: all, header: [], rows: [] };
  const header = all[headerIndex];
  return {
    preamble: all.slice(0, headerIndex),
    header,
    rows: all.slice(headerIndex + 1).filter((r) => r.length >= Math.min(2, header.length)),
  };
}

function findColumn(header: string[], names: string[], used: Set<number>): number {
  const norm = header.map(normalizeHeader);
  const wanted = names.map(normalizeHeader);
  // Exact title first, then "starts with", then "contains" (only for longer words, to avoid chance hits).
  for (const test of [
    (h: string, w: string) => h === w,
    (h: string, w: string) => w.length >= 5 && h.startsWith(w),
    (h: string, w: string) => w.length >= 6 && h.includes(w),
  ]) {
    for (const w of wanted) {
      const i = norm.findIndex((h, idx) => !used.has(idx) && h !== '' && test(h, w));
      if (i >= 0) return i;
    }
  }
  return -1;
}

export function autoMap(header: string[], kind: ImportKind): Mapping {
  const used = new Set<number>();
  const mapping: Mapping = {};
  for (const def of FIELDS[kind]) {
    const i = findColumn(header, def.names, used);
    mapping[def.key] = i;
    if (i >= 0) used.add(i);
  }
  return mapping;
}

/** Labels of the required fields that are not assigned yet. */
export function missingFields(kind: ImportKind, mapping: Mapping): string[] {
  const label = (key: string) => FIELDS[kind].find((d) => d.key === key)!.label;
  return REQUIRED[kind]
    .filter((req) => req.split('|').every((k) => (mapping[k] ?? -1) < 0))
    .map((req) => req.split('|').map(label).join(' oder '));
}

/** Best guess what the file contains, from its column titles. */
export function detectKind(header: string[]): ImportKind {
  const complete = (k: ImportKind) => missingFields(k, autoMap(header, k)).length === 0;
  const tx = autoMap(header, 'transactions');
  if (complete('transactions') && tx.isin >= 0) return 'transactions';
  if (complete('positions')) return 'positions';
  if (complete('statement')) return 'statement';
  if (complete('transactions')) return 'transactions';
  return 'statement';
}

const cell = (row: string[], i: number): string => (i >= 0 ? row[i] ?? '' : '');

// ---------- account statements ----------

export interface StatementResult {
  count: number;
  skipped: number;
  from?: string;
  to?: string;
  /** sum of all amounts in the file */
  sum: number;
  /** balance after the newest booking, if the file states one */
  balance?: number;
  balanceDate?: string;
  iban?: string;
  accountName?: string;
  /** the bookings that were read, for working out a balance from an earlier one */
  bookings: { date: string; amount: number }[];
}

/** Details some banks (e.g. ING) write above the table: "Saldo;1.234,56;EUR", "IBAN;DE…", "Kontoname;Girokonto". */
function readPreamble(preamble: string[][]): { balance?: number; iban?: string; accountName?: string } {
  const out: { balance?: number; iban?: string; accountName?: string } = {};
  for (const row of preamble) {
    const key = normalizeHeader(row[0] ?? '');
    const value = row.slice(1).find((c) => c !== '') ?? '';
    if (key === 'saldo' || key === 'kontostand') {
      const n = parseAmount(value);
      if (Number.isFinite(n)) out.balance = n;
    } else if (key === 'iban') {
      out.iban = value.replace(/\s/g, '');
    } else if (key === 'kontoname' || key === 'konto') {
      out.accountName = value;
    }
  }
  return out;
}

export function readStatement(file: ParsedFile, mapping: Mapping): StatementResult {
  const pre = readPreamble(file.preamble);
  const bookings: { date: string; amount: number; balance: number; index: number }[] = [];
  let skipped = 0;
  file.rows.forEach((row, index) => {
    const date = parseDate(cell(row, mapping.date));
    const amount = parseAmount(cell(row, mapping.amount));
    const balance = parseAmount(cell(row, mapping.balance ?? -1));
    const pending = /vorgemerkt|pending/i.test(cell(row, mapping.info ?? -1));
    if (!date || pending || (!Number.isFinite(amount) && !Number.isFinite(balance))) {
      skipped++;
      return;
    }
    bookings.push({ date, amount, balance, index });
  });
  const result: StatementResult = {
    count: bookings.length, skipped, sum: 0, iban: pre.iban, accountName: pre.accountName,
    bookings: bookings.filter((b) => Number.isFinite(b.amount)).map((b) => ({ date: b.date, amount: b.amount })),
  };
  if (bookings.length === 0) {
    if (pre.balance !== undefined) result.balance = pre.balance;
    return result;
  }
  // Some banks (e.g. Sparkasse) repeat the own account number in every row instead of a preamble.
  if (!result.iban) {
    const own = cell(file.rows[bookings[0].index], mapping.account ?? -1).replace(/\s/g, '');
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$|^\d{5,12}$/.test(own)) result.iban = own;
  }
  result.sum = bookings.reduce((s, b) => s + (Number.isFinite(b.amount) ? b.amount : 0), 0);
  const dates = bookings.map((b) => b.date).sort();
  result.from = dates[0];
  result.to = dates[dates.length - 1];
  // The newest booking: files are sorted either way round, so look at which end is later.
  const newestFirst = bookings[0].date >= bookings[bookings.length - 1].date;
  const newest = bookings.filter((b) => b.date === result.to);
  const last = newestFirst ? newest[0] : newest[newest.length - 1];
  if (Number.isFinite(last.balance)) {
    result.balance = last.balance;
    result.balanceDate = result.to;
  } else if (pre.balance !== undefined) {
    result.balance = pre.balance;
    result.balanceDate = result.to;
  }
  return result;
}

// ---------- depot positions ----------

export interface PositionDraft {
  key: string;
  name: string;
  isin?: string;
  quantity: number;
  /** total cost in EUR, if the file states it */
  cost?: number;
  /** current price per unit in EUR, if the file states it */
  price?: number;
  currency?: string;
  warnings: string[];
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
const cleanIsin = (s: string): string | undefined => {
  const v = s.replace(/\s/g, '').toUpperCase();
  return ISIN_RE.test(v) ? v : undefined;
};

export function readPositions(file: ParsedFile, mapping: Mapping): { drafts: PositionDraft[]; skipped: number } {
  const drafts: PositionDraft[] = [];
  let skipped = 0;
  file.rows.forEach((row, i) => {
    const isin = cleanIsin(cell(row, mapping.isin));
    const name = cell(row, mapping.name) || isin || '';
    const quantity = parseAmount(cell(row, mapping.quantity));
    if (!name || !(quantity > 0)) {
      skipped++;
      return;
    }
    const warnings: string[] = [];
    const costTotal = parseAmount(cell(row, mapping.costTotal));
    const costPrice = parseAmount(cell(row, mapping.costPrice));
    const value = parseAmount(cell(row, mapping.value));
    const priceCol = parseAmount(cell(row, mapping.price));
    const cost = Number.isFinite(costTotal) ? costTotal : Number.isFinite(costPrice) ? costPrice * quantity : undefined;
    const price = Number.isFinite(priceCol) ? priceCol : Number.isFinite(value) ? value / quantity : undefined;
    const currency = cell(row, mapping.currency).toUpperCase() || undefined;
    if (cost === undefined) warnings.push('Kein Einstandswert in der Datei – bitte nachtragen.');
    if (currency && currency !== 'EUR') warnings.push(`Werte in ${currency} – bitte prüfen, sie werden als Euro übernommen.`);
    drafts.push({ key: `${isin ?? name}#${i}`, name, isin, quantity, cost: cost !== undefined && cost >= 0 ? cost : undefined, price: price !== undefined && price > 0 ? price : undefined, currency, warnings });
  });
  return { drafts, skipped };
}

// ---------- security transactions ----------

export interface TransactionDraft {
  key: string;
  name: string;
  isin?: string;
  purchases: Purchase[];
  /** remaining quantity after all buys and sells */
  quantity: number;
  warnings: string[];
}

const BUY_RE = /kauf|buy|sparplan|savings|purchase|erwerb|einbuchung|zeichnung/i;
const SELL_RE = /verkauf|sell|sale|ausbuchung|veräußerung|veraeusserung/i;

/** 'sell' is tested first: "Verkauf" contains "kauf". */
export function transactionKind(type: string): 'buy' | 'sell' | undefined {
  if (SELL_RE.test(type)) return 'sell';
  if (BUY_RE.test(type)) return 'buy';
  return undefined;
}

export function readTransactions(file: ParsedFile, mapping: Mapping): { drafts: TransactionDraft[]; skipped: number; ignoredTypes: string[] } {
  const groups = new Map<string, TransactionDraft>();
  const ignored = new Set<string>();
  let skipped = 0;
  for (const row of file.rows) {
    const type = cell(row, mapping.type);
    const kind = transactionKind(type);
    const date = parseDate(cell(row, mapping.date));
    const isin = cleanIsin(cell(row, mapping.isin));
    const name = cell(row, mapping.name) || isin || '';
    const quantity = Math.abs(parseAmount(cell(row, mapping.quantity)));
    if (!kind) {
      if (type) ignored.add(type);
      skipped++;
      continue;
    }
    if (!date || !name || !(quantity > 0)) {
      skipped++;
      continue;
    }
    const amountCol = Math.abs(parseAmount(cell(row, mapping.amount)));
    const price = Math.abs(parseAmount(cell(row, mapping.price)));
    const total = Number.isFinite(amountCol) ? amountCol : Number.isFinite(price) ? price * quantity : NaN;
    const id = isin ?? normalizeHeader(name);
    const g = groups.get(id) ?? { key: id, name, isin, purchases: [], quantity: 0, warnings: [] };
    if (!Number.isFinite(total)) {
      if (!g.warnings.length) g.warnings.push('Mindestens eine Buchung ohne Betrag – als 0 € übernommen.');
    }
    g.purchases.push({ id: newId(), kind, date, quantity, totalCost: Number.isFinite(total) ? total : 0 });
    g.quantity += kind === 'buy' ? quantity : -quantity;
    groups.set(id, g);
  }
  const drafts = [...groups.values()].map((g) => {
    g.purchases.sort((a, b) => a.date.localeCompare(b.date));
    if (g.quantity < -1e-9) g.warnings.push('Mehr verkauft als gekauft – die Datei deckt vermutlich nicht alle Käufe ab.');
    return g;
  });
  return { drafts, skipped, ignoredTypes: [...ignored] };
}

// ---------- applying to the portfolio ----------

const sameSecurity = (h: Holding, d: { isin?: string; name: string }): boolean =>
  h.assetClass === 'stock' && (d.isin ? h.isin === d.isin : !h.isin && normalizeHeader(h.name) === normalizeHeader(d.name));

/** The existing holding a draft would update, if any. */
export function matchHolding(state: PortfolioState, d: { isin?: string; name: string }): Holding | undefined {
  return state.holdings.find((h) => sameSecurity(h, d));
}

/**
 * Takes over depot positions. A position that already exists (same ISIN) is
 * replaced by the imported quantity and cost; the file knows no purchase
 * dates, so it becomes a single lot dated `today`.
 */
export function applyPositions(state: PortfolioState, drafts: PositionDraft[], today: string): PortfolioState {
  const holdings = [...state.holdings];
  const quotes = { ...state.quotes };
  for (const d of drafts) {
    const lot: Purchase = { id: newId(), kind: 'buy', date: today, quantity: d.quantity, totalCost: d.cost ?? 0 };
    const i = holdings.findIndex((h) => sameSecurity(h, d));
    const holding: Holding = i >= 0
      ? { ...holdings[i], isin: d.isin ?? holdings[i].isin, purchases: [lot] }
      : { id: newId(), assetClass: 'stock', name: d.name, isin: d.isin, currency: 'EUR', purchases: [lot] };
    if (i >= 0) holdings[i] = holding;
    else holdings.push(holding);
    // The file's price is a stand-in until a live quote exists; never overwrite one from the price service.
    const key = quoteKey(holding);
    if (key && d.price !== undefined && quotes[key]?.source !== 'api') {
      quotes[key] = { eurPrice: d.price, price: d.price, currency: 'EUR', source: 'manual', updatedAt: new Date().toISOString() };
    }
  }
  return { ...state, holdings, quotes };
}

/** Takes over buy/sell histories. An existing position (same ISIN) gets its history replaced by the file's. */
export function applyTransactions(state: PortfolioState, drafts: TransactionDraft[]): PortfolioState {
  const holdings = [...state.holdings];
  for (const d of drafts) {
    const i = holdings.findIndex((h) => sameSecurity(h, d));
    if (i >= 0) holdings[i] = { ...holdings[i], isin: d.isin ?? holdings[i].isin, purchases: d.purchases };
    else holdings.push({ id: newId(), assetClass: 'stock', name: d.name, isin: d.isin, currency: 'EUR', purchases: d.purchases });
  }
  return { ...state, holdings };
}

/** Sets the balance of an account, creating the account when `accountId` is undefined. */
export function applyBalance(
  state: PortfolioState,
  account: { accountId?: string; name: string; iban?: string; balance: number; balanceDate: string },
): PortfolioState {
  const { accountId, name, iban, balance, balanceDate } = account;
  if (accountId) {
    return {
      ...state,
      holdings: state.holdings.map((h) => (h.id === accountId ? { ...h, balance, balanceDate, iban: iban ?? h.iban } : h)),
    };
  }
  const holding: Holding = { id: newId(), assetClass: 'cash', name, iban, balance, balanceDate, purchases: [] };
  return { ...state, holdings: [...state.holdings, holding] };
}
