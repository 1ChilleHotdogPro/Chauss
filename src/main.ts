// Stylesheet order matters: our own style.css comes last so it can adjust chessground's defaults.
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import { Analysis } from './analysis/analysis';
import { parseUciMove, pvToSan, toUci } from './analysis/pv';
import { verdictSentence } from './analysis/verdictText';
import { Engine } from './engine/engine';
import { createWorkerTransport, engineUrl } from './engine/workerTransport';
import { createMemoryCache, createStorageCache, layerCaches, type KeyValueStorage } from './explorer/cache';
import { ExplorerClient } from './explorer/client';
import { describeResult } from './explorer/describe';
import { loadSettings, saveSettings } from './explorer/settings';
import { Game } from './game/game';
import { createBoard, type Arrow } from './ui/board';
import { renderEnginePanel, type EnginePanelModel } from './ui/enginePanel';
import { createEvalBar } from './ui/evalBar';
import { renderMoveList, updateMoveMarks } from './ui/moveList';
import { createPromotionPicker } from './ui/promotion';
import { createSettingsPanel } from './ui/settingsPanel';

/** The engine reports its three best moves (used for the arrows and the lines list). */
const MULTI_PV = 3;

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
const enginePanel = {
  status: byId<HTMLElement>('engine-status'),
  lines: byId<HTMLOListElement>('engine-lines'),
  verdict: byId<HTMLElement>('verdict'),
  toggleEval: byId<HTMLButtonElement>('toggle-eval'),
  toggleArrows: byId<HTMLButtonElement>('toggle-arrows'),
};

const game = new Game();
const promotion = createPromotionPicker(byId('promotion'));
const board = createBoard(byId('board'), game, handleUserMove);
const evalBar = createEvalBar(byId('evalbar'));

// Hidden until asked for, so you think first.
let evalShown = false;
let arrowsShown = false;

const engine = new Engine(createWorkerTransport(engineUrl(import.meta.env.BASE_URL)), {
  multiPv: MULTI_PV,
  onStateChange: scheduleEngineRender,
});
const analysis = new Analysis(engine, { multiPv: MULTI_PV, onUpdate: scheduleEngineRender });

/** localStorage, or undefined where the browser forbids it (some private windows). */
function browserStorage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const storage = browserStorage();
const settingsPanel = createSettingsPanel({
  dialog: byId<HTMLDialogElement>('settings'),
  openButton: byId<HTMLButtonElement>('open-settings'),
  initial: loadSettings(storage),
  onChange: (settings) => saveSettings(storage, settings),
  onTest: async () => {
    const { ratings, speeds } = settingsPanel.settings();
    // Always ask Lichess afresh: a remembered answer would not test the connection.
    const result = await explorer.lichess(game.fen(), { ratings, speeds }, { skipCache: true });
    return describeResult(result);
  },
});

/** The live Lichess opening explorer. Only used when the user has set a token. */
const explorer = new ExplorerClient({
  fetch: (url, init) => fetch(url, init),
  getToken: () => settingsPanel.settings().token,
  cache: layerCaches(createMemoryCache(), createStorageCache(storage)),
  minIntervalMs: 250,
});

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

  // Tell the engine what is on screen; results arrive later through scheduleEngineRender.
  analysis.setLine(
    [game.startFen, ...moves.map((move) => move.fenAfter)],
    moves.map((move) => toUci(move)),
    ply,
  );
  renderEngine();
}

/** What to say about the move that led to the position on the board. */
function currentVerdict(): EnginePanelModel['verdict'] {
  const last = game.lastMove();
  if (!last) return null;
  const judgement = analysis.judgement(last.ply);
  if (!judgement) {
    return engine.state() === 'ready' ? { text: `Checking ${last.san}…`, kind: 'pending' } : null;
  }
  const fenBefore = last.ply === 1 ? game.startFen : game.history()[last.ply - 2]?.fenAfter;
  const bestSan =
    fenBefore && judgement.bestMove ? pvToSan(fenBefore, [judgement.bestMove])[0] : undefined;
  return {
    text: verdictSentence({ san: last.san, mover: last.color, judgement, bestSan }),
    kind: judgement.verdict,
  };
}

/** Redraw everything that depends on the engine: bar, arrows, lines, verdicts. */
function renderEngine(): void {
  const evaluation = analysis.current();

  evalBar.update({
    shown: evalShown,
    score: evaluation?.lines[0]?.score,
    orientation: board.orientation(),
  });

  const arrows: Arrow[] = [];
  if (arrowsShown && evaluation) {
    for (const line of evaluation.lines) {
      const move = line.pv[0] ? parseUciMove(line.pv[0]) : null;
      if (move) arrows.push({ from: move.from, to: move.to });
    }
  }
  board.setArrows(arrows);

  updateMoveMarks(movesEl, (ply) => analysis.judgement(ply)?.verdict);

  renderEnginePanel(enginePanel, {
    engineState: engine.state(),
    engineName: engine.name(),
    evalShown,
    arrowsShown,
    evaluation,
    verdict: currentVerdict(),
  });
}

// The engine reports many times a second; redraw at most once per frame.
let engineRenderQueued = false;
function scheduleEngineRender(): void {
  if (engineRenderQueued) return;
  engineRenderQueued = true;
  requestAnimationFrame(() => {
    engineRenderQueued = false;
    renderEngine();
  });
}

function goTo(ply: number): void {
  promotion.cancel();
  game.goTo(ply);
  render();
}

function flip(): void {
  board.flip();
  renderEngine(); // the eval bar turns with the board
}

function toggleEval(): void {
  evalShown = !evalShown;
  renderEngine();
}

function toggleArrows(): void {
  arrowsShown = !arrowsShown;
  renderEngine();
}

prevBtn.addEventListener('click', () => goTo(game.currentPly() - 1));
nextBtn.addEventListener('click', () => goTo(game.currentPly() + 1));
flipBtn.addEventListener('click', flip);
enginePanel.toggleEval.addEventListener('click', toggleEval);
enginePanel.toggleArrows.addEventListener('click', toggleArrows);
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
  if (settingsPanel.isOpen()) return; // no board hotkeys while the Settings dialog is open

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
    case 'e':
    case 'E':
      toggleEval();
      break;
    case 'a':
    case 'A':
      toggleArrows();
      break;
  }
});

render();
