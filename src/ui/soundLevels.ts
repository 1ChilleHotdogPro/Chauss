import type { SoundSetId } from '../appearance/appearance';

/**
 * Loudness match per sound set (measured: each set's Move.mp3 and Capture.mp3 decoded in
 * Chromium, gated RMS over 10 ms windows within 30 dB of the loudest one, averaged in dB;
 * gain = piano level / set level, clamped to 0.5..1.6, rounded to 0.05), so switching sets
 * keeps moves at about the same volume. Missing = 1.
 *
 *              Move RMS   Capture RMS   mean      gain
 *   piano      -21.2 dB   -19.9 dB      -20.6 dB  1 (reference)
 *   sfx        -20.9 dB   -21.7 dB      -21.3 dB  1.10
 *   nes        -14.3 dB   -19.7 dB      -17.0 dB  0.65
 *   futuristic -25.2 dB   -19.5 dB      -22.4 dB  1.25, capped at 1.15 (its Capture peaks at
 *                                                         -1.5 dBFS, so 1.25 would clip it)
 */
export const SOUND_SET_GAIN: Partial<Record<SoundSetId, number>> = {
  sfx: 1.1,
  nes: 0.65,
  futuristic: 1.15,
};
