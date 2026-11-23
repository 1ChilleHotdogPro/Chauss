import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Slav Defence. Each one is backed by checks against the
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
    line: ['d4', 'd5', 'c4', 'c6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3.Nc3 (45%) and 3.Nf3 (16%); masters mostly play 3.Nf3 (64%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['d4', 'd5', 'c4', 'c6'], san: 'Nc3' },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4', 'c6'], san: 'Nc3', min: 0.445, max: 0.455 },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4', 'c6'], san: 'Nf3', min: 0.155, max: 0.165 },
      { kind: 'book-top', line: ['d4', 'd5', 'c4', 'c6'], san: 'Nf3' },
      { kind: 'book-share', line: ['d4', 'd5', 'c4', 'c6'], san: 'Nf3', min: 0.635, max: 0.645 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'c6', 'Nc3'],
    text:
      'Against 3.Nc3, masters play 3...Nf6 in 89% of their games; Stockfish scores it +0.3 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'd5', 'c4', 'c6', 'Nc3'], san: 'Nf6' },
      { kind: 'book-share', line: ['d4', 'd5', 'c4', 'c6', 'Nc3'], san: 'Nf6', min: 0.885, max: 0.895 },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'c6', 'Nc3'], san: 'Nf6', min: 0.25, max: 0.35 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'c6', 'Nf3'],
    text:
      'Against 3.Nf3, masters play 3...Nf6 in 92% of their games; Stockfish scores it +0.3 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'd5', 'c4', 'c6', 'Nf3'], san: 'Nf6' },
      { kind: 'book-share', line: ['d4', 'd5', 'c4', 'c6', 'Nf3'], san: 'Nf6', min: 0.915, max: 0.925 },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'c6', 'Nf3'], san: 'Nf6', min: 0.25, max: 0.35 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'cxd5', 'cxd5', 'Bf4', 'Nc6'],
    text:
      'After 3.Nc3 Nf6 4.cxd5 cxd5 5.Bf4 Nc6, 6.Nb5? is played in 16% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.1 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'cxd5', 'cxd5', 'Bf4', 'Nc6'], san: 'Nb5', min: 0.155, max: 0.165 },
      { kind: 'flagged', line: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'cxd5', 'cxd5', 'Bf4', 'Nc6'], san: 'Nb5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'cxd5', 'cxd5', 'Bf4', 'Nc6'], san: 'Nb5', min: -2.15, max: -2.05 },
    ],
  },
];
