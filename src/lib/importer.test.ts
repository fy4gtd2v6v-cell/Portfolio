import { describe, expect, it } from 'vitest';
import {
  applyBalance, applyPositions, applyTransactions, autoMap, detectKind, matchHolding, missingFields, parseFile,
  readPositions, readStatement, readTransactions, transactionKind,
} from './importer';
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
