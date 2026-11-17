import { useMemo, useRef, useState } from 'react';
import type { Update } from '../App';
import { decodeBytes } from '../lib/csv';
import { fmtEur, fmtNum, parseNum, today } from '../lib/format';
import {
  applyBalance, applyPositions, applyTransactions, autoMap, detectKind, FIELDS, ImportKind, KIND_LABEL, Mapping, matchHolding,
  missingFields, ParsedFile, parseFile, readPositions, readStatement, readTransactions,
} from '../lib/importer';
import { PortfolioState } from '../lib/types';
import { Dialog, Icon } from './ui';

const NEW = '__new__';
const KINDS: ImportKind[] = ['statement', 'positions', 'transactions'];
const day = (iso?: string) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE') : '–');

interface Loaded {
  fileName: string;
  file: ParsedFile;
}

export function ImportDialog({ state, update, onClose, onDone }: {
  state: PortfolioState;
  update: Update;
  onClose: () => void;
  /** called after a successful import with a short summary */
  onDone: (message: string) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [kind, setKind] = useState<ImportKind>('statement');
  const [mapping, setMapping] = useState<Mapping>({});
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load(f: File) {
    setError('');
    try {
      const file = parseFile(decodeBytes(await f.arrayBuffer()));
      if (file.header.length < 2 || file.rows.length === 0) {
        setLoaded(null);
        return setError('In dieser Datei wurde keine Tabelle gefunden. Bitte eine CSV-Datei aus dem Online-Banking wählen (kein PDF).');
      }
      const k = detectKind(file.header);
      setKind(k);
      setMapping(autoMap(file.header, k));
      setLoaded({ fileName: f.name, file });
    } catch {
      setLoaded(null);
      setError('Die Datei konnte nicht gelesen werden.');
    }
  }

  const chooseKind = (k: ImportKind) => {
    if (!loaded) return;
    setKind(k);
    setMapping(autoMap(loaded.file.header, k));
  };

  return (
    <Dialog title="Datei importieren" onClose={onClose} wide>
      {!loaded ? (
        <>
          <label
            className={`dropzone ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
          >
            <Icon.upload />
            <strong>CSV-Datei hierher ziehen oder auswählen</strong>
            <span className="muted small">Kontoumsätze, Depotbestand oder Wertpapier-Transaktionen</span>
            <input ref={inputRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />
          </label>
          {error && <div className="field-error" role="alert">{error}</div>}
          <p className="muted small">
            Die Datei wird nur in deinem Browser gelesen und nirgendwohin übertragen. Vor dem Import siehst du eine Vorschau.
          </p>
          <details>
            <summary>Wo finde ich den Export bei meiner Bank?</summary>
            <ul className="howto small">
              <li><strong>ING:</strong> im Internetbanking am Computer (nicht in der App). Girokonto: Umsätze → Export als CSV. Depot: Depotübersicht → Export.</li>
              <li><strong>Sparkasse:</strong> Online-Banking → Umsätze → Exportieren → „CSV-CAMT“. Die Datei enthält keinen Kontostand – den trägst du beim Import ein.</li>
              <li><strong>Trade Republic:</strong> App → Profil → Kontoauszüge → Transaktionsexport (CSV).</li>
            </ul>
            <p className="muted small">
              Die Banken ändern ihre Exporte gelegentlich. Falls Spalten falsch erkannt werden, kannst du sie im nächsten Schritt selbst zuordnen.
            </p>
          </details>
        </>
      ) : (
        <Preview
          loaded={loaded} kind={kind} mapping={mapping} state={state}
          onKind={chooseKind} onMapping={setMapping} onBack={() => setLoaded(null)}
          onApply={(change, message) => { update(change); onDone(message); }}
        />
      )}
    </Dialog>
  );
}

function Preview({ loaded, kind, mapping, state, onKind, onMapping, onBack, onApply }: {
  loaded: Loaded;
  kind: ImportKind;
  mapping: Mapping;
  state: PortfolioState;
  onKind: (k: ImportKind) => void;
  onMapping: (m: Mapping) => void;
  onBack: () => void;
  onApply: Apply;
}) {
  const { file, fileName } = loaded;
  const missing = missingFields(kind, mapping);
  const sample = file.rows[0] ?? [];
  // Opened automatically when something is missing, but never closed under the user's hands.
  const [showMapping, setShowMapping] = useState(missing.length > 0);
  const mappingOpen = showMapping || missing.length > 0;

  return (
    <>
      <div className="import-meta">
        <span className="file">{fileName}</span>
        <span className="muted small">{file.rows.length} Zeilen · {file.header.length} Spalten</span>
        <button type="button" className="link" onClick={onBack}>Andere Datei wählen</button>
      </div>

      <div className="field">
        <span className="muted small">Die Datei enthält</span>
        <div className="segmented" role="radiogroup" aria-label="Art der Datei">
          {KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'active' : ''} onClick={() => onKind(k)}>{KIND_LABEL[k]}</button>
          ))}
        </div>
      </div>

      <details open={mappingOpen} onToggle={(e) => setShowMapping((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Spalten zuordnen{missing.length === 0 && ' (automatisch erkannt)'}</summary>
        <div className="mapping">
          {FIELDS[kind].map((def) => (
            <label className="field" key={def.key}>
              <span>{def.label}</span>
              <select value={mapping[def.key] ?? -1} onChange={(e) => onMapping({ ...mapping, [def.key]: Number(e.target.value) })}>
                <option value={-1}>– nicht vorhanden –</option>
                {file.header.map((h, i) => (
                  <option key={i} value={i}>{h || `Spalte ${i + 1}`}{sample[i] ? ` (z. B. ${sample[i].slice(0, 24)})` : ''}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </details>

      {missing.length > 0 ? (
        <div className="banner warn">Bitte noch zuordnen: {missing.join(', ')}.</div>
      ) : kind === 'statement' ? (
        <StatementPreview file={file} mapping={mapping} state={state} onApply={onApply} />
      ) : kind === 'positions' ? (
        <PositionsPreview file={file} mapping={mapping} state={state} onApply={onApply} />
      ) : (
        <TransactionsPreview file={file} mapping={mapping} state={state} onApply={onApply} />
      )}
    </>
  );
}

/** The change is a function of the then-current state, so prices fetched in the meantime are not lost. */
type Apply = (change: (s: PortfolioState) => PortfolioState, message: string) => void;
type PreviewProps = { file: ParsedFile; mapping: Mapping; state: PortfolioState; onApply: Apply };

function StatementPreview({ file, mapping, state, onApply }: PreviewProps) {
  const r = useMemo(() => readStatement(file, mapping), [file, mapping]);
  const accounts = state.holdings.filter((h) => h.assetClass === 'cash');
  const byIban = r.iban ? accounts.find((a) => a.iban === r.iban) : undefined;
  const [target, setTarget] = useState<string>(byIban?.id ?? NEW);
  const [name, setName] = useState(r.accountName ?? '');
  const existing = accounts.find((a) => a.id === target);

  // Without a balance in the file: old balance plus everything booked after it.
  const computed = useMemo(() => {
    if (r.balance !== undefined || !existing?.balanceDate || existing.balance === undefined) return undefined;
    const newer = r.bookings.filter((b) => b.date > existing.balanceDate!);
    return { value: existing.balance + newer.reduce((s, b) => s + b.amount, 0), count: newer.length };
  }, [r, existing]);
  const suggestion = r.balance ?? computed?.value;
  const [input, setInput] = useState<string | null>(null);
  const text = input ?? (suggestion !== undefined ? fmtNum(suggestion, 2) : '');
  const balance = parseNum(text);
  const ready = r.count > 0 && Number.isFinite(balance) && (target !== NEW || name.trim() !== '');

  if (r.count === 0) {
    return <div className="banner warn">Keine Buchung konnte gelesen werden. Bitte prüfe die Zuordnung von Buchungsdatum und Betrag.</div>;
  }

  return (
    <>
      <h3>Vorschau</h3>
      <p className="small">
        {r.count} Buchungen vom {day(r.from)} bis {day(r.to)}, Summe {fmtEur(r.sum)}
        {r.skipped > 0 && <span className="muted"> · {r.skipped} Zeilen übersprungen (z. B. vorgemerkte Umsätze)</span>}
      </p>
      <div className="grid">
        <label className="field">
          <span>Konto</span>
          <select value={target} onChange={(e) => { setTarget(e.target.value); setInput(null); }}>
            <option value={NEW}>Neues Konto anlegen</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} (bisher {fmtEur(a.balance ?? 0)})</option>)}
          </select>
        </label>
        {target === NEW && (
          <label className="field">
            <span>Name des Kontos</span>
            <input placeholder="z. B. Sparkasse Girokonto" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>Kontostand am {day(r.to)} in €</span>
          <input inputMode="decimal" placeholder="z. B. 3.412,77" value={text} onChange={(e) => setInput(e.target.value)} />
        </label>
      </div>
      <p className="muted small">
        {r.balance !== undefined
          ? 'Der Kontostand stammt aus der Datei.'
          : computed
            ? `Berechnet aus dem bisherigen Stand vom ${day(existing?.balanceDate)} und ${computed.count} neueren Buchungen. Bitte mit dem Online-Banking vergleichen.`
            : 'Die Datei enthält keinen Kontostand. Bitte trag den aktuellen Stand aus dem Online-Banking ein.'}
      </p>
      <div className="inline">
        <button type="button" className="primary" disabled={!ready} onClick={() => {
          const account = { accountId: target === NEW ? undefined : target, name: name.trim(), iban: r.iban, balance, balanceDate: r.to ?? today() };
          onApply((s) => applyBalance(s, account), `Konto „${existing?.name ?? name.trim()}“: Kontostand ${fmtEur(balance)} übernommen.`);
        }}>Kontostand übernehmen</button>
      </div>
    </>
  );
}

function PositionsPreview({ file, mapping, state, onApply }: PreviewProps) {
  const { drafts, skipped } = useMemo(() => readPositions(file, mapping), [file, mapping]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const chosen = drafts.filter((d) => !off.has(d.key));
  const toggle = (key: string) => setOff((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  if (drafts.length === 0) {
    return <div className="banner warn">Keine Position konnte gelesen werden. Bitte prüfe die Zuordnung von Bezeichnung und Stück.</div>;
  }

  return (
    <>
      <h3>Vorschau</h3>
      <div className="table-wrap">
        <table className="import-table">
          <thead>
            <tr><th /><th>Wertpapier</th><th className="num">Stück</th><th className="num">Einstand</th><th className="num">Kurs</th><th /></tr>
          </thead>
          <tbody>
            {drafts.map((d) => {
              const match = matchHolding(state, d);
              return (
                <tr key={d.key}>
                  <td><input type="checkbox" checked={!off.has(d.key)} onChange={() => toggle(d.key)} aria-label={`${d.name} importieren`} /></td>
                  <td>
                    {d.name}
                    <div className="muted small">{d.isin ?? 'ohne ISIN'}</div>
                    {d.warnings.map((w) => <div key={w} className="warn-text">{w}</div>)}
                  </td>
                  <td className="num">{fmtNum(d.quantity, 6)}</td>
                  <td className="num">{d.cost !== undefined ? fmtEur(d.cost) : '–'}</td>
                  <td className="num">{d.price !== undefined ? fmtEur(d.price) : '–'}</td>
                  <td><span className={`tag ${match ? 'update' : 'new'}`}>{match ? 'aktualisiert' : 'neu'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        {skipped > 0 && `${skipped} Zeilen ohne Wertpapier übersprungen (z. B. Summenzeilen). `}
        Bestehende Positionen mit gleicher ISIN werden auf Stückzahl und Einstand aus der Datei gesetzt. Der Kurs aus der Datei gilt,
        bis ein Live-Kurs vorliegt – dafür trägst du später bei der Position ein Börsensymbol ein.
      </p>
      <div className="inline">
        <button type="button" className="primary" disabled={chosen.length === 0} onClick={() =>
          onApply((s) => applyPositions(s, chosen, today()), `${chosen.length} Depotposition${chosen.length === 1 ? '' : 'en'} importiert.`)
        }>{chosen.length} Position{chosen.length === 1 ? '' : 'en'} importieren</button>
      </div>
    </>
  );
}

function TransactionsPreview({ file, mapping, state, onApply }: PreviewProps) {
  const { drafts, skipped, ignoredTypes } = useMemo(() => readTransactions(file, mapping), [file, mapping]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const chosen = drafts.filter((d) => !off.has(d.key));
  const toggle = (key: string) => setOff((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  if (drafts.length === 0) {
    return (
      <div className="banner warn">
        Keine Käufe oder Verkäufe gefunden. Bitte prüfe die Zuordnung – in der Spalte „Art“ müssen Begriffe wie Kauf, Verkauf, Buy oder Sell stehen.
        {ignoredTypes.length > 0 && ` Gefunden wurden: ${ignoredTypes.slice(0, 6).join(', ')}.`}
      </div>
    );
  }

  return (
    <>
      <h3>Vorschau</h3>
      <div className="table-wrap">
        <table className="import-table">
          <thead>
            <tr><th /><th>Wertpapier</th><th className="num">Buchungen</th><th className="num">Bestand danach</th><th /></tr>
          </thead>
          <tbody>
            {drafts.map((d) => {
              const match = matchHolding(state, d);
              const buys = d.purchases.filter((p) => p.kind !== 'sell').length;
              return (
                <tr key={d.key}>
                  <td><input type="checkbox" checked={!off.has(d.key)} onChange={() => toggle(d.key)} aria-label={`${d.name} importieren`} /></td>
                  <td>
                    {d.name}
                    <div className="muted small">{d.isin ?? 'ohne ISIN'}</div>
                    {d.warnings.map((w) => <div key={w} className="warn-text">{w}</div>)}
                  </td>
                  <td className="num">{buys} Käufe · {d.purchases.length - buys} Verkäufe</td>
                  <td className="num">{fmtNum(Math.max(0, d.quantity), 6)}</td>
                  <td><span className={`tag ${match ? 'update' : 'new'}`}>{match ? 'ersetzt Historie' : 'neu'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        {skipped > 0 && `${skipped} Zeilen ohne Kauf oder Verkauf übersprungen`}
        {ignoredTypes.length > 0 && ` (${ignoredTypes.slice(0, 6).join(', ')})`}
        {skipped > 0 && '. '}
        Bei Positionen mit gleicher ISIN ersetzt die Datei die bisherigen Käufe und Verkäufe. Dividenden, Zinsen und Ein-/Auszahlungen werden nicht übernommen.
      </p>
      <div className="inline">
        <button type="button" className="primary" disabled={chosen.length === 0} onClick={() =>
          onApply((s) => applyTransactions(s, chosen), `${chosen.length} Wertpapier${chosen.length === 1 ? '' : 'e'} mit Käufen und Verkäufen importiert.`)
        }>{chosen.length} Wertpapier{chosen.length === 1 ? '' : 'e'} importieren</button>
      </div>
    </>
  );
}
