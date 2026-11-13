// Stylesheet order matters: our own style.css comes last so it can adjust chessground's defaults.
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import { Chess } from 'chess.js';
import { Analysis } from './analysis/analysis';
import { formatScore } from './analysis/eval';
import { numberedLine, parseUciMove, pvToSan, toUci } from './analysis/pv';
import { verdictSentence } from './analysis/verdictText';
import { pickBlackMove, trapRoutes, type BotChoice, type TrapRoutes } from './bot/choose';
import { stopSummary, strengthById, treeStatus } from './bot/outOfBook';
import { loadPlaySettings, savePlaySettings, type PlaySettings } from './bot/playSettings';
import { DrillController } from './drill/controller';
import { loadProgress, saveProgress, type Progress } from './drill/progress';
import { statsRows } from './drill/stats';
import { Engine } from './engine/engine';
import { createWorkerTransport, engineUrl } from './engine/workerTransport';
import { createMemoryCache, createStorageCache, layerCaches, type KeyValueStorage } from './explorer/cache';
import { ExplorerClient } from './explorer/client';
import { describeResult } from './explorer/describe';
import { describeRatings, loadSettings, saveSettings } from './explorer/settings';
import type { RatingBand } from './explorer/types';
import { IDEAS } from './explore/ideaList';
import { latestIdea } from './explore/ideas';
import { loadTraps } from './explore/loadTraps';
import type { ExploreMove } from './explore/position';
import { buildRanking } from './explore/ranking';
import { explainRefutation } from './explore/refutation';
import { ExploreSource } from './explore/source';
import type { Trap } from './explore/traps';
import { Game, type PromotionPiece } from './game/game';
import { buildRepertoire, type Repertoire } from './repertoire/repertoire';
import { positionKey, type Snapshot } from './snapshot/format';
import { describeSnapshot, loadSnapshot } from './snapshot/load';
import { createBoard, type Arrow, type BoardInteraction } from './ui/board';
import { renderDrillPanel } from './ui/drillPanel';
import { renderEnginePanel, type EnginePanelModel } from './ui/enginePanel';
import { createEvalBar } from './ui/evalBar';
import {
  compactNumber,
  renderExplorePanel,
  sharePercent,
  type ExplorePanelModel,
  type RefutationModel,
} from './ui/explorePanel';
import { renderMoveList, updateMoveMarks } from './ui/moveList';
import { fillStrengthOptions, renderOutOfBook, type OutOfBookModel } from './ui/outOfBookPanel';
import { renderPlayPanel, type PlayPanelModel } from './ui/playPanel';
import { createPromotionPicker } from './ui/promotion';
import { createSettingsPanel } from './ui/settingsPanel';
import { createStatsDialog } from './ui/statsDialog';
import { createTrapsDialog } from './ui/trapsDialog';

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

// The bundled opening data: works offline and needs no token.
// undefined = still loading, null = could not be loaded.
let snapshot: Snapshot | null | undefined;
const snapshotInfo = byId<HTMLElement>('snapshot-info');
loadSnapshot().then(
  (loaded) => {
    snapshot = loaded;
    snapshotInfo.dataset.state = 'ready';
    snapshotInfo.dataset.positions = String(loaded.meta.counts.positions);
    snapshotInfo.textContent = describeSnapshot(loaded.meta);

    // The repertoire (White's move in every position it reaches) and the drills built on it.
    repertoire = buildRepertoire(loaded);
    drill = new DrillController({
      snapshot: loaded,
      repertoire,
      progress,
      onProgress: (changed) => {
        progress = changed;
        saveProgress(storage, changed);
        statsDialog.refresh();
      },
    });
    if (mode === 'drill') startDrillLine();
    else if (mode === 'play') continueGame();
    else renderExplore();
    renderDrill();
  },
  (error: unknown) => {
    snapshot = null;
    snapshotInfo.dataset.state = 'failed';
    snapshotInfo.textContent = `The bundled opening data could not be loaded (${error instanceof Error ? error.message : String(error)}).`;
    renderExplore();
    renderDrill();
    if (mode === 'play') continueGame();
  },
);

