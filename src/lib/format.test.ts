import { describe, expect, it } from 'vitest';
import { parseNum } from './format';

describe('parseNum', () => {
  it('parses German and plain notation', () => {
    expect(parseNum('1.234,56')).toBe(1234.56);
    expect(parseNum('31,1')).toBe(31.1);
    expect(parseNum('1234.5')).toBe(1234.5);
    expect(parseNum('2.500')).toBe(2500);
    expect(parseNum('1.234.567')).toBe(1234567);
    expect(parseNum('0.05')).toBe(0.05);
    expect(parseNum('')).toBeNaN();
    expect(parseNum('abc')).toBeNaN();
  });
});
