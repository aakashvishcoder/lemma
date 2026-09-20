import { describe, expect, it } from 'vitest';
import { CRDTDocument } from '../document';
import type { CRDTOp } from '../types';

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

describe('CRDT convergence', () => {
  it('converges to the same text regardless of op delivery order, including a forced concurrent tie', () => {
    const allOps: CRDTOp[] = [];

    // Four independent replicas, each typing into their own empty document
    // at the same time. Since generateKeyBetween(undefined, undefined) is
    // deterministic, their first characters will collide on `position` too
    // — this exercises the comparator's tie-break even without the
    // deliberate case below.
    ['site-a', 'site-b', 'site-c', 'site-d'].forEach((siteId, i) => {
      const doc = new CRDTDocument(siteId);
      allOps.push(...doc.localInsert(0, `site${i}-`));
    });

    // A deliberate, unambiguous concurrent tie: two replicas both start
    // from the exact same document state ("XY") and both insert at visible
    // index 1 (between X and Y) before seeing each other's edit. They will
    // compute the identical `position` string — this is exactly the case
    // comparator.ts's siteId tie-break exists to resolve.
    const shared = new CRDTDocument('shared-seed');
    const sharedOps = shared.localInsert(0, 'XY');
    allOps.push(...sharedOps);

    const replicaOne = new CRDTDocument('site-tie-1');
    replicaOne.loadSnapshot(shared.getSnapshot());
    const replicaTwo = new CRDTDocument('site-tie-2');
    replicaTwo.loadSnapshot(shared.getSnapshot());

    allOps.push(...replicaOne.localInsert(1, 'A'));
    allOps.push(...replicaTwo.localInsert(1, 'B'));

    const results = new Set<string>();
    for (let trial = 0; trial < 20; trial++) {
      const observer = new CRDTDocument(`observer-${trial}`);
      for (const op of shuffle(allOps)) {
        observer.applyOp(op);
      }
      results.add(observer.toString());
    }

    // Regardless of how the 28 ops above were shuffled before delivery,
    // every observer must land on the exact same final text.
    expect(results.size).toBe(1);
  });
});
