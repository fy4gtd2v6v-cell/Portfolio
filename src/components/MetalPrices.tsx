import { useState } from 'react';
import type { Update } from '../App';
import { fmtDate, fmtEur, parseNum } from '../lib/format';
import { Metal, METAL_LABEL, METALS, PortfolioState } from '../lib/types';
import { pricePerGram, pricePerUnit, WeightUnit } from '../lib/units';

export function MetalPrices({ state, update }: { state: PortfolioState; update: Update }) {
  return (
    <section className="card">
      <h2>Edelmetallpreise (manuell)</h2>
      <p className="muted">
        Trag den aktuellen Preis ein, z. B. den Ankaufspreis deines Händlers. Bewertet wird pro Gramm Feingewicht.
        Du kannst den Preis pro Gramm, Kilogramm oder Feinunze eingeben.
      </p>
      <div className="metal-grid">
        {METALS.map((m) => (
          <MetalRow key={m} metal={m} state={state} update={update} />
        ))}
      </div>
    </section>
  );
}

function MetalRow({ metal, state, update }: { metal: Metal; state: PortfolioState; update: Update }) {
  const current = state.metalPrices[metal];
  const [unit, setUnit] = useState<WeightUnit>('g');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNum(input);
    if (!(n > 0)) {
      setError('Bitte einen Preis größer 0 eingeben.');
      return;
    }
    setError('');
    update((s) => ({
      ...s,
      metalPrices: { ...s.metalPrices, [metal]: { eurPerGram: pricePerGram(n, unit), updatedAt: new Date().toISOString() } },
    }));
    setInput('');
  }

  return (
    <form className="metal-row" onSubmit={save}>
      <div>
        <div className="metal-name">{METAL_LABEL[metal]}</div>
        {current ? (
          <div className="small">
            <strong>{fmtEur(current.eurPerGram)}/g</strong>
            <span className="muted"> · {fmtEur(pricePerUnit(current.eurPerGram, 'oz'))}/oz · {fmtEur(pricePerUnit(current.eurPerGram, 'kg'))}/kg</span>
            <div className="muted">Stand {fmtDate(current.updatedAt)}</div>
          </div>
        ) : (
          <div className="small muted">noch kein Preis</div>
        )}
      </div>
      <div className="inline">
        <input inputMode="decimal" placeholder="Preis in €" value={input} onChange={(e) => setInput(e.target.value)} aria-label={`${METAL_LABEL[metal]} Preis`} />
        <select value={unit} onChange={(e) => setUnit(e.target.value as WeightUnit)} aria-label="Einheit">
          <option value="g">€ / g</option>
          <option value="oz">€ / oz</option>
          <option value="kg">€ / kg</option>
        </select>
        <button type="submit">Speichern</button>
      </div>
      {error && <div className="field-error">{error}</div>}
    </form>
  );
}
