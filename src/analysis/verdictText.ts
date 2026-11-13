import type { Side } from '../game/game';
import type { Judgement, Verdict } from './eval';

/** The usual chess annotation marks. Good and best moves get none. */
export function verdictSymbol(verdict: Verdict): string {
  switch (verdict) {
    case 'inaccuracy':
      return '?!';
    case 'mistake':
      return '?';
    case 'blunder':
      return '??';
    default:
      return '';
  }
}

export function verdictName(verdict: Verdict): string {
  switch (verdict) {
    case 'best':
      return 'Best move';
    case 'good':
      return 'Good move';
    case 'inaccuracy':
      return 'Inaccuracy';
    case 'mistake':
      return 'Mistake';
    case 'blunder':
      return 'Blunder';
  }
}

/**
 * One plain sentence about a move, e.g.
 * "Nf6?? Blunder — Black's winning chances fell from 46% to 0% (allows mate in 1). Best was g6."
 */
export function verdictSentence(input: {
  san: string;
  mover: Side;
  judgement: Judgement;
  /** The engine's first choice before the move, in normal notation, if known. */
  bestSan?: string | undefined;
}): string {
  const { san, mover, judgement, bestSan } = input;
  if (judgement.verdict === 'best') return `${san} — best move.`;
  if (judgement.verdict === 'good') return `${san} — good move.`;

  const who = mover === 'white' ? 'White' : 'Black';
  const from = Math.round(judgement.winBefore);
  const to = Math.round(judgement.winAfter);
  let note = '';
  if (judgement.note?.kind === 'allows-mate') note = ` (allows mate in ${judgement.note.moves})`;
  if (judgement.note?.kind === 'missed-mate') note = ` (missed mate in ${judgement.note.moves})`;

  let sentence = `${san}${verdictSymbol(judgement.verdict)} ${verdictName(judgement.verdict)} — ${who}'s winning chances fell from ${from}% to ${to}%${note}.`;
  if (bestSan) sentence += ` Best was ${bestSan}.`;
  return sentence;
}
