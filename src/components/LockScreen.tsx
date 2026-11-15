import { useState } from 'react';
import { changePassword, Envelope, MIN_PASSWORD_LENGTH, unlockWithPassword, unlockWithRecoveryCode, Vault } from '../lib/crypto';
import { parseState } from '../lib/storage';
import { PortfolioState } from '../lib/types';
import { Logo } from './Logo';

interface Props {
  envelope: Envelope;
  /** recoveryCode is set when a new code was created that the user has to write down */
  onUnlock: (state: PortfolioState, vault: Vault, recoveryCode?: string) => void;
  onReset: () => void;
}

export function LockScreen({ envelope, onUnlock, onReset }: Props) {
  const [mode, setMode] = useState<'password' | 'recover'>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canRecover = envelope.v === 2;

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const { text, vault, newRecoveryCode } = await unlockWithPassword(password, envelope);
      onUnlock(parseState(text), vault, newRecoveryCode);
    } catch (err) {
      setError((err as Error).message);
      setPassword('');
      setBusy(false);
    }
  }

  async function recover(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (newPw.length < MIN_PASSWORD_LENGTH) return setError(`Das neue Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`);
    if (newPw !== repeat) return setError('Die beiden Passwörter stimmen nicht überein.');
    setBusy(true);
    setError('');
    try {
      const { text, vault } = await unlockWithRecoveryCode(code, envelope);
      onUnlock(parseState(text), await changePassword(vault, newPw));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const switchMode = (m: 'password' | 'recover') => {
    setMode(m);
    setError('');
  };

  return (
    <div className="lock">
      <div className="card lock-card">
        <Logo size={44} />
        {mode === 'password' ? (
          <form onSubmit={unlock}>
            <h1>Portfolio ist gesperrt</h1>
            <p className="muted">Deine Daten sind verschlüsselt gespeichert. Gib dein Passwort ein, um sie zu öffnen.</p>
            <label className="field">
              <span>Passwort</span>
              <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <div className="field-error" role="alert">{error}</div>}
            <button type="submit" className="primary wide" disabled={busy || !password}>{busy ? 'Entsperrt …' : 'Entsperren'}</button>
            <button type="button" className="link" onClick={() => switchMode('recover')}>Passwort vergessen?</button>
          </form>
        ) : (
          <form onSubmit={recover}>
            <h1>Passwort vergessen</h1>
            {canRecover ? (
              <>
                <p className="muted">
                  Gib den Wiederherstellungsschlüssel ein, den du beim Einrichten des Passwortschutzes notiert hast, und wähle ein
                  neues Passwort. Deine Daten bleiben erhalten.
                </p>
                <label className="field">
                  <span>Wiederherstellungsschlüssel</span>
                  <input className="mono" autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
                <label className="field">
                  <span>Neues Passwort (mind. {MIN_PASSWORD_LENGTH} Zeichen)</span>
                  <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                </label>
                <label className="field">
                  <span>Neues Passwort wiederholen</span>
                  <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
                </label>
                {error && <div className="field-error" role="alert">{error}</div>}
                <button type="submit" className="primary wide" disabled={busy || !code || !newPw}>{busy ? 'Stellt wieder her …' : 'Neues Passwort setzen'}</button>
              </>
            ) : (
              <p className="muted">
                Für diese Daten wurde noch kein Wiederherstellungsschlüssel eingerichtet. Er wird automatisch erstellt, sobald du
                dich einmal mit deinem Passwort anmeldest.
              </p>
            )}
            <button type="button" className="link" onClick={() => switchMode('password')}>Zurück zur Passworteingabe</button>
            <details className="small">
              <summary>Auch den Wiederherstellungsschlüssel verloren?</summary>
              <p className="muted">
                Dann lassen sich die Daten nicht mehr entschlüsseln – von niemandem. Du kannst nur alles löschen und neu beginnen
                (oder danach eine unverschlüsselte Sicherung importieren, falls du eine hast).
              </p>
              <button type="button" className="danger" onClick={() => {
                if (confirm('Wirklich ALLE gespeicherten Daten unwiderruflich löschen?')) onReset();
              }}>Alle Daten löschen</button>
            </details>
          </form>
        )}
      </div>
    </div>
  );
}
