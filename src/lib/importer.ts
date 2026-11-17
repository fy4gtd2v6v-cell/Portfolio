/**
 * Turning bank export files into portfolio data.
 *
 * There are no fixed per-bank templates, because banks change their exports
 * and document them poorly. Instead the columns are recognised by their
 * titles (many known spellings), and the user can correct the mapping.
 */
import { normalizeHeader, parseAmount, parseCsv, parseDate } from './csv';
import { BrokerAccount, Holding, Metal, METAL_LABEL, newId, PortfolioState, Purchase, quoteKey } from './types';
import { GRAMS_PER_TROY_OUNCE } from './units';

/** What a file contains. */
export type ImportKind = 'statement' | 'positions' | 'transactions' | 'metals';

export const KIND_LABEL: Record<ImportKind, string> = {
  statement: 'Kontoumsätze',
  positions: 'Depotbestand',
  transactions: 'Wertpapier-Transaktionen',
  metals: 'Edelmetall-Transaktionen',
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
    { key: 'fee', label: 'Gebühr', names: ['Gebühr', 'Gebühren', 'Gebuehr', 'Fee', 'Fees', 'Provision', 'Kosten', 'Transaktionskosten'] },
    { key: 'tax', label: 'Steuern', names: ['Steuer', 'Steuern', 'Tax', 'Taxes', 'Quellensteuer'] },
    { key: 'note', label: 'Beschreibung', names: ['Beschreibung', 'Description', 'Notiz', 'Verwendungszweck', 'Buchungstext'] },
    { key: 'ref', label: 'Buchungsnummer', names: ['Transaction ID', 'Transaktions-ID', 'Transaktionsnummer', 'Buchungsnummer', 'Auftragsnummer', 'Ordernummer', 'Order ID', 'Referenznummer'] },
    { key: 'assetType', label: 'Wertpapierart', names: ['asset_class', 'Assetklasse', 'Wertpapierart', 'Gattung', 'Instrument type', 'Security type'] },
  ],
  metals: [
    { key: 'date', label: 'Datum', names: ['Valutadatum', 'Valuta', 'Datum', 'Date', 'Buchungstag', 'Buchungsdatum', 'Ausführungsdatum'] },
    { key: 'title', label: 'Art (z. B. Sparplan Gold)', names: ['Title', 'Titel', 'Bezeichnung', 'Transaktionsart', 'Transaktion', 'Art', 'Typ', 'Type', 'Beschreibung'] },
    { key: 'amount', label: 'Menge / Betrag', names: ['Menge/Betrag', 'Menge', 'Betrag', 'Amount', 'Quantity', 'Gewicht'] },
    { key: 'unit', label: 'Einheit (g oder EUR)', names: ['Einheit', 'Unit', 'Mengeneinheit'] },
    { key: 'price', label: 'Kurs', names: ['Kurs', 'Preis', 'Price', 'Grammpreis'] },
    { key: 'priceUnit', label: 'Einheit des Kurses', names: ['Einheit', 'Kurseinheit', 'Price unit'] },
    { key: 'ref', label: 'Transaktions-ID', names: ['Transaktions ID', 'Transaktions-ID', 'Transaction ID', 'Transaktionsnummer', 'Buchungsnummer', 'Auftragsnummer'] },
  ],
};

/** Which fields a kind cannot do without. `name|isin` means one of the two. */
const REQUIRED: Record<ImportKind, string[]> = {
  statement: ['date', 'amount|balance'],
  positions: ['name|isin', 'quantity'],
  transactions: ['date', 'type', 'name|isin', 'quantity'],
  metals: ['date', 'title', 'amount', 'unit'],
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
  return parseRows(parseCsv(text));
}

