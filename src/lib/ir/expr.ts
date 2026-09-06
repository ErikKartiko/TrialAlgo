// Expression tokenizer / parser / evaluator / printers
import type { Expr, Language } from "./types";

export class ExprError extends Error {
  constructor(msg: string, public pos: number = 0) { super(msg); }
}

type Tok = { t: "num" | "str" | "id" | "op" | "lp" | "rp"; v: string; pos: number };

const OP3 = ["<=" , ">=", "==", "!=", "<>", "&&", "||"];
const OP1 = ["+", "-", "*", "/", "%", ">", "<", "=", "!"];

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== c) { s += src[j]; j++; }
      if (j >= src.length) throw new ExprError("Unterminated string literal", i);
      toks.push({ t: "str", v: s, pos: i }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i, s = "";
      while (j < src.length && /[0-9.]/.test(src[j])) { s += src[j]; j++; }
      toks.push({ t: "num", v: s, pos: i }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i, s = "";
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) { s += src[j]; j++; }
      toks.push({ t: "id", v: s, pos: i }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (OP3.includes(two)) { toks.push({ t: "op", v: two, pos: i }); i += 2; continue; }
    if (OP1.includes(c)) { toks.push({ t: "op", v: c, pos: i }); i++; continue; }
    if (c === "(") { toks.push({ t: "lp", v: c, pos: i }); i++; continue; }
    if (c === ")") { toks.push({ t: "rp", v: c, pos: i }); i++; continue; }
    throw new ExprError(`Unexpected character '${c}'`, i);
  }
  return toks;
}

const KW: Record<string, string> = {
  AND: "and", OR: "or", MOD: "mod", NOT: "not",
  and: "and", or: "or", mod: "mod", not: "not",
  TRUE: "true", FALSE: "false", true: "true", false: "false",
};

export function parseExpr(src: string): Expr {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const fail = (msg: string, pos?: number): never => {
    throw new ExprError(msg, pos ?? (peek()?.pos ?? src.length));
  };

  function parseOr(): Expr {
    let l = parseAnd();
    while (peek() && (peek().t === "id" && KW[peek().v] === "or" || peek().t === "op" && peek().v === "||")) {
      next(); l = { kind: "binop", op: "or", left: l, right: parseAnd() };
    }
    return l;
  }
  function parseAnd(): Expr {
    let l = parseNot();
    while (peek() && (peek().t === "id" && KW[peek().v] === "and" || peek().t === "op" && peek().v === "&&")) {
      next(); l = { kind: "binop", op: "and", left: l, right: parseNot() };
    }
    return l;
  }
  function parseNot(): Expr {
    const t = peek();
    if (t && ((t.t === "id" && KW[t.v] === "not") || (t.t === "op" && t.v === "!"))) {
      next(); return { kind: "unop", op: "not", operand: parseNot() };
    }
    return parseCmp();
  }
  function parseCmp(): Expr {
    let l = parseAdd();
    const t = peek();
    if (t && t.t === "op" && [">", "<", ">=", "<=", "==", "!=", "=", "<>"].includes(t.v)) {
      next();
      const op = t.v === "=" ? "==" : t.v === "<>" ? "!=" : t.v;
      l = { kind: "binop", op, left: l, right: parseAdd() };
    }
    return l;
  }
  function parseAdd(): Expr {
    let l = parseMul();
    while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = next().v; l = { kind: "binop", op, left: l, right: parseMul() };
    }
    return l;
  }
  function parseMul(): Expr {
    let l = parseUnary();
    while (peek() && ((peek().t === "op" && ["*", "/", "%"].includes(peek().v)) ||
      (peek().t === "id" && KW[peek().v] === "mod"))) {
      const raw = next().v; const op = raw === "%" ? "mod" : (KW[raw] ?? raw);
      l = { kind: "binop", op, left: l, right: parseUnary() };
    }
    return l;
  }
  function parseUnary(): Expr {
    const t = peek();
    if (t && t.t === "op" && t.v === "-") { next(); return { kind: "unop", op: "-", operand: parseUnary() }; }
    return parsePrimary();
  }
  function parsePrimary(): Expr {
    const t = next();
    if (!t) throw new ExprError("Unexpected end of expression", src.length);
    if (t.t === "num") return { kind: "num", value: parseFloat(t.v) };
    if (t.t === "str") return { kind: "str", value: t.v };
    if (t.t === "id") {
      const kw = KW[t.v];
      if (kw === "true") return { kind: "bool", value: true };
      if (kw === "false") return { kind: "bool", value: false };
      return { kind: "var", name: t.v };
    }
    if (t.t === "lp") {
      const e = parseOr();
      const r = next();
      if (!r || r.t !== "rp") throw new ExprError("Expected ')'", t.pos);
      return e;
    }
    throw new ExprError(`Unexpected token '${t.v}'`, t.pos);
  }

  const e = parseOr();
  if (p < toks.length) fail(`Unexpected token '${toks[p].v}'`, toks[p].pos);
  return e;
}

// ── Evaluation ────────────────────────────────────────────────────────────────

export type VEnv = Record<string, number | string | boolean>;

