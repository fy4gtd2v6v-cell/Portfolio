import { describe, expect, it } from 'vitest';
import { depotBadge } from './depotBadge';

describe('depotBadge', () => {
  it('knows the common providers', () => {
    expect(depotBadge('Trade Republic').text).toBe('TR');
    expect(depotBadge('ING').text).toBe('ING');
    expect(depotBadge('ING-DiBa Depot').text).toBe('ING');
    expect(depotBadge('Sparkasse KölnBonn').text).toBe('S');
    expect(depotBadge('Flexgold').text).toBe('FG');
  });
  it('does not mistake words that merely contain "ing"', () => {
    expect(depotBadge('Tagesgeld Banking').text).toBe('TB');
  });
  it('falls back to initials in a stable colour', () => {
    const a = depotBadge('Meine Bank');
    expect(a.text).toBe('MB');
    expect(depotBadge('Meine Bank').bg).toBe(a.bg);
    expect(depotBadge('Ohne Depot').text).toBe('OD');
  });
});
