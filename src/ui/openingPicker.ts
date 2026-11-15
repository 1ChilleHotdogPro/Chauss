import type { OpeningDef } from '../openings/registry';

export interface OpeningPickerOptions {
  dialog: HTMLDialogElement;
  /** The header button that shows the opening and opens the picker. */
  button: HTMLButtonElement;
  openings: readonly OpeningDef[];
  /** The opening being taught now, or null before the first choice. */
  current: string | null;
  /** Called with the id the user picked (the page then reloads with it). */
  onChoose(id: string): void;
  /** False for an opening that is listed but cannot be learned yet (its data is not built). */
  isAvailable?: (id: string) => boolean;
}

export interface OpeningPicker {
  /** Open the picker. Without a current opening it cannot be dismissed: a choice is needed. */
  show(): void;
  isOpen(): boolean;
}

const sideName = (opening: OpeningDef): string => (opening.side === 'white' ? 'White' : 'Black');

/** "1.e4 e5 2.Nf3 Nc6 3.c3": the root moves with move numbers. */
export function rootMoves(opening: OpeningDef): string {
  return opening.rootLine.map((san, index) => (index % 2 === 0 ? `${index / 2 + 1}.${san}` : san)).join(' ');
}

/** The header button's text: "Ponziani · White ▾". */
export function pickerButtonText(opening: OpeningDef | undefined): string {
  return opening ? `${opening.name} · ${sideName(opening)} ▾` : 'Choose an opening ▾';
}

/** The dialog that lists the openings in the registry, and the header button that opens it. */
export function createOpeningPicker(options: OpeningPickerOptions): OpeningPicker {
  const { dialog, button, openings, current, onChoose } = options;
  const list = dialog.querySelector<HTMLElement>('#opening-list');
  const closeButton = dialog.querySelector<HTMLButtonElement>('#opening-close');
  if (!list || !closeButton) throw new Error('opening picker markup is incomplete');

  button.textContent = pickerButtonText(openings.find((opening) => opening.id === current));
  button.dataset.opening = current ?? '';

  list.replaceChildren(
    ...openings.map((opening) => {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'opening-choice';
      choice.dataset.opening = opening.id;
      choice.setAttribute('aria-current', String(opening.id === current));
      const name = document.createElement('strong');
      name.textContent = opening.name;
      const side = document.createElement('span');
      side.textContent = `You play ${sideName(opening)}`;
      const moves = document.createElement('span');
      moves.className = 'hint';
      moves.textContent = rootMoves(opening);
      choice.append(name, side, moves);
      if (!(options.isAvailable?.(opening.id) ?? true)) {
        choice.disabled = true;
        const soon = document.createElement('span');
        soon.className = 'hint';
        soon.textContent = 'Coming soon: the data for this opening is still being built.';
        choice.append(soon);
        return choice;
      }
      choice.addEventListener('click', () => {
        if (opening.id === current) dialog.close();
        else onChoose(opening.id);
      });
      return choice;
    }),
  );

  const required = current === null;
  closeButton.hidden = required;
  // Escape would close it without a choice.
  dialog.addEventListener('cancel', (event) => {
    if (required) event.preventDefault();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && !required) dialog.close();
  });
  closeButton.addEventListener('click', () => dialog.close());
  button.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });

  return {
    show: () => {
      if (!dialog.open) dialog.showModal();
    },
    isOpen: () => dialog.open,
  };
}
