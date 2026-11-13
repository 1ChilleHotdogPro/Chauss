import { Chessground } from '@lichess-org/chessground';
import type { Key } from '@lichess-org/chessground/types';
import type { Game, Side } from '../game/game';

export interface BoardView {
  /** Make the board show exactly what the game says: pieces, side to move, legal moves. */
  sync(): void;
  flip(): void;
  orientation(): Side;
  /** Draw arrows for the engine's suggestions, best first (at most three). An empty list clears them. */
  setArrows(arrows: readonly Arrow[]): void;
}

export interface Arrow {
  from: string;
  to: string;
}

/** Best move: thick green. Second and third: thinner blue and yellow. */
const ARROW_STYLES = [
  { brush: 'green', lineWidth: 12 },
  { brush: 'blue', lineWidth: 8 },
  { brush: 'yellow', lineWidth: 6 },
] as const;

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
  });

  function sync(): void {
    const last = game.lastMove();
    ground.set({
      fen: game.fen(),
      turnColor: game.turn(),
      check: game.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: {
        color: game.turn(),
        dests: game.dests(),
      },
    });
  }

  sync();

  let drawnArrows = '';
  function setArrows(arrows: readonly Arrow[]): void {
    const shown = arrows.slice(0, ARROW_STYLES.length);
    const signature = shown.map((arrow) => arrow.from + arrow.to).join(',');
    element.dataset.arrows = String(shown.length);
    if (signature === drawnArrows) return; // nothing changed: do not redraw
    drawnArrows = signature;
    ground.setAutoShapes(
      shown.map((arrow, index) => {
        const style = ARROW_STYLES[index]!;
        return {
          orig: arrow.from as Key,
          dest: arrow.to as Key,
          brush: style.brush,
          modifiers: { lineWidth: style.lineWidth },
        };
      }),
    );
  }

  return {
    sync,
    flip: () => ground.toggleOrientation(),
    orientation: () => ground.state.orientation,
    setArrows,
  };
}
