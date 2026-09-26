"use client";

// Shared, mutable audio-level bridge between the Web Audio analysers (mic + TTS)
// and the Three.js orb render loop. The orb reads these every frame to drive
// vertex displacement / color reactivity. Using a module singleton avoids
// re-renders and keeps the 60fps animation decoupled from React state.

export interface AudioLevels {
  // 0..1 RMS amplitude of the microphone input (listening state)
  micLevel: number;
  // 0..1 amplitude of the TTS playback (speaking state)
  ttsLevel: number;
  // smoothed low-frequency energy for a more "organic" feel
  ttsBass: number;
}

export const audioLevels: AudioLevels = {
  micLevel: 0,
  ttsLevel: 0,
  ttsBass: 0,
};

let _sharedCtx: AudioContext | null = null;

/**
 * Lazily create and return a singleton AudioContext. Must be created/resumed
 * inside a user gesture; callers should call resume() to be safe.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!_sharedCtx) {
    _sharedCtx = new AC();
  }
  return _sharedCtx;
}

/** Compute an RMS amplitude (0..1) from time-domain waveform data. */
export function rmsAmplitude(timeData: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / timeData.length) * 2.2);
}

/** Average energy of the low-frequency bins (bass) for richer speaking motion. */
export function bassEnergy(freqData: Uint8Array): number {
  const bins = Math.min(12, freqData.length);
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += freqData[i];
  return Math.min(1, sum / bins / 255);
}
