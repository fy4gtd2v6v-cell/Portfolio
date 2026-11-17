import { describe, expect, it } from 'vitest';
import {
  applyBalance, applyBrokerAccount, applyPositions, applyTransactions, autoMap, brokerBalance, detectKind, detectProvider, matchHolding, missingFields,
  parseFile, parseRows, pendingList, planTransactions, readMetalTransactions, readPositions, readStatement, readTransactions, transactionKind,
} from './importer';
import { buildXlsx, sheetFiles } from './xlsxTestFiles';
import { readXlsx } from './xlsx';
import type { TransactionDraft } from './importer';
import { decodeBytes } from './csv';
import { summarize, valueHolding } from './portfolio';
import { emptyState } from './types';

// Layout as documented for the Sparkasse "CSV-CAMT" export (17 columns, all quoted, dd.mm.yy, no balance).
const SPARKASSE = `"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"
"DE00500000000000000001";"17.11.26";"17.11.26";"KARTENZAHLUNG";"Tankstelle";"";"";"";"";"";"";"Tank AG";"DE00100000000000000002";"XXXXDEXX";"-55,10";"EUR";"Umsatz vorgemerkt"
"DE00500000000000000001";"14.11.26";"14.11.26";"LOHN GEHALT";"Gehalt 11/26";"";"";"";"";"";"";"Arbeitgeber GmbH";"DE00100000000000000003";"XXXXDEXX";"2.850,00";"EUR";"Umsatz gebucht"
"DE00500000000000000001";"03.11.26";"03.11.26";"FOLGELASTSCHRIFT";"Miete; November";"DE98ZZZ";"M-1";"";"";"";"";"Vermieter";"DE00100000000000000004";"XXXXDEXX";"-950,00";"EUR";"Umsatz gebucht"
`;

// Shape of an ING "Umsatzanzeige" export: account details first, then the table with a running balance, newest first.
const ING_GIRO = `Umsatzanzeige;Datei erstellt am: 17.11.2026 08:00

IBAN;DE00 5001 0000 0000 0000 05
Kontoname;Girokonto
Bank;ING
Kunde;Max Mustermann
Zeitraum;01.11.2026 - 17.11.2026
Saldo;3.412,77;EUR

Sortierung;Datum absteigend

In der CSV-Datei finden Sie alle bereits gebuchten Umsätze.

Buchung;Valuta;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung
14.11.2026;14.11.2026;Arbeitgeber GmbH;Gehalt/Rente;Gehalt 11/26;3.412,77;EUR;2.850,00;EUR
03.11.2026;03.11.2026;Vermieter;Lastschrift;Miete November;562,77;EUR;-950,00;EUR
`;

const DEPOT = `ISIN;WKN;Bezeichnung;Stück/Nominale;Einstandskurs;Währung;Einstandswert;Kurs;Kurswert
IE00B4L5Y983;A0RPWH;iShares Core MSCI World;42,5;78,20;EUR;3.323,50;101,36;4.307,80
US0378331005;865985;Apple Inc.;10;150,00;EUR;1.500,00;212,30;2.123,00
;;Summe;;;;;;
`;

const TRANSACTIONS = `Datum,Typ,ISIN,Name,Stück,Kurs,Betrag
2025-01-15,Kauf,IE00B4L5Y983,iShares Core MSCI World,10,90.00,-900.00
2025-03-01,Sparplan,IE00B4L5Y983,iShares Core MSCI World,2.5,92.00,-230.00
2025-06-10,Verkauf,IE00B4L5Y983,iShares Core MSCI World,4,100.00,400.00
2025-06-30,Dividende,IE00B4L5Y983,iShares Core MSCI World,,,12.40
2025-07-01,Zinsen,,,,,3.10
2025-08-01,Buy,US0378331005,Apple Inc.,3,200.00,-600.00
`;

describe('recognising files', () => {
  it('finds the table below a preamble and guesses the kind', () => {
    const ing = parseFile(ING_GIRO);
    expect(ing.header[0]).toBe('Buchung');
    expect(ing.rows).toHaveLength(2);
    expect(detectKind(ing.header)).toBe('statement');
    expect(detectKind(parseFile(SPARKASSE).header)).toBe('statement');
    expect(detectKind(parseFile(DEPOT).header)).toBe('positions');
    expect(detectKind(parseFile(TRANSACTIONS).header)).toBe('transactions');
  });

  it('maps columns by title and prefers the exact title', () => {
    const spk = parseFile(SPARKASSE);
    const m = autoMap(spk.header, 'statement');
    expect(spk.header[m.date]).toBe('Buchungstag');
    expect(spk.header[m.amount]).toBe('Betrag'); // not "Lastschrift Ursprungsbetrag"
    expect(m.balance).toBe(-1);
    expect(spk.header[m.info]).toBe('Info');
    const depot = parseFile(DEPOT);
    const d = autoMap(depot.header, 'positions');
    expect(depot.header[d.costPrice]).toBe('Einstandskurs');
    expect(depot.header[d.costTotal]).toBe('Einstandswert');
    expect(depot.header[d.price]).toBe('Kurs');
    expect(depot.header[d.value]).toBe('Kurswert');
  });

  it('names the required fields that are missing', () => {
    expect(missingFields('statement', autoMap(['Foo', 'Bar'], 'statement'))).toEqual(['Buchungsdatum', 'Betrag oder Saldo nach Buchung']);
    expect(missingFields('positions', autoMap(['ISIN', 'Stück'], 'positions'))).toEqual([]);
  });
});

