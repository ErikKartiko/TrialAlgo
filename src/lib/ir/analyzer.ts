// Algorithm Analyzer — scores + complexity estimation + complexity of structure
import type { IRProgram, Stmt } from "./types";
import { analyzeIR } from "./flowchart";

export interface Analysis {
  correctness: number;
  readability: number;
  structure: number;
  efficiency: number;
  timeComplexity?: string;
  spaceComplexity?: string;
  complexityNote?: string;
  counts: { sequences: number; decisions: number; loops: number; inputs: number; outputs: number; maxDepth: number };
  suggestions: string[];
}

interface Walk {
  seq: number; decisions: number; loops: number; inputs: number; outputs: number;
  maxDepth: number; nestedLoops: number;
}

function measure(stmts: Stmt[], depth: number, inLoop: boolean, acc: Walk) {
  acc.maxDepth = Math.max(acc.maxDepth, depth);
  for (const s of stmts) {
    switch (s.kind) {
      case "input": acc.inputs++; break;
      case "output": acc.outputs++; break;
      case "assign": case "call": acc.seq++; break;
      case "if": acc.decisions++;
        s.branches.forEach(b => measure(b.body, depth + 1, inLoop, acc));
        measure(s.elseBody, depth + 1, inLoop, acc);
        break;
      case "while": case "dowhile": case "for":
        acc.loops++;
        if (inLoop) acc.nestedLoops++;
        measure(s.body, depth + 1, true, acc);
        break;
    }
  }
}

function collectNames(stmts: Stmt[], out: { inputs: string[]; assigns: string[] }) {
  for (const s of stmts) {
    if (s.kind === "input") out.inputs.push(s.varName);
    if (s.kind === "assign") out.assigns.push(s.target);
    if (s.kind === "if") { s.branches.forEach(b => collectNames(b.body, out)); collectNames(s.elseBody, out); }
    if (s.kind === "while" || s.kind === "dowhile" || s.kind === "for") collectNames(s.body, out);
  }
}

export function analyzeProgram(prog: IRProgram): Analysis {
  const acc: Walk = { seq: 0, decisions: 0, loops: 0, inputs: 0, outputs: 0, maxDepth: 0, nestedLoops: 0 };
  measure(prog.statements, 0, false, acc);
  const issues = analyzeIR(prog);
  const errors = issues.filter(i => i.level === "error").length;
  const warnings = issues.filter(i => i.level === "warning").length;

  const correctness = Math.max(0, Math.min(100, 100 - errors * 25 - warnings * 8));

  // readability: identifier quality
  const names = { inputs: [] as string[], assigns: [] as string[] };
  collectNames(prog.statements, names);
  const all = [...names.inputs, ...names.assigns];
  const good = all.filter(n => n.length >= 2 || /^[ijkn]$/.test(n)).length;
  const readability = all.length ? Math.round((good / all.length) * 100) : 90;

  // structure: prefer shallow nesting, at least one of each basic construct
  let structure = 100;
  if (acc.maxDepth > 3) structure -= (acc.maxDepth - 3) * 15;
  if (prog.statements.length === 0) structure = 0;
  structure = Math.max(0, Math.min(100, structure));

  // efficiency: complexity from loop nesting
  let efficiency = 100;
  let timeComplexity: string | undefined;
  let complexityNote: string | undefined;
  if (acc.loops === 0) {
    timeComplexity = "O(1)";
    complexityNote = "Estimated: no loops — every statement runs a constant number of times.";
  } else if (acc.nestedLoops === 0) {
    timeComplexity = "O(n)";
    complexityNote = "Estimated: a single loop level — work grows linearly with the input bound.";
    efficiency = 90;
  } else if (acc.nestedLoops === 1) {
    timeComplexity = "O(n²)";
    complexityNote = "Estimated: two nested loop levels — work grows quadratically. Consider whether the inner loop is necessary.";
    efficiency = 60;
  } else {
    timeComplexity = `O(n^${acc.nestedLoops + 1})`;
    complexityNote = "Estimated: deep loop nesting is usually inefficient for large inputs.";
    efficiency = 35;
  }
  const spaceComplexity = "O(1)";

  const suggestions: string[] = [];
  for (const i of issues) suggestions.push(i.message);
  if (acc.outputs === 0) suggestions.push("The algorithm produces no OUTPUT — add one so the result is visible.");
  if (acc.inputs === 0) suggestions.push("The algorithm reads no INPUT — it always computes the same result.");
  if (readability < 100) suggestions.push("Use descriptive variable names (e.g. 'total', 'nilai' instead of 'x').");

  return {
    correctness, readability, structure, efficiency,
    timeComplexity, spaceComplexity, complexityNote,
    counts: { sequences: acc.seq, decisions: acc.decisions, loops: acc.loops, inputs: acc.inputs, outputs: acc.outputs, maxDepth: acc.maxDepth },
    suggestions,
  };
}
