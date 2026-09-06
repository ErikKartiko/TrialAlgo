// Engine smoke test: round-trips for all demo projects (npx tsx scripts/enginetest.ts)
import { buildDemoProjects } from "../src/lib/samples";
import { flowchartToIR, irToFlowchart } from "../src/lib/ir/flowchart";
import { parsePseudocode, irToPseudocode } from "../src/lib/ir/pseudocode";
import { irToCode } from "../src/lib/ir/codegen";
import { runIR, runTestCase } from "../src/lib/ir/interpreter";
import { codeToIR } from "../src/lib/ir/codeparse";
import type { Stmt } from "../src/lib/ir/types";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(cond ? "PASS" : "FAIL", "-", msg);
  if (!cond) failures++;
};

for (const p of buildDemoProjects()) {
  console.log("\n===", p.title, "===");

  // 1. flowchart → IR round trip
  const { program, issues } = flowchartToIR(p.flowchart);
  const errs = issues.filter(i => i.level === "error");
  ok(errs.length === 0, `flowchart valid (errors: ${errs.map(e => e.message).join("; ") || "none"})`);
  ok(!!program, "IR produced");
  ok((program?.statements.length ?? 0) === p.ir!.statements.length,
    `statement count matches (${program?.statements.length} vs ${p.ir!.statements.length})`);

  // 2. IR → flowchart → IR again
  if (program) {
    const fc2 = irToFlowchart(program);
    const { program: p2 } = flowchartToIR(fc2);
    ok(!!p2, "regenerated flowchart parses back");
    ok(JSON.stringify(p2?.statements.map(s => s.kind)) === JSON.stringify(program.statements.map(s => s.kind)),
      "stable structure after regen");
  }

  // 3. pseudocode round trip
  const parsed = parsePseudocode(p.pseudocode);
  ok(parsed.ok, `pseudocode parses (errors: ${parsed.errors.map(e => `L${e.line}: ${e.message}`).join("; ") || "none"})`);
  if (parsed.program) {
    const regen = irToPseudocode(parsed.program);
    ok(regen.text === p.pseudocode, "pseudocode is canonical (regen == stored)");
  }

  // 4. pseudocode error detection
  const bad = parsePseudocode("START\nIF x > 5 THEN\nOUTPUT x\nEND");
  ok(!bad.ok && bad.errors.length > 0, "broken pseudocode detected with friendly error");
  if (bad.errors.length) console.log("   → sample error:", bad.errors[0].line, bad.errors[0].expected ?? bad.errors[0].message);

  // 5. code generation for all 5 languages
  for (const lang of ["c", "cpp", "csharp", "python", "java"] as const) {
    const g = irToCode(p.ir!, lang);
    ok(g.code.length > 20 && Object.keys(g.map).length > 0, `codegen ${lang} (${g.code.split("\n").length} lines)`);
  }

  // 6. execution + tests
  for (const t of p.tests) {
    const r = runTestCase(p.ir!, t.input, t.expected);
    ok(r.passed, `test "${t.name}" passes (actual: ${JSON.stringify(r.actual)})`);
  }

  // 7. python + cpp code → IR import (round trip for generated code)
  const py = irToCode(p.ir!, "python").code;
  const imp = codeToIR(py, "python");
  ok((imp.program?.statements.length ?? 0) === p.ir!.statements.length,
    `python → IR import (${imp.program?.statements.length} stmts, warnings: ${imp.warnings.length})`);
  const cpp = irToCode(p.ir!, "cpp").code;
  const impc = codeToIR(cpp, "cpp");
  ok((impc.program?.statements.length ?? 0) === p.ir!.statements.length,
    `cpp → IR import (${impc.program?.statements.length} stmts, warnings: ${impc.warnings.length})`);

  // 8. id preservation: flowchart node ids map to stmt ids (sync highlighting)
  const nodeIds = new Set(p.flowchart.nodes.map(n => n.id));
  const stmtIds: string[] = [];
  const walkS = (ss: Stmt[]) => ss.forEach(s => {
    stmtIds.push(s.id);
    if (s.kind === "if") { s.branches.forEach(b => walkS(b.body)); walkS(s.elseBody); }
    if (s.kind === "while" || s.kind === "for" || s.kind === "dowhile") walkS(s.body);
  });
  walkS(p.ir!.statements);
  const missing = stmtIds.filter(id => !nodeIds.has(id));
  ok(missing.length === 0, `all stmt ids exist as flowchart nodes (sync works)${missing.length ? " missing: " + missing.join(",") : ""}`);

  // 9. interpreter output matches expected
  const res = runIR(p.ir!, { inputs: p.tests[0].input.split("\n") });
  ok(res.ok && res.output.join("\n").trim() === p.tests[0].expected.trim(), "interpreter output matches expected");
}

// layout sanity: no NaN in generated graph
for (const p of buildDemoProjects()) {
  let nan = false;
  for (const n of p.flowchart.nodes) if (!isFinite(n.x) || !isFinite(n.y)) nan = true;
  ok(!nan, `${p.id}: all node positions finite`);
}

console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
process.exit(failures ? 1 : 0);
