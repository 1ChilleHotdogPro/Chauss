// Stylesheet order matters: our own styles and theme.css (the look) come last so they can adjust chessground's defaults.
// The files in styles/ came from one style.css; their order was chosen so the cascade is unchanged, so keep it.
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/buttons.css';
import './styles/header.css';
import './styles/board.css';
import './styles/panel.css';
import './styles/moves.css';
import './styles/explorer.css';
import './styles/dialogs.css';
import './styles/drill.css';
import './styles/analysis.css';
import './theme.css';
import './site-themes.css';
import './appearance.css';
import { Chess } from 'chess.js';
import { Analysis } from './analysis/analysis';
import {
  loadAnalysisSettings,
  saveAnalysisSettings,
  searchLimit,
  SEARCH_LIMITS,
  type AnalysisSettings,
} from './analysis/analysisSettings';
import { arrowOpacities } from './analysis/arrowFade';
import { summarize } from './analysis/accuracy';
import { NO_BOOK, snapshotBook, type BookLookup } from './analysis/book';
import { CLASSIFICATION_INFO, classificationSentence } from './analysis/classificationText';
import { formatScore, winPercent } from './analysis/eval';
import { GameAnalyser, type GameReport } from './analysis/gameAnalyser';
import { importPgn } from './analysis/pgn';
import { numberedLine, parseUciMove, pvToSan, toUci } from './analysis/pv';
import { verdictSentence } from './analysis/verdictText';
import { stopSummary, strengthById } from './drill/outOfBook';
import { loadStrength, saveStrength } from './drill/strengthSetting';
import { DrillController } from './drill/controller';
import { loadProgress, loadStore, progressOf, saveProgress, saveStore, withProgress, type Progress } from './drill/progress';
import { statsRows } from './drill/stats';
import { EndgameController } from './endgames/controller';
import { getEndgameDrill } from './endgames/drills';
import { loadEndgameProgress, recordResult, saveEndgameProgress } from './endgames/progress';
import { engineSearch } from './endgames/search';
import { Engine } from './engine/engine';
import { createWorkerTransport, engineUrl } from './engine/workerTransport';
import { createMemoryCache, createStorageCache, layerCaches, type KeyValueStorage } from './explorer/cache';
import { ExplorerClient } from './explorer/client';
import { describeResult } from './explorer/describe';
import { describeRatings, loadSettings, saveSettings } from './explorer/settings';
import type { RatingBand } from './explorer/types';
import { ideaFor, latestIdea, type Idea } from './explore/ideas';
import type { ExploreMove } from './explore/position';
import { combineSnapshots } from './explore/combine';
import { needsScores, withRanking } from './explore/ranked';
import { buildRanking } from './explore/ranking';
import { explainRefutation } from './explore/refutation';
import { ExploreSource } from './explore/source';
import { Game, type PromotionPiece } from './game/game';
import { materialFromFen } from './game/material';
import { moveSoundFor } from './game/moveSound';
import { buildRepertoire, type Repertoire } from './repertoire/repertoire';
import { positionKey, type Snapshot } from './snapshot/format';
import { assetsFor, hasOpeningData, OPENING_ASSETS } from './openings/assets';
import { loadChosenOpening, saveChosenOpening } from './openings/choice';
import { DEFAULT_OPENING_ID, getOpening } from './openings/registry';
import { describeSnapshot, loadSnapshot } from './snapshot/load';
import { renderCapturedPieces } from './ui/capturedPieces';
import type { Side } from './game/game';
import { createBoard, type Arrow, type BoardInteraction } from './ui/board';
import { renderDrillPanel } from './ui/drillPanel';
import { renderEndgamePanel } from './ui/endgamePanel';
import { renderEnginePanel, type EnginePanelModel } from './ui/enginePanel';
import { createEvalBar } from './ui/evalBar';
import {
  compactNumber,
  renderExplorePanel,
  sharePercent,
  type ExplorePanelModel,
  type RefutationModel,
} from './ui/explorePanel';
import { renderAnalysisPanel } from './ui/analysisPanel';
import { createEvalGraph } from './ui/evalGraph';
import { renderMoveList, updateMoveClasses, updateMoveMarks } from './ui/moveList';
import { fillStrengthOptions, renderOutOfBook, type OutOfBookModel } from './ui/outOfBookPanel';
import { createDrillHub } from './ui/drillHub';
import { createFoldable } from './ui/foldable';
import { createPromotionPicker } from './ui/promotion';
import { createMoveSounds } from './ui/sound';
import { isCursed, loadAppearance, saveAppearance } from './appearance/appearance';
import { createAppearancePanel } from './ui/appearancePanel';
import { createSettingsPanel } from './ui/settingsPanel';
import { createStatsDialog } from './ui/statsDialog';

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
const capturedTopEl = byId('captured-top');
const capturedBottomEl = byId('captured-bottom');
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

/** The opening drilled (chosen in the Drill hub); Explore and Analyse are not tied to one opening. */
const storage = browserStorage();
// An opening counts as chosen only once its data files exist (the registry may list it earlier).
const chosenOpening = loadChosenOpening(storage, hasOpeningData);
/** Until one is chosen in the Drill hub, the default opening's data is used. */
const OPENING_ID = chosenOpening ?? DEFAULT_OPENING_ID;
/** The colour the user plays in it, and the colour of the app's side of the board. */
const SIDE: Side = getOpening(OPENING_ID).side;
const OPPONENT: Side = SIDE === 'white' ? 'black' : 'white';
const sideName = (side: Side): string => (side === 'white' ? 'White' : 'Black');
const game = new Game();
const promotion = createPromotionPicker(byId('promotion'));
const moveSounds = createMoveSounds();
let renderedPly = 0;
const board = createBoard(byId('board'), game, handleUserMove);
board.setPlayerSide(SIDE);
// Explore and Analyse start with White at the bottom; a drill turns the board to the user's side.
board.setOrientation('white');
const evalBar = createEvalBar(byId('evalbar'));

