import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Ruy Lopez. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3...Nf6 (24%) and 3...a6 (21%); masters mostly play 3...a6 (72%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], san: 'Nf6' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], san: 'Nf6', min: 0.235, max: 0.245 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], san: 'a6', min: 0.205, max: 0.215 },
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], san: 'a6' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], san: 'a6', min: 0.715, max: 0.725 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'],
    text:
      'Against 3...Nf6, masters play 4.O-O in 58% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'], san: 'O-O' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'], san: 'O-O', min: 0.575, max: 0.585 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'], san: 'O-O', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
    text:
      'Against 3...a6, masters play 4.Ba4 in 91% of their games; Stockfish scores it +0.4 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], san: 'Ba4' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], san: 'Ba4', min: 0.905, max: 0.915 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], san: 'Ba4', min: 0.35, max: 0.45 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'Re1'],
    text:
      'After 3...Nf6 4.O-O Nxe4 5.Re1, 5...d5? is played in 22% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +3.6 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'Re1'], san: 'd5', min: 0.215, max: 0.225 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'Re1'], san: 'd5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'Re1'], san: 'd5', min: 3.55, max: 3.65 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'd3', 'b5', 'Bb3'],
    text:
      'After 3...a6 4.Ba4 Nf6 5.d3 b5 6.Bb3, 6...Nd4? is played in 7% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +4.0 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'd3', 'b5', 'Bb3'], san: 'Nd4', min: 0.065, max: 0.075 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'd3', 'b5', 'Bb3'], san: 'Nd4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'd3', 'b5', 'Bb3'], san: 'Nd4', min: 3.95, max: 4.05 },
    ],
  },
];
