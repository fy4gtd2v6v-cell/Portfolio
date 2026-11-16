import { useState } from 'react';
import { fmtEur } from '../lib/format';

export interface Slice {
  id: string;
  label: string;
  value: number;
  /** CSS colour */
  color: string;
  /** shown under the label in the legend */
  hint?: string;
}

const share = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });
const SIZE = 240;
const R_OUT = 108;
const R_IN = 70;
const GAP = 2; // px of surface between neighbouring slices

function point(r: number, angle: number): string {
  return `${(SIZE / 2 + r * Math.sin(angle)).toFixed(2)},${(SIZE / 2 - r * Math.cos(angle)).toFixed(2)}`;
}

/** Ring segment from angle a0 to a1 (radians, clockwise from 12 o'clock), with a constant-width gap on both ends. */
function arc(a0: number, a1: number, rOut: number): string {
  const padOut = GAP / 2 / rOut;
  const padIn = GAP / 2 / R_IN;
  const [o0, o1, i0, i1] = [a0 + padOut, a1 - padOut, a0 + padIn, a1 - padIn];
  if (o1 <= o0 || i1 <= i0) return '';
  const large = o1 - o0 > Math.PI ? 1 : 0;
  return `M${point(rOut, o0)}A${rOut},${rOut} 0 ${large} 1 ${point(rOut, o1)}L${point(R_IN, i1)}A${R_IN},${R_IN} 0 ${large} 0 ${point(R_IN, i0)}Z`;
}

/**
 * Donut chart with a linked legend. Hovering or focusing a slice or its legend
 * row highlights both and shows that slice in the centre; a click selects it.
 */
export function Donut({ slices, totalLabel, onSelect }: { slices: Slice[]; totalLabel: string; onSelect?: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <p className="muted">Noch keine bewerteten Positionen.</p>;

  let angle = 0;
  const arcs = slices.map((s) => {
    const a0 = angle;
    angle += (s.value / total) * Math.PI * 2;
    return { ...s, a0, a1: angle };
  });
  const shown = arcs.find((a) => a.id === active);
  const single = arcs.length === 1;

  return (
    <div className="donut">
      <div className="donut-chart">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Aufteilung: ${slices.map((s) => `${s.label} ${share.format(s.value / total)}`).join(', ')}`}>
          {arcs.map((a) => {
            const on = active === a.id;
            const props = {
              className: `donut-slice ${active && !on ? 'dim' : ''} ${onSelect ? 'clickable' : ''}`,
              fill: a.color,
              onMouseEnter: () => setActive(a.id),
              onMouseLeave: () => setActive(null),
              onClick: () => onSelect?.(a.id),
            };
            return single ? (
              <path key={a.id} {...props} fillRule="evenodd"
                d={`M${SIZE / 2},${SIZE / 2 - R_OUT}a${R_OUT},${R_OUT} 0 1 1 -0.01,0ZM${SIZE / 2},${SIZE / 2 - R_IN}a${R_IN},${R_IN} 0 1 0 0.01,0Z`} />
            ) : (
              <path key={a.id} {...props} d={arc(a.a0, a.a1, on ? R_OUT + 6 : R_OUT)} />
            );
          })}
        </svg>
        <div className="donut-center" aria-hidden="true">
          <div className="donut-center-label">{shown ? shown.label : totalLabel}</div>
          <div className="donut-center-value">{fmtEur(shown ? shown.value : total)}</div>
          {shown && <div className="donut-center-share">{share.format(shown.value / total)}</div>}
        </div>
      </div>
      <ul className="donut-legend">
        {arcs.map((a) => {
          const row = (
            <>
              <span className="swatch" style={{ background: a.color }} />
              <span className="donut-legend-label">
                {a.label}
                {a.hint && <span className="muted small">{a.hint}</span>}
              </span>
              <span className="donut-legend-value">
                {share.format(a.value / total)}
                <span className="muted small">{fmtEur(a.value)}</span>
              </span>
            </>
          );
          const cls = `donut-legend-row ${active === a.id ? 'active' : ''} ${active && active !== a.id ? 'dim' : ''}`;
          return (
            <li key={a.id} onMouseEnter={() => setActive(a.id)} onMouseLeave={() => setActive(null)}>
              {onSelect ? (
                <button type="button" className={cls} onClick={() => onSelect(a.id)} onFocus={() => setActive(a.id)} onBlur={() => setActive(null)}>{row}</button>
              ) : (
                <div className={cls}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
