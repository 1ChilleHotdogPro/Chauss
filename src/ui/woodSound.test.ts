import { describe, expect, it } from 'vitest';
import { renderWoodSample, type WoodSampleName } from './woodSound';

const NAMES: WoodSampleName[] = ['Move', 'Capture', 'Check', 'Victory', 'Draw'];
// Rough expected lengths in seconds.
const SECONDS: Record<WoodSampleName, number> = { Move: 0.12, Capture: 0.18, Check: 0.35, Victory: 1.0, Draw: 0.6 };

describe('renderWoodSample', () => {
  for (const sr of [44100, 48000]) {
    for (const name of NAMES) {
      it(`${name} at ${sr} Hz is a clean, normalised sample`, () => {
        const s = renderWoodSample(name, sr);
        expect(s.length).toBeGreaterThan(0);
        expect(Math.abs(s.length / sr - SECONDS[name])).toBeLessThan(0.05);

        let peak = 0;
        let sum = 0;
        for (const x of s) {
          expect(Number.isFinite(x)).toBe(true);
          peak = Math.max(peak, Math.abs(x));
          sum += x;
        }
        expect(peak).toBeGreaterThan(0.3);
        expect(peak).toBeLessThanOrEqual(1);
        expect(Math.abs(sum / s.length)).toBeLessThan(0.01); // no DC offset
        expect(Math.abs(s[0]!)).toBeLessThan(0.01);
        expect(Math.abs(s[s.length - 1]!)).toBeLessThan(0.01);
      });
    }
  }

  it('is deterministic', () => {
    for (const name of NAMES) {
      expect(renderWoodSample(name, 44100)).toEqual(renderWoodSample(name, 44100));
    }
  });

  it('Capture is longer than Move', () => {
    expect(renderWoodSample('Capture', 48000).length).toBeGreaterThan(renderWoodSample('Move', 48000).length);
  });

  it('Victory and Draw are quieter than the clicks', () => {
    const peak = (s: Float32Array) => s.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(peak(renderWoodSample('Victory', 44100))).toBeCloseTo(0.6, 5);
    expect(peak(renderWoodSample('Move', 44100))).toBeCloseTo(0.8, 5);
  });
});
