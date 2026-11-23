import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Italian Game. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3...Nf6 (34%) and 3...Bc5 (25%); masters mostly play 3...Bc5 (52%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], san: 'Nf6' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], san: 'Nf6', min: 0.335, max: 0.345 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], san: 'Bc5', min: 0.245, max: 0.255 },
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], san: 'Bc5' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], san: 'Bc5', min: 0.515, max: 0.525 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
    text:
      'Against 3...Nf6, masters play 4.d3 in 74% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], san: 'd3' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], san: 'd3', min: 0.735, max: 0.745 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], san: 'd3', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
    text:
      'Against 3...Bc5, masters play 4.c3 in 56% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], san: 'c3' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], san: 'c3', min: 0.555, max: 0.565 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], san: 'c3', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'],
    text:
      'After 3...Nf6 4.Ng5, 4...Qe7? is played in 6% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.4 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'Qe7', min: 0.055, max: 0.065 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'Qe7', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'Qe7', min: 2.35, max: 2.45 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4'],
    text:
      'After 3...Bc5 4.c3 Nf6 5.d4 exd4 6.cxd4, 6...Nxd4?? is played in 7% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +4.1 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4'], san: 'Nxd4', min: 0.065, max: 0.075 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4'], san: 'Nxd4', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4'], san: 'Nxd4', min: 4.05, max: 4.15 },
    ],
  },
];
