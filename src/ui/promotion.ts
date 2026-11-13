import type { PromotionPiece, Side } from '../game/game';

export interface PromotionPicker {
  /** Show the picker. `onDone` gets the chosen piece, or null if the user cancelled. */
  open(color: Side, onDone: (piece: PromotionPiece | null) => void): void;
  /** Close without choosing (does nothing if the picker is not open). */
  cancel(): void;
  isOpen(): boolean;
}

const CHOICES: { piece: PromotionPiece; name: string; white: string; black: string }[] = [
  { piece: 'q', name: 'Queen', white: '♕', black: '♛' },
  { piece: 'r', name: 'Rook', white: '♖', black: '♜' },
  { piece: 'b', name: 'Bishop', white: '♗', black: '♝' },
  { piece: 'n', name: 'Knight', white: '♘', black: '♞' },
];

/**
 * A small dialog laid over the board that asks which piece a pawn becomes.
 * (chessground has no promotion dialog of its own.)
 */
export function createPromotionPicker(container: HTMLElement): PromotionPicker {
  let pending: ((piece: PromotionPiece | null) => void) | null = null;

  function finish(piece: PromotionPiece | null): void {
    const callback = pending;
    if (!callback) return;
    pending = null;
    container.hidden = true;
    container.replaceChildren();
    callback(piece);
  }

  // Clicking the dimmed area around the dialog cancels.
  container.addEventListener('click', (event) => {
    if (event.target === container) finish(null);
  });

  return {
    open(color, onDone) {
      finish(null); // never keep two questions open
      pending = onDone;

      const dialog = document.createElement('div');
      dialog.className = 'promotion-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-label', 'Choose a piece for your pawn');

      const title = document.createElement('p');
      title.textContent = 'Promote your pawn to:';
      dialog.append(title);

      const row = document.createElement('div');
      row.className = 'promotion-choices';
      for (const choice of CHOICES) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.piece = choice.piece;
        const glyph = document.createElement('span');
        glyph.className = 'promotion-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = color === 'white' ? choice.white : choice.black;
        const label = document.createElement('span');
        label.textContent = choice.name;
        button.append(glyph, label);
        button.addEventListener('click', () => finish(choice.piece));
        row.append(button);
      }
      dialog.append(row);

      container.replaceChildren(dialog);
      container.hidden = false;
      row.querySelector('button')?.focus();
    },
    cancel: () => finish(null),
    isOpen: () => pending !== null,
  };
}
