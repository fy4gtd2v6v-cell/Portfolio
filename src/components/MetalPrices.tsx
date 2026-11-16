import { useState } from 'react';
import type { Update } from '../App';
import { fmtDate, fmtEur, parseNum } from '../lib/format';
import { carryPrevDay, fetchMetalPricesEur } from '../lib/prices';
import { Metal, METAL_LABEL, METALS, PortfolioState } from '../lib/types';
import { pricePerGram, pricePerUnit, WeightUnit } from '../lib/units';

export function MetalPrices({ state, update }: { state: PortfolioState; update: Update }) {
  const live = state.settings.metalMode !== 'manual';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const setMode = (metalMode: 'live' | 'manual') => {
    setMsg(null);
    update((s) => ({ ...s, settings: { ...s.settings, metalMode } }));
  };

  async function fetchLive() {
    setBusy(true);
    setMsg(null);
    try {
      const prices = await fetchMetalPricesEur(METALS);
      update((s) => ({
        ...s,
        metalPrices: { ...s.metalPrices, ...Object.fromEntries(METALS.filter((m) => prices[m]).map((m) => [m, carryPrevDay(s.metalPrices[m], prices[m]!)])) },
      }));
      const missing = METALS.filter((m) => !prices[m]).map((m) => METAL_LABEL[m]);
      setMsg(missing.length
        ? { ok: false, text: `Kein Live-Preis für: ${missing.join(', ')}.` }
        : { ok: true, text: 'Live-Preise aktualisiert.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Edelmetallpreise</h2>
      <div className="segmented" role="radiogroup" aria-label="Preisquelle">
        <button type="button" role="radio" aria-checked={live} className={live ? 'active' : ''} onClick={() => setMode('live')}>Live-Spotpreis</button>
        <button type="button" role="radio" aria-checked={!live} className={!live ? 'active' : ''} onClick={() => setMode('manual')}>Manuell</button>
      </div>
      {live ? (
        <>
          <p className="muted">
            Der Börsenpreis (Spot) wird zusammen mit den anderen Kursen abgerufen und in Euro pro Gramm umgerechnet.
            Händler zahlen beim Ankauf meist etwas weniger und verlangen beim Verkauf mehr – für deinen Händlerpreis
            wechsle auf „Manuell“.
          </p>
          <div className="inline">
            <button type="button" onClick={fetchLive} disabled={busy}>{busy ? 'Lädt …' : 'Live-Preise jetzt abrufen'}</button>
          </div>
        </>
      ) : (
        <p className="muted">
          Trag den aktuellen Preis selbst ein, z. B. den Ankaufspreis deines Händlers – pro Gramm, Kilogramm oder Feinunze.
          „Kurse aktualisieren“ lässt diese Preise unverändert.
        </p>
      )}
      {msg && <p className={msg.ok ? 'small pos' : 'field-error'} role="status">{msg.text}</p>}
      <div className="metal-grid">
        {METALS.map((m) => (
          <MetalRow key={m} metal={m} state={state} update={update} editable={!live} />
        ))}
      </div>
    </section>
  );
}

function MetalRow({ metal, state, update, editable }: { metal: Metal; state: PortfolioState; update: Update; editable: boolean }) {
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
      metalPrices: { ...s.metalPrices, [metal]: carryPrevDay(s.metalPrices[metal], { eurPerGram: pricePerGram(n, unit), updatedAt: new Date().toISOString(), source: 'manual' }) },
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
            <div className="muted">{current.source === 'api' ? 'Live-Spotpreis' : 'Manuell'}, Stand {fmtDate(current.updatedAt)}</div>
          </div>
        ) : (
          <div className="small muted">noch kein Preis</div>
        )}
      </div>
      {editable && (
        <div className="inline">
          <input inputMode="decimal" placeholder="Preis in €" value={input} onChange={(e) => setInput(e.target.value)} aria-label={`${METAL_LABEL[metal]} Preis`} />
          <select value={unit} onChange={(e) => setUnit(e.target.value as WeightUnit)} aria-label="Einheit">
            <option value="g">€ / g</option>
            <option value="oz">€ / oz</option>
            <option value="kg">€ / kg</option>
          </select>
          <button type="submit">Speichern</button>
        </div>
      )}
      {error && <div className="field-error">{error}</div>}
    </form>
  );
}
