const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const pct = new Intl.NumberFormat('de-DE', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' });

export const fmtEur = (n: number) => eur.format(n);
export const fmtPct = (n: number) => pct.format(n);
export const fmtSignedEur = (n: number) => (n > 0 ? '+' : '') + eur.format(n);

export function fmtNum(n: number, maxDigits = 4): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: maxDigits }).format(n);
}

export function fmtDate(iso?: string): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

/** Accepts German ("1.234,56") and plain ("1234.56") number input. */
export function parseNum(s: string): number {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return NaN;
  // German notation: "." groups thousands, "," is the decimal separator.
  // Without a comma, "2.500" (groups of three digits) is still read as 2500.
  const germanThousands = /^-?\d{1,3}(\.\d{3})+$/.test(t);
  const normalized = t.includes(',') || germanThousands ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(normalized);
}

export const today = () => new Date().toISOString().slice(0, 10);
