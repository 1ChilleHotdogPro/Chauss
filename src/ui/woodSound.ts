// Code-generated "Wood" sound set: wooden pieces on a wooden board.
// Everything here is a pure function that returns sample arrays, so it can be
// unit-tested without Web Audio. Sounds are built from a tiny noise "tick"
// (the moment of impact) that excites a few damped sine "modes" (the ringing
// of the wood), which is roughly how a real knock on wood behaves.

export type WoodSampleName = 'Move' | 'Capture' | 'Check' | 'Victory' | 'Draw';

/** Small seeded PRNG (mulberry32) so every render is identical. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Adds one damped sine (a resonant "mode") starting at `start` seconds. */
function addMode(
  out: Float32Array,
  sr: number,
  start: number,
  freq: number,
  amp: number,
  tau: number, // decay time constant in seconds (amplitude falls to 37%)
  attack = 0.0002, // seconds; softens the very first edge
): void {
  const s0 = Math.round(start * sr);
  const w = (2 * Math.PI * freq) / sr;
  const end = Math.min(out.length, s0 + Math.ceil(tau * 7 * sr));
  for (let i = s0; i < end; i++) {
    const t = (i - s0) / sr;
    const env = Math.exp(-t / tau) * (1 - Math.exp(-t / attack));
    out[i]! += amp * env * Math.sin(w * (i - s0));
  }
}

/**
 * Adds a short band-passed noise burst: the "contact" click of wood on wood.
 * Uses a standard RBJ band-pass biquad on exponentially decaying white noise.
 */
function addTransient(
  out: Float32Array,
  sr: number,
  start: number,
  amp: number,
  centre: number,
  q: number,
  rand: () => number,
  tau = 0.0005,
): void {
  const s0 = Math.round(start * sr);
  const len = Math.min(out.length - s0, Math.ceil(0.004 * sr));
  const w0 = (2 * Math.PI * Math.min(centre, sr * 0.45)) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const x = (rand() * 2 - 1) * Math.exp(-t / tau);
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[s0 + i]! += amp * y;
  }
}

/** Slight random detune (about ±1%) so modes are not perfectly "synthetic". */
function detune(freq: number, rand: () => number): number {
  return freq * (1 + (rand() - 0.5) * 0.02);
}

/** One wooden knock: impact noise plus a body thump and three wood modes. */
function addTock(
  out: Float32Array,
  sr: number,
  start: number,
  rand: () => number,
  opts: { gain: number; body: number; bodyAmp: number; bodyTau: number; modes: [number, number, number] },
): void {
  const g = opts.gain;
  addTransient(out, sr, start, 0.9 * g, 3200, 0.7, rand);
  addMode(out, sr, start, detune(opts.body, rand), opts.bodyAmp * g, opts.bodyTau, 0.0008);
  // Inharmonic wood modes: higher ones are quieter and die faster.
  addMode(out, sr, start, detune(opts.modes[0], rand), 0.6 * g, 0.03);
  addMode(out, sr, start, detune(opts.modes[1], rand), 0.35 * g, 0.02);
  addMode(out, sr, start, detune(opts.modes[2], rand), 0.2 * g, 0.012);
}

/** One marimba-like note: soft mallet tick, fundamental and a fast 4x partial. */
function addMarimba(out: Float32Array, sr: number, start: number, freq: number, amp: number, tau: number, rand: () => number): void {
  addTransient(out, sr, start, 0.15 * amp, 2000, 1, rand, 0.0008);
  addMode(out, sr, start, freq, amp, tau, 0.0015);
  addMode(out, sr, start, freq * 3.98, 0.35 * amp, tau * 0.22, 0.001);
}

