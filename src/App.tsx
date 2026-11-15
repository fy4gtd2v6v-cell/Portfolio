import { useCallback, useEffect, useRef, useState } from 'react';
import { Overview } from './components/Overview';
import { HoldingsView } from './components/Holdings';
import { LockScreen } from './components/LockScreen';
import { MetalPrices } from './components/MetalPrices';
import { SettingsView } from './components/Settings';
import { Envelope, Vault } from './lib/crypto';
import { today } from './lib/format';
import { withSnapshot } from './lib/portfolio';
import { refreshQuotes } from './lib/prices';
import { clearStored, readStored, saveState } from './lib/storage';
import { emptyState, PortfolioState } from './lib/types';

type Tab = 'overview' | 'holdings' | 'metals' | 'settings';
const TABS: [Tab, string][] = [
  ['overview', 'Übersicht'],
  ['holdings', 'Positionen'],
  ['metals', 'Edelmetallpreise'],
  ['settings', 'Einstellungen'],
];

/** Lock automatically after this much time without interaction. */
export const AUTO_LOCK_MS = 10 * 60 * 1000;

export type Update = (fn: (s: PortfolioState) => PortfolioState) => void;

type Session =
  | { status: 'locked'; envelope: Envelope }
  | { status: 'open'; id: number; state: PortfolioState; vault: Vault | null };

function initialSession(): Session {
  const stored = readStored();
  return stored.kind === 'encrypted'
    ? { status: 'locked', envelope: stored.envelope }
    : { status: 'open', id: 0, state: stored.state, vault: null };
}

export default function App() {
  const [session, setSession] = useState<Session>(initialSession);

  if (session.status === 'locked') {
    return (
      <LockScreen
        envelope={session.envelope}
        onUnlock={(state, vault) => setSession({ status: 'open', id: Date.now(), state, vault })}
        onReset={() => {
          clearStored();
          setSession({ status: 'open', id: Date.now(), state: emptyState(), vault: null });
        }}
      />
    );
  }

  // Unmounting the portfolio on lock drops the decrypted data and the key from memory.
  return (
    <Portfolio
      key={session.id}
      initial={session.state}
      initialVault={session.vault}
      onLocked={() => {
        const stored = readStored();
        if (stored.kind === 'encrypted') setSession({ status: 'locked', envelope: stored.envelope });
      }}
    />
  );
}

function Portfolio({ initial, initialVault, onLocked }: { initial: PortfolioState; initialVault: Vault | null; onLocked: () => void }) {
  const [state, setState] = useState<PortfolioState>(initial);
  const [vault, setVault] = useState<Vault | null>(initialVault);
  const [tab, setTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; lines: string[] } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  // Saves run one after another, so an older (slower) encryption can never overwrite a newer state.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    saveChain.current = saveChain.current.then(() => saveState(state, vault)).then((ok) => setSaveFailed(!ok));
  }, [state, vault]);

  // Record today's value for the history chart; returns the same object when nothing changed.
  useEffect(() => {
    setState((s) => withSnapshot(s, today()));
  }, [state]);

  const lock = useCallback(async () => {
    await saveChain.current;
    onLocked();
  }, [onLocked]);

  useEffect(() => {
    if (!vault) return;
    let timer = window.setTimeout(lock, AUTO_LOCK_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, AUTO_LOCK_MS);
    };
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [vault, lock]);

  const update: Update = (fn) => setState((s) => fn(s));

  async function refresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const r = await refreshQuotes(state);
      setState((s) => ({ ...s, quotes: { ...s.quotes, ...r.quotes }, metalPrices: { ...s.metalPrices, ...r.metalPrices } }));
      const lines = [`${r.updated} Kurs${r.updated === 1 ? '' : 'e'} aktualisiert.`, ...r.errors];
      setMessage({ kind: r.errors.length ? 'error' : 'ok', lines });
    } finally {
      setRefreshing(false);
    }
  }

  const hasLive = state.holdings.some((h) => h.assetClass !== 'metal' || state.settings.metalMode !== 'manual');

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
        {vault && <button onClick={lock} title="Daten sperren, Passwort wird wieder verlangt">Sperren</button>}
        <button className="primary" onClick={refresh} disabled={refreshing || !hasLive} title={hasLive ? '' : 'Keine Positionen mit Live-Kurs vorhanden'}>
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
        {tab === 'settings' && <SettingsView state={state} update={update} replace={setState} vault={vault} setVault={setVault} />}
      </main>
    </div>
  );
}
