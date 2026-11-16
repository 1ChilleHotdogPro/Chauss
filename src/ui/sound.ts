import type { MoveSound } from '../game/moveSound';
import { DEFAULT_APPEARANCE, type SoundSetId } from '../appearance/appearance';
import { SOUND_SET_GAIN } from './soundLevels';

/**
 * Move sounds, played with the browser's Web Audio, in one of several sound sets chosen in Settings
 * (files in public/sounds, see CREDITS.md). 'sfx' (shown as "Original") sits in public/sounds itself
 * as mp3 files. The recorded sets are real chess pieces: public/sounds/<set>/Move.wav and Capture.wav.
 * They have no check, win or draw recordings: check is their move sound, and a win or draw uses the
 * Original set's tune. 'off' is silent.
 * The cursed-mode explosion is its own file and plays whatever the set, even 'off'.
 * Browsers keep audio switched off until the page has been clicked or a key pressed, so the audio
 * context is only created then. A set's sounds are loaded the first time they are needed after that.
 */
export interface MoveSounds {
  play(sound: MoveSound | 'draw'): void;
  /** Which sound set the moves use. Starts as the default set. */
  setSoundSet(set: SoundSetId): void;
  /** Play a move and then a capture in the current set, so a set can be tried out. */
  previewSet(): void;
  /** While cursed, every capture is a very loud explosion instead. */
  setCursed(cursed: boolean): void;
  /** 0 (silent) to about 3 (very loud). Only the explosions use it. */
  setExplosionVolume(volume: number): void;
  /** Play the explosion once, so the volume slider can be tried out. */
  previewExplosion(): void;
}

type AudioContextType = typeof AudioContext;
type SetSample = 'Move' | 'Capture' | 'Check' | 'Victory' | 'Draw';
type LoadedSet = Exclude<SoundSetId, 'off'>;

/** Which sample each sound uses. There is no castling sample: it is the move click, twice. */
const FILE_FOR: Record<MoveSound | 'draw', SetSample> = {
  move: 'Move',
  castle: 'Move',
  capture: 'Capture',
  check: 'Check',
  checkmate: 'Victory',
  draw: 'Draw',
};

const SET_SAMPLES: readonly SetSample[] = ['Move', 'Capture', 'Check', 'Victory', 'Draw'];

/** The explosion is stored under this key; other samples under their file's path. */
const EXPLOSION = 'Explosion.mp3';

/** Which file a set uses for a sample, as a path inside public/sounds (also the buffer's key). */
export function sampleFile(set: LoadedSet, name: SetSample): string {
  if (set === 'sfx') return `${name}.mp3`;
  if (name === 'Move' || name === 'Capture') return `${set}/${name}.wav`;
  if (name === 'Check') return `${set}/Move.wav`;
  return `${name}.mp3`; // Victory, Draw: the Original set's tune
}

function fileUrl(file: string): string {
  return `${import.meta.env.BASE_URL}sounds/${file}`;
}

export function createMoveSounds(): MoveSounds {
  let context: AudioContext | null = null;
  let explosionBus: GainNode | null = null;
  /** Decoded sounds, keyed by file. */
  const buffers = new Map<string, AudioBuffer>();
  /** One loading job per file, so a file shared by several sets is only fetched once. */
  const fileLoads = new Map<string, Promise<void>>();
  let soundSet: SoundSetId = DEFAULT_APPEARANCE.sounds;
  let cursed = false;
  let explosionVolume = 1.5;

  function loadFile(ctx: AudioContext, file: string): Promise<void> {
    const existing = fileLoads.get(file);
    if (existing) return existing;
    const job = (async () => {
      try {
        const response = await fetch(fileUrl(file));
        if (!response.ok) return;
        buffers.set(file, await ctx.decodeAudioData(await response.arrayBuffer()));
      } catch {
        // A missing or undecodable file just means that sound stays silent.
      }
    })();
    fileLoads.set(file, job);
    return job;
  }

  /** Load a set's sounds (each file once). Resolves when they are ready, or have failed. */
  function loadSet(ctx: AudioContext, set: SoundSetId): Promise<void> {
    if (set === 'off') return Promise.resolve();
    return Promise.all(SET_SAMPLES.map((name) => loadFile(ctx, sampleFile(set, name)))).then(() => undefined);
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
      void loadFile(ctx, EXPLOSION);
      void loadSet(ctx, soundSet);
    } catch {
      context = null;
    }
  }
  // The first click or key press starts the audio; later ones just make sure it is running.
  for (const type of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }

  function start(ctx: AudioContext, key: string, delay: number, destination: AudioNode, gain = 1): void {
    const buffer = buffers.get(key);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const level = ctx.createGain();
    level.gain.value = gain;
    source.connect(level).connect(destination);
    source.start(ctx.currentTime + delay);
  }

  /** Play one sample of the current set; each set has its own loudness so they match. */
  function startSample(ctx: AudioContext, name: SetSample, delay: number, gain = 1): void {
    if (soundSet === 'off') return;
    const level = gain * (SOUND_SET_GAIN[soundSet] ?? 1);
    start(ctx, sampleFile(soundSet, name), delay, ctx.destination, level);
  }

  function explode(ctx: AudioContext): void {
    if (explosionBus && explosionVolume > 0) start(ctx, EXPLOSION, 0, explosionBus);
  }

  function play(sound: MoveSound | 'draw'): void {
    const ctx = context;
    if (!ctx || ctx.state !== 'running') return;
    if (cursed && sound === 'capture') {
      explode(ctx);
      return;
    }
    startSample(ctx, FILE_FOR[sound], 0);
    if (sound === 'castle') startSample(ctx, 'Move', 0.11, 0.8); // king, then rook
    if (sound === 'checkmate') startSample(ctx, 'Check', 0);
  }

  async function previewSet(): Promise<void> {
    unlock();
    const ctx = context;
    if (!ctx || soundSet === 'off') return;
    const set = soundSet;
    // Wait for the set to finish loading (and the audio to start) before playing it.
    await Promise.all([
      loadSet(ctx, set),
      ctx.state === 'running' ? undefined : ctx.resume().catch(() => undefined),
    ]);
    // Another set may have been picked meanwhile; then this preview is dropped.
    if (soundSet !== set || ctx.state !== 'running') return;
    startSample(ctx, 'Move', 0);
    startSample(ctx, 'Capture', 0.35);
  }

  return {
    play,
    setSoundSet: (set) => {
      soundSet = set;
      if (context) void loadSet(context, set);
    },
    previewSet: () => {
      void previewSet();
    },
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
