import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Scotch Game. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3...exd4 (60%) and 3...d6 (13%); it is also the masters’ choice (100%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], san: 'exd4' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], san: 'exd4', min: 0.595, max: 0.605 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], san: 'd6', min: 0.125, max: 0.135 },
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], san: 'exd4' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], san: 'exd4', min: 0.995, max: 1.005 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4'],
    text:
      'Against 3...exd4, masters play 4.Nxd4 in 84% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4'], san: 'Nxd4' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4'], san: 'Nxd4', min: 0.835, max: 0.845 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4'], san: 'Nxd4', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Be3'],
    text:
      'After 3...exd4 4.Nxd4 Bc5 5.Be3, 5...Nf6?? is played in 24% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +6.2 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Be3'], san: 'Nf6', min: 0.235, max: 0.245 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Be3'], san: 'Nf6', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Be3'], san: 'Nf6', min: 6.15, max: 6.25 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Bc4', 'Nf6', 'e5'],
    text:
      'After 3...exd4 4.Bc4 Nf6 5.e5, 5...Nxe5? is played in 6% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +3.0 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Bc4', 'Nf6', 'e5'], san: 'Nxe5', min: 0.055, max: 0.065 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Bc4', 'Nf6', 'e5'], san: 'Nxe5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Bc4', 'Nf6', 'e5'], san: 'Nxe5', min: 2.95, max: 3.05 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bb4+', 'c3', 'Bc5', 'Be3'],
    text:
      'After 3...exd4 4.Nxd4 Bb4+ 5.c3 Bc5 6.Be3, 6...Nf6?? is played in 35% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.8 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bb4+', 'c3', 'Bc5', 'Be3'], san: 'Nf6', min: 0.345, max: 0.355 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bb4+', 'c3', 'Bc5', 'Be3'], san: 'Nf6', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bb4+', 'c3', 'Bc5', 'Be3'], san: 'Nf6', min: 5.75, max: 5.85 },
    ],
  },
];
