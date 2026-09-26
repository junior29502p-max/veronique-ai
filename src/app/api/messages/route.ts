import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveActionEffect, type AssistantAction } from "@/lib/veronique";

// GET /api/messages?userId=...&limit=50  → recent conversation history
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 100);
  if (!userId) return NextResponse.json({ messages: [] });

  const profile = await db.userProfile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ messages: [] });

  const rows = await db.message.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const messages = rows.map((m) => {
    let actionEffect: unknown = null;
    if (m.action) {
      try {
        const action = JSON.parse(m.action) as AssistantAction;
        actionEffect = resolveActionEffect(action);
      } catch {
        actionEffect = null;
      }
    }
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      actionEffect,
      createdAt: m.createdAt,
    };
  });
  return NextResponse.json({ messages });
}
