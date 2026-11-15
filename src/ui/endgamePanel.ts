import type { EndgameView } from '../endgames/controller';
import type { EndgamePositionRecord } from '../endgames/progress';

export interface EndgamePanelElements {
  title: HTMLElement;
  lead: HTMLElement;
  prompt: HTMLElement;
  feedback: HTMLElement;
  counts: HTMLElement;
  summary: HTMLElement;
  next: HTMLButtonElement;
  retry: HTMLButtonElement;
  again: HTMLButtonElement;
}

/** "★★☆": a result out of three. */
export function starText(stars: number): string {
  const shown = Math.max(0, Math.min(3, stars));
  return '★'.repeat(shown) + '☆'.repeat(3 - shown);
}

const sideName = (side: 'white' | 'black'): string => (side === 'white' ? 'White' : 'Black');

/** What the endgame drill panel says. `records` holds the stored results of this drill's positions. */
export function renderEndgamePanel(
  elements: EndgamePanelElements,
  view: EndgameView,
  records: Readonly<Record<string, EndgamePositionRecord>>,
): void {
  const { drill, position } = view;
  const total = drill.positions.length;
  const { title, lead, prompt, feedback, counts, summary, next, retry, again } = elements;

  title.textContent = drill.title;
  lead.textContent = `${drill.skill}. ${drill.description}`;

  if (view.runFinished) {
    renderSummary(elements, view);
    return;
  }
  summary.hidden = true;
  again.hidden = true;
  next.hidden = false;
  retry.hidden = false;

  const best = records[position.id];
  const bestText = best && best.attempts > 0 ? ` Your best: ${starText(best.bestStars)}.` : '';
  const goal = drill.goal === 'mate' ? `Best play mates in ${position.par}.` : `Hold it for ${position.par} moves.`;

  prompt.dataset.state = view.state;
  switch (view.state) {
    case 'your-move':
      prompt.textContent = `Position ${view.index + 1} of ${total}: your move as ${sideName(view.side)}. ${goal}${bestText}`;
      break;
    case 'judging':
      prompt.textContent = 'Stockfish is checking your move…';
      break;
    case 'opponent':
      prompt.textContent = `${sideName(view.side === 'white' ? 'black' : 'white')} replies…`;
      break;
    case 'solved':
    case 'failed': {
      const result = view.results[view.index];
      prompt.textContent = `${view.state === 'solved' ? 'Solved' : 'Not solved'}: ${starText(result?.stars ?? 0)}`;
      break;
    }
    case 'engine-failed':
      prompt.textContent = view.error ?? 'Stockfish could not be started.';
      break;
  }

  const hintText = view.state === 'your-move' && view.feedback.kind === 'none' && view.sans.length === 0 ? (position.hint ?? '') : '';
  const text = view.feedback.kind === 'none' ? hintText : view.feedback.text;
  feedback.dataset.kind = view.feedback.kind === 'none' ? 'none' : view.feedback.kind;
  feedback.hidden = text === '';
  if (feedback.textContent !== text) feedback.textContent = text;

  const limit = view.moveLimit !== null ? ` of at most ${view.moveLimit}` : '';
  counts.textContent = `Moves: ${view.movesMade}${limit} · Mistakes: ${view.mistakes}`;
  counts.dataset.moves = String(view.movesMade);
  counts.dataset.mistakes = String(view.mistakes);

  const finished = view.state === 'solved' || view.state === 'failed';
  next.disabled = !finished;
  next.textContent = view.index + 1 < total ? 'Next position' : 'See your results';
  retry.disabled = view.state === 'judging';
}

function renderSummary(elements: EndgamePanelElements, view: EndgameView): void {
  const { prompt, feedback, counts, summary, next, retry, again } = elements;
  const earned = view.results.reduce((sum, result) => sum + (result?.stars ?? 0), 0);
  const solved = view.results.filter((result) => result?.solved).length;
  prompt.dataset.state = 'summary';
  prompt.textContent = `Drill finished: ${solved} of ${view.results.length} solved, ${earned} of ${view.results.length * 3} stars.`;
  feedback.hidden = true;
  feedback.dataset.kind = 'none';
  counts.textContent = '';

  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const label of ['Position', 'Result', 'Moves', 'Mistakes']) {
    const cell = document.createElement('th');
    cell.textContent = label;
    head.append(cell);
  }
  const body = table.createTBody();
  view.results.forEach((result, index) => {
    const row = body.insertRow();
    row.dataset.position = view.drill.positions[index]?.id ?? '';
    const stars = document.createElement('span');
    stars.className = 'stars';
    stars.textContent = starText(result?.stars ?? 0);
    const par = view.drill.positions[index]?.par;
    row.insertCell().textContent = view.drill.goal === 'mate' && par ? `${index + 1} (mate in ${par})` : String(index + 1);
    const resultCell = row.insertCell();
    resultCell.append(stars, result ? (result.solved ? '' : ' not solved') : ' skipped');
    row.insertCell().textContent = result ? String(result.moves) : '–';
    row.insertCell().textContent = result ? String(result.mistakes) : '–';
  });
  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = '★★★ mate without mistakes and close to the best · ★★ without mistakes · ★ with mistakes.';
  summary.replaceChildren(table, note);
  summary.hidden = false;

  next.hidden = true;
  retry.hidden = true;
  again.hidden = false;
}
