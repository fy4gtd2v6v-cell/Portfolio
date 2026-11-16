import { describe, expect, it } from 'vitest';
import { inRange } from './HistoryChart';
import { Snapshot } from '../lib/types';

const snap = (date: string): Snapshot => ({ date, value: 1, cost: 1, byClass: {} });
const history = ['2025-11-20', '2025-12-31', '2026-01-01', '2026-05-10', '2026-08-20', '2026-10-20', '2026-11-08', '2026-11-10', '2026-11-16'].map(snap);
const dates = (r: Parameters<typeof inRange>[1]) => inRange(history, r).map((h) => h.date);

describe('inRange', () => {
  it('counts back from the newest snapshot', () => {
    expect(dates('1W')).toEqual(['2026-11-10', '2026-11-16']);
    expect(dates('1M')).toEqual(['2026-10-20', '2026-11-08', '2026-11-10', '2026-11-16']);
    expect(dates('3M')).toEqual(['2026-08-20', '2026-10-20', '2026-11-08', '2026-11-10', '2026-11-16']);
    expect(dates('6M')[0]).toBe('2026-08-20');
    expect(dates('1J')[0]).toBe('2025-11-20');
    expect(dates('all')).toHaveLength(history.length);
  });
  it('YTD starts on January 1st of the newest snapshot\'s year', () => {
    expect(dates('YTD')[0]).toBe('2026-01-01');
    expect(dates('YTD')).not.toContain('2025-12-31');
  });
  it('handles an empty history', () => {
    expect(inRange([], '1M')).toEqual([]);
  });
});
