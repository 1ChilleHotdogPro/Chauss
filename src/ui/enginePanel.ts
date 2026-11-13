import type { PositionEval } from '../analysis/analysis';
import { formatScore, type Verdict } from '../analysis/eval';
import { numberedLine, pvToSan } from '../analysis/pv';
import type { EngineState } from '../engine/engine';

export interface EnginePanelElements {
  status: HTMLElement;
  lines: HTMLOListElement;
  verdict: HTMLElement;
  toggleEval: HTMLButtonElement;
  toggleArrows: HTMLButtonElement;
}

export interface EnginePanelModel {
  engineState: EngineState;
  engineName: string;
  evalShown: boolean;
  arrowsShown: boolean;
  /** Result for the position on the board, if any yet. */
  evaluation: PositionEval | undefined;
  /** What to say about the move that led here; null = say nothing. */
  verdict: { text: string; kind: Verdict | 'pending' } | null;
}

/** How many half-moves of each engine line to show. */
const LINE_LENGTH = 8;

function statusText(model: EnginePanelModel): string {
  if (model.engineState === 'loading') return 'Engine: loading Stockfish…';
  if (model.engineState === 'failed') {
    return 'Engine could not be loaded. The board still works, but there are no evaluations.';
  }
  const name = model.engineName || 'Engine';
  const evaluation = model.evaluation;
  if (!evaluation) return `${name} · thinking…`;
  if (evaluation.terminal) return `${name} · game over`;
  return `${name} · depth ${evaluation.depth}`;
}

export function renderEnginePanel(elements: EnginePanelElements, model: EnginePanelModel): void {
  const { status, lines, verdict, toggleEval, toggleArrows } = elements;

  toggleEval.setAttribute('aria-pressed', String(model.evalShown));
  toggleEval.textContent = model.evalShown ? 'Hide eval' : 'Show eval';
  toggleArrows.setAttribute('aria-pressed', String(model.arrowsShown));
  toggleArrows.textContent = model.arrowsShown ? 'Hide arrows' : 'Show arrows';

  status.dataset.state = model.engineState;
  status.dataset.depth = String(model.evaluation?.depth ?? 0);
  const text = statusText(model);
  if (status.textContent !== text) status.textContent = text;

  // The engine's top lines, only while the evaluation is switched on.
  const evaluation = model.evaluation;
  const rows =
    model.evalShown && evaluation
      ? evaluation.lines
          .filter((line) => line.pv.length > 0)
          .map((line) => ({
            score: formatScore(line.score),
            moves: numberedLine(evaluation.fen, pvToSan(evaluation.fen, line.pv, LINE_LENGTH)),
          }))
      : [];
  const signature = rows.map((row) => `${row.score} ${row.moves}`).join('\n');
  if (lines.dataset.signature !== signature) {
    lines.dataset.signature = signature;
    lines.replaceChildren(
      ...rows.map((row) => {
        const item = document.createElement('li');
        const score = document.createElement('span');
        score.className = 'line-score';
        score.textContent = row.score;
        const moves = document.createElement('span');
        moves.className = 'line-moves';
        moves.textContent = row.moves;
        item.append(score, moves);
        return item;
      }),
    );
  }
  lines.hidden = rows.length === 0;

  if (model.verdict) {
    verdict.hidden = false;
    verdict.dataset.verdict = model.verdict.kind;
    if (verdict.textContent !== model.verdict.text) verdict.textContent = model.verdict.text;
  } else {
    verdict.hidden = true;
    verdict.textContent = '';
    delete verdict.dataset.verdict;
  }
}
