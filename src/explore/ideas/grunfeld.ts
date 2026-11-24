import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Grünfeld Defence. Each one is backed by checks against the
 * bundled data (see ideas.ts): every number and claim in a text has a check, and a remark whose
 * checks fail is not shown. Percentages are checked to the whole percent shown; scores to one
 * decimal, from White's point of view.
 *
 * Drafted by scripts/draft-ideas.ts from the snapshot of 24 Nov 2026 (Lichess 1000-1399,
 * blitz/rapid/classical; Stockfish 19 Lite WASM, depth 18) and read
 * through by hand — not written from memory.
 */
export const IDEAS: readonly Idea[] = [
  {
    line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 4.Nf3 (26%) and 4.cxd5 (20%); masters mostly play 4.cxd5 (54%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'], san: 'Nf3' },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'], san: 'Nf3', min: 0.255, max: 0.265 },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'], san: 'cxd5', min: 0.195, max: 0.205 },
      { kind: 'book-top', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'], san: 'cxd5' },
      { kind: 'book-share', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'], san: 'cxd5', min: 0.535, max: 0.545 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3'],
    text:
      'Against 4.Nf3, masters play 4...Bg7 in 100% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3'], san: 'Bg7' },
      { kind: 'book-share', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3'], san: 'Bg7', min: 0.995, max: 1.005 },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3'], san: 'Bg7', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5'],
    text:
      'Against 4.cxd5, masters play 4...Nxd5 in 100% of their games; Stockfish scores it +0.3 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5'], san: 'Nxd5' },
      { kind: 'book-share', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5'], san: 'Nxd5', min: 0.995, max: 1.005 },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5'], san: 'Nxd5', min: 0.25, max: 0.35 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7', 'Bg5', 'Ne4'],
    text:
      'After 4.Nf3 Bg7 5.Bg5 Ne4, 6.Nxe4? is played in 43% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.2 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7', 'Bg5', 'Ne4'], san: 'Nxe4', min: 0.425, max: 0.435 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7', 'Bg5', 'Ne4'], san: 'Nxe4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7', 'Bg5', 'Ne4'], san: 'Nxe4', min: -2.25, max: -2.15 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7', 'Bg5', 'Ne4', 'cxd5', 'Nxg5'],
    text:
      'After 4.Nf3 Bg7 5.Bg5 Ne4 6.cxd5 Nxg5, 7.e4?? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.0 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7', 'Bg5', 'Ne4', 'cxd5', 'Nxg5'], san: 'e4', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7', 'Bg5', 'Ne4', 'cxd5', 'Nxg5'], san: 'e4', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'Nf3', 'Bg7', 'Bg5', 'Ne4', 'cxd5', 'Nxg5'], san: 'e4', min: -5.05, max: -4.95 },
    ],
  },
];
