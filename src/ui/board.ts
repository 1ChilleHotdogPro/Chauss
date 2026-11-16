import { Chessground } from '@lichess-org/chessground';
import type { Key } from '@lichess-org/chessground/types';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Game, Side } from '../game/game';
import { ARROW_LOOKS, arrowSvg, screenDelta } from './arrowShape';

export interface BoardView {
  /** Make the board show exactly what the game says: pieces, side to move, legal moves. */
  sync(): void;
  flip(): void;
  orientation(): Side;
  /**
   * Who may move pieces with the mouse:
   *  - 'side-to-move': whoever's turn it is (exploring);
   *  - 'player-only': the user's colour (see setPlayerSide) on its turn; on the opponent's turn the
   *    user may premove, and the premove is played as soon as it is the user's turn again
   *    (drills and games, where the app plays the other colour);
   *  - 'none': nobody (while the app is showing something).
   * Takes effect at the next sync().
   */
  setInteraction(who: BoardInteraction): void;
  /** Drop a queued premove (e.g. the move it was made after was taken back). */
  cancelPremove(): void;
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

/** Engine arrows: best (green), second (amber), third (terracotta). Hex, as an SVG attribute cannot read CSS variables. */
const ARROW_COLOURS = ['#4caf50', '#f2b134', '#e07a52'] as const;

/** Chessground insists on its four standard brushes (used for arrows the user draws with the mouse). */
const DEFAULT_BRUSHES = {
  green: { key: 'g', color: '#5fa04e', opacity: 1, lineWidth: 10 },
  red: { key: 'r', color: '#d0503f', opacity: 1, lineWidth: 10 },
  blue: { key: 'b', color: '#4f8fd0', opacity: 1, lineWidth: 10 },
  yellow: { key: 'y', color: '#e6b74f', opacity: 1, lineWidth: 10 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
    premovable: { enabled: false, showDests: true, castle: true },
    draggable: { showGhost: true },
    highlight: { lastMove: true, check: true },
    animation: { enabled: true, duration: 150 },
    drawable: { brushes: DEFAULT_BRUSHES },
  });

  let interaction: BoardInteraction = 'side-to-move';
  let playerSide: Side = 'white';

  function sync(): void {
    const last = game.lastMove();
    const turn = game.turn();
    const mayMove = interaction === 'side-to-move' || (interaction === 'player-only' && turn === playerSide);
    // On the opponent's turn the user may queue a move (a premove), as on Lichess.
    const mayPremove = interaction === 'player-only' && turn !== playerSide;
    ground.set({
      fen: game.fen(),
      turnColor: turn,
      check: game.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: {
        color: mayMove ? turn : mayPremove ? playerSide : undefined,
        dests: mayMove ? game.dests() : new Map(),
      },
      premovable: { enabled: interaction === 'player-only' },
    });
    element.dataset.interaction = interaction;
    // Whether a move now is a real move (not a premove); the browser tests wait for it.
    element.dataset.yourTurn = String(mayMove);
    if (interaction !== 'player-only') ground.cancelPremove();
    // The user's turn has come: play the queued premove, if it is legal here (chessground checks the
    // move against the legal moves and hands it to onUserMove like a normal move).
    else if (mayMove) ground.playPremove();
  }

  sync();

  let shownArrows: readonly Arrow[] = [];
  let drawnArrows = '';
  function setArrows(arrows: readonly Arrow[]): void {
    shownArrows = arrows.slice(0, ARROW_COLOURS.length);
    element.dataset.arrows = String(shownArrows.length);
    drawArrows();
  }

  let drawCount = 0;
  /** The arrow's shape depends on which way up the board is, so this runs again after a flip. */
  function drawArrows(): void {
    const orientation = ground.state.orientation;
    const signature =
      orientation + ':' + shownArrows.map((arrow) => `${arrow.from}${arrow.to}${arrow.opacity ?? 1}`).join(',');
    if (signature === drawnArrows) return; // nothing changed: do not redraw
    drawnArrows = signature;
    // Chessground keeps a shape that did not change and only adds the changed ones after it, which would
    // put a new weaker arrow over an unchanged best one. Marking every arrow with this draw's number makes
    // all of them new, so they are always stacked in order.
    drawCount += 1;
    const shapes: DrawShape[] = shownArrows.map((arrow, index) => {
      const { dx, dy } = screenDelta(arrow.from, arrow.to, orientation);
      const svg = arrowSvg(dx, dy, ARROW_LOOKS[index]!, ARROW_COLOURS[index]!, clamp(arrow.opacity ?? 1, 0.1, 1));
      return {
        orig: arrow.from as Key,
        customSvg: { html: `<g data-draw="${drawCount}">${svg}</g>`, center: 'orig' },
      };
    });
    ground.setAutoShapes(shapes.reverse()); // best drawn last, so it is on top
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
    cancelPremove: () => ground.cancelPremove(),
    setLook: (look) => {
      element.dataset.board = look.board;
      element.dataset.pieces = look.pieces;
    },
    flip: () => {
      ground.toggleOrientation();
      placeBadge();
      drawArrows();
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
      drawArrows();
    },
    setArrows,
  };
}
