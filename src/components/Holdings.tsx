import { useEffect, useRef, useState } from 'react';
import { CategoryIcon, CATEGORY_COLOR, ClassIcon, CLASS_COLOR, DepotHeader, Icon, useDepotFolding } from './ui';
import type { Update } from '../App';
import { fmtEur, fmtNum, fmtSignedEur, parseNum, today } from '../lib/format';
import { applyFifo, depotNames, groupByDepot, sortTransactions, valueHolding } from '../lib/portfolio';
import { CryptoMatch, isCurrency, searchCrypto, searchStocks, StockMatch } from '../lib/prices';
import { rankSymbolMatches, searchTerm } from '../lib/symbols';
import { pendingList } from '../lib/importer';
import {
  ASSET_CLASSES, AssetClass, CATEGORIES, Category, CATEGORY_LABEL, categoryOf, CLASS_LABEL, Currency, CURRENCIES, Holding, Metal, METAL_LABEL, METALS, newId, PortfolioState, Purchase, quoteKey,
} from '../lib/types';
import { toGrams, WeightUnit } from '../lib/units';

const FINENESS_PRESETS = [999.9, 999, 916.7, 900, 835, 750, 585];

type Filter = Category | 'all';

export function HoldingsView({ state, update, onAdd, onImport, focusId, focusDepot, initialFilter }: {
  state: PortfolioState;
  update: Update;
  onAdd: () => void;
  onImport: () => void;
  focusId?: string;
  /** depot to scroll to, e.g. after a click on it on the start page */
  focusDepot?: string;
  initialFilter?: Category | null;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter ?? 'all');
  const classes = CATEGORIES.filter((c) => state.holdings.some((h) => categoryOf(h) === c));
  // A position opened from the overview must be visible, so jumping to one clears the filter.
  useEffect(() => {
    if (focusId) setFilter('all');
  }, [focusId]);
  const active: Filter = filter !== 'all' && !classes.includes(filter) ? 'all' : filter;
  const shown = state.holdings.filter((h) => active === 'all' || categoryOf(h) === active);
  const groups = groupByDepot(state, shown);
  const scrolledTo = useRef<string | undefined>();
  const depots = depotNames(state);
  const folding = useDepotFolding(state.settings.collapsedDepots, (collapsedDepots) =>
    update((s) => ({ ...s, settings: { ...s.settings, collapsedDepots } })));

  return (
    <>
      <section className="card section-head">
        <div>
          <h2>Positionen</h2>
          <p className="muted small">
            {state.holdings.length === 0
              ? 'Noch keine Positionen angelegt.'
              : `${state.holdings.length} Position${state.holdings.length === 1 ? '' : 'en'} · zum Bearbeiten anklicken`}
          </p>
        </div>
        <div className="inline">
          <button className="with-icon" onClick={onImport} title="Kontoumsätze oder Depotbestand aus einer Bank-Datei übernehmen"><Icon.upload />Datei importieren</button>
          <button className="primary with-icon" onClick={onAdd}><Icon.plus />Neue Position</button>
        </div>
        {classes.length > 1 && (
          <div className="chips" role="radiogroup" aria-label="Nach Anlageklasse filtern">
            <button type="button" role="radio" aria-checked={active === 'all'} className={`filter-chip ${active === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              Alle <span className="count">{state.holdings.length}</span>
            </button>
            {classes.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={active === c} className={`filter-chip ${active === c ? 'active' : ''}`}
                style={{ '--c': CATEGORY_COLOR[c] } as React.CSSProperties} onClick={() => setFilter(c)}>
                <span className="swatch" style={{ background: CATEGORY_COLOR[c] }} />
                {CATEGORY_LABEL[c]} <span className="count">{state.holdings.filter((h) => categoryOf(h) === c).length}</span>
              </button>
            ))}
          </div>
        )}
        {groups.length > 1 && (
          <div className="fold-all">
            <button type="button" className="link" onClick={() => folding.setAll(groups.map((g) => g.depot), true)}>Alle Depots aufklappen</button>
            <button type="button" className="link" onClick={() => folding.setAll(groups.map((g) => g.depot), false)}>Alle zuklappen</button>
          </div>
        )}
      </section>
      {groups.map((g) => {
        // A position opened from elsewhere is shown even if its depot is folded.
        const open = folding.isOpen(g.depot) || g.holdings.some((h) => h.id === focusId);
        return (
          <section key={g.depot} className="depot-group" aria-label={`Depot ${g.depot}`}
            ref={(el) => { if (el && g.depot === focusDepot && scrolledTo.current !== focusDepot) { scrolledTo.current = focusDepot; el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }}>
            <DepotHeader depot={g.depot} count={g.holdings.length} value={g.value} gain={g.gain} cost={g.cost} open={open} onToggle={() => folding.toggle(g.depot)} />
            {open && (
              <div className="depot-items">
                {g.holdings.map((h) =>
                  h.assetClass === 'cash'
                    ? <CashCard key={h.id} holding={h} update={update} focused={h.id === focusId} depots={depots} />
                    : <HoldingCard key={h.id} holding={h} state={state} update={update} focused={h.id === focusId} depots={depots} />,
                )}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

/** Text field for the depot of a position, with the depots already in use as suggestions. */
function DepotField({ holding: h, depots, update }: { holding: Holding; depots: string[]; update: Update }) {
  const [value, setValue] = useState(h.account ?? '');
  const listId = `depots-${h.id}`;
  const save = () => {
    const next = value.trim() || undefined;
    if (next !== h.account) update((s) => ({ ...s, holdings: s.holdings.map((x) => (x.id === h.id ? { ...x, account: next } : x)) }));
  };
  return (
    <label className="field type-field">
      <span>Depot / Anbieter</span>
      <input list={listId} placeholder="z. B. ING" value={value} onChange={(e) => setValue(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
      <datalist id={listId}>{depots.map((d) => <option key={d} value={d} />)}</datalist>
    </label>
  );
}

// ---------------- Purchase input (shared) ----------------

interface PurchaseDraft { kind: 'buy' | 'sell'; date: string; quantity: string; unit: WeightUnit; totalCost: string }
const emptyDraft = (): PurchaseDraft => ({ kind: 'buy', date: today(), quantity: '', unit: 'g', totalCost: '' });

function PurchaseFields({ draft, set, isMetal }: { draft: PurchaseDraft; set: (d: PurchaseDraft) => void; isMetal: boolean }) {
  const sell = draft.kind === 'sell';
  return (
    <div className="grid">
      <label className="field">
        <span>{sell ? 'Verkaufsdatum' : 'Kaufdatum'}</span>
        <input type="date" value={draft.date} onChange={(e) => set({ ...draft, date: e.target.value })} />
      </label>
      <label className="field">
        <span>{isMetal ? 'Gewicht (brutto)' : 'Menge'}</span>
        <div className="inline">
          <input inputMode="decimal" placeholder={isMetal ? 'z. B. 100' : 'z. B. 10'} value={draft.quantity} onChange={(e) => set({ ...draft, quantity: e.target.value })} />
          {isMetal && (
            <select value={draft.unit} onChange={(e) => set({ ...draft, unit: e.target.value as WeightUnit })} aria-label="Gewichtseinheit">
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="oz">oz</option>
            </select>
          )}
        </div>
      </label>
      <label className="field">
        <span>{sell ? 'Verkaufserlös gesamt in € (nach Gebühren)' : 'Kaufpreis gesamt in € (inkl. Gebühren)'}</span>
        <input inputMode="decimal" placeholder="z. B. 7.450,00" value={draft.totalCost} onChange={(e) => set({ ...draft, totalCost: e.target.value })} />
      </label>
    </div>
  );
}

function toPurchase(d: PurchaseDraft, isMetal: boolean): Purchase | string {
  const q = parseNum(d.quantity);
  const c = parseNum(d.totalCost);
  if (!d.date) return 'Bitte ein Datum angeben.';
  if (!(q > 0)) return 'Bitte eine Menge größer 0 eingeben.';
  if (!(c >= 0)) return d.kind === 'sell' ? 'Bitte einen gültigen Verkaufserlös eingeben.' : 'Bitte einen gültigen Kaufpreis eingeben.';
  return { id: newId(), kind: d.kind, date: d.date, quantity: isMetal ? toGrams(q, d.unit) : q, totalCost: c };
}

// ---------------- Add holding ----------------

/** The form for a new position. `onDone` receives the id of the created holding, or nothing on cancel. */
export function AddHolding({ state, update, onDone }: { state: PortfolioState; update: Update; onDone: (createdId?: string) => void }) {
  const [cls, setCls] = useState<AssetClass>('metal');
  const [name, setName] = useState('');
  const [metal, setMetal] = useState<Metal>('gold');
  const [fineness, setFineness] = useState('999,9');
  const [symbol, setSymbol] = useState('');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [securityType, setSecurityType] = useState<'stock' | 'etf'>('stock');
  const [coinId, setCoinId] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [balance, setBalance] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cls === 'cash') {
      const b = parseNum(balance);
      if (!name.trim()) return setError('Bitte einen Namen für das Konto angeben, z. B. „ING Girokonto“.');
      if (!Number.isFinite(b)) return setError('Bitte den aktuellen Kontostand eingeben.');
      const account: Holding = { id: newId(), assetClass: 'cash', name: name.trim(), balance: b, balanceDate: today(), purchases: [] };
      update((s) => ({ ...s, holdings: [...s.holdings, account] }));
      return onDone(account.id);
    }
    const p = toPurchase(draft, cls === 'metal');
    if (typeof p === 'string') return setError(p);
    const h: Holding = { id: newId(), assetClass: cls, name: name.trim(), purchases: [p] };
    if (cls === 'metal') {
      const f = parseNum(fineness);
      if (!(f > 0 && f <= 1000)) return setError('Feingehalt in ‰ zwischen 0 und 1000 angeben, z. B. 999,9.');
      h.metal = metal;
      h.fineness = f;
      h.name ||= `${METAL_LABEL[metal]} ${fmtNum(f, 1)}`;
    } else if (cls === 'stock') {
      if (!symbol.trim()) return setError('Bitte ein Symbol angeben, z. B. AAPL oder SAP.DEX.');
      h.symbol = symbol.trim().toUpperCase();
      h.currency = currency;
      h.securityType = securityType;
      h.name ||= h.symbol;
    } else {
      if (!coinId.trim()) return setError('Bitte einen Coin auswählen oder die CoinGecko-ID eingeben, z. B. bitcoin.');
      h.coinId = coinId.trim().toLowerCase();
      h.name ||= h.coinId;
    }
    update((s) => ({ ...s, holdings: [...s.holdings, h] }));
    onDone(h.id);
  }

  return (
    <form onSubmit={submit}>
      <div className="class-picker" role="radiogroup" aria-label="Anlageklasse">
        {ASSET_CLASSES.map((c) => (
          <button type="button" key={c} role="radio" aria-checked={cls === c} className={cls === c ? 'active' : ''}
            style={{ '--c': CLASS_COLOR[c] } as React.CSSProperties} onClick={() => { setCls(c); setError(''); }}>
            <ClassIcon assetClass={c} large />
            {CLASS_LABEL[c]}
          </button>
        ))}
      </div>

      {cls === 'metal' && (
        <div className="grid">
          <label className="field">
            <span>Metall</span>
            <select value={metal} onChange={(e) => setMetal(e.target.value as Metal)}>
              {METALS.map((m) => <option key={m} value={m}>{METAL_LABEL[m]}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Feingehalt in ‰</span>
            <input list="fineness" inputMode="decimal" value={fineness} onChange={(e) => setFineness(e.target.value)} />
            <datalist id="fineness">{FINENESS_PRESETS.map((f) => <option key={f} value={fmtNum(f, 1)} />)}</datalist>
          </label>
          <label className="field">
            <span>Bezeichnung (optional)</span>
            <input placeholder="z. B. Barren 100 g, Krügerrand" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
      )}

      {cls === 'stock' && (
        <StockPicker apiKey={state.settings.alphaVantageKey} onPick={(m) => {
          setSymbol(m.symbol);
          setName(m.name);
          if (isCurrency(m.currency)) setCurrency(m.currency);
        }}>
          <div className="grid">
            <label className="field">
              <span>Symbol (Alpha Vantage)</span>
              <input placeholder="z. B. AAPL, SAP.DEX" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
            </label>
            <label className="field">
              <span>Handelswährung</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Art</span>
              <select value={securityType} onChange={(e) => setSecurityType(e.target.value as 'stock' | 'etf')}>
                <option value="stock">Aktie</option>
                <option value="etf">ETF / Fonds</option>
              </select>
            </label>
            <label className="field">
              <span>Bezeichnung (optional)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          </div>
        </StockPicker>
      )}

      {cls === 'crypto' && (
        <CryptoPicker apiKey={state.settings.coingeckoKey} onPick={(m) => { setCoinId(m.id); setName(m.name); }}>
          <div className="grid">
            <label className="field">
              <span>CoinGecko-ID</span>
              <input placeholder="z. B. bitcoin, ethereum" value={coinId} onChange={(e) => setCoinId(e.target.value)} />
            </label>
            <label className="field">
              <span>Bezeichnung (optional)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          </div>
        </CryptoPicker>
      )}

      {cls === 'cash' ? (
        <>
          <div className="grid">
            <label className="field">
              <span>Name des Kontos</span>
              <input placeholder="z. B. ING Girokonto, Sparkasse Tagesgeld" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Aktueller Kontostand in €</span>
              <input inputMode="decimal" placeholder="z. B. 3.412,77" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </label>
          </div>
          <p className="muted small">Den Kontostand kannst du später von Hand ändern oder über „Datei importieren“ aus einem Kontoexport übernehmen.</p>
        </>
      ) : (
        <>
          <h3>Erster Kauf</h3>
          <PurchaseFields draft={draft} set={setDraft} isMetal={cls === 'metal'} />
        </>
      )}
      {error && <div className="field-error">{error}</div>}
      <div className="inline">
        <button type="submit" className="primary">{cls === 'cash' ? 'Konto anlegen' : 'Position anlegen'}</button>
        <button type="button" onClick={() => onDone()}>Abbrechen</button>
      </div>
    </form>
  );
}

function SearchBox<T>({ placeholder, search, render, onPick, keyOf, children }: {
  placeholder: string;
  search: (q: string) => Promise<T[]>;
  render: (m: T) => React.ReactNode;
  keyOf: (m: T) => string;
  onPick: (m: T) => void;
  children: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function run() {
    if (!q.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const r = await search(q.trim());
      setResults(r);
      if (r.length === 0) setErr('Nichts gefunden.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="inline">
        <input placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } }} />
        <button type="button" onClick={run} disabled={busy}>{busy ? 'Sucht …' : 'Suchen'}</button>
      </div>
      {err && <div className="field-error">{err}</div>}
      {results.length > 0 && (
        <ul className="results">
          {results.map((m) => (
            <li key={keyOf(m)}>
              <button type="button" className="result" onClick={() => { onPick(m); setResults([]); }}>{render(m)}</button>
            </li>
          ))}
        </ul>
      )}
      {children}
    </>
  );
}

function StockPicker({ apiKey, onPick, children }: { apiKey: string; onPick: (m: StockMatch) => void; children: React.ReactNode }) {
  return (
    <SearchBox<StockMatch>
      placeholder="Aktie/ETF suchen, z. B. Apple oder SAP (kostet 1 Abfrage)"
      search={(q) => searchStocks(q, apiKey)}
      keyOf={(m) => m.symbol}
      render={(m) => <><strong>{m.symbol}</strong> {m.name} <span className="muted">· {m.region} · {m.currency}</span></>}
      onPick={onPick}
    >{children}</SearchBox>
  );
}

function CryptoPicker({ apiKey, onPick, children }: { apiKey: string; onPick: (m: CryptoMatch) => void; children: React.ReactNode }) {
  return (
    <SearchBox<CryptoMatch>
      placeholder="Coin suchen, z. B. Bitcoin"
      search={(q) => searchCrypto(q, apiKey)}
      keyOf={(m) => m.id}
      render={(m) => <><strong>{m.symbol}</strong> {m.name} <span className="muted">· {m.id}</span></>}
      onPick={onPick}
    >{children}</SearchBox>
  );
}

// ---------------- Existing holding ----------------

function HoldingCard({ holding: h, state, update, focused, depots }: { holding: Holding; state: PortfolioState; update: Update; focused?: boolean; depots: string[] }) {
  const [open, setOpen] = useState(!!focused);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) {
      setOpen(true);
      ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [focused]);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const v = valueHolding(h, state);
  const isMetal = h.assetClass === 'metal';

  const setHolding = (fn: (h: Holding) => Holding) =>
    update((s) => ({ ...s, holdings: s.holdings.map((x) => (x.id === h.id ? fn(x) : x)) }));

  function addPurchase(e: React.FormEvent) {
    e.preventDefault();
    const p = toPurchase(draft, isMetal);
    if (typeof p === 'string') return setError(p);
    const next = sortTransactions([...h.purchases, p]);
    if (p.kind === 'sell' && applyFifo(next).oversoldBy) {
      return setError(`Der Verkauf ist größer als der Bestand am ${new Date(p.date).toLocaleDateString('de-DE')}.`);
    }
    setError('');
    setHolding((x) => ({ ...x, purchases: next }));
    setDraft({ ...emptyDraft(), kind: draft.kind });
  }

  function saveManualPrice() {
    const n = parseNum(manual);
    const key = quoteKey(h);
    if (!(n > 0) || !key) return setError('Bitte einen Kurs größer 0 eingeben.');
    setError('');
    update((s) => ({ ...s, quotes: { ...s.quotes, [key]: { eurPrice: n, price: n, currency: 'EUR', source: 'manual', updatedAt: new Date().toISOString() } } }));
    setManual('');
  }

  return (
    <section ref={ref} className={`card holding ${open ? 'open' : ''}`} style={{ '--c': CATEGORY_COLOR[categoryOf(h)] } as React.CSSProperties}>
      <div className="holding-head">
        <CategoryIcon category={categoryOf(h)} />
        <button className="link holding-title" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? '▾' : '▸'} {h.name}
        </button>
        <div className="muted small">
          {CATEGORY_LABEL[categoryOf(h)]}
          {h.account && ` · ${h.account}`}
          {h.metal && ` · ${fmtNum(h.fineness ?? 1000, 1)}‰`}
          {h.symbol && ` · ${h.symbol} (${h.currency})`}
          {h.isin && ` · ${h.isin}`}
          {h.coinId && ` · ${h.coinId}`}
        </div>
        <div className="holding-summary">
          {v.closed ? 'vollständig verkauft' : (
            <>
              {isMetal
                ? (h.fineness ?? 1000) >= 1000 ? `${fmtNum(v.quantity, 4)} g` : `${fmtNum(v.quantity, 4)} g (fein ${fmtNum(v.fineGrams ?? 0, 4)} g)`
                : `${fmtNum(v.quantity, 8)} Stück`}
              {' · '}{v.value !== undefined ? fmtEur(v.value) : 'kein Kurs'}
            </>
          )}
          {Math.abs(v.realized) > 0.005 && (
            <span className={v.realized > 0 ? 'pos' : 'neg'}> · realisiert {fmtSignedEur(v.realized)}</span>
          )}
        </div>
      </div>

      {open && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Datum</th><th>Art</th><th className="num">{isMetal ? 'Gewicht' : 'Menge'}</th>
                  <th className="num">{isMetal ? 'Preis €/g' : 'Kurs'}</th><th className="num">Gebühr</th><th className="num">Betrag</th><th />
                </tr>
              </thead>
              <tbody>
                {h.purchases.map((p) => (
                  <tr key={p.id} className={p.id === v.oversoldBy ? 'row-error' : ''}>
                    <td>{new Date(p.date).toLocaleDateString('de-DE')}</td>
                    <td>
                      {p.kind === 'sell' ? 'Verkauf' : 'Kauf'}
                      {p.note && <span className="tag trade-note">{p.note}</span>}
                    </td>
                    <td className="num">{fmtNum(p.quantity, isMetal ? 4 : 8)}{isMetal && ' g'}</td>
                    <td className="num">{fmtEur(p.price ?? p.totalCost / p.quantity)}</td>
                    <td className="num">{p.fee ? fmtEur(p.fee) : <span className="muted">–</span>}</td>
                    <td className="num strong">{fmtEur(p.totalCost)}</td>
                    <td className="num">
                      <button className="link danger" onClick={() => {
                        if (confirm(`${p.kind === 'sell' ? 'Verkauf' : 'Kauf'} löschen?`)) setHolding((x) => ({ ...x, purchases: x.purchases.filter((y) => y.id !== p.id) }));
                      }}>Löschen</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {v.oversoldBy && (
            <div className="field-error">Ein Verkauf (rot markiert) übersteigt den Bestand zu seinem Datum. Bitte Datum oder Menge prüfen.</div>
          )}

          <form onSubmit={addPurchase}>
            <h3>Kauf oder Verkauf erfassen</h3>
            <div className="segmented" role="radiogroup" aria-label="Art">
              {(['buy', 'sell'] as const).map((k) => (
                <button type="button" key={k} role="radio" aria-checked={draft.kind === k} className={draft.kind === k ? 'active' : ''}
                  onClick={() => setDraft({ ...draft, kind: k })} disabled={k === 'sell' && v.closed}>
                  {k === 'buy' ? 'Kauf' : 'Verkauf'}
                </button>
              ))}
            </div>
            <PurchaseFields draft={draft} set={setDraft} isMetal={isMetal} />
            <button type="submit">{draft.kind === 'sell' ? 'Verkauf erfassen' : 'Kauf erfassen'}</button>
          </form>

          <DepotField holding={h} depots={depots} update={update} />

          {h.assetClass === 'stock' && (
            <label className="field type-field">
              <span>Art</span>
              <select value={categoryOf(h)} onChange={(e) => setHolding((x) => ({ ...x, securityType: e.target.value as 'stock' | 'etf' }))}>
                <option value="stock">Aktie</option>
                <option value="etf">ETF / Fonds</option>
              </select>
            </label>
          )}

          {h.assetClass === 'stock' && (
            <SymbolEditor holding={h} apiKey={state.settings.alphaVantageKey} onSave={(symbol, currency) =>
              update((s) => {
                const next: Holding = { ...h, symbol, currency };
                const [oldKey, newKey] = [quoteKey(h), quoteKey(next)];
                // Keep the last known price under the new key until a live quote arrives.
                const carry = oldKey && newKey && oldKey !== newKey && s.quotes[oldKey] && !s.quotes[newKey];
                return {
                  ...s,
                  holdings: s.holdings.map((x) => (x.id === h.id ? { ...x, symbol, currency } : x)),
                  quotes: carry ? { ...s.quotes, [newKey]: { ...s.quotes[oldKey], source: 'manual' as const } } : s.quotes,
                };
              })
            } />
          )}

          {!isMetal && (
            <div>
              <h3>Kurs manuell setzen</h3>
              <p className="muted small">Falls die API keinen Kurs liefert. Wird beim nächsten erfolgreichen Abruf überschrieben.</p>
              <div className="inline">
                <input inputMode="decimal" placeholder="Kurs in € pro Stück" value={manual} onChange={(e) => setManual(e.target.value)} />
                <button type="button" onClick={saveManualPrice}>Setzen</button>
              </div>
            </div>
          )}
          {error && <div className="field-error">{error}</div>}

          <div className="inline end">
            <button className="danger" onClick={() => {
              if (confirm(`Position „${h.name}“ mit allen Käufen löschen?`)) update((s) => ({ ...s, holdings: s.holdings.filter((x) => x.id !== h.id) }));
            }}>Position löschen</button>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Links a security (often known only by ISIN after an import) to a ticker symbol, so it gets live prices.
 * The search goes to Alpha Vantage by name; the best match for the ISIN's market is suggested first.
 */
function SymbolEditor({ holding: h, apiKey, onSave }: { holding: Holding; apiKey: string; onSave: (symbol: string | undefined, currency: Currency) => void }) {
  const [symbol, setSymbol] = useState(h.symbol ?? '');
  const [currency, setCurrency] = useState<Currency>(h.currency ?? 'EUR');
  const [query, setQuery] = useState(searchTerm(h.name));
  const [results, setResults] = useState<StockMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = symbol.trim().toUpperCase() !== (h.symbol ?? '') || currency !== (h.currency ?? 'EUR');

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    setResults(null);
    try {
      const ranked = rankSymbolMatches(await searchStocks(query.trim(), apiKey), h.isin);
      setResults(ranked);
      if (ranked.length === 0) setError('Nichts Passendes gefunden. Versuch einen kürzeren Namen oder trag das Symbol selbst ein.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function pick(m: StockMatch) {
    const c: Currency = isCurrency(m.currency) ? m.currency : 'EUR';
    setSymbol(m.symbol);
    setCurrency(c);
    setResults(null);
    onSave(m.symbol.toUpperCase(), c);
  }

  return (
    <div>
      <h3>Symbol für Live-Kurse</h3>
      {!h.symbol && (
        <p className="muted small">
          Diese Position hat noch kein Börsensymbol. Bis dahin gilt der Kurs des letzten Kaufs. Such das Symbol über den Namen
          (kostet eine der 25 täglichen Alpha-Vantage-Abfragen) oder trag es selbst ein, z. B. NVDA oder SAP.DEX.
        </p>
      )}
      <div className="inline">
        <input placeholder="Name, z. B. NVIDIA" aria-label="Suchbegriff" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
        <button type="button" onClick={search} disabled={busy || !apiKey || !query.trim()}
          title={apiKey ? '' : 'Erst in den Einstellungen einen Alpha-Vantage-Key eintragen'}>
          {busy ? 'Sucht …' : 'Symbol suchen'}
        </button>
      </div>
      {!apiKey && <p className="muted small">Für die Suche brauchst du einen kostenlosen Alpha-Vantage-Key (Einstellungen).</p>}
      {error && <div className="field-error">{error}</div>}
      {results && results.length > 0 && (
        <ul className="results">
          {results.slice(0, 8).map((m, i) => (
            <li key={m.symbol}>
              <button type="button" className="result" onClick={() => pick(m)}>
                <strong>{m.symbol}</strong> {m.name} <span className="muted">· {m.region} · {m.currency}</span>
                {i === 0 && <span className="tag new">empfohlen</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="inline symbol-row">
        <input placeholder="Symbol, z. B. NVDA" aria-label="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
        <select value={currency} aria-label="Handelswährung" onChange={(e) => setCurrency(e.target.value as Currency)}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="button" disabled={!changed} onClick={() => onSave(symbol.trim().toUpperCase() || undefined, currency)}>Speichern</button>
      </div>
      {h.isin && <p className="muted small">ISIN {h.isin}</p>}
    </div>
  );
}

/** A bank account: just a balance that can be corrected by hand. */
function CashCard({ holding: h, update, focused, depots }: { holding: Holding; update: Update; focused?: boolean; depots: string[] }) {
  const [open, setOpen] = useState(!!focused);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) {
      setOpen(true);
      ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [focused]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNum(input);
    if (!Number.isFinite(n)) return setError('Bitte einen Betrag eingeben, z. B. 3.412,77.');
    setError('');
    update((s) => ({
      ...s,
      holdings: s.holdings.map((x) => {
        if (x.id !== h.id) return x;
        // Keep the running import totals in line with the corrected balance, so the next import continues from it.
        const pending = x.broker?.withPending ? pendingList(x.broker).reduce((sum, p) => sum + p.amount, 0) : 0;
        const broker = x.broker ? { ...x.broker, cash: Math.round((n - pending) * 100) / 100 } : undefined;
        return { ...x, balance: n, balanceDate: today(), broker };
      }),
    }));
    setInput('');
  }

  return (
    <section ref={ref} className={`card holding ${open ? 'open' : ''}`} style={{ '--c': CATEGORY_COLOR.cash } as React.CSSProperties}>
      <div className="holding-head">
        <CategoryIcon category="cash" />
        <button className="link holding-title" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? '▾' : '▸'} {h.name}
        </button>
        <div className="muted small">
          {CLASS_LABEL.cash}
          {h.iban && ` · ${h.iban}`}
        </div>
        <div className="holding-summary">
          {fmtEur(h.balance ?? 0)}
          {h.balanceDate && <span className="muted small"> · Stand {new Date(h.balanceDate + 'T12:00:00').toLocaleDateString('de-DE')}</span>}
        </div>
      </div>
      {open && (
        <>
          <form onSubmit={save}>
            <h3>Kontostand ändern</h3>
            <div className="inline">
              <input inputMode="decimal" placeholder="Neuer Kontostand in €" aria-label="Neuer Kontostand" value={input} onChange={(e) => setInput(e.target.value)} />
              <button type="submit">Speichern</button>
            </div>
            {error && <div className="field-error">{error}</div>}
            <p className="muted small">Oder über „Datei importieren“ aus einem Kontoexport deiner Bank übernehmen.</p>
          </form>
          <DepotField holding={h} depots={depots} update={update} />
          <div className="inline end">
            <button className="danger" onClick={() => {
              if (confirm(`Konto „${h.name}“ löschen?`)) update((s) => ({ ...s, holdings: s.holdings.filter((x) => x.id !== h.id) }));
            }}>Konto löschen</button>
          </div>
        </>
      )}
    </section>
  );
}
