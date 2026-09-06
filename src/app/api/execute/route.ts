// POST /api/execute — Code Runner abstraction.
//
// Mode "demo-ir": executes the ALGORITHM MODEL (IR) through the built-in
// step-recording interpreter. This is real execution of the algorithm itself
// used for learning, test cases and the Execution Visualizer.
// It is labelled everywhere as Demo Execution Mode. To enable real machine
// compilation, implement `runSandboxed()` below against an isolated service
// (Docker / Judge0) with CPU/RAM/time/process limits and no network or
// filesystem access.
import { runIR, runTestCase } from "@/lib/ir/interpreter";
import type { IRProgram } from "@/lib/ir/types";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.program) {
    return Response.json({ error: "Missing 'program' (Algorithm IR) in request body." }, { status: 400 });
  }
  const program = body.program as IRProgram;

  if (Array.isArray(body.tests)) {
    const results = body.tests.map((t: { id?: string; name?: string; input: string; expected: string }) => ({
      id: t.id, name: t.name ?? "Test",
      input: t.input, ...runTestCase(program, t.input, t.expected),
    }));
    const passed = results.filter((r: { passed: boolean }) => r.passed).length;
    return Response.json({
      mode: "demo-ir",
      results, passed, total: results.length,
      score: results.length ? Math.round((passed / results.length) * 1000) / 10 : 0,
    });
  }

  const inputs: string[] = typeof body.input === "string"
    ? body.input.split(/\r?\n/).filter((l: string) => l.trim() !== "")
    : [];
  const result = runIR(program, { inputs });
  return Response.json(result);
}
