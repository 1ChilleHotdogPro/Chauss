import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Philidor Defence. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Nf3', 'd6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3.Bc4 (42%) and 3.d4 (24%); masters mostly play 3.d4 (89%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Nf3', 'd6'], san: 'Bc4' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'd6'], san: 'Bc4', min: 0.415, max: 0.425 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'd6'], san: 'd4', min: 0.235, max: 0.245 },
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'd6'], san: 'd4' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'd6'], san: 'd4', min: 0.885, max: 0.895 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'd6', 'Bc4'],
    text:
      'Against 3.Bc4, masters play 3...Be7 in 57% of their games; Stockfish scores it +0.4 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'd6', 'Bc4'], san: 'Be7' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'd6', 'Bc4'], san: 'Be7', min: 0.565, max: 0.575 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'd6', 'Bc4'], san: 'Be7', min: 0.35, max: 0.45 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'd6', 'd4'],
    text:
      'Against 3.d4, masters play 3...exd4 in 66% of their games; Stockfish scores it +0.7 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'd6', 'd4'], san: 'exd4' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'd6', 'd4'], san: 'exd4', min: 0.655, max: 0.665 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'd6', 'd4'], san: 'exd4', min: 0.65, max: 0.75 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Nf6', 'Nc3', 'Nbd7', 'Bc4', 'Be7', 'O-O', 'O-O', 'Re1', 'c6', 'a4', 'exd4', 'Nxd4', 'Ne5'],
    text:
      'After 3.d4 Nf6 4.Nc3 Nbd7 5.Bc4 Be7 6.O-O O-O 7.Re1 c6 8.a4 exd4 9.Nxd4 Ne5, 10.Bf4?? is played in 11% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.9 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Nf6', 'Nc3', 'Nbd7', 'Bc4', 'Be7', 'O-O', 'O-O', 'Re1', 'c6', 'a4', 'exd4', 'Nxd4', 'Ne5'], san: 'Bf4', min: 0.105, max: 0.115 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Nf6', 'Nc3', 'Nbd7', 'Bc4', 'Be7', 'O-O', 'O-O', 'Re1', 'c6', 'a4', 'exd4', 'Nxd4', 'Ne5'], san: 'Bf4', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Nf6', 'Nc3', 'Nbd7', 'Bc4', 'Be7', 'O-O', 'O-O', 'Re1', 'c6', 'a4', 'exd4', 'Nxd4', 'Ne5'], san: 'Bf4', min: -5.95, max: -5.85 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Be7', 'g3', 'd5', 'e5', 'Ng4'],
    text:
      'After 3.d4 exd4 4.Nxd4 Nf6 5.Nc3 Be7 6.g3 d5 7.e5 Ng4, 8.Bh3? is played in 25% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.5 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Be7', 'g3', 'd5', 'e5', 'Ng4'], san: 'Bh3', min: 0.245, max: 0.255 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Be7', 'g3', 'd5', 'e5', 'Ng4'], san: 'Bh3', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Be7', 'g3', 'd5', 'e5', 'Ng4'], san: 'Bh3', min: -2.55, max: -2.45 },
    ],
  },
];
