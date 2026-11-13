import type { BotStyle } from '../bot/choose';

export interface PlayPanelElements {
  styleRealistic: HTMLInputElement;
  stylePunish: HTMLInputElement;
  prompt: HTMLElement;
  last: HTMLElement;
}

export interface PlayPanelModel {
  style: BotStyle;
  /**
   * - your-move: the user's turn;
   * - thinking: the bot is about to play;
   * - waiting: the position is being looked up on Lichess;
   * - out: the game has left the opening data (the box below says what next);
   * - over: checkmate, stalemate or a draw.
   */
  state: 'your-move' | 'thinking' | 'waiting' | 'out' | 'over';
  /** Extra words for the state, e.g. how the game ended. */
  detail: string | null;
  /** What the bot just played and why, if anything. */
  last: { text: string; kind: 'book' | 'mistake' } | null;
}

const PROMPT: Record<PlayPanelModel['state'], string> = {
  'your-move': 'Your move as White.',
  thinking: 'Black is choosing a move…',
  waiting: 'Looking this position up on Lichess…',
  out: 'The game has left the opening data.',
  over: 'Game over.',
};

export function renderPlayPanel(elements: PlayPanelElements, model: PlayPanelModel): void {
  elements.styleRealistic.checked = model.style === 'realistic';
  elements.stylePunish.checked = model.style === 'punish';

  elements.prompt.dataset.state = model.state;
  elements.prompt.textContent = model.detail ? `${PROMPT[model.state]} ${model.detail}` : PROMPT[model.state];

  const last = model.last;
  elements.last.hidden = last === null;
  elements.last.dataset.kind = last?.kind === 'mistake' ? 'wrong' : last ? 'correct' : 'none';
  elements.last.textContent = last?.text ?? '';
}
