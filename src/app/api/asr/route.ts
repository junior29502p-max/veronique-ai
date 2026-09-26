import { NextRequest, NextResponse } from "next/server";
import { cleanFrenchTranscript, isPlausibleFrench } from "@/lib/asr-filter";
import { getProviderConfig } from "@/lib/providers";
import { groqTranscribe } from "@/lib/external-providers";

// POST /api/asr  { audio: "<base64>", format?: "wav"|"mp3" }
// Returns { text, raw, filtered, provider }
//
// Provider resolution:
//   - GROQ_API_KEY set  → Groq Whisper Large v3 Turbo (language=fr, free tier)
//   - otherwise         → z-ai-web-dev-sdk (also forces language=fr)
// Both paths apply the post-transcription French filter (strips CJK /
// hallucinations) so the LLM never ingests garbage context.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.audio) {
      return NextResponse.json({ error: "audio (base64) is required" }, { status: 400 });
    }
    const base64 = String(body.audio).replace(/^data:audio\/[a-zA-Z0-9.]+;base64,/, "");
    const fmt = body.format === "mp3" ? "mp3" : "wav";
    const mimeType = fmt === "mp3" ? "audio/mpeg" : "audio/wav";

    const cfg = getProviderConfig();
    let raw = "";
    let provider: string;

    if (cfg.stt === "groq") {
      try {
        raw = await groqTranscribe(base64, mimeType);
        provider = "groq";
      } catch (e) {
        console.error("Groq STT failed, falling back to z-ai SDK:", e);
        raw = await zaiTranscribe(base64);
        provider = "zai-fallback";
      }
    } else {
      raw = await zaiTranscribe(base64);
      provider = "zai";
    }

    // Post-filter (applies to both providers)
    const text = cleanFrenchTranscript(raw);
    const plausible = isPlausibleFrench(text);

    if (!plausible) {
      return NextResponse.json({
        text: "",
        raw,
        filtered: true,
        reason: "no_french_detected",
        provider,
      });
    }

    return NextResponse.json({ text, raw, filtered: raw !== text, provider });
  } catch (error) {
    console.error("ASR error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}

async function zaiTranscribe(base64: string): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const response = await zai.audio.asr.create({
    file_base64: base64,
    language: "fr",
  } as { file_base64: string; language: string });
  return (response?.text || "").toString();
}
