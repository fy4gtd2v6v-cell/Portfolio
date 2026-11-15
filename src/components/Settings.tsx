import { useRef, useState } from 'react';
import type { Update } from '../App';
import {
  changePassword, createVault, cryptoAvailable, decryptText, Envelope, MIN_PASSWORD_LENGTH, parseEnvelope, renewRecoveryCode,
  unlockWithEither, Vault, verifyPassword,
} from '../lib/crypto';
import { exportState, parseState } from '../lib/storage';
import { emptyState, PortfolioState } from '../lib/types';

interface Props {
  state: PortfolioState;
  update: Update;
  replace: (s: PortfolioState) => void;
  vault: Vault | null;
  setVault: (v: Vault | null) => void;
  showRecoveryCode: (code: string) => void;
}

export function SettingsView({ state, update, replace, vault, setVault, showRecoveryCode }: Props) {
  return (
    <>
      <Security vault={vault} setVault={setVault} showRecoveryCode={showRecoveryCode} />
      <ApiKeys state={state} update={update} encrypted={!!vault} />
      <Backup state={state} replace={replace} vault={vault} />
    </>
  );
}

// ---------------- Password protection ----------------

function newPasswordError(pw: string, repeat: string): string {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;
  if (pw !== repeat) return 'Die beiden Passwörter stimmen nicht überein.';
  return '';
}