describe('account statements', () => {
  it('takes the balance of the newest booking (ING: running balance, newest first)', () => {
    const f = parseFile(ING_GIRO);
    const r = readStatement(f, autoMap(f.header, 'statement'));
    expect(r).toMatchObject({ count: 2, balance: 3412.77, balanceDate: '2026-11-14', from: '2026-11-03', to: '2026-11-14', iban: 'DE00500100000000000005', accountName: 'Girokonto' });
    expect(r.sum).toBeCloseTo(1900, 9);
  });

  it('works without a balance column and skips pending bookings (Sparkasse)', () => {
    const f = parseFile(SPARKASSE);
    const r = readStatement(f, autoMap(f.header, 'statement'));
    expect(r.count).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.balance).toBeUndefined();
    expect(r.sum).toBeCloseTo(1900, 9);
    expect(r.to).toBe('2026-11-14');
    expect(r.iban).toBe('DE00500000000000000001'); // from the "Auftragskonto" column
  });

  it('finds the newest booking when the file is sorted oldest first', () => {
    const f = parseFile('Datum;Betrag;Saldo\n01.11.2026;10,00;110,00\n05.11.2026;-20,00;90,00');
    expect(readStatement(f, autoMap(f.header, 'statement')).balance).toBe(90);
  });
});

describe('depot positions', () => {
  it('reads quantity, cost and price and skips summary rows', () => {
    const f = parseFile(DEPOT);
    const { drafts, skipped } = readPositions(f, autoMap(f.header, 'positions'));
    expect(skipped).toBe(1);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ name: 'iShares Core MSCI World', isin: 'IE00B4L5Y983', quantity: 42.5, cost: 3323.5, price: 101.36, warnings: [] });
  });

  it('derives cost and price from the other columns and warns when cost is missing', () => {
    const f = parseFile('Name;ISIN;Anzahl;Kaufkurs;Marktwert\nFonds A;LU0000000001;4;25,00;120,00\nFonds B;LU0000000002;2;;50,00');
    const { drafts } = readPositions(f, autoMap(f.header, 'positions'));
    expect(drafts[0]).toMatchObject({ cost: 100, price: 30 });
    expect(drafts[1].cost).toBeUndefined();
    expect(drafts[1].warnings[0]).toMatch(/Einstandswert/);
  });

  it('creates holdings valued with the price from the file, and updates them on a second import', () => {
    const f = parseFile(DEPOT);
    const { drafts } = readPositions(f, autoMap(f.header, 'positions'));
    let state = applyPositions(emptyState(), drafts, '2026-11-17');
    expect(state.holdings).toHaveLength(2);
    const etf = state.holdings[0];
    expect(etf).toMatchObject({ assetClass: 'stock', isin: 'IE00B4L5Y983' });
    expect(etf.symbol).toBeUndefined();
    expect(valueHolding(etf, state).value).toBeCloseTo(42.5 * 101.36, 6);
    expect(valueHolding(etf, state).cost).toBe(3323.5);
    expect(matchHolding(state, drafts[0])?.id).toBe(etf.id);
    state = applyPositions(state, [{ ...drafts[0], quantity: 50, cost: 4000, price: 102 }], '2026-12-01');
    expect(state.holdings).toHaveLength(2);
    expect(state.holdings[0].id).toBe(etf.id);
    expect(valueHolding(state.holdings[0], state)).toMatchObject({ quantity: 50, cost: 4000, value: 5100 });
  });

  it('does not overwrite a live quote with the file price', () => {
    const state = emptyState();
    state.quotes['isin:IE00B4L5Y983'] = { eurPrice: 110, price: 110, currency: 'EUR', source: 'api', updatedAt: 'x' };
    const f = parseFile(DEPOT);
    const next = applyPositions(state, readPositions(f, autoMap(f.header, 'positions')).drafts, '2026-11-17');
    expect(next.quotes['isin:IE00B4L5Y983'].eurPrice).toBe(110);
  });
});

