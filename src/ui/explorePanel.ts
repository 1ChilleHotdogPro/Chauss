import { formatScore } from '../analysis/eval';
import { verdictSymbol } from '../analysis/verdictText';
import type { ExploreMove, MoveFlag, MoveStats } from '../explore/position';
import type { RankedMove } from '../explore/ranking';
import type { ExploreView } from '../explore/source';

/** Everything the panel shows about the refutation of one bad move. */
export interface RefutationModel {
  /** The bad move, in normal notation. */
  san: string;
  flag: MoveFlag;
  /** e.g. "Played in 25% of games at your level." */
  playedText: string;
  /** Filled in once Stockfish has looked at the position after the move. */
  result: { bestReply: string; line: string; score: string; why: string } | null;
}

export interface ExplorePanelModel {
  view: ExploreView;
  /** e.g. "1000-1399": the rating groups of the data shown. */
  ratingsLabel: string;
  /** Show Stockfish's numbers (follows the "Show eval" switch). */
  evalShown: boolean;
  /** A short, data-backed remark about this position, if there is one. */
  idea: string | null;
  /** The move whose refutation is being shown, in engine spelling. */
  selectedUci: string | null;
  refutation: RefutationModel | null;
  ranking: { state: 'off' } | { state: 'pending' } | { state: 'ready'; rows: RankedMove[] };
}

export interface ExplorePanelHandlers {
  /** Play a move on the board. */
  onPlay(uci: string): void;
  /** Show why a move is bad (null = close the explanation). */
  onExplain(uci: string | null): void;
  onToggleRanking(): void;
}

