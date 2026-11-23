import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Modern Defence. Each one is backed by checks against the
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
    line: ['e4', 'g6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2.d4 (33%) and 2.Nf3 (32%); it is also the masters’ choice (95%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'g6'], san: 'd4' },
      { kind: 'popular-share', line: ['e4', 'g6'], san: 'd4', min: 0.325, max: 0.335 },
      { kind: 'popular-share', line: ['e4', 'g6'], san: 'Nf3', min: 0.315, max: 0.325 },
      { kind: 'book-top', line: ['e4', 'g6'], san: 'd4' },
      { kind: 'book-share', line: ['e4', 'g6'], san: 'd4', min: 0.945, max: 0.955 },
    ],
  },
  {
    line: ['e4', 'g6', 'd4'],
    text:
      'Against 2.d4, masters play 2...Bg7 in 89% of their games; Stockfish scores it +0.5 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'g6', 'd4'], san: 'Bg7' },
      { kind: 'book-share', line: ['e4', 'g6', 'd4'], san: 'Bg7', min: 0.885, max: 0.895 },
      { kind: 'move-score', line: ['e4', 'g6', 'd4'], san: 'Bg7', min: 0.45, max: 0.55 },
    ],
  },
  {
    line: ['e4', 'g6', 'd4', 'Bg7', 'Nf3', 'd6', 'Bc4', 'Nf6'],
    text:
      'After 2.d4 Bg7 3.Nf3 d6 4.Bc4 Nf6, 5.Bg5? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +1.7 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'g6', 'd4', 'Bg7', 'Nf3', 'd6', 'Bc4', 'Nf6'], san: 'Bg5', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['e4', 'g6', 'd4', 'Bg7', 'Nf3', 'd6', 'Bc4', 'Nf6'], san: 'Bg5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'g6', 'd4', 'Bg7', 'Nf3', 'd6', 'Bc4', 'Nf6'], san: 'Bg5', min: -1.75, max: -1.65 },
    ],
  },
  {
    line: ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6', 'Be3', 'a6', 'Qd2', 'b5'],
    text:
      'After 2.d4 Bg7 3.Nc3 d6 4.Be3 a6 5.Qd2 b5, 6.Bh6?? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +6.3 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6', 'Be3', 'a6', 'Qd2', 'b5'], san: 'Bh6', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6', 'Be3', 'a6', 'Qd2', 'b5'], san: 'Bh6', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6', 'Be3', 'a6', 'Qd2', 'b5'], san: 'Bh6', min: -6.35, max: -6.25 },
    ],
  },
  {
    line: ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6', 'Be3', 'a6', 'Qd2', 'Nd7'],
    text:
      'After 2.d4 Bg7 3.Nc3 d6 4.Be3 a6 5.Qd2 Nd7, 6.Bh6?? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +6.1 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6', 'Be3', 'a6', 'Qd2', 'Nd7'], san: 'Bh6', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6', 'Be3', 'a6', 'Qd2', 'Nd7'], san: 'Bh6', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6', 'Be3', 'a6', 'Qd2', 'Nd7'], san: 'Bh6', min: -6.15, max: -6.05 },
    ],
  },
];
