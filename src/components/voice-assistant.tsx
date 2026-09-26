"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic,
  Square,
  Send,
  Keyboard,
  X,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useProfile } from "@/lib/profile-context";
import { useVoiceAssistant, type AssistantMessage } from "@/hooks/use-voice-assistant";
import { FluidOrb } from "@/components/fluid-orb";
import type { OrbState } from "@/components/veronique-orb";
import { ActionCard, type ActionEffectData } from "@/components/action-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<OrbState, string> = {
  idle: "Prête à vous écouter",
  listening: "Je vous écoute…",
  thinking: "Je réfléchis…",
  speaking: "Je parle…",
};

const STATE_HINT: Record<OrbState, string> = {
  idle: "Touchez le micro et parlez",
  listening: "Parlez naturellement — touchez pour arrêter",
  thinking: "Un instant…",
  speaking: "Écoutez la réponse",
};

export function VoiceAssistant() {
  const { profile } = useProfile();
  const {
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
  } = useVoiceAssistant({ userId: profile?.userId || "", firstName: profile?.firstName || "" });

  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, state]);

  async function handleMic() {
    if (isRecording) {
      stopListening();
    } else {
      await startListening();
    }
  }

  async function handleText(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await sendText(t);
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Orb area */}
      <div className="relative flex shrink-0 flex-col items-center gap-1 pt-2 pb-1 px-4">
        <FluidOrb state={state} size={260} />
        <div className="mt-1 text-center">
          <p className="text-sm font-semibold text-white">{STATE_LABEL[state]}</p>
          <p className="text-xs text-white/50">{STATE_HINT[state]}</p>
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="relative flex-1 min-h-0 overflow-y-auto px-4 py-3 pb-6 mx-auto w-full max-w-2xl scroll-smooth"
      >
        {messages.length === 0 ? (
          <EmptyState firstName={profile?.firstName || ""} />
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="relative mx-auto w-full max-w-2xl px-4"
          >
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 backdrop-blur">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={clearError} className="text-amber-300 hover:text-amber-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="relative shrink-0 z-10 border-t border-white/10 bg-black/60 backdrop-blur-md">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          {showText ? (
            <form onSubmit={handleText} className="flex items-center gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Écrivez à Véronique…"
                disabled={isBusy}
                autoFocus
                className="h-11 bg-white/5 border-white/15 text-white placeholder:text-white/35 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/30"
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0 hover:opacity-90"
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-11 w-11 shrink-0 border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => setShowText(false)}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                onClick={() => setShowText(true)}
                aria-label="Saisie texte"
                title="Saisie texte"
              >
                <Keyboard className="h-5 w-5" />
              </Button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.04 }}
                onClick={handleMic}
                disabled={!isSupported}
                aria-label={isRecording ? "Arrêter" : "Parler"}
                className={cn(
                  "relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-xl transition-colors",
                  "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  isRecording && "ring-4 ring-fuchsia-400/50"
                )}
              >
                {isRecording ? (
                  <Square className="h-6 w-6 fill-white" />
                ) : (
                  <Mic className="h-7 w-7" />
                )}
                {isRecording && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-fuchsia-500"
                    animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
              </motion.button>

              <div className="h-11 w-11" aria-hidden />
            </div>
          )}
          {!isSupported && (
            <p className="mt-2 text-center text-xs text-amber-300/80">
              Micro non supporté — utilisez la saisie texte.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ firstName }: { firstName: string }) {
  const suggestions = [
    `Bonjour Véronique`,
    `Ouvre YouTube`,
    `Allume la lampe torche`,
    `Appelle maman`,
  ];
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
        <Sparkles className="h-6 w-6 text-fuchsia-300" />
      </div>
      <p className="text-sm text-white/60 max-w-xs">
        Bonjour <span className="font-semibold text-white">{firstName}</span>. Touchez le
        micro et parlez-moi, ou choisissez un exemple :
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <span
            key={s}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55 backdrop-blur"
          >
            « {s} »
          </span>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  const isUser = message.role === "user";
  const time = new Date(message.ts).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex w-full gap-2.5", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-fuchsia-500/30">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div className={cn("max-w-[80%] sm:max-w-[70%]", isUser && "items-end text-right")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm backdrop-blur",
            isUser
              ? "rounded-br-md bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 text-white"
              : "rounded-bl-md bg-white/5 border border-white/10 text-white"
          )}
        >
          <span>{message.content}</span>
        </div>
        {message.actionEffect && (
          <div className="mt-2">
            <ActionCard effect={message.actionEffect as ActionEffectData} timestamp={time} />
          </div>
        )}
        <div
          className={cn(
            "mt-1 text-[10px] text-white/40",
            isUser ? "text-right" : "text-left"
          )}
        >
          {time}
        </div>
      </div>
    </motion.div>
  );
}
