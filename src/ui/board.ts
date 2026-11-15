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
   *  - 'white-only': White on White's turn, nobody on Black's (drills, where the app plays Black);
   *  - 'none': nobody (while the app is showing something).
   * Takes effect at the next sync().
   */
  setInteraction(who: BoardInteraction): void;
  /** Draw arrows for the engine's suggestions, best first (at most three). An empty list clears them. */
  setArrows(arrows: readonly Arrow[]): void;
}

export type BoardInteraction = 'side-to-move' | 'white-only' | 'none';

export interface Arrow {
  from: string;
  to: string;
  /** 0.1 to 1: how solid to draw it. Default: solid. */
  opacity?: number;
}

/** Best move: thick cyan. Second: lime. Third: grapefruit. */
const ARROW_STYLES = [
  { color: '#00c8e0', lineWidth: 12 },
  { color: '#8fd91f', lineWidth: 8 },
  { color: '#ff6b5a', lineWidth: 6 },
] as const;

/** Chessground insists on its four standard brushes (used for arrows the user draws with the mouse). */
const DEFAULT_BRUSHES = {
  green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
  red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
  blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
  yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
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

  function sync(): void {
    const last = game.lastMove();
    const turn = game.turn();
    const mayMove = interaction === 'side-to-move' || (interaction === 'white-only' && turn === 'white');
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

  return {
    sync,
    flip: () => ground.toggleOrientation(),
    orientation: () => ground.state.orientation,
    setInteraction: (who) => {
      interaction = who;
    },
    setArrows,
  };
}
