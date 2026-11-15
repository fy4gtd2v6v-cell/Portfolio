import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtEur } from '../lib/format';
import { Snapshot } from '../lib/types';

type Range = '1M' | '6M' | '1J' | 'all';
const RANGES: [Range, string][] = [['1M', '1 M'], ['6M', '6 M'], ['1J', '1 J'], ['all', 'Alles']];
const DAY = 86_400_000;
const RANGE_DAYS: Record<Range, number> = { '1M': 31, '6M': 183, '1J': 366, all: Infinity };

const H = 240;
const M = { top: 12, right: 16, bottom: 28, left: 64 };

const t = (d: string) => new Date(d + 'T12:00:00').getTime();
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtAxis = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });

/** "Nice" tick values covering [min, max]. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) { max = min + 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function HistoryChart({ history }: { history: Snapshot[] }) {
  const [range, setRange] = useState<Range>('all');
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    if (history.length === 0) return [];
    const end = t(history[history.length - 1].date);
    return history.filter((h) => end - t(h.date) <= RANGE_DAYS[range] * DAY);
  }, [history, range]);

  if (history.length < 2) {
    return (
      <p className="muted">
        Der Verlauf füllt sich ab jetzt automatisch: Jeden Tag, an dem du die App öffnest, wird der Gesamtwert gespeichert
        (nur wenn alle Positionen einen Kurs haben). Ab dem zweiten Tag erscheint hier das Diagramm.
      </p>
    );
  }

  const innerW = width - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const x0 = t(data[0].date);
  const x1 = Math.max(t(data[data.length - 1].date), x0 + DAY);
  const vals = data.flatMap((d) => [d.value, d.cost]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.1 || hi * 0.05 || 1;
  const ticks = niceTicks(Math.max(0, lo - pad), hi + pad);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const sx = (ms: number) => M.left + ((ms - x0) / (x1 - x0)) * innerW;
  const sy = (v: number) => M.top + innerH - ((v - y0) / (y1 - y0)) * innerH;
  const path = (key: 'value' | 'cost') => data.map((d, i) => `${i ? 'L' : 'M'}${sx(t(d.date)).toFixed(1)},${sy(d[key]).toFixed(1)}`).join('');

  const xTickCount = Math.min(data.length, Math.max(2, Math.floor(innerW / 90)));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => x0 + ((x1 - x0) * i) / (xTickCount - 1));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    data.forEach((d, i) => { if (Math.abs(sx(t(d.date)) - px) < Math.abs(sx(t(data[best].date)) - px)) best = i; });
    setHover(best);
  }

  const hp = hover !== null ? data[hover] : null;
  const first = data[0];
  const last = data[data.length - 1];
  const change = last.value - first.value;

  return (
    <div className="history">
      <div className="history-head">
        <div className="legend">
          <span><i className="legend-line" style={{ background: 'var(--series-1)' }} />Gesamtwert</span>
          <span><i className="legend-line dashed" />Investiert</span>
        </div>
        <div className="segmented small-seg" role="radiogroup" aria-label="Zeitraum">
          {RANGES.map(([r, label]) => (
            <button key={r} type="button" role="radio" aria-checked={range === r} className={range === r ? 'active' : ''} onClick={() => { setRange(r); setHover(null); }}>{label}</button>
          ))}
        </div>
      </div>
      <p className="small muted">
        {fmtDay(t(first.date))} – {fmtDay(t(last.date))}:{' '}
        <span className={change > 0 ? 'pos' : change < 0 ? 'neg' : ''}>{change > 0 ? '+' : ''}{fmtEur(change)}</span>
      </p>
      <div ref={wrap} className="chart-wrap">
        <svg width={width} height={H} role="img" aria-label={`Wertverlauf von ${fmtDay(t(first.date))} bis ${fmtDay(t(last.date))}, zuletzt ${fmtEur(last.value)}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={width - M.right} y1={sy(v)} y2={sy(v)} className="grid-line" />
              <text x={M.left - 8} y={sy(v)} className="axis-label" textAnchor="end" dominantBaseline="middle">{fmtAxis.format(v)} €</text>
            </g>
          ))}
          {xTicks.map((ms, i) => (
            <text key={i} x={sx(ms)} y={H - 8} className="axis-label" textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>{fmtDay(ms)}</text>
          ))}
          <path d={`${path('value')}L${sx(t(last.date)).toFixed(1)},${sy(y0).toFixed(1)}L${sx(x0).toFixed(1)},${sy(y0).toFixed(1)}Z`} className="area-value" />
          <path d={path('cost')} className="line-cost" />
          <path d={path('value')} className="line-value" />
          {data.length <= 40 && data.map((d) => (
            <circle key={d.date} cx={sx(t(d.date))} cy={sy(d.value)} r={2.5} className="dot-value" />
          ))}
          {hp && (
            <g pointerEvents="none">
              <line x1={sx(t(hp.date))} x2={sx(t(hp.date))} y1={M.top} y2={M.top + innerH} className="crosshair" />
              <circle cx={sx(t(hp.date))} cy={sy(hp.cost)} r={4} className="dot-cost-hover" />
              <circle cx={sx(t(hp.date))} cy={sy(hp.value)} r={5} className="dot-value-hover" />
            </g>
          )}
          <rect x={M.left} y={M.top} width={innerW} height={innerH} fill="transparent"
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hp && (
          <div className="tooltip" style={{ left: Math.min(Math.max(sx(t(hp.date)), 90), width - 90), top: 4 }}>
            <div className="tooltip-date">{fmtDay(t(hp.date))}</div>
            <div><i className="legend-line" style={{ background: 'var(--series-1)' }} />Wert <strong>{fmtEur(hp.value)}</strong></div>
            <div><i className="legend-line dashed" />Investiert {fmtEur(hp.cost)}</div>
            <div className={hp.value - hp.cost >= 0 ? 'pos' : 'neg'}>G/V {hp.value - hp.cost > 0 ? '+' : ''}{fmtEur(hp.value - hp.cost)}</div>
          </div>
        )}
      </div>
      <details className="small">
        <summary>Als Tabelle anzeigen</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Datum</th><th className="num">Wert</th><th className="num">Investiert</th><th className="num">G/V</th></tr></thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{fmtDay(t(d.date))}</td>
                  <td className="num">{fmtEur(d.value)}</td>
                  <td className="num">{fmtEur(d.cost)}</td>
                  <td className={`num ${d.value - d.cost >= 0 ? 'pos' : 'neg'}`}>{fmtEur(d.value - d.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
