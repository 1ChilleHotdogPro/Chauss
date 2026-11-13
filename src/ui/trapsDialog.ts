import { formatScore } from '../analysis/eval';
import type { Trap, TrapFile } from '../explore/traps';
import { compactNumber, sharePercent } from './explorePanel';

export interface TrapsDialogOptions {
  dialog: HTMLDialogElement;
  openButton: HTMLButtonElement;
  /** Put the trap's position on the board and explain the bad move. */
  onShow(trap: Trap): void;
}

export interface TrapsDialog {
  /** Fill the list (called once the trap file has loaded). */
  setTraps(file: TrapFile): void;
  setFailed(message: string): void;
  isOpen(): boolean;
}

/** "1. e4 e5 2. Nf3 Nc6 3. c3" — a line from the start position with move numbers. */
export function numberFromStart(sans: readonly string[]): string {
  return sans.map((san, index) => (index % 2 === 0 ? `${index / 2 + 1}. ${san}` : san)).join(' ');
}

/** The bad move with its number and mark: "3... f6??" or "4. Ng5?". */
function badMove(trap: Trap): string {
  const number = Math.floor(trap.line.length / 2) + 1;
  const mark = trap.verdict === 'blunder' ? '??' : '?';
  return trap.victim === 'white' ? `${number}. ${trap.move.san}${mark}` : `${number}... ${trap.move.san}${mark}`;
}

/** The punishing line with move numbers, continuing after the bad move. */
function refutationLine(trap: Trap): string {
  const parts: string[] = [];
  let ply = trap.line.length + 1; // the bad move is ply line.length (0-based), the reply comes next
  trap.refutation.san.forEach((san, index) => {
    const number = Math.floor(ply / 2) + 1;
    if (ply % 2 === 0) parts.push(`${number}. ${san}`);
    else parts.push(index === 0 ? `${number}... ${san}` : san);
    ply += 1;
  });
  return parts.join(' ');
}

function trapItem(trap: Trap, onShow: (trap: Trap) => void): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'trap';
  item.dataset.id = trap.id;
  item.dataset.kind = trap.kind;
  item.dataset.verdict = trap.verdict;

  const title = document.createElement('p');
  title.className = 'trap-title';
  const lead = document.createElement('span');
  lead.className = 'trap-lead';
  lead.textContent = numberFromStart(trap.line);
  const bad = document.createElement('strong');
  bad.textContent = ` ${badMove(trap)}`;
  title.append(lead, bad);

  const facts = document.createElement('p');
  facts.className = 'hint';
  const opening = trap.opening ? `${trap.opening}. ` : '';
  facts.textContent = `${opening}Played in ${sharePercent(trap.popular.share)} of games at this level (${compactNumber(trap.popular.games)} games).`;

  const punish = document.createElement('p');
  punish.className = 'trap-punish';
  const score = document.createElement('span');
  score.className = 'line-score';
  score.textContent = formatScore(trap.scoreAfter);
  punish.append(document.createTextNode(`${trap.refutation.why} `), score, document.createTextNode(` ${refutationLine(trap)}`));

  const show = document.createElement('button');
  show.type = 'button';
  show.className = 'trap-show';
  show.textContent = 'Show on the board';
  show.addEventListener('click', () => onShow(trap));

  item.append(title, facts, punish, show);
  return item;
}

/**
 * The list of the opening's most common losing moves — for the opponent to make (punish them) and
 * for White to avoid. Every entry comes from the data and a deeper Stockfish check, not from books.
 */
export function createTrapsDialog(options: TrapsDialogOptions): TrapsDialog {
  const { dialog, openButton } = options;
  const body = dialog.querySelector<HTMLElement>('#traps-body');
  const closeButton = dialog.querySelector<HTMLButtonElement>('#traps-close');
  if (!body || !closeButton) throw new Error('traps dialog markup is incomplete');

  openButton.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  const show = (trap: Trap): void => {
    dialog.close();
    options.onShow(trap);
  };

  return {
    setTraps(file) {
      const exploit = file.traps.filter((trap) => trap.kind === 'exploit');
      const avoid = file.traps.filter((trap) => trap.kind === 'avoid');
      openButton.textContent = `Common mistakes in this opening (${file.traps.length})`;
      openButton.dataset.count = String(file.traps.length);

      const parts: HTMLElement[] = [];
      const intro = document.createElement('p');
      intro.className = 'hint';
      intro.textContent =
        `Moves that are often played at this level and that Stockfish (${file.meta.engine.name}, depth ${file.meta.engine.depth}) says lose at least a mistake's worth. Most often played first.`;
      parts.push(intro);

      for (const [title, id, traps] of [
        ['Mistakes your opponents make — punish them', 'traps-exploit', exploit],
        ['Mistakes to avoid as White', 'traps-avoid', avoid],
      ] as const) {
        const heading = document.createElement('h3');
        heading.textContent = `${title} (${traps.length})`;
        parts.push(heading);
        if (traps.length === 0) {
          const none = document.createElement('p');
          none.className = 'hint';
          none.textContent = 'None found in the data.';
          parts.push(none);
          continue;
        }
        const list = document.createElement('ol');
        list.className = 'trap-list';
        list.id = id;
        list.append(...traps.map((trap) => trapItem(trap, show)));
        parts.push(list);
      }
      body.replaceChildren(...parts);
    },
    setFailed(message) {
      openButton.disabled = true;
      body.textContent = `The list could not be loaded (${message}).`;
    },
    isOpen: () => dialog.open,
  };
}
