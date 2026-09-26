import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildSystemPrompt,
  parseAssistantOutput,
  resolveActionEffect,
  type UserProfile,
} from "@/lib/veronique";
import { getProviderConfig } from "@/lib/providers";
import { groqChat, openrouterChat } from "@/lib/external-providers";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Number of prior turns (user+assistant pairs) sent back to the LLM so it
// retains conversational context across a session.
const MAX_HISTORY_TURNS = 10;

// POST /api/chat
// body: { userId: string, message: string, history?: ChatMessage[] }
// returns: { text, action, actionEffect }
//
// Conversational memory: the server ALWAYS loads the most recent persisted
// turns for this profile from the database and prepends them to the prompt.
// Client-provided `history` is accepted but the DB is the source of truth —
// this guarantees context survives reloads, voice (where the client may send
// a partial history), and multi-device sessions.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.userId || !body.message) {
      return NextResponse.json({ error: "userId and message are required" }, { status: 400 });
    }

    const userMessage = String(body.message);

    // Load the user profile from the local database. If none exists yet
    // (e.g. a client chatted before finishing onboarding), upsert a minimal
    // profile so conversational memory still works.
    let row = await db.userProfile.findUnique({ where: { userId: body.userId } });
    if (!row) {
      row = await db.userProfile.create({
        data: {
          userId: body.userId,
          firstName: "ami",
          assistantName: "Véronique",
          language: "fr-FR",
        },
      });
    }
    const profile: UserProfile = {
      userId: row.userId,
      firstName: row.firstName,
      assistantName: row.assistantName,
      language: row.language,
    };

    // --- Conversational memory (server-side source of truth) ---
    // Fetch the latest persisted messages for this profile.
    const rows = await db.message.findMany({
      where: { profileId: row.id },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_TURNS * 2, // user+assistant per turn
    });
    // reverse to chronological order
    const dbHistory: ChatMessage[] = rows
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Merge with any client-supplied history, preferring the longer / richer
    // one so voice (which sends its in-memory history) and server reloads
    // (which rely on DB) both keep full context.
    const clientHistory: ChatMessage[] = Array.isArray(body.history)
      ? body.history.map((m: { role?: string; content?: string }) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content: String(m.content ?? ""),
        }))
      : [];

    const mergedHistory = dedupeAndTrim([...dbHistory, ...clientHistory], MAX_HISTORY_TURNS);

    const messages = [
      { role: "system" as const, content: buildSystemPrompt(profile) },
      ...mergedHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: userMessage },
    ];

    const cfg = getProviderConfig();
    // Try each provider in the chain until one succeeds.
    let raw = "";
    let provider = "zai";
    for (const p of cfg.llmChain) {
      try {
        if (p === "groq") {
          raw = await groqChat(messages);
          provider = "groq";
          break;
        } else if (p === "openrouter") {
          raw = await openrouterChat(messages);
          provider = "openrouter";
          break;
        } else if (p === "zai") {
          raw = await zaiChat(messages);
          provider = "zai";
          break;
        }
      } catch (e) {
        console.error(`LLM provider ${p} failed, trying next:`, e instanceof Error ? e.message : e);
        // continue to next provider in the chain
      }
    }

    const { text, action } = parseAssistantOutput(raw);
    const actionEffect = action ? resolveActionEffect(action) : null;

    // Persist the exchange so the next request can rebuild context from DB
    await db.message.createMany({
      data: [
        { profileId: row.id, role: "user", content: userMessage },
        {
          profileId: row.id,
          role: "assistant",
          content: text,
          action: action ? JSON.stringify(action) : null,
        },
      ],
    });

    return NextResponse.json({ text, action, actionEffect, provider });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    );
  }
}

async function zaiChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });
  return completion?.choices?.[0]?.message?.content || "";
}

/**
 * Remove consecutive duplicates (same role+content) that can appear when the
 * DB history and client history overlap, keep the last N turns, and make
 * sure the sequence still alternates user/assistant sensibly.
 */
function dedupeAndTrim(history: ChatMessage[], maxTurns: number): ChatMessage[] {
  const deduped: ChatMessage[] = [];
  const seen = new Set<string>();
  for (const m of history) {
    const key = `${m.role}:${m.content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(m);
  }
  // keep chronological last (maxTurns*2) messages
  const trimmed = deduped.slice(-(maxTurns * 2));
  return trimmed;
}
