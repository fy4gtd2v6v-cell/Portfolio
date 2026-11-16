import { useMemo, useState } from 'react';
import { HistoryChart } from './HistoryChart';
import { ClassIcon, CLASS_COLOR, Icon, useCountUp } from './ui';
import { HoldingValuation, summarize, valueHolding } from '../lib/portfolio';
import { fmtDate, fmtEur, fmtNum, fmtPct, fmtSignedEur } from '../lib/format';
import { AssetClass, CLASS_LABEL, Holding, METAL_LABEL, PortfolioState } from '../lib/types';
import { fromGrams } from '../lib/units';

type SortKey = 'name' | 'value' | 'cost' | 'gain';
const share = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

interface Props {
  state: PortfolioState;
  onGoto: (t: 'holdings' | 'metals') => void;
  onAdd: () => void;
  onOpenHolding: (id: string) => void;
}

export function Overview({ state, onGoto, onAdd, onOpenHolding }: Props) {
  const s = summarize(state);
  const [filter, setFilter] = useState<AssetClass | null>(null);
  const [hover, setHover] = useState<AssetClass | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'value', dir: -1 });
  const total = useCountUp(s.totalValue);

  const valued = useMemo(
    () => state.holdings.map((h) => ({ h, v: valueHolding(h, state) })),
    [state],
  );

  if (state.holdings.length === 0) {
    return (
      <section className="card empty">
        <div className="empty-icons" aria-hidden="true">
          <ClassIcon assetClass="metal" large /><ClassIcon assetClass="stock" large /><ClassIcon assetClass="crypto" large />
        </div>
        <h2>Noch keine Positionen</h2>
        <p>Lege deine erste Position an – z. B. einen Goldbarren in Gramm, eine Aktie oder Bitcoin.</p>
        <button className="primary with-icon" onClick={onAdd}><Icon.plus />Position hinzufügen</button>
      </section>
    );
  }

  const gainClass = s.gain > 0 ? 'pos' : s.gain < 0 ? 'neg' : '';
  const open = valued.filter((x) => !x.v.closed);
  const closed = valued.filter((x) => x.v.closed);
  const activeFilter = filter && s.byClass.some((c) => c.assetClass === filter) ? filter : null;
  const emphasis = hover ?? activeFilter;

  const gramsByMetal = new Map<string, number>();
  for (const { h, v } of open) {
    if (h.assetClass === 'metal') gramsByMetal.set(h.metal!, (gramsByMetal.get(h.metal!) ?? 0) + (v.fineGrams ?? 0));
  }

  const sortValue = (x: { h: Holding; v: HoldingValuation }): number | string =>
    sort.key === 'name' ? x.h.name.toLocaleLowerCase('de') : sort.key === 'value' ? x.v.value ?? -Infinity : sort.key === 'cost' ? x.v.cost : x.v.gain ?? -Infinity;
  const rows = open
    .filter((x) => !activeFilter || x.h.assetClass === activeFilter)
    .sort((a, b) => {
      const [x, y] = [sortValue(a), sortValue(b)];
      return (typeof x === 'string' ? x.localeCompare(y as string, 'de') : x - (y as number)) * sort.dir;
    });

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
      <section className="hero stats">
        <div className="hero-main">
          <div className="hero-label">Gesamtwert</div>
          <div className="hero-value" aria-label={fmtEur(s.totalValue)}>{fmtEur(total)}</div>
          <div className={`chip ${gainClass}`} title="Gewinn / Verlust der offenen Positionen">
            <span aria-hidden="true">{s.gain > 0 ? '▲' : s.gain < 0 ? '▼' : '•'}</span>
            {fmtSignedEur(s.gain)}
            {s.gainPct !== undefined && <span> · {fmtPct(s.gainPct)}</span>}
          </div>
        </div>
        <div className="hero-side">
          <div>
            <div className="hero-label">Investiert</div>
            <div className="hero-num">{fmtEur(s.totalCost)}</div>
          </div>
          <div>
            <div className="hero-label">Realisiert</div>
            <div className={`hero-num ${s.realized > 0.005 ? 'pos' : s.realized < -0.005 ? 'neg' : ''}`}>
              {Math.abs(s.realized) > 0.005 ? fmtSignedEur(s.realized) : fmtEur(0)}
            </div>
          </div>
        </div>
        {s.totalValue > 0 && (
          <div className="hero-split" role="img" aria-label={s.byClass.map((c) => `${CLASS_LABEL[c.assetClass]} ${share.format(c.value / s.totalValue)}`).join(', ')}>
            {s.byClass.filter((c) => c.value > 0).map((c) => (
              <span key={c.assetClass} className={emphasis && emphasis !== c.assetClass ? 'dim' : ''}
                style={{ flexGrow: c.value, background: CLASS_COLOR[c.assetClass] }} />
            ))}
          </div>
        )}
      </section>

      {s.unpriced.length > 0 && (
        <div className="banner warn">
          Ohne aktuellen Kurs (nicht im Gesamtwert): {s.unpriced.map((h) => h.name).join(', ')}.{' '}
          {s.unpriced.some((h) => h.assetClass === 'metal') && <button className="link" onClick={() => onGoto('metals')}>Edelmetallpreise öffnen</button>}
        </div>
      )}

      <section className="class-cards" aria-label="Aufteilung nach Anlageklasse">
        {s.byClass.map((c) => {
          const part = s.totalValue > 0 ? c.value / s.totalValue : 0;
          const gain = c.value - c.cost;
          const selected = activeFilter === c.assetClass;
          return (
            <button
              type="button"
              key={c.assetClass}
              className={`class-card ${selected ? 'active' : ''} ${emphasis && emphasis !== c.assetClass ? 'dim' : ''}`}
              style={{ '--c': CLASS_COLOR[c.assetClass] } as React.CSSProperties}
              aria-pressed={selected}
              title={selected ? 'Filter aufheben' : `Nur ${CLASS_LABEL[c.assetClass]} anzeigen`}
              onClick={() => setFilter(selected ? null : c.assetClass)}
              onMouseEnter={() => setHover(c.assetClass)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="class-card-head">
                <ClassIcon assetClass={c.assetClass} large />
                <span>
                  <span className="class-card-name">{CLASS_LABEL[c.assetClass]}</span>
                  <span className="muted small">{c.count} Position{c.count === 1 ? '' : 'en'}</span>
                </span>
                <span className="class-card-share">{share.format(part)}</span>
              </span>
              <span className="class-card-value">{fmtEur(c.value)}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${part * 100}%`, background: CLASS_COLOR[c.assetClass] }} /></span>
              <span className={`small ${gain > 0 ? 'pos' : gain < 0 ? 'neg' : 'muted'}`}>
                {fmtSignedEur(gain)}{c.cost > 0 && ` · ${fmtPct(gain / c.cost)}`}
              </span>
            </button>
          );
        })}
      </section>
      {gramsByMetal.size > 0 && (
        <p className="muted small fine-weight">
          Feingewicht gesamt:{' '}
          {[...gramsByMetal].map(([m, g]) => `${METAL_LABEL[m as keyof typeof METAL_LABEL]} ${fmtNum(g, 2)} g (${fmtNum(fromGrams(g, 'oz'), 3)} oz)`).join(' · ')}
        </p>
      )}

      <section className="card">
        <h2>Wertverlauf</h2>
        <HistoryChart history={state.history} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{activeFilter ? CLASS_LABEL[activeFilter] : 'Alle Positionen'}</h2>
          {activeFilter && <button type="button" className="filter-chip active" onClick={() => setFilter(null)}>Filter aufheben ✕</button>}
        </div>
        <div className="table-wrap">
          <table className="positions">
            <thead>
              <tr>
                {sortHead('name', 'Position')}
                <th className="num">Bestand</th>
                <th className="num">Kurs</th>
                {sortHead('value', 'Wert', true)}
                {sortHead('cost', 'Investiert', true)}
                {sortHead('gain', 'G/V', true)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ h, v }) => {
                const cls = v.gain === undefined ? '' : v.gain > 0 ? 'pos' : v.gain < 0 ? 'neg' : '';
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
                      <div className="pos-name"><ClassIcon assetClass={h.assetClass} />
                        <div>
                          {h.name}
                          <div className="muted small pos-sub">
                            {CLASS_LABEL[h.assetClass]}
                            {h.symbol && ` · ${h.symbol}`}
                            {h.metal && ` · ${METAL_LABEL[h.metal]} ${fmtNum(h.fineness ?? 1000, 1)}‰`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="num">
                      {h.assetClass === 'metal' ? (
                        <>
                          {fmtNum(v.quantity, 2)} g
                          <div className="muted small">fein {fmtNum(v.fineGrams ?? 0, 2)} g</div>
                        </>
                      ) : (
                        fmtNum(v.quantity, 8)
                      )}
                    </td>
                    <td className="num">
                      {v.unitPrice !== undefined ? (
                        <>
                          {fmtEur(v.unitPrice)}{h.assetClass === 'metal' && '/g'}
                          <div className="muted small">{v.priceSource === 'manual' ? 'manuell, ' : ''}{fmtDate(v.priceUpdatedAt)}</div>
                        </>
                      ) : '–'}
                    </td>
                    <td className="num strong">{v.value !== undefined ? fmtEur(v.value) : '–'}</td>
                    <td className="num">{fmtEur(v.cost)}</td>
                    <td className="num">
                      {v.gain !== undefined ? <span className={`pill ${cls}`}>{fmtSignedEur(v.gain)}</span> : '–'}
                      {v.gainPct !== undefined && <div className={`small ${cls}`}>{fmtPct(v.gainPct)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {closed.length > 0 && (
          <p className="muted small">
            Vollständig verkauft: {closed.map(({ h, v }) => `${h.name} (${fmtSignedEur(v.realized)})`).join(' · ')}
          </p>
        )}
      </section>
    </>
  );
}
