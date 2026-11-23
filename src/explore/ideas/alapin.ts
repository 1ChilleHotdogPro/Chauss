import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Alapin Sicilian. Each one is backed by checks against the
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
    line: ['e4', 'c5', 'c3'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2...Nc6 (41%) and 2...d6 (22%); masters mostly play 2...Nf6 (45%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'c5', 'c3'], san: 'Nc6' },
      { kind: 'popular-share', line: ['e4', 'c5', 'c3'], san: 'Nc6', min: 0.405, max: 0.415 },
      { kind: 'popular-share', line: ['e4', 'c5', 'c3'], san: 'd6', min: 0.215, max: 0.225 },
      { kind: 'book-top', line: ['e4', 'c5', 'c3'], san: 'Nf6' },
      { kind: 'book-share', line: ['e4', 'c5', 'c3'], san: 'Nf6', min: 0.445, max: 0.455 },
    ],
  },
  {
    line: ['e4', 'c5', 'c3', 'd6'],
    text:
      'Against 2...d6, masters play 3.d4 in 96% of their games; Stockfish scores it +0.6 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'c5', 'c3', 'd6'], san: 'd4' },
      { kind: 'book-share', line: ['e4', 'c5', 'c3', 'd6'], san: 'd4', min: 0.955, max: 0.965 },
      { kind: 'move-score', line: ['e4', 'c5', 'c3', 'd6'], san: 'd4', min: 0.55, max: 0.65 },
    ],
  },
  {
    line: ['e4', 'c5', 'c3', 'Nf6', 'e5'],
    text:
      'After 2...Nf6 3.e5, 3...Ne4? is played in 8% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +4.0 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'c5', 'c3', 'Nf6', 'e5'], san: 'Ne4', min: 0.075, max: 0.085 },
      { kind: 'flagged', line: ['e4', 'c5', 'c3', 'Nf6', 'e5'], san: 'Ne4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'c5', 'c3', 'Nf6', 'e5'], san: 'Ne4', min: 3.95, max: 4.05 },
    ],
  },
  {
    line: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4'],
    text:
      'After 2...d5 3.exd5 Qxd5 4.d4, 4...c4? is played in 5% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.7 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4'], san: 'c4', min: 0.045, max: 0.055 },
      { kind: 'flagged', line: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4'], san: 'c4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4'], san: 'c4', min: 2.65, max: 2.75 },
    ],
  },
  {
    line: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4', 'Nc6', 'Nf3', 'Bg4', 'Be2', 'cxd4', 'cxd4'],
    text:
      'After 2...d5 3.exd5 Qxd5 4.d4 Nc6 5.Nf3 Bg4 6.Be2 cxd4 7.cxd4, 7...Nxd4?? is played in 6% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.6 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4', 'Nc6', 'Nf3', 'Bg4', 'Be2', 'cxd4', 'cxd4'], san: 'Nxd4', min: 0.055, max: 0.065 },
      { kind: 'flagged', line: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4', 'Nc6', 'Nf3', 'Bg4', 'Be2', 'cxd4', 'cxd4'], san: 'Nxd4', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4', 'Nc6', 'Nf3', 'Bg4', 'Be2', 'cxd4', 'cxd4'], san: 'Nxd4', min: 5.55, max: 5.65 },
    ],
  },
];
