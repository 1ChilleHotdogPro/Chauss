import type { MoveSound } from '../game/moveSound';

/**
 * Move sounds, made with the browser's Web Audio (no sound files). Browsers keep audio switched off
 * until the page has been clicked or a key pressed, so the audio context is only created then.
 */
export interface MoveSounds {
  play(sound: MoveSound): void;
}

type AudioContextType = typeof AudioContext;

export function createMoveSounds(): MoveSounds {
  let context: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;

  function unlock(): void {
    if (context) {
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      return;
    }
    const Ctor: AudioContextType | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextType }).webkitAudioContext;
    if (!Ctor) return;
    try {
      context = new Ctor();
    } catch {
      context = null;
    }
  }
  // The first click or key press starts the audio; later ones just make sure it is running.
  for (const type of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }

  /** A very short burst of filtered noise: the "tock" of a piece on the board. */
  function tock(ctx: AudioContext, start: number, gain: number, frequency: number, length: number): void {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 1.2;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + length);
    source.connect(filter).connect(envelope).connect(ctx.destination);
    source.start(start, 0, length + 0.02);
  }

  function tone(ctx: AudioContext, start: number, frequency: number, length: number, gain: number): void {
    const oscillator = ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(envelope).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.02);
  }

  function play(sound: MoveSound): void {
    const ctx = context;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (sound === 'move') {
      tock(ctx, now, 0.9, 900, 0.07);
    } else if (sound === 'capture') {
      // Sharper and louder than a plain move, with a second knock right behind it.
      tock(ctx, now, 1.6, 1800, 0.09);
      tock(ctx, now + 0.045, 1.1, 700, 0.12);
    } else {
      // Checkmate: the knock, then a falling three-note figure.
      tock(ctx, now, 1.4, 1200, 0.09);
      tone(ctx, now + 0.12, 659.25, 0.28, 0.25);
      tone(ctx, now + 0.3, 523.25, 0.28, 0.25);
      tone(ctx, now + 0.48, 392, 0.6, 0.3);
    }
  }

  return { play };
}
