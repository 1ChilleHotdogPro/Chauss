import { formatScore, winPercent, type Score } from '../analysis/eval';
import type { Side } from '../game/game';

export interface EvalBar {
  /**
   * @param score best score for the position on the board (White's view); when undefined the bar
   *              keeps showing its last value, so it does not jump while the engine starts up
   */
  update(input: { shown: boolean; score: Score | undefined; orientation: Side }): void;
}

/**
 * The bar beside the board. The light part is White's winning chances (Lichess formula), so an
 * equal position is half and half.
 */
export function createEvalBar(element: HTMLElement): EvalBar {
  const fill = element.querySelector<HTMLElement>('.evalbar-fill');
  const label = element.querySelector<HTMLElement>('.evalbar-score');
  if (!fill || !label) throw new Error('eval bar markup is incomplete');

  return {
    update({ shown, score, orientation }) {
      element.hidden = !shown;
      element.dataset.orientation = orientation;
      if (!score) return;

      const white = winPercent(score, 'white');
      const text = formatScore(score);
      fill.style.height = `${white.toFixed(1)}%`;
      label.textContent = text;
      element.dataset.score = text;
      element.dataset.white = String(Math.round(white));
      element.setAttribute('aria-label', `Evaluation ${text} (White's winning chances ${Math.round(white)}%)`);

      // The number sits at the end of the side that is ahead, in a colour that contrasts with it.
      const leader: Side = white >= 50 ? 'white' : 'black';
      label.classList.toggle('on-white', leader === 'white');
      label.classList.toggle('on-black', leader === 'black');
      label.classList.toggle('at-bottom', leader === orientation);
      label.classList.toggle('at-top', leader !== orientation);
    },
  };
}
