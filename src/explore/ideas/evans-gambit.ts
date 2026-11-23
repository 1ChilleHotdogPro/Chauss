import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Evans Gambit. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 4...Bxb4 (65%) and 4...Bb6 (17%); it is also the masters’ choice (86%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], san: 'Bxb4' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], san: 'Bxb4', min: 0.645, max: 0.655 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], san: 'Bb6', min: 0.165, max: 0.175 },
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], san: 'Bxb4' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], san: 'Bxb4', min: 0.855, max: 0.865 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4'],
    text:
      'Against 4...Bxb4, masters play 5.c3 in 100% of their games; Stockfish scores it +0.1 for Black.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4'], san: 'c3' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4'], san: 'c3', min: 0.995, max: 1.005 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4'], san: 'c3', min: -0.15, max: -0.05 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bb6'],
    text:
      'Against 4...Bb6, masters play 5.a4 in 80% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bb6'], san: 'a4' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bb6'], san: 'a4', min: 0.795, max: 0.805 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bb6'], san: 'a4', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Bd6', 'd4', 'Nf6', 'O-O'],
    text:
      'After 4...Bxb4 5.c3 Bd6 6.d4 Nf6 7.O-O, 7...exd4? is played in 47% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.9 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Bd6', 'd4', 'Nf6', 'O-O'], san: 'exd4', min: 0.465, max: 0.475 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Bd6', 'd4', 'Nf6', 'O-O'], san: 'exd4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Bd6', 'd4', 'Nf6', 'O-O'], san: 'exd4', min: 2.85, max: 2.95 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4', 'Qb3'],
    text:
      'After 4...Bxb4 5.c3 Ba5 6.d4 exd4 7.Qb3, 7...Bxc3+?? is played in 8% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +4.9 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4', 'Qb3'], san: 'Bxc3+', min: 0.075, max: 0.085 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4', 'Qb3'], san: 'Bxc3+', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4', 'Qb3'], san: 'Bxc3+', min: 4.85, max: 4.95 },
    ],
  },
];