describe('security transactions', () => {
  it('tells buys from sells', () => {
    expect(transactionKind('Kauf')).toBe('buy');
    expect(transactionKind('Verkauf')).toBe('sell');
    expect(transactionKind('Sparplan-Ausführung')).toBe('buy');
    expect(transactionKind('SELL')).toBe('sell');
    expect(transactionKind('Dividende')).toBeUndefined();
  });

  it('groups by ISIN, keeps order and ignores dividends and interest', () => {
    const f = parseFile(TRANSACTIONS);
    const { drafts, skipped, ignoredTypes } = readTransactions(f, autoMap(f.header, 'transactions'));
    expect(ignoredTypes.sort()).toEqual(['Dividende', 'Zinsen']);
    expect(skipped).toBe(2);
    expect(drafts.map((d) => d.isin)).toEqual(['IE00B4L5Y983', 'US0378331005']);
    expect(drafts[0].purchases.map((p) => [p.kind, p.quantity, p.totalCost])).toEqual([['buy', 10, 900], ['buy', 2.5, 230], ['sell', 4, 400]]);
    expect(drafts[0].quantity).toBeCloseTo(8.5, 9);
    const state = applyTransactions(emptyState(), drafts);
    const v = valueHolding(state.holdings[0], state);
    expect(v.quantity).toBeCloseTo(8.5, 9);
    expect(v.realized).toBeCloseTo(400 - 4 * 90, 9); // FIFO: sold from the first lot
  });

  it('replaces a depot snapshot of the same security instead of adding to it', () => {
    const d = parseFile(DEPOT);
    let state = applyPositions(emptyState(), readPositions(d, autoMap(d.header, 'positions')).drafts, '2026-11-17');
    const t = parseFile(TRANSACTIONS);
    const plan = planTransactions(state, readTransactions(t, autoMap(t.header, 'transactions', t.rows)).drafts);
    expect(plan.find((p) => p.draft.isin === 'IE00B4L5Y983')!.replaced).toBe(true);
    state = applyTransactions(state, readTransactions(t, autoMap(t.header, 'transactions', t.rows)).drafts);
    const etf = state.holdings.find((h) => h.isin === 'IE00B4L5Y983')!;
    expect(valueHolding(etf, state).quantity).toBeCloseTo(8.5, 9);
  });

  it('warns when more was sold than bought', () => {
    const f = parseFile('Datum;Typ;ISIN;Stück;Betrag\n01.01.2026;Verkauf;IE00B4L5Y983;5;500,00');
    expect(readTransactions(f, autoMap(f.header, 'transactions')).drafts[0].warnings[0]).toMatch(/Mehr verkauft/);
  });
});

describe('accounts in the portfolio', () => {
  it('count towards total wealth but not towards invested capital or gain', () => {
    let state = applyBalance(emptyState(), { name: 'ING Girokonto', balance: 3412.77, balanceDate: '2026-11-14', iban: 'DE00' });
    const f = parseFile(DEPOT);
    state = applyPositions(state, readPositions(f, autoMap(f.header, 'positions')).drafts, '2026-11-17');
    const s = summarize(state);
    const depotValue = 42.5 * 101.36 + 10 * 212.3;
    expect(s.totalValue).toBeCloseTo(3412.77 + depotValue, 6);
    expect(s.cashValue).toBe(3412.77);
    expect(s.totalCost).toBe(4823.5);
    expect(s.gain).toBeCloseTo(depotValue - 4823.5, 6);
    expect(s.byClass.map((c) => c.assetClass)).toEqual(['stock', 'cash']);
    expect(s.unpriced).toEqual([]);
  });

  it('updates the balance of an existing account', () => {
    let state = applyBalance(emptyState(), { name: 'Sparkasse', balance: 100, balanceDate: '2026-11-01' });
    const id = state.holdings[0].id;
    state = applyBalance(state, { accountId: id, name: 'egal', balance: 250.5, balanceDate: '2026-11-17' });
    expect(state.holdings).toHaveLength(1);
    expect(state.holdings[0]).toMatchObject({ name: 'Sparkasse', balance: 250.5, balanceDate: '2026-11-17' });
  });
});

