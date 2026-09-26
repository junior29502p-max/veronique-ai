import { NextRequest, NextResponse } from "next/server";
import { getProviderConfig } from "@/lib/providers";
import { elevenTTS } from "@/lib/external-providers";

// POST /api/tts  { text, voice?, speed? }
// Returns audio binary (mp3 for ElevenLabs, wav for z-ai SDK fallback).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const fullText = String(body.text).replace(/\s+/g, " ").trim();
    if (!fullText) {
      return NextResponse.json({ error: "empty text" }, { status: 400 });
    }

    const cfg = getProviderConfig();

    // ElevenLabs supports up to 5000 chars per request — plenty for assistant
    // replies. Split defensively only if a single reply exceeds the limit.
    const chunks = splitText(fullText, 4800);

    const ZAI = (await import("z-ai-web-dev-sdk")).default;

    if (cfg.tts === "elevenlabs") {
      try {
        const buffers: Buffer[] = [];
        for (const chunk of chunks) {
          if (!chunk) continue;
          buffers.push(await elevenTTS(chunk));
        }
        const combined =
          buffers.length === 1 ? buffers[0] : Buffer.concat(buffers);
        return new NextResponse(combined as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-cache",
          },
        });
      } catch (e) {
        console.error("ElevenLabs TTS failed, falling back to z-ai SDK:", e);
        // fall through to z-ai
      }
    }

    // z-ai SDK fallback (1024 chars max per call, wav output)
    const zai = await ZAI.create();
    const speed =
      typeof body.speed === "number" && body.speed >= 0.5 && body.speed <= 2.0
        ? body.speed
        : 1.0;
    const zaiChunks = splitText(fullText, 1000);
    const buffers: Buffer[] = [];
    for (const chunk of zaiChunks) {
      if (!chunk) continue;
      const response = await zai.audio.tts.create({
        input: chunk,
        voice: "tongtong",
        speed,
        response_format: "wav",
        stream: false,
      });
      const arrayBuffer = await response.arrayBuffer();
      buffers.push(Buffer.from(new Uint8Array(arrayBuffer)));
    }
    const out =
      buffers.length === 1 ? buffers[0] : concatWav(buffers);
    return new NextResponse(out as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TTS failed" },
      { status: 500 }
    );
  }
}

function splitText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?…]+[.!?…]+|\S+$/g) || [text];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length <= maxLength) {
      current += s;
    } else {
      if (current) chunks.push(current.trim());
      current = s.length > maxLength ? s.slice(0, maxLength) : s;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

function concatWav(buffers: Buffer[]): Buffer {
  const header = Buffer.from(buffers[0].subarray(0, 44));
  const dataParts: Buffer[] = [];
  let totalData = 0;
  for (const buf of buffers) {
    const data = buf.subarray(44);
    dataParts.push(data);
    totalData += data.length;
  }
  header.writeUInt32LE(36 + totalData, 4);
  header.writeUInt32LE(totalData, 40);
  return Buffer.concat([header, ...dataParts]);
}