/** Board and piece looks (Settings). The cursed ones also turn captures into explosions. */
let appearance = loadAppearance(storage);
function applyAppearance(next: typeof appearance): void {
  appearance = next;
  document.documentElement.dataset.siteTheme = next.theme;
  board.setLook(next);
  moveSounds.setCursed(isCursed(next));
  moveSounds.setExplosionVolume(next.explosionVolume);
  moveSounds.setSoundSet(next.sounds);
}
applyAppearance(appearance);
createAppearancePanel({
  dialog: byId<HTMLDialogElement>('settings'),
  initial: appearance,
  onChange: (next) => {
    applyAppearance(next);
    return saveAppearance(storage, next);
  },
  onPreviewExplosion: () => moveSounds.previewExplosion(),
  onPreviewSounds: () => moveSounds.previewSet(),
});

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

const settingsPanel = createSettingsPanel({
  dialog: byId<HTMLDialogElement>('settings'),
  openButton: byId<HTMLButtonElement>('open-settings'),
  initial: loadSettings(storage),
  onChange: (settings) => {
    const stored = saveSettings(storage, settings);
    // Other rating groups, speeds or token: what the explorer shows may change.
    queueMicrotask(renderExplore);
    return stored;
  },
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
  // Lichess allows roughly 20 explorer requests a minute; a position needs two.
  minIntervalMs: 1500,
});

/** The short remarks of that opening, loaded together with its data. */
let IDEAS: readonly Idea[] = [];

// The bundled opening data: works offline and needs no token.
// undefined = still loading, null = could not be loaded.
let snapshot: Snapshot | null | undefined;
const snapshotInfo = byId<HTMLElement>('snapshot-info');
Promise.all([loadSnapshot(OPENING_ID), assetsFor(OPENING_ID).ideas()]).then(
  ([loaded, loadedIdeas]) => {
    IDEAS = loadedIdeas;
    snapshot = loaded;
    snapshotInfo.dataset.state = 'ready';
    snapshotInfo.dataset.positions = String(loaded.meta.counts.positions);
    snapshotInfo.textContent = describeSnapshot(loaded.meta);

    // The repertoire (the user's move in every position it reaches) and the drills built on it.
    repertoire = buildRepertoire(loaded, SIDE);
    drill = new DrillController({
      snapshot: loaded,
      repertoire,
      progress,
      onProgress: (changed) => {
        progress = changed;
        saveProgress(storage, OPENING_ID, changed);
        statsDialog.refresh();
      },
    });
    if (mode === 'drill' && !hubOpen && !endgame) startDrillLine();
    else if (mode === 'explore') renderExplore();
    renderDrill();
    loadExploreData();
  },
  (error: unknown) => {
    snapshot = null;
    snapshotInfo.dataset.state = 'failed';
    snapshotInfo.textContent = `The bundled opening data could not be loaded (${error instanceof Error ? error.message : String(error)}).`;
    renderExplore();
    renderDrill();
  },
);

/** One opening's data as Explore uses it: positions, remarks, and the user's move in each position. */
interface ExploreOpening {
  snapshot: Snapshot;
  ideas: readonly Idea[];
  repertoire: Repertoire;
}
/** Every opening's data in one, for Explore (which is not tied to one opening). Null until all are loaded. */
let exploreData: { snapshot: Snapshot; owner: Record<string, number>; openings: ExploreOpening[] } | null = null;

/** Load the other openings' data too (the drilled one first, so it wins where they are equal). */
function loadExploreData(): void {
  const ids = [OPENING_ID, ...Object.keys(OPENING_ASSETS).filter((id) => id !== OPENING_ID)];
  void Promise.allSettled(
    ids.map((id) =>
      Promise.all([loadSnapshot(id), assetsFor(id).ideas()]).then(([loaded, ideas]) => ({
        snapshot: loaded,
        ideas,
        repertoire: buildRepertoire(loaded, getOpening(id).side),
      })),
    ),
  ).then((results) => {
    const openings = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    if (openings.length === 0) return;
    const combined = combineSnapshots(openings.map((opening) => opening.snapshot));
    exploreData = { snapshot: combined.snapshot, owner: combined.owner, openings };
    if (mode === 'explore') renderExplore();
  });
}

/** The opening whose data Explore shows for a position, if any. */
function exploreOpeningAt(fen: string): ExploreOpening | null {
  if (!exploreData) return null;
  const index = exploreData.owner[positionKey(fen)];
  return index === undefined ? null : (exploreData.openings[index] ?? null);
}

/** A remark on this position, from whichever opening has one. */
function exploreIdea(fen: string): string | null {
  if (!exploreData) return snapshot ? ideaFor(snapshot, IDEAS, fen) : null;
  for (const opening of exploreData.openings) {
    const idea = ideaFor(opening.snapshot, opening.ideas, fen);
    if (idea) return idea;
  }
  return null;
}

// ---- Modes: Explore (look things up), Drill (the app plays the opponent, you find your move) and
// Analyse (a whole game reviewed by Stockfish) ----
type Mode = 'explore' | 'drill' | 'analysis';
let mode: Mode = 'explore';
let repertoire: Repertoire | null = null;
let drill: DrillController | null = null;
let progress: Progress = loadProgress(storage, OPENING_ID);
/** True while the app is showing the opponent's reply in a drill (no moving pieces meanwhile). */
let drillShowing = false;
let drillTimer: ReturnType<typeof setTimeout> | undefined;

const modeButtons: Record<Mode, HTMLButtonElement> = {
  explore: byId<HTMLButtonElement>('mode-explore'),
  drill: byId<HTMLButtonElement>('mode-drill'),
  analysis: byId<HTMLButtonElement>('mode-analysis'),
};
const drillPanel = {
  prompt: byId<HTMLElement>('drill-prompt'),
  feedback: byId<HTMLElement>('drill-feedback'),
  counts: byId<HTMLElement>('drill-counts'),
  score: byId<HTMLElement>('drill-score'),
  next: byId<HTMLButtonElement>('drill-next'),
};

// ---- The Drill hub: a full page to choose what to drill. Opening it pauses whatever drill was running ----
let hubOpen = false;
const drillHub = createDrillHub({
  root: byId('drill-hub'),
  currentOpening: OPENING_ID,
  onChoose: (category, entry) => drillStarters[category]?.(entry),
  // For the progress on the cards ("3 due now · 12 of 71 learned"); only the open opening's positions are known.
  openingProgress: () => withProgress(loadStore(storage), OPENING_ID, progress),
  positionKeys: (id) => (id === OPENING_ID && repertoire ? repertoire.cards.keys() : null),
  endgameProgress: () => endgameProgress,
});