// Shape of Trade Republic's "Transaktionsexport" (2026): ISIN in a column called "symbol", fees in their own column,
// prepayments for private-market orders and IPO subscriptions without shares. Personal data replaced.
const TR = `"datetime","date","account_type","category","type","asset_class","name","symbol","shares","price","amount","fee","tax","currency","original_amount","original_currency","fx_rate","description","transaction_id","counterparty_name","counterparty_iban","payment_reference","mcc_code"
"2026-07-01T02:04:39Z","2026-07-01","DEFAULT","CASH","TRANSFER_INBOUND","","Max Mustermann","","","","500.000000","","","EUR","","","","Incoming transfer from Max Mustermann (DE00000000000000000000)","t1","Max Mustermann","DE00000000000000000000","",""
"2026-07-01T08:54:41Z","2026-07-01","DEFAULT","CASH","INTEREST_PAYMENT","","","","","","0.010000","","","EUR","","","","Interest payment","t2","","","",""
"2026-07-02T13:57:01Z","2026-07-02","DEFAULT","TRADING","BUY","STOCK","Bloom Energy","US0937121079","0.1912040000","261.5000000000","-50.00","","","EUR","","","","Savings plan execution US0937121079 BLOOM ENERGY A, quantity: 0.191204","t3","","","",""
"2026-08-03T08:22:53Z","2026-08-03","DEFAULT","CASH","PRIVATE_MARKET_BUY","PRIVATE_FUND","Private Equity","LU3176111881","","","-25.000000","","","EUR","","","","Private Markets pre-payment for buy order: x","t4","","","",""
"2026-09-02T08:22:35Z","2026-09-02","DEFAULT","CASH","PRIVATE_MARKET_BUY","PRIVATE_FUND","Private Equity","LU3176111881","","","-25.000000","","","EUR","","","","Private Markets pre-payment for buy order: y","t5","","","",""
"2026-09-21T15:46:03Z","2026-09-21","DEFAULT","TRADING","BUY","STOCK","2G Energy","DE000A0HL8N9","4.0916530000","61.1000000000","-250.00","-1.00","","EUR","","","","Buy trade DE000A0HL8N9 2G ENERGY AG, quantity: 4.091653","t6","","","",""
"2026-10-01T19:52:00Z","2026-10-01","DEFAULT","TRADING","BUY","PRIVATE_FUND","Private Equity","LU3176111881","0.2299620000","108.7135000000","","","","EUR","","","","BUY LU3176111881","t7","","","",""
"2026-11-02T15:05:22Z","2026-11-02","DEFAULT","TRADING","BUY","STOCK","Bloom Energy","US0937121079","0.2790170000","179.2000000000","-50.00","","","EUR","","","","Savings plan execution US0937121079 BLOOM ENERGY A, quantity: 0.279017","t8","","","",""
"2026-11-11T19:49:22Z","2026-11-11","DEFAULT","CASH","IPO_SUBSCRIPTION","STOCK","Anthropic","US03703U1079","","","-99.000000","-1.00","","EUR","","","","IPO access pre-payment for subscription: z","t9","","","",""
`;

describe('Trade Republic transaction export', () => {
  const file = parseFile(TR);

  it('is recognised as transactions, with the ISIN found in the "symbol" column', () => {
    expect(detectKind(file.header, file.rows)).toBe('transactions');
    const m = autoMap(file.header, 'transactions', file.rows);
    expect(file.header[m.isin]).toBe('symbol');
    expect(file.header[m.fee]).toBe('fee');
    expect(file.header[m.note]).toBe('description');
    // Without the content the title alone is not enough – that was the original bug.
    expect(autoMap(file.header, 'transactions').isin).toBe(-1);
  });

  it('groups trades per security with price, fee and savings-plan note', () => {
    const r = readTransactions(file, autoMap(file.header, 'transactions', file.rows));
    const byIsin: Record<string, TransactionDraft> = Object.fromEntries(r.drafts.map((d) => [d.isin, d]));
    const bloom = byIsin.US0937121079;
    expect(bloom.purchases.map((p) => [p.date, p.quantity, p.price, p.totalCost, p.note])).toEqual([
      ['2026-07-02', 0.191204, 261.5, 50, 'Sparplan'],
      ['2026-11-02', 0.279017, 179.2, 50, 'Sparplan'],
    ]);
    expect(bloom.invested).toBe(100);
    expect(bloom.lastPrice).toEqual({ price: 179.2, date: '2026-11-02' });
    // A one-off buy with a fee: the fee is part of the cost.
    expect(byIsin.DE000A0HL8N9.purchases[0]).toMatchObject({ totalCost: 251, fee: 1, price: 61.1, note: undefined });
    // The executed private-market buy has no amount: its cost comes from shares × price.
    expect(byIsin.LU3176111881.purchases[0].totalCost).toBeCloseTo(25, 2);
  });

  it('reports open orders and the remaining cash', () => {
    const r = readTransactions(file, autoMap(file.header, 'transactions', file.rows));
    expect(r.pending).toEqual([
      { name: 'Private Equity', isin: 'LU3176111881', amount: 25 }, // 2 × 25 paid, 1 executed
      { name: 'Anthropic', isin: 'US03703U1079', amount: 100 }, // 99 + 1 fee
    ]);
    // 500 + 0.01 − 50 − 25 − 25 − 250 − 1 − 50 − 99 − 1
    expect(r.cash).toEqual({ balance: -0.99, date: '2026-11-11' });
  });

  it('values every position with the last trade price and, on request, repairs an earlier import without ISIN', () => {
    const m = autoMap(file.header, 'transactions', file.rows);
    const { drafts } = readTransactions(file, m);
    // An earlier, broken import had created "Bloom Energy" without ISIN and without cost.
    let state = applyPositions(emptyState(), [{ key: 'x', name: 'Bloom Energy', quantity: 0.279017, warnings: [] }], '2026-11-17');
    // A position with nothing but 0-€ lots without import id is repaired automatically, without asking.
    expect(planTransactions(state, drafts).find((p) => p.holding)!.replaced).toBe(true);
    state = applyTransactions(state, drafts);
    const blooms = state.holdings.filter((h) => h.name === 'Bloom Energy');
    expect(blooms).toHaveLength(1);
    expect(blooms[0].isin).toBe('US0937121079');
    const v = valueHolding(blooms[0], state);
    expect(v.quantity).toBeCloseTo(0.470221, 6);
    expect(v.cost).toBe(100);
    expect(v.unitPrice).toBe(179.2);
    expect(v.priceUpdatedAt).toBe('2026-11-02T12:00:00.000Z');
    expect(summarize(state).unpriced).toEqual([]);
  });

  it('does not replace a live quote or a newer manual price with the trade price', () => {
    const m = autoMap(file.header, 'transactions', file.rows);
    const { drafts } = readTransactions(file, m);
    const state = emptyState();
    state.quotes['isin:US0937121079'] = { eurPrice: 200, price: 200, currency: 'EUR', source: 'api', updatedAt: '2026-10-01T00:00:00Z' };
    state.quotes['isin:DE000A0HL8N9'] = { eurPrice: 70, price: 70, currency: 'EUR', source: 'manual', updatedAt: '2026-11-15T00:00:00Z' };
    const next = applyTransactions(state, drafts);
    expect(next.quotes['isin:US0937121079'].eurPrice).toBe(200);
    expect(next.quotes['isin:DE000A0HL8N9'].eurPrice).toBe(70);
  });
});

