import { useRef, useState } from 'react';
import type { Update } from '../App';
import { exportState, parseState } from '../lib/storage';
import { emptyState, PortfolioState } from '../lib/types';

export function SettingsView({ state, update, replace }: { state: PortfolioState; update: Update; replace: (s: PortfolioState) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  function setKey(k: 'alphaVantageKey' | 'coingeckoKey', v: string) {
    update((s) => ({ ...s, settings: { ...s.settings, [k]: v.trim() } }));
  }

  function doExport() {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `portfolio-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doImport(file: File) {
    try {
      const imported = parseState(await file.text());
      // keep the API keys of this browser, the export never contains them
      replace({ ...imported, settings: state.settings });
      setMsg(`Import erfolgreich: ${imported.holdings.length} Positionen.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <>
      <section className="card">
        <h2>API-Keys</h2>
        <p className="muted">Die Keys werden nur in diesem Browser gespeichert und sind nicht im Export enthalten.</p>
        <label className="field">
          <span>Alpha Vantage (Aktien & ETFs) – kostenlos unter alphavantage.co, 25 Abfragen/Tag</span>
          <input type="password" autoComplete="off" value={state.settings.alphaVantageKey} onChange={(e) => setKey('alphaVantageKey', e.target.value)} />
        </label>
        <label className="field">
          <span>CoinGecko Demo-Key (Krypto) – optional, funktioniert auch ohne</span>
          <input type="password" autoComplete="off" value={state.settings.coingeckoKey} onChange={(e) => setKey('coingeckoKey', e.target.value)} />
        </label>
      </section>

      <section className="card">
        <h2>Daten sichern</h2>
        <p className="muted">Alle Daten liegen nur in diesem Browser. Exportiere regelmäßig eine Sicherung oder um sie auf ein anderes Gerät zu übertragen.</p>
        <div className="inline">
          <button onClick={doExport}>Exportieren (JSON)</button>
          <button onClick={() => fileRef.current?.click()}>Importieren …</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && confirm('Import ersetzt alle aktuellen Daten. Fortfahren?')) doImport(f);
            e.target.value = '';
          }} />
          <button className="danger" onClick={() => {
            if (confirm('Wirklich alle Positionen und Preise löschen?')) replace({ ...emptyState(), settings: state.settings });
          }}>Alles löschen</button>
        </div>
        {msg && <p className="small">{msg}</p>}
      </section>
    </>
  );
}
