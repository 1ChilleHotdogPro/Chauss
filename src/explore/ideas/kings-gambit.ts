import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the King's Gambit. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'f4'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2...exf4 (45%) and 2...Nc6 (23%); it is also the masters’ choice (67%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'f4'], san: 'exf4' },
      { kind: 'popular-share', line: ['e4', 'e5', 'f4'], san: 'exf4', min: 0.445, max: 0.455 },
      { kind: 'popular-share', line: ['e4', 'e5', 'f4'], san: 'Nc6', min: 0.225, max: 0.235 },
      { kind: 'book-top', line: ['e4', 'e5', 'f4'], san: 'exf4' },
      { kind: 'book-share', line: ['e4', 'e5', 'f4'], san: 'exf4', min: 0.665, max: 0.675 },
    ],
  },
  {
    line: ['e4', 'e5', 'f4', 'd6', 'fxe5'],
    text:
      'After 2...d6 3.fxe5, 3...dxe5? is played in 93% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +0.3 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'f4', 'd6', 'fxe5'], san: 'dxe5', min: 0.925, max: 0.935 },
      { kind: 'flagged', line: ['e4', 'e5', 'f4', 'd6', 'fxe5'], san: 'dxe5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'f4', 'd6', 'fxe5'], san: 'dxe5', min: -0.35, max: -0.25 },
    ],
  },
  {
    line: ['e4', 'e5', 'f4', 'f6', 'fxe5'],
    text:
      'After 2...f6 3.fxe5, 3...fxe5?? is played in 95% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.6 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'f4', 'f6', 'fxe5'], san: 'fxe5', min: 0.945, max: 0.955 },
      { kind: 'flagged', line: ['e4', 'e5', 'f4', 'f6', 'fxe5'], san: 'fxe5', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'f4', 'f6', 'fxe5'], san: 'fxe5', min: 5.55, max: 5.65 },
    ],
  },
  {
    line: ['e4', 'e5', 'f4', 'd6', 'Nf3'],
    text:
      'After 2...d6 3.Nf3, 3...f6? is played in 6% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +1.8 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'f4', 'd6', 'Nf3'], san: 'f6', min: 0.055, max: 0.065 },
      { kind: 'flagged', line: ['e4', 'e5', 'f4', 'd6', 'Nf3'], san: 'f6', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'f4', 'd6', 'Nf3'], san: 'f6', min: 1.75, max: 1.85 },
    ],
  },
  {
    line: ['e4', 'e5', 'f4', 'd6', 'f5'],
    text:
      'After 2...d6 3.f5, 3...Nf6?? is played in 36% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +1.0 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'f4', 'd6', 'f5'], san: 'Nf6', min: 0.355, max: 0.365 },
      { kind: 'flagged', line: ['e4', 'e5', 'f4', 'd6', 'f5'], san: 'Nf6', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'f4', 'd6', 'f5'], san: 'Nf6', min: -1.05, max: -0.95 },
    ],
  },
];
