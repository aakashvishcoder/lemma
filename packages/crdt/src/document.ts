import type { CRDTChar, CRDTOp, InsertOp, DeleteOp } from './types';
import { compareChars } from './comparator';
import { generateKeyBetween } from './fractionalIndex';

export class CRDTDocument {
  private chars: CRDTChar[] = [];
  private byId = new Map<string, CRDTChar>();
  private counter = 0;

  constructor(private readonly siteId: string) {}

  private visibleChars(): CRDTChar[] {
    return this.chars.filter((c) => !c.deleted);
  }

  private findInsertionIndex(char: CRDTChar): number {
    let lo = 0;
    let hi = this.chars.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (compareChars(this.chars[mid], char) < 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  private insertChar(char: CRDTChar): void {
    if (this.byId.has(char.id)) return;
    const index = this.findInsertionIndex(char);
    this.chars.splice(index, 0, char);
    this.byId.set(char.id, char);
  }

  localInsert(visibleIndex: number, text: string): InsertOp[] {
    const ops: InsertOp[] = [];
    let index = visibleIndex;
    for (const value of text) {
      const visible = this.visibleChars();
      const left = visible[index - 1];
      const right = visible[index];
      const position = generateKeyBetween(left?.position, right?.position);
      const counter = this.counter++;
      const char: CRDTChar = {
        id: `${this.siteId}:${counter}`,
        siteId: this.siteId,
        counter,
        position,
        value,
        deleted: false,
      };
      this.insertChar(char);
      ops.push({ type: 'insert', char });
      index++;
    }
    return ops;
  }

  localDelete(visibleIndex: number, length: number): DeleteOp[] {
    const ops: DeleteOp[] = [];
    const visible = this.visibleChars();
    const targets = visible.slice(visibleIndex, visibleIndex + length);
    for (const char of targets) {
      char.deleted = true;
      ops.push({ type: 'delete', id: char.id });
    }
    return ops;
  }

  applyOp(op: CRDTOp): void {
    if (op.type === 'insert') {
      this.insertChar(op.char);
    } else {
      const char = this.byId.get(op.id);
      if (char) char.deleted = true;
    }
  }

  toString(): string {
    return this.visibleChars()
      .map((c) => c.value)
      .join('');
  }

  getSnapshot(): CRDTChar[] {
    return this.chars.map((c) => ({ ...c }));
  }

  loadSnapshot(chars: CRDTChar[]): void {
    this.chars = [...chars].sort(compareChars);
    this.byId = new Map(this.chars.map((c) => [c.id, c]));
    this.counter = this.chars
      .filter((c) => c.siteId === this.siteId)
      .reduce((max, c) => Math.max(max, c.counter + 1), 0);
  }
}
