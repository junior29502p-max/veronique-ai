"use client";

// Browser-side audio helpers: record via MediaRecorder and convert the
// resulting webm/opus blob into a 16 kHz mono WAV blob that the ASR API
// accepts reliably.

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip the data URL prefix
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const wavBlob = encodeWav(audioBuffer, 16000);
  audioCtx.close();
  return wavBlob;
}

function encodeWav(audioBuffer: AudioBuffer, targetSampleRate: number): Blob {
  const numChannels = 1; // mono
  const sourceSampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const channelData = audioBuffer.getChannelData(0);

  // Resample to targetSampleRate (linear interpolation)
  const ratio = targetSampleRate / sourceSampleRate;
  const outFrames = Math.max(1, Math.round(numFrames * ratio));
  const resampled = new Float32Array(outFrames);
  for (let i = 0; i < outFrames; i++) {
    const srcIdx = i / ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(idx0 + 1, numFrames - 1);
    const frac = srcIdx - idx0;
    resampled[i] = channelData[idx0] * (1 - frac) + channelData[idx1] * frac;
  }

  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = outFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < outFrames; i++) {
    let s = Math.max(-1, Math.min(1, resampled[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function pickMimeType(): string | undefined {
  if (typeof window === "undefined" || !window.MediaRecorder) return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (window.MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}
