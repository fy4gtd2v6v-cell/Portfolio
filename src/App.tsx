import { useEffect, useState } from 'react';
import { Overview } from './components/Overview';
import { HoldingsView } from './components/Holdings';
import { MetalPrices } from './components/MetalPrices';
import { SettingsView } from './components/Settings';
import { today } from './lib/format';
import { withSnapshot } from './lib/portfolio';
import { refreshQuotes } from './lib/prices';
import { loadState, saveState } from './lib/storage';
import { PortfolioState } from './lib/types';

type Tab = 'overview' | 'holdings' | 'metals' | 'settings';
const TABS: [Tab, string][] = [
  ['overview', 'Übersicht'],
  ['holdings', 'Positionen'],
  ['metals', 'Edelmetallpreise'],
  ['settings', 'Einstellungen'],
];

export type Update = (fn: (s: PortfolioState) => PortfolioState) => void;

export default function App() {
  const [state, setState] = useState<PortfolioState>(loadState);
  const [tab, setTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; lines: string[] } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!saveState(state));
  }, [state]);

  // Record today's value for the history chart; returns the same object when nothing changed.
  useEffect(() => {
    setState((s) => withSnapshot(s, today()));
  }, [state]);

  const update: Update = (fn) => setState((s) => fn(s));

  async function refresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const r = await refreshQuotes(state);
      setState((s) => ({ ...s, quotes: { ...s.quotes, ...r.quotes } }));
      const lines = [`${r.updated} Kurs${r.updated === 1 ? '' : 'e'} aktualisiert.`, ...r.errors];
      setMessage({ kind: r.errors.length ? 'error' : 'ok', lines });
    } finally {
      setRefreshing(false);
    }
  }

  const hasLive = state.holdings.some((h) => h.assetClass !== 'metal');

  return (
    <div className="app">
      <header className="topbar">
        <h1>Portfolio</h1>
        <nav className="tabs" aria-label="Bereiche">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'tab active' : 'tab'} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="primary" onClick={refresh} disabled={refreshing || !hasLive} title={hasLive ? '' : 'Keine Aktien oder Kryptowerte vorhanden'}>
          {refreshing ? 'Lädt Kurse …' : 'Kurse aktualisieren'}
        </button>
      </header>

      {saveFailed && <div className="banner error">Speichern im Browser nicht möglich (privates Fenster?). Bitte regelmäßig exportieren.</div>}
      {message && (
        <div className={`banner ${message.kind}`} role="status">
          {message.lines.map((l, i) => <div key={i}>{l}</div>)}
          <button className="link" onClick={() => setMessage(null)}>Schließen</button>
        </div>
      )}

      <main>
        {tab === 'overview' && <Overview state={state} onGoto={setTab} />}
        {tab === 'holdings' && <HoldingsView state={state} update={update} />}
        {tab === 'metals' && <MetalPrices state={state} update={update} />}
        {tab === 'settings' && <SettingsView state={state} update={update} replace={setState} />}
      </main>
    </div>
  );
}