/** Removes DC, fades in/out, and scales so the loudest sample equals `peak`. */
function finish(out: Float32Array, sr: number, peak: number, fadeOut: number): Float32Array {
  let mean = 0;
  for (let i = 0; i < out.length; i++) mean += out[i]!;
  mean /= out.length;
  for (let i = 0; i < out.length; i++) out[i]! -= mean;

  // Very short fade-in (0.5 ms) so the first sample is exactly zero but the
  // impact still sounds crisp; raised-cosine fade-out so the tail ends at zero.
  const fin = Math.max(1, Math.round(0.0005 * sr));
  for (let i = 0; i < fin && i < out.length; i++) out[i]! *= i / fin;
  const fout = Math.max(1, Math.round(fadeOut * sr));
  for (let i = 0; i < fout && i < out.length; i++) {
    const k = out.length - 1 - i; // k = last sample when i = 0
    out[k]! *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fout);
  }

  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]!));
  if (max > 0) for (let i = 0; i < out.length; i++) out[i]! *= peak / max;
  return out;
}

const NOTE = { E4: 329.63, G4: 392.0, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 };

/**
 * Renders one sound of the "Wood" set as mono samples between -1 and 1.
 * - Move: a crisp wooden "tock" (~120 ms).
 * - Capture: a heavier knock plus a smaller second click, like a piece being
 *   knocked off and set down (~180 ms).
 * - Check: the move tock with a short, warm bell tone on top (~350 ms).
 * - Victory: rising marimba notes C5 E5 G5 C6 (~1 s).
 * - Draw: two soft marimba notes, G4 then E4 (~0.6 s).
 * The result is the same every time (noise comes from a fixed seed).
 */
export function renderWoodSample(name: WoodSampleName, sampleRate: number): Float32Array {
  const sr = sampleRate;
  const make = (seconds: number) => new Float32Array(Math.round(seconds * sr));

  switch (name) {
    case 'Move': {
      const rand = makeRandom(0x5eed01);
      const out = make(0.12);
      addTock(out, sr, 0, rand, { gain: 1, body: 170, bodyAmp: 1, bodyTau: 0.022, modes: [760, 1510, 2650] });
      return finish(out, sr, 0.8, 0.012);
    }
    case 'Capture': {
      const rand = makeRandom(0x5eed02);
      const out = make(0.18);
      // Lower, louder, longer body than a normal move.
      addTock(out, sr, 0, rand, { gain: 1.2, body: 135, bodyAmp: 1.4, bodyTau: 0.03, modes: [640, 1380, 2450] });
      // Second, smaller knock ~35 ms later with slightly different wood modes.
      addTock(out, sr, 0.035, rand, { gain: 0.4, body: 190, bodyAmp: 0.8, bodyTau: 0.018, modes: [840, 1690, 2900] });
      return finish(out, sr, 0.8, 0.015);
    }
    case 'Check': {
      const rand = makeRandom(0x5eed03);
      const out = make(0.35);
      addTock(out, sr, 0, rand, { gain: 1, body: 170, bodyAmp: 1, bodyTau: 0.022, modes: [760, 1510, 2650] });
      // Warm bell: 1047 Hz plus an inharmonic 2.76x partial, quieter than the click.
      addMode(out, sr, 0.008, 1047, 0.32, 0.09, 0.002);
      addMode(out, sr, 0.008, 1047 * 2.76, 0.1, 0.05, 0.002);
      return finish(out, sr, 0.8, 0.03);
    }
    case 'Victory': {
      const rand = makeRandom(0x5eed04);
      const out = make(1.0);
      addMarimba(out, sr, 0.0, NOTE.C5, 0.8, 0.12, rand);
      addMarimba(out, sr, 0.12, NOTE.E5, 0.8, 0.12, rand);
      addMarimba(out, sr, 0.24, NOTE.G5, 0.8, 0.12, rand);
      addMarimba(out, sr, 0.4, NOTE.C6, 1.0, 0.18, rand); // held final note
      return finish(out, sr, 0.6, 0.06);
    }
    case 'Draw': {
      const rand = makeRandom(0x5eed05);
      const out = make(0.6);
      addMarimba(out, sr, 0.0, NOTE.G4, 0.7, 0.14, rand);
      addMarimba(out, sr, 0.2, NOTE.E4, 0.7, 0.16, rand);
      return finish(out, sr, 0.6, 0.06);
    }
  }
}
