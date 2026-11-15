import type { Side } from '../game/game';
import type { Material } from '../game/material';

const GLYPHS: Record<Side, Record<string, string>> = {
  white: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
  black: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' },
};
const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
const TEXT_STYLE = '︎'; // asks for the plain text glyph, not a colour emoji

function opposite(side: Side): Side {
  return side === 'white' ? 'black' : 'white';
}

/** Fill one strip: what `side` has taken from the other side, and "+N" if it is ahead. */
function fillStrip(strip: HTMLElement, side: Side, material: Material): void {
  const taken = material.lost[opposite(side)];
  const lead = side === 'white' ? material.balance : -material.balance;
  strip.dataset.side = side;
  strip.dataset.lead = String(Math.max(0, lead));

  const pieces = document.createElement('span');
  pieces.className = 'captured-pieces';
  let previous = '';
  for (const type of taken) {
    const piece = document.createElement('span');
    piece.className = `captured-piece${type === previous ? ' same' : ''}`;
    piece.dataset.type = type;
    piece.dataset.color = opposite(side);
    piece.textContent = GLYPHS[opposite(side)][type]! + TEXT_STYLE;
    pieces.append(piece);
    previous = type;
  }
  strip.replaceChildren(pieces);
  if (lead > 0) {
    const advantage = document.createElement('span');
    advantage.className = 'captured-lead';
    advantage.textContent = `+${lead}`;
    strip.append(advantage);
  }

  const counts = new Map<string, number>();
  for (const type of taken) counts.set(type, (counts.get(type) ?? 0) + 1);
  const list = [...counts].map(([type, n]) => `${n} ${NAMES[type]}${n > 1 ? 's' : ''}`).join(', ');
  const name = side === 'white' ? 'White' : 'Black';
  strip.setAttribute(
    'aria-label',
    `${name} has captured ${list || 'nothing'}${lead > 0 ? `, and is ahead by ${lead}` : ''}`,
  );
}

/** Show the captured pieces and the material lead above and below the board (follows the flip). */
export function renderCapturedPieces(
  top: HTMLElement,
  bottom: HTMLElement,
  material: Material,
  bottomSide: Side,
): void {
  fillStrip(bottom, bottomSide, material);
  fillStrip(top, opposite(bottomSide), material);
}
