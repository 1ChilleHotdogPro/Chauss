import type { Verdict } from '../analysis/eval';
import { verdictName, verdictSymbol } from '../analysis/verdictText';
import type { MoveRecord } from '../game/game';

/**
 * Put the engine's verdict on each move button: "?!", "?" or "??" after the move (drawn by CSS
 * from `data-mark`, so the button's text stays the plain move) and a tooltip naming it.
 */
export function updateMoveMarks(
  list: HTMLOListElement,
  verdictFor: (ply: number) => Verdict | undefined,
): void {
  for (const button of list.querySelectorAll<HTMLButtonElement>('button.move')) {
    const verdict = verdictFor(Number(button.dataset.ply));
    const current = button.dataset.verdict;
    if (verdict === current) continue;
    if (!verdict) {
      delete button.dataset.verdict;
      delete button.dataset.mark;
      button.removeAttribute('title');
      continue;
    }
    button.dataset.verdict = verdict;
    const mark = verdictSymbol(verdict);
    if (mark) button.dataset.mark = mark;
    else delete button.dataset.mark;
    button.title = verdictName(verdict);
  }
}

/**
 * Renders the moves as "1. e4 e5  2. Nf3 Nc6 ...". Each move is a button that
 * jumps to the position after that move.
 */
export function renderMoveList(
  list: HTMLOListElement,
  moves: readonly MoveRecord[],
  currentPly: number,
  onSelect: (ply: number) => void,
): void {
  list.replaceChildren();
  let row: HTMLLIElement | null = null;
  let current: HTMLButtonElement | null = null;

  for (const move of moves) {
    if (!row || move.color === 'white') {
      row = document.createElement('li');
      const number = document.createElement('span');
      number.className = 'move-number';
      number.textContent = `${Math.ceil(move.ply / 2)}.`;
      row.append(number);
      if (move.color === 'black') {
        // The line starts with a Black move: leave White's slot empty.
        const gap = document.createElement('span');
        gap.className = 'move-gap';
        gap.textContent = '…';
        row.append(gap);
      }
      list.append(row);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'move';
    button.textContent = move.san;
    button.dataset.ply = String(move.ply);
    if (move.ply === currentPly) {
      button.classList.add('current');
      button.setAttribute('aria-current', 'true');
      current = button;
    }
    button.addEventListener('click', () => onSelect(move.ply));
    row.append(button);
  }

  current?.scrollIntoView({ block: 'nearest' });
}
