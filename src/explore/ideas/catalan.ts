import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Catalan. Each one is backed by checks against the
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
    line: ['d4', 'Nf6', 'c4', 'e6', 'g3'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3...d5 (41%) and 3...Bb4+ (20%); it is also the masters’ choice (60%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['d4', 'Nf6', 'c4', 'e6', 'g3'], san: 'd5' },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'e6', 'g3'], san: 'd5', min: 0.405, max: 0.415 },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'e6', 'g3'], san: 'Bb4+', min: 0.195, max: 0.205 },
      { kind: 'book-top', line: ['d4', 'Nf6', 'c4', 'e6', 'g3'], san: 'd5' },
      { kind: 'book-share', line: ['d4', 'Nf6', 'c4', 'e6', 'g3'], san: 'd5', min: 0.595, max: 0.605 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5'],
    text:
      'Against 3...d5, masters play 4.Bg2 in 55% of their games; Stockfish scores it +0.3 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5'], san: 'Bg2' },
      { kind: 'book-share', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5'], san: 'Bg2', min: 0.545, max: 0.555 },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5'], san: 'Bg2', min: 0.25, max: 0.35 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'Bb4+'],
    text:
      'Against 3...Bb4+, masters play 4.Bd2 in 82% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'Bb4+'], san: 'Bd2' },
      { kind: 'book-share', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'Bb4+'], san: 'Bd2', min: 0.815, max: 0.825 },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'Bb4+'], san: 'Bd2', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Bb4+', 'Nd2'],
    text:
      'After 3...d5 4.Bg2 Bb4+ 5.Nd2, 5...dxc4?? is played in 18% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.3 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Bb4+', 'Nd2'], san: 'dxc4', min: 0.175, max: 0.185 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Bb4+', 'Nd2'], san: 'dxc4', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Bb4+', 'Nd2'], san: 'dxc4', min: 5.25, max: 5.35 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Be7', 'Nf3', 'O-O', 'O-O', 'dxc4', 'Ne5'],
    text:
      'After 3...d5 4.Bg2 Be7 5.Nf3 O-O 6.O-O dxc4 7.Ne5, 7...b5?? is played in 15% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.9 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Be7', 'Nf3', 'O-O', 'O-O', 'dxc4', 'Ne5'], san: 'b5', min: 0.145, max: 0.155 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Be7', 'Nf3', 'O-O', 'O-O', 'dxc4', 'Ne5'], san: 'b5', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Be7', 'Nf3', 'O-O', 'O-O', 'dxc4', 'Ne5'], san: 'b5', min: 5.85, max: 5.95 },
    ],
  },
];
