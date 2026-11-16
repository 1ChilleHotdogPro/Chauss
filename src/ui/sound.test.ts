import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOUND_SETS } from '../appearance/appearance';
import { sampleFile } from './sound';

const NAMES = ['Move', 'Capture', 'Check', 'Victory', 'Draw'] as const;

describe('sampleFile', () => {
  it('recorded sets use their own move and capture; check is the move; a win or draw is the Original tune', () => {
    expect(sampleFile('closeup', 'Move')).toBe('closeup/Move.wav');
    expect(sampleFile('closeup', 'Capture')).toBe('closeup/Capture.wav');
    expect(sampleFile('closeup', 'Check')).toBe('closeup/Move.wav');
    expect(sampleFile('closeup', 'Victory')).toBe('Victory.mp3');
    expect(sampleFile('sfx', 'Check')).toBe('Check.mp3');
  });

  it('every file any set needs exists in public/sounds', () => {
    for (const { id } of SOUND_SETS) {
      if (id === 'off') continue;
      for (const name of NAMES) {
        const file = sampleFile(id, name);
        expect(existsSync(resolve(__dirname, '../../public/sounds', file)), `${id}: ${file}`).toBe(true);
      }
    }
  });
});
