import { describe, expect, it} from 'vitest';
import { generateKeyBetween } from '../fractionalIndex';

describe('generateKeyBetween', () => {
    it('generates a key with no bounds', () => {
        const key = generateKeyBetween(undefined, undefined);
        expect(key.length).toBeGreaterThan(0);
    });    
    it('generates a key strictly after a lower bound', () => {
        const a = generateKeyBetween(undefined, undefined);
        const b = generateKeyBetween(a, undefined);
        expect(b > a).toBe(true);
    });

    it('generates a key strictly before an upper bound', ()=>{
        const b = generateKeyBetween(undefined, undefined);
        const a = generateKeyBetween(undefined, b);
        expect(a < b).toBe(true);
    });

    it('generates a key strictly between two bounds', () => {
        const mid = generateKeyBetween('A', 'Z');
        expect(mid > 'A').toBe(true);
        expect(mid < 'Z').toBe(true);
    });

    it('throws if lower bound is not strictly less than upper bound', () => {
        expect(()=> generateKeyBetween('M', 'M')).toThrow();
        expect(() => generateKeyBetween('N', 'M')).toThrow();
    });

    it('never produces a key with a trailing zero digit', () => {
        let lo: string | undefined = undefined;
        let hi: string | undefined = undefined;

        for(let i = 0; i < 200; i++) {
            const key = generateKeyBetween(lo, hi);
            expect(key.endsWith('0')).toBe(false);
            if (i % 2 == 0) lo = key;
            else hi = key;
        }
    });

    it('can always subdivide the same arbitrality many times', () => {
        let lo = generateKeyBetween(undefined, undefined);
        const hi = generateKeyBetween(lo, undefined);
        for (let i = 0; i < 500; i++) {
            const mid = generateKeyBetween(lo, hi);
            expect(mid > lo).toBe(true);
            expect(mid < hi).toBe(true);
            lo = mid;
        }
    });
});