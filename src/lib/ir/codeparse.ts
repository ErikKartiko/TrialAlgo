// Source Code → IR (best-effort heuristic importer).
// Supports the subset of Python / C / C++ / C# / Java that AlgoStudio teaches.
import type { IRProgram, Stmt, Expr, Language } from "./types";
import { parseExpr } from "./expr";
import { collectVars, uid } from "./types";

interface Frame {
  t: "if" | "while" | "for" | "dowhile";
  indent: number;
  branches?: { cond: Expr; body: Stmt[] }[];
  elseBody?: Stmt[];
  inElse?: boolean;
  cond?: Expr;
  varName?: string; from?: Expr; to?: Expr;
  body: Stmt[];
}

const tryE = (src: string): Expr | null => {
  try {
    return parseExpr(
      src
        .replace(/\bTrue\b/g, "TRUE").replace(/\bFalse\b/g, "FALSE")
        .replace(/!([^=])/g, "NOT $1")
    );
  } catch { return null; }
};

export function codeToIR(code: string, lang: Language): { program?: IRProgram; warnings: string[] } {
  const warnings: string[] = [];
  const lines = code.split(/\r?\n/);
  const root: Stmt[] = [];
  const frames: Frame[] = [];
  /** a just-closed "if" awaiting a possible else/elif */
  let pendingIf: Frame | null = null;

  const cur = (): Stmt[] => {
    const f = frames[frames.length - 1];
    if (!f) return root;
    if (f.t === "if") return f.inElse ? (f.elseBody ??= []) : f.body;
    return f.body;
  };

  const materialize = (f: Frame) => {
    if (f.t === "if") cur().push({ id: uid(), kind: "if", branches: f.branches!, elseBody: f.elseBody ?? [] });
    else if (f.t === "while") cur().push({ id: uid(), kind: "while", cond: f.cond ?? { kind: "bool", value: true }, body: f.body });
    else if (f.t === "dowhile") cur().push({ id: uid(), kind: "dowhile", cond: f.cond ?? { kind: "bool", value: true }, body: f.body });
    else cur().push({ id: uid(), kind: "for", varName: f.varName!, from: f.from!, to: f.to!, body: f.body });
  };

  const flushPending = () => {
    if (pendingIf) { materialize(pendingIf); pendingIf = null; }
  };

  /** close the innermost open frame; if-frames become pending (may attach else) */
  const close = () => {
    if (!frames.length) return;
    const f = frames.pop()!;
    flushPending();
    if (f.t === "if") pendingIf = f;
    else materialize(f);
  };

  /** close frames deeper than `indent`; if keepSame, also close frames AT indent */
  const closeTo = (indent: number, keepSame: boolean) => {
    while (frames.length) {
      const top = frames[frames.length - 1];
      if (keepSame ? top.indent >= indent : top.indent > indent) close();
      else break;
    }
  };

  const indentOf = (l: string) => l.match(/^\s*/)![0].replace(/\t/g, "    ").length;
  const clean = (l: string) => l.replace(/\/\/.*$/, "").trim().replace(/;$/, "").trim();

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const line = clean(raw);
    if (!line) continue;

    if (lang === "python") {
      const ind = indentOf(raw);
      const isCont = /^(else|elif)\b/.test(line);
      // python: a line at indentation <= frame indent closes the frame,
      // UNLESS it's an else/elif continuing an if at the same indentation.
      closeTo(ind, !isCont);
      if (isCont && frames.length && frames[frames.length - 1].t === "if" && frames[frames.length - 1].indent === ind) {
        // else/elif of the open if: treat like a fresh line in the parent
      } else {
        closeTo(ind, false);
      }
      interpret(line, ind, true);
    } else {
      // brace languages
      const leading = (line.match(/^}+/)?.[0].length ?? 0);
      const isCont = /^}\s*(else|while)/.test(line);
      for (let i = 0; i < leading; i++) {
        if (isCont && i === leading - 1) break; // keep the frame for } else { / } while(...)
        close();
      }
      const rest = line.replace(/^}+\s*/, "");
      if (!rest) continue;
      interpret(rest, 0, false, rest);
    }
  }
  while (frames.length) close();
  flushPending();
  return { program: { statements: root, vars: collectVars(root) }, warnings };

  function interpret(line: string, ind: number, isPy: boolean, original?: string) {
    const isElse = /^else\b/.test(line);
    const isElif = /^(else if|elif)\b/.test(line);
    const isDoWhileTail = /^\}?\s*while\s*\(/.test(original ?? line) && frames.length && frames[frames.length - 1].t === "dowhile";

    // scaffolding to ignore
    if (!isElse && !isElif && /^(#include|using namespace|using System|import java|public class|class |public static|static void|int main|void main|return |Scanner |}\s*$)/.test(line)) { flushPending(); return; }
    if (/^(double|int|float|long)\s+\w+\s*(,[^;=]+)*$/.test(line) && !line.includes("=")) { flushPending(); return; } // plain declarations
    if (/^(double|int|float|long)\s+/.test(line) && line.includes("=") && !line.includes("cin") && !line.includes("scanf")) {
      flushPending();
      const m = line.match(/^(?:double|int|float|long)\s+(\w+)\s*=\s*(.+)$/);
      if (m) { const e = tryE(m[2]); if (e) cur().push({ id: uid(), kind: "assign", target: m[1], expr: e }); return; }
    }

    // inputs
    let m = line.match(/^cin\s*>>\s*(\w+)/) ||
      line.match(/^scanf\([^)]*&(\w+)\s*\)/) ||
      line.match(/^(\w+)\s*=\s*(?:float|int|double)?\(?\s*input\(\)\s*\)?/) ||
      line.match(/^(\w+)\s*=\s*double\.Parse\(Console\.ReadLine\(\)\)/) ||
      line.match(/^(\w+)\s*=\s*sc\.next(?:Double|Int|Float)\(\)/);
    if (m) { flushPending(); cur().push({ id: uid(), kind: "input", varName: m[1] }); return; }

    // outputs
    m = line.match(/^cout\s*<<\s*(.+)$/);
    if (m) {
      flushPending();
      const parts = m[1].split("<<").map(p => p.trim()).filter(p => p && p !== "endl" && p !== '"\\n"');
      const exprs = parts.map(tryE).filter(Boolean) as Expr[];
      if (exprs.length) cur().push({ id: uid(), kind: "output", exprs });
      return;
    }
    m = line.match(/^printf\(\s*"((?:[^"\\]|\\.)*)"\s*(?:,(.*))?\)$/);
    if (m) {
      flushPending();
      const fmt = m[1].replace(/\\n/g, "");
      const args = (m[2] ?? "").split(",").map(a => a.trim()).filter(Boolean);
      const exprs: Expr[] = [];
      const segs = fmt.split(/%[gdsf]/);
      segs.forEach((seg, i) => {
        if (seg) exprs.push({ kind: "str", value: seg });
        if (i < segs.length - 1 && args[i]) { const e = tryE(args[i]); if (e) exprs.push(e); }
      });
      if (exprs.length) cur().push({ id: uid(), kind: "output", exprs });
      return;
    }
    m = line.match(/^print\((.*)\)$/) || line.match(/^System\.out\.println\((.*)\)$/) || line.match(/^Console\.WriteLine\((.*)\)$/);
    if (m) {
      flushPending();
      const inner = m[1].replace(/f"\{(.+?):g\}"/g, "$1");
      const parts = splitArgs(inner, lang === "python" ? "," : "+");
      const exprs = parts.map(tryE).filter(Boolean) as Expr[];
      if (exprs.length) cur().push({ id: uid(), kind: "output", exprs });
      return;
    }

    // else / else-if / elif
    if (isElse || isElif) {
      // attach to pending if (brace languages) or open if frame (python)
      let f: Frame | undefined;
      if (pendingIf) { f = pendingIf; pendingIf = null; frames.push(f); }
      else {
        const top = frames[frames.length - 1];
        if (top && top.t === "if") f = top;
      }
      if (!f) { warnings.push(`Skipped "${line.slice(0, 40)}" — no matching IF.`); return; }
      if (isElif) {
        const cm = line.match(/^(?:else if|elif)\s*\(?(.+?)\)?\s*:?\s*\{?$/);
        const cond = cm ? tryE(cm[1]) ?? { kind: "bool", value: true } as Expr : { kind: "bool", value: true } as Expr;
        f.branches!.push({ cond, body: [] });
        f.body = f.branches![f.branches!.length - 1].body;
        f.inElse = false;
      } else {
        f.inElse = true; f.elseBody = [];
      }
      f.indent = ind;
      return;
    }

    // if
    m = line.match(/^if\s*\(?(.+?)\)?\s*:?\s*\{?$/) ?? line.match(/^elif\s*\(?(.+?)\)?\s*:?$/);
    if (m && /^if/.test(line)) {
      flushPending();
      const cond = tryE(m[1]);
      if (cond) {
        const f: Frame = { t: "if", indent: ind, branches: [{ cond, body: [] }], body: [], inElse: false };
        f.body = f.branches![0].body;
        frames.push(f);
      } else {
        warnings.push(`Skipped line: "${line.slice(0, 60)}" (unparsable condition)`);
      }
      return;
    }

    if (/^do\s*\{?$/.test(line)) { flushPending(); frames.push({ t: "dowhile", indent: ind, body: [] }); return; }

    // do-while tail: } while (cond);
    if (isDoWhileTail) {
      const wm = line.match(/while\s*\((.+)\)/);
      const f = frames[frames.length - 1];
      if (wm) f.cond = tryE(wm[1]) ?? { kind: "bool", value: true } as Expr;
      close();
      return;
    }

    // while
    m = line.match(/^while\s*\(?(.+?)\)?\s*:?\s*\{?$/);
    if (m && /^while/.test(line)) {
      flushPending();
      const cond = tryE(m[1]) ?? { kind: "bool", value: true } as Expr;
      frames.push({ t: "while", indent: ind, cond, body: [] });
      return;
    }

    // for (python)
    m = line.match(/^for\s+(\w+)\s+in\s+range\(\s*(.+?)\s*,\s*(.+?)\s*(?:,\s*.+)?\)\s*:/);
    if (m) {
      flushPending();
      const from = tryE(m[2]) ?? ({ kind: "num", value: 0 } as Expr);
      let toSrc = m[3].trim();
      const pm = toSrc.match(/^\(?(.+?)\)?\s*\+\s*1$/);
      if (pm) toSrc = pm[1];
      else { const num = Number(toSrc); if (!Number.isNaN(num)) toSrc = String(num - 1); }
      const to = tryE(toSrc) ?? ({ kind: "num", value: 0 } as Expr);
      frames.push({ t: "for", indent: ind, varName: m[1], from, to, body: [] });
      return;
    }
    // for (c-like)
    m = line.match(/^for\s*\(\s*(?:int\s+)?(\w+)\s*=\s*(.+?);\s*\1\s*<=\s*(.+?);\s*\1\+\+\s*\)\s*\{?$/);
    if (m) {
      flushPending();
      const from = tryE(m[2]) ?? ({ kind: "num", value: 0 } as Expr);
      const to = tryE(m[3]) ?? ({ kind: "num", value: 0 } as Expr);
      frames.push({ t: "for", indent: ind, varName: m[1], from, to, body: [] });
      return;
    }

    if (/^(break|pass|continue)$/.test(line)) return;
    if (/^if\s+not\s*\(/.test(line)) return; // do-while break guard in python

    // assignment
    m = line.match(/^(\w+)\s*(=|\+=|-=)\s*(.+)$/);
    if (m) {
      flushPending();
      let e = tryE(m[3]);
      if (m[2] === "+=") e = tryE(`${m[1]} + ${m[3]}`);
      if (m[2] === "-=") e = tryE(`${m[1]} - ${m[3]}`);
      if (e) cur().push({ id: uid(), kind: "assign", target: m[1], expr: e });
      return;
    }
    if (!/^[}{]/.test(line)) {
      flushPending();
      warnings.push(`Skipped line: "${line.slice(0, 60)}"`);
    }
    void isPy;
  }
}

function splitArgs(src: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "", inStr: string | null = null;
  for (const c of src) {
    if (inStr) { cur += c; if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'") { inStr = c; cur += c; continue; }
    if (c === "(" || c === "{") depth++;
    if (c === ")" || c === "}") depth--;
    if (c === sep && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
