"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Sparkles, Mic, ArrowRight } from "lucide-react";
import { useProfile } from "@/lib/profile-context";
import { FluidOrb } from "@/components/fluid-orb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Onboarding() {
  const { saveProfile } = useProfile();
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = firstName.trim();
    if (!name) return;
    setSubmitting(true);
    await saveProfile({ firstName: name, assistantName: "Véronique", language: "fr-FR" });
  }

  return (
    <motion.div
      className="relative flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative mb-2"
      >
        <FluidOrb state="idle" size={240} />
      </motion.div>

      <div className="relative mb-7 mt-2 text-center max-w-md">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-white/5 px-3 py-1 text-xs font-medium text-fuchsia-200 mb-4 backdrop-blur">
          <Sparkles className="h-3 w-3" />
          Assistante vocale intelligente
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-200 bg-clip-text text-transparent">
          Bonjour, je suis Véronique
        </h1>
        <p className="mt-3 text-white/60 text-sm sm:text-base">
          Votre assistante vocale personnelle. Je peux converser avec vous, ouvrir des
          applications, passer des appels et contrôler votre appareil — tout à la voix.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative w-full max-w-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-sm font-medium text-white/80">
            Comment dois-je vous appeler ?
          </Label>
          <Input
            id="firstName"
            type="text"
            autoComplete="given-name"
            placeholder="Votre prénom"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={submitting}
            className="h-12 text-base text-center bg-white/5 border-white/15 text-white placeholder:text-white/35 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/30"
            autoFocus
            maxLength={40}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={!firstName.trim() || submitting}
          className="w-full h-12 text-base bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 hover:opacity-90 text-white shadow-lg shadow-fuchsia-500/30 border-0"
        >
          {submitting ? (
            "Initialisation…"
          ) : (
            <>
              Commencer
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <Mic className="h-3.5 w-3.5" /> Reconnaissance vocale
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Synthèse vocale naturelle
        </span>
      </div>
    </motion.div>
  );
}
