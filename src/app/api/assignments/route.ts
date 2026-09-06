import { db } from "@/db";
import { assignments, submissions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function seedIfEmpty() {
  const rows = await db.select({ id: assignments.id }).from(assignments).limit(1);
  if (rows.length) return;
  const [a] = await db.insert(assignments).values({
    title: "Program Nilai Mahasiswa",
    description: "Rancang flowchart + pseudocode + program untuk menentukan kelulusan (nilai >= 75 → Lulus). Sertakan test case untuk nilai 75, 80, dan 60.",
    className: "IF-01 — Algoritma & Pemrograman",
    language: "cpp",
    dueAt: "Jumat, 23:59",
    requireFlowchart: true, requirePseudocode: true, requireCode: true,
    weights: { flowchart: 20, pseudocode: 20, code: 40, tests: 20 },
    tests: [
      { input: "75", expected: "Lulus" },
      { input: "80", expected: "Lulus" },
      { input: "60", expected: "Tidak Lulus" },
    ],
  }).returning();

  const seedSubs = [
    { name: "Andi Pratama", sf: 18, sp: 17, sc: 38, st: 20, hints: 1, mistakes: [] },
    { name: "Bunga Lestari", sf: 20, sp: 19, sc: 40, st: 20, hints: 0, mistakes: [] },
    { name: "Citra Dewi", sf: 16, sp: 15, sc: 28, st: 12, hints: 3, mistakes: ["Kondisi IF salah: menggunakan '>' bukan '>='"] },
    { name: "Dimas Saputra", sf: 17, sp: 16, sc: 30, st: 8, hints: 2, mistakes: ["Kondisi IF salah: menggunakan '>' bukan '>='", "Output tidak sesuai format"] },
    { name: "Eka Wijaya", sf: 19, sp: 18, sc: 34, st: 16, hints: 1, mistakes: ["Variabel belum didefinisikan"] },
  ];
  for (const s of seedSubs) {
    await db.insert(submissions).values({
      assignmentId: a.id, studentName: s.name,
      scoreFlowchart: s.sf, scorePseudocode: s.sp, scoreCode: s.sc, scoreTests: s.st,
      hintsUsed: s.hints, mistakes: s.mistakes,
    });
  }
}

export async function GET() {
  try {
    await seedIfEmpty();
    const as = await db.select().from(assignments).orderBy(desc(assignments.createdAt));
    const ss = await db.select().from(submissions).orderBy(desc(submissions.createdAt));
    return Response.json({ assignments: as, submissions: ss });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.action) return Response.json({ error: "action required" }, { status: 400 });

  if (body.action === "create") {
    const [row] = await db.insert(assignments).values({
      title: String(body.title ?? "New Assignment"),
      description: String(body.description ?? ""),
      className: String(body.className ?? "IF-01"),
      language: String(body.language ?? "cpp"),
      dueAt: String(body.dueAt ?? ""),
      requireFlowchart: Boolean(body.requireFlowchart ?? true),
      requirePseudocode: Boolean(body.requirePseudocode ?? true),
      requireCode: Boolean(body.requireCode ?? true),
      weights: body.weights ?? { flowchart: 20, pseudocode: 20, code: 40, tests: 20 },
      tests: body.tests ?? [],
    }).returning();
    return Response.json({ assignment: row });
  }
  if (body.action === "feedback") {
    const { eq } = await import("drizzle-orm");
    await db.update(submissions).set({ feedback: String(body.feedback ?? "") })
      .where(eq(submissions.id, String(body.submissionId)));
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