// ---- Modes: Explore (look things up), Drill (the app plays Black, you find White's move) and
// Play (a game against a bot that plays Black from the data) ----
type Mode = 'explore' | 'drill' | 'play';
let mode: Mode = 'explore';
let repertoire: Repertoire | null = null;
let drill: DrillController | null = null;
let progress: Progress = loadProgress(storage);
/** True while the app is showing Black's reply in a drill (no moving pieces meanwhile). */
let drillShowing = false;
let drillTimer: ReturnType<typeof setTimeout> | undefined;

const modeButtons: Record<Mode, HTMLButtonElement> = {
  explore: byId<HTMLButtonElement>('mode-explore'),
  drill: byId<HTMLButtonElement>('mode-drill'),
  play: byId<HTMLButtonElement>('mode-play'),
};
const drillPanel = {
  prompt: byId<HTMLElement>('drill-prompt'),
  feedback: byId<HTMLElement>('drill-feedback'),
  counts: byId<HTMLElement>('drill-counts'),
  score: byId<HTMLElement>('drill-score'),
  next: byId<HTMLButtonElement>('drill-next'),
};

const statsDialog = createStatsDialog({
  dialog: byId<HTMLDialogElement>('stats'),
  openButton: byId<HTMLButtonElement>('open-stats'),
  rows: () => (repertoire ? statsRows(repertoire, progress, Date.now()) : []),
  progress: () => progress,
  onReplace: (replaced) => {
    progress = replaced;
    drill?.setProgress(replaced);
    const stored = saveProgress(storage, replaced);
    renderDrill();
    return stored;
  },
});

function renderDrill(): void {
  let unavailable: string | null = null;
  if (snapshot === null) unavailable = 'The bundled opening data could not be loaded, so drills are not available.';
  else if (repertoire && repertoire.cards.size === 0) unavailable = 'The bundled opening data has no lines to drill.';
  renderDrillPanel(drillPanel, drill && !unavailable ? drill.view() : null, unavailable);
}

/** Put the drill's line on the board; with `showReply`, play Black's last move after a short pause. */
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
  stopBlack();
  drillAfter = null;
  drill.next();
  // A line can be over at once (the data stops right after Black's first reply).
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
  // After a right answer the line grew by our move and (unless it ended) Black's reply.
  if (outcome === 'correct') showDrillLine(drill.view().line.length === lengthBefore + 2);
  else render();
}

function setMode(next: Mode): void {
  if (next === mode) return;
  // Remember the game in Play, to pick it up again when coming back.
  if (mode === 'play') playLine = game.history().map((move) => move.san);
  stopBlack();
  mode = next;
  document.body.dataset.mode = next;
  for (const [name, button] of Object.entries(modeButtons)) button.setAttribute('aria-selected', String(name === next));
  clearTimeout(drillTimer);
  drillShowing = false;
  promotion.cancel();
  if (next !== 'explore') {
    // Think for yourself first: no evaluation, no arrows (in Play they can be switched on).
    evalShown = false;
    arrowsShown = false;
  }
  if (next === 'drill') {
    if (drill) startDrillLine();
    else render();
  } else if (next === 'play') {
    if (!game.loadLine(playLine)) {
      game.reset();
      playAfter = null;
    }
    render();
    continueGame();
  } else {
    render();
  }
}

/** Who may move pieces on the board right now. */
function interaction(): BoardInteraction {
  if (mode === 'explore') return 'side-to-move';
  const after = currentAfter();
  if (after?.kind === 'engine') {
    // Playing on against Stockfish: White's turn, once it has moved.
    return game.status() === 'playing' && !blackThinking() ? 'white-only' : 'none';
  }
  if (mode === 'drill') return drill?.view().card && !drillShowing ? 'white-only' : 'none';
  // Play, inside the opening data.
  if (after !== null || game.status() !== 'playing' || blackThinking()) return 'none';
  return 'white-only';
}

