import { Chess } from 'chess.js';
import type { OpeningDef } from '../openings/registry';

/**
 * A small static picture of a position, for the Drill hub and the opening picker: an inline SVG of
 * the squares with the Merida pieces from public/pieces/. No chessground, no moving parts.
 */

export type Orientation = 'white' | 'black';

/** One square as drawn: its file/rank name and the piece on it ("wK", "bP", ...) or null. */
export interface MiniSquare {
  square: string;
  piece: string | null;
  dark: boolean;
}

const FILES = 'abcdefgh';

/**
 * The 64 squares of a FEN's placement, top-left first as seen from `orientation`'s side.
 * Pieces are written "wK", "bN", ... (the file names in public/pieces/<set>/).
 */
export function boardSquares(fen: string, orientation: Orientation = 'white'): MiniSquare[] {
  const ranks = (fen.split(' ')[0] ?? '').split('/');
  const grid: (string | null)[][] = [];
  for (let row = 0; row < 8; row += 1) {
    const cells: (string | null)[] = [];
    for (const char of ranks[row] ?? '') {
      if (/[1-8]/.test(char)) cells.push(...Array<null>(Number(char)).fill(null));
      else cells.push(`${char === char.toUpperCase() ? 'w' : 'b'}${char.toUpperCase()}`);
    }
    while (cells.length < 8) cells.push(null);
    grid.push(cells.slice(0, 8));
  }
  const squares: MiniSquare[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      // Row 0 of the FEN is rank 8; from Black's side the board is turned round.
      const fenRow = orientation === 'white' ? row : 7 - row;
      const fileIndex = orientation === 'white' ? column : 7 - column;
      const rank = 8 - fenRow;
      squares.push({
        square: `${FILES[fileIndex]}${rank}`,
        piece: grid[fenRow]?.[fileIndex] ?? null,
        // a1 is dark: file index 0 + rank 1 is odd.
        dark: (fileIndex + rank) % 2 === 1,
      });
    }
  }
  return squares;
}

/** The position after an opening's root moves, and the squares of its last move. */
export function rootPosition(opening: Pick<OpeningDef, 'rootLine'>): { fen: string; lastMove: string[] } {
  const chess = new Chess();
  let lastMove: string[] = [];
  for (const san of opening.rootLine) {
    const move = chess.move(san);
    lastMove = [move.from, move.to];
  }
  return { fen: chess.fen(), lastMove };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(tag: string, attributes: Record<string, string | number>): SVGElement {
  const created = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) created.setAttribute(name, String(value));
  return created;
}

export interface MiniBoardOptions {
  fen: string;
  orientation?: Orientation;
  /** Squares to mark, e.g. the last move's from and to. */
  highlight?: readonly string[];
}

/** The picture itself. It is decoration (the card's text says what it is), so screen readers skip it. */
export function miniBoard(options: MiniBoardOptions): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: '0 0 8 8', class: 'mini-board', 'aria-hidden': 'true', focusable: 'false' }) as SVGSVGElement;
  svg.append(svgElement('rect', { class: 'mb-light', x: 0, y: 0, width: 8, height: 8 }));
  const marked = new Set(options.highlight ?? []);
  const base = import.meta.env.BASE_URL;
  boardSquares(options.fen, options.orientation).forEach((cell, index) => {
    const x = index % 8;
    const y = Math.floor(index / 8);
    if (cell.dark) svg.append(svgElement('rect', { class: 'mb-dark', x, y, width: 1, height: 1 }));
    if (marked.has(cell.square)) svg.append(svgElement('rect', { class: 'mb-mark', x, y, width: 1, height: 1 }));
    if (cell.piece) {
      svg.append(svgElement('image', { href: `${base}pieces/merida/${cell.piece}.svg`, x, y, width: 1, height: 1 }));
    }
  });
  return svg;
}
