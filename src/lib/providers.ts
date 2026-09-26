// Provider abstraction for STT / LLM / TTS.
//
// Resolution order per capability (tries each in sequence, first that is
// configured AND reachable wins; failures auto-fall through):
//
//   LLM:  Groq       → OpenRouter → z-ai SDK
//   STT:  Groq       → z-ai SDK            (Whisper is Groq-only here)
//   TTS:  ElevenLabs → z-ai SDK
//
// Groq is blocked at the IP level from this sandbox (returns 403 even on
// its public website), so OpenRouter is the recommended reachable free LLM.
// The z-ai SDK always works as the final fallback.

export type ProviderKind = "groq" | "openrouter" | "elevenlabs" | "zai";

export interface ProviderConfig {
  // Speech-to-Text
  stt: ProviderKind;
  // Large Language Model — list of providers to try in order
  llmChain: ProviderKind[];
  // Text-to-Speech
  tts: ProviderKind;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

let cached: ProviderConfig | null = null;

export function getProviderConfig(): ProviderConfig {
  if (cached) return cached;

  const hasGroq = !!env("GROQ_API_KEY");
  const hasOpenRouter = !!env("OPENROUTER_API_KEY");

  // LLM chain: each configured provider is tried in order, z-ai always last.
  const llmChain: ProviderKind[] = [];
  if (hasGroq) llmChain.push("groq");
  if (hasOpenRouter) llmChain.push("openrouter");
  llmChain.push("zai");

  cached = {
    stt: hasGroq ? "groq" : "zai",
    llmChain,
    tts: env("ELEVENLABS_API_KEY") ? "elevenlabs" : "zai",
  };
  return cached;
}

// Expose keys for the provider implementations (server-side only).
export function getKeys() {
  return {
    groq: env("GROQ_API_KEY"),
    openrouter: env("OPENROUTER_API_KEY"),
    elevenlabs: env("ELEVENLABS_API_KEY"),
  };
}

// Reset the cached config (used by the health endpoint / hot reload).
export function resetProviderConfig() {
  cached = null;
}
