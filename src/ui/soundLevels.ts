import type { SoundSetId } from '../appearance/appearance';

/**
 * Loudness match per sound set, so switching sets keeps moves at about the same volume. Missing = 1.
 * Measured: each set's Move and Capture decoded in Chromium, RMS over 10 ms windows within 30 dB of the
 * loudest one, averaged in dB; gain brings the set to about -21.5 dB (the Original set's level).
 * Never so much that a sound clips: the recorded files peak at 0.7 (move) and 0.85 (capture).
 *
 *              Move      Capture   mean      gain
 *   sfx        -20.7 dB  -21.5 dB  -21.1 dB  1
 *   closeup    -18.6 dB  -14.3 dB  -16.5 dB  0.56
 *   room       -19.4 dB  -18.3 dB  -18.9 dB  0.74
 *   soft       -21.8 dB  -17.1 dB  -19.5 dB  0.79
 *   wooden     -26.3 dB  -24.5 dB  -25.4 dB  1.15 (capped: sharp clicks, would clip above this)
 */
export const SOUND_SET_GAIN: Partial<Record<SoundSetId, number>> = {
  closeup: 0.56,
  room: 0.74,
  soft: 0.79,
  wooden: 1.15,
};
