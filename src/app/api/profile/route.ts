import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/profile?userId=...  → returns the stored profile (or null)
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ profile: null });
  }
  const profile = await db.userProfile.findUnique({ where: { userId } });
  return NextResponse.json({ profile });
}

// POST /api/profile  { userId, firstName, assistantName?, language? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.userId || !body.firstName) {
    return NextResponse.json({ error: "userId and firstName are required" }, { status: 400 });
  }
  const data = {
    firstName: String(body.firstName).slice(0, 60),
    assistantName: body.assistantName ? String(body.assistantName).slice(0, 60) : "Véronique",
    language: body.language ? String(body.language).slice(0, 10) : "fr-FR",
  };
  const profile = await db.userProfile.upsert({
    where: { userId: body.userId },
    update: data,
    create: { userId: body.userId, ...data },
  });
  return NextResponse.json({ profile });
}
