import { describe, expect, it } from 'vitest';
import { CRDTDocument } from '../document';

describe('CRDTDocument', () => {
  it('inserts text and renders it in order', () => {
    const doc = new CRDTDocument('site-a');
    doc.localInsert(0, 'hello');
    expect(doc.toString()).toBe('hello');
  });

  it('inserts in the middle correctly', () => {
    const doc = new CRDTDocument('site-a');
    doc.localInsert(0, 'helo');
    doc.localInsert(3, 'l');
    expect(doc.toString()).toBe('hello');
  });

  it('deletes visible text but keeps the tombstone internally', () => {
    const doc = new CRDTDocument('site-a');
    doc.localInsert(0, 'hello');
    doc.localDelete(0, 1);
    expect(doc.toString()).toBe('ello');
    expect(doc.getSnapshot()).toHaveLength(5); // tombstone still counted
  });

  it('round-trips through getSnapshot/loadSnapshot', () => {
    const doc = new CRDTDocument('site-a');
    doc.localInsert(0, 'hello');
    doc.localDelete(0, 1);

    const fresh = new CRDTDocument('site-b');
    fresh.loadSnapshot(doc.getSnapshot());
    expect(fresh.toString()).toBe(doc.toString());
  });

  it('applying the same insert op twice does not duplicate the character', () => {
    const doc = new CRDTDocument('site-a');
    const [op] = doc.localInsert(0, 'a');
    const before = doc.toString();
    doc.applyOp(op);
    expect(doc.toString()).toBe(before);
    expect(doc.getSnapshot()).toHaveLength(1);
  });

  it('applies a remote insert between two local characters', () => {
    const a = new CRDTDocument('site-a');
    a.localInsert(0, 'ac');

    const b = new CRDTDocument('site-b');
    b.loadSnapshot(a.getSnapshot());
    const [insertB] = b.localInsert(1, 'b');

    a.applyOp(insertB);
    expect(a.toString()).toBe('abc');
  });
});