modeButtons.explore.addEventListener('click', () => setMode('explore'));
modeButtons.drill.addEventListener('click', () => setMode('drill'));
modeButtons.play.addEventListener('click', () => setMode('play'));
drillPanel.next.addEventListener('click', startDrillLine);
document.body.dataset.mode = mode;

// ---- Play: the bot plays Black from the data; outside it, the user chooses what happens ----

/** What happens once a drill or a game has left the opening data. */
type After = { kind: 'prompt' } | { kind: 'stopped' } | { kind: 'engine' };
let drillAfter: After | null = null;
let playAfter: After | null = null;
/** The Play game's moves while another mode is shown. */
let playLine: string[] = [];
let playSettings: PlaySettings = loadPlaySettings(storage);
/** Black moves that head for a known trap (from the traps list, once loaded). */
let routes: TrapRoutes = new Map();
/** The bot's last move in Play, for the message under the board. */
let botLast: { choice: BotChoice; label: string } | null = null;
/** Set while the bot's move is about to be shown. */
let botTimer: ReturnType<typeof setTimeout> | undefined;
/** True while live data for the position is on its way. */
let botWaiting = false;
/** A separate, weakened Stockfish for playing on, so it never disturbs the analysis. Made when first needed. */
let playEngine: Engine | null = null;
let engineThinking = false;
/** How long the bot "thinks" before its move appears (milliseconds). */
const BOT_DELAY_MS = 450;

const playPanel = {
  styleRealistic: byId<HTMLInputElement>('play-style-realistic'),
  stylePunish: byId<HTMLInputElement>('play-style-punish'),
  prompt: byId<HTMLElement>('play-prompt'),
  last: byId<HTMLElement>('play-last'),
};
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
  if (mode === 'drill') return drillAfter;
  if (mode === 'play') return playAfter;
  return null;
}

function setAfter(after: After | null): void {
  if (mode === 'drill') drillAfter = after;
  else if (mode === 'play') playAfter = after;
}

function blackThinking(): boolean {
  return botTimer !== undefined || engineThinking;
}

/** Cancel whatever Black was about to play. */
function stopBlack(): void {
  clearTimeout(botTimer);
  botTimer = undefined;
  botWaiting = false;
  if (engineThinking) playEngine?.stop();
  engineThinking = false;
}

function changePlaySettings(change: Partial<Omit<PlaySettings, 'version'>>): void {
  playSettings = { ...playSettings, ...change };
  savePlaySettings(storage, playSettings);
  render();
}

function startPlayGame(): void {
  promotion.cancel();
  stopBlack();
  playAfter = null;
  botLast = null;
  game.reset();
  render();
  continueGame();
}

