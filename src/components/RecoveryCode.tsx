import { useState } from 'react';

/** Shows a freshly created recovery code once. It is not stored anywhere, so the user has to save it now. */
export function RecoveryCodeNotice({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const text = `Portfolio – Wiederherstellungsschlüssel\n\n${code}\n\nMit diesem Schlüssel kannst du ein neues Passwort setzen, wenn du deines vergessen hast.\nSicher aufbewahren und nicht weitergeben.\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'portfolio-wiederherstellungsschluessel.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="rc-title">
      <div className="card recovery">
        <h2 id="rc-title">Dein Wiederherstellungsschlüssel</h2>
        <p className="muted">
          Falls du dein Passwort vergisst, kannst du mit diesem Schlüssel ein neues setzen. Er wird <strong>nur jetzt</strong> angezeigt
          und nirgends gespeichert – notiere ihn oder lege ihn im Passwortmanager ab.
        </p>
        <div className="recovery-code mono" data-testid="recovery-code">{code}</div>
        <div className="inline">
          <button type="button" onClick={copy}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button>
          <button type="button" onClick={download}>Als Textdatei speichern</button>
        </div>
        <p className="small muted">Wer diesen Schlüssel kennt, kann deine Daten öffnen – bewahre ihn getrennt von diesem Gerät auf.</p>
        <label className="check">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>Ich habe den Schlüssel sicher aufbewahrt.</span>
        </label>
        <button type="button" className="primary wide" disabled={!saved} onClick={onDone}>Fertig</button>
      </div>
    </div>
  );
}
