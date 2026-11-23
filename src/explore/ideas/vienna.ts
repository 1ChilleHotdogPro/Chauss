import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Vienna Game. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Nc3'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2...Nf6 (34%) and 2...Nc6 (31%); it is also the masters’ choice (72%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Nc3'], san: 'Nf6' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nc3'], san: 'Nf6', min: 0.335, max: 0.345 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nc3'], san: 'Nc6', min: 0.305, max: 0.315 },
      { kind: 'book-top', line: ['e4', 'e5', 'Nc3'], san: 'Nf6' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nc3'], san: 'Nf6', min: 0.715, max: 0.725 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nc3', 'Nf6'],
    text:
      'Against 2...Nf6, masters play 3.g3 in 35% of their games; Stockfish scores it about equal.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nc3', 'Nf6'], san: 'g3' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nc3', 'Nf6'], san: 'g3', min: 0.345, max: 0.355 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nc3', 'Nf6'], san: 'g3', min: -0.05, max: 0.05 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nc3', 'Nc6'],
    text:
      'Against 2...Nc6, masters play 3.Bc4 in 37% of their games; Stockfish scores it about equal.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nc3', 'Nc6'], san: 'Bc4' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nc3', 'Nc6'], san: 'Bc4', min: 0.365, max: 0.375 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nc3', 'Nc6'], san: 'Bc4', min: -0.05, max: 0.05 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nc3', 'Bc5', 'Nf3'],
    text:
      'After 2...Bc5 3.Nf3, 3...Bxf2+?? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.7 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nc3', 'Bc5', 'Nf3'], san: 'Bxf2+', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nc3', 'Bc5', 'Nf3'], san: 'Bxf2+', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nc3', 'Bc5', 'Nf3'], san: 'Bxf2+', min: 5.65, max: 5.75 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nc3', 'Nf6', 'd4'],
    text:
      'After 2...Nf6 3.d4, 3...Bb4? is played in 13% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.6 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nc3', 'Nf6', 'd4'], san: 'Bb4', min: 0.125, max: 0.135 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nc3', 'Nf6', 'd4'], san: 'Bb4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nc3', 'Nf6', 'd4'], san: 'Bb4', min: 2.55, max: 2.65 },
    ],
  },
];