function cmp(op: string, a: number | string | boolean, b: number | string | boolean): boolean {
  switch (op) {
    case "==": return a === b;
    case "!=": return a !== b;
    case ">": return (a as number) > (b as number);
    case "<": return (a as number) < (b as number);
    case ">=": return (a as number) >= (b as number);
    case "<=": return (a as number) <= (b as number);
    default: return false;
  }
}

export function evalExpr(e: Expr, env: VEnv): number | string | boolean {
  switch (e.kind) {
    case "num": return e.value;
    case "str": return e.value;
    case "bool": return e.value;
    case "var": {
      const v = env[e.name];
      if (v === undefined) throw new ExprError(`Variable '${e.name}' is not defined yet.`);
      return v;
    }
    case "unop": {
      const v = evalExpr(e.operand, env);
      if (e.op === "-") return -(v as number);
      return !v;
    }
    case "binop": {
      const op = e.op;
      if (op === "and") return Boolean(evalExpr(e.left, env)) && Boolean(evalExpr(e.right, env));
      if (op === "or") return Boolean(evalExpr(e.left, env)) || Boolean(evalExpr(e.right, env));
      const a = evalExpr(e.left, env);
      const b = evalExpr(e.right, env);
      if ([">", "<", ">=", "<=", "==", "!="].includes(op)) return cmp(op, a, b);
      if (typeof a === "string" || typeof b === "string") {
        if (op === "+") return String(a) + String(b);
        throw new ExprError(`Operator '${op}' cannot be applied to text.`);
      }
      const x = a as number, y = b as number;
      switch (op) {
        case "+": return x + y;
        case "-": return x - y;
        case "*": return x * y;
        case "/": if (y === 0) throw new ExprError("Division by zero."); return x / y;
        case "mod": if (y === 0) throw new ExprError("Modulo by zero."); return x % y;
        default: throw new ExprError(`Unknown operator '${op}'`);
      }
    }
  }
}

// ── Printers ──────────────────────────────────────────────────────────────────

export function exprVars(e: Expr, out: Set<string> = new Set()): Set<string> {
  if (e.kind === "var") out.add(e.name);
  else if (e.kind === "binop") { exprVars(e.left, out); exprVars(e.right, out); }
  else if (e.kind === "unop") exprVars(e.operand, out);
  return out;
}

function needsParens(parent: string, childOp?: string): boolean {
  if (!childOp) return false;
  const rank = (o: string) =>
    o === "or" ? 1 : o === "and" ? 2 : [">", "<", ">=", "<=", "==", "!="].includes(o) ? 3
    : (o === "+" || o === "-") ? 4 : 5;
  return rank(childOp) < rank(parent);
}

export function exprToPseudo(e: Expr): string {
  switch (e.kind) {
    case "num": return String(e.value);
    case "str": return JSON.stringify(e.value);
    case "bool": return e.value ? "TRUE" : "FALSE";
    case "var": return e.name;
    case "unop": return e.op === "not" ? `NOT ${exprToPseudo(e.operand)}` : `-${exprToPseudo(e.operand)}`;
    case "binop": {
      const op = e.op === "==" ? "=" : e.op === "!=" ? "<>" : e.op === "mod" ? "MOD"
        : e.op === "and" ? "AND" : e.op === "or" ? "OR" : e.op;
      const l = e.left.kind === "binop" && needsParens(e.op, e.left.op) ? `(${exprToPseudo(e.left)})` : exprToPseudo(e.left);
      const r0 = exprToPseudo(e.right);
      const r = (e.right.kind === "binop") ? `(${r0})` : r0;
      return `${l} ${op} ${r}`;
    }
  }
}

const OPMAP: Record<Language, Record<string, string>> = {
  python: { and: "and", or: "or", "==": "==", "!=": "!=", mod: "%" },
  c: { and: "&&", or: "||", "==": "==", "!=": "!=", mod: "%" },
  cpp: { and: "&&", or: "||", "==": "==", "!=": "!=", mod: "%" },
  csharp: { and: "&&", or: "||", "==": "==", "!=": "!=", mod: "%" },
  java: { and: "&&", or: "||", "==": "==", "!=": "!=", mod: "%" },
};

export function exprToCode(e: Expr, lang: Language): string {
  switch (e.kind) {
    case "num": return String(e.value);
    case "str": return JSON.stringify(e.value);
    case "bool": return e.value ? (lang === "python" ? "True" : "true") : (lang === "python" ? "False" : "false");
    case "var": return e.name;
    case "unop": {
      const inner = exprToCode(e.operand, lang);
      if (e.op === "-") return `-${inner}`;
      return lang === "python" ? `not ${inner}` : `!(${inner})`;
    }
    case "binop": {
      const op = OPMAP[lang][e.op] ?? e.op;
      const l = e.left.kind === "binop" && needsParens(e.op, e.left.op) ? `(${exprToCode(e.left, lang)})` : exprToCode(e.left, lang);
      const r0 = exprToCode(e.right, lang);
      const r = e.right.kind === "binop" ? `(${r0})` : r0;
      return `${l} ${op} ${r}`;
    }
  }
}
