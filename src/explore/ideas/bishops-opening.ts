import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Bishop's Opening. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Bc4'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2...Nf6 (36%) and 2...Nc6 (27%); it is also the masters’ choice (83%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Bc4'], san: 'Nf6' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Bc4'], san: 'Nf6', min: 0.355, max: 0.365 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Bc4'], san: 'Nc6', min: 0.265, max: 0.275 },
      { kind: 'book-top', line: ['e4', 'e5', 'Bc4'], san: 'Nf6' },
      { kind: 'book-share', line: ['e4', 'e5', 'Bc4'], san: 'Nf6', min: 0.825, max: 0.835 },
    ],
  },
  {
    line: ['e4', 'e5', 'Bc4', 'Nf6'],
    text:
      'Against 2...Nf6, masters play 3.d3 in 86% of their games; Stockfish scores it about equal.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Bc4', 'Nf6'], san: 'd3' },
      { kind: 'book-share', line: ['e4', 'e5', 'Bc4', 'Nf6'], san: 'd3', min: 0.855, max: 0.865 },
      { kind: 'move-score', line: ['e4', 'e5', 'Bc4', 'Nf6'], san: 'd3', min: -0.05, max: 0.05 },
    ],
  },
  {
    line: ['e4', 'e5', 'Bc4', 'Nc6'],
    text:
      'Against 2...Nc6, masters play 3.Nf3 in 46% of their games; Stockfish scores it +0.1 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Bc4', 'Nc6'], san: 'Nf3' },
      { kind: 'book-share', line: ['e4', 'e5', 'Bc4', 'Nc6'], san: 'Nf3', min: 0.455, max: 0.465 },
      { kind: 'move-score', line: ['e4', 'e5', 'Bc4', 'Nc6'], san: 'Nf3', min: 0.05, max: 0.15 },
    ],
  },
  {
    line: ['e4', 'e5', 'Bc4', 'Nf6', 'd3', 'Bc5', 'Nc3'],
    text:
      'After 2...Nf6 3.d3 Bc5 4.Nc3, 4...Ng4?? is played in 6% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +6.4 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Bc4', 'Nf6', 'd3', 'Bc5', 'Nc3'], san: 'Ng4', min: 0.055, max: 0.065 },
      { kind: 'flagged', line: ['e4', 'e5', 'Bc4', 'Nf6', 'd3', 'Bc5', 'Nc3'], san: 'Ng4', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Bc4', 'Nf6', 'd3', 'Bc5', 'Nc3'], san: 'Ng4', min: 6.35, max: 6.45 },
    ],
  },
  {
    line: ['e4', 'e5', 'Bc4', 'Nf6', 'd4', 'exd4', 'Nf3', 'Nxe4', 'Qxd4'],
    text:
      'After 2...Nf6 3.d4 exd4 4.Nf3 Nxe4 5.Qxd4, 5...Nd6? is played in 20% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.8 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Bc4', 'Nf6', 'd4', 'exd4', 'Nf3', 'Nxe4', 'Qxd4'], san: 'Nd6', min: 0.195, max: 0.205 },
      { kind: 'flagged', line: ['e4', 'e5', 'Bc4', 'Nf6', 'd4', 'exd4', 'Nf3', 'Nxe4', 'Qxd4'], san: 'Nd6', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Bc4', 'Nf6', 'd4', 'exd4', 'Nf3', 'Nxe4', 'Qxd4'], san: 'Nd6', min: 2.75, max: 2.85 },
    ],
  },
];
