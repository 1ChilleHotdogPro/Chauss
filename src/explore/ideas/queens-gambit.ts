import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Queen's Gambit. Each one is backed by checks against the
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
    line: ['d4', 'd5', 'c4'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2...dxc4 (38%) and 2...e6 (19%); masters mostly play 2...c6 (50%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['d4', 'd5', 'c4'], san: 'dxc4' },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4'], san: 'dxc4', min: 0.375, max: 0.385 },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4'], san: 'e6', min: 0.185, max: 0.195 },
      { kind: 'book-top', line: ['d4', 'd5', 'c4'], san: 'c6' },
      { kind: 'book-share', line: ['d4', 'd5', 'c4'], san: 'c6', min: 0.495, max: 0.505 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'dxc4'],
    text:
      'Against 2...dxc4, masters play 3.Nf3 in 51% of their games; Stockfish scores it +0.3 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'd5', 'c4', 'dxc4'], san: 'Nf3' },
      { kind: 'book-share', line: ['d4', 'd5', 'c4', 'dxc4'], san: 'Nf3', min: 0.505, max: 0.515 },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'dxc4'], san: 'Nf3', min: 0.25, max: 0.35 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'e6'],
    text:
      'Against 2...e6, masters play 3.Nc3 in 59% of their games; Stockfish scores it +0.3 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'd5', 'c4', 'e6'], san: 'Nc3' },
      { kind: 'book-share', line: ['d4', 'd5', 'c4', 'e6'], san: 'Nc3', min: 0.585, max: 0.595 },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'e6'], san: 'Nc3', min: 0.25, max: 0.35 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'c6', 'Bg5', 'h6', 'Bxf6', 'Qxf6', 'e3'],
    text:
      'After 2...e6 3.Nc3 Nf6 4.Nf3 c6 5.Bg5 h6 6.Bxf6 Qxf6 7.e3, 7...c5? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.8 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'c6', 'Bg5', 'h6', 'Bxf6', 'Qxf6', 'e3'], san: 'c5', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'c6', 'Bg5', 'h6', 'Bxf6', 'Qxf6', 'e3'], san: 'c5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'c6', 'Bg5', 'h6', 'Bxf6', 'Qxf6', 'e3'], san: 'c5', min: 2.75, max: 2.85 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'Nf3', 'dxc4', 'a4', 'Bf5', 'e3'],
    text:
      'After 2...c6 3.Nc3 Nf6 4.Nf3 dxc4 5.a4 Bf5 6.e3, 6...b5? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.7 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'Nf3', 'dxc4', 'a4', 'Bf5', 'e3'], san: 'b5', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'Nf3', 'dxc4', 'a4', 'Bf5', 'e3'], san: 'b5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'Nf3', 'dxc4', 'a4', 'Bf5', 'e3'], san: 'b5', min: 2.65, max: 2.75 },
    ],
  },
];
