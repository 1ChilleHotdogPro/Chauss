// Stylesheet order matters: our own style.css comes last so it can adjust chessground's defaults.
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import { Game } from './game/game';
import { createBoard } from './ui/board';
import { renderMoveList } from './ui/moveList';
import { createPromotionPicker } from './ui/promotion';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

const statusEl = byId<HTMLParagraphElement>('status');
const fenEl = byId<HTMLElement>('fen');
const movesEl = byId<HTMLOListElement>('moves');
const movesEmptyEl = byId<HTMLParagraphElement>('moves-empty');
const prevBtn = byId<HTMLButtonElement>('prev');
const nextBtn = byId<HTMLButtonElement>('next');
const flipBtn = byId<HTMLButtonElement>('flip');
const undoBtn = byId<HTMLButtonElement>('undo');
const resetBtn = byId<HTMLButtonElement>('reset');

const game = new Game();
const promotion = createPromotionPicker(byId('promotion'));
const board = createBoard(byId('board'), game, handleUserMove);

/** Called by the board after the user dropped a piece on a legal square. */
function handleUserMove(from: string, to: string): void {
  if (game.needsPromotion(from, to)) {
    promotion.open(game.turn(), (piece) => {
      if (piece) game.play(from, to, piece);
      render(); // also puts the pawn back if the user cancelled
    });
    return;
  }
  game.play(from, to);
  render();
}

function statusText(): string {
  const side = game.turn() === 'white' ? 'White' : 'Black';
  const other = game.turn() === 'white' ? 'Black' : 'White';
  switch (game.status()) {
    case 'checkmate':
      return `Checkmate — ${other} wins`;
    case 'stalemate':
      return `Stalemate — draw (${side} has no legal move)`;
    case 'draw':
      return 'Draw';
    case 'playing':
      return game.inCheck() ? `${side} to move — check!` : `${side} to move`;
  }
}

/** Redraw everything from the game. Cheap enough to call after every change. */
function render(): void {
  board.sync();

  const moves = game.history();
  const ply = game.currentPly();
  renderMoveList(movesEl, moves, ply, goTo);
  movesEmptyEl.hidden = moves.length > 0;

  statusEl.textContent = statusText();
  fenEl.textContent = game.fen();

  prevBtn.disabled = ply === 0;
  nextBtn.disabled = ply === moves.length;
  undoBtn.disabled = moves.length === 0;
  resetBtn.disabled = moves.length === 0;
}

function goTo(ply: number): void {
  promotion.cancel();
  game.goTo(ply);
  render();
}

function flip(): void {
  board.flip();
}

prevBtn.addEventListener('click', () => goTo(game.currentPly() - 1));
nextBtn.addEventListener('click', () => goTo(game.currentPly() + 1));
flipBtn.addEventListener('click', flip);
undoBtn.addEventListener('click', () => {
  promotion.cancel();
  game.undo();
  render();
});
resetBtn.addEventListener('click', () => {
  promotion.cancel();
  game.reset();
  render();
});

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

  if (promotion.isOpen()) {
    if (event.key === 'Escape') promotion.cancel();
    return;
  }

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      goTo(game.currentPly() - 1);
      break;
    case 'ArrowRight':
      event.preventDefault();
      goTo(game.currentPly() + 1);
      break;
    case 'f':
    case 'F':
      flip();
      break;
  }
});

render();
