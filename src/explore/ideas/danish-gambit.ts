import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Danish Gambit. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'd4', 'exd4', 'c3'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3...dxc3 (75%) and 3...Nc6 (14%); masters mostly play 3...d5 (49%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'd4', 'exd4', 'c3'], san: 'dxc3' },
      { kind: 'popular-share', line: ['e4', 'e5', 'd4', 'exd4', 'c3'], san: 'dxc3', min: 0.745, max: 0.755 },
      { kind: 'popular-share', line: ['e4', 'e5', 'd4', 'exd4', 'c3'], san: 'Nc6', min: 0.135, max: 0.145 },
      { kind: 'book-top', line: ['e4', 'e5', 'd4', 'exd4', 'c3'], san: 'd5' },
      { kind: 'book-share', line: ['e4', 'e5', 'd4', 'exd4', 'c3'], san: 'd5', min: 0.485, max: 0.495 },
    ],
  },
  {
    line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'Bc5', 'Nf3', 'dxc3', 'Nxc3'],
    text:
      'After 3...Nc6 4.Bc4 Bc5 5.Nf3 dxc3 6.Nxc3, 6...Qf6? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +2.3 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'Bc5', 'Nf3', 'dxc3', 'Nxc3'], san: 'Qf6', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'Bc5', 'Nf3', 'dxc3', 'Nxc3'], san: 'Qf6', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'Bc5', 'Nf3', 'dxc3', 'Nxc3'], san: 'Qf6', min: 2.25, max: 2.35 },
    ],
  },
  {
    line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'dxc3', 'Nxc3', 'Nf6', 'Nf3', 'Bc5', 'e5'],
    text:
      'After 3...Nc6 4.Bc4 dxc3 5.Nxc3 Nf6 6.Nf3 Bc5 7.e5, 7...Qe7? is played in 17% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +4.7 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'dxc3', 'Nxc3', 'Nf6', 'Nf3', 'Bc5', 'e5'], san: 'Qe7', min: 0.165, max: 0.175 },
      { kind: 'flagged', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'dxc3', 'Nxc3', 'Nf6', 'Nf3', 'Bc5', 'e5'], san: 'Qe7', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'dxc3', 'Nxc3', 'Nf6', 'Nf3', 'Bc5', 'e5'], san: 'Qe7', min: 4.65, max: 4.75 },
    ],
  },
  {
    line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'cxd4', 'd5', 'exd5', 'Qxd5', 'Nf3', 'Bg4', 'Nc3'],
    text:
      'After 3...Nc6 4.cxd4 d5 5.exd5 Qxd5 6.Nf3 Bg4 7.Nc3, 7...Qe6+?? is played in 22% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +2.8 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'cxd4', 'd5', 'exd5', 'Qxd5', 'Nf3', 'Bg4', 'Nc3'], san: 'Qe6+', min: 0.215, max: 0.225 },
      { kind: 'flagged', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'cxd4', 'd5', 'exd5', 'Qxd5', 'Nf3', 'Bg4', 'Nc3'], san: 'Qe6+', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'cxd4', 'd5', 'exd5', 'Qxd5', 'Nf3', 'Bg4', 'Nc3'], san: 'Qe6+', min: 2.75, max: 2.85 },
    ],
  },
  {
    line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'dxc3', 'Qf3'],
    text:
      'After 3...Nc6 4.Bc4 dxc3 5.Qf3, 5...Nh6? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +1.5 for White.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'dxc3', 'Qf3'], san: 'Nh6', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'dxc3', 'Qf3'], san: 'Nh6', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'e5', 'd4', 'exd4', 'c3', 'Nc6', 'Bc4', 'dxc3', 'Qf3'], san: 'Nh6', min: 1.45, max: 1.55 },
    ],
  },
];
