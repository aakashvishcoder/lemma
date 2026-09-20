export function generateKeyBetween(a: string | undefined, b: string | undefined): string {
  if (a !== undefined && b !== undefined && a >= b) {
    throw new Error(
      `generateKeyBetween: lower bound (${JSON.stringify(a)}) must be strictly less than upper bound (${JSON.stringify(b)})`,
    );
  }
  return midpoint(a ?? '', b ?? null);
}

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length;

function charToDigit(char: string): number {
  const value = ALPHABET.indexOf(char);
  if (value === -1) {
    throw new Error(`Invalid fractional-index character: ${JSON.stringify(char)}`);
  }
  return value;
}

function digitToChar(digit: number) : string {
    if(digit >= ALPHABET.length) {
        return "";
    }
    return ALPHABET[digit];
}

function digitAt(key: string, i: number, padValue: number): number {
  return i < key.length ? charToDigit(key[i]) : padValue;
}

function midpoint(a: string, b: string | null): string {
  let result = '';

  for (let i = 0; ; i++) {
    const digA = digitAt(a, i, 0);
    const digB = b === null ? BASE : digitAt(b, i, BASE);

    if (digA === digB) {
      result += digitToChar(digA);
      continue;
    }

    const gap = digB - digA;
    if (gap > 1) {
      const mid = digA + Math.floor(gap / 2);
      return result + digitToChar(mid);
    }

    result += digitToChar(digA);
  }
}
