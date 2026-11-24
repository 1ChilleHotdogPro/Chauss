import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Dutch Defence. Each one is backed by checks against the
 * bundled data (see ideas.ts): every number and claim in a text has a check, and a remark whose
 * checks fail is not shown. Percentages are checked to the whole percent shown; scores to one
 * decimal, from White's point of view.
 *
 * Drafted by scripts/draft-ideas.ts from the snapshot of 24 Nov 2026 (Lichess 1000-1399,
 * blitz/rapid/classical; Stockfish 19 Lite WASM, depth 18) and read
 * through by hand — not written from memory.
 */
export const IDEAS: readonly Idea[] = [
  {
    line: ['d4', 'f5'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2.Bf4 (24%) and 2.c4 (23%); masters mostly play 2.g3 (41%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['d4', 'f5'], san: 'Bf4' },
      { kind: 'popular-share', line: ['d4', 'f5'], san: 'Bf4', min: 0.235, max: 0.245 },
      { kind: 'popular-share', line: ['d4', 'f5'], san: 'c4', min: 0.225, max: 0.235 },
      { kind: 'book-top', line: ['d4', 'f5'], san: 'g3' },
      { kind: 'book-share', line: ['d4', 'f5'], san: 'g3', min: 0.405, max: 0.415 },
    ],
  },
  {
    line: ['d4', 'f5', 'c4'],
    text:
      'Against 2.c4, masters play 2...Nf6 in 88% of their games; Stockfish scores it +0.4 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'f5', 'c4'], san: 'Nf6' },
      { kind: 'book-share', line: ['d4', 'f5', 'c4'], san: 'Nf6', min: 0.875, max: 0.885 },
      { kind: 'move-score', line: ['d4', 'f5', 'c4'], san: 'Nf6', min: 0.35, max: 0.45 },
    ],
  },
];
