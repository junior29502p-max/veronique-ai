"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HealthData {
  config: { llmChain: string[]; stt: string; tts: string };
  keysPresent: { groq: boolean; openrouter: boolean; elevenlabs: boolean };
  connectivity: {
    groq: { reachable: boolean; status: number };
    openrouter: { reachable: boolean; status: number };
    elevenlabs: { reachable: boolean; status: number };
  };
}

export function ProviderStatus() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/providers/health");
        const data = (await res.json()) as HealthData;
        if (!cancelled) setHealth(data);
      } catch {
        /* silent */
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!health) return null;

  const active = health.config.llmChain[0] || "zai";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] backdrop-blur"
            aria-label="Statut des providers"
          >
            <Dot on={health.connectivity.elevenlabs.reachable} label="TTS" />
            <Dot on={active !== "zai"} label="LLM" />
            <Dot on={health.config.stt !== "zai" && health.connectivity.groq.reachable} label="STT" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1 py-1">
            <div>
              <strong>LLM</strong> : {active}
              {active === "zai" && " (SDK z-ai — fallback)"}
            </div>
            <div>
              <strong>TTS</strong> : {health.config.tts}
              {!health.connectivity.elevenlabs.reachable && " (injoignable)"}
            </div>
            <div>
              <strong>STT</strong> : {health.config.stt}
              {health.config.stt === "zai" && " (SDK z-ai)"}
            </div>
            <div className="pt-1 text-white/50">
              Groq : {health.connectivity.groq.reachable ? "ok" : "bloqué IP"}
              {" · "}
              OpenRouter : {health.connectivity.openrouter.reachable ? "ok" : "bloqué"}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <motion.span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: on ? "#34d399" : "#9ca3af" }}
        animate={on ? { opacity: [1, 0.4, 1] } : { opacity: 0.5 }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-white/60 uppercase tracking-wide">{label}</span>
    </span>
  );
}
