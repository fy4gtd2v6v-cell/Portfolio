import { useState } from 'react';
import { Envelope, openEnvelope, Vault } from '../lib/crypto';
import { parseState } from '../lib/storage';
import { PortfolioState } from '../lib/types';

export function LockScreen({ envelope, onUnlock, onReset }: {
  envelope: Envelope;
  onUnlock: (state: PortfolioState, vault: Vault) => void;
  onReset: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const { text, vault } = await openEnvelope(password, envelope);
      onUnlock(parseState(text), vault);
    } catch (err) {
      setError((err as Error).message);
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <div className="lock">
      <form className="card lock-card" onSubmit={submit}>
        <div className="lock-icon" aria-hidden="true">🔒</div>
        <h1>Portfolio ist gesperrt</h1>
        <p className="muted">Deine Daten sind verschlüsselt gespeichert. Gib dein Passwort ein, um sie zu öffnen.</p>
        <label className="field">
          <span>Passwort</span>
          <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="field-error" role="alert">{error}</div>}
        <button type="submit" className="primary" disabled={busy || !password}>{busy ? 'Entsperrt …' : 'Entsperren'}</button>
        <details className="small">
          <summary>Passwort vergessen?</summary>
          <p className="muted">
            Ohne Passwort lassen sich die Daten nicht wiederherstellen – von niemandem. Du kannst nur alles löschen und neu
            beginnen (oder eine unverschlüsselte Sicherung importieren, falls du eine hast).
          </p>
          <button type="button" className="danger" onClick={() => {
            if (confirm('Wirklich ALLE gespeicherten Daten unwiderruflich löschen?')) onReset();
          }}>Alle Daten löschen</button>
        </details>
      </form>
    </div>
  );
}
