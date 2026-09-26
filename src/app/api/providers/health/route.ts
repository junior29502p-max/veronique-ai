import { NextResponse } from "next/server";
import { getProviderConfig, resetProviderConfig, getKeys } from "@/lib/providers";

// GET /api/providers/health
// Returns the configured providers + live connectivity probe for each, so the
// UI / operator can see which ones are actually working from this host.
export async function GET() {
  // Make sure env edits are picked up
  resetProviderConfig();
  const cfg = getProviderConfig();
  const keys = getKeys();

  const [groq, openrouter, elevenlabs] = await Promise.all([
    probeGroq(),
    probeOpenRouter(),
    probeElevenLabs(),
  ]);

  return NextResponse.json({
    config: {
      llmChain: cfg.llmChain,
      stt: cfg.stt,
      tts: cfg.tts,
    },
    keysPresent: {
      groq: !!keys.groq,
      openrouter: !!keys.openrouter,
      elevenlabs: !!keys.elevenlabs,
    },
    connectivity: {
      groq: { reachable: groq.reachable, status: groq.status, detail: groq.detail },
      openrouter: { reachable: openrouter.reachable, status: openrouter.status, detail: openrouter.detail },
      elevenlabs: { reachable: elevenlabs.reachable, status: elevenlabs.status, detail: elevenlabs.detail },
    },
    note:
      "Groq is blocked at the IP level from this sandbox (403 on every endpoint, even public). " +
      "OpenRouter is the recommended reachable free LLM provider.",
  });
}

async function probe(
  url: string,
  init?: RequestInit,
  label: string = url
): Promise<{ reachable: boolean; status: number; detail: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    // 200, 401, 429 all mean "the server responded" → reachable
    const reachable = res.status !== 403;
    return {
      reachable,
      status: res.status,
      detail: reachable ? `${label} responded` : `${label} blocked (403)`,
    };
  } catch (e) {
    return { reachable: false, status: 0, detail: e instanceof Error ? e.message : "network error" };
  }
}

async function probeGroq() {
  return probe("https://api.groq.com/openai/v1/models", {}, "Groq");
}
async function probeOpenRouter() {
  return probe("https://openrouter.ai/api/v1/models", {}, "OpenRouter");
}
async function probeElevenLabs() {
  // Use the user endpoint so we also validate the key.
  const key = getKeys().elevenlabs;
  if (!key) return { reachable: false, status: 0, detail: "no key configured" };
  return probe("https://api.elevenlabs.io/v1/user", {
    headers: { "xi-api-key": key },
  }, "ElevenLabs");
}
