import type { MoveRecord } from '../game/game';

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