function Security({ vault, setVault, showRecoveryCode }: Pick<Props, 'vault' | 'setVault' | 'showRecoveryCode'>) {
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const done = (text: string) => {
    setCurrent(''); setPw(''); setRepeat('');
    setMsg({ ok: true, text });
  };
  const fail = (text: string) => setMsg({ ok: false, text });

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const enable = (e: React.FormEvent) => {
    e.preventDefault();
    const err = newPasswordError(pw, repeat);
    if (err) return fail(err);
    run(async () => {
      const created = await createVault(pw);
      setVault(created.vault);
      showRecoveryCode(created.recoveryCode);
      done('Passwortschutz ist aktiv. Deine Daten werden ab jetzt verschlüsselt gespeichert.');
    });
  };

  const change = (e: React.FormEvent) => {
    e.preventDefault();
    const err = newPasswordError(pw, repeat);
    if (err) return fail(err);
    run(async () => {
      if (!vault || !(await verifyPassword(current, vault))) return fail('Das aktuelle Passwort ist falsch.');
      setVault(await changePassword(vault, pw));
      done('Passwort geändert. Dein Wiederherstellungsschlüssel bleibt gültig.');
    });
  };

  const disable = () =>
    run(async () => {
      if (!vault || !(await verifyPassword(current, vault))) return fail('Das aktuelle Passwort ist falsch.');
      if (!confirm('Passwortschutz entfernen? Die Daten liegen danach wieder unverschlüsselt im Browser.')) return;
      setVault(null);
      done('Passwortschutz entfernt.');
    });

  const renew = () =>
    run(async () => {
      if (!vault || !(await verifyPassword(current, vault))) return fail('Das aktuelle Passwort ist falsch.');
      const renewed = await renewRecoveryCode(vault);
      setVault(renewed.vault);
      showRecoveryCode(renewed.recoveryCode);
      done('Neuer Wiederherstellungsschlüssel erstellt. Der alte ist ab sofort ungültig.');
    });

  if (!cryptoAvailable()) {
    return (
      <section className="card">
        <h2>Passwortschutz</h2>
        <p className="muted">In diesem Browser bzw. unter dieser Adresse steht keine Verschlüsselung zur Verfügung. Öffne die App über https oder localhost.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Passwortschutz {vault ? <span className="badge ok">aktiv</span> : <span className="badge">aus</span>}</h2>
      {vault ? (
        <>
          <p className="muted">
            Deine Daten und API-Keys sind mit AES-256 verschlüsselt gespeichert. Die App sperrt sich nach 10 Minuten ohne Eingabe
            und beim Schließen des Tabs.
          </p>
          <form onSubmit={change}>
            <div className="grid">
              <label className="field">
                <span>Aktuelles Passwort</span>
                <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
              </label>
              <label className="field">
                <span>Neues Passwort</span>
                <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </label>
              <label className="field">
                <span>Neues Passwort wiederholen</span>
                <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
              </label>
            </div>
            <div className="inline">
              <button type="submit" disabled={busy || !current}>Passwort ändern</button>
              <button type="button" disabled={busy || !current} onClick={renew}>Neuen Wiederherstellungsschlüssel erstellen</button>
              <button type="button" className="danger" disabled={busy || !current} onClick={disable}>Passwortschutz entfernen</button>
            </div>
            <p className="small muted">Für alle drei Aktionen brauchst du dein aktuelles Passwort.</p>
          </form>
        </>
      ) : (
        <form onSubmit={enable}>
          <p className="muted">
            Ohne Passwortschutz liegen deine Positionen und API-Keys unverschlüsselt in diesem Browser – jeder mit Zugriff auf
            diesen Rechner könnte sie lesen. Mit Passwort werden sie verschlüsselt, und die App verlangt es bei jedem Öffnen.
          </p>
          <div className="banner warn">
            <strong>Wichtig:</strong> Nach dem Aktivieren bekommst du einen Wiederherstellungsschlüssel. Damit kannst du ein neues
            Passwort setzen, falls du deines vergisst. Ohne Passwort <em>und</em> ohne Schlüssel sind die Daten verloren.
          </div>
          <div className="grid">
            <label className="field">
              <span>Passwort (mind. {MIN_PASSWORD_LENGTH} Zeichen)</span>
              <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            <label className="field">
              <span>Passwort wiederholen</span>
              <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </label>
          </div>
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Verschlüsselt …' : 'Passwortschutz aktivieren'}</button>
        </form>
      )}
      {msg && <p className={msg.ok ? 'small pos' : 'field-error'} role="status">{msg.text}</p>}
    </section>
  );
}

// ---------------- API keys ----------------

function ApiKeys({ state, update, encrypted }: { state: PortfolioState; update: Update; encrypted: boolean }) {
  const setKey = (k: 'alphaVantageKey' | 'coingeckoKey', v: string) =>
    update((s) => ({ ...s, settings: { ...s.settings, [k]: v.trim() } }));

  return (
    <section className="card">
      <h2>API-Keys</h2>
      <p className="muted">
        Die Keys werden nur in diesem Browser gespeichert{encrypted ? ' (verschlüsselt)' : ''} und sind nicht im Export enthalten.
      </p>
      <label className="field">
        <span>Alpha Vantage (Aktien & ETFs) – kostenlos unter alphavantage.co, 25 Abfragen/Tag</span>
        <input type="password" autoComplete="off" value={state.settings.alphaVantageKey} onChange={(e) => setKey('alphaVantageKey', e.target.value)} />
      </label>
      <label className="field">
        <span>CoinGecko Demo-Key (Krypto) – optional, funktioniert auch ohne</span>
        <input type="password" autoComplete="off" value={state.settings.coingeckoKey} onChange={(e) => setKey('coingeckoKey', e.target.value)} />
      </label>
    </section>
  );
}

// ---------------- Export / import ----------------

function Backup({ state, replace, vault }: { state: PortfolioState; replace: (s: PortfolioState) => void; vault: Vault | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<Envelope | null>(null);
  const [importPw, setImportPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function doExport() {
    const blob = new Blob([await exportState(state, vault)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `portfolio-${new Date().toISOString().slice(0, 10)}${vault ? '-verschluesselt' : ''}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function finishImport(json: string) {
    const imported = parseState(json);
    // keep the API keys of this browser, the export never contains them
    replace({ ...imported, settings: state.settings });
    setPending(null);
    setImportPw('');
    setMsg(`Import erfolgreich: ${imported.holdings.length} Positionen.`);
  }

  async function doImport(file: File) {
    setMsg('');
    try {
      const text = await file.text();
      const env = parseEnvelope(text);
      if (!env) return finishImport(text);
      // A backup made with the current password opens without asking again.
      if (vault && env.v === 2 && env.pw.salt === vault.pw.salt) {
        try {
          return finishImport(await decryptText(vault, env));
        } catch {
          /* fall through and ask for the password */
        }
      }
      setPending(env);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function decryptPending(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setMsg('');
    try {
      finishImport((await unlockWithEither(importPw, pending)).text);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Daten sichern</h2>
      <p className="muted">
        Alle Daten liegen nur in diesem Browser. Exportiere regelmäßig eine Sicherung.{' '}
        {vault
          ? 'Die Sicherungsdatei wird mit deinem Passwort verschlüsselt.'
          : 'Ohne Passwortschutz ist die Sicherungsdatei unverschlüsselt – bewahre sie sicher auf.'}
      </p>
      <div className="inline">
        <button onClick={doExport}>Exportieren {vault ? '(verschlüsselt)' : '(JSON)'}</button>
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
      {pending && (
        <form onSubmit={decryptPending}>
          <h3>Verschlüsselte Sicherung</h3>
          <div className="inline">
            <input type="password" autoComplete="off" placeholder="Passwort oder Wiederherstellungsschlüssel" aria-label="Passwort der Sicherung" value={importPw} onChange={(e) => setImportPw(e.target.value)} />
            <button type="submit" disabled={busy || !importPw}>{busy ? 'Entschlüsselt …' : 'Entschlüsseln & importieren'}</button>
            <button type="button" onClick={() => { setPending(null); setImportPw(''); }}>Abbrechen</button>
          </div>
        </form>
      )}
      {msg && <p className="small" role="status">{msg}</p>}
    </section>
  );
}
