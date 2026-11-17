import { useMemo, useRef, useState } from 'react';
import type { Update } from '../App';
import { decodeBytes } from '../lib/csv';
import { isZip, readXlsx, XlsxError } from '../lib/xlsx';
import { fmtEur, fmtNum, fmtSignedEur, parseNum, today } from '../lib/format';
import {
  applyBalance, applyBrokerAccount, applyPositions, applyTransactions, autoMap, brokerBalance, detectKind, detectProvider, emptyBroker, FIELDS,
  foldCashEvents, hasOnlyBrokenLots, ImportKind, KIND_LABEL, Mapping, matchHolding, missingFields, ParsedFile, parseFile, parseRows, pendingList,
  planTransactions, readMetalTransactions, readPositions, readStatement, readTransactions,
} from '../lib/importer';
import { PortfolioState } from '../lib/types';
import { Dialog, Icon } from './ui';

const NEW = '__new__';
const KINDS: ImportKind[] = ['statement', 'positions', 'transactions', 'metals'];
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
      const buf = await f.arrayBuffer();
      if (/\.xls$/i.test(f.name) && !isZip(buf)) {
        setLoaded(null);
        return setError('Das alte Excel-Format (.xls) wird nicht unterstützt. Bitte die Datei als .xlsx oder .csv speichern.');
      }
      const file = isZip(buf) ? parseRows(await readXlsx(buf)) : parseFile(decodeBytes(buf));
      if (file.header.length < 2 || file.rows.length === 0) {
        setLoaded(null);
        return setError('In dieser Datei wurde keine Tabelle gefunden. Bitte eine CSV- oder Excel-Datei (.xlsx) wählen, kein PDF.');
      }
      const k = detectKind(file.header, file.rows);
      setKind(k);
      setMapping(autoMap(file.header, k, file.rows));
      setLoaded({ fileName: f.name, file });
    } catch (e) {
      setLoaded(null);
      setError(e instanceof XlsxError ? e.message : 'Die Datei konnte nicht gelesen werden.');
    }
  }

  const chooseKind = (k: ImportKind) => {
    if (!loaded) return;
    setKind(k);
    setMapping(autoMap(loaded.file.header, k, loaded.file.rows));
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
            <strong>CSV- oder Excel-Datei hierher ziehen oder auswählen</strong>
            <span className="muted small">Kontoumsätze, Depotbestand, Wertpapier- oder Edelmetall-Transaktionen</span>
            <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />
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
              <li><strong>Flexgold:</strong> Transaktionsverlauf als Excel-Datei (.xlsx) herunterladen.</li>
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
  const [depot, setDepot] = useState(detectProvider(file) ?? '');
  const account = depot.trim() || undefined;
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

      {kind !== 'statement' && (
        <label className="field depot-field">
          <span>Depot / Anbieter</span>
          <input placeholder="z. B. ING, Trade Republic, Flexgold" value={depot} onChange={(e) => setDepot(e.target.value)} />
          <span className="muted small">Positionen werden nur innerhalb desselben Depots abgeglichen – dasselbe Wertpapier in zwei Depots bleibt getrennt.</span>
        </label>
      )}

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
        <PositionsPreview key={account} account={account} file={file} mapping={mapping} state={state} onApply={onApply} />
      ) : (
        <TransactionsPreview key={`${kind}|${account}`} account={account} metals={kind === 'metals'} file={file} mapping={mapping} state={state} onApply={onApply} />
      )}
    </>
  );
}

/** The change is a function of the then-current state, so prices fetched in the meantime are not lost. */
type Apply = (change: (s: PortfolioState) => PortfolioState, message: string) => void;
type PreviewProps = { file: ParsedFile; mapping: Mapping; state: PortfolioState; onApply: Apply; account?: string };

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

