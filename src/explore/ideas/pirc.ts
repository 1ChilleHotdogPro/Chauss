import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Pirc Defence. Each one is backed by checks against the
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
    line: ['e4', 'd6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2.d4 (37%) and 2.Nf3 (33%); it is also the masters’ choice (95%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'd6'], san: 'd4' },
      { kind: 'popular-share', line: ['e4', 'd6'], san: 'd4', min: 0.365, max: 0.375 },
      { kind: 'popular-share', line: ['e4', 'd6'], san: 'Nf3', min: 0.325, max: 0.335 },
      { kind: 'book-top', line: ['e4', 'd6'], san: 'd4' },
      { kind: 'book-share', line: ['e4', 'd6'], san: 'd4', min: 0.945, max: 0.955 },
    ],
  },
  {
    line: ['e4', 'd6', 'd4'],
    text:
      'Against 2.d4, masters play 2...Nf6 in 84% of their games; Stockfish scores it +0.4 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'd6', 'd4'], san: 'Nf6' },
      { kind: 'book-share', line: ['e4', 'd6', 'd4'], san: 'Nf6', min: 0.835, max: 0.845 },
      { kind: 'move-score', line: ['e4', 'd6', 'd4'], san: 'Nf6', min: 0.35, max: 0.45 },
    ],
  },
  {
    line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Nf3', 'Bg7', 'Be2', 'O-O', 'O-O', 'Bg4', 'Be3', 'Nc6', 'Qd2', 'e5'],
    text:
      'After 2.d4 Nf6 3.Nc3 g6 4.Nf3 Bg7 5.Be2 O-O 6.O-O Bg4 7.Be3 Nc6 8.Qd2 e5, 9.Bh6? is played in 13% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +3.2 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Nf3', 'Bg7', 'Be2', 'O-O', 'O-O', 'Bg4', 'Be3', 'Nc6', 'Qd2', 'e5'], san: 'Bh6', min: 0.125, max: 0.135 },
      { kind: 'flagged', line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Nf3', 'Bg7', 'Be2', 'O-O', 'O-O', 'Bg4', 'Be3', 'Nc6', 'Qd2', 'e5'], san: 'Bh6', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Nf3', 'Bg7', 'Be2', 'O-O', 'O-O', 'Bg4', 'Be3', 'Nc6', 'Qd2', 'e5'], san: 'Bh6', min: -3.25, max: -3.15 },
    ],
  },
  {
    line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'c5', 'Bb5+', 'Bd7'],
    text:
      'After 2.d4 Nf6 3.Nc3 g6 4.f4 Bg7 5.Nf3 c5 6.Bb5+ Bd7, 7.dxc5? is played in 10% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +1.9 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'c5', 'Bb5+', 'Bd7'], san: 'dxc5', min: 0.095, max: 0.105 },
      { kind: 'flagged', line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'c5', 'Bb5+', 'Bd7'], san: 'dxc5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'c5', 'Bb5+', 'Bd7'], san: 'dxc5', min: -1.95, max: -1.85 },
    ],
  },
  {
    line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'O-O', 'Bd3', 'Na6', 'O-O', 'c5'],
    text:
      'After 2.d4 Nf6 3.Nc3 g6 4.f4 Bg7 5.Nf3 O-O 6.Bd3 Na6 7.O-O c5, 8.Be3? is played in 9% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +1.6 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'O-O', 'Bd3', 'Na6', 'O-O', 'c5'], san: 'Be3', min: 0.085, max: 0.095 },
      { kind: 'flagged', line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'O-O', 'Bd3', 'Na6', 'O-O', 'c5'], san: 'Be3', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'O-O', 'Bd3', 'Na6', 'O-O', 'c5'], san: 'Be3', min: -1.65, max: -1.55 },
    ],
  },
];
