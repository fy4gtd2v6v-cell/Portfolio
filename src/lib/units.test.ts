import { describe, expect, it } from 'vitest';
import { fineGrams, fromGrams, pricePerGram, pricePerUnit, toGrams } from './units';

describe('units', () => {
  it('converts troy ounces and kilograms to grams', () => {
    expect(toGrams(1, 'oz')).toBeCloseTo(31.1034768, 7);
    expect(toGrams(2.5, 'kg')).toBe(2500);
    expect(fromGrams(31.1034768, 'oz')).toBeCloseTo(1, 10);
  });
  it('converts prices between units', () => {
    expect(pricePerGram(3110.34768, 'oz')).toBeCloseTo(100, 6);
    expect(pricePerUnit(100, 'kg')).toBe(100000);
  });
  it('computes fine weight from fineness', () => {
    // Krugerrand: 33.93 g at 916.7 per mille ≈ 1 oz fine gold
    expect(fineGrams(33.93, 916.7)).toBeCloseTo(31.10, 1);
  });
});
