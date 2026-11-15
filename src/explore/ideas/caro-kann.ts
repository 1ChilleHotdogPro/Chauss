import type { Idea, IdeaCheck } from '../ideas';

/**
 * The short remarks shown at key positions of the Caro-Kann. Each one is backed by checks against
 * the bundled data (see ideas.ts): every number and claim in a text has a check, and a remark
 * whose checks fail is not shown. Percentages are checked to the rounding used in the text; scores
 * to one decimal, from White's point of view.
 *
 * Written from the snapshot of 15 Nov 2026 (Lichess 1000-1399, blitz/rapid/classical; Stockfish 19
 * Lite, depth 18) and the trap list built from it — not from memory.
 */
const at = (...moves: string[]): string[] => moves;
/** The rating groups the texts name ("rated 1000–1399"). */
const BAND: IdeaCheck = { kind: 'ratings', line: [], ratings: [1000, 1200] };
/** A share shown as a whole percentage, e.g. pct(58) = 57.5%-58.5%. */
const pct = (value: number): { min: number; max: number } => ({ min: (value - 0.5) / 100, max: (value + 0.5) / 100 });
/** A score shown with one decimal, e.g. pawns(0.9) = 0.85-0.95. */
const pawns = (value: number): { min: number; max: number } => ({ min: value - 0.05, max: value + 0.05 });

