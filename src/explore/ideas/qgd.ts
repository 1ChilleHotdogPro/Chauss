import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Queen's Gambit Declined. Each one is backed by checks against the
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
    line: ['d4', 'd5', 'c4', 'e6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3.Nc3 (45%) and 3.Nf3 (15%); it is also the masters’ choice (59%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['d4', 'd5', 'c4', 'e6'], san: 'Nc3' },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4', 'e6'], san: 'Nc3', min: 0.445, max: 0.455 },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4', 'e6'], san: 'Nf3', min: 0.145, max: 0.155 },
      { kind: 'book-top', line: ['d4', 'd5', 'c4', 'e6'], san: 'Nc3' },
      { kind: 'book-share', line: ['d4', 'd5', 'c4', 'e6'], san: 'Nc3', min: 0.585, max: 0.595 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'e6', 'Nc3'],
    text:
      'Against 3.Nc3, masters play 3...Nf6 in 41% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'd5', 'c4', 'e6', 'Nc3'], san: 'Nf6' },
      { kind: 'book-share', line: ['d4', 'd5', 'c4', 'e6', 'Nc3'], san: 'Nf6', min: 0.405, max: 0.415 },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'e6', 'Nc3'], san: 'Nf6', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'e6', 'Nf3'],
    text:
      'Against 3.Nf3, masters play 3...Nf6 in 63% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'd5', 'c4', 'e6', 'Nf3'], san: 'Nf6' },
      { kind: 'book-share', line: ['d4', 'd5', 'c4', 'e6', 'Nf3'], san: 'Nf6', min: 0.625, max: 0.635 },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'e6', 'Nf3'], san: 'Nf6', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'Nf3', 'O-O', 'e3', 'h6', 'Bh4', 'Ne4'],
    text:
      'After 3.Nc3 Nf6 4.Bg5 Be7 5.Nf3 O-O 6.e3 h6 7.Bh4 Ne4, 8.Bd3?? is played in 5% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +4.7 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'Nf3', 'O-O', 'e3', 'h6', 'Bh4', 'Ne4'], san: 'Bd3', min: 0.045, max: 0.055 },
      { kind: 'flagged', line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'Nf3', 'O-O', 'e3', 'h6', 'Bh4', 'Ne4'], san: 'Bd3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'Nf3', 'O-O', 'e3', 'h6', 'Bh4', 'Ne4'], san: 'Bd3', min: -4.75, max: -4.65 },
    ],
  },
];