/** What choosing an entry of each hub category does. A new kind of drill adds its handler here. */
const drillStarters: Record<string, (entryId: string) => void> = {
  openings: (id) => {
    stopEndgame();
    saveChosenOpening(storage, id);
    if (id !== OPENING_ID) {
      // All state is rebuilt from the chosen opening's data, so start the page afresh, straight into the drill.
      location.hash = DRILL_HASH;
      location.reload();
      return;
    }
    setHubOpen(false);
    board.setOrientation(SIDE);
    if (drill) startDrillLine();
    else render();
  },
  endgames: (id) => startEndgame(id),
};
/** The page address that reopens straight into a drill (used after switching opening, which reloads). */
const DRILL_HASH = '#drill';

function setHubOpen(open: boolean): void {
  hubOpen = open;
  document.body.dataset.hub = open ? 'open' : '';
  if (open) {
    clearTimeout(drillTimer);
    drillShowing = false;
    promotion.cancel();
    stopOpponent();
    stopEndgame();
    drillHub.open();
  } else {
    drillHub.close();
  }
}

// ---- Endgame drills: the user plays one side of a position, Stockfish judges every move and defends ----

/** The endgame drill running now; null while an opening drill (or nothing) is shown. */
let endgame: EndgameController | null = null;
let endgameProgress = loadEndgameProgress(storage);
/** A Stockfish of its own for judging and defending, so the drill never waits behind other searches. */
let endgameEngine: Engine | null = null;

const endgamePanel = {
  title: byId<HTMLElement>('endgame-title'),
  lead: byId<HTMLElement>('endgame-lead'),
  prompt: byId<HTMLElement>('endgame-prompt'),
  feedback: byId<HTMLElement>('endgame-feedback'),
  counts: byId<HTMLElement>('endgame-counts'),
  summary: byId<HTMLElement>('endgame-summary'),
  next: byId<HTMLButtonElement>('endgame-next'),
  retry: byId<HTMLButtonElement>('endgame-retry'),
  again: byId<HTMLButtonElement>('endgame-again'),
};

function ensureEndgameEngine(): Engine {
  endgameEngine ??= new Engine(createWorkerTransport(engineUrl(import.meta.env.BASE_URL)), {
    multiPv: 1,
    onStateChange: () => scheduleEngineRender(),
  });
  return endgameEngine;
}

function startEndgame(drillId: string): void {
  const chosen = getEndgameDrill(drillId);
  if (!chosen) return;
  stopEndgame();
  setHubOpen(false);
  clearTimeout(drillTimer);
  drillShowing = false;
  drillAfter = null;
  stopOpponent();
  promotion.cancel();
  endgame = new EndgameController({
    drill: chosen,
    search: engineSearch(ensureEndgameEngine()),
    onChange: syncEndgame,
    onResult: (position, result) => {
      endgameProgress = recordResult(endgameProgress, chosen.id, position.id, result, Date.now());
      saveEndgameProgress(storage, endgameProgress);
    },
  });
  document.body.dataset.drill = 'endgame';
  endgame.start(0);
}

/** Leave the endgame drill (back to the opening drill's side of the board). */
function stopEndgame(): void {
  if (!endgame) return;
  endgame.dispose();
  endgame = null;
  document.body.dataset.drill = 'opening';
  board.setPlayerSide(SIDE);
  board.setOrientation(SIDE);
}

/** Put the endgame drill's position on the board and redraw. */
function syncEndgame(): void {
  if (!endgame) return;
  const view = endgame.view();
  // A wrong move is taken back, so a premove made after it no longer fits the position.
  if (view.feedback.kind === 'wrong') board.cancelPremove();
  board.setPlayerSide(view.side);
  // A new position starts with the user's side at the bottom (Flip still works during it).
  if (view.sans.length === 0 && game.startFen !== view.startFen) board.setOrientation(view.side);
  if (game.fen() !== view.fen || game.startFen !== view.startFen) game.loadLine([...view.sans], view.startFen);
  render();
}

function renderEndgame(): void {
  if (!endgame) return;
  const view = endgame.view();
  renderEndgamePanel(endgamePanel, view, endgameProgress.drills[view.drill.id] ?? {});
}

endgamePanel.next.addEventListener('click', () => endgame?.next());
endgamePanel.retry.addEventListener('click', () => endgame?.retry());
endgamePanel.again.addEventListener('click', () => endgame?.restartRun());
byId<HTMLButtonElement>('endgame-menu').addEventListener('click', () => setHubOpen(true));
document.body.dataset.drill = 'opening';

const statsDialog = createStatsDialog({
  dialog: byId<HTMLDialogElement>('stats'),
  openButton: byId<HTMLButtonElement>('open-stats'),
  rows: () => (repertoire ? statsRows(repertoire, progress, Date.now()) : []),
  store: () => withProgress(loadStore(storage), OPENING_ID, progress),
  opening: { id: OPENING_ID, name: getOpening(OPENING_ID).name },
  onReplace: (replacedStore) => {
    progress = progressOf(replacedStore, OPENING_ID);
    drill?.setProgress(progress);
    const stored = saveStore(storage, replacedStore);
    renderDrill();
    return stored;
  },
});

function renderDrill(): void {
  let unavailable: string | null = null;
  if (snapshot === null) unavailable = 'The bundled opening data could not be loaded, so drills are not available.';
  else if (repertoire && repertoire.cards.size === 0) unavailable = 'The bundled opening data has no lines to drill.';
  renderDrillPanel(drillPanel, drill && !unavailable ? drill.view() : null, unavailable, SIDE);
}

/** Put the drill's line on the board; with `showReply`, play the opponent's last move after a short pause. */
function showDrillLine(showReply: boolean): void {
  if (!drill) return;
  const line = [...drill.view().line];
  clearTimeout(drillTimer);
  if (showReply && line.length > 0) {
    drillShowing = true;
    game.loadLine(line.slice(0, -1));
    render();
    drillTimer = setTimeout(() => {
      drillShowing = false;
      game.loadLine(line);
      render();
    }, 450);
  } else {
    drillShowing = false;
    game.loadLine(line);
    render();
  }
}

