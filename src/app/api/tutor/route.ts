// POST /api/tutor — pedagogical assistant (pattern/rule-based engine).
// Honest label: not an LLM. Modes: explain | hint | debug | socratic | review.
// Also supports { action: "nl2algo", description } for natural-language → IR.
import { tutorRespond, nlToAlgorithm, TutorMode } from "@/lib/ir/tutor";
import type { IRProgram } from "@/lib/ir/types";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });

  if (body.action === "nl2algo") {
    const result = nlToAlgorithm(String(body.description ?? ""));
    return Response.json(result);
  }

  const mode = (body.mode ?? "hint") as TutorMode;
  const program = body.program as IRProgram | undefined;
  if (!program) return Response.json({ error: "Missing 'program' (Algorithm IR)." }, { status: 400 });
  const reply = tutorRespond(mode, program, String(body.problem ?? ""), body.error ? String(body.error) : undefined);
  return Response.json({
    ...reply,
    provider: "AlgoStudio Tutor Engine v1 (rule-based — connect an LLM provider for open-ended QA)",
  });
}
