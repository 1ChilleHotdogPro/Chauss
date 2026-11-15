import { rootMoves } from '../drill/hub';
import type { ProgressStore } from '../drill/progress';
import type { OpeningDef } from '../openings/registry';
import { drillCard, openingBoard, openingSummary, PROGRESS_TITLE, progressText, sideBadge } from './drillCard';

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
  /** The stored drill progress of every opening, shown on each card. */
  progress?: () => ProgressStore;
}

export interface OpeningPicker {
  /** Open the picker. Without a current opening it cannot be dismissed: a choice is needed. */
  show(): void;
  isOpen(): boolean;
}

const sideName = (opening: OpeningDef): string => (opening.side === 'white' ? 'White' : 'Black');

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

  /** One card per opening: its position, the side you play, its moves and your progress in it. */
  function render(): void {
    const store = options.progress?.();
    const now = Date.now();
    list!.replaceChildren(
      ...openings.map((opening) => {
        const available = options.isAvailable?.(opening.id) ?? true;
        const lines: { text: string; className: string; title?: string }[] = [
          { text: rootMoves(opening), className: 'card-line' },
        ];
        if (!available) {
          lines.push({ text: 'Coming soon: the data for this opening is still being built.', className: 'card-note' });
        } else if (store) {
          lines.push({ text: progressText(openingSummary(store, opening.id, now)), className: 'card-progress', title: PROGRESS_TITLE });
        }
        const choice = drillCard({
          className: 'opening-choice',
          title: opening.name,
          board: openingBoard(opening),
          badge: sideBadge(opening.side, `You play ${sideName(opening)}`),
          tag: opening.id === current ? 'Open now' : undefined,
          lines,
          chevron: available,
        });
        choice.dataset.opening = opening.id;
        choice.setAttribute('aria-current', String(opening.id === current));
        if (!available) {
          choice.disabled = true;
          return choice;
        }
        choice.addEventListener('click', () => {
          if (opening.id === current) dialog.close();
          else onChoose(opening.id);
        });
        return choice;
      }),
    );
  }
  render();

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

  const open = (): void => {
    if (dialog.open) return;
    // Drawn afresh each time, so the progress on the cards is up to date.
    render();
    dialog.showModal();
  };
  button.addEventListener('click', open);

  return {
    show: open,
    isOpen: () => dialog.open,
  };
}