function startDrillLine(): void {
  if (!drill) return;
  promotion.cancel();
  stopOpponent();
  drillAfter = null;
  drill.next();
  // A line can be over at once (the data stops right after the opponent's first reply).
  if (drill.view().finished) drillAfter = { kind: 'prompt' };
  showDrillLine(true);
}

/** The user's move in a drill. */
function drillMove(from: string, to: string, piece?: PromotionPiece): void {
  if (!drill) return;
  let played;
  try {
    played = new Chess(game.fen()).move(piece ? { from, to, promotion: piece } : { from, to });
  } catch {
    render();
    return;
  }
  const lengthBefore = drill.view().line.length;
  const outcome = drill.answer(`${from}${to}${played.promotion ?? ''}`, played.san);
  // The data has run out: ask what to do next (every time).
  if (outcome === 'correct' && drill.view().finished) drillAfter = { kind: 'prompt' };
  // After a right answer the line grew by our move and (unless it ended) the opponent's reply.
  if (outcome === 'correct') showDrillLine(drill.view().line.length === lengthBefore + 2);
  else render();
}

/** The move of the analysed game the user was looking at, so coming back to Analyse resumes there. */
let analysisPly = 0;

function setMode(next: Mode): void {
  if (next !== 'drill') {
    setHubOpen(false);
    stopEndgame();
  }
  if (next === mode) return;
  // A running analysis keeps going in the background while the user is elsewhere (it has its own engine).
  if (mode === 'analysis') analysisPly = game.currentPly();
  stopOpponent();
  mode = next;
  document.body.dataset.mode = next;
  for (const [name, button] of Object.entries(modeButtons)) button.setAttribute('aria-selected', String(name === next));
  clearTimeout(drillTimer);
  drillShowing = false;
  promotion.cancel();
  if (next !== 'explore') {
    // Think for yourself first: no evaluation, no arrows.
    evalShown = false;
    arrowsShown = false;
  }
  if (next === 'drill') {
    if (!endgame) board.setOrientation(SIDE);
    if (drill && !hubOpen && !endgame) startDrillLine();
    else render();
  } else if (next === 'analysis') {
    showAnalysedGame();
  } else {
    // Explore takes over whatever is on the board, to look into it (the analysed game's or the drill's position).
    render();
  }
}

/** Who may move pieces on the board right now. */
function interaction(): BoardInteraction {
  // Explore, and Analyse (a move off the game's path switches to Explore).
  if (mode === 'explore' || mode === 'analysis') return 'side-to-move';
  // In a drill the user may premove while the opponent (or Stockfish) is about to reply.
  if (endgame) {
    const state = endgame.view().state;
    return state === 'your-move' || state === 'judging' || state === 'opponent' ? 'player-only' : 'none';
  }
  const after = currentAfter();
  if (after?.kind === 'engine') {
    // Playing on against Stockfish: the user's turn, or a premove while it thinks.
    return game.status() === 'playing' ? 'player-only' : 'none';
  }
  return drill?.view().card ? 'player-only' : 'none';
}

modeButtons.explore.addEventListener('click', () => setMode('explore'));
// The Drill tab always opens the hub, also from inside a drill.
modeButtons.drill.addEventListener('click', () => {
  setHubOpen(true);
  setMode('drill');
});
byId<HTMLButtonElement>('drill-menu').addEventListener('click', () => setHubOpen(true));
modeButtons.analysis.addEventListener('click', () => setMode('analysis'));
drillPanel.next.addEventListener('click', startDrillLine);
document.body.dataset.mode = mode;

// ---- Analyse: a whole game reviewed by Stockfish, move by move ----

interface AnalysedGame {
  startFen: string;
  sans: string[];
  players: Record<Side, string>;
}
/** The game in the Analyse tab, its results so far, and how the run is going. */
let analysedGame: AnalysedGame | null = null;
let analysisReport: GameReport | null = null;
let analysisState: 'idle' | 'running' | 'done' | 'cancelled' = 'idle';
let analysisError: string | null = null;
/** True while the box for pasting a game is open. */
let analysisEditing = true;
/** Counts runs, so the result of an older one is ignored. */
let analysisRunId = 0;
/** A Stockfish of its own, so analysing a game never disturbs the live engine. Made when first needed. */
let analysisEngine: Engine | null = null;
let gameAnalyser: GameAnalyser | null = null;
let analysisSettings: AnalysisSettings = loadAnalysisSettings(storage);
/** Book moves of every opening in the registry (their data files are loaded on first use). */
let analysisBook: Promise<BookLookup> | null = null;

const analysisPanel = {
  input: byId<HTMLElement>('analysis-input'),
  pgn: byId<HTMLTextAreaElement>('analysis-pgn'),
  start: byId<HTMLButtonElement>('analysis-start'),
  error: byId<HTMLElement>('analysis-error'),
  run: byId<HTMLElement>('analysis-run'),
  progress: byId<HTMLProgressElement>('analysis-progress'),
  progressText: byId<HTMLElement>('analysis-progress-text'),
  cancel: byId<HTMLButtonElement>('analysis-cancel'),
  result: byId<HTMLElement>('analysis-result'),
  accuracy: byId<HTMLElement>('analysis-accuracy'),
  note: byId<HTMLElement>('analysis-note'),
  summary: byId<HTMLElement>('analysis-summary'),
  another: byId<HTMLButtonElement>('analysis-another'),
};
const evalGraph = createEvalGraph(byId('analysis-graph'), (ply) => goTo(ply));
const analysisLimitSelect = byId<HTMLSelectElement>('analysis-limit');

analysisLimitSelect.replaceChildren(
  ...SEARCH_LIMITS.map((choice) => new Option(choice.label, choice.id, false, choice.id === analysisSettings.limit)),
);
analysisLimitSelect.addEventListener('change', () => {
  analysisSettings = { ...analysisSettings, limit: analysisLimitSelect.value };
  saveAnalysisSettings(storage, analysisSettings);
  renderEngine();
});

