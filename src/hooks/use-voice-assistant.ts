"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbState } from "@/components/veronique-orb";
import type { ActionEffectData } from "@/components/action-card";
import { blobToBase64, blobToWav, pickMimeType } from "@/lib/audio-utils";
import {
  audioLevels,
  getAudioContext,
  rmsAmplitude,
  bassEnergy,
} from "@/lib/audio-levels";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionEffect?: ActionEffectData | null;
  ts: number;
}

interface UseVoiceAssistantOptions {
  userId: string;
  firstName: string;
}

interface UseVoiceAssistantReturn {
  state: OrbState;
  messages: AssistantMessage[];
  isSupported: boolean;
  isBusy: boolean;
  isRecording: boolean;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendText: (text: string) => Promise<void>;
  clearError: () => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4);
}

export function useVoiceAssistant({
  userId,
  firstName,
}: UseVoiceAssistantOptions): UseVoiceAssistantReturn {
  const [state, setState] = useState<OrbState>("idle");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesRef = useRef<AssistantMessage[]>([]);
  const busyRef = useRef(false);

  // audio analyser bookkeeping (drives the 3D orb reactivity)
  const micAnalyserRef = useRef<{ analyser: AnalyserNode; raf: number; src: MediaStreamAudioSourceNode } | null>(null);
  const ttsAnalyserRef = useRef<{ analyser: AnalyserNode; raf: number; src: MediaElementAudioSourceNode } | null>(null);

  const stopMicAnalyser = useCallback(() => {
    const m = micAnalyserRef.current;
    if (m) {
      cancelAnimationFrame(m.raf);
      try { m.src.disconnect(); } catch { /* noop */ }
      try { m.analyser.disconnect(); } catch { /* noop */ }
      micAnalyserRef.current = null;
    }
    audioLevels.micLevel = 0;
  }, []);

  const stopTtsAnalyser = useCallback(() => {
    const t = ttsAnalyserRef.current;
    if (t) {
      cancelAnimationFrame(t.raf);
      try { t.src.disconnect(); } catch { /* noop */ }
      try { t.analyser.disconnect(); } catch { /* noop */ }
      ttsAnalyserRef.current = null;
    }
    audioLevels.ttsLevel = 0;
    audioLevels.ttsBass = 0;
  }, []);

  const isSupported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia &&
    !!window.MediaRecorder;

  // keep messagesRef in sync for chat history
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load previous conversation history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/messages?userId=${encodeURIComponent(userId)}&limit=20`);
        const data = await res.json();
        if (cancelled || !Array.isArray(data.messages)) return;
        const restored: AssistantMessage[] = data.messages.map((m: { id?: string; role: string; content: string; actionEffect?: ActionEffectData | null; createdAt?: string }) => ({
          id: m.id || uid(),
          role: m.role as "user" | "assistant",
          content: m.content,
          actionEffect: m.actionEffect || null,
          ts: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
        }));
        setMessages(restored);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;
    setState("speaking");
    stopTtsAnalyser();
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "tongtong", speed: 1.0 }),
      });
      if (!res.ok) throw new Error("Synthèse vocale indisponible");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;

      // Hook the audio element into a Web Audio AnalyserNode so the 3D orb
      // can deform in sync with the spoken waveform in real time.
      const ctx = getAudioContext();
      let ttsAnal: { analyser: AnalyserNode; raf: number; src: MediaElementAudioSourceNode } | null = null;
      if (ctx) {
        try {
          if (ctx.state === "suspended") await ctx.resume();
          const src = ctx.createMediaElementSource(audio);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.75;
          src.connect(analyser);
          analyser.connect(ctx.destination);
          const timeData = new Uint8Array(analyser.fftSize);
          const freqData = new Uint8Array(analyser.frequencyBinCount);
          const loop = () => {
            analyser.getByteTimeDomainData(timeData);
            analyser.getByteFrequencyData(freqData);
            audioLevels.ttsLevel = rmsAmplitude(timeData);
            audioLevels.ttsBass = bassEnergy(freqData);
            ttsAnal!.raf = requestAnimationFrame(loop);
          };
          loop();
          ttsAnal = { analyser, raf: 0, src };
          ttsAnalyserRef.current = ttsAnal;
        } catch {
          // If the element was already wired once, just play without analysis
        }
      }

      audio.onended = () => {
        stopTtsAnalyser();
        setState("idle");
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        stopTtsAnalyser();
        setState("idle");
        URL.revokeObjectURL(url);
      };
      await audio.play().catch(() => {
        stopTtsAnalyser();
        setState("idle");
        URL.revokeObjectURL(url);
      });
    } catch {
      stopTtsAnalyser();
      setState("idle");
    }
  }, [stopTtsAnalyser]);

  const processUserInput = useCallback(
    async (text: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setIsBusy(true);
      setError(null);

      const userMsg: AssistantMessage = {
        id: uid(),
        role: "user",
        content: text,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      messagesRef.current = [...messagesRef.current, userMsg];

      setState("thinking");
      try {
        const history = messagesRef.current
          .filter((m) => m.id !== userMsg.id)
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, message: text, history }),
        });
        if (!res.ok) throw new Error("Le cerveau IA ne répond pas");
        const data = await res.json();
        const replyText: string = data.text || "Désolé, je n'ai pas compris.";
        const effect: ActionEffectData | null = data.actionEffect || null;

        const assistantMsg: AssistantMessage = {
          id: uid(),
          role: "assistant",
          content: replyText,
          actionEffect: effect,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        messagesRef.current = [...messagesRef.current, assistantMsg];

        // Auto-execute the open_url action (best-effort; popup may be blocked)
        if (effect?.kind === "open_url" && effect.url) {
          window.open(effect.url, "_blank", "noopener,noreferrer");
        }

        await speak(replyText);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue");
        setState("idle");
      } finally {
        busyRef.current = false;
        setIsBusy(false);
      }
    },
    [userId, speak]
  );

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError("Votre navigateur ne supporte pas l'enregistrement audio.");
      return;
    }
    if (busyRef.current || isRecording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Wire the mic into an AnalyserNode so the orb reacts to voice amplitude
      // while listening (without routing to speakers → no feedback).
      const ctx = getAudioContext();
      if (ctx) {
        try {
          if (ctx.state === "suspended") await ctx.resume();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.7;
          src.connect(analyser);
          const timeData = new Uint8Array(analyser.fftSize);
          const loop = () => {
            analyser.getByteTimeDomainData(timeData);
            audioLevels.micLevel = rmsAmplitude(timeData);
            micAnalyserRef.current!.raf = requestAnimationFrame(loop);
          };
          loop();
          micAnalyserRef.current = { analyser, raf: 0, src };
        } catch {
          /* analysis optional */
        }
      }

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopMicAnalyser();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        // stop mic tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (blob.size < 500) {
          setError("Aucun discours détecté. Réessayez.");
          setState("idle");
          return;
        }

        setState("thinking");
        try {
          const wavBlob = await blobToWav(blob);
          const base64 = await blobToBase64(wavBlob);
          const asrRes = await fetch("/api/asr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64, format: "wav" }),
          });
          if (!asrRes.ok) throw new Error("Transcription échouée");
          const asrData = await asrRes.json();
          const transcript: string = (asrData.text || "").trim();
          if (!transcript) {
            setError(
              asrData.reason === "no_french_detected"
                ? "Je n'ai pas compris. Pouvez-vous répéter en français ?"
                : "Je n'ai pas compris. Pouvez-vous répéter ?"
            );
            setState("idle");
            return;
          }
          await processUserInput(transcript);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur de transcription");
          setState("idle");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setState("listening");
    } catch {
      setError("Accès au microphone refusé. Autorisez-le pour parler à Véronique.");
      setState("idle");
    }
  }, [isSupported, isRecording, processUserInput]);

  const stopListening = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    stopMicAnalyser();
    setIsRecording(false);
  }, [stopMicAnalyser]);

  const sendText = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || busyRef.current) return;
      await processUserInput(t);
    },
    [processUserInput]
  );

  const clearError = useCallback(() => setError(null), []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopMicAnalyser();
      stopTtsAnalyser();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [stopMicAnalyser, stopTtsAnalyser]);

  // keep firstName referenced to avoid unused warning (used via profile in backend)
  void firstName;

  return {
    state,
    messages,
    isSupported,
    isBusy,
    isRecording,
    error,
    startListening,
    stopListening,
    sendText,
    clearError,
  };
}
