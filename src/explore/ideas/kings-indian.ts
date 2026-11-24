import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the King's Indian Defence. Each one is backed by checks against the
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
    line: ['d4', 'Nf6', 'c4', 'g6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3.Nc3 (61%) and 3.Nf3 (15%); it is also the masters’ choice (80%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['d4', 'Nf6', 'c4', 'g6'], san: 'Nc3' },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6'], san: 'Nc3', min: 0.605, max: 0.615 },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6'], san: 'Nf3', min: 0.145, max: 0.155 },
      { kind: 'book-top', line: ['d4', 'Nf6', 'c4', 'g6'], san: 'Nc3' },
      { kind: 'book-share', line: ['d4', 'Nf6', 'c4', 'g6'], san: 'Nc3', min: 0.795, max: 0.805 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'd5', 'd6'],
    text:
      'After 3.e3 Bg7 4.Nf3 O-O 5.Nc3 c5 6.d5 d6, 7.b3?? is played in 5% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +3.3 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'd5', 'd6'], san: 'b3', min: 0.045, max: 0.055 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'd5', 'd6'], san: 'b3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'd5', 'd6'], san: 'b3', min: -3.35, max: -3.25 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'd5', 'e6'],
    text:
      'After 3.e3 Bg7 4.Nf3 O-O 5.Nc3 c5 6.d5 e6, 7.b3?? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +3.7 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'd5', 'e6'], san: 'b3', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'd5', 'e6'], san: 'b3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'd5', 'e6'], san: 'b3', min: -3.75, max: -3.65 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'c5', 'Nc3', 'cxd4', 'exd4', 'd5', 'Bg5', 'Ne4'],
    text:
      'After 3.e3 Bg7 4.Nf3 c5 5.Nc3 cxd4 6.exd4 d5 7.Bg5 Ne4, 8.Nxe4? is played in 46% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.8 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'c5', 'Nc3', 'cxd4', 'exd4', 'd5', 'Bg5', 'Ne4'], san: 'Nxe4', min: 0.455, max: 0.465 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'c5', 'Nc3', 'cxd4', 'exd4', 'd5', 'Bg5', 'Ne4'], san: 'Nxe4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'c5', 'Nc3', 'cxd4', 'exd4', 'd5', 'Bg5', 'Ne4'], san: 'Nxe4', min: -2.85, max: -2.75 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'Be2', 'd6', 'd5', 'e6', 'O-O', 'exd5', 'cxd5', 'Re8'],
    text:
      'After 3.e3 Bg7 4.Nf3 O-O 5.Nc3 c5 6.Be2 d6 7.d5 e6 8.O-O exd5 9.cxd5 Re8, 10.b3? is played in 7% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.0 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'Be2', 'd6', 'd5', 'e6', 'O-O', 'exd5', 'cxd5', 'Re8'], san: 'b3', min: 0.065, max: 0.075 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'Be2', 'd6', 'd5', 'e6', 'O-O', 'exd5', 'cxd5', 'Re8'], san: 'b3', atLeast: 'mistake' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'g6', 'e3', 'Bg7', 'Nf3', 'O-O', 'Nc3', 'c5', 'Be2', 'd6', 'd5', 'e6', 'O-O', 'exd5', 'cxd5', 'Re8'], san: 'b3', min: -2.05, max: -1.95 },
    ],
  },
];