const FLAG_NAMES: Record<MoveFlag, string> = {
  none: '',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

/** "?!", "?" or "??"; nothing for a move that is fine. */
function flagSymbol(flag: MoveFlag): string {
  return flag === 'none' ? '' : verdictSymbol(flag);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** 908 -> "908", 12,345 -> "12.3K", 3,092,272 -> "3.1M". */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

/** 0.583 -> "58%", 0.004 -> "<1%". */
export function sharePercent(share: number): string {
  const percent = share * 100;
  if (percent > 0 && percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
}

function resultsBar(stats: MoveStats): HTMLElement {
  const bar = el('span', 'results-bar');
  bar.title = `White wins ${stats.whitePercent}% · draws ${stats.drawPercent}% · Black wins ${stats.blackPercent}%`;
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', bar.title);
  for (const [cls, percent] of [
    ['white', stats.whitePercent],
    ['draw', stats.drawPercent],
    ['black', stats.blackPercent],
  ] as const) {
    const part = el('span', `results-${cls}`);
    part.style.width = `${percent}%`;
    // Only label a part when there is room for the number.
    if (percent >= 18) part.textContent = `${percent}`;
    bar.append(part);
  }
  return bar;
}

function moveTable(
  id: string,
  moves: readonly ExploreMove[],
  pick: (move: ExploreMove) => MoveStats | null,
  model: ExplorePanelModel,
  recommended: string | undefined,
  handlers: ExplorePanelHandlers,
): HTMLTableElement {
  const table = el('table', 'explore-table');
  table.id = id;
  const head = el('tr');
  for (const title of ['Move', 'Played', 'Games', 'Results', ...(model.evalShown ? ['Eval'] : []), '']) {
    head.append(el('th', undefined, title));
  }
  const thead = el('thead');
  thead.append(head);
  const body = el('tbody');

  for (const move of moves) {
    const stats = pick(move);
    if (!stats) continue;
    const row = el('tr');
    row.dataset.uci = move.uci;
    row.dataset.flag = move.flag;
    if (move.uci === model.selectedUci) row.classList.add('selected');

    const moveCell = el('td');
    const play = el('button', 'explore-move', move.san);
    play.type = 'button';
    play.title = move.opening ? `Play ${move.san} — ${move.opening}` : `Play ${move.san}`;
    play.addEventListener('click', () => handlers.onPlay(move.uci));
    moveCell.append(play);
    if (move.uci === recommended) {
      const star = el('span', 'explore-recommended', '★');
      star.title = 'The move this trainer recommends (your repertoire move)';
      moveCell.append(star);
    }

    const scoreCell = el('td', 'explore-eval', move.eval ? formatScore(move.eval) : '');
    const flagCell = el('td');
    if (move.flag !== 'none') {
      const flag = el('button', 'flag', verdictSymbol(move.flag));
      flag.type = 'button';
      flag.dataset.flag = move.flag;
      flag.title = `${FLAG_NAMES[move.flag]} — click to see why`;
      flag.setAttribute('aria-label', `${move.san}: ${FLAG_NAMES[move.flag]}. Show why.`);
      flag.setAttribute('aria-pressed', String(move.uci === model.selectedUci));
      flag.addEventListener('click', () => handlers.onExplain(move.uci === model.selectedUci ? null : move.uci));
      flagCell.append(flag);
    }

    const resultsCell = el('td');
    resultsCell.append(resultsBar(stats));
    row.append(
      moveCell,
      el('td', 'explore-share', sharePercent(stats.share)),
      el('td', 'explore-games', compactNumber(stats.games)),
      resultsCell,
      ...(model.evalShown ? [scoreCell] : []),
      flagCell,
    );
    body.append(row);
  }
  table.append(thead, body);
  return table;
}

function refutationBox(refutation: RefutationModel, handlers: ExplorePanelHandlers): HTMLElement {
  const box = el('div', 'refutation');
  box.id = 'refutation';
  box.dataset.flag = refutation.flag;
  box.dataset.state = refutation.result ? 'ready' : 'pending';

  const title = el('p', 'refutation-title');
  title.append(
    el('strong', undefined, `${refutation.san}${flagSymbol(refutation.flag)} — ${FLAG_NAMES[refutation.flag].toLowerCase()}.`),
    document.createTextNode(` ${refutation.playedText}`),
  );
  box.append(title);

  if (!refutation.result) {
    box.append(el('p', 'hint', 'Stockfish is looking for the best reply…'));
  } else {
    const { bestReply, line, score, why } = refutation.result;
    const reply = el('p');
    reply.append(document.createTextNode('Best reply: '), el('strong', 'refutation-reply', bestReply), document.createTextNode(`. ${why}`));
    const lineP = el('p', 'refutation-line');
    lineP.append(el('span', 'line-score', score), document.createTextNode(' '), el('span', 'line-moves', line));
    box.append(reply, lineP);
  }

  const close = el('button', 'refutation-close', 'Close');
  close.type = 'button';
  close.addEventListener('click', () => handlers.onExplain(null));
  box.append(close);
  return box;
}

function rankingSection(model: ExplorePanelModel, handlers: ExplorePanelHandlers): HTMLElement {
  const section = el('div', 'ranking');
  const toggle = el('button', undefined, model.ranking.state === 'off' ? 'Rank every legal move' : 'Hide the ranking');
  toggle.id = 'toggle-ranking';
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', String(model.ranking.state !== 'off'));
  toggle.title = 'Ask Stockfish to score every legal move in this position';
  toggle.addEventListener('click', () => handlers.onToggleRanking());
  section.append(toggle);

  if (model.ranking.state === 'pending') {
    section.append(el('p', 'hint', 'Stockfish is scoring every legal move…'));
  } else if (model.ranking.state === 'ready') {
    section.append(el('p', 'hint', 'Every legal move, most punished first:'));
    const list = el('ol', 'ranking-list');
    list.id = 'ranking-list';
    for (const row of model.ranking.rows) {
      const item = el('li');
      item.dataset.uci = row.uci;
      item.dataset.flag = row.flag;
      const play = el('button', 'explore-move', `${row.san}${verdictSymbol(row.judgement.verdict)}`);
      play.type = 'button';
      play.addEventListener('click', () => handlers.onPlay(row.uci));
      item.append(play, el('span', 'line-score', formatScore(row.score)));
      list.append(item);
    }
    section.append(list);
  }
  return section;
}

/**
 * Draw the Explore panel. Redrawing is skipped when nothing it shows has changed, so the engine's
 * frequent updates do not disturb the mouse or the keyboard focus.
 */
export function renderExplorePanel(root: HTMLElement, model: ExplorePanelModel, handlers: ExplorePanelHandlers): void {
  const signature = JSON.stringify(model);
  if (root.dataset.signature === signature) return;
  root.dataset.signature = signature;
  root.dataset.status = model.view.status;

  const parts: HTMLElement[] = [];

  if (model.view.status === 'loading') {
    parts.push(el('p', 'hint', 'Loading opening data…'));
  } else if (model.view.status === 'unavailable') {
    const reason = el('p', 'hint', model.view.reason);
    reason.id = 'explore-unavailable';
    parts.push(reason);
  } else {
    const { position, origin, note } = model.view;
    root.dataset.origin = origin;

    const name = el('p', 'opening-name');
    name.id = 'opening-name';
    if (position.opening) {
      name.append(el('span', 'opening-eco', position.opening.eco), document.createTextNode(` ${position.opening.name}`));
    } else {
      name.textContent = 'No opening name yet';
    }
    parts.push(name);

    if (model.idea) {
      const idea = el('p', 'explore-idea', model.idea);
      idea.id = 'explore-idea';
      parts.push(idea);
    }
    if (note) {
      const noteP = el('p', 'explore-note', note);
      noteP.id = 'explore-note';
      parts.push(noteP);
    }

    // Book and Popular are two separate lists, never mixed.
    const bookTitle = el('h3', undefined, `Book — master games (${compactNumber(position.bookGames)})`);
    parts.push(bookTitle);
    if (position.bookMoves.length > 0) {
      parts.push(moveTable('book-moves', position.bookMoves, (move) => move.book, model, position.recommended, handlers));
    } else {
      parts.push(el('p', 'hint', 'No master games reach this position.'));
    }

    const popularTitle = el(
      'h3',
      undefined,
      `Popular at your level — Lichess ${model.ratingsLabel} (${compactNumber(position.popularGames)})`,
    );
    parts.push(popularTitle);
    if (position.popularMoves.length > 0) {
      parts.push(
        moveTable('popular-moves', position.popularMoves, (move) => move.popular, model, position.recommended, handlers),
      );
    } else {
      parts.push(el('p', 'hint', 'No games at this level reach this position.'));
    }

    if (origin === 'live') parts.push(el('p', 'hint explore-origin', 'Live data from Lichess.'));
  }

  if (model.refutation) parts.push(refutationBox(model.refutation, handlers));
  parts.push(rankingSection(model, handlers));

  root.replaceChildren(...parts);
}
