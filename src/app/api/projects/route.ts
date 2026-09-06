import { db } from "@/db";
import { projects } from "@/db/schema";
import { buildDemoProjects } from "@/lib/samples";
import { desc } from "drizzle-orm";
import { NextRequest } from "next/server";
import { uid } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

async function seedIfEmpty() {
  const rows = await db.select({ id: projects.id }).from(projects).limit(1);
  if (rows.length) return;
  for (const demo of buildDemoProjects()) {
    await db.insert(projects).values({
      id: demo.id, title: demo.title, description: demo.description,
      problem: demo.problem, flowchart: demo.flowchart, pseudocode: demo.pseudocode,
      ir: demo.ir, codes: demo.codes, tests: demo.tests,
      versions: demo.versions, history: demo.history, demo: true,
    });
  }
}

export async function GET() {
  try {
    await seedIfEmpty();
    const rows = await db.select().from(projects).orderBy(desc(projects.updatedAt));
    return Response.json({ projects: rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = uid();
    const flowchart = {
      nodes: [
        { id: "__start", type: "start", label: "START", x: 0, y: 30 },
        { id: "__end", type: "end", label: "END", x: 0, y: 210 },
      ],
      edges: [{ id: uid(), source: "__start", target: "__end" }],
    };
    const row = {
      id,
      title: body.title ?? "Untitled Project",
      description: body.description ?? "",
      problem: body.problem ?? "",
      flowchart,
      pseudocode: "START\n\nEND",
      ir: { statements: [], vars: [] },
      codes: {},
      tests: [],
      versions: [],
      history: [],
      demo: false,
    };
    await db.insert(projects).values(row);
    await seedIfEmpty();
    return Response.json({ id });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
