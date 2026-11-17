import { useMemo, useState } from 'react';
import { Donut, Slice } from './Donut';
import { Hero } from './Hero';
import { HistoryChart } from './HistoryChart';
import { CategoryIcon, CATEGORY_COLOR, Icon } from './ui';
import { groupByDepot, summarize, valueHolding } from '../lib/portfolio';
import { fmtEur, fmtSignedEur } from '../lib/format';
import { CATEGORIES, Category, CATEGORY_LABEL, categoryOf, PortfolioState } from '../lib/types';

/** How many single positions the pie shows before the rest is folded into "Sonstige". */
const MAX_POSITION_SLICES = 7;
/** Lighter steps of a category colour, so neighbouring positions of one category stay distinguishable. */
const TINTS = [0, 28, 50];
const OTHER = '__other__';
const share = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

interface Props {
  state: PortfolioState;
  onGoto: (t: 'metals') => void;
  onAdd: () => void;
  onOpenCategory: (c: Category) => void;
  onOpenHolding: (id: string) => void;
  onOpenDepot: (depot: string) => void;
}

/** Start page: total wealth, its split as a pie chart, and its development over time. */
export function Home({ state, onGoto, onAdd, onOpenCategory, onOpenHolding, onOpenDepot }: Props) {
  const s = summarize(state);
  const depots = groupByDepot(state).filter((d) => d.count > 0);
  const [mode, setMode] = useState<'class' | 'position'>('class');

  const positionSlices = useMemo<Slice[]>(() => {
    const order = CATEGORIES;
    const valued = state.holdings
      .map((h) => ({ h, value: valueHolding(h, state).value ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = valued.slice(0, MAX_POSITION_SLICES);
    const rest = valued.slice(MAX_POSITION_SLICES);
    // Group by category so the pie reads as "categories, split further", largest first within a category.
    const slices: Slice[] = [];
    for (const c of order) {
      top.filter((x) => categoryOf(x.h) === c).forEach((x, i) => {
        const tint = TINTS[i % TINTS.length];
        slices.push({
          id: x.h.id,
          label: x.h.name,
          hint: CATEGORY_LABEL[c],
          value: x.value,
          color: tint ? `color-mix(in srgb, ${CATEGORY_COLOR[c]} ${100 - tint}%, var(--surface))` : CATEGORY_COLOR[c],
        });
      });
    }
    if (rest.length) {
      slices.push({ id: OTHER, label: 'Sonstige', hint: `${rest.length} weitere`, value: rest.reduce((sum, x) => sum + x.value, 0), color: 'var(--border-strong)' });
    }
    return slices;
  }, [state]);

  if (state.holdings.length === 0) {
    return (
      <section className="card empty">
        <div className="empty-icons" aria-hidden="true">
          <CategoryIcon category="gold" large /><CategoryIcon category="stock" large /><CategoryIcon category="crypto" large />
        </div>
        <h2>Willkommen bei deinem Portfolio</h2>
        <p>Lege deine erste Position an – z. B. einen Goldbarren in Gramm, eine Aktie oder Bitcoin. Hier siehst du dann dein Gesamtvermögen.</p>
        <button className="primary with-icon" onClick={onAdd}><Icon.plus />Position hinzufügen</button>
      </section>
    );
  }

  const classSlices: Slice[] = s.byCategory
    .filter((c) => c.value > 0)
    .map((c) => ({
      id: c.category,
      label: CATEGORY_LABEL[c.category],
      hint: `${c.count} Position${c.count === 1 ? '' : 'en'}`,
      value: c.value,
      color: CATEGORY_COLOR[c.category],
    }));

  return (
    <>
      <Hero summary={s} />

      {s.unpriced.length > 0 && (
        <div className="banner warn">
          Ohne aktuellen Kurs (nicht im Gesamtvermögen): {s.unpriced.map((h) => h.name).join(', ')}.{' '}
          {s.unpriced.some((h) => h.assetClass === 'metal') && <button className="link" onClick={() => onGoto('metals')}>Edelmetallpreise öffnen</button>}
        </div>
      )}

      <div className="home-grid">
        <section className="card">
          <div className="card-head">
            <h2>Stückelung</h2>
            <div className="segmented small-seg" role="radiogroup" aria-label="Stückelung nach">
              <button type="button" role="radio" aria-checked={mode === 'class'} className={mode === 'class' ? 'active' : ''} onClick={() => setMode('class')}>Kategorien</button>
              <button type="button" role="radio" aria-checked={mode === 'position'} className={mode === 'position' ? 'active' : ''} onClick={() => setMode('position')}>Positionen</button>
            </div>
          </div>
          {mode === 'class' ? (
            <Donut slices={classSlices} totalLabel="Gesamt" onSelect={(id) => onOpenCategory(id as Category)} />
          ) : (
            <Donut slices={positionSlices} totalLabel="Gesamt" onSelect={(id) => id !== OTHER && onOpenHolding(id)} />
          )}
          <p className="muted small donut-note">
            {mode === 'class' ? 'Klick auf ein Segment zeigt die Positionen dieser Kategorie.' : 'Klick auf ein Segment öffnet die Position.'}
          </p>
        </section>

        <div className="home-side">
          <section className="card">
            <div className="card-head"><h2>Vermögensverlauf</h2></div>
            <HistoryChart history={state.history} />
          </section>

          {depots.length > 1 && (
            <section className="card">
              <div className="card-head"><h2>Nach Depot</h2></div>
              <div className="depot-list">
                {depots.map((d) => {
                  const part = s.totalValue > 0 ? d.value / s.totalValue : 0;
                  return (
                    <button type="button" key={d.depot} className="depot-row" onClick={() => onOpenDepot(d.depot)} title={`Positionen im Depot ${d.depot} anzeigen`}>
                      <span>
                        <strong>{d.depot}</strong>
                        <span className="muted"> · {d.count} Position{d.count === 1 ? '' : 'en'}</span>
                      </span>
                      <span className="num">
                        <strong>{fmtEur(d.value)}</strong> <span className="muted">· {share.format(part)}</span>
                        {d.cost > 0 && <span className={`small ${d.gain > 0.005 ? 'pos' : d.gain < -0.005 ? 'neg' : 'muted'}`}> · {fmtSignedEur(d.gain)}</span>}
                      </span>
                      <span className="bar-track"><span className="bar-fill" style={{ width: `${part * 100}%` }} /></span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
