import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the London System. Each one is backed by checks against the
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
    line: ['d4', 'd5', 'Bf4'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2...Nc6 (37%) and 2...Nf6 (20%); masters mostly play 2...Nf6 (57%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['d4', 'd5', 'Bf4'], san: 'Nc6' },
      { kind: 'popular-share', line: ['d4', 'd5', 'Bf4'], san: 'Nc6', min: 0.365, max: 0.375 },
      { kind: 'popular-share', line: ['d4', 'd5', 'Bf4'], san: 'Nf6', min: 0.195, max: 0.205 },
      { kind: 'book-top', line: ['d4', 'd5', 'Bf4'], san: 'Nf6' },
      { kind: 'book-share', line: ['d4', 'd5', 'Bf4'], san: 'Nf6', min: 0.565, max: 0.575 },
    ],
  },
  {
    line: ['d4', 'd5', 'Bf4', 'Nf6'],
    text:
      'Against 2...Nf6, masters play 3.e3 in 90% of their games; Stockfish scores it +0.1 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'd5', 'Bf4', 'Nf6'], san: 'e3' },
      { kind: 'book-share', line: ['d4', 'd5', 'Bf4', 'Nf6'], san: 'e3', min: 0.895, max: 0.905 },
      { kind: 'move-score', line: ['d4', 'd5', 'Bf4', 'Nf6'], san: 'e3', min: 0.05, max: 0.15 },
    ],
  },
  {
    line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5', 'c3', 'Nc6', 'Nf3', 'Qb6', 'Qb3'],
    text:
      'After 2...Nf6 3.e3 c5 4.c3 Nc6 5.Nf3 Qb6 6.Qb3, 6...Bf5? is played in 7% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.0 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5', 'c3', 'Nc6', 'Nf3', 'Qb6', 'Qb3'], san: 'Bf5', min: 0.065, max: 0.075 },
      { kind: 'flagged', line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5', 'c3', 'Nc6', 'Nf3', 'Qb6', 'Qb3'], san: 'Bf5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5', 'c3', 'Nc6', 'Nf3', 'Qb6', 'Qb3'], san: 'Bf5', min: 1.95, max: 2.05 },
    ],
  },
  {
    line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O', 'Nbd2', 'c5', 'c3', 'Nc6', 'Bb5'],
    text:
      'After 2...Nf6 3.e3 e6 4.Nf3 Bd6 5.Bg3 O-O 6.Nbd2 c5 7.c3 Nc6 8.Bb5, 8...Bd7?? is played in 13% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +6.2 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O', 'Nbd2', 'c5', 'c3', 'Nc6', 'Bb5'], san: 'Bd7', min: 0.125, max: 0.135 },
      { kind: 'flagged', line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O', 'Nbd2', 'c5', 'c3', 'Nc6', 'Bb5'], san: 'Bd7', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O', 'Nbd2', 'c5', 'c3', 'Nc6', 'Bb5'], san: 'Bd7', min: 6.15, max: 6.25 },
    ],
  },
  {
    line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O', 'Nbd2', 'c5', 'c3', 'Nc6', 'Bd3', 'b6', 'Ne5'],
    text:
      'After 2...Nf6 3.e3 e6 4.Nf3 Bd6 5.Bg3 O-O 6.Nbd2 c5 7.c3 Nc6 8.Bd3 b6 9.Ne5, 9...Nxe5?? is played in 13% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.3 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O', 'Nbd2', 'c5', 'c3', 'Nc6', 'Bd3', 'b6', 'Ne5'], san: 'Nxe5', min: 0.125, max: 0.135 },
      { kind: 'flagged', line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O', 'Nbd2', 'c5', 'c3', 'Nc6', 'Bd3', 'b6', 'Ne5'], san: 'Nxe5', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O', 'Nbd2', 'c5', 'c3', 'Nc6', 'Bd3', 'b6', 'Ne5'], san: 'Nxe5', min: 5.25, max: 5.35 },
    ],
  },
];
