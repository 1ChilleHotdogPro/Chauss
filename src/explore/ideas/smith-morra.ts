import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Smith-Morra Gambit. Each one is backed by checks against the
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
    line: ['e4', 'c5', 'd4', 'cxd4', 'c3'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3...dxc3 (70%) and 3...Nc6 (16%); it is also the masters’ choice (55%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'c5', 'd4', 'cxd4', 'c3'], san: 'dxc3' },
      { kind: 'popular-share', line: ['e4', 'c5', 'd4', 'cxd4', 'c3'], san: 'dxc3', min: 0.695, max: 0.705 },
      { kind: 'popular-share', line: ['e4', 'c5', 'd4', 'cxd4', 'c3'], san: 'Nc6', min: 0.155, max: 0.165 },
      { kind: 'book-top', line: ['e4', 'c5', 'd4', 'cxd4', 'c3'], san: 'dxc3' },
      { kind: 'book-share', line: ['e4', 'c5', 'd4', 'cxd4', 'c3'], san: 'dxc3', min: 0.545, max: 0.555 },
    ],
  },
  {
    line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'dxc3'],
    text:
      'Against 3...dxc3, masters play 4.Nxc3 in 100% of their games; Stockfish scores it +0.2 for Black.',
    checks: [
      { kind: 'book-top', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'dxc3'], san: 'Nxc3' },
      { kind: 'book-share', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'dxc3'], san: 'Nxc3', min: 0.995, max: 1.005 },
      { kind: 'move-score', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'dxc3'], san: 'Nxc3', min: -0.25, max: -0.15 },
    ],
  },
  {
    line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'dxc3', 'Nxc3', 'Nc6', 'Nf3', 'd6', 'Bc4'],
    text:
      'After 3...dxc3 4.Nxc3 Nc6 5.Nf3 d6 6.Bc4, 6...Bg4? is played in 12% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.8 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'dxc3', 'Nxc3', 'Nc6', 'Nf3', 'd6', 'Bc4'], san: 'Bg4', min: 0.115, max: 0.125 },
      { kind: 'flagged', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'dxc3', 'Nxc3', 'Nc6', 'Nf3', 'd6', 'Bc4'], san: 'Bg4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'dxc3', 'Nxc3', 'Nc6', 'Nf3', 'd6', 'Bc4'], san: 'Bg4', min: 2.75, max: 2.85 },
    ],
  },
  {
    line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'Nf6', 'e5'],
    text:
      'After 3...Nf6 4.e5, 4...Ne4? is played in 13% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +3.2 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'Nf6', 'e5'], san: 'Ne4', min: 0.125, max: 0.135 },
      { kind: 'flagged', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'Nf6', 'e5'], san: 'Ne4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'Nf6', 'e5'], san: 'Ne4', min: 3.15, max: 3.25 },
    ],
  },
  {
    line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'Nf6', 'e5', 'Nd5', 'Nf3'],
    text:
      'After 3...Nf6 4.e5 Nd5 5.Nf3, 5...dxc3?? is played in 20% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.0 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'Nf6', 'e5', 'Nd5', 'Nf3'], san: 'dxc3', min: 0.195, max: 0.205 },
      { kind: 'flagged', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'Nf6', 'e5', 'Nd5', 'Nf3'], san: 'dxc3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'Nf6', 'e5', 'Nd5', 'Nf3'], san: 'dxc3', min: 4.95, max: 5.05 },
    ],
  },
];
