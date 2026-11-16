import { useEffect, useRef, useState } from 'react';
import { AssetClass } from '../lib/types';

export const CLASS_COLOR: Record<AssetClass, string> = {
  metal: 'var(--c-metal)',
  stock: 'var(--c-stock)',
  crypto: 'var(--c-crypto)',
};

const svg = (children: React.ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const Icon = {
  home: () => svg(<><path d="M3 11l9-7 9 7" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></>),
  live: () => svg(<path d="M3 12h4l2.5-7 4 14 2.5-7h5" />),
  holdings: () => svg(<><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>),
  metals: () => svg(<><path d="M7 8h10l4 10H3L7 8z" /><path d="M9.5 8l1-3h3l1 3" /></>),
  settings: () => svg(<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>),
  plus: () => svg(<path d="M12 5v14M5 12h14" />),
  refresh: () => svg(<><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 20v-4h-4" /></>),
  lock: () => svg(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  close: () => svg(<path d="M6 6l12 12M18 6L6 18" />),
  metal: () => svg(<><path d="M7 9h10l4 9H3l4-9z" /><path d="M9 13h6" /></>, 16),
  stock: () => svg(<><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15l4-5 3 3 4-6" /></>, 16),
  crypto: () => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M9.5 8h4a2 2 0 0 1 0 4h-4zM9.5 12h4.5a2 2 0 0 1 0 4H9.5zM9.5 8v8M11 6.5V8M11 16v1.5" /></>, 16),
};

/** Tinted square with the symbol of an asset class. */
export function ClassIcon({ assetClass, large }: { assetClass: AssetClass; large?: boolean }) {
  const Glyph = Icon[assetClass];
  return (
    <span className={`class-icon ${large ? 'large' : ''}`} style={{ '--c': CLASS_COLOR[assetClass] } as React.CSSProperties}>
      <Glyph />
    </span>
  );
}

/** Animates towards `target` whenever it changes. Jumps directly when the user prefers reduced motion. */
export function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - p) ** 3;
      const v = start + (target - start) * eased;
      from.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** Centered dialog on a dimmed backdrop. Closes on Escape and on a click outside. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card dialog">
        <div className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen"><Icon.close /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
