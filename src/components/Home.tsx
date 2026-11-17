import { useMemo, useState } from 'react';
import { Donut, Slice } from './Donut';
import { Hero } from './Hero';
import { HistoryChart } from './HistoryChart';
import { ClassIcon, CLASS_COLOR, Icon } from './ui';
import { summarize, valueHolding } from '../lib/portfolio';
import { ASSET_CLASSES, AssetClass, CLASS_LABEL, PortfolioState } from '../lib/types';

/** How many single positions the pie shows before the rest is folded into "Sonstige". */
const MAX_POSITION_SLICES = 7;
/** Lighter steps of a class colour, so neighbouring positions of one class stay distinguishable. */
const TINTS = [0, 28, 50];
const OTHER = '__other__';

interface Props {
  state: PortfolioState;
  onGoto: (t: 'metals') => void;
  onAdd: () => void;
  onOpenClass: (c: AssetClass) => void;
  onOpenHolding: (id: string) => void;
}

/** Start page: total wealth, its split as a pie chart, and its development over time. */
export function Home({ state, onGoto, onAdd, onOpenClass, onOpenHolding }: Props) {
  const s = summarize(state);
  const [mode, setMode] = useState<'class' | 'position'>('class');

  const positionSlices = useMemo<Slice[]>(() => {
    const order = ASSET_CLASSES;
    const valued = state.holdings
      .map((h) => ({ h, value: valueHolding(h, state).value ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = valued.slice(0, MAX_POSITION_SLICES);
    const rest = valued.slice(MAX_POSITION_SLICES);
    // Group by class so the pie reads as "classes, split further", largest first within a class.
    const slices: Slice[] = [];
    for (const c of order) {
      top.filter((x) => x.h.assetClass === c).forEach((x, i) => {
        const tint = TINTS[i % TINTS.length];
        slices.push({
          id: x.h.id,
          label: x.h.name,
          hint: CLASS_LABEL[c],
          value: x.value,
          color: tint ? `color-mix(in srgb, ${CLASS_COLOR[c]} ${100 - tint}%, var(--surface))` : CLASS_COLOR[c],
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
          <ClassIcon assetClass="metal" large /><ClassIcon assetClass="stock" large /><ClassIcon assetClass="crypto" large />
        </div>
        <h2>Willkommen bei deinem Portfolio</h2>
        <p>Lege deine erste Position an – z. B. einen Goldbarren in Gramm, eine Aktie oder Bitcoin. Hier siehst du dann dein Gesamtvermögen.</p>
        <button className="primary with-icon" onClick={onAdd}><Icon.plus />Position hinzufügen</button>
      </section>
    );
  }

  const classSlices: Slice[] = s.byClass
    .filter((c) => c.value > 0)
    .map((c) => ({
      id: c.assetClass,
      label: CLASS_LABEL[c.assetClass],
      hint: `${c.count} Position${c.count === 1 ? '' : 'en'}`,
      value: c.value,
      color: CLASS_COLOR[c.assetClass],
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
              <button type="button" role="radio" aria-checked={mode === 'class'} className={mode === 'class' ? 'active' : ''} onClick={() => setMode('class')}>Anlageklassen</button>
              <button type="button" role="radio" aria-checked={mode === 'position'} className={mode === 'position' ? 'active' : ''} onClick={() => setMode('position')}>Positionen</button>
            </div>
          </div>
          {mode === 'class' ? (
            <Donut slices={classSlices} totalLabel="Gesamt" onSelect={(id) => onOpenClass(id as AssetClass)} />
          ) : (
            <Donut slices={positionSlices} totalLabel="Gesamt" onSelect={(id) => id !== OTHER && onOpenHolding(id)} />
          )}
          <p className="muted small donut-note">
            {mode === 'class' ? 'Klick auf ein Segment zeigt die Positionen dieser Anlageklasse.' : 'Klick auf ein Segment öffnet die Position.'}
          </p>
        </section>

        <section className="card">
          <div className="card-head"><h2>Vermögensverlauf</h2></div>
          <HistoryChart history={state.history} />
        </section>
      </div>
    </>
  );
}
