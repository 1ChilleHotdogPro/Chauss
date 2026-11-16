import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOUND_SETS } from '../appearance/appearance';
import { GAME_SOUNDS, gameSoundFile, sampleFile } from './sound';

const exists = (file: string) => existsSync(resolve(__dirname, '../../public/sounds', file));

describe('sound files', () => {
  it('recorded sets use their own wav files; Original uses the mp3s in public/sounds', () => {
    expect(sampleFile('closeup', 'Move')).toBe('closeup/Move.wav');
    expect(sampleFile('closeup', 'Capture')).toBe('closeup/Capture.wav');
    expect(sampleFile('sfx', 'Move')).toBe('Move.mp3');
  });

  it('check, checkmate and stalemate are shared sounds', () => {
    expect(gameSoundFile('Check')).toBe('game/Check.mp3');
    expect(gameSoundFile('Checkmate')).toBe('game/Checkmate.mp3');
    expect(gameSoundFile('Stalemate')).toBe('game/Stalemate.mp3');
  });

  it('every file any set needs exists in public/sounds', () => {
    for (const { id } of SOUND_SETS) {
      if (id === 'off') continue;
      for (const name of ['Move', 'Capture'] as const) {
        expect(exists(sampleFile(id, name)), `${id}: ${name}`).toBe(true);
      }
    }
    for (const name of GAME_SOUNDS) expect(exists(gameSoundFile(name)), name).toBe(true);
    expect(exists('Explosion.mp3')).toBe(true);
  });
});