function analysisLimitLabel(): string {
  const choice = SEARCH_LIMITS.find((candidate) => candidate.id === analysisSettings.limit);
  return (choice?.label ?? '').replace(/\s*\(.*\)$/, '').toLowerCase();
}

function analysisBookLookup(): Promise<BookLookup> {
  analysisBook ??= Promise.allSettled(Object.keys(OPENING_ASSETS).map((id) => loadSnapshot(id))).then((results) => {
    const loaded = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    // Something could not be loaded (offline?): try again next time instead of keeping a smaller book.
    if (loaded.length < results.length) analysisBook = null;
    return loaded.length > 0 ? snapshotBook(loaded) : NO_BOOK;
  });
  return analysisBook;
}

function ensureAnalysisEngine(): Engine {
  analysisEngine ??= new Engine(createWorkerTransport(engineUrl(import.meta.env.BASE_URL)), {
    onStateChange: (state) => {
      if (state === 'failed' && analysisState === 'running') {
        analysisError = `Stockfish could not be started: ${analysisEngine?.error() ?? 'unknown error'}`;
        cancelAnalysis();
      }
      scheduleEngineRender();
    },
  });
  return analysisEngine;
}

/** Put the analysed game (or an empty board) on the board, at the move the user last looked at. */
function showAnalysedGame(): void {
  if (!analysedGame || !game.loadLine(analysedGame.sans, analysedGame.startFen)) game.reset();
  game.goTo(analysedGame ? analysisPly : 0);
  render();
}

/** Start analysing a game from pasted text. */
async function startAnalysis(next: AnalysedGame): Promise<void> {
  cancelAnalysis();
  if (!game.loadLine(next.sans, next.startFen)) {
    analysisError = 'That game could not be put on the board.';
    renderEngine();
    return;
  }
  const runId = ++analysisRunId;
  analysedGame = next;
  analysisPly = 0; // a new game starts at its first position
  analysisReport = null;
  analysisError = null;
  analysisEditing = false;
  analysisState = 'running';
  game.goTo(0);
  render();

  const engineForRun = ensureAnalysisEngine();
  const moves = game.history().map((move) => ({ san: move.san, uci: toUci(move), fenAfter: move.fenAfter }));
  const book = await analysisBookLookup();
  if (runId !== analysisRunId) return; // cancelled or replaced while the opening data was loading
  gameAnalyser = new GameAnalyser(engineForRun, searchLimit(analysisSettings));
  const outcome = await gameAnalyser.start(next.startFen, moves, book, (report) => {
    if (runId !== analysisRunId) return;
    analysisReport = report;
    scheduleEngineRender();
  });
  if (runId !== analysisRunId) return;
  analysisState = outcome;
  releaseAnalysisEngine();
  renderEngine();
}

/** Shut the analysis Stockfish down between runs: it is a large worker, and made again when needed. */
function releaseAnalysisEngine(): void {
  analysisEngine?.dispose();
  analysisEngine = null;
}

function cancelAnalysis(): void {
  if (analysisState !== 'running') return;
  analysisRunId += 1;
  gameAnalyser?.cancel();
  gameAnalyser = null;
  releaseAnalysisEngine();
  analysisState = 'cancelled';
  scheduleEngineRender();
}

function analysePasted(): void {
  const imported = importPgn(analysisPanel.pgn.value);
  if (!imported.ok) {
    analysisError = imported.error;
    renderEngine();
    return;
  }
  const name = (key: string, fallback: string) => {
    const value = imported.headers[key];
    return value && value !== '?' ? value : fallback;
  };
  void startAnalysis({
    startFen: imported.startFen,
    sans: imported.sans,
    players: { white: name('White', 'White'), black: name('Black', 'Black') },
  });
}

analysisPanel.start.addEventListener('click', analysePasted);
analysisPanel.cancel.addEventListener('click', cancelAnalysis);
analysisPanel.another.addEventListener('click', () => {
  cancelAnalysis();
  analysisEditing = true;
  analysisError = null;
  analysisPanel.pgn.value = ''; // a fresh, empty box for the next game
  renderEngine();
  analysisPanel.pgn.focus();
});
/** What to say about the move that led to the position on the board, in the Analyse tab. */
function analysisVerdict(): EnginePanelModel['verdict'] {
  const ply = game.currentPly();
  if (ply === 0) return null;
  const move = analysisReport?.moves[ply - 1];
  if (!move) return analysisState === 'running' ? { text: 'Analysing this move…', kind: 'pending' } : null;
  const bestSan = move.bestMove && move.bestMove !== move.uci ? pvToSan(move.fenBefore, [move.bestMove])[0] : undefined;
  return {
    text: classificationSentence({
      san: numberedLine(move.fenBefore, [move.san]),
      mover: move.color,
      result: move,
      bestSan: bestSan ? numberedLine(move.fenBefore, [bestSan]) : undefined,
    }),
    kind: CLASSIFICATION_INFO[move.classification].verdict,
  };
}

/** In Analyse: the icon of the move that led to this position, on the square the piece moved to. */
function updateMoveBadge(): void {
  const ply = game.currentPly();
  const move = mode === 'analysis' && ply > 0 ? analysisReport?.moves[ply - 1] : undefined;
  const last = game.lastMove();
  if (!move || !last) {
    board.setBadge(null);
    return;
  }
  const info = CLASSIFICATION_INFO[move.classification];
  board.setBadge({ square: last.to, classification: move.classification, symbol: info.symbol, name: info.name });
}

/** Redraw the Analyse panel, the graph and the icons in the move list. */
function renderAnalysis(): void {
  const report = analysisReport;
  const moves = report?.moves ?? [];
  const classified = moves.filter((move) => move !== undefined);
  renderAnalysisPanel(analysisPanel, {
    showInput: analysisEditing,
    error: analysisError,
    progress: analysisState === 'running' ? { done: report?.done ?? 0, total: report?.total ?? game.history().length + 1 } : null,
    limitLabel: analysisLimitLabel(),
    players: analysedGame?.players ?? { white: 'White', black: 'Black' },
    summary: analysedGame && classified.length > 0 ? summarize(moves) : null,
    partial: analysisState === 'cancelled',
  });
  if (analysedGame) {
    const plies = game.history().length;
    evalGraph.render({
      white: Array.from({ length: plies + 1 }, (_, ply) => {
        const score = report?.positions[ply]?.lines[0]?.score;
        return score ? winPercent(score, 'white') : undefined;
      }),
      classes: Array.from({ length: plies }, (_, index) => moves[index]?.classification),
      current: game.currentPly(),
      startFen: game.startFen,
    });
  }
  updateMoveClasses(movesEl, (ply) => moves[ply - 1]?.classification);
}

