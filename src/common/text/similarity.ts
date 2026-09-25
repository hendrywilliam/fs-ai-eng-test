import { createHash } from 'node:crypto';

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input: string): Set<string> {
  const tokens = normalizeText(input).match(TOKEN_PATTERN) ?? [];

  return new Set(tokens);
}

export function fingerprint(input: string): string {
  return createHash('sha256').update(normalizeText(input)).digest('hex');
}

export function overlapRatio(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let shared = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return (2 * shared) / (leftTokens.size + rightTokens.size);
}

export function collectQueryTerms(input: string, limit = 32): string[] {
  return [...tokenize(input)].slice(0, limit);
}
