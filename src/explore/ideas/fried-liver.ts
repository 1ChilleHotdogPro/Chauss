import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Fried Liver Attack. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 4...d5 (71%) and 4...Bc5 (10%); it is also the masters’ choice (96%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'd5' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'd5', min: 0.705, max: 0.715 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'Bc5', min: 0.095, max: 0.105 },
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'd5' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'd5', min: 0.955, max: 0.965 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'],
    text:
      'Against 4...d5, masters play 5.exd5 in 100% of their games; Stockfish scores it +0.1 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'], san: 'exd5' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'], san: 'exd5', min: 0.995, max: 1.005 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'], san: 'exd5', min: 0.05, max: 0.15 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'Bc5'],
    text:
      'Against 4...Bc5, masters play 5.Bxf7+ in 67% of their games; Stockfish scores it +1.1 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'Bc5'], san: 'Bxf7+' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'Bc5'], san: 'Bxf7+', min: 0.665, max: 0.675 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'Bc5'], san: 'Bxf7+', min: 1.05, max: 1.15 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nd4', 'c3'],
    text:
      'After 4...d5 5.exd5 Nd4 6.c3, 6...Bg4? is played in 6% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +3.7 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nd4', 'c3'], san: 'Bg4', min: 0.055, max: 0.065 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nd4', 'c3'], san: 'Bg4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nd4', 'c3'], san: 'Bg4', min: 3.65, max: 3.75 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3'],
    text:
      'After 4...d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6 8.Bd3, 8...e4? is played in 5% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.9 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3'], san: 'e4', min: 0.045, max: 0.055 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3'], san: 'e4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3'], san: 'e4', min: 2.85, max: 2.95 },
    ],
  },
];
