import type { ExploreMove } from '../explore/position';
import type { Card } from '../repertoire/repertoire';
import type { CardState } from './srs';
import { DAY_MS } from './srs';

/** Why the repertoire move is the repertoire move, in one data-backed sentence. */
export function reasonText(card: Pick<Card, 'reason'>): string {
  const reason = card.reason;
  switch (reason.kind) {
    case 'opening-move':
      return 'It is one of the moves that define this opening.';
    case 'book':
      return reason.share > 0
        ? `Masters play it in ${Math.round(reason.share * 100)}% of their games here (${reason.games.toLocaleString('en-US')} games), and Stockfish agrees.`
        : `It is the move masters play here (${reason.games.toLocaleString('en-US')} games).`;
    case 'engine-over-book':
      return `Masters more often play ${reason.bookMove}, but Stockfish scores this move clearly higher.`;
    case 'engine':
      return "There are hardly any master games here; it is Stockfish's best among the moves people play.";
  }
}

/**
 * What to say after a wrong move in a drill: what was wrong with it (if the data knows the move),
 * what the repertoire move is, and why.
 * @param played the wrong move as the bundled data knows it, or undefined if it is not listed
 */
export function wrongMoveText(card: Card, playedSan: string, played: ExploreMove | undefined): string {
  let about = `${playedSan} is not the repertoire move.`;
  if (played?.judgement && played.flag !== 'none') {
    const { winBefore, winAfter } = played.judgement;
    about = `${playedSan} is not the repertoire move, and Stockfish calls it ${played.flag === 'inaccuracy' ? 'an inaccuracy' : `a ${played.flag}`}: your winning chances drop from ${Math.round(winBefore)}% to ${Math.round(winAfter)}%.`;
  } else if (played) {
    about = `${playedSan} is playable, but it is not the repertoire move.`;
  }
  return `${about} The repertoire move is ${card.move.san}. ${reasonText(card)} Play it to continue.`;
}

/** "now", "in 10 minutes", "tomorrow", "in 6 days" — when a card comes back. */
export function dueText(state: CardState | undefined, now: number): string {
  if (!state || state.lastSeen === null) return 'new';
  const wait = state.due - now;
  if (wait <= 0) return 'now';
  if (wait < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(wait / 60_000));
    return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.round(wait / (60 * 60 * 1000));
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.max(1, Math.round(wait / DAY_MS));
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}
