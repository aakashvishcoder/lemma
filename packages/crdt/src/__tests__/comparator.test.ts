import { describe, expect, it } from 'vitest';
import { compareChars } from '../comparator';
import type { CRDTChar } from '../types';

function makeChar(overrides: Partial<CRDTChar>): CRDTChar {
  return {
    id: 'x',
    siteId: 'site-a',
    counter: 0,
    position: 'M',
    value: 'a',
    deleted: false,
    ...overrides,
  };
}

describe('compareChars', () => {
  it('orders by position first', () => {
    const a = makeChar({ id: 'a', position: 'A' });
    const b = makeChar({ id: 'b', position: 'B' });
    expect(compareChars(a, b)).toBeLessThan(0);
    expect(compareChars(b, a)).toBeGreaterThan(0);
  });

  it('breaks ties on siteId when position is equal', () => {
    const a = makeChar({ id: 'a', position: 'M', siteId: 'site-a' });
    const b = makeChar({ id: 'b', position: 'M', siteId: 'site-b' });
    expect(compareChars(a, b)).toBeLessThan(0);
    expect(compareChars(b, a)).toBeGreaterThan(0);
  });

  it('breaks ties on counter when position and siteId are equal', () => {
    const a = makeChar({ id: 'a', position: 'M', siteId: 'site-a', counter: 1 });
    const b = makeChar({ id: 'b', position: 'M', siteId: 'site-a', counter: 2 });
    expect(compareChars(a, b)).toBeLessThan(0);
  });

  it('is antisymmetric — order of arguments does not change the outcome', () => {
    const a = makeChar({ id: 'a', position: 'M', siteId: 'site-a' });
    const b = makeChar({ id: 'b', position: 'M', siteId: 'site-b' });
    expect(compareChars(a, b)).toBe(-compareChars(b, a));
  });
});