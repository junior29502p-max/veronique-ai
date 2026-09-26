"use client";

import { useProfile } from "@/lib/profile-context";
import { Onboarding } from "@/components/onboarding";
import { VoiceAssistant } from "@/components/voice-assistant";
import { FluidOrb } from "@/components/fluid-orb";

function Gate() {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <FluidOrb state="idle" size={220} />
      </div>
    );
  }

  if (!profile) {
    return <Onboarding />;
  }

  return <VoiceAssistant />;
}

export default function Home() {
  return <Gate />;
}
