import { fmtEur, fmtPct, fmtSignedEur } from '../lib/format';
import { PortfolioSummary } from '../lib/portfolio';
import { AssetClass, CLASS_LABEL } from '../lib/types';
import { CLASS_COLOR, useCountUp } from './ui';

const share = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

/** The headline block: total value, gain, invested and realized amounts, and a thin split bar by asset class. */
export function Hero({ summary: s, emphasis }: { summary: PortfolioSummary; emphasis?: AssetClass | null }) {
  const total = useCountUp(s.totalValue);
  const gainClass = s.gain > 0 ? 'pos' : s.gain < 0 ? 'neg' : '';
  return (
    <section className="hero stats">
      <div className="hero-main">
        <div className="hero-label">Gesamtvermögen</div>
        <div className="hero-value" aria-label={fmtEur(s.totalValue)}>{fmtEur(total)}</div>
        <div className={`chip ${gainClass}`} title="Gewinn / Verlust der offenen Positionen">
          <span aria-hidden="true">{s.gain > 0 ? '▲' : s.gain < 0 ? '▼' : '•'}</span>
          {fmtSignedEur(s.gain)}
          {s.gainPct !== undefined && <span> · {fmtPct(s.gainPct)}</span>}
        </div>
      </div>
      <div className="hero-side">
        <div>
          <div className="hero-label">Investiert</div>
          <div className="hero-num">{fmtEur(s.totalCost)}</div>
        </div>
        <div>
          <div className="hero-label">Realisiert</div>
          <div className={`hero-num ${s.realized > 0.005 ? 'pos' : s.realized < -0.005 ? 'neg' : ''}`}>
            {Math.abs(s.realized) > 0.005 ? fmtSignedEur(s.realized) : fmtEur(0)}
          </div>
        </div>
      </div>
      {s.totalValue > 0 && (
        <div className="hero-split" role="img" aria-label={s.byClass.map((c) => `${CLASS_LABEL[c.assetClass]} ${share.format(c.value / s.totalValue)}`).join(', ')}>
          {s.byClass.filter((c) => c.value > 0).map((c) => (
            <span key={c.assetClass} className={emphasis && emphasis !== c.assetClass ? 'dim' : ''}
              style={{ flexGrow: c.value, background: CLASS_COLOR[c.assetClass] }} />
          ))}
        </div>
      )}
    </section>
  );
}
