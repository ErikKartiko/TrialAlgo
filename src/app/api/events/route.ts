import { db } from "@/db";
import { learningEvents } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(learningEvents).orderBy(desc(learningEvents.createdAt)).limit(30);
  return Response.json({ events: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.kind) return Response.json({ error: "kind required" }, { status: 400 });
  await db.insert(learningEvents).values({
    kind: String(body.kind),
    projectId: body.projectId ? String(body.projectId) : null,
    detail: String(body.detail ?? ""),
  });
  return Response.json({ ok: true });
}
