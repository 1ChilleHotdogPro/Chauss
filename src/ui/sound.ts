import type { MoveSound } from '../game/moveSound';

/**
 * Move sounds: short recorded files (public/sounds, see CREDITS.md) played with the browser's Web Audio.
 * Browsers keep audio switched off until the page has been clicked or a key pressed, so the audio
 * context is only created then, and the files are fetched at that moment.
 */
export interface MoveSounds {
  play(sound: MoveSound | 'draw'): void;
  /** While cursed, every capture is a very loud explosion instead. */
  setCursed(cursed: boolean): void;
  /** 0 (silent) to about 3 (very loud). Only the explosions use it. */
  setExplosionVolume(volume: number): void;
  /** Play the explosion once, so the volume slider can be tried out. */
  previewExplosion(): void;
}

type AudioContextType = typeof AudioContext;
type SampleName = 'Move' | 'Capture' | 'Check' | 'Victory' | 'Draw' | 'Explosion';

/** Which file each sound uses. There is no castling recording: it is the move click, twice. */
const FILE_FOR: Record<MoveSound | 'draw', SampleName> = {
  move: 'Move',
  castle: 'Move',
  capture: 'Capture',
  check: 'Check',
  checkmate: 'Victory',
  draw: 'Draw',
};

const SAMPLES: readonly SampleName[] = ['Move', 'Capture', 'Check', 'Victory', 'Draw', 'Explosion'];

export function createMoveSounds(): MoveSounds {
  let context: AudioContext | null = null;
  let explosionBus: GainNode | null = null;
  const buffers = new Map<SampleName, AudioBuffer>();
  let cursed = false;
  let explosionVolume = 1.5;

  async function load(ctx: AudioContext, name: SampleName): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sounds/${name}.mp3`);
      if (!response.ok) return;
      buffers.set(name, await ctx.decodeAudioData(await response.arrayBuffer()));
    } catch {
      // A missing or undecodable file just means that sound stays silent.
    }
  }

  function unlock(): void {
    if (context) {
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      return;
    }
    const Ctor: AudioContextType | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextType }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      context = ctx;
      // The explosions go through a limiter so a high volume is loud, not just distorted.
      explosionBus = ctx.createGain();
      explosionBus.gain.value = explosionVolume;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.ratio.value = 20;
      explosionBus.connect(limiter).connect(ctx.destination);
      for (const name of SAMPLES) void load(ctx, name);
    } catch {
      context = null;
    }
  }
  // The first click or key press starts the audio; later ones just make sure it is running.
  for (const type of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }

  function start(ctx: AudioContext, name: SampleName, delay: number, destination: AudioNode, gain = 1): void {
    const buffer = buffers.get(name);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const level = ctx.createGain();
    level.gain.value = gain;
    source.connect(level).connect(destination);
    source.start(ctx.currentTime + delay);
  }

  function explode(ctx: AudioContext): void {
    if (explosionBus && explosionVolume > 0) start(ctx, 'Explosion', 0, explosionBus);
  }

  function play(sound: MoveSound | 'draw'): void {
    const ctx = context;
    if (!ctx || ctx.state !== 'running') return;
    if (cursed && sound === 'capture') {
      explode(ctx);
      return;
    }
    start(ctx, FILE_FOR[sound], 0, ctx.destination);
    if (sound === 'castle') start(ctx, 'Move', 0.11, ctx.destination, 0.8); // king, then rook
    if (sound === 'checkmate') start(ctx, 'Check', 0, ctx.destination);
  }

  return {
    play,
    setCursed: (value) => {
      cursed = value;
    },
    setExplosionVolume: (volume) => {
      explosionVolume = volume;
      if (explosionBus) explosionBus.gain.value = volume;
    },
    previewExplosion: () => {
      unlock();
      if (context && context.state === 'running') explode(context);
    },
  };
}
