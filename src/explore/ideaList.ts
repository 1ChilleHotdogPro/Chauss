import type { Idea, IdeaCheck } from './ideas';

/**
 * The short remarks shown at key positions. Each one is backed by checks against the bundled data
 * (see ideas.ts): every number and claim in a text has a check, and a remark whose checks fail is
 * not shown. Percentages are checked to the rounding used in the text; scores to one decimal.
 *
 * Written from the snapshot of 13 Nov 2026 (Lichess 1000-1399, blitz/rapid/classical; Stockfish 19
 * Lite, depth 18) — not from memory.
 */
const ROOT = ['e4', 'e5', 'Nf3', 'Nc6', 'c3'];
const at = (...moves: string[]): string[] => [...ROOT, ...moves];
/** The rating groups the texts name ("rated 1000–1399"). */
const BAND: IdeaCheck = { kind: 'ratings', line: [], ratings: [1000, 1200] };
/** A share shown as a whole percentage, e.g. pct(58) = 57.5%-58.5%. */
const pct = (value: number): { min: number; max: number } => ({ min: (value - 0.5) / 100, max: (value + 0.5) / 100 });
/** A score shown with one decimal, e.g. pawns(0.9) = 0.85-0.95. */
const pawns = (value: number): { min: number; max: number } => ({ min: value - 0.05, max: value + 0.05 });

