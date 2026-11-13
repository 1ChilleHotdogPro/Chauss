import type { DrillView } from '../drill/controller';
import { cardLabel } from '../repertoire/repertoire';

export interface DrillPanelElements {
  prompt: HTMLElement;
  feedback: HTMLElement;
  counts: HTMLElement;
  score: HTMLElement;
  next: HTMLButtonElement;
}

const WHY: Record<NonNullable<DrillView['targetReason']>, string> = {
  due: 'This line is due for review.',
  new: 'A new line.',
  ahead: 'Nothing is due — practising ahead.',
};

/** What the drill panel says. `view` is null while the opening data is still loading (or missing). */
export function renderDrillPanel(elements: DrillPanelElements, view: DrillView | null, unavailable: string | null): void {
  const { prompt, feedback, counts, score, next } = elements;

  if (!view) {
    prompt.textContent = unavailable ?? 'Loading opening data…';
    prompt.dataset.state = unavailable ? 'unavailable' : 'loading';
    feedback.hidden = true;
    counts.textContent = '';
    score.textContent = '';
    next.disabled = true;
    return;
  }

  next.disabled = false;
  if (view.finished) {
    prompt.dataset.state = 'finished';
    prompt.textContent =
      view.lineScore.asked > 0
        ? `End of this line: ${view.lineScore.right} of ${view.lineScore.asked} right first time. Press Next line (or Enter).`
        : 'This line ends here. Press Next line (or Enter).';
  } else if (view.card) {
    prompt.dataset.state = 'asking';
    const why = view.targetReason && view.lineScore.asked === 0 ? ` ${WHY[view.targetReason]}` : '';
    const label = cardLabel(view.card);
    // "After 3...Nf6" -> "after 3...Nf6": only the first letter, the move keeps its capital.
    prompt.textContent = `Your move as White (${label.charAt(0).toLowerCase()}${label.slice(1)}).${why}`;
  } else {
    prompt.dataset.state = 'idle';
    prompt.textContent = 'Press Next line to start.';
  }

  feedback.dataset.kind = view.feedback.kind;
  if (view.feedback.kind === 'none') {
    feedback.hidden = true;
    feedback.textContent = '';
  } else {
    feedback.hidden = false;
    if (feedback.textContent !== view.feedback.text) feedback.textContent = view.feedback.text;
  }

  counts.textContent = `Due now: ${view.counts.due} · New: ${view.counts.new} · Positions to learn: ${view.counts.total}`;
  counts.dataset.due = String(view.counts.due);
  counts.dataset.new = String(view.counts.new);
  counts.dataset.total = String(view.counts.total);
  score.textContent =
    view.sittingScore.asked > 0
      ? `This sitting: ${view.sittingScore.right} of ${view.sittingScore.asked} right first time.`
      : '';
}