export const IDEAS: readonly Idea[] = [
  {
    line: at('e4'),
    text:
      'Masters mostly answer 1.e4 with 1...c5 (46%); 1...c6, the Caro-Kann, is 8% of their games. In Lichess games rated 1000–1399, 1...e5 is played in 58% and 1...c6 in 5%; Stockfish scores them +0.3 and +0.4 for White.',
    checks: [
      { kind: 'book-top', line: at('e4'), san: 'c5' },
      { kind: 'book-share', line: at('e4'), san: 'c5', ...pct(46) },
      { kind: 'book-share', line: at('e4'), san: 'c6', ...pct(8) },
      BAND,
      { kind: 'popular-share', line: at('e4'), san: 'e5', ...pct(58) },
      { kind: 'popular-share', line: at('e4'), san: 'c6', ...pct(5) },
      { kind: 'move-score', line: at('e4'), san: 'e5', ...pawns(0.3) },
      { kind: 'move-score', line: at('e4'), san: 'c6', ...pawns(0.4) },
    ],
  },
  {
    line: at('e4', 'c6'),
    text:
      'Masters play 2.d4 here in four games out of five, and it is also the most played move in Lichess games rated 1000–1399 (34%); Stockfish scores it +0.3 for White. 2.Nf3 is about as common at this level (a third of games) and scores +0.3 too.',
    checks: [
      { kind: 'book-top', line: at('e4', 'c6'), san: 'd4' },
      { kind: 'book-share', line: at('e4', 'c6'), san: 'd4', min: 0.78, max: 0.83 },
      BAND,
      { kind: 'popular-top', line: at('e4', 'c6'), san: 'd4' },
      { kind: 'popular-share', line: at('e4', 'c6'), san: 'd4', ...pct(34) },
      { kind: 'move-score', line: at('e4', 'c6'), san: 'd4', ...pawns(0.3) },
      { kind: 'popular-share', line: at('e4', 'c6'), san: 'Nf3', min: 0.32, max: 0.35 },
      { kind: 'move-score', line: at('e4', 'c6'), san: 'Nf3', ...pawns(0.3) },
    ],
  },
  {
    line: at('e4', 'c6', 'd4', 'd5'),
    text:
      '3.e5, which the explorer calls the Advance Variation, is the most played move here: 52% of Lichess games rated 1000–1399 and 40% of master games. Stockfish scores it +0.3 for White.',
    checks: [
      { kind: 'popular-top', line: at('e4', 'c6', 'd4', 'd5'), san: 'e5' },
      BAND,
      { kind: 'popular-share', line: at('e4', 'c6', 'd4', 'd5'), san: 'e5', ...pct(52) },
      { kind: 'book-top', line: at('e4', 'c6', 'd4', 'd5'), san: 'e5' },
      { kind: 'book-share', line: at('e4', 'c6', 'd4', 'd5'), san: 'e5', ...pct(40) },
      { kind: 'opening-after', line: at('e4', 'c6', 'd4', 'd5'), san: 'e5', name: 'Advance Variation' },
      { kind: 'move-score', line: at('e4', 'c6', 'd4', 'd5'), san: 'e5', ...pawns(0.3) },
    ],
  },
  {
    line: at('e4', 'c6', 'd4', 'd5', 'e5'),
    text:
      'Masters play 4...Bf5 in 77% of their games (55% of Lichess games rated 1000–1399; +0.4 for White). 4...e6 (10% at this level) scores +0.7 and 4...f6 (5%) +1.0.',
    checks: [
      { kind: 'book-top', line: at('e4', 'c6', 'd4', 'd5', 'e5'), san: 'Bf5' },
      { kind: 'book-share', line: at('e4', 'c6', 'd4', 'd5', 'e5'), san: 'Bf5', ...pct(77) },
      BAND,
      { kind: 'popular-share', line: at('e4', 'c6', 'd4', 'd5', 'e5'), san: 'Bf5', ...pct(55) },
      { kind: 'move-score', line: at('e4', 'c6', 'd4', 'd5', 'e5'), san: 'Bf5', ...pawns(0.4) },
      { kind: 'popular-share', line: at('e4', 'c6', 'd4', 'd5', 'e5'), san: 'e6', ...pct(10) },
      { kind: 'move-score', line: at('e4', 'c6', 'd4', 'd5', 'e5'), san: 'e6', ...pawns(0.7) },
      { kind: 'popular-share', line: at('e4', 'c6', 'd4', 'd5', 'e5'), san: 'f6', ...pct(5) },
      { kind: 'move-score', line: at('e4', 'c6', 'd4', 'd5', 'e5'), san: 'f6', ...pawns(1.0) },
    ],
  },
  {
    line: at('e4', 'c6', 'd4', 'd5', 'Nc3'),
    text:
      'Masters answer 3.Nc3 with 3...dxe4 (94% of their games; +0.4 for White). In Lichess games rated 1000–1399, 3...c5? is played in 2% and Stockfish calls it a mistake: +2.9 for White.',
    checks: [
      { kind: 'book-top', line: at('e4', 'c6', 'd4', 'd5', 'Nc3'), san: 'dxe4' },
      { kind: 'book-share', line: at('e4', 'c6', 'd4', 'd5', 'Nc3'), san: 'dxe4', ...pct(94) },
      { kind: 'move-score', line: at('e4', 'c6', 'd4', 'd5', 'Nc3'), san: 'dxe4', ...pawns(0.4) },
      BAND,
      { kind: 'popular-share', line: at('e4', 'c6', 'd4', 'd5', 'Nc3'), san: 'c5', ...pct(2) },
      { kind: 'flagged', line: at('e4', 'c6', 'd4', 'd5', 'Nc3'), san: 'c5', atLeast: 'mistake' },
      { kind: 'move-score', line: at('e4', 'c6', 'd4', 'd5', 'Nc3'), san: 'c5', ...pawns(2.9) },
    ],
  },
  {
    line: at('e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'h4'),
    text:
      'After 5.h4, the reply 5...e6? is played in 46% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +3.9 for White.',
    checks: [
      BAND,
      { kind: 'popular-share', line: at('e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'h4'), san: 'e6', ...pct(46) },
      { kind: 'flagged', line: at('e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'h4'), san: 'e6', atLeast: 'mistake' },
      { kind: 'move-score', line: at('e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'h4'), san: 'e6', ...pawns(3.9) },
    ],
  },
  {
    line: at('e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5', 'Ne5'),
    text:
      'After 2.Nf3 d5 3.exd5 cxd5 4.Ne5, the reply 4...f6?? is played in 9% of Lichess games rated 1000–1399; Stockfish scores it +4.3 for White.',
    checks: [
      BAND,
      { kind: 'popular-share', line: at('e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5', 'Ne5'), san: 'f6', ...pct(9) },
      { kind: 'flagged', line: at('e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5', 'Ne5'), san: 'f6', atLeast: 'blunder' },
      { kind: 'move-score', line: at('e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5', 'Ne5'), san: 'f6', ...pawns(4.3) },
    ],
  },
  {
    line: at('e4', 'c6', 'Nf3', 'd5', 'd3', 'dxe4'),
    text:
      'Punish 4.Ne5??, played in 6% of Lichess games rated 1000–1399 after 2.Nf3 d5 3.d3 dxe4: Stockfish scores it −4.5 for White.',
    checks: [
      BAND,
      { kind: 'popular-share', line: at('e4', 'c6', 'Nf3', 'd5', 'd3', 'dxe4'), san: 'Ne5', ...pct(6) },
      { kind: 'flagged', line: at('e4', 'c6', 'Nf3', 'd5', 'd3', 'dxe4'), san: 'Ne5', atLeast: 'blunder' },
      { kind: 'move-score', line: at('e4', 'c6', 'Nf3', 'd5', 'd3', 'dxe4'), san: 'Ne5', ...pawns(-4.5) },
    ],
  },
];