describe('sales with fees and taxes', () => {
  it('reduce the proceeds', () => {
    const f = parseFile('Datum;Typ;ISIN;Stück;Kurs;Betrag;Gebühr;Steuer\n01.01.2026;Kauf;IE00B4L5Y983;10;10,00;-100,00;-1,00;\n01.06.2026;Verkauf;IE00B4L5Y983;10;12,00;120,00;-1,00;-4,75');
    const d = readTransactions(f, autoMap(f.header, 'transactions', f.rows)).drafts[0];
    expect(d.purchases.map((p) => p.totalCost)).toEqual([101, 114.25]);
  });
});

describe('importing a newer or overlapping file', () => {
  const rows = TR.trim().split('\n');
  const head = rows[0];
  // rows[1..9]: July to November. "Early" covers July–September, "late" September–November (overlapping).
  const early = parseFile([head, ...rows.slice(1, 7)].join('\n'));
  const late = parseFile([head, ...rows.slice(4)].join('\n'));
  const full = parseFile(TR);
  const read = (f: ReturnType<typeof parseFile>) => readTransactions(f, autoMap(f.header, 'transactions', f.rows));
  const importFile = (state: ReturnType<typeof emptyState>, f: ReturnType<typeof parseFile>) => {
    const r = read(f);
    const acc = state.holdings.find((h) => h.name === 'Trade Republic');
    return applyBrokerAccount(applyTransactions(state, r.drafts), { accountId: acc?.id, name: 'Trade Republic', events: r.cashEvents, withPending: true });
  };
  const snapshot = (state: ReturnType<typeof emptyState>) =>
    Object.fromEntries(state.holdings.map((h) => [h.name, h.assetClass === 'cash' ? h.balance : valueHolding(h, state).quantity.toFixed(6)]));

  it('adds only new trades, so early + late equals the full file', () => {
    const stepwise = importFile(importFile(emptyState(), early), late);
    const once = importFile(emptyState(), full);
    expect(snapshot(stepwise)).toEqual(snapshot(once));
    const bloom = stepwise.holdings.find((h) => h.isin === 'US0937121079')!;
    expect(bloom.purchases).toHaveLength(2);
  });

  it('changes nothing when the same file is imported again', () => {
    const once = importFile(emptyState(), full);
    const twice = importFile(once, full);
    expect(snapshot(twice)).toEqual(snapshot(once));
    expect(planTransactions(twice, read(full).drafts).every((p) => p.added.length === 0)).toBe(true);
    const acc = twice.holdings.find((h) => h.name === 'Trade Republic')!;
    expect(acc.broker!.refs).toHaveLength(read(full).cashEvents.length);
  });

  it('continues the cash account and the open orders across files', () => {
    const once = importFile(emptyState(), full);
    const acc = once.holdings.find((h) => h.name === 'Trade Republic')!;
    // cash −0.99 (see above) + open orders 25 (private equity) + 100 (IPO)
    expect(acc.broker!.cash).toBe(-0.99);
    expect(pendingList(acc.broker!).map((p) => p.amount)).toEqual([25, 100]);
    expect(acc.balance).toBe(124.01);
    const stepwise = importFile(importFile(emptyState(), early), late);
    expect(stepwise.holdings.find((h) => h.name === 'Trade Republic')!.balance).toBe(124.01);
    expect(brokerBalance(acc.broker!, false)).toBe(-0.99);
  });

  it('repairs only broken positions and merges all others', () => {
    // First a partial file, then the broken lot of another position appears (e.g. old data), then the rest.
    let state = importFile(emptyState(), early);
    state = applyPositions(state, [{ key: 'x', name: 'Anthropic Test', quantity: 1, warnings: [] }], '2026-11-17');
    const plans = planTransactions(state, read(late).drafts);
    expect(plans.filter((p) => p.replaced)).toEqual([]);
    state = importFile(state, late);
    expect(snapshot(state)).toEqual({ ...snapshot(importFile(emptyState(), full)), 'Anthropic Test': '1.000000' });
  });

  it('recognises trades entered by hand', () => {
    let state = emptyState();
    state = applyTransactions(state, read(early).drafts.filter((d) => d.isin === 'DE000A0HL8N9').map((d) => ({
      ...d, purchases: d.purchases.map((p) => ({ ...p, ref: undefined, note: undefined })), // as if typed in
    })));
    const plan = planTransactions(state, read(full).drafts).find((p) => p.draft.isin === 'DE000A0HL8N9')!;
    expect(plan.duplicates).toBe(1);
    expect(plan.added).toHaveLength(0);
  });

  it('keeps two identical trades in a file without transaction ids', () => {
    const f = parseFile('Datum;Typ;ISIN;Stück;Betrag\n01.01.2026;Kauf;IE00B4L5Y983;1;100,00\n01.01.2026;Kauf;IE00B4L5Y983;1;100,00');
    const r = readTransactions(f, autoMap(f.header, 'transactions', f.rows));
    expect(r.drafts[0].purchases.map((p) => p.ref)).toEqual([
      'IE00B4L5Y983|buy|2026-01-01|1.000000|100.00#1',
      'IE00B4L5Y983|buy|2026-01-01|1.000000|100.00#2',
    ]);
    const state = applyTransactions(applyTransactions(emptyState(), r.drafts), r.drafts);
    expect(state.holdings[0].purchases).toHaveLength(2);
  });
});

