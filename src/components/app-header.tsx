"use client";

import { Sparkles, RotateCcw } from "lucide-react";
import { useProfile } from "@/lib/profile-context";
import { Button } from "@/components/ui/button";
import { ProviderStatus } from "@/components/provider-status";

export function AppHeader() {
  const { profile, reset } = useProfile();

  return (
    <header className="pointer-events-none sticky top-0 z-30 h-14 w-full">
      <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-between px-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 shadow-md shadow-fuchsia-500/40">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-semibold tracking-tight text-white">Véronique</p>
            <p className="text-[10px] text-white/50">Assistant vocal IA</p>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {profile && <ProviderStatus />}
          {profile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              onClick={reset}
              aria-label="Recommencer"
              title="Réinitialiser le profil"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
