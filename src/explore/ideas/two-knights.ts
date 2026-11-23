import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Two Knights Defence. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 4.Ng5 (36%) and 4.d3 (28%); masters mostly play 4.d3 (74%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], san: 'Ng5' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], san: 'Ng5', min: 0.355, max: 0.365 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], san: 'd3', min: 0.275, max: 0.285 },
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], san: 'd3' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], san: 'd3', min: 0.735, max: 0.745 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'],
    text:
      'Against 4.Ng5, masters play 4...d5 in 96% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'd5' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'd5', min: 0.955, max: 0.965 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'], san: 'd5', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3'],
    text:
      'Against 4.d3, masters play 4...Bc5 in 44% of their games; Stockfish scores it +0.3 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3'], san: 'Bc5' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3'], san: 'Bc5', min: 0.435, max: 0.445 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3'], san: 'Bc5', min: 0.25, max: 0.35 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3', 'Nd5'],
    text:
      'After 4.Ng5 d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6 8.Bd3 Nd5, 9.Qf3?? is played in 12% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +4.6 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3', 'Nd5'], san: 'Qf3', min: 0.115, max: 0.125 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3', 'Nd5'], san: 'Qf3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3', 'Nd5'], san: 'Qf3', min: -4.65, max: -4.55 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3', 'Nd5', 'Nf3', 'Bd6'],
    text:
      'After 4.Ng5 d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6 8.Bd3 Nd5 9.Nf3 Bd6, 10.Qe2?? is played in 6% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +3.7 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3', 'Nd5', 'Nf3', 'Bd6'], san: 'Qe2', min: 0.055, max: 0.065 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3', 'Nd5', 'Nf3', 'Bd6'], san: 'Qe2', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Bd3', 'Nd5', 'Nf3', 'Bd6'], san: 'Qe2', min: -3.75, max: -3.65 },
    ],
  },
];