describe('precious-metal account (Flexgold layout)', () => {
  // Same layout as Flexgold's "Transaktionsverlauf": two rows per transaction (grams, euros). Ids made up.
  const FLX = [
    'Transaktions ID;Vault name;Vault ID;Title;Menge/Betrag;Einheit;Kurs;Einheit;Valutadatum',
    'T4;Edelmetall;V1;Sparplan Silber;33,4403;g;1,4952;EUR/g;2026-11-03',
    'T4;Edelmetall;V1;Sparplan Silber;-50;EUR;1,4952;EUR/g;2026-11-03',
    'T3;Edelmetall;V1;Sparplan Gold;0,4241;g;117,8967;EUR/g;2026-11-03',
    'T3;Edelmetall;V1;Sparplan Gold;-50;EUR;117,8967;EUR/g;2026-11-03',
    'T2;Edelmetall;V1;Einzahlung EUR;100;EUR;;;2026-10-30',
    'T1;Edelmetall;V1;Sparplan Gold;0,4061;g;123,1224;EUR/g;2026-10-03',
    'T1;Edelmetall;V1;Sparplan Gold;-50;EUR;123,1224;EUR/g;2026-10-03',
    'T0;Edelmetall;V1;Einzahlung EUR;100;EUR;;;2026-09-30',
  ].join('\n');
  const file = parseFile(FLX);
  const read = (f = file) => readMetalTransactions(f, autoMap(f.header, 'metals', f.rows));

  it('is recognised and both "Einheit" columns are told apart', () => {
    expect(detectKind(file.header, file.rows)).toBe('metals');
    const m = autoMap(file.header, 'metals', file.rows);
    expect([m.unit, m.priceUnit]).toEqual([5, 7]);
    expect(file.header[m.ref]).toBe('Transaktions ID');
  });

  it('turns weight rows into metal purchases and money rows into cash', () => {
    const r = read();
    expect(r.accountName).toBe('Flexgold');
    const gold = r.drafts.find((d) => d.metal === 'gold')!;
    expect(gold.name).toBe('Gold (Flexgold)');
    expect(gold.purchases.map((p) => [p.date, p.quantity, p.price, p.totalCost, p.note])).toEqual([
      ['2026-10-03', 0.4061, 123.1224, 50, 'Sparplan'],
      ['2026-11-03', 0.4241, 117.8967, 50, 'Sparplan'],
    ]);
    expect(r.drafts.find((d) => d.metal === 'silver')!.quantity).toBeCloseTo(33.4403, 6);
    // 100 + 100 deposits − 3 × 50 purchases
    expect(r.cash).toEqual({ balance: 50, date: '2026-11-03' });
  });

  it('creates metal positions valued with the live price per gram, without duplicates on re-import', () => {
    const r = read();
    let state = emptyState();
    state.metalPrices.gold = { eurPerGram: 120, updatedAt: 'x', source: 'api' };
    state = applyTransactions(state, r.drafts);
    state = applyBrokerAccount(state, { name: 'Flexgold', events: r.cashEvents, withPending: true });
    const gold = state.holdings.find((h) => h.metal === 'gold')!;
    expect(gold).toMatchObject({ assetClass: 'metal', fineness: 1000 });
    expect(valueHolding(gold, state).value).toBeCloseTo(0.8302 * 120, 6);
    expect(Object.keys(state.quotes)).toEqual([]); // metals use the shared metal prices
    const again = applyBrokerAccount(applyTransactions(state, read().drafts), {
      accountId: state.holdings.find((h) => h.name === 'Flexgold')!.id, name: 'Flexgold', events: read().cashEvents, withPending: true,
    });
    expect(again.holdings.map((h) => h.purchases.length)).toEqual(state.holdings.map((h) => h.purchases.length));
    expect(again.holdings.find((h) => h.name === 'Flexgold')!.balance).toBe(50);
  });

  it('treats weight leaving the account as a sale; without money as an outflow with a warning', () => {
    const f = parseFile([
      'Transaktions ID;Title;Menge/Betrag;Einheit;Kurs;Einheit;Valutadatum',
      'A;Kauf Gold;1;g;100;EUR/g;2026-01-01', 'A;Kauf Gold;-100;EUR;100;EUR/g;2026-01-01',
      'B;Verkauf Gold;-0,5;g;120;EUR/g;2026-06-01', 'B;Verkauf Gold;60;EUR;120;EUR/g;2026-06-01',
      'C;Lagergebühr Gold;-0,01;g;;;2026-12-31',
    ].join('\n'));
    const d = readMetalTransactions(f, autoMap(f.header, 'metals', f.rows)).drafts[0];
    expect(d.purchases.map((p) => [p.kind, p.quantity, p.totalCost])).toEqual([['buy', 1, 100], ['sell', 0.5, 60], ['sell', 0.01, 0]]);
    expect(d.warnings[0]).toMatch(/Abgang ohne Erlös/);
    expect(d.quantity).toBeCloseTo(0.49, 9);
  });

  it('converts kilograms, ounces and prices per ounce', () => {
    const f = parseFile('Datum;Art;Menge;Einheit;Kurs;Einheit\n01.01.2026;Kauf Silber;1;kg;31,1034768;EUR/oz\n02.01.2026;Kauf Platin;1;oz;;');
    const r = readMetalTransactions(f, autoMap(f.header, 'metals', f.rows));
    const silver = r.drafts.find((d) => d.metal === 'silver')!.purchases[0];
    expect(silver.quantity).toBe(1000);
    expect(silver.price).toBeCloseTo(1, 9); // 31.10 €/oz = 1 €/g
    expect(r.drafts.find((d) => d.metal === 'platinum')!.purchases[0].quantity).toBeCloseTo(31.1034768, 9);
  });

  it('reads the same layout from an Excel file', async () => {
    const lines = FLX.split('\n').map((l) => l.split(';'));
    const strings: string[] = [];
    const idx = (s: string) => (strings.includes(s) ? strings.indexOf(s) : strings.push(s) - 1);
    const xmlRows = lines.map((cells, r) => `<row r="${r + 1}">${cells.map((v, c) => {
      const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
      if (r > 0 && c === 8) return `<c r="${ref}" s="1"><v>${(Date.parse(v) / 86400000 + 25569).toString()}</v></c>`;
      if (r > 0 && (c === 4 || c === 6) && v !== '') return `<c r="${ref}"><v>${v.replace(',', '.')}</v></c>`;
      return v === '' ? '' : `<c r="${ref}" t="s"><v>${idx(v)}</v></c>`;
    }).join('')}</row>`).join('');
    const rows = await readXlsx(await buildXlsx(sheetFiles(strings, xmlRows)));
    const f = parseRows(rows);
    expect(detectKind(f.header, f.rows)).toBe('metals');
    expect(read(f).drafts.map((d) => [d.name, Number(d.quantity.toFixed(4)), d.invested])).toEqual([
      ['Silber (Flexgold)', 33.4403, 50],
      ['Gold (Flexgold)', 0.8302, 100],
    ]);
  });
});

