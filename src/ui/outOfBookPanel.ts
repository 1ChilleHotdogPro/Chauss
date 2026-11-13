import { STRENGTHS, type StopSummary, type StrengthId } from '../bot/outOfBook';

export interface OutOfBookElements {
  section: HTMLElement;
  lead: HTMLElement;
  choices: HTMLElement;
  stop: HTMLButtonElement;
  playOn: HTMLButtonElement;
  strength: HTMLSelectElement;
  result: HTMLElement;
  engine: HTMLElement;
}

export interface OutOfBookModel {
  /**
   * - prompt: ask what to do now;
   * - stopped: the user chose to stop; show what Stockfish thinks;
   * - engine: the user plays on against a weakened Stockfish.
   */
  state: 'prompt' | 'stopped' | 'engine';
  lead: string;
  strength: StrengthId;
  /** Stopped: Stockfish's view of the position (null while it is still looking). */
  summary: StopSummary | null;
  /** Stopped: the verdict on the move that left the data, when known. */
  verdict: string | null;
  /** Stopped: the key idea of the line, when one is written for it. */
  idea: string | null;
  /** Playing on: whose turn, or how the game ended. */
  engineText: string | null;
}

/** Fill the strength list once, from the table in the logic (so the labels cannot drift). */
export function fillStrengthOptions(select: HTMLSelectElement): void {
  select.replaceChildren(
    ...STRENGTHS.map((strength) => {
      const option = document.createElement('option');
      option.value = strength.id;
      option.textContent = `${strength.label} (Skill Level ${strength.skill} of 20, depth ${strength.depth})`;
      return option;
    }),
  );
}

function paragraph(label: string | null, text: string, name: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.dataset.part = name;
  if (label) {
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    p.append(strong);
  }
  p.append(text);
  return p;
}

/** The box shown when a drill or a game has left the opening data. `model` null hides it. */
export function renderOutOfBook(elements: OutOfBookElements, model: OutOfBookModel | null): void {
  elements.section.hidden = model === null;
  if (!model) return;
  elements.section.dataset.state = model.state;
  elements.lead.textContent = model.lead;

  elements.choices.hidden = model.state === 'engine';
  elements.stop.hidden = model.state !== 'prompt';
  if (elements.strength.value !== model.strength) elements.strength.value = model.strength;

  elements.engine.hidden = model.state !== 'engine' || !model.engineText;
  elements.engine.textContent = model.state === 'engine' ? (model.engineText ?? '') : '';

  elements.result.hidden = model.state !== 'stopped';
  if (model.state !== 'stopped') {
    elements.result.replaceChildren();
    delete elements.result.dataset.signature;
    return;
  }
  const parts: HTMLParagraphElement[] = [];
  const summary = model.summary;
  if (!summary) {
    parts.push(paragraph(null, 'Stockfish is looking at the position…', 'pending'));
  } else {
    parts.push(paragraph(`Stockfish (depth ${summary.depth})`, summary.balance, 'balance'));
    if (summary.best) parts.push(paragraph('Best move', summary.best, 'best'));
    if (summary.line) parts.push(paragraph('Main line', summary.line, 'line'));
  }
  if (model.verdict) parts.push(paragraph('Last move', model.verdict, 'verdict'));
  if (model.idea) parts.push(paragraph('Key idea', model.idea, 'idea'));
  // Redraw only when something changed, so the text does not flicker while the engine deepens.
  const signature = parts.map((p) => p.textContent).join('\n');
  if (elements.result.dataset.signature !== signature) {
    elements.result.dataset.signature = signature;
    elements.result.replaceChildren(...parts);
  }
}
