import type { PositionEval } from './analysis';
import { judgeMove, sideToMove } from './eval';

/** Opacity of an arrow for a move that gives up nothing, and for one that is a blunder or worse. */
export const ARROW_OPACITY_MAX = 0.9;
export const ARROW_OPACITY_MIN = 0.2;
/** A drop in winning chances (percentage points) up to here still counts as "just as good". */
const NO_FADE_UNTIL = 3;
/** From here on (the blunder threshold) an arrow is as faint as it gets. */
const FULL_FADE_AT = 30;

/**
 * How solid to draw the arrow of a move, from how much worse it is than the best move
 * (`drop` = percentage points of winning chances lost). Rounded to a tenth, which is as fine as the
 * board can draw.
 */
export function arrowOpacity(drop: number): number {
  const t = Math.min(1, Math.max(0, (drop - NO_FADE_UNTIL) / (FULL_FADE_AT - NO_FADE_UNTIL)));
  const opacity = ARROW_OPACITY_MAX - t * (ARROW_OPACITY_MAX - ARROW_OPACITY_MIN);
  return Math.round(opacity * 10) / 10;
}

/** One opacity per engine line (best first): the best move is solid, worse ones fade. */
export function arrowOpacities(evaluation: PositionEval): number[] {
  const best = evaluation.lines[0];
  if (!best) return [];
  const mover = sideToMove(evaluation.fen);
  return evaluation.lines.map((line, index) =>
    index === 0
      ? ARROW_OPACITY_MAX
      : arrowOpacity(judgeMove({ before: best.score, after: line.score, mover, playedBest: false }).drop),
  );
}
