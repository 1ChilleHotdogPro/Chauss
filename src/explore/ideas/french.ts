import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the French Defence. Each one is backed by checks against the
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
    line: ['e4', 'e6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2.Nf3 (35%) and 2.d4 (33%); masters mostly play 2.d4 (90%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e6'], san: 'Nf3' },
      { kind: 'popular-share', line: ['e4', 'e6'], san: 'Nf3', min: 0.345, max: 0.355 },
      { kind: 'popular-share', line: ['e4', 'e6'], san: 'd4', min: 0.325, max: 0.335 },
      { kind: 'book-top', line: ['e4', 'e6'], san: 'd4' },
      { kind: 'book-share', line: ['e4', 'e6'], san: 'd4', min: 0.895, max: 0.905 },
    ],
  },
  {
    line: ['e4', 'e6', 'd4'],
    text:
      'Against 2.d4, masters play 2...d5 in 99% of their games; Stockfish scores it +0.4 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e6', 'd4'], san: 'd5' },
      { kind: 'book-share', line: ['e4', 'e6', 'd4'], san: 'd5', min: 0.985, max: 0.995 },
      { kind: 'move-score', line: ['e4', 'e6', 'd4'], san: 'd5', min: 0.35, max: 0.45 },
    ],
  },
  {
    line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'dxe4', 'Nxe4', 'Be7'],
    text:
      'After 2.d4 d5 3.Nc3 Nf6 4.Bg5 dxe4 5.Nxe4 Be7, 6.Qf3?? is played in 10% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +3.3 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'dxe4', 'Nxe4', 'Be7'], san: 'Qf3', min: 0.095, max: 0.105 },
      { kind: 'flagged', line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'dxe4', 'Nxe4', 'Be7'], san: 'Qf3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'dxe4', 'Nxe4', 'Be7'], san: 'Qf3', min: -3.35, max: -3.25 },
    ],
  },
  {
    line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e5', 'Nfd7'],
    text:
      'After 2.d4 d5 3.Nc3 Nf6 4.Bg5 Be7 5.e5 Nfd7, 6.Nf3?? is played in 8% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.2 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e5', 'Nfd7'], san: 'Nf3', min: 0.075, max: 0.085 },
      { kind: 'flagged', line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e5', 'Nfd7'], san: 'Nf3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e5', 'Nfd7'], san: 'Nf3', min: -5.25, max: -5.15 },
    ],
  },
  {
    line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'dxe4', 'Nxe4', 'Be7', 'Bxf6', 'gxf6'],
    text:
      'After 2.d4 d5 3.Nc3 Nf6 4.Bg5 dxe4 5.Nxe4 Be7 6.Bxf6 gxf6, 7.Qf3? is played in 5% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.2 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'dxe4', 'Nxe4', 'Be7', 'Bxf6', 'gxf6'], san: 'Qf3', min: 0.045, max: 0.055 },
      { kind: 'flagged', line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'dxe4', 'Nxe4', 'Be7', 'Bxf6', 'gxf6'], san: 'Qf3', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'dxe4', 'Nxe4', 'Be7', 'Bxf6', 'gxf6'], san: 'Qf3', min: -2.25, max: -2.15 },
    ],
  },
];
