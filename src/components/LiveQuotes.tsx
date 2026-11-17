import { useEffect, useMemo, useRef, useState } from 'react';
import type { Update } from '../App';
import { CategoryIcon, CATEGORY_COLOR, Icon } from './ui';
import { HoldingValuation, valueHolding } from '../lib/portfolio';
import { metalChangePct } from '../lib/prices';
import { fmtDate, fmtEur, fmtNum, fmtPct, fmtSignedEur } from '../lib/format';
import { CATEGORIES, Category, CATEGORY_LABEL, categoryOf, Holding, PortfolioState, quoteKey } from '../lib/types';

type SortKey = 'name' | 'price' | 'change' | 'value' | 'gain';
type Row = { h: Holding; v: HoldingValuation; changePct?: number; dayGain?: number };

export interface LiveStatus {
  /** when prices were last fetched in this session (ms) */
  lastAt?: number;
  error?: string;
  busy: boolean;
}

interface Props {
  state: PortfolioState;
  update: Update;
  live: LiveStatus;
  onAdd: () => void;
  onOpenHolding: (id: string) => void;
  /** class to filter by when the page opens, e.g. after a click on the pie chart */
  initialFilter?: Category | null;
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'gerade eben';
  if (s < 60) return `vor ${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `vor ${m} min` : `vor ${Math.floor(m / 60)} h`;
}

/** What the "Heute" column means differs per source; say so. */
function changeHint(h: Holding, state: PortfolioState): string {
  if (h.assetClass === 'crypto') return 'Veränderung der letzten 24 Stunden';
  if (h.assetClass === 'stock') return 'Veränderung seit dem letzten Börsenschluss';
  const prev = h.metal ? state.metalPrices[h.metal]?.prevDay : undefined;
  return prev ? `Veränderung seit dem letzten Abruf am ${new Date(prev.date + 'T12:00:00').toLocaleDateString('de-DE')}` : 'Veränderung erscheint ab dem zweiten Tag mit Abruf';
}

export function LiveQuotes({ state, update, live, onAdd, onOpenHolding, initialFilter = null }: Props) {
  const [filter, setFilter] = useState<Category | null>(initialFilter);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'value', dir: -1 });
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo<Row[]>(
    () =>
      state.holdings
        .map((h) => ({ h, v: valueHolding(h, state) }))
        .filter((x) => !x.v.closed && x.h.assetClass !== 'cash') // accounts have no price
        .map(({ h, v }) => {
          const key = quoteKey(h);
          const changePct = h.assetClass === 'metal' ? metalChangePct(h.metal ? state.metalPrices[h.metal] : undefined) : key ? state.quotes[key]?.changePct : undefined;
          // value now = value before * (1 + pct)  →  gain of the day = value * pct / (1 + pct)
          const dayGain = changePct !== undefined && v.value !== undefined && changePct > -1 ? (v.value * changePct) / (1 + changePct) : undefined;
          return { h, v, changePct, dayGain };
        }),
    [state],
  );

  // Briefly highlight prices that just moved.
  const lastPrices = useRef(new Map<string, number>());
  const [flash, setFlash] = useState<Record<string, 'up' | 'down'>>({});
  useEffect(() => {
    const next: Record<string, 'up' | 'down'> = {};
    for (const { h, v } of rows) {
      const before = lastPrices.current.get(h.id);
      if (v.unitPrice !== undefined) {
        if (before !== undefined && before !== v.unitPrice) next[h.id] = v.unitPrice > before ? 'up' : 'down';
        lastPrices.current.set(h.id, v.unitPrice);
      }
    }
    if (Object.keys(next).length === 0) return;
    setFlash(next);
    const id = window.setTimeout(() => setFlash({}), 1400);
    return () => window.clearTimeout(id);
  }, [rows]);

  if (rows.length === 0) {
    return (
      <section className="card empty">
        <div className="empty-icons" aria-hidden="true">
          <CategoryIcon category="gold" large /><CategoryIcon category="stock" large /><CategoryIcon category="crypto" large />
        </div>
        <h2>Noch keine Positionen</h2>
        <p>Sobald du Positionen angelegt hast, siehst du hier ihre aktuellen Kurse.</p>
        <button className="primary with-icon" onClick={onAdd}><Icon.plus />Position hinzufügen</button>
      </section>
    );
  }

  const classes = CATEGORIES.filter((c) => rows.some((r) => categoryOf(r.h) === c));
  const active = filter && classes.includes(filter) ? filter : null;
  const sortValue = (r: Row): number | string =>
    sort.key === 'name' ? r.h.name.toLocaleLowerCase('de')
      : sort.key === 'price' ? r.v.unitPrice ?? -Infinity
      : sort.key === 'change' ? r.changePct ?? -Infinity
      : sort.key === 'value' ? r.v.value ?? -Infinity
      : r.v.gain ?? -Infinity;
  const shown = rows
    .filter((r) => !active || categoryOf(r.h) === active)
    .sort((a, b) => {
      const [x, y] = [sortValue(a), sortValue(b)];
      return (typeof x === 'string' ? x.localeCompare(y as string, 'de') : x - (y as number)) * sort.dir;
    });

  const dayTotal = shown.reduce((s, r) => s + (r.dayGain ?? 0), 0);
  const dayBase = shown.reduce((s, r) => s + (r.dayGain !== undefined && r.v.value !== undefined ? r.v.value - r.dayGain : 0), 0);
  const dayKnown = shown.filter((r) => r.dayGain !== undefined).length;
  const hasStocks = rows.some((r) => r.h.assetClass === 'stock');
  const hasAuto = rows.some((r) => r.h.assetClass === 'crypto' || (r.h.assetClass === 'metal' && state.settings.metalMode !== 'manual'));
  const auto = state.settings.autoRefresh;

  const toggleSort = (key: SortKey) =>
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));
  const sortHead = (k: SortKey, label: string, num?: boolean) => (
    <th className={num ? 'num' : ''} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`sort ${sort.key === k ? 'active' : ''}`} onClick={() => toggleSort(k)} title="Sortieren">
        {label}<span aria-hidden="true">{sort.key === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ' ↕'}</span>
      </button>
    </th>
  );

  return (
    <>
      <section className="card live-head">
        <div className="live-status">
          <span className={`live-dot ${auto && hasAuto ? 'on' : ''} ${live.busy ? 'busy' : ''}`} aria-hidden="true" />
          <div>
            <h2>Livekurse</h2>
            <p className="muted small" role="status">
              {live.busy ? 'Kurse werden geladen …' : live.lastAt ? `Zuletzt aktualisiert ${ago(Date.now() - live.lastAt)}` : 'In dieser Sitzung noch nicht aktualisiert'}
              {auto && hasAuto && ' · automatisch jede Minute'}
            </p>
          </div>
        </div>
        <div className="live-day">
          <div className="muted small">Heute{active ? ` · ${CATEGORY_LABEL[active]}` : ''}</div>
          {dayKnown > 0 ? (
            <div className={`live-day-value ${dayTotal > 0 ? 'pos' : dayTotal < 0 ? 'neg' : ''}`}>
              {fmtSignedEur(dayTotal)}{dayBase > 0 && <span className="small"> · {fmtPct(dayTotal / dayBase)}</span>}
            </div>
          ) : (
            <div className="live-day-value muted">–</div>
          )}
        </div>
        <label className="switch">
          <input type="checkbox" checked={auto} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, autoRefresh: e.target.checked } }))} />
          <span>Automatisch aktualisieren</span>
        </label>
        {classes.length > 1 && (
          <div className="chips" role="radiogroup" aria-label="Nach Anlageklasse filtern">
            <button type="button" role="radio" aria-checked={!active} className={`filter-chip ${!active ? 'active' : ''}`} onClick={() => setFilter(null)}>
              Alle <span className="count">{rows.length}</span>
            </button>
            {classes.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={active === c} className={`filter-chip ${active === c ? 'active' : ''}`}
                style={{ '--c': CATEGORY_COLOR[c] } as React.CSSProperties} onClick={() => setFilter(c)}>
                <span className="swatch" style={{ background: CATEGORY_COLOR[c] }} />
                {CATEGORY_LABEL[c]} <span className="count">{rows.filter((r) => categoryOf(r.h) === c).length}</span>
              </button>
            ))}
          </div>
        )}
        {live.error && <p className="field-error live-note">Letzter Abruf: {live.error}</p>}
        {hasStocks && (
          <p className="muted small live-note">
            Krypto und Edelmetalle werden automatisch aktualisiert. Aktien nur über „Kurse aktualisieren“ – der kostenlose
            Aktien-Dienst erlaubt 25 Abfragen pro Tag.
          </p>
        )}
      </section>

      <section className="card">
        <div className="table-wrap">
          <table className="positions">
            <thead>
              <tr>
                {sortHead('name', 'Position')}
                {sortHead('price', 'Kurs', true)}
                {sortHead('change', 'Heute', true)}
                <th className="num">Bestand</th>
                {sortHead('value', 'Wert', true)}
                {sortHead('gain', 'G/V gesamt', true)}
              </tr>
            </thead>
            <tbody>
              {shown.map(({ h, v, changePct, dayGain }) => {
                const gainCls = v.gain === undefined ? '' : v.gain > 0 ? 'pos' : v.gain < 0 ? 'neg' : '';
                const dayCls = changePct === undefined ? '' : changePct > 0 ? 'pos' : changePct < 0 ? 'neg' : '';
                return (
                  <tr
                    key={h.id}
                    className="clickable"
                    tabIndex={0}
                    title="Position öffnen"
                    onClick={() => onOpenHolding(h.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpenHolding(h.id))}
                  >
                    <td>
                      <div className="pos-name"><CategoryIcon category={categoryOf(h)} />
                        <div>
                          {h.name}
                          <div className="muted small pos-sub">
                            {CATEGORY_LABEL[categoryOf(h)]}
                            {h.account && ` · ${h.account}`}
                            {(h.symbol || h.isin) && ` · ${h.symbol ?? h.isin}`}
                            {h.metal && ` · ${fmtNum(h.fineness ?? 1000, 1)}‰`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="num">
                      {v.unitPrice !== undefined ? (
                        <>
                          <span className={`price ${flash[h.id] ? `flash-${flash[h.id]}` : ''}`}>{fmtEur(v.unitPrice)}{h.assetClass === 'metal' && '/g'}</span>
                          <div className="muted small">{v.priceSource === 'manual' ? 'manuell, ' : ''}{fmtDate(v.priceUpdatedAt)}</div>
                        </>
                      ) : <span className="muted">kein Kurs</span>}
                    </td>
                    <td className="num" title={changeHint(h, state)}>
                      {changePct !== undefined ? (
                        <>
                          <span className={`pill ${dayCls}`}>{changePct > 0 ? '▲' : changePct < 0 ? '▼' : ''} {fmtPct(changePct)}</span>
                          {dayGain !== undefined && <div className={`small ${dayCls}`}>{fmtSignedEur(dayGain)}</div>}
                        </>
                      ) : <span className="muted">–</span>}
                    </td>
                    <td className="num">
                      {h.assetClass === 'metal' ? (
                        <>
                          {fmtNum(v.quantity, 4)} g
                          {(h.fineness ?? 1000) < 1000 && <div className="muted small">fein {fmtNum(v.fineGrams ?? 0, 4)} g</div>}
                        </>
                      ) : (
                        fmtNum(v.quantity, 8)
                      )}
                    </td>
                    <td className="num strong">{v.value !== undefined ? fmtEur(v.value) : '–'}</td>
                    <td className="num">
                      {v.gain !== undefined ? <span className={gainCls}>{fmtSignedEur(v.gain)}</span> : '–'}
                      {v.gainPct !== undefined && <div className={`small ${gainCls}`}>{fmtPct(v.gainPct)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          „Heute“: bei Krypto die letzten 24 Stunden, bei Aktien seit dem letzten Börsenschluss, bei Edelmetallen seit dem letzten Abruf an einem früheren Tag.
        </p>
      </section>
    </>
  );
}
