import {
  BOARD_STYLES,
  MAX_EXPLOSION_VOLUME,
  PIECE_STYLES,
  type Appearance,
} from '../appearance/appearance';

export interface AppearancePanelOptions {
  dialog: HTMLDialogElement;
  initial: Appearance;
  /** Called after every change; returns false if it could not be stored. */
  onChange(appearance: Appearance): boolean;
  /** Play one explosion at the current volume. */
  onPreviewExplosion(): void;
}

function need<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Settings markup is missing ${selector}`);
  return element;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  return created;
}

/** Piece elements chessground draws (`<piece class="knight white">`), reused for the previews. */
function piece(role: string, colour: string): HTMLElement {
  return element('piece' as 'span', `${role} ${colour}`);
}

/** The Settings tiles for choosing the board and the pieces, and the explosion volume. */
export function createAppearancePanel(options: AppearancePanelOptions): void {
  const { dialog } = options;
  let appearance: Appearance = { ...options.initial };
  const boardBox = need<HTMLElement>(dialog, '#board-styles');
  const pieceBox = need<HTMLElement>(dialog, '#piece-styles');
  const volume = need<HTMLInputElement>(dialog, '#explosion-volume');
  const volumeText = need<HTMLElement>(dialog, '#explosion-volume-text');
  const testButton = need<HTMLButtonElement>(dialog, '#explosion-test');

  function tile(name: string, selected: boolean, preview: HTMLElement, onPick: () => void): HTMLButtonElement {
    const button = element('button', 'style-tile');
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(selected));
    const label = element('span', 'style-name');
    label.textContent = name;
    button.append(preview, label);
    button.addEventListener('click', onPick);
    return button;
  }

  function render(): void {
    boardBox.replaceChildren(
      ...BOARD_STYLES.map((style) => {
        const preview = element('span', 'style-preview');
        preview.dataset.board = style.id;
        preview.append(element('span', 'board-swatch squares'));
        return tile(style.name, style.id === appearance.board, preview, () => choose({ board: style.id }));
      }),
    );
    pieceBox.replaceChildren(
      ...PIECE_STYLES.map((style) => {
        const preview = element('span', 'style-preview wide');
        preview.dataset.board = appearance.board === 'cursed' ? 'brown' : appearance.board;
        preview.dataset.pieces = style.id;
        const swatch = element('span', 'board-swatch pair');
        swatch.append(piece('knight', 'white'), piece('queen', 'black'));
        preview.append(swatch);
        return tile(style.name, style.id === appearance.pieces, preview, () => choose({ pieces: style.id }));
      }),
    );
    volumeText.textContent = `${Math.round((appearance.explosionVolume / MAX_EXPLOSION_VOLUME) * 100)}%`;
  }

  function choose(change: Partial<Appearance>): void {
    appearance = { ...appearance, ...change };
    const stored = options.onChange(appearance);
    need<HTMLElement>(dialog, '#settings-save-warning').hidden = stored;
    render();
  }

  volume.max = String(MAX_EXPLOSION_VOLUME);
  volume.step = '0.1';
  volume.value = String(appearance.explosionVolume);
  volume.addEventListener('input', () => choose({ explosionVolume: Number(volume.value) }));
  testButton.addEventListener('click', options.onPreviewExplosion);

  render();
}