// ---- Drill: what happens once a line has left the opening data (the user chooses) ----

/** What happens once a drill has left the opening data. */
type After = { kind: 'prompt' } | { kind: 'stopped' } | { kind: 'engine' };
let drillAfter: After | null = null;
/** The strength of the Stockfish that is played against when playing on. */
let playStrength = loadStrength(storage);
/** A separate, weakened Stockfish for playing on, so it never disturbs the analysis. Made when first needed. */
let playEngine: Engine | null = null;
let engineThinking = false;

const oobPanel = {
  section: byId<HTMLElement>('oob'),
  lead: byId<HTMLElement>('oob-lead'),
  choices: byId<HTMLElement>('oob-choices'),
  stop: byId<HTMLButtonElement>('oob-stop'),
  playOn: byId<HTMLButtonElement>('oob-play'),
  strength: byId<HTMLSelectElement>('oob-strength'),
  result: byId<HTMLElement>('oob-result'),
  engine: byId<HTMLElement>('oob-engine'),
};
fillStrengthOptions(oobPanel.strength);

function currentAfter(): After | null {
  return mode === 'drill' ? drillAfter : null;
}

function setAfter(after: After | null): void {
  if (mode === 'drill') drillAfter = after;
}

/** Cancel whatever the opponent was about to play. */
function stopOpponent(): void {
  if (engineThinking) playEngine?.stop();
  engineThinking = false;
}

function changeStrength(id: string): void {
  playStrength = strengthById(id).id;
  saveStrength(storage, playStrength);
  render();
}

