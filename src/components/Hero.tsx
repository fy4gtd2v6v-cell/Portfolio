import { fmtEur, fmtPct, fmtSignedEur } from '../lib/format';
import { PortfolioSummary } from '../lib/portfolio';
import { Category, CATEGORY_LABEL } from '../lib/types';
import { CATEGORY_COLOR, useCountUp } from './ui';

const share = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

/** The headline block: total value, gain, invested and realized amounts, and a thin split bar by asset class. */
export function Hero({ summary: s, emphasis }: { summary: PortfolioSummary; emphasis?: Category | null }) {
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
        <div className="hero-split" role="img" aria-label={s.byCategory.map((c) => `${CATEGORY_LABEL[c.category]} ${share.format(c.value / s.totalValue)}`).join(', ')}>
          {s.byCategory.filter((c) => c.value > 0).map((c) => (
            <span key={c.category} className={emphasis && emphasis !== c.category ? 'dim' : ''} title={CATEGORY_LABEL[c.category]}
              style={{ flexGrow: c.value, background: CATEGORY_COLOR[c.category] }} />
          ))}
        </div>
      )}
    </section>
  );
}
