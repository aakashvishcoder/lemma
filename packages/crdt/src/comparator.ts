import type { CRDTChar } from './types';

export function compareChars(a: CRDTChar, b: CRDTChar) : number {
    if (a.position !== b.position) {
        return a.position < b.position ? -1: 1;
    }
    if (a.siteId!== b.siteId) {
        return a.siteId < b.siteId? -1: 1;
    }
    return a.counter - b.counter;
}
