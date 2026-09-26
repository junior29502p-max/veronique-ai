"use client";

import { motion } from "framer-motion";
import {
  ExternalLink,
  Phone,
  Wifi,
  Bluetooth,
  Volume2,
  Flashlight,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type ActionEffectData =
  | { kind: "open_url"; url: string; label: string }
  | { kind: "phone_call"; tel: string; contact: string }
  | { kind: "device"; setting: string; action: string }
  | { kind: "none"; message: string };

interface ActionCardProps {
  effect: ActionEffectData;
  timestamp?: string;
}

const DEVICE_ICON: Record<string, LucideIcon> = {
  wifi: Wifi,
  bluetooth: Bluetooth,
  volume_up: Volume2,
  volume_down: Volume2,
  flashlight: Flashlight,
};

const DEVICE_LABEL: Record<string, string> = {
  wifi: "Wi-Fi",
  bluetooth: "Bluetooth",
  volume_up: "Volume",
  volume_down: "Volume",
  flashlight: "Lampe torche",
};

const ACTION_LABEL: Record<string, string> = {
  turn_on: "Activé",
  turn_off: "Désactivé",
  increase: "Augmenté",
  decrease: "Diminué",
};

export function ActionCard({ effect, timestamp }: ActionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-xl border border-fuchsia-400/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-3 backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <EffectIcon effect={effect} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300">
              Action exécutée
            </span>
            {timestamp && (
              <span className="text-[10px] text-white/40">{timestamp}</span>
            )}
          </div>
          <EffectBody effect={effect} />
        </div>
      </div>
    </motion.div>
  );
}

function EffectIcon({ effect }: { effect: ActionEffectData }) {
  let Icon: LucideIcon = Check;
  let bg = "bg-fuchsia-500/15 text-fuchsia-300";
  if (effect.kind === "open_url") {
    Icon = ExternalLink;
  } else if (effect.kind === "phone_call") {
    Icon = Phone;
  } else if (effect.kind === "device") {
    Icon = DEVICE_ICON[effect.setting] || Check;
  }
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

function EffectBody({ effect }: { effect: ActionEffectData }) {
  if (effect.kind === "open_url") {
    return (
      <div className="mt-1">
        <p className="text-sm font-medium text-white">
          Ouverture de {effect.label}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 gap-1.5 text-xs border-white/15 bg-white/5 text-white hover:bg-white/10"
          onClick={() => window.open(effect.url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="h-3 w-3" /> Ouvrir
        </Button>
      </div>
    );
  }
  if (effect.kind === "phone_call") {
    return (
      <div className="mt-1">
        <p className="text-sm font-medium text-white">
          Appel de {effect.contact}
        </p>
        {effect.tel ? (
          <Button asChild size="sm" className="mt-2 h-7 gap-1.5 text-xs bg-gradient-to-r from-violet-500 to-fuchsia-500 border-0 text-white hover:opacity-90">
            <a href={effect.tel}>
              <Phone className="h-3 w-3" /> Appeler
            </a>
          </Button>
        ) : (
          <p className="mt-1 text-xs text-white/50">
            Numéro introuvable dans le navigateur.
          </p>
        )}
      </div>
    );
  }
  if (effect.kind === "device") {
    const label = DEVICE_LABEL[effect.setting] || effect.setting;
    const actionLabel = ACTION_LABEL[effect.action] || effect.action;
    const isOn = effect.action === "turn_on" || effect.action === "increase";
    return (
      <div className="mt-1">
        <p className="text-sm font-medium text-white">
          {label} — {actionLabel}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-500"
              initial={{ width: "0%" }}
              animate={{ width: isOn ? "100%" : "30%" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <span className="text-[10px] font-medium text-white/60">
            {isOn ? "ON" : "OFF"}
          </span>
        </div>
      </div>
    );
  }
  return <p className="mt-1 text-sm text-white/60">{effect.message}</p>;
}
