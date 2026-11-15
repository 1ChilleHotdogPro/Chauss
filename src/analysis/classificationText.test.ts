import { describe, expect, it } from 'vitest';
import { CLASSIFICATION_INFO, classificationSentence } from './classificationText';
import { CLASSIFICATIONS } from './accuracy';

describe('classificationSentence', () => {
  const base = { winBefore: 48.4, winAfter: 9.2 };

  it('explains a blunder with the drop, a mate note and the best move', () => {
    expect(
      classificationSentence({
        san: '14...Qxd4',
        mover: 'black',
        result: { ...base, classification: 'blunder', note: { kind: 'allows-mate', moves: 2 } },
        bestSan: '14...Nf6',
      }),
    ).toBe("14...Qxd4 is a blunder: Black's winning chances fell from 48% to 9% (it allows mate in 2). Best was 14...Nf6.");
  });

  it('uses "an" for an inaccuracy and names the opponent for a miss', () => {
    expect(classificationSentence({ san: '3.c3', mover: 'white', result: { ...base, classification: 'inaccuracy' } })).toMatch(
      /^3\.c3 is an inaccuracy:/,
    );
    expect(classificationSentence({ san: '9.Nf3', mover: 'white', result: { ...base, classification: 'miss' } })).toMatch(
      /lets Black's mistake go unpunished/,
    );
  });

  it('praises good moves without win-% numbers', () => {
    expect(classificationSentence({ san: '1.e4', mover: 'white', result: { ...base, classification: 'book' } })).toBe(
      '1.e4 is a book move: masters play it here.',
    );
    expect(classificationSentence({ san: '5.Qh5', mover: 'white', result: { ...base, classification: 'great' } })).toMatch(
      /only move/,
    );
  });

  it('has a name and symbol for every classification', () => {
    for (const name of CLASSIFICATIONS) {
      expect(CLASSIFICATION_INFO[name].name).not.toBe('');
      expect(CLASSIFICATION_INFO[name].symbol).not.toBe('');
    }
  });
});
