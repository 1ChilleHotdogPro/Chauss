import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Scandinavian Defence. Each one is backed by checks against the
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
    line: ['e4', 'd5'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2.exd5 (54%) and 2.e5 (19%); it is also the masters’ choice (97%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'd5'], san: 'exd5' },
      { kind: 'popular-share', line: ['e4', 'd5'], san: 'exd5', min: 0.535, max: 0.545 },
      { kind: 'popular-share', line: ['e4', 'd5'], san: 'e5', min: 0.185, max: 0.195 },
      { kind: 'book-top', line: ['e4', 'd5'], san: 'exd5' },
      { kind: 'book-share', line: ['e4', 'd5'], san: 'exd5', min: 0.965, max: 0.975 },
    ],
  },
  {
    line: ['e4', 'd5', 'exd5'],
    text:
      'Against 2.exd5, masters play 2...Qxd5 in 70% of their games; Stockfish scores it +0.6 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'd5', 'exd5'], san: 'Qxd5' },
      { kind: 'book-share', line: ['e4', 'd5', 'exd5'], san: 'Qxd5', min: 0.695, max: 0.705 },
      { kind: 'move-score', line: ['e4', 'd5', 'exd5'], san: 'Qxd5', min: 0.55, max: 0.65 },
    ],
  },
  {
    line: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Bc4', 'c6'],
    text:
      'After 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Bc4 c6, 6.Bg5?? is played in 7% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.1 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Bc4', 'c6'], san: 'Bg5', min: 0.065, max: 0.075 },
      { kind: 'flagged', line: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Bc4', 'c6'], san: 'Bg5', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Bc4', 'c6'], san: 'Bg5', min: -5.15, max: -5.05 },
    ],
  },
  {
    line: ['e4', 'd5', 'exd5', 'Nf6', 'Nc3', 'Nxd5', 'Bc4', 'Nb6'],
    text:
      'After 2.exd5 Nf6 3.Nc3 Nxd5 4.Bc4 Nb6, 5.Qf3?? is played in 8% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.5 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'd5', 'exd5', 'Nf6', 'Nc3', 'Nxd5', 'Bc4', 'Nb6'], san: 'Qf3', min: 0.075, max: 0.085 },
      { kind: 'flagged', line: ['e4', 'd5', 'exd5', 'Nf6', 'Nc3', 'Nxd5', 'Bc4', 'Nb6'], san: 'Qf3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'd5', 'exd5', 'Nf6', 'Nc3', 'Nxd5', 'Bc4', 'Nb6'], san: 'Qf3', min: -5.55, max: -5.45 },
    ],
  },
  {
    line: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qd6', 'd4', 'Nf6', 'Nf3', 'c6', 'Ne5', 'Nbd7'],
    text:
      'After 2.exd5 Qxd5 3.Nc3 Qd6 4.d4 Nf6 5.Nf3 c6 6.Ne5 Nbd7, 7.Bc4? is played in 12% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +1.6 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qd6', 'd4', 'Nf6', 'Nf3', 'c6', 'Ne5', 'Nbd7'], san: 'Bc4', min: 0.115, max: 0.125 },
      { kind: 'flagged', line: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qd6', 'd4', 'Nf6', 'Nf3', 'c6', 'Ne5', 'Nbd7'], san: 'Bc4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qd6', 'd4', 'Nf6', 'Nf3', 'c6', 'Ne5', 'Nbd7'], san: 'Bc4', min: -1.65, max: -1.55 },
    ],
  },
];
