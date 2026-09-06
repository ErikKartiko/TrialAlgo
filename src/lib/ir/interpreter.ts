// IR interpreter — honest "Demo Execution Mode" engine.
// Executes the algorithm model directly (not machine-compiled code) and
// produces a full step-by-step trace for the Execution Visualizer.
import type { IRProgram, Stmt, ExecutionResult, ExecutionStep } from "./types";
import { evalExpr, exprToPseudo, ExprError, VEnv } from "./expr";

const MAX_STEPS = 1500;

export function fmtVal(v: number | string | boolean): string {
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return String(parseFloat(v.toFixed(6)));
  }
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v;
}

export interface RunOptions { inputs?: string[]; }

export function runIR(prog: IRProgram, opts: RunOptions = {}): ExecutionResult {
  const inputs = [...(opts.inputs ?? [])];
  const env: VEnv = {};
  const output: string[] = [];
  const steps: ExecutionStep[] = [];
  let n = 0;
  let truncated = false;

  const snap = () => ({ ...env });
  const step = (
    stmtId: string | undefined,
    type: ExecutionStep["type"],
    note: string,
    result?: boolean,
  ) => {
    n++;
    if (n > MAX_STEPS) { truncated = true; throw new TruncatedError(); }
    steps.push({ n, stmtId, type, note, vars: snap(), result });
  };

  class TruncatedError extends Error { }
  class InputExhausted extends Error { constructor(public v: string) { super(`Program asks for input '${v}' but no more input values were provided.`); } }

  function parseInputToken(raw: string): number | string {
    const t = raw.trim();
    const num = Number(t);
    if (t !== "" && !Number.isNaN(num)) return num;
    return t;
  }

  function exec(stmts: Stmt[]) {
    for (const s of stmts) {
      switch (s.kind) {
        case "input": {
          const raw = inputs.shift();
          if (raw === undefined) throw new InputExhausted(s.varName);
          const v = parseInputToken(raw);
          env[s.varName] = v;
          step(s.id, "input", `${s.varName} = ${fmtVal(v)}   (input)`);
          break;
        }
        case "assign": {
          const v = evalExpr(s.expr, env);
          env[s.target] = v;
          step(s.id, "assign", `${s.target} = ${fmtVal(v)}`);
          break;
        }
        case "output": {
          let text = "";
          for (const e of s.exprs) {
            const v = evalExpr(e, env);
            const part = typeof v === "string" ? v : fmtVal(v as number | boolean);
            if (text && !text.endsWith(" ") && part) text += " ";
            text += part;
          }
          output.push(text);
          step(s.id, "output", `OUTPUT → ${text}`);
          break;
        }
        case "call":
          step(s.id, "assign", `CALL ${s.name}`);
          break;
        case "if": {
          let done = false;
          for (const b of s.branches) {
            const r = Boolean(evalExpr(b.cond, env));
            step(s.id, "cond", `${exprToPseudo(b.cond)}  →  ${r ? "TRUE" : "FALSE"}`, r);
            if (r) { exec(b.body); done = true; break; }
          }
          if (!done && s.elseBody.length) exec(s.elseBody);
          break;
        }
        case "while": {
          while (true) {
            const r = Boolean(evalExpr(s.cond, env));
            step(s.id, "loop", `${exprToPseudo(s.cond)}  →  ${r ? "TRUE" : "FALSE"}`, r);
            if (!r) break;
            exec(s.body);
          }
          break;
        }
        case "dowhile": {
          do {
            exec(s.body);
            const r = Boolean(evalExpr(s.cond, env));
            step(s.id, "loop", `${exprToPseudo(s.cond)}  →  ${r ? "TRUE : repeat" : "FALSE : exit"}`, r);
            if (!r) break;
          } while (true);
          break;
        }
        case "for": {
          const from = Number(evalExpr(s.from, env));
          const to = Number(evalExpr(s.to, env));
          env[s.varName] = from;
          step(s.id, "loop", `${s.varName} = ${fmtVal(from)}   (loop start)`);
          for (let i = from; i <= to; i++) {
            if (i !== from) {
              env[s.varName] = i;
              step(s.id, "loop", `${s.varName} = ${fmtVal(i)}   (next iteration)`);
            }
            exec(s.body);
          }
          step(s.id, "loop", `${s.varName} > ${exprToPseudo(s.to)}  →  loop finished`, false);
          break;
        }
      }
    }
  }

  try {
    exec(prog.statements);
    return { mode: "demo-ir", ok: true, output, steps, vars: env, stepCount: n, truncated: false };
  } catch (err) {
    const msg =
      err instanceof TruncatedError
        ? `Execution stopped after ${MAX_STEPS} steps. This usually means the loop condition never becomes FALSE — check how the loop variables change.`
        : err instanceof InputExhausted
          ? err.message
          : err instanceof ExprError
            ? `Runtime error: ${err.message}`
            : `Runtime error: ${String(err)}`;
    return { mode: "demo-ir", ok: false, output, steps, vars: env, stepCount: n, error: msg, truncated };
  }
}

export interface TestRunResult {
  passed: boolean;
  actual: string;
  expected: string;
  error?: string;
}

export function runTestCase(prog: IRProgram, input: string, expected: string): TestRunResult {
  const inputs = input.split(/\r?\n/).filter(l => l.trim() !== "");
  const res = runIR(prog, { inputs });
  const actual = res.output.join("\n").trim();
  const exp = expected.trim();
  if (!res.ok) return { passed: false, actual, expected: exp, error: res.error };
  // line-insensitive comparison (split lines + trim)
  const aLines = actual.split("\n").map(l => l.trim());
  const eLines = exp.split("\n").map(l => l.trim());
  return { passed: aLines.join("\n") === eLines.join("\n"), actual, expected: exp };
}
