import type { Side } from '../game/game';
import type { Classification, MoveClassification } from './classify';
import { opposite, type Verdict } from './eval';

export interface ClassificationInfo {
  /** "Brilliant", "Book move", ... */
  name: string;
  /** Short mark drawn in the icon. */
  symbol: string;
  /** The nearest plain verdict, for colouring text the way the rest of the app does. */
  verdict: Verdict;
}

export const CLASSIFICATION_INFO: Record<Classification, ClassificationInfo> = {
  brilliant: { name: 'Brilliant', symbol: '!!', verdict: 'best' },
  great: { name: 'Great move', symbol: '!', verdict: 'best' },
  best: { name: 'Best move', symbol: '★', verdict: 'best' },
  excellent: { name: 'Excellent', symbol: '✓', verdict: 'good' },
  good: { name: 'Good', symbol: '✓', verdict: 'good' },
  book: { name: 'Book move', symbol: '≡', verdict: 'best' },
  forced: { name: 'Only move', symbol: '□', verdict: 'best' },
  inaccuracy: { name: 'Inaccuracy', symbol: '?!', verdict: 'inaccuracy' },
  mistake: { name: 'Mistake', symbol: '?', verdict: 'mistake' },
  miss: { name: 'Miss', symbol: '×', verdict: 'mistake' },
  blunder: { name: 'Blunder', symbol: '??', verdict: 'blunder' },
};

const NAME: Record<Side, string> = { white: 'White', black: 'Black' };

/**
 * One plain sentence about a move of an analysed game, e.g.
 * "14...Qxd4 is a blunder: Black's winning chances fell from 48% to 9%. Best was 14...Nf6."
 * `san` and `bestSan` are passed with their move numbers already attached.
 */
export function classificationSentence(input: {
  san: string;
  mover: Side;
  result: Pick<MoveClassification, 'classification' | 'winBefore' | 'winAfter' | 'note'>;
  bestSan?: string | undefined;
}): string {
  const { san, mover, result, bestSan } = input;
  const best = bestSan ? ` Best was ${bestSan}.` : '';
  const chances = `${NAME[mover]}'s winning chances fell from ${Math.round(result.winBefore)}% to ${Math.round(result.winAfter)}%`;
  let note = '';
  if (result.note?.kind === 'allows-mate') note = ` (it allows mate in ${result.note.moves})`;
  if (result.note?.kind === 'missed-mate') note = ` (there was a mate in ${result.note.moves})`;

  switch (result.classification) {
    case 'book':
      return `${san} is a book move: masters play it here.`;
    case 'forced':
      return `${san} was the only legal move.`;
    case 'brilliant':
      return `${san} is brilliant: it gives up material, and the engine likes it.`;
    case 'great':
      return `${san} is a great move: the only move that keeps the position.`;
    case 'best':
      return `${san} is the best move.`;
    case 'excellent':
      return `${san} is excellent: almost as good as the best move.${best}`;
    case 'good':
      return `${san} is a good move.${best}`;
    case 'miss':
      return `${san} is a miss: it lets ${NAME[opposite(mover)]}'s mistake go unpunished — ${chances}${note}.${best}`;
    case 'inaccuracy':
    case 'mistake':
    case 'blunder':
      return `${san} is ${result.classification === 'inaccuracy' ? 'an' : 'a'} ${result.classification}: ${chances}${note}.${best}`;
  }
}