/** "4...Nf6": a move with its number, from its place in the game. */
function numberedSan(ply: number, san: string): string {
  const number = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${number}.${san}` : `${number}...${san}`;
}

/**
 * Move the game along after a move or a change: let Black reply (from the data, or Stockfish when
 * playing on), and notice when the game leaves the opening data.
 */
function continueGame(): void {
  if (mode === 'explore' || game.status() !== 'playing') return;
  const after = currentAfter();
  if (after?.kind === 'engine') {
    if (game.turn() === 'black') requestEngineMove();
    return;
  }
  if (mode !== 'play' || after !== null || botTimer !== undefined) return;

  const view = exploreSource.view(game.fen());
  const status = treeStatus(view);
  botWaiting = status === 'loading';
  if (status === 'loading') {
    render(); // the data source calls back when the answer is in
    return;
  }
  const choice =
    status === 'in' && view.status === 'ready' && game.turn() === 'black'
      ? pickBlackMove(view.position, playSettings.style, routes)
      : null;
  if (status === 'out' || (game.turn() === 'black' && !choice)) {
    playAfter = { kind: 'prompt' };
    render();
    return;
  }
  if (!choice) return; // White's turn inside the data: wait for the user

  const fen = game.fen();
  botTimer = setTimeout(() => {
    botTimer = undefined;
    if (mode !== 'play' || game.fen() !== fen) return;
    const move = parseUciMove(choice.move.uci);
    const played = move ? game.play(move.from, move.to, move.promotion) : null;
    botLast = played ? { choice, label: numberedSan(played.ply, played.san) } : null;
    render();
    continueGame();
  }, BOT_DELAY_MS);
  render();
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

/** Ask the weakened Stockfish for Black's move. */
function requestEngineMove(): void {
  if (engineThinking) return;
  const engine = ensurePlayEngine();
  if (engine.state() === 'failed') {
    render();
    return;
  }
  const fen = game.fen();
  const strength = strengthById(playSettings.strength);
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

/** A move on the board in Play, or while playing on after a drill. */
function freeMove(from: string, to: string, piece?: PromotionPiece): void {
  const played = game.play(from, to, piece);
  if (played && mode === 'play') botLast = null;
  render();
  if (played) continueGame();
}

/** What the Play panel says. */
function playModel(): PlayPanelModel {
  const after = playAfter;
  let state: PlayPanelModel['state'] = 'your-move';
  let detail: string | null = null;
  if (game.status() !== 'playing') {
    state = 'over';
    detail = statusText();
  } else if (after !== null) state = 'out';
  else if (botWaiting) state = 'waiting';
  else if (botTimer !== undefined || game.turn() === 'black') state = 'thinking';

  let last: PlayPanelModel['last'] = null;
  if (botLast) {
    const { choice, label } = botLast;
    const share = choice.move.popular ? sharePercent(choice.move.popular.share) : null;
    const how = share ? ` — played in ${share} of games at this level` : '';
    if (choice.reason === 'mistake') {
      last = { text: `Black played ${label}${how}. Stockfish calls it a ${choice.move.flag}: find the punishment!`, kind: 'mistake' };
    } else if (choice.reason === 'trap-route') {
      last = { text: `Black played ${label}${how}. This leads towards a common mistake — stay alert.`, kind: 'book' };
    } else {
      last = { text: `Black played ${label}${how}.`, kind: 'book' };
    }
  }
  return { style: playSettings.style, state, detail, last };
}

/** What the box for "out of the opening data" says, in Drill and Play. */
function outOfBookModel(): OutOfBookModel | null {
  const after = currentAfter();
  if (!after || (mode === 'drill' && drillShowing)) return null;
  const strength = strengthById(playSettings.strength);
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
    if (snapshot) {
      model.idea = latestIdea(snapshot, IDEAS, [game.startFen, ...game.history().map((move) => move.fenAfter)]);
    }
  } else if (after.kind === 'engine') {
    if (playEngine?.state() === 'failed') model.engineText = `Stockfish could not be started: ${playEngine.error()}`;
    else if (game.status() !== 'playing') model.engineText = `Game over: ${statusText()}.`;
    else if (engineThinking) model.engineText = 'Stockfish is thinking…';
    else model.engineText = game.turn() === 'white' ? 'Your move as White.' : '';
  }
  return model;
}

function renderGamePanels(): void {
  if (mode === 'play') renderPlayPanel(playPanel, playModel());
  renderOutOfBook(oobPanel, outOfBookModel());
}

playPanel.styleRealistic.addEventListener('change', () => changePlaySettings({ style: 'realistic' }));
playPanel.stylePunish.addEventListener('change', () => changePlaySettings({ style: 'punish' }));
byId<HTMLButtonElement>('play-new').addEventListener('click', startPlayGame);
oobPanel.stop.addEventListener('click', () => {
  setAfter({ kind: 'stopped' });
  render();
});
oobPanel.playOn.addEventListener('click', () => {
  setAfter({ kind: 'engine' });
  render();
  continueGame();
});
oobPanel.strength.addEventListener('change', () =>
  changePlaySettings({ strength: strengthById(oobPanel.strength.value).id }),
);

const exploreEl = byId<HTMLElement>('explore');
const exploreSource = new ExploreSource({
  snapshot: () => snapshot,
  settings: () => settingsPanel.settings(),
  client: explorer,
  onUpdate: () => {
    if (mode === 'explore') renderExplore();
    else if (mode === 'play') continueGame();
  },
});

// What the user asked the Explore panel to show for the position on the board.
/** The move whose refutation is shown (engine spelling), and the position it belongs to. */
let explained: { fen: string; uci: string } | null = null;
/** The position whose every legal move is being ranked. */
let rankingFen: string | null = null;

const trapsDialog = createTrapsDialog({
  dialog: byId<HTMLDialogElement>('traps'),
  openButton: byId<HTMLButtonElement>('open-traps'),
  onShow: showTrap,
});
loadTraps().then(
  (file) => {
    trapsDialog.setTraps(file);
    routes = trapRoutes(file.traps);
  },
  (error: unknown) => trapsDialog.setFailed(error instanceof Error ? error.message : String(error)),
);

/** Put a trap's position on the board and open the explanation of its bad move. */
function showTrap(trap: Trap): void {
  promotion.cancel();
  if (!game.loadLine(trap.line)) return;
  explained = { fen: game.fen(), uci: trap.move.uci };
  render();
}

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

  const view = exploreSource.view(fen);
  // Mark the repertoire move (the one the drills ask for) where the repertoire reaches this position.
  if (view.status === 'ready' && !view.position.recommended) {
    const card = repertoire?.cards.get(positionKey(fen));
    if (card) view.position.recommended = card.move.uci;
  }
  const settings = settingsPanel.settings();
  const ratings =
    view.status === 'ready' && view.origin === 'snapshot' && snapshot
      ? (snapshot.meta.lichess.ratings as RatingBand[])
      : settings.ratings;

  let refutation: RefutationModel | null = null;
  let extra: string | null = null;
  if (explained && view.status === 'ready') {
    const move = view.position.moves.find((candidate) => candidate.uci === explained?.uci);
    if (move) ({ model: refutation, extra } = refutationFor(fen, move));
  }
  analysis.setExtras(extra ? [extra] : []);
  analysis.setRanking(rankingFen);

  let ranking: ExplorePanelModel['ranking'] = { state: 'off' };
  if (rankingFen !== null) {
    const ranked = analysis.ranking(rankingFen);
    ranking = ranked ? { state: 'ready', rows: buildRanking(ranked) } : { state: 'pending' };
  }

  renderExplorePanel(
    exploreEl,
    {
      view,
      ratingsLabel: describeRatings(ratings),
      evalShown,
      idea: null,
      selectedUci: refutation ? (explained?.uci ?? null) : null,
      refutation,
      ranking,
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
  if (mode === 'explore') {
    game.play(from, to, piece);
    render();
  } else if (mode === 'drill' && drillAfter?.kind !== 'engine') {
    drillMove(from, to, piece);
  } else {
    freeMove(from, to, piece);
  }
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
  if (mode === 'drill') {
    // In a drill the only arrow is the answer, shown after a wrong try.
    const feedback = drill?.view().feedback;
    const hint = feedback?.kind === 'wrong' ? parseUciMove(feedback.hint) : null;
    if (hint) arrows.push({ from: hint.from, to: hint.to });
  } else if (arrowsShown && evaluation) {
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

  // The Explore panel shows engine results too (refutations, the ranking, the eval column).
  if (mode === 'explore') renderExplore();
  else if (mode === 'drill') renderDrill();
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
  if (mode !== 'explore') return; // no stepping through the game while being tested or playing
  promotion.cancel();
  game.goTo(ply);
  render();
}

function flip(): void {
  board.flip();
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
  if (settingsPanel.isOpen() || trapsDialog.isOpen() || statsDialog.isOpen()) return; // no board hotkeys while a dialog is open

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

render();
