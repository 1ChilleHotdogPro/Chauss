import { Chessground } from '@lichess-org/chessground';
import type { Key } from '@lichess-org/chessground/types';
import type { Game, Side } from '../game/game';

export interface BoardView {
  /** Make the board show exactly what the game says: pieces, side to move, legal moves. */
  sync(): void;
  flip(): void;
  orientation(): Side;
  /**
   * Who may move pieces with the mouse:
   *  - 'side-to-move': whoever's turn it is (exploring);
   *  - 'player-only': the user's colour (see setPlayerSide) on its turn, nobody on the opponent's
   *    (drills and games, where the app plays the other colour);
   *  - 'none': nobody (while the app is showing something).
   * Takes effect at the next sync().
   */
  setInteraction(who: BoardInteraction): void;
  /** The colour the user plays: who 'player-only' lets move. Takes effect at the next sync(). */
  setPlayerSide(side: Side): void;
  /** Put this colour at the bottom (Flip still turns the board afterwards). */
  setOrientation(side: Side): void;
  /** Draw arrows for the engine's suggestions, best first (at most three). An empty list clears them. */
  setArrows(arrows: readonly Arrow[]): void;
  /** Put the classification icon (brilliant, best, ...) at the top right of a square; null removes it. */
  setBadge(badge: MoveBadge | null): void;
  /** Look of the board and pieces (see appearance.css). */
  setLook(look: { board: string; pieces: string }): void;
}

export interface MoveBadge {
  square: string;
  /** Used for the CSS colour (`data-class`). */
  classification: string;
  /** The mark drawn in the round icon, e.g. "!!". */
  symbol: string;
  /** Spoken name, e.g. "Brilliant". */
  name: string;
}

export type BoardInteraction = 'side-to-move' | 'player-only' | 'none';

export interface Arrow {
  from: string;
  to: string;
  /** 0.1 to 1: how solid to draw it. Default: solid. */
  opacity?: number;
}

/** Best move: thick forest green. Second: amber. Third: terracotta. Hex copies of --arrow-1..3 in src/theme.css (an SVG attribute cannot read CSS variables). */
const ARROW_STYLES = [
  { color: '#3b8a45', lineWidth: 12 },
  { color: '#d39b3a', lineWidth: 8 },
  { color: '#b8664a', lineWidth: 6 },
] as const;

/** Chessground insists on its four standard brushes (used for arrows the user draws with the mouse). Arrows the user draws: forest green, brick red, slate blue, candle gold. */
const DEFAULT_BRUSHES = {
  green: { key: 'g', color: '#6f9a5a', opacity: 1, lineWidth: 10 },
  red: { key: 'r', color: '#c4574a', opacity: 1, lineWidth: 10 },
  blue: { key: 'b', color: '#6b8fb0', opacity: 1, lineWidth: 10 },
  yellow: { key: 'y', color: '#e6c27a', opacity: 1, lineWidth: 10 },
};

/** The board draws opacity in steps of a tenth, so each colour gets one brush per step. */
const ARROW_BRUSHES: Record<string, { key: string; color: string; opacity: number; lineWidth: number }> = {};
ARROW_STYLES.forEach((style, index) => {
  for (let tenth = 1; tenth <= 10; tenth++) {
    const key = arrowBrushKey(index, tenth / 10);
    ARROW_BRUSHES[key] = { key, color: style.color, opacity: tenth / 10, lineWidth: style.lineWidth };
  }
});

function arrowBrushKey(index: number, opacity: number): string {
  return `arrow${index}-${Math.round(opacity * 10)}`;
}

/**
 * Draws the board with chessground. Chessground knows no chess rules, so the
 * legal target squares are handed to it from the game after every change.
 */
export function createBoard(
  element: HTMLElement,
  game: Game,
  onUserMove: (from: string, to: string) => void,
): BoardView {
  const ground = Chessground(element, {
    coordinates: true,
    movable: {
      free: false, // only squares listed in `dests` are allowed
      showDests: true,
      rookCastle: false, // castle by moving the king two squares
      events: {
        after: (from: Key, to: Key) => onUserMove(from, to),
      },
    },
    premovable: { enabled: false },
    draggable: { showGhost: true },
    highlight: { lastMove: true, check: true },
    animation: { enabled: true, duration: 150 },
    drawable: { brushes: { ...DEFAULT_BRUSHES, ...ARROW_BRUSHES } },
  });

  let interaction: BoardInteraction = 'side-to-move';
  let playerSide: Side = 'white';

  function sync(): void {
    const last = game.lastMove();
    const turn = game.turn();
    const mayMove = interaction === 'side-to-move' || (interaction === 'player-only' && turn === playerSide);
    ground.set({
      fen: game.fen(),
      turnColor: turn,
      check: game.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: {
        color: mayMove ? turn : undefined,
        dests: mayMove ? game.dests() : new Map(),
      },
    });
    element.dataset.interaction = interaction;
  }

  sync();

  let drawnArrows = '';
  function setArrows(arrows: readonly Arrow[]): void {
    const shown = arrows.slice(0, ARROW_STYLES.length);
    const signature = shown.map((arrow) => `${arrow.from}${arrow.to}${arrow.opacity ?? 1}`).join(',');
    element.dataset.arrows = String(shown.length);
    if (signature === drawnArrows) return; // nothing changed: do not redraw
    drawnArrows = signature;
    ground.setAutoShapes(
      shown.map((arrow, index) => {
        const style = ARROW_STYLES[index]!;
        return {
          orig: arrow.from as Key,
          dest: arrow.to as Key,
          brush: arrowBrushKey(index, Math.min(1, Math.max(0.1, arrow.opacity ?? 1))),
          modifiers: { lineWidth: style.lineWidth },
        };
      }),
    );
  }

  let badge: MoveBadge | null = null;
  let badgeElement: HTMLElement | null = null;
  function placeBadge(): void {
    badgeElement?.remove();
    badgeElement = null;
    if (!badge) return;
    const file = badge.square.charCodeAt(0) - 97;
    const rank = Number(badge.square[1]);
    const white = ground.state.orientation === 'white';
    const wrapper = document.createElement('div');
    wrapper.className = 'move-badge';
    wrapper.style.left = `${(white ? file : 7 - file) * 12.5}%`;
    wrapper.style.top = `${(white ? 8 - rank : rank - 1) * 12.5}%`;
    const icon = document.createElement('span');
    icon.className = 'class-icon';
    icon.dataset.class = badge.classification;
    icon.textContent = badge.symbol;
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', badge.name);
    wrapper.append(icon);
    element.append(wrapper);
    badgeElement = wrapper;
    element.dataset.badge = `${badge.square}:${badge.classification}`;
  }
  function setBadge(next: MoveBadge | null): void {
    if (next?.square === badge?.square && next?.classification === badge?.classification) return;
    badge = next;
    if (!next) delete element.dataset.badge;
    placeBadge();
  }

  return {
    sync,
    setBadge,
    setLook: (look) => {
      element.dataset.board = look.board;
      element.dataset.pieces = look.pieces;
    },
    flip: () => {
      ground.toggleOrientation();
      placeBadge();
    },
    orientation: () => ground.state.orientation,
    setInteraction: (who) => {
      interaction = who;
    },
    setPlayerSide: (side) => {
      playerSide = side;
    },
    setOrientation: (side) => {
      ground.set({ orientation: side });
      placeBadge();
    },
    setArrows,
  };
}
