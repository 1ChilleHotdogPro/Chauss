import { CLASSIFICATIONS, type SideSummary } from '../analysis/accuracy';
import { CLASSIFICATION_INFO } from '../analysis/classificationText';
import type { Classification } from '../analysis/classify';
import type { Side } from '../game/game';

export interface AnalysisPanelElements {
  input: HTMLElement;
  pgn: HTMLTextAreaElement;
  start: HTMLButtonElement;
  error: HTMLElement;
  run: HTMLElement;
  progress: HTMLProgressElement;
  progressText: HTMLElement;
  cancel: HTMLButtonElement;
  result: HTMLElement;
  summary: HTMLElement;
  another: HTMLButtonElement;
}

export interface AnalysisPanelModel {
  /** Show the box for pasting a game. */
  showInput: boolean;
  /** Why the game could not be read or analysed, if it could not. */
  error: string | null;
  /** While analysing: positions searched so far, out of how many. */
  progress: { done: number; total: number } | null;
  /** How long the engine looks at each move, in words ("Depth 14"). */
  limitLabel: string;
  players: Record<Side, string>;
  /** Per side, once at least one move has been classified. */
  summary: Record<Side, SideSummary> | null;
  /** True when the analysis was stopped before the end. */
  partial: boolean;
}

/** A small round badge for a classification, as used in the move list and the summary. */
export function classificationIcon(classification: Classification): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.className = 'class-icon';
  icon.dataset.class = classification;
  icon.textContent = CLASSIFICATION_INFO[classification].symbol;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function formatAccuracy(value: number | undefined): string {
  return value === undefined ? '–' : value.toFixed(1);
}

function summaryTable(model: AnalysisPanelModel, summary: Record<Side, SideSummary>): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'analysis-table';
  const head = table.createTHead().insertRow();
  for (const text of ['', model.players.white, model.players.black]) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = text;
    head.append(cell);
  }

  const body = table.createTBody();
  const accuracy = body.insertRow();
  accuracy.className = 'analysis-accuracy';
  const label = document.createElement('th');
  label.scope = 'row';
  label.textContent = 'Accuracy';
  accuracy.append(label);
  for (const side of ['white', 'black'] as const) {
    const cell = accuracy.insertCell();
    cell.dataset.side = side;
    cell.textContent = formatAccuracy(summary[side].accuracy);
  }

  for (const classification of CLASSIFICATIONS) {
    const row = body.insertRow();
    row.dataset.class = classification;
    const name = document.createElement('th');
    name.scope = 'row';
    name.append(classificationIcon(classification), ` ${CLASSIFICATION_INFO[classification].name}`);
    row.append(name);
    for (const side of ['white', 'black'] as const) {
      const count = summary[side].counts[classification];
      const cell = row.insertCell();
      cell.dataset.side = side;
      cell.textContent = count > 0 ? String(count) : '·';
    }
  }
  return table;
}

export function renderAnalysisPanel(elements: AnalysisPanelElements, model: AnalysisPanelModel): void {
  elements.input.hidden = !model.showInput;
  elements.error.hidden = model.error === null;
  elements.error.textContent = model.error ?? '';

  const progress = model.progress;
  elements.run.hidden = progress === null;
  elements.start.disabled = progress !== null;
  if (progress) {
    elements.progress.max = progress.total;
    elements.progress.value = progress.done;
    const move = Math.min(progress.done, progress.total - 1);
    elements.progressText.textContent = `Analysing… position ${move + 1} of ${progress.total} (${model.limitLabel}).`;
  }

  const summary = model.summary;
  elements.result.hidden = summary === null;
  elements.another.hidden = model.showInput;
  if (summary) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = model.partial
      ? 'Stopped early: the numbers cover only the moves analysed so far.'
      : progress
        ? 'The numbers fill in as the analysis goes on.'
        : `Analysed with Stockfish (${model.limitLabel}). Click a move or the graph to see it on the board.`;
    elements.summary.replaceChildren(summaryTable(model, summary), note);
  }
}