export const IDEAS: readonly Idea[] = [
  {
    line: at(),
    text:
      'Masters mostly answer 3.c3 with 3...Nf6 (58% of their games) or 3...d5 (32%). In Lichess games rated 1000–1399, 3...Bc5 is played in 25% of games, and Stockfish marks it as an inaccuracy (+0.9 for White).',
    checks: [
      { kind: 'book-top', line: at(), san: 'Nf6' },
      { kind: 'book-share', line: at(), san: 'Nf6', ...pct(58) },
      { kind: 'book-share', line: at(), san: 'd5', ...pct(32) },
      BAND,
      { kind: 'popular-share', line: at(), san: 'Bc5', ...pct(25) },
      { kind: 'flagged', line: at(), san: 'Bc5', atLeast: 'inaccuracy' },
      { kind: 'move-score', line: at(), san: 'Bc5', ...pawns(0.9) },
    ],
  },
  {
    line: at('Nf6'),
    text: '4.d4 is the masters’ move here (81% of their games), and Stockfish rates the position after it as level (0.0).',
    checks: [
      { kind: 'book-top', line: at('Nf6'), san: 'd4' },
      { kind: 'book-share', line: at('Nf6'), san: 'd4', ...pct(81) },
      { kind: 'sound', line: at('Nf6'), san: 'd4' },
      { kind: 'move-score', line: at('Nf6'), san: 'd4', ...pawns(0) },
    ],
  },
  {
    line: at('Nf6', 'd4', 'exd4'),
    text:
      'Masters push 5.e5 here (99% of their games), attacking the knight on f6. In Lichess games rated 1000–1399 the most played move is 5.cxd4 (46%), which Stockfish rates −0.7.',
    checks: [
      { kind: 'book-top', line: at('Nf6', 'd4', 'exd4'), san: 'e5' },
      { kind: 'book-share', line: at('Nf6', 'd4', 'exd4'), san: 'e5', ...pct(99) },
      BAND,
      { kind: 'popular-top', line: at('Nf6', 'd4', 'exd4'), san: 'cxd4' },
      { kind: 'popular-share', line: at('Nf6', 'd4', 'exd4'), san: 'cxd4', ...pct(46) },
      { kind: 'move-score', line: at('Nf6', 'd4', 'exd4'), san: 'cxd4', ...pawns(-0.7) },
    ],
  },
  {
    line: at('Nf6', 'd4', 'exd4', 'e5'),
    text:
      'Masters answer with 5...Nd5 (62%) or 5...Ne4 (33%). Punish 5...Nxe5? and 5...dxc3??, played in 6% and 4% of Lichess games rated 1000–1399: Stockfish gives White +3.4 and +4.6.',
    checks: [
      { kind: 'book-top', line: at('Nf6', 'd4', 'exd4', 'e5'), san: 'Nd5' },
      { kind: 'book-share', line: at('Nf6', 'd4', 'exd4', 'e5'), san: 'Nd5', ...pct(62) },
      { kind: 'book-share', line: at('Nf6', 'd4', 'exd4', 'e5'), san: 'Ne4', ...pct(33) },
      BAND,
      { kind: 'flagged', line: at('Nf6', 'd4', 'exd4', 'e5'), san: 'Nxe5', atLeast: 'mistake' },
      { kind: 'flagged', line: at('Nf6', 'd4', 'exd4', 'e5'), san: 'dxc3', atLeast: 'blunder' },
      { kind: 'popular-share', line: at('Nf6', 'd4', 'exd4', 'e5'), san: 'Nxe5', ...pct(6) },
      { kind: 'popular-share', line: at('Nf6', 'd4', 'exd4', 'e5'), san: 'dxc3', ...pct(4) },
      { kind: 'move-score', line: at('Nf6', 'd4', 'exd4', 'e5'), san: 'Nxe5', ...pawns(3.4) },
      { kind: 'move-score', line: at('Nf6', 'd4', 'exd4', 'e5'), san: 'dxc3', ...pawns(4.6) },
    ],
  },
  {
    line: at('Nf6', 'd4', 'Nxe4'),
    text: 'Masters reply 5.d5 here (98% of their games), attacking the knight on c6.',
    checks: [
      { kind: 'book-top', line: at('Nf6', 'd4', 'Nxe4'), san: 'd5' },
      { kind: 'book-share', line: at('Nf6', 'd4', 'Nxe4'), san: 'd5', ...pct(98) },
      { kind: 'sound', line: at('Nf6', 'd4', 'Nxe4'), san: 'd5' },
    ],
  },
  {
    line: at('d5'),
    text:
      'Masters answer 3...d5 with 4.Qa4 (79% of their games), pinning the knight on c6 to the king. In Lichess games rated 1000–1399, 4.exd5 is played most (39%).',
    checks: [
      { kind: 'book-top', line: at('d5'), san: 'Qa4' },
      { kind: 'book-share', line: at('d5'), san: 'Qa4', ...pct(79) },
      { kind: 'sound', line: at('d5'), san: 'Qa4' },
      BAND,
      { kind: 'popular-top', line: at('d5'), san: 'exd5' },
      { kind: 'popular-share', line: at('d5'), san: 'exd5', ...pct(39) },
    ],
  },
  {
    line: at('Bc5'),
    text: 'No master games reach this position. Stockfish’s choice is 4.d4 (+1.1), attacking the bishop and the e5-pawn at once.',
    checks: [
      { kind: 'book-share', line: at(), san: 'Bc5', max: 0 },
      { kind: 'engine-top', line: at('Bc5'), san: 'd4' },
      { kind: 'move-score', line: at('Bc5'), san: 'd4', ...pawns(1.1) },
    ],
  },
  {
    line: at('Bc5', 'd4', 'exd4', 'cxd4'),
    text:
      'Two common errors here: 5...Nxd4? and 5...Bxd4??, played in 7% and 3% of Lichess games rated 1000–1399. Stockfish gives White +5.0 and +5.8 after them.',
    checks: [
      BAND,
      { kind: 'flagged', line: at('Bc5', 'd4', 'exd4', 'cxd4'), san: 'Nxd4', atLeast: 'mistake' },
      { kind: 'flagged', line: at('Bc5', 'd4', 'exd4', 'cxd4'), san: 'Bxd4', atLeast: 'blunder' },
      { kind: 'popular-share', line: at('Bc5', 'd4', 'exd4', 'cxd4'), san: 'Nxd4', ...pct(7) },
      { kind: 'popular-share', line: at('Bc5', 'd4', 'exd4', 'cxd4'), san: 'Bxd4', ...pct(3) },
      { kind: 'move-score', line: at('Bc5', 'd4', 'exd4', 'cxd4'), san: 'Nxd4', ...pawns(5.0) },
      { kind: 'move-score', line: at('Bc5', 'd4', 'exd4', 'cxd4'), san: 'Bxd4', ...pawns(5.8) },
    ],
  },
  {
    line: at('d6'),
    text:
      'Masters answer 3...d6 with 4.d4 (86% of their games), and it is also the most played move in Lichess games rated 1000–1399 (69%).',
    checks: [
      { kind: 'book-top', line: at('d6'), san: 'd4' },
      { kind: 'book-share', line: at('d6'), san: 'd4', ...pct(86) },
      BAND,
      { kind: 'popular-top', line: at('d6'), san: 'd4' },
      { kind: 'popular-share', line: at('d6'), san: 'd4', ...pct(69) },
    ],
  },
  {
    line: at('f5'),
    text: 'Masters answer 3...f5 with 4.d4 (88% of their games). Avoid 4.Bc4??: Stockfish rates it −4.6, winning for Black.',
    checks: [
      { kind: 'book-top', line: at('f5'), san: 'd4' },
      { kind: 'book-share', line: at('f5'), san: 'd4', ...pct(88) },
      { kind: 'flagged', line: at('f5'), san: 'Bc4', atLeast: 'blunder' },
      { kind: 'move-score', line: at('f5'), san: 'Bc4', ...pawns(-4.6) },
    ],
  },
];
