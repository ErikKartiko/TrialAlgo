import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { uid } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await db.select().from(projects).where(eq(projects.id, id));
  if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ project: rows[0] });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  await db.update(projects).set({
    title: body.title,
    description: body.description ?? "",
    problem: body.problem ?? "",
    flowchart: body.flowchart,
    pseudocode: body.pseudocode ?? "",
    ir: body.ir ?? null,
    codes: body.codes ?? {},
    tests: body.tests ?? [],
    versions: body.versions ?? [],
    history: body.history ?? [],
    updatedAt: new Date(),
  }).where(eq(projects.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  await db.delete(projects).where(eq(projects.id, id));
  return Response.json({ ok: true });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (body.action === "duplicate") {
    const rows = await db.select().from(projects).where(eq(projects.id, id));
    if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });
    const p = rows[0];
    const newId = uid();
    await db.insert(projects).values({
      id: newId,
      title: `${p.title} (copy)`,
      description: p.description, problem: p.problem,
      flowchart: p.flowchart, pseudocode: p.pseudocode, ir: p.ir,
      codes: p.codes, tests: p.tests, versions: p.versions, history: p.history,
      demo: false,
    });
    return Response.json({ id: newId });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