/** Finds the table in already split rows, e.g. from an Excel sheet. */
export function parseRows(all: string[][]): ParsedFile {
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

/** A column whose filled cells are mostly ISINs, whatever its title (Trade Republic calls it "symbol"). */
function findIsinColumn(rows: string[][], used: Set<number>): number {
  const sample = rows.slice(0, 200);
  const width = Math.max(0, ...sample.map((r) => r.length));
  let best = -1;
  let bestShare = 0.5;
  for (let i = 0; i < width; i++) {
    if (used.has(i)) continue;
    const filled = sample.map((r) => (r[i] ?? '').trim()).filter((v) => v !== '');
    if (filled.length === 0) continue;
    const share = filled.filter((v) => ISIN_RE.test(v.toUpperCase())).length / filled.length;
    if (share > bestShare) {
      best = i;
      bestShare = share;
    }
  }
  return best;
}

export function autoMap(header: string[], kind: ImportKind, rows: string[][] = []): Mapping {
  const used = new Set<number>();
  const mapping: Mapping = {};
  for (const def of FIELDS[kind]) {
    let i = findColumn(header, def.names, used);
    if (i < 0 && def.key === 'isin') i = findIsinColumn(rows, used);
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

/** Best guess what the file contains, from its column titles and, if given, its content. */
export function detectKind(header: string[], rows: string[][] = []): ImportKind {
  const complete = (k: ImportKind) => missingFields(k, autoMap(header, k, rows)).length === 0;
  const tx = autoMap(header, 'transactions', rows);
  // A column with words like "Kauf" or "BUY" in it is the strongest hint for a transaction list.
  const hasTrades = tx.type >= 0 && rows.slice(0, 500).some((r) => transactionKind(r[tx.type] ?? '') !== undefined);
  // A unit column with grams next to titles naming a metal: a precious-metal account.
  const mt = autoMap(header, 'metals', rows);
  const metalRows = mt.unit >= 0 && mt.title >= 0
    && rows.slice(0, 500).some((r) => gramsPer(r[mt.unit] ?? '') !== undefined && metalOf(r[mt.title] ?? '') !== undefined);
  if (complete('metals') && metalRows) return 'metals';
  if (complete('transactions') && (tx.isin >= 0 || hasTrades)) return 'transactions';
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
  /** every trade carries a `ref`, so a later import of an overlapping file adds only what is new */
  purchases: Purchase[];
  /** remaining quantity after all buys and sells in the file */
  quantity: number;
  /** sum of all purchase amounts in the file, incl. fees */
  invested: number;
  /** price of the newest trade, as a stand-in until a live quote exists */
  lastPrice?: { price: number; date: string };
  warnings: string[];
  /** set for precious metals: the draft becomes a metal position */
  metal?: Metal;
  /** share or fund, as the file says */
  securityType?: 'stock' | 'etf';
}

/** One row that changes the broker's cash account or an open order. */
export interface CashEvent {
  ref: string;
  date: string;
  /** change of the cash balance */
  cash: number;
  /** change of money tied up in open orders, per security */
  pending?: { id: string; name: string; amount: number };
}

/** Money paid for an order that has not produced shares yet (e.g. IPO subscriptions, private-market orders). */
export interface PendingOrder {
  name: string;
  isin?: string;
  amount: number;
}

export interface TransactionsResult {
  drafts: TransactionDraft[];
  skipped: number;
  ignoredTypes: string[];
  /** open orders as far as this file alone shows them */
  pending: PendingOrder[];
  /**
   * Cash left on the broker account according to this file alone: every amount, fee and tax added up.
   * Only right when the file reaches back to the opening of the account.
   * Undefined when the file has no deposits (then it is no account history).
   */
  cash?: { balance: number; date: string };
  /** the same money movements row by row, for adding only new rows to an existing account */
  cashEvents: CashEvent[];
  /** a name the file suggests for the cash account, e.g. the provider */
  accountName?: string;
}

const BUY_RE = /kauf|buy|sparplan|savings|purchase|erwerb|einbuchung|zeichnung|subscription/i;
const SELL_RE = /verkauf|sell|sale|ausbuchung|veräußerung|veraeusserung/i;
const DEPOSIT_RE = /transfer|inpayment|einzahlung|deposit|überweisung|ueberweisung|gutschrift|top.?up|interest|zins/i;
const SAVINGS_RE = /savings plan|sparplan/i;

/** 'sell' is tested first: "Verkauf" contains "kauf". */
export function transactionKind(type: string): 'buy' | 'sell' | undefined {
  if (SELL_RE.test(type)) return 'sell';
  if (BUY_RE.test(type)) return 'buy';
  return undefined;
}

const orZero = (n: number) => (Number.isFinite(n) ? n : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** What makes a trade the same trade when the file has no transaction id. */
export function tradeFingerprint(p: Pick<Purchase, 'kind' | 'date' | 'quantity' | 'totalCost'>): string {
  return `${p.kind ?? 'buy'}|${p.date}|${p.quantity.toFixed(6)}|${p.totalCost.toFixed(2)}`;
}

/**
 * Gives identical rows a running number ("…#1", "…#2"), so two genuinely
 * identical trades in one file stay two trades.
 */
function numbered() {
  const seen = new Map<string, number>();
  return (base: string) => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}#${n}`;
  };
}

export function readTransactions(file: ParsedFile, mapping: Mapping): TransactionsResult {
  const groups = new Map<string, TransactionDraft>();
  const ignored = new Set<string>();
  const cashEvents: CashEvent[] = [];
  const tradeRef = numbered();
  const cashRef = numbered();
  let skipped = 0;
  let hasDeposits = false;
  for (const row of file.rows) {
    const type = cell(row, mapping.type);
    const kind = transactionKind(type);
    const date = parseDate(cell(row, mapping.date));
    const isin = cleanIsin(cell(row, mapping.isin));
    const name = cell(row, mapping.name) || isin || '';
    const quantity = Math.abs(parseAmount(cell(row, mapping.quantity)));
    const amount = parseAmount(cell(row, mapping.amount));
    const feeRaw = parseAmount(cell(row, mapping.fee ?? -1));
    const taxRaw = parseAmount(cell(row, mapping.tax ?? -1));
    const fee = Math.abs(orZero(feeRaw));
    const tax = Math.abs(orZero(taxRaw));
    const price = Math.abs(parseAmount(cell(row, mapping.price)));
    const note = cell(row, mapping.note ?? -1);
    const assetType = cell(row, mapping.assetType ?? -1);
    const txId = cell(row, mapping.ref ?? -1);
    const id = isin ?? normalizeHeader(name);
    const rowRef = txId || cashRef(`${date}|${type}|${id}|${cell(row, mapping.amount)}|${cell(row, mapping.fee ?? -1)}|${cell(row, mapping.tax ?? -1)}`);

    if (!kind && DEPOSIT_RE.test(type)) hasDeposits = true;
    const event: CashEvent | undefined = Number.isFinite(amount) && date
      ? { ref: rowRef, date, cash: round2(amount + orZero(feeRaw) + orZero(taxRaw)) }
      : undefined;

    if (!kind) {
      if (event) cashEvents.push(event);
      if (type) ignored.add(type);
      skipped++;
      continue;
    }
    if (!(quantity > 0)) {
      // Paid, but no shares yet: an order that is still open.
      if (event) {
        if (kind === 'buy' && name) event.pending = { id, name, amount: round2(Math.abs(amount) + fee) };
        cashEvents.push(event);
      }
      skipped++;
      continue;
    }
    if (!date || !name) {
      if (event) cashEvents.push(event);
      skipped++;
      continue;
    }
    const gross = Number.isFinite(amount) ? Math.abs(amount) : Number.isFinite(price) ? price * quantity : NaN;
    if (event) cashEvents.push(event);
    else if (kind === 'buy' && Number.isFinite(gross)) {
      // Executed without an amount: paid by an earlier prepayment, so the open order shrinks.
      cashEvents.push({ ref: rowRef, date, cash: 0, pending: { id, name, amount: -round2(gross) } });
    }
    // Buys cost the price plus fees; sales bring the price minus fees and taxes.
    const total = Number.isFinite(gross) ? round2(kind === 'buy' ? gross + fee : Math.max(0, gross - fee - tax)) : 0;
    const g: TransactionDraft = groups.get(id) ?? { key: id, name, isin, purchases: [], quantity: 0, invested: 0, warnings: [] };
    if (!g.securityType && assetType) g.securityType = /fund|fonds|etf|etc|etp/i.test(assetType) ? 'etf' : /stock|aktie|share|equity/i.test(assetType) ? 'stock' : undefined;
    if (!Number.isFinite(gross) && !g.warnings.length) g.warnings.push('Mindestens eine Buchung ohne Betrag – als 0 € übernommen.');
    const unitPrice = Number.isFinite(price) && price > 0 ? price : Number.isFinite(gross) ? gross / quantity : undefined;
    const purchase: Purchase = {
      id: newId(), kind, date, quantity, totalCost: total,
      price: unitPrice,
      fee: fee > 0 ? fee : undefined,
      note: SAVINGS_RE.test(note) || SAVINGS_RE.test(type) ? 'Sparplan' : undefined,
    };
    purchase.ref = txId || tradeRef(`${id}|${tradeFingerprint(purchase)}`);
    g.purchases.push(purchase);
    g.quantity += kind === 'buy' ? quantity : -quantity;
    if (kind === 'buy') g.invested += total;
    if (unitPrice !== undefined && (!g.lastPrice || date >= g.lastPrice.date)) g.lastPrice = { price: unitPrice, date };
    groups.set(id, g);
  }
  const drafts = [...groups.values()].map((g) => {
    g.purchases.sort((a, b) => a.date.localeCompare(b.date));
    g.invested = round2(g.invested);
    if (g.quantity < -1e-9) g.warnings.push('Mehr verkauft als gekauft – die Datei deckt vermutlich nicht alle Käufe ab.');
    return g;
  });
  const fresh = foldCashEvents(emptyBroker(), cashEvents);
  const lastDate = cashEvents.reduce((d, e) => (e.date > d ? e.date : d), '');
  return {
    drafts,
    skipped,
    ignoredTypes: [...ignored],
    pending: pendingList(fresh),
    cash: hasDeposits && cashEvents.some((e) => e.cash !== 0) ? { balance: fresh.cash, date: lastDate } : undefined,
    cashEvents,
  };
}

// ---------- precious-metal transactions (e.g. Flexgold) ----------

const METAL_WORDS: [RegExp, Metal][] = [
  [/palladium/i, 'palladium'],
  [/platin/i, 'platinum'],
  [/silber|silver/i, 'silver'],
  [/gold/i, 'gold'],
];

export function metalOf(text: string): Metal | undefined {
  return METAL_WORDS.find(([re]) => re.test(text))?.[1];
}

/** Grams per unit of a weight column ("g", "Gramm", "kg", "oz", "Unze"); undefined for money. */
function gramsPer(unit: string): number | undefined {
  const u = unit.trim().toLowerCase();
  if (u === 'g' || u === 'gr' || u === 'gramm' || u === 'gram' || u === 'grams') return 1;
  if (u === 'kg' || u === 'kilogramm') return 1000;
  if (/^(oz|ozt|oz\.? ?t|unze|feinunze|troy ?oz)/.test(u)) return GRAMS_PER_TROY_OUNCE;
  return undefined;
}

const isMoney = (unit: string) => /^(eur|€|euro|usd|\$)$/i.test(unit.trim());

/** Flexgold's export: two rows per transaction (grams and euros) with a vault id. */
const looksLikeFlexgold = (header: string[]) => header.some((h) => normalizeHeader(h) === 'vaultid');

/**
 * Reads a precious-metal account history: each transaction is one or more rows
 * with the same id – a weight row (grams of metal) and/or a money row (euros).
 * Weight rows become purchases (or sales/withdrawals when negative) of a metal
 * position, money rows move the cash account.
 */
export function readMetalTransactions(file: ParsedFile, mapping: Mapping): TransactionsResult {
  const provider = looksLikeFlexgold(file.header) ? 'Flexgold' : '';
  const groups = new Map<string, TransactionDraft>();
  const ignored = new Set<string>();
  const cashEvents: CashEvent[] = [];
  const legRef = numbered();
  let skipped = 0;
  let hasDeposits = false;

  // Collect the legs of each transaction.
  const txs = new Map<string, { date?: string; title: string; metal?: { grams: number; price?: number }; money?: number }>();
  file.rows.forEach((row, index) => {
    const id = cell(row, mapping.ref ?? -1) || `row${index}`;
    const t = txs.get(id) ?? { title: '' };
    t.title ||= cell(row, mapping.title);
    t.date ||= parseDate(cell(row, mapping.date));
    const amount = parseAmount(cell(row, mapping.amount));
    const unit = cell(row, mapping.unit);
    const per = gramsPer(unit);
    if (!Number.isFinite(amount)) return;
    if (per !== undefined) {
      const priceRaw = Math.abs(parseAmount(cell(row, mapping.price ?? -1)));
      const priceUnit = cell(row, mapping.priceUnit ?? -1).toLowerCase();
      const pricePer = /oz|unze/.test(priceUnit) ? GRAMS_PER_TROY_OUNCE : /kg/.test(priceUnit) ? 1000 : 1;
      t.metal = { grams: (t.metal?.grams ?? 0) + amount * per, price: Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw / pricePer : t.metal?.price };
    } else if (isMoney(unit) || unit === '') {
      t.money = (t.money ?? 0) + amount;
    }
    txs.set(id, t);
  });

  for (const [id, t] of txs) {
    const ref = id.startsWith('row') ? undefined : id;
    if (t.money !== undefined && t.date) {
      cashEvents.push({ ref: ref ? `${ref}|EUR` : legRef(`${t.date}|${t.title}|${t.money}`), date: t.date, cash: round2(t.money) });
      if (!t.metal && DEPOSIT_RE.test(t.title)) hasDeposits = true;
    }
    if (!t.metal) {
      if (t.money === undefined && t.title) ignored.add(t.title);
      skipped++;
      continue;
    }
    const metal = metalOf(t.title);
    if (!metal || !t.date || Math.abs(t.metal.grams) < 1e-9) {
      if (t.title) ignored.add(t.title);
      skipped++;
      continue;
    }
    const grams = Math.abs(t.metal.grams);
    const kind: 'buy' | 'sell' = t.metal.grams > 0 ? 'buy' : 'sell';
    const money = t.money !== undefined ? Math.abs(t.money) : undefined;
    // A buy costs what was paid; without a money row, weight × price. Outflows without money (fees, delivery) bring nothing.
    const total = round2(money ?? (kind === 'buy' && t.metal.price ? grams * t.metal.price : 0));
    const name = provider ? `${METAL_LABEL[metal]} (${provider})` : METAL_LABEL[metal];
    const key = `metal:${metal}:${normalizeHeader(name)}`;
    const g = groups.get(key) ?? { key, name, metal, purchases: [], quantity: 0, invested: 0, warnings: [] };
    const purchase: Purchase = {
      id: newId(), kind, date: t.date, quantity: grams, totalCost: total,
      price: t.metal.price ?? (money !== undefined && grams > 0 ? money / grams : undefined),
      note: SAVINGS_RE.test(t.title) ? 'Sparplan' : kind === 'sell' && !/verkauf|sell/i.test(t.title) ? t.title : undefined,
    };
    purchase.ref = ref ? `${ref}|g` : legRef(`${key}|${tradeFingerprint(purchase)}`);
    if (kind === 'sell' && money === undefined && !g.warnings.some((w) => w.startsWith('Abgang'))) {
      g.warnings.push(`Abgang ohne Erlös übernommen (${t.title}) – z. B. Gebühr oder Auslieferung.`);
    }
    g.purchases.push(purchase);
    g.quantity += kind === 'buy' ? grams : -grams;
    if (kind === 'buy') g.invested += total;
    if (purchase.price && (!g.lastPrice || t.date >= g.lastPrice.date)) g.lastPrice = { price: purchase.price, date: t.date };
    groups.set(key, g);
  }

  const drafts = [...groups.values()].map((g) => {
    g.purchases.sort((a, b) => a.date.localeCompare(b.date));
    g.invested = round2(g.invested);
    if (g.quantity < -1e-9) g.warnings.push('Mehr Abgänge als Zugänge – die Datei deckt vermutlich nicht alle Käufe ab.');
    return g;
  });
  const fresh = foldCashEvents(emptyBroker(), cashEvents);
  const lastDate = cashEvents.reduce((d, e) => (e.date > d ? e.date : d), '');
  return {
    drafts,
    skipped,
    ignoredTypes: [...ignored],
    pending: [],
    cash: hasDeposits ? { balance: fresh.cash, date: lastDate } : undefined,
    cashEvents,
    accountName: provider || undefined,
  };
}

// ---------- broker cash account ----------

export const emptyBroker = (): BrokerAccount => ({ refs: [], cash: 0, pending: {} });

/** Applies the rows a broker account has not seen yet. Returns the new state and how many rows were new. */
export function foldCashEvents(start: BrokerAccount, events: CashEvent[]): BrokerAccount & { added: number; delta: number } {
  const known = new Set(start.refs);
  const pending: BrokerAccount['pending'] = Object.fromEntries(Object.entries(start.pending).map(([k, v]) => [k, { ...v }]));
  let cash = start.cash;
  let added = 0;
  let delta = 0;
  for (const e of events) {
    if (known.has(e.ref)) continue;
    known.add(e.ref);
    added++;
    cash += e.cash;
    delta += e.cash;
    if (e.pending) {
      const p = pending[e.pending.id] ?? { name: e.pending.name, amount: 0 };
      p.amount = round2(p.amount + e.pending.amount);
      pending[e.pending.id] = p;
    }
  }
  return { refs: [...known], cash: round2(cash), pending, added, delta: round2(delta) };
}

/** Open orders with money still tied up in them. */
export function pendingList(b: BrokerAccount): PendingOrder[] {
  return Object.entries(b.pending)
    .filter(([, p]) => p.amount > 0.005)
    .map(([id, p]) => ({ name: p.name, isin: ISIN_RE.test(id) ? id : undefined, amount: p.amount }));
}

export const brokerBalance = (b: BrokerAccount, withPending: boolean): number =>
  round2(b.cash + (withPending ? pendingList(b).reduce((s, p) => s + p.amount, 0) : 0));

/**
 * Updates (or creates) the broker's cash account with the rows it has not seen yet.
 * Without earlier import data the account starts from zero, so its balance is the sum of the file.
 */
export function applyBrokerAccount(
  state: PortfolioState,
  opts: { accountId?: string; name: string; events: CashEvent[]; withPending: boolean },
): PortfolioState {
  const existing = opts.accountId ? state.holdings.find((h) => h.id === opts.accountId) : undefined;
  const next = foldCashEvents(existing?.broker ?? emptyBroker(), opts.events);
  const broker: BrokerAccount = { refs: next.refs, cash: next.cash, pending: next.pending, withPending: opts.withPending };
  const lastDate = opts.events.reduce((d, e) => (e.date > d ? e.date : d), existing?.balanceDate ?? '');
  const fields = { broker, balance: brokerBalance(broker, opts.withPending), balanceDate: lastDate || existing?.balanceDate };
  if (existing) {
    return { ...state, holdings: state.holdings.map((h) => (h.id === existing.id ? { ...h, ...fields } : h)) };
  }
  const holding: Holding = { id: newId(), assetClass: 'cash', name: opts.name, purchases: [], ...fields };
  return { ...state, holdings: [...state.holdings, holding] };
}

// ---------- applying to the portfolio ----------

/** Same ISIN, or – when one side has none, e.g. after an earlier import without ISIN – the same name. */
const sameSecurity = (h: Holding, d: { isin?: string; name: string; metal?: Metal }): boolean =>
  d.metal
    ? h.assetClass === 'metal' && h.metal === d.metal && normalizeHeader(h.name) === normalizeHeader(d.name)
    : h.assetClass === 'stock' && (d.isin && h.isin ? h.isin === d.isin : normalizeHeader(h.name) === normalizeHeader(d.name));

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
    // Marked as a snapshot: a transaction history imported later replaces it instead of adding to it.
    const lot: Purchase = { id: newId(), kind: 'buy', date: today, quantity: d.quantity, totalCost: d.cost ?? 0, ref: `snapshot:${today}`, note: 'Depotbestand' };
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

/** How an import would change one security: which trades are new, which are already there. */
export interface TradePlan {
  draft: TransactionDraft;
  holding?: Holding;
  added: Purchase[];
  duplicates: number;
  /** the position's existing trades are dropped in favour of the file's */
  replaced: boolean;
}

/**
 * A position whose only purchases are 0-€ lots without import id: what the
 * first version of the import made of a transaction list. Such lots are
 * replaced automatically, everything else is merged.
 */
export function hasOnlyBrokenLots(h: Holding): boolean {
  return h.purchases.length > 0 && h.purchases.every((p) => (!p.ref && p.totalCost === 0) || p.ref?.startsWith('snapshot:'));
}

/**
 * Compares the file's trades with what a position already has. A trade counts
 * as known when its `ref` (transaction id or fingerprint) matches, or – for
 * trades entered by hand, which have no ref – when date, quantity, amount and
 * kind are the same. With `replace`, the file's trades replace all existing ones.
 */
export function planTransactions(state: PortfolioState, drafts: TransactionDraft[], replace = false): TradePlan[] {
  return drafts.map((draft) => {
    const holding = state.holdings.find((h) => sameSecurity(h, draft));
    if (!holding) return { draft, holding, added: draft.purchases, duplicates: 0, replaced: false };
    if (replace || hasOnlyBrokenLots(holding)) return { draft, holding, added: draft.purchases, duplicates: 0, replaced: true };
    const refs = new Set(holding.purchases.map((p) => p.ref).filter(Boolean));
    const byHand = new Map<string, number>();
    for (const p of holding.purchases) {
      if (!p.ref) byHand.set(tradeFingerprint(p), (byHand.get(tradeFingerprint(p)) ?? 0) + 1);
    }
    const added: Purchase[] = [];
    let duplicates = 0;
    for (const p of draft.purchases) {
      const fp = tradeFingerprint(p);
      if (p.ref && refs.has(p.ref)) {
        duplicates++;
      } else if ((byHand.get(fp) ?? 0) > 0) {
        byHand.set(fp, byHand.get(fp)! - 1);
        duplicates++;
      } else {
        added.push(p);
      }
    }
    return { draft, holding, added, duplicates, replaced: false };
  });
}

/**
 * Adds the new trades of each security to its position (creating positions as
 * needed). With `replace`, or for positions with only broken 0-€ lots, a
 * position's existing trades are replaced instead.
 * The price of the newest trade stands in for a live quote until one exists.
 */
export function applyTransactions(state: PortfolioState, drafts: TransactionDraft[], replace = false): PortfolioState {
  const holdings = [...state.holdings];
  const quotes = { ...state.quotes };
  for (const plan of planTransactions(state, drafts, replace)) {
    const { draft: d } = plan;
    const i = plan.holding ? holdings.findIndex((h) => h.id === plan.holding!.id) : -1;
    const base = i >= 0 && !plan.replaced ? holdings[i].purchases : [];
    const purchases = [...base, ...plan.added].sort((a, b) => a.date.localeCompare(b.date));
    const fresh: Holding = d.metal
      // The provider's grams are fine metal, so the fineness is 1000 ‰.
      ? { id: newId(), assetClass: 'metal', name: d.name, metal: d.metal, fineness: 1000, purchases }
      : { id: newId(), assetClass: 'stock', name: d.name, isin: d.isin, currency: 'EUR', securityType: d.securityType, purchases };
    const holding: Holding = i >= 0
      ? { ...holdings[i], isin: d.isin ?? holdings[i].isin, securityType: holdings[i].securityType ?? d.securityType, purchases }
      : fresh;
    if (i >= 0) holdings[i] = holding;
    else holdings.push(holding);
    if (d.metal) continue; // metals are valued with the shared price per gram, not a quote of their own
    const key = quoteKey(holding);
    const existing = key ? quotes[key] : undefined;
    // Never replace a live quote, and never a manual price that is newer than the last trade.
    const replaceQuote = !existing || (existing.source !== 'api' && existing.updatedAt.slice(0, 10) <= (d.lastPrice?.date ?? ''));
    if (key && d.lastPrice && replaceQuote) {
      quotes[key] = { eurPrice: d.lastPrice.price, price: d.lastPrice.price, currency: 'EUR', source: 'manual', updatedAt: `${d.lastPrice.date}T12:00:00.000Z` };
    }
  }
  return { ...state, holdings, quotes };
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
