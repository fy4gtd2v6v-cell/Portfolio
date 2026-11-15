import { useState } from 'react';
import { HistoryChart } from './HistoryChart';
import { summarize, valueHolding } from '../lib/portfolio';
import { fmtDate, fmtEur, fmtNum, fmtPct, fmtSignedEur } from '../lib/format';
import { AssetClass, CLASS_LABEL, METAL_LABEL, PortfolioState } from '../lib/types';
import { fromGrams } from '../lib/units';

const CLASS_COLOR: Record<AssetClass, string> = {
  metal: 'var(--series-1)',
  stock: 'var(--series-2)',
  crypto: 'var(--series-3)',
};

export function Overview({ state, onGoto }: { state: PortfolioState; onGoto: (t: 'holdings' | 'metals') => void }) {
  const s = summarize(state);
  const [hover, setHover] = useState<AssetClass | null>(null);

  if (state.holdings.length === 0) {
    return (
      <section className="card empty">
        <h2>Noch keine Positionen</h2>
        <p>Lege deine erste Position an – z. B. einen Goldbarren in Gramm, eine Aktie oder Bitcoin.</p>
        <button className="primary" onClick={() => onGoto('holdings')}>Position hinzufügen</button>
      </section>
    );
  }

  const gainClass = s.gain > 0 ? 'pos' : s.gain < 0 ? 'neg' : '';
  const max = Math.max(...s.byClass.map((c) => c.value), 1);
  const open = state.holdings.filter((h) => !valueHolding(h, state).closed);
  const closed = state.holdings.filter((h) => valueHolding(h, state).closed);
  const metals = open.filter((h) => h.assetClass === 'metal');
  const gramsByMetal = new Map<string, number>();
  for (const h of metals) {
    const v = valueHolding(h, state);
    gramsByMetal.set(h.metal!, (gramsByMetal.get(h.metal!) ?? 0) + (v.fineGrams ?? 0));
  }

  return (
    <>
      <section className="stats">
        <div className="stat">
          <div className="stat-label">Gesamtwert</div>
          <div className="stat-value">{fmtEur(s.totalValue)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Gewinn / Verlust</div>
          <div className={`stat-value ${gainClass}`}>{fmtSignedEur(s.gain)}</div>
          {s.gainPct !== undefined && <div className={`stat-sub ${gainClass}`}>{fmtPct(s.gainPct)}</div>}
        </div>
        <div className="stat">
          <div className="stat-label">Investiert</div>
          <div className="stat-value">{fmtEur(s.totalCost)}</div>
          {Math.abs(s.realized) > 0.005 && (
            <div className="stat-sub">
              Realisiert durch Verkäufe: <span className={s.realized > 0 ? 'pos' : 'neg'}>{fmtSignedEur(s.realized)}</span>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Wertverlauf</h2>
        <HistoryChart history={state.history} />
      </section>

      {s.unpriced.length > 0 && (
        <div className="banner warn">
          Ohne aktuellen Kurs (nicht im Gesamtwert): {s.unpriced.map((h) => h.name).join(', ')}.{' '}
          {s.unpriced.some((h) => h.assetClass === 'metal') && <button className="link" onClick={() => onGoto('metals')}>Edelmetallpreise öffnen</button>}
        </div>
      )}

      <section className="card">
        <h2>Aufteilung nach Anlageklasse</h2>
        <div className="bars" role="list">
          {s.byClass.map((c) => {
            const share = s.totalValue > 0 ? c.value / s.totalValue : 0;
            return (
              <div
                key={c.assetClass}
                className={`bar-row ${hover && hover !== c.assetClass ? 'dim' : ''}`}
                role="listitem"
                onMouseEnter={() => setHover(c.assetClass)}
                onMouseLeave={() => setHover(null)}
                title={`${CLASS_LABEL[c.assetClass]}: ${fmtEur(c.value)} (${fmtPct(share).replace('+', '')}), ${c.count} Position(en)`}
              >
                <div className="bar-label">
                  <span className="swatch" style={{ background: CLASS_COLOR[c.assetClass] }} />
                  {CLASS_LABEL[c.assetClass]}
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(c.value / max) * 100}%`, background: CLASS_COLOR[c.assetClass] }} />
                </div>
                <div className="bar-value">
                  {fmtEur(c.value)} <span className="muted">· {new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 }).format(share)}</span>
                </div>
              </div>
            );
          })}
        </div>
        {gramsByMetal.size > 0 && (
          <p className="muted small">
            Feingewicht gesamt:{' '}
            {[...gramsByMetal].map(([m, g]) => `${METAL_LABEL[m as keyof typeof METAL_LABEL]} ${fmtNum(g, 2)} g (${fmtNum(fromGrams(g, 'oz'), 3)} oz)`).join(' · ')}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Alle Positionen</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th className="num">Bestand</th>
                <th className="num">Kurs</th>
                <th className="num">Wert</th>
                <th className="num">Investiert</th>
                <th className="num">G/V</th>
              </tr>
            </thead>
            <tbody>
              {open.map((h) => {
                const v = valueHolding(h, state);
                const cls = v.gain === undefined ? '' : v.gain > 0 ? 'pos' : v.gain < 0 ? 'neg' : '';
                return (
                  <tr key={h.id}>
                    <td>
                      <div>{h.name}</div>
                      <div className="muted small">
                        {CLASS_LABEL[h.assetClass]}
                        {h.symbol && ` · ${h.symbol}`}
                        {h.metal && ` · ${METAL_LABEL[h.metal]} ${fmtNum(h.fineness ?? 1000, 1)}‰`}
                      </div>
                    </td>
                    <td className="num">
                      {h.assetClass === 'metal' ? (
                        <>
                          {fmtNum(v.quantity, 2)} g
                          <div className="muted small">fein {fmtNum(v.fineGrams ?? 0, 2)} g</div>
                        </>
                      ) : (
                        fmtNum(v.quantity, 8)
                      )}
                    </td>
                    <td className="num">
                      {v.unitPrice !== undefined ? (
                        <>
                          {fmtEur(v.unitPrice)}{h.assetClass === 'metal' && '/g'}
                          <div className="muted small">{v.priceSource === 'manual' ? 'manuell, ' : ''}{fmtDate(v.priceUpdatedAt)}</div>
                        </>
                      ) : '–'}
                    </td>
                    <td className="num">{v.value !== undefined ? fmtEur(v.value) : '–'}</td>
                    <td className="num">{fmtEur(v.cost)}</td>
                    <td className={`num ${cls}`}>
                      {v.gain !== undefined ? fmtSignedEur(v.gain) : '–'}
                      {v.gainPct !== undefined && <div className="small">{fmtPct(v.gainPct)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {closed.length > 0 && (
          <p className="muted small">
            Vollständig verkauft:{' '}
            {closed.map((h) => {
              const r = valueHolding(h, state).realized;
              return `${h.name} (${fmtSignedEur(r)})`;
            }).join(' · ')}
          </p>
        )}
      </section>
    </>
  );
}