function PositionsPreview({ file, mapping, state, onApply, account }: PreviewProps) {
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
              const match = matchHolding(state, d, account, true);
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
          onApply((s) => applyPositions(s, chosen, today(), account), `${chosen.length} Depotposition${chosen.length === 1 ? '' : 'en'}${account ? ` (${account})` : ''} importiert.`)
        }>{chosen.length} Position{chosen.length === 1 ? '' : 'en'} importieren</button>
      </div>
    </>
  );
}

/** Trade Republic's transaction export: recognised by columns no bank statement has. */
const looksLikeTradeRepublic = (header: string[]) => {
  const h = header.map((x) => x.toLowerCase());
  return h.includes('account_type') && h.includes('transaction_id') && h.includes('asset_class');
};

function TransactionsPreview({ file, mapping, state, onApply, metals, account }: PreviewProps & { metals?: boolean }) {
  const result = useMemo(() => (metals ? readMetalTransactions(file, mapping) : readTransactions(file, mapping)), [file, mapping, metals]);
  const { drafts, skipped, ignoredTypes, cash, cashEvents } = result;
  const [off, setOff] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState(false);
  const toggle = (key: string) => setOff((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const plans = useMemo(() => planTransactions(state, drafts, replace, account), [state, drafts, replace, account]);
  const chosen = plans.filter((p) => !off.has(p.draft.key));
  const newTrades = chosen.reduce((s, p) => s + p.added.length, 0);
  const knownTrades = chosen.reduce((s, p) => s + p.duplicates, 0);

  // Broker cash account: continued from earlier imports, so overlapping files add only new rows.
  const [accountName, setAccountName] = useState(account ?? result.accountName ?? (looksLikeTradeRepublic(file.header) ? 'Trade Republic' : 'Verrechnungskonto'));
  const existingAccount = state.holdings.find((h) => h.assetClass === 'cash' && h.name.trim().toLowerCase() === accountName.trim().toLowerCase());
  const startBroker = existingAccount?.broker ?? emptyBroker();
  const folded = useMemo(() => foldCashEvents(startBroker, cashEvents), [startBroker, cashEvents]);
  const pendingNow = pendingList(folded);
  const pendingSum = pendingNow.reduce((s, p) => s + p.amount, 0);
  const [takeCash, setTakeCash] = useState(true);
  const [takePending, setTakePending] = useState(existingAccount?.broker?.withPending ?? true);
  const newBalance = brokerBalance(folded, takePending);
  const continued = !!existingAccount?.broker;
  const withAccount = !!cash && takeCash && accountName.trim() !== '' && (folded.added > 0 || !continued || takePending !== !!existingAccount?.broker?.withPending);

  if (drafts.length === 0) {
    return (
      <div className="banner warn">
        Keine Käufe oder Verkäufe gefunden. Bitte prüfe die Zuordnung – in der Spalte „Art“ müssen Begriffe wie Kauf, Verkauf, Buy oder Sell stehen.
        {ignoredTypes.length > 0 && ` Gefunden wurden: ${ignoredTypes.slice(0, 6).join(', ')}.`}
      </div>
    );
  }

  const addedInvested = chosen.reduce((s, p) => s + p.added.filter((t) => t.kind !== 'sell').reduce((x, t) => x + t.totalCost, 0), 0);
  const anyExisting = plans.some((p) => p.holding);
  // Positions imported before depots were recorded: this import can label them.
  const unlabeled = account ? chosen.filter((p) => p.holding && !p.holding.account).length : 0;
  const repaired = plans.filter((p) => p.replaced && p.holding && hasOnlyBrokenLots(p.holding));

  return (
    <>
      <h3>Vorschau</h3>
      <div className="table-wrap">
        <table className="import-table">
          <thead>
            <tr><th /><th>{metals ? 'Edelmetall' : 'Wertpapier'}</th><th className="num">Neue Buchungen</th><th className="num">Neu investiert</th>{metals && <th className="num">Neu (Gramm)</th>}<th className="num">{metals ? 'Letzter Preis' : 'Letzter Kurs'}</th><th /></tr>
          </thead>
          <tbody>
            {plans.map(({ draft: d, holding, added, duplicates, replaced }) => {
              const buys = added.filter((p) => p.kind !== 'sell');
              const sells = added.length - buys.length;
              const savings = buys.filter((p) => p.note === 'Sparplan').length;
              const tag = !holding ? ['new', 'neu'] : replaced ? ['update', 'ersetzt Käufe'] : added.length ? ['update', 'ergänzt'] : ['', 'unverändert'];
              return (
                <tr key={d.key} className={!added.length ? 'muted' : ''}>
                  <td><input type="checkbox" checked={!off.has(d.key)} onChange={() => toggle(d.key)} aria-label={`${d.name} importieren`} /></td>
                  <td>
                    {d.name}
                    <div className="muted small">{d.metal ? 'Feingewicht in Gramm' : d.isin ?? 'ohne ISIN'}</div>
                    {d.warnings.map((w) => <div key={w} className="warn-text">{w}</div>)}
                  </td>
                  <td className="num">
                    {added.length === 0 ? 'keine neuen' : (
                      <>
                        {buys.length > 0 && `${buys.length} ${buys.length === 1 ? 'Kauf' : 'Käufe'}`}
                        {buys.length > 0 && sells > 0 && ' · '}
                        {sells > 0 && `${sells} ${sells === 1 ? 'Verkauf' : 'Verkäufe'}`}
                      </>
                    )}
                    {(savings > 0 || duplicates > 0) && (
                      <div className="muted small">
                        {savings > 0 && `davon ${savings} Sparplan`}
                        {savings > 0 && duplicates > 0 && ' · '}
                        {duplicates > 0 && `${duplicates} schon vorhanden`}
                      </div>
                    )}
                  </td>
                  <td className="num">{fmtEur(buys.reduce((s, p) => s + p.totalCost, 0))}</td>
                  {metals && <td className="num">{fmtNum(added.reduce((g, p) => g + (p.kind === 'sell' ? -p.quantity : p.quantity), 0), 4)} g</td>}
                  <td className="num">
                    {d.lastPrice ? `${fmtEur(d.lastPrice.price)}${d.metal ? '/g' : ''}` : '–'}
                    {d.lastPrice && <div className="muted small">{day(d.lastPrice.date)}</div>}
                  </td>
                  <td><span className={`tag ${tag[0]}`}>{tag[1]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small">
        <strong>{newTrades}</strong> neue Buchung{newTrades === 1 ? '' : 'en'} ({fmtEur(addedInvested)} investiert)
        {knownTrades > 0 && <span className="muted"> · {knownTrades} schon vorhanden, werden übersprungen</span>}
      </p>
      <p className="muted small">
        Käufe desselben Wertpapiers werden zu einer Position zusammengefasst; jeder Kauf bleibt mit Kurs, Gebühr und Betrag sichtbar.
        Bereits importierte Buchungen werden an ihrer Buchungsnummer erkannt – du kannst also jederzeit eine neuere oder überlappende
        Datei importieren. Bis ein Live-Kurs vorliegt, gilt der Kurs des letzten Kaufs.
      </p>
      {anyExisting && (
        <label className="check-row">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          <span>
            Bisherige Käufe dieser Wertpapiere ersetzen
            <span className="muted small"> – nur nötig, um einen fehlerhaften früheren Import zu reparieren. Von Hand erfasste Käufe dieser Wertpapiere gehen dabei verloren.</span>
          </span>
        </label>
      )}
      {repaired.length > 0 && !replace && (
        <div className="banner warn">
          {repaired.length === 1 ? 'Eine Position stammt' : `${repaired.length} Positionen stammen`} bisher nur aus einem Depotbestand oder einem
          fehlerhaften früheren Import: {repaired.map((p) => p.holding!.name).join(', ')}. Ihr Bestand wird durch die Käufe aus der Datei ersetzt.
          Alle anderen Positionen werden nur ergänzt.
        </div>
      )}

      {cash && (
        <>
          <h3 className="import-sub">Guthaben</h3>
          <label className="check-row">
            <input type="checkbox" checked={takeCash} onChange={(e) => setTakeCash(e.target.checked)} />
            <span>
              Verrechnungskonto {continued ? 'fortschreiben' : 'als Konto übernehmen'}
              <span className="muted small">
                {continued
                  ? ` – ${folded.added} neue Buchung${folded.added === 1 ? '' : 'en'} (${fmtSignedEur(folded.delta)}), ${cashEvents.length - folded.added} schon berücksichtigt.`
                  : ' – Summe aller Ein- und Auszahlungen, Zinsen, Käufe und Gebühren. Stimmt nur, wenn diese erste Datei seit Kontoeröffnung reicht; spätere Dateien werden danach nur noch ergänzt.'}
              </span>
            </span>
            <span className="amount">{fmtEur(folded.cash)}</span>
          </label>
          {pendingNow.length > 0 && (
            <label className="check-row">
              <input type="checkbox" checked={takePending} disabled={!takeCash} onChange={(e) => setTakePending(e.target.checked)} />
              <span>
                Offene Aufträge mitzählen
                <span className="muted small"> – bezahlt, aber noch keine Anteile: {pendingNow.map((p) => `${p.name} ${fmtEur(p.amount)}`).join(', ')}</span>
              </span>
              <span className="amount">+{fmtEur(pendingSum)}</span>
            </label>
          )}
          {takeCash && (
            <div className="grid">
              <label className="field">
                <span>Name des Kontos</span>
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              </label>
              <div className="field">
                <span>Kontostand danach</span>
                <div className="balance-big">{fmtEur(newBalance)}</div>
                <span className="muted small">{existingAccount ? `bisher ${fmtEur(existingAccount.balance ?? 0)}` : 'wird als neues Konto angelegt'}</span>
              </div>
            </div>
          )}
        </>
      )}

      <p className="muted small">
        {skipped > 0 && `${skipped} Zeilen ohne Kauf oder Verkauf übersprungen`}
        {ignoredTypes.length > 0 && ` (${ignoredTypes.slice(0, 6).join(', ')})`}
        {skipped > 0 && '. '}
        {metals ? 'Ein- und Auszahlungen fließen nur ins Guthaben.' : 'Dividenden und Zinsen werden nicht als Wertpapier-Buchungen übernommen.'}
      </p>
      <div className="inline">
        <button type="button" className="primary" disabled={newTrades === 0 && !replace && !withAccount && unlabeled === 0} onClick={() => {
          const drafts = chosen.map((p) => p.draft);
          const cash = withAccount ? { accountId: existingAccount?.id, name: accountName.trim(), events: cashEvents, withPending: takePending } : undefined;
          const parts = [`${newTrades} neue Buchung${newTrades === 1 ? '' : 'en'}${account ? ` (${account})` : ''} importiert`];
          if (knownTrades > 0) parts.push(`${knownTrades} schon vorhanden`);
          if (unlabeled > 0) parts.push(`${unlabeled} Position${unlabeled === 1 ? '' : 'en'} dem Depot „${account}“ zugeordnet`);
          if (cash) parts.push(`Konto „${cash.name}“: ${fmtEur(newBalance)}`);
          onApply((s) => {
            const next = applyTransactions(s, drafts, replace, account);
            return cash ? applyBrokerAccount(next, cash) : next;
          }, parts.join(' · ') + '.');
        }}>{newTrades === 0 && !replace ? (withAccount ? 'Nur Guthaben aktualisieren' : unlabeled > 0 ? 'Depot zuordnen' : 'Nichts Neues') : 'Importieren'}</button>
        {newTrades === 0 && !replace && !withAccount && (
          <span className="muted small">
            {unlabeled > 0 ? `Keine neuen Buchungen. ${unlabeled} bestehende Position${unlabeled === 1 ? '' : 'en'} bekommen das Depot „${account}“.` : 'Alles aus dieser Datei ist schon importiert.'}
          </span>
        )}
      </div>
    </>
  );
}