describe('Trade Republic asset class', () => {
  it('marks funds as ETF and shares as stock', () => {
    const f = parseFile(TR);
    const r = readTransactions(f, autoMap(f.header, 'transactions', f.rows));
    expect(r.drafts.find((d) => d.isin === 'US0937121079')!.securityType).toBe('stock');
    expect(r.drafts.find((d) => d.isin === 'LU3176111881')!.securityType).toBe('etf');
  });
});

describe('ING depot overview and separate depots', () => {
  // Layout of ING's "Depotübersicht" CSV (Windows-1252, preamble, padded names, summary row). Personal data replaced.
  const ING = [
    'Depotübersicht vom 18.11.2026 00:19',
    'Kunde;Max Mustermann',
    '',
    'Depotnummer;0000000000',
    '',
    'ISIN;Wertpapiername;Stück/Nominale;Einheitskennzeichen;Einstandskurs;Währung;Einstandswert;Währung;Bewertungskurs;Währung;Zeit;Handelsplatz;Kurswert;Währung;Gewinn/Verlust;Währung;Gewinn/Verlust (%)',
    'US0937121079;BLOOM ENERGY A   DL-,0001;1;Stück;246,50;EUR;246,50;EUR;158,00;EUR;17.11.2026;Direkthandel;158,00;EUR;-88,50;EUR;-35,90%',
    'DE000ENER6Y0;SIEMENS ENERGY AG NA O.N.;2,0001;Stück;149,9925;EUR;300,00;EUR;125,98;EUR;17.11.2026;Direkthandel;251,97;EUR;-48,03;EUR;-16,01%',
    '"";;;;;Depot-Gesamtwert;404,50;EUR;;;;;409,97;EUR;5,47;EUR;1,35%',
  ].join('\r\n');
  const bytes = new Uint8Array([...ING].map((ch) => ({ ü: 0xfc, ä: 0xe4, ö: 0xf6 } as Record<string, number>)[ch] ?? ch.charCodeAt(0)));
  const file = parseFile(decodeBytes(bytes.buffer));
  const ingDrafts = readPositions(file, autoMap(file.header, 'positions', file.rows)).drafts;
  const tr = parseFile(TR);
  const trDrafts = readTransactions(tr, autoMap(tr.header, 'transactions', tr.rows)).drafts;

  it('reads the ING file: provider, clean names, cost, price and price date', () => {
    expect(detectKind(file.header, file.rows)).toBe('positions');
    expect(detectProvider(file)).toBe('ING');
    expect(detectProvider(tr)).toBe('Trade Republic');
    expect(ingDrafts.map((d) => [d.name, d.quantity, d.cost, d.price, d.priceDate])).toEqual([
      ['BLOOM ENERGY A DL-,0001', 1, 246.5, 158, '2026-11-17'],
      ['SIEMENS ENERGY AG NA O.N.', 2.0001, 300, 125.98, '2026-11-17'],
    ]);
  });

  it('keeps the same share in two depots apart, also next to positions imported before depots existed', () => {
    // Trade Republic history imported by an earlier version: no depot recorded.
    let state = applyTransactions(emptyState(), trDrafts);
    state = applyPositions(state, ingDrafts, '2026-11-18', 'ING');
    const blooms = state.holdings.filter((h) => h.isin === 'US0937121079');
    expect(blooms.map((h) => [h.account, h.purchases.length])).toEqual([[undefined, 2], ['ING', 1]]);
    // Both are valued with the newer of the two prices.
    expect(state.quotes['isin:US0937121079']).toMatchObject({ eurPrice: 158, updatedAt: '2026-11-17T12:00:00.000Z' });
    // Re-importing Trade Republic claims the old position (and records its depot) instead of creating a third one.
    state = applyTransactions(state, trDrafts, false, 'Trade Republic');
    expect(state.holdings.filter((h) => h.isin === 'US0937121079').map((h) => [h.account, h.purchases.length])).toEqual([['Trade Republic', 2], ['ING', 1]]);
    // A newer ING file updates only the ING position.
    state = applyPositions(state, [{ ...ingDrafts[0], quantity: 3, cost: 700 }], '2026-12-01', 'ING');
    const after = state.holdings.filter((h) => h.isin === 'US0937121079');
    expect(after.map((h) => [h.account, valueHolding(h, state).quantity])).toEqual([['Trade Republic', 0.470221], ['ING', 3]]);
  });

  it('never lets a depot snapshot overwrite a trade history without depot', () => {
    const state = applyTransactions(emptyState(), trDrafts);
    expect(matchHolding(state, ingDrafts[0], 'ING', true)).toBeUndefined();
    expect(matchHolding(state, ingDrafts[0], 'Trade Republic', false)?.isin).toBe('US0937121079');
  });
});
