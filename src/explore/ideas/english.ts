import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the English Opening. Each one is backed by checks against the
 * bundled data (see ideas.ts): every number and claim in a text has a check, and a remark whose
 * checks fail is not shown. Percentages are checked to the whole percent shown; scores to one
 * decimal, from White's point of view.
 *
 * Drafted by scripts/draft-ideas.ts from the snapshot of 23 Nov 2026 (Lichess 1000-1399,
 * blitz/rapid/classical; Stockfish 19 Lite WASM, depth 18) and read
 * through by hand — not written from memory.
 */
export const IDEAS: readonly Idea[] = [
  {
    line: ['c4'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 1...e5 (47%) and 1...d5 (12%); masters mostly play 1...Nf6 (28%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['c4'], san: 'e5' },
      { kind: 'popular-share', line: ['c4'], san: 'e5', min: 0.465, max: 0.475 },
      { kind: 'popular-share', line: ['c4'], san: 'd5', min: 0.115, max: 0.125 },
      { kind: 'book-top', line: ['c4'], san: 'Nf6' },
      { kind: 'book-share', line: ['c4'], san: 'Nf6', min: 0.275, max: 0.285 },
    ],
  },
  {
    line: ['c4', 'e5'],
    text:
      'Against 1...e5, masters play 2.Nc3 in 62% of their games; Stockfish scores it +0.1 for White.',
    checks: [
      { kind: 'book-top', line: ['c4', 'e5'], san: 'Nc3' },
      { kind: 'book-share', line: ['c4', 'e5'], san: 'Nc3', min: 0.615, max: 0.625 },
      { kind: 'move-score', line: ['c4', 'e5'], san: 'Nc3', min: 0.05, max: 0.15 },
    ],
  },
];