/** "4...Nf6": a move with its number, from its place in the game. */
function numberedSan(ply: number, san: string): string {
  const number = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${number}.${san}` : `${number}...${san}`;
}

/** After a change: when playing on against Stockfish, let it reply on its turn. */
function continueGame(): void {
  if (mode !== 'drill' || game.status() !== 'playing') return;
  if (currentAfter()?.kind === 'engine' && game.turn() === OPPONENT) requestEngineMove();
}

function ensurePlayEngine(): Engine {
  playEngine ??= new Engine(createWorkerTransport(engineUrl(import.meta.env.BASE_URL)), {
    multiPv: 1,
    onStateChange: (state) => {
      if (state === 'failed') engineThinking = false;
      render();
    },
  });
  return playEngine;
}

/** Ask the weakened Stockfish for the opponent's move. */
function requestEngineMove(): void {
  if (engineThinking) return;
  const engine = ensurePlayEngine();
  if (engine.state() === 'failed') {
    render();
    return;
  }
  const fen = game.fen();
  const strength = strengthById(playStrength);
  engineThinking = true;
  engine.analyse({
    fen,
    depth: strength.depth,
    multiPv: 1,
    options: { 'Skill Level': strength.skill },
    onInfo: () => {},
    onDone: (best) => {
      engineThinking = false;
      if (game.fen() === fen && currentAfter()?.kind === 'engine') {
        const move = best ? parseUciMove(best) : null;
        if (move) game.play(move.from, move.to, move.promotion);
      }
      render();
    },
  });
  render();
}

/** A move on the board while playing on against Stockfish after a drill. */
function freeMove(from: string, to: string, piece?: PromotionPiece): void {
  const played = game.play(from, to, piece);
  render();
  if (played) continueGame();
}

/** What the box for "out of the opening data" says, in Drill. */
function outOfBookModel(): OutOfBookModel | null {
  const after = currentAfter();
  if (!after || (mode === 'drill' && drillShowing)) return null;
  const strength = strengthById(playStrength);
  const lead =
    after.kind === 'engine'
      ? `Playing on against Stockfish (${strength.label}).`
      : after.kind === 'stopped'
        ? 'Stopped here: this is what Stockfish thinks.'
        : 'You have left the opening data. Stop here and see what Stockfish thinks, or play on against a weakened Stockfish?';

  const model: OutOfBookModel = {
    state: after.kind,
    lead,
    strength: strength.id,
    summary: null,
    verdict: null,
    idea: null,
    engineText: null,
  };
  if (after.kind === 'stopped') {
    model.summary =
      game.status() === 'playing'
        ? stopSummary(analysis.current())
        : { balance: `${statusText()}.`, best: null, line: null, depth: analysis.current()?.depth ?? 0 };
    const verdict = currentVerdict();
    model.verdict = verdict && verdict.kind !== 'pending' ? verdict.text : null;
    const found = snapshot
      ? latestIdea(snapshot, IDEAS, [game.startFen, ...game.history().map((move) => move.fenAfter)])
      : null;
    if (found) {
      const move = game.history()[found.ply - 1];
      // The remark may belong to an earlier position: say which, since it speaks of "here".
      const where = move ? `after ${numberedSan(found.ply, move.san)}` : 'at the start';
      model.idea = found.ply === game.history().length ? { where: null, text: found.text } : { where, text: found.text };
    }
  } else if (after.kind === 'engine') {
    if (playEngine?.state() === 'failed') model.engineText = `Stockfish could not be started: ${playEngine.error()}`;
    else if (game.status() !== 'playing') model.engineText = `Game over: ${statusText()}.`;
    else if (engineThinking) model.engineText = 'Stockfish is thinking…';
    else model.engineText = game.turn() === SIDE ? `Your move as ${sideName(SIDE)}.` : '';
  }
  return model;
}

function renderGamePanels(): void {
  renderOutOfBook(oobPanel, outOfBookModel());
}

oobPanel.stop.addEventListener('click', () => {
  setAfter({ kind: 'stopped' });
  render();
});
oobPanel.playOn.addEventListener('click', () => {
  setAfter({ kind: 'engine' });
  render();
  continueGame();
});
oobPanel.strength.addEventListener('change', () => changeStrength(oobPanel.strength.value));

const exploreEl = byId<HTMLElement>('explore');
const exploreSource = new ExploreSource({
  snapshot: () => exploreData?.snapshot ?? snapshot,
  settings: () => settingsPanel.settings(),
  client: explorer,
  onUpdate: () => {
    if (mode === 'explore') renderExplore();
  },
});

// What the user asked the Explore panel to show for the position on the board.
/** The move whose refutation is shown (engine spelling), and the position it belongs to. */
let explained: { fen: string; uci: string } | null = null;
/** The position whose every legal move is being ranked. */
let rankingFen: string | null = null;

/** The position after a move given in engine spelling, or null if the move is not legal. */
function fenAfter(fen: string, uci: string): string | null {
  const move = parseUciMove(uci);
  if (!move) return null;
  try {
    return new Chess(fen).move(move).after;
  } catch {
    return null;
  }
}

/** Why a move is bad: Stockfish's best reply and line, once it has looked. */
function refutationFor(fen: string, move: ExploreMove): { model: RefutationModel; extra: string | null } {
  const played = move.popular
    ? `Played in ${sharePercent(move.popular.share)} of games at this level (${compactNumber(move.popular.games)} games).`
    : 'Not played at this level.';
  const model: RefutationModel = { san: move.san, flag: move.flag, playedText: played, result: null };

  const after = fenAfter(fen, move.uci);
  if (!after) return { model, extra: null };
  const evaluation = analysis.isReady(after, analysis.extraDepth) ? analysis.evalFor(after) : undefined;
  const best = evaluation?.lines[0];
  if (best && best.pv.length > 0) {
    const sans = pvToSan(after, best.pv, 8);
    model.result = {
      bestReply: sans[0] ?? '',
      line: numberedLine(after, sans),
      score: formatScore(best.score),
      why: explainRefutation({ fen: after, pv: best.pv, score: best.score, judgement: move.judgement }),
    };
  }
  return { model, extra: after };
}

/** Redraw the Explore panel for the position on the board. */
function renderExplore(): void {
  const fen = game.fen();
  // An explanation or a ranking belongs to one position; moving on closes it.
  if (explained && explained.fen !== fen) explained = null;
  if (rankingFen !== null && rankingFen !== fen) rankingFen = null;

  let view = exploreSource.view(fen);
  // Mark the repertoire move (the one the drills ask for) where the repertoire reaches this position.
  if (view.status === 'ready' && !view.position.recommended) {
    const card = (exploreOpeningAt(fen)?.repertoire ?? repertoire)?.cards.get(positionKey(fen));
    if (card) view.position.recommended = card.move.uci;
  }
  const settings = settingsPanel.settings();
  const bundled = exploreData?.snapshot ?? snapshot;
  const ratings =
    view.status === 'ready' && view.origin === 'snapshot' && bundled
      ? (bundled.meta.lichess.ratings as RatingBand[])
      : settings.ratings;

  let refutation: RefutationModel | null = null;
  let extra: string | null = null;
  if (explained && view.status === 'ready') {
    const move = view.position.moves.find((candidate) => candidate.uci === explained?.uci);
    if (move) ({ model: refutation, extra } = refutationFor(fen, move));
  }
  analysis.setExtras(extra ? [extra] : []);
  // Outside the bundled data the listed moves have no scores. Stockfish scores every legal move
  // there in the background, so the mistake icons appear for these moves too.
  const wantsScores = view.status === 'ready' && needsScores(view.position);
  analysis.setRanking(rankingFen ?? (wantsScores ? fen : null));

  let ranking: ExplorePanelModel['ranking'] = { state: 'off' };
  if (rankingFen !== null) {
    const ranked = analysis.ranking(rankingFen);
    ranking = ranked ? { state: 'ready', rows: buildRanking(ranked) } : { state: 'pending' };
  }
  let checking = false;
  if (view.status === 'ready' && wantsScores) {
    const ranked = analysis.ranking(fen);
    if (ranked) view = { ...view, position: withRanking(view.position, buildRanking(ranked)) };
    else checking = true;
  }

  renderExplorePanel(
    exploreEl,
    {
      view,
      ratingsLabel: describeRatings(ratings),
      evalShown,
      idea: exploreIdea(fen),
      selectedUci: refutation ? (explained?.uci ?? null) : null,
      refutation,
      ranking,
      checking,
    },
    {
      onPlay: (uci) => {
        const move = parseUciMove(uci);
        if (!move) return;
        promotion.cancel();
        game.play(move.from, move.to, move.promotion);
        render();
      },
      onExplain: (uci) => {
        explained = uci ? { fen: game.fen(), uci } : null;
        renderExplore();
      },
      onToggleRanking: () => {
        rankingFen = rankingFen === null ? game.fen() : null;
        renderExplore();
      },
    },
  );
}

/** Called by the board after the user dropped a piece on a legal square. */
function handleUserMove(from: string, to: string): void {
  if (game.needsPromotion(from, to)) {
    promotion.open(game.turn(), (piece) => {
      if (piece) dispatchMove(from, to, piece);
      else render(); // puts the pawn back
    });
    return;
  }
  dispatchMove(from, to);
}

/** A move made on the board, handled the way the current mode wants. */
function dispatchMove(from: string, to: string, piece?: PromotionPiece): void {
  if (mode === 'analysis') {
    analysisMove(from, to, piece);
  } else if (mode === 'explore') {
    game.play(from, to, piece);
    render();
  } else if (endgame) {
    // The controller shows the move at once (and takes it back if Stockfish says it is wrong).
    void endgame.play(`${from}${to}${piece ?? ''}`).then((accepted) => {
      if (!accepted) render(); // puts the piece back
    });
  } else if (drillAfter?.kind !== 'engine') {
    drillMove(from, to, piece);
  } else {
    freeMove(from, to, piece);
  }
}

/**
 * A move on the board in Analyse: the game's own next move just steps forward; any other move leaves
 * the game, so Explore takes the position over (coming back to Analyse returns to the game).
 */
function analysisMove(from: string, to: string, piece?: PromotionPiece): void {
  const ply = game.currentPly();
  const gameMove = analysedGame ? game.history()[ply] : undefined;
  const uci = `${from}${to}${piece ?? ''}`;
  if (gameMove && toUci(gameMove) === uci) {
    goTo(ply + 1);
    return;
  }
  setMode('explore'); // remembers this move of the game, for coming back
  game.play(from, to, piece);
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
  board.setInteraction(interaction());
  board.sync();
  renderCaptured();

  // A move was just played (going back, or starting over, makes no sound).
  const justPlayed = game.currentPly() > renderedPly ? game.lastMove() : undefined;
  renderedPly = game.currentPly();
  if (justPlayed) {
    const status = game.status();
    const sound = moveSoundFor(justPlayed);
    const heard = status === 'stalemate' || status === 'draw' ? 'draw' : sound;
    // lets the browser tests check which sound it was
    document.body.dataset.lastSound = heard === 'capture' && isCursed(appearance) ? 'explosion' : heard;
    moveSounds.play(heard);
  }

  const moves = game.history();
  const ply = game.currentPly();
  renderMoveList(movesEl, moves, ply, goTo, game.startFen);
  movesEmptyEl.hidden = moves.length > 0;

  statusEl.textContent = statusText();
  fenEl.textContent = game.fen();

  prevBtn.disabled = ply === 0;
  nextBtn.disabled = ply === moves.length;
  undoBtn.disabled = moves.length === 0;
  resetBtn.disabled = moves.length === 0;

  // Tell the engine what is on screen; results arrive later through scheduleEngineRender.
  // In Analyse the stored results of the game are shown instead, and the live engine rests.
  // The endgame drill has its own Stockfish; the live one rests there (its eval is never shown in Drill).
  if (mode === 'analysis' || endgame) analysis.setLine([], [], 0);
  else analysis.setLine([game.startFen, ...moves.map((move) => move.fenAfter)], moves.map((move) => toUci(move)), ply);
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
  const analysing = mode === 'analysis';
  const evaluation = analysing ? analysisReport?.positions[game.currentPly()] : analysis.current();
  const shownEngine = analysing && analysisEngine ? analysisEngine : engine;

  evalBar.update({
    shown: evalShown,
    score: evaluation?.lines[0]?.score,
    orientation: board.orientation(),
  });

  const arrows: Arrow[] = [];
  if (mode === 'drill' && endgame) {
    // The only arrow is Stockfish's move, shown after a wrong try.
    const view = endgame.view();
    const hint = view.feedback.kind === 'wrong' && view.feedback.hint ? parseUciMove(view.feedback.hint) : null;
    if (hint && view.state === 'your-move') arrows.push({ from: hint.from, to: hint.to });
  } else if (mode === 'drill') {
    // In a drill the only arrow is the answer, shown after a wrong try.
    const feedback = drill?.view().feedback;
    const hint = feedback?.kind === 'wrong' ? parseUciMove(feedback.hint) : null;
    if (hint) arrows.push({ from: hint.from, to: hint.to });
  } else if (arrowsShown && evaluation) {
    const opacities = arrowOpacities(evaluation);
    evaluation.lines.forEach((line, index) => {
      const move = line.pv[0] ? parseUciMove(line.pv[0]) : null;
      if (move) arrows.push({ from: move.from, to: move.to, opacity: opacities[index] });
    });
  }
  board.setArrows(arrows);
  updateMoveBadge();

  if (analysing) renderAnalysis();
  else updateMoveMarks(movesEl, (ply) => analysis.judgement(ply)?.verdict);

  renderEnginePanel(enginePanel, {
    engineState: shownEngine.state(),
    engineName: shownEngine.name(),
    evalShown,
    arrowsShown,
    evaluation,
    verdict: analysing ? analysisVerdict() : currentVerdict(),
  });

  // The Explore panel shows engine results too (refutations, the ranking, the eval column).
  if (mode === 'explore') renderExplore();
  else if (mode === 'drill') {
    renderDrill();
    renderEndgame();
  }
  renderGamePanels();
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
  // No stepping through the game while being tested.
  if (mode !== 'explore' && mode !== 'analysis') return;
  promotion.cancel();
  game.goTo(ply);
  render();
}

function renderCaptured(): void {
  renderCapturedPieces(capturedTopEl, capturedBottomEl, materialFromFen(game.fen()), board.orientation());
}

function flip(): void {
  board.flip();
  renderCaptured();
  renderEngine(); // the eval bar turns with the board
}

function toggleEval(): void {
  if (mode === 'drill') return;
  evalShown = !evalShown;
  renderEngine();
}

function toggleArrows(): void {
  if (mode === 'drill') return;
  arrowsShown = !arrowsShown;
  renderEngine();
}

createFoldable({
  toggle: byId<HTMLButtonElement>('engine-toggle'),
  storage,
  storageKey: 'chauss.engineFolded.v1',
  onChange: (folded) => {
    document.body.dataset.engine = folded ? 'folded' : '';
  },
});

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
  if (settingsPanel.isOpen() || statsDialog.isOpen()) return; // no board hotkeys while a dialog is open

  if (mode === 'drill' && hubOpen) return;

  if (mode === 'drill' && endgame && event.key === 'Enter' && !promotion.isOpen()) {
    // Enter moves on to the next position once this one is over.
    const onOtherButton = target instanceof HTMLButtonElement && target !== modeButtons.drill;
    const state = endgame.view().state;
    if (!onOtherButton && (state === 'solved' || state === 'failed')) {
      event.preventDefault();
      endgame.next();
    }
    return;
  }

  if (mode === 'drill' && event.key === 'Enter' && !promotion.isOpen()) {
    // Enter starts the next line once this one is over (and does nothing in the middle of one).
    // With the focus on some other button, Enter presses that button as usual; the Drill tab does
    // not count, because the focus is still there right after switching to Drill.
    const onOtherButton = target instanceof HTMLButtonElement && target !== modeButtons.drill;
    // While playing on against Stockfish, Enter does not throw the game away.
    if (drill && drill.view().card === null && drillAfter?.kind !== 'engine' && !onOtherButton) {
      event.preventDefault();
      startDrillLine();
    }
    return;
  }

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

// Coming back from switching opening in the hub: go straight into the drill.
if (chosenOpening && location.hash === DRILL_HASH) {
  history.replaceState(null, '', location.pathname + location.search);
  setMode('drill');
}
render();
