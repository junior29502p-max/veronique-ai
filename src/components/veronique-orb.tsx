"use client";

import { motion, type Transition } from "framer-motion";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface VeroniqueOrbProps {
  state: OrbState;
  size?: number;
  className?: string;
}

const STATE_CONFIG: Record<
  OrbState,
  { coreScale: number[]; coreTime: number; ringOpacity: number; color: string; glow: number }
> = {
  idle: {
    coreScale: [1, 1.05, 1],
    coreTime: 4,
    ringOpacity: 0.25,
    color: "rgba(244,63,94,0.35)",
    glow: 0.5,
  },
  listening: {
    coreScale: [1, 1.12, 0.96, 1.1, 1],
    coreTime: 1.4,
    ringOpacity: 0.55,
    color: "rgba(217,70,239,0.55)",
    glow: 0.85,
  },
  thinking: {
    coreScale: [1, 1.18, 0.92, 1.16, 1],
    coreTime: 0.9,
    ringOpacity: 0.4,
    color: "rgba(168,85,247,0.5)",
    glow: 0.9,
  },
  speaking: {
    coreScale: [1, 1.22, 0.9, 1.15, 1],
    coreTime: 0.7,
    ringOpacity: 0.6,
    color: "rgba(251,146,60,0.5)",
    glow: 1,
  },
};

export function VeroniqueOrb({ state, size = 240, className }: VeroniqueOrbProps) {
  const cfg = STATE_CONFIG[state];
  const coreTransition: Transition = {
    duration: cfg.coreTime,
    repeat: Infinity,
    ease: "easeInOut",
  };

  return (
    <div
      className={`relative flex items-center justify-center ${className || ""}`}
      style={{ width: size, height: size }}
      aria-label={`Assistant state: ${state}`}
      role="img"
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: size * 1.25,
          height: size * 1.25,
          background:
            "radial-gradient(circle, rgba(244,63,94,0.45) 0%, rgba(217,70,239,0.32) 40%, rgba(168,85,247,0.12) 70%, transparent 80%)",
        }}
        animate={{ opacity: [cfg.glow * 0.7, cfg.glow, cfg.glow * 0.7], scale: [1, 1.06, 1] }}
        transition={{ duration: cfg.coreTime, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Expanding ripple rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            borderColor: cfg.color,
            width: size * 0.7,
            height: size * 0.7,
          }}
          animate={
            state === "listening" || state === "speaking"
              ? {
                  scale: [1, 1.9],
                  opacity: [cfg.ringOpacity, 0],
                }
              : state === "thinking"
                ? { scale: [1, 1.4], opacity: [cfg.ringOpacity * 0.8, 0] }
                : { scale: [1, 1.25], opacity: [cfg.ringOpacity * 0.6, 0] }
          }
          transition={{
            duration: state === "speaking" ? 1.2 : state === "thinking" ? 1.6 : 2.4,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * (state === "speaking" ? 0.4 : state === "thinking" ? 0.5 : 0.8),
          }}
        />
      ))}

      {/* Rotating conic energy ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.92,
          height: size * 0.92,
          background:
            "conic-gradient(from 0deg, #f43f5e, #d946ef, #a855f7, #f59e0b, #f43f5e)",
          filter: "blur(2px)",
          opacity: 0.85,
          maskImage: "radial-gradient(circle, transparent 58%, black 60%, black 100%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, black 60%, black 100%)",
        }}
        animate={{ rotate: state === "thinking" ? 360 : state === "idle" ? 0 : 180 }}
        transition={{
          duration: state === "thinking" ? 2.5 : state === "idle" ? 0 : 6,
          repeat: state === "idle" ? 0 : Infinity,
          ease: "linear",
        }}
      />

      {/* Core sphere */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          background:
            "radial-gradient(circle at 32% 28%, #fda4af 0%, #fb7185 18%, #f43f5e 38%, #d946ef 62%, #a855f7 100%)",
          boxShadow:
            "0 0 60px rgba(244,63,94,0.55), 0 0 120px rgba(217,70,239,0.4), inset -10px -14px 40px rgba(76,29,149,0.45), inset 12px 14px 30px rgba(255,255,255,0.35)",
        }}
        animate={{ scale: cfg.coreScale }}
        transition={coreTransition}
      >
        {/* Inner glossy highlight */}
        <div
          className="absolute rounded-full"
          style={{
            top: "14%",
            left: "20%",
            width: "34%",
            height: "26%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 60%, transparent 100%)",
            filter: "blur(2px)",
          }}
        />

        {/* Speaking waveform bars inside core */}
        {state === "speaking" && (
          <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="block w-[3px] rounded-full bg-white/80"
                animate={{ height: [6, 18, 8, 22, 6] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.08,
                }}
              />
            ))}
          </div>
        )}

        {/* Thinking dots */}
        {state === "thinking" && (
          <div className="absolute inset-0 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block h-1.5 w-1.5 rounded-full bg-white/90"
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Orbiting particles */}
      {["listening", "speaking", "thinking"].includes(state) &&
        [0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i / 6) * Math.PI * 2;
          const radius = size * 0.42;
          return (
            <motion.div
              key={`p-${i}`}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{
                background: i % 2 === 0 ? "#fda4af" : "#fcd34d",
                boxShadow: "0 0 8px rgba(253,164,175,0.9)",
              }}
              animate={{
                x: [
                  Math.cos(angle) * radius,
                  Math.cos(angle + Math.PI) * radius,
                  Math.cos(angle) * radius,
                ],
                y: [
                  Math.sin(angle) * radius,
                  Math.sin(angle + Math.PI) * radius,
                  Math.sin(angle) * radius,
                ],
                opacity: [0, 1, 0],
                scale: [0.5, 1.2, 0.5],
              }}
              transition={{
                duration: state === "speaking" ? 1.4 : 2.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.12,
              }}
            />
          );
        })}
    </div>
  );
}
