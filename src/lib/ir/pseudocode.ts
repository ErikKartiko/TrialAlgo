// Pseudocode ⇆ IR  (generator + parser with friendly, educational errors)
import type { IRProgram, LineMap, Stmt, Expr } from "./types";
import { parseExpr, exprToPseudo, ExprError } from "./expr";
import { collectVars, uid } from "./types";

// ── Generator ────────────────────────────────────────────────────────────────

export function irToPseudocode(prog: IRProgram): { text: string; map: LineMap } {
  const lines: string[] = [];
  const map: LineMap = {};
  const emit = (depth: number, text: string) => lines.push("    ".repeat(depth) + text);

  function genBlock(stmts: Stmt[], depth: number) {
    for (const s of stmts) {
      const start = lines.length;
      switch (s.kind) {
        case "input": emit(depth, `INPUT ${s.varName}`); break;
        case "output": emit(depth, `OUTPUT ${s.exprs.map(exprToPseudo).join(", ")}`); break;
        case "assign": emit(depth, `${s.target} = ${exprToPseudo(s.expr)}`); break;
        case "call": emit(depth, `CALL ${s.name}`); break;
        case "if": {
          s.branches.forEach((b, i) => {
            emit(depth, i === 0 ? `IF ${exprToPseudo(b.cond)} THEN` : `ELSE IF ${exprToPseudo(b.cond)} THEN`);
            genBlock(b.body, depth + 1);
          });
          if (s.elseBody.length) { emit(depth, "ELSE"); genBlock(s.elseBody, depth + 1); }
          emit(depth, "END IF");
          break;
        }
        case "while": emit(depth, `WHILE ${exprToPseudo(s.cond)}`); genBlock(s.body, depth + 1); emit(depth, "END WHILE"); break;
        case "dowhile": emit(depth, "DO"); genBlock(s.body, depth + 1); emit(depth, `WHILE ${exprToPseudo(s.cond)}`); break;
        case "for": {
          emit(depth, `FOR ${s.varName} = ${exprToPseudo(s.from)} TO ${exprToPseudo(s.to)}`);
          genBlock(s.body, depth + 1);
          emit(depth, "END FOR");
          break;
        }
      }
      map[s.id] = [start, lines.length - 1];
    }
  }

  const head = lines.length; emit(0, "START"); map["__start"] = [head, head];
  genBlock(prog.statements, 1);
  const tail = lines.length; emit(0, "END"); map["__end"] = [tail, tail];
  return { text: lines.join("\n"), map };
}

// ── Parser ───────────────────────────────────────────────────────────────────

export interface PseudoError {
  line: number;      // 1-based
  message: string;
  expected?: string;
  found?: string;
  hint?: string;
}

export interface ParseResult {
  ok: boolean;
  program?: IRProgram;
  errors: PseudoError[];
}

type Frame =
  | { t: "if"; startLine: number; branches: { cond: Expr; body: Stmt[] }[]; cur: Stmt[]; elseBody?: Stmt[]; inElse: boolean }
  | { t: "while"; startLine: number; cond: Expr; body: Stmt[] }
  | { t: "do"; startLine: number; body: Stmt[] }
  | { t: "for"; startLine: number; varName: string; from: Expr; to: Expr; body: Stmt[] };

