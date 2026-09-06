// ─────────────────────────────────────────────────────────────────────────────
// Algorithm IR (Intermediate Representation)
// Canonical model. Flowchart, Pseudocode, and Source Code are all views of IR.
// ─────────────────────────────────────────────────────────────────────────────

export type BinOp =
  | "+" | "-" | "*" | "/" | "%" | "mod"
  | ">" | "<" | ">=" | "<=" | "==" | "!=" | "=" | "<>"
  | "and" | "or" | "AND" | "OR" | "&&" | "||";

export type Expr =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "var"; name: string }
  | { kind: "binop"; op: string; left: Expr; right: Expr }
  | { kind: "unop"; op: "-" | "not" | "NOT" | "!"; operand: Expr };

export type StmtKind =
  | "input" | "output" | "assign"
  | "if" | "while" | "dowhile" | "for" | "call";

export interface BaseStmt { id: string; kind: StmtKind; }

export interface InputStmt extends BaseStmt { kind: "input"; varName: string; prompt?: string; }
export interface OutputStmt extends BaseStmt { kind: "output"; exprs: Expr[]; }
export interface AssignStmt extends BaseStmt { kind: "assign"; target: string; expr: Expr; }
export interface IfBranch { cond: Expr; body: Stmt[]; }
export interface IfStmt extends BaseStmt { kind: "if"; branches: IfBranch[]; elseBody: Stmt[]; }
export interface WhileStmt extends BaseStmt { kind: "while"; cond: Expr; body: Stmt[]; }
export interface DoWhileStmt extends BaseStmt { kind: "dowhile"; cond: Expr; body: Stmt[]; }
/** Pseudocode-style FOR: FOR i = a TO b (inclusive) */
export interface ForStmt extends BaseStmt {
  kind: "for"; varName: string; from: Expr; to: Expr; step?: Expr; body: Stmt[];
}
export interface CallStmt extends BaseStmt { kind: "call"; name: string; args: Expr[]; }

export type Stmt =
  | InputStmt | OutputStmt | AssignStmt
  | IfStmt | WhileStmt | DoWhileStmt | ForStmt | CallStmt;

export interface IRProgram {
  statements: Stmt[];
  /** declared numeric variable names (input + assigned), for code generation */
  vars: string[];
}

export function collectVars(stmts: Stmt[]): string[] {
  const seen = new Set<string>();
  const walkE = (e: Expr) => {
    if (e.kind === "var") seen.add(e.name);
    else if (e.kind === "binop") { walkE(e.left); walkE(e.right); }
    else if (e.kind === "unop") walkE(e.operand);
  };
  const walk = (list: Stmt[]) => {
    for (const s of list) {
      switch (s.kind) {
        case "input": seen.add(s.varName); break;
        case "assign": seen.add(s.target); walkE(s.expr); break;
        case "output": s.exprs.forEach(walkE); break;
        case "if":
          s.branches.forEach(b => { walkE(b.cond); walk(b.body); });
          walk(s.elseBody); break;
        case "while": case "dowhile": walkE(s.cond); walk(s.body); break;
        case "for":
          seen.add(s.varName); walkE(s.from); walkE(s.to);
          if (s.step) walkE(s.step); walk(s.body); break;
        case "call": s.args.forEach(walkE); break;
      }
    }
  };
  walk(stmts);
  return Array.from(seen);
}

// ── Flowchart graph model (structured JSON, not an image) ────────────────────

export type FlowNodeType =
  | "start" | "end" | "input" | "output" | "process"
  | "decision" | "for" | "while" | "dowhile" | "connector" | "call";

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  x: number;
  y: number;
  /** for-loop metadata when type === "for" */
  loop?: { varName: string; from: string; to: string };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** "true" | "false" for decision/while/dowhile; "body" | "exit" for for-loop */
  sourceHandle?: string;
  label?: string;
}

export interface FlowGraph { nodes: FlowNode[]; edges: FlowEdge[]; }

// ── Line maps: stmt id → 0-based line range, enables synchronized highlight ──

export type LineMap = Record<string, [number, number]>;

export interface TestCase { id: string; name: string; input: string; expected: string; }

export interface ExecutionStep {
  n: number;
  stmtId?: string;
  type: "assign" | "input" | "output" | "cond" | "loop";
  /** human readable description e.g. "total = 3" */
  note: string;
  vars: Record<string, number | string | boolean>;
  /** for cond steps: result of the condition */
  result?: boolean;
}

export interface ExecutionResult {
  mode: "demo-ir";
  ok: boolean;
  output: string[];
  error?: string;
  steps: ExecutionStep[];
  vars: Record<string, number | string | boolean>;
  stepCount: number;
  truncated?: boolean;
}

export type Language = "c" | "cpp" | "csharp" | "python" | "java";
export const LANGUAGES: { id: Language; name: string; file: string }[] = [
  { id: "c", name: "C", file: "main.c" },
  { id: "cpp", name: "C++", file: "main.cpp" },
  { id: "csharp", name: "C#", file: "Program.cs" },
  { id: "python", name: "Python", file: "main.py" },
  { id: "java", name: "Java", file: "Main.java" },
];

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
