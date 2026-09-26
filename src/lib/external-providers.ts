// External provider implementations (Groq + OpenRouter + ElevenLabs) over
// plain fetch. These run server-side only (env keys never reach the browser).
// Each is a thin wrapper matching the shape the API routes already use.

import { getKeys } from "@/lib/providers";

const GROQ_BASE = "https://api.groq.com/openai/v1";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

/* --------------------------------- Groq --------------------------------- */

// Groq is OpenAI-compatible. Use a fast Llama 3.3 70B model (free tier).
const GROQ_LLM_MODEL = "llama-3.3-70b-versatile";

export async function groqChat(messages: ChatTurn[]): Promise<string> {
  const { groq } = getKeys();
  if (!groq) throw new Error("GROQ_API_KEY not configured");
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groq}`,
    },
    body: JSON.stringify({
      model: GROQ_LLM_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 400,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq LLM error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

// Groq hosts Whisper Large v3 Turbo — very fast, free tier, multilingual.
// `language: "fr"` biases decoding toward French.
const GROQ_STT_MODEL = "whisper-large-v3-turbo";

export async function groqTranscribe(
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const { groq } = getKeys();
  if (!groq) throw new Error("GROQ_API_KEY not configured");

  // multipart/form-data: Groq expects an uploaded file, not base64 JSON.
  const bytes = Buffer.from(audioBase64, "base64");
  const ext = mimeType.includes("mp3") ? "mp3" : "wav";
  const blob = new Blob([bytes], { type: mimeType });
  const form = new FormData();
  form.append("file", blob, `audio.${ext}`);
  form.append("model", GROQ_STT_MODEL);
  form.append("language", "fr");
  form.append("response_format", "json");

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${groq}` },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq STT error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { text?: string };
  return data?.text || "";
}

/* ------------------------------- OpenRouter ------------------------------ */

// OpenRouter is OpenAI-compatible and reachable from this sandbox (Groq
// itself is blocked at the IP level). Free-tier Llama 3.3 70B is available.
// Docs: https://openrouter.ai/docs — get a free key at https://openrouter.ai/keys
const OPENROUTER_LLM_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export async function openrouterChat(messages: ChatTurn[]): Promise<string> {
  const { openrouter } = getKeys();
  if (!openrouter) throw new Error("OPENROUTER_API_KEY not configured");
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openrouter}`,
      // OpenRouter recommends these for attribution / ranking
      "HTTP-Referer": "https://veronique-ai.local",
      "X-Title": "Véronique AI",
    },
    body: JSON.stringify({
      model: OPENROUTER_LLM_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 400,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter LLM error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/* ------------------------------- ElevenLabs ------------------------------ */

// A natural French voice available on ElevenLabs free tier.
const ELEVEN_VOICE_FR = "cgSgspJ2msm6clMCkdW9"; // Jessica — multilingual FR

export async function elevenTTS(text: string): Promise<Buffer> {
  const { elevenlabs } = getKeys();
  if (!elevenlabs) throw new Error("ELEVENLABS_API_KEY not configured");

  const res = await fetch(
    `${ELEVEN_BASE}/text-to-speech/${ELEVEN_VOICE_FR}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenlabs,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ElevenLabs TTS error ${res.status}: ${t.slice(0, 200)}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(new Uint8Array(arrayBuffer));
}