export function parsePseudocode(text: string): ParseResult {
  const errors: PseudoError[] = [];
  const raw = text.split(/\r?\n/);
  /** attach statements here; top-level frame is the program body */
  const root: Stmt[] = [];
  const frames: Frame[] = [];
  let started = false;
  let ended = false;

  const cur = (): Stmt[] => {
    if (!frames.length) return root;
    const f = frames[frames.length - 1];
    if (f.t === "if") return f.inElse ? (f.elseBody ??= []) : f.cur;
    return f.body;
  };

  const err = (line: number, e: Omit<PseudoError, "line">) => errors.push({ line, ...e });

  const tryExpr = (line: number, src: string, context: string): Expr | null => {
    try { return parseExpr(src); }
    catch (ex) {
      const m = ex instanceof ExprError ? ex.message : String(ex);
      err(line, { message: `Invalid expression in ${context}.`, found: src.trim(), hint: m });
      return null;
    }
  };

  const closeAll = (line: number) => {
    while (frames.length) {
      const f = frames.pop()!;
      if (f.t === "if") cur().push({ id: uid(), kind: "if", branches: f.branches, elseBody: f.elseBody ?? [] });
      else if (f.t === "while") cur().push({ id: uid(), kind: "while", cond: f.cond, body: f.body });
      else if (f.t === "do") cur().push({ id: uid(), kind: "dowhile", cond: { kind: "bool", value: true }, body: f.body });
      else cur().push({ id: uid(), kind: "for", varName: f.varName, from: f.from, to: f.to, body: f.body });
      err(line, {
        message: `Block opened on line ${f.startLine} was never closed.`,
        expected: f.t === "if" ? "END IF" : f.t === "while" ? "END WHILE" : f.t === "for" ? "END FOR" : "WHILE <condition> (to close DO)",
        hint: "Setiap blok IF / WHILE / FOR / DO harus ditutup dengan penutup yang sesuai.",
      });
    }
  };

  raw.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) return;
    const upper = line.toUpperCase();
    const rest = (kw: string) => line.slice(kw.length).trim();

    if (!started) {
      if (upper === "START" || upper === "BEGIN") { started = true; return; }
      started = true; // tolerant: allow missing START
    }
    if (ended) {
      err(lineNo, { message: "Statement found after END.", found: line, hint: "Semua statement harus berada di antara START dan END." });
      return;
    }

    if (upper === "END" || upper === "END." ) {
      if (frames.length) {
        const f = frames[frames.length - 1];
        err(lineNo, {
          message: `Found END but a block from line ${f.startLine} is still open.`,
          expected: f.t === "if" ? "END IF" : f.t === "while" ? "END WHILE" : f.t === "for" ? "END FOR" : `WHILE <condition>`,
          found: "END",
          hint: f.t === "if" ? "Pastikan setiap IF memiliki END IF." : "Tutup blok yang masih terbuka sebelum END.",
        });
      }
      ended = true;
      return;
    }

    if (upper.startsWith("INPUT ") || upper === "INPUT") {
      const name = rest("INPUT");
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        err(lineNo, { message: "INPUT requires a variable name.", found: name, hint: "Contoh: INPUT nilai" });
      } else cur().push({ id: uid(), kind: "input", varName: name });
      return;
    }
    if (upper.startsWith("READ ")) {
      const name = rest("READ");
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) cur().push({ id: uid(), kind: "input", varName: name });
      return;
    }
    if (upper.startsWith("OUTPUT ") || upper.startsWith("PRINT ") || upper.startsWith("DISPLAY ") || upper.startsWith("WRITE ")) {
      const kw = upper.startsWith("OUTPUT") ? "OUTPUT" : upper.startsWith("PRINT") ? "PRINT" : upper.startsWith("DISPLAY") ? "DISPLAY" : "WRITE";
      const argSrc = rest(kw);
      const parts = splitTop(argSrc, ",");
      const exprs: Expr[] = [];
      let bad = false;
      for (const p of parts) {
        if (!p.trim()) continue;
        const e = tryExpr(lineNo, p, "OUTPUT"); if (e) exprs.push(e); else bad = true;
      }
      if (!exprs.length || bad) err(lineNo, exprs.length ? { message: "Some OUTPUT expressions are invalid." } : { message: "OUTPUT requires at least one expression.", hint: `Contoh: OUTPUT "Lulus"  atau  OUTPUT total` });
      if (exprs.length) cur().push({ id: uid(), kind: "output", exprs });
      return;
    }

    if (upper.startsWith("IF ")) {
      let src = rest("IF");
      const thenIdx = src.toUpperCase().lastIndexOf(" THEN");
      if (thenIdx >= 0) src = src.slice(0, thenIdx);
      const cond = tryExpr(lineNo, src, "IF condition");
      if (cond) frames.push({ t: "if", startLine: lineNo, branches: [{ cond, body: [] }], cur: [], inElse: false });
      else frames.push({ t: "if", startLine: lineNo, branches: [{ cond: { kind: "bool", value: true }, body: [] }], cur: [], inElse: false });
      // fix: branches[0].body should be the active list
      const f = frames[frames.length - 1];
      if (f.t === "if") f.cur = f.branches[0].body;
      return;
    }
    if (upper.startsWith("ELSE IF ")) {
      const f = frames[frames.length - 1];
      if (!f || f.t !== "if") { err(lineNo, { message: "ELSE IF without a matching IF.", hint: "ELSE IF harus berada di dalam blok IF." }); return; }
      let src = rest("ELSE IF");
      const thenIdx = src.toUpperCase().lastIndexOf(" THEN");
      if (thenIdx >= 0) src = src.slice(0, thenIdx);
      const cond = tryExpr(lineNo, src, "ELSE IF condition") ?? { kind: "bool", value: true } as Expr;
      f.branches.push({ cond, body: [] });
      f.cur = f.branches[f.branches.length - 1].body;
      f.inElse = false;
      return;
    }
    if (upper === "ELSE") {
      const f = frames[frames.length - 1];
      if (!f || f.t !== "if") { err(lineNo, { message: "ELSE without a matching IF.", hint: "ELSE hanya valid di dalam blok IF." }); return; }
      f.inElse = true; f.elseBody = [];
      return;
    }
    if (upper === "END IF" || upper === "ENDIF") {
      const f = frames[frames.length - 1];
      if (!f || f.t !== "if") { err(lineNo, { message: "END IF without a matching IF.", found: "END IF" }); return; }
      frames.pop();
      cur().push({ id: uid(), kind: "if", branches: f.branches, elseBody: f.elseBody ?? [] });
      return;
    }

    if (upper.startsWith("WHILE ")) {
      const f = frames[frames.length - 1];
      if (f && f.t === "do") {
        // close a DO ... WHILE cond block
        const cond = tryExpr(lineNo, rest("WHILE"), "DO..WHILE condition") ?? { kind: "bool", value: true } as Expr;
        frames.pop();
        cur().push({ id: uid(), kind: "dowhile", cond, body: f.body });
        return;
      }
      const cond = tryExpr(lineNo, rest("WHILE"), "WHILE condition");
      if (cond) frames.push({ t: "while", startLine: lineNo, cond, body: [] });
      return;
    }
    if (upper === "END WHILE" || upper === "ENDWHILE") {
      const f = frames[frames.length - 1];
      if (!f || f.t !== "while") { err(lineNo, { message: "END WHILE without a matching WHILE.", found: "END WHILE" }); return; }
      frames.pop();
      cur().push({ id: uid(), kind: "while", cond: f.cond, body: f.body });
      return;
    }

    if (upper === "DO" || upper === "REPEAT") {
      frames.push({ t: "do", startLine: lineNo, body: [] });
      return;
    }

    if (upper.startsWith("FOR ")) {
      const m = rest("FOR").match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|←|:=)\s*(.+?)\s+TO\s+(.+)$/i);
      if (!m) {
        err(lineNo, {
          message: "Invalid FOR loop syntax.", found: rest("FOR"),
          expected: "FOR i = 1 TO n",
          hint: "Format: FOR <variabel> = <awal> TO <akhir>",
        });
        return;
      }
      const from = tryExpr(lineNo, m[2], "FOR start");
      const to = tryExpr(lineNo, m[3], "FOR end");
      if (from && to) frames.push({ t: "for", startLine: lineNo, varName: m[1], from, to, body: [] });
      return;
    }
    if (upper === "END FOR" || upper === "ENDFOR" || upper === "NEXT") {
      const f = frames[frames.length - 1];
      if (!f || f.t !== "for") { err(lineNo, { message: "END FOR without a matching FOR.", found: "END FOR" }); return; }
      frames.pop();
      cur().push({ id: uid(), kind: "for", varName: f.varName, from: f.from, to: f.to, body: f.body });
      return;
    }

    // assignment: target = expr | target <- expr | target := expr
    const am = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(←|:=|=|<-)\s*(.+)$/);
    if (am) {
      const e = tryExpr(lineNo, am[3], "assignment");
      if (e) cur().push({ id: uid(), kind: "assign", target: am[1], expr: e });
      return;
    }

    err(lineNo, {
      message: "Unrecognized statement.", found: line,
      hint: "Statement valid: INPUT, OUTPUT, IF..THEN, WHILE, FOR..TO, DO..WHILE, assignment (x = nilai), END.",
    });
  });

  if (frames.length) closeAll(raw.length);
  return { ok: errors.length === 0, program: { statements: root, vars: collectVars(root) }, errors };
}

function splitTop(src: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "", inStr: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) { cur += c; if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'") { inStr = c; cur += c; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}
