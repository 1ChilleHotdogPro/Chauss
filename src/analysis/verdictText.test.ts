import { describe, expect, it } from 'vitest';
import type { Judgement } from './eval';
import { verdictName, verdictSentence, verdictSymbol } from './verdictText';

const judgement = (partial: Partial<Judgement>): Judgement => ({
  verdict: 'good',
  winBefore: 50,
  winAfter: 50,
  drop: 0,
  ...partial,
});

describe('verdictSymbol / verdictName', () => {
  it('uses the standard marks', () => {
    expect(verdictSymbol('inaccuracy')).toBe('?!');
    expect(verdictSymbol('mistake')).toBe('?');
    expect(verdictSymbol('blunder')).toBe('??');
    expect(verdictSymbol('good')).toBe('');
    expect(verdictSymbol('best')).toBe('');
  });

  it('names each verdict', () => {
    expect(verdictName('best')).toBe('Best move');
    expect(verdictName('blunder')).toBe('Blunder');
  });
});

describe('verdictSentence', () => {
  it('keeps good and best moves short', () => {
    expect(verdictSentence({ san: 'e4', mover: 'white', judgement: judgement({ verdict: 'best' }) })).toBe(
      'e4 — best move.',
    );
    expect(verdictSentence({ san: 'Nc6', mover: 'black', judgement: judgement({ verdict: 'good' }) })).toBe(
      'Nc6 — good move.',
    );
  });

  it('explains a blunder that allows mate and names the better move', () => {
    const text = verdictSentence({
      san: 'Nf6',
      mover: 'black',
      judgement: judgement({
        verdict: 'blunder',
        winBefore: 46.4,
        winAfter: 0,
        drop: 46.4,
        note: { kind: 'allows-mate', moves: 1 },
      }),
      bestSan: 'g6',
    });
    expect(text).toBe(
      "Nf6?? Blunder — Black's winning chances fell from 46% to 0% (allows mate in 1). Best was g6.",
    );
  });

  it('explains a missed mate', () => {
    const text = verdictSentence({
      san: 'Qd2',
      mover: 'white',
      judgement: judgement({
        verdict: 'inaccuracy',
        winBefore: 100,
        winAfter: 96.2,
        drop: 3.8,
        note: { kind: 'missed-mate', moves: 2 },
      }),
      bestSan: 'Qxf7#',
    });
    expect(text).toBe(
      "Qd2?! Inaccuracy — White's winning chances fell from 100% to 96% (missed mate in 2). Best was Qxf7#.",
    );
  });

  it('leaves out the better move when it is not known', () => {
    const text = verdictSentence({
      san: 'h4',
      mover: 'white',
      judgement: judgement({ verdict: 'mistake', winBefore: 55, winAfter: 33, drop: 22 }),
    });
    expect(text).toBe("h4? Mistake — White's winning chances fell from 55% to 33%.");
  });
});
