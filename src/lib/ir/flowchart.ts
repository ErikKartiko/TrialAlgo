// Flowchart ⇆ IR  (+ validation). Structured JSON graph is the source of truth.
import type {
  FlowGraph, FlowNode, FlowNodeType, IRProgram, Stmt, Expr,
} from "./types";
import { parseExpr, exprToPseudo, exprVars } from "./expr";
import { collectVars, uid } from "./types";

export const NODE_SIZES: Record<FlowNodeType, [number, number]> = {
  start: [170, 52], end: [170, 52], process: [214, 60], input: [214, 60],
  output: [214, 60], decision: [252, 116], for: [242, 96], while: [242, 96],
  dowhile: [242, 96], connector: [26, 26], call: [214, 60],
};

const GAP_Y = 44;
const GUTTER = 40;

// ═════════════════════════════════════════════════════════════════════════════
// Validation
// ═════════════════════════════════════════════════════════════════════════════

export interface FcIssue {
  level: "error" | "warning";
  message: string;
  nodeId?: string;
}

export function validateFlowchart(graph: FlowGraph): FcIssue[] {
  const issues: FcIssue[] = [];
  const starts = graph.nodes.filter(n => n.type === "start");
  const ends = graph.nodes.filter(n => n.type === "end");
  if (starts.length === 0) issues.push({ level: "error", message: "Flowchart is missing a START node." });
  if (starts.length > 1) issues.push({ level: "error", message: "Flowchart has more than one START node." });
  if (ends.length === 0) issues.push({ level: "error", message: "Flowchart is missing an END node." });

  const outDeg = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const e of graph.edges) {
    outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }
  for (const n of graph.nodes) {
    const out = outDeg.get(n.id) ?? 0;
    const inc = inDeg.get(n.id) ?? 0;
    if (n.type !== "start" && n.type !== "end" && out === 0 && inc === 0) {
      issues.push({ level: "error", message: `"${n.label || n.type}" is not connected to anything.`, nodeId: n.id });
    }
    if (n.type !== "end" && out === 0 && inc > 0) {
      issues.push({ level: "error", message: `"${n.label || n.type}" has no outgoing connection — the flow stops here without reaching END.`, nodeId: n.id });
    }
    if (n.type === "decision" || n.type === "while") {
      const handles = new Set(graph.edges.filter(e => e.source === n.id).map(e => e.sourceHandle));
      if (!handles.has("true")) issues.push({ level: "error", message: `"${n.label}" is missing its TRUE branch.`, nodeId: n.id });
      if (!handles.has("false")) issues.push({ level: "error", message: `"${n.label}" is missing its FALSE branch.`, nodeId: n.id });
    }
    if (n.type === "for" || n.type === "dowhile") {
      const handles = new Set(graph.edges.filter(e => e.source === n.id).map(e => e.sourceHandle));
      if (!handles.has("body")) issues.push({ level: "error", message: `Loop "${n.label}" is missing its loop-BODY connection.`, nodeId: n.id });
      if (!handles.has("exit")) issues.push({ level: "error", message: `Loop "${n.label}" is missing its EXIT connection.`, nodeId: n.id });
    }
  }

  // reachability from START
  if (starts.length === 1) {
    const adj = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }
    const seen = new Set<string>();
    const q = [starts[0].id];
    while (q.length) {
      const id = q.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      q.push(...(adj.get(id) ?? []));
    }
    for (const n of graph.nodes) {
      if (!seen.has(n.id) && n.type !== "connector") {
        issues.push({ level: "warning", message: `"${n.label || n.type}" is unreachable from START.`, nodeId: n.id });
      }
    }
    // END reachable?
    if (ends.length && !ends.some(e => seen.has(e.id))) {
      issues.push({ level: "warning", message: "END cannot be reached from START." });
    }
  }
  return issues;
}

/** Semantic checks on IR: undefined variables, unused inputs, infinite-loop warnings. */
export function analyzeIR(prog: IRProgram): FcIssue[] {
  const issues: FcIssue[] = [];
  const defined = new Set<string>();
  const used = new Set<string>();
  const inputs = new Set<string>();

  const useExpr = (e: Expr) => exprVars(e).forEach(v => used.add(v));

  const walk = (stmts: Stmt[]) => {
    for (const s of stmts) {
      switch (s.kind) {
        case "input": defined.add(s.varName); inputs.add(s.varName); break;
        case "assign":
          useExpr(s.expr);
          defined.add(s.target);
          break;
        case "output": s.exprs.forEach(useExpr); break;
        case "if":
          s.branches.forEach(b => { useExpr(b.cond); walk(b.body); });
          walk(s.elseBody); break;
        case "while": case "dowhile": useExpr(s.cond); walk(s.body); break;
        case "for":
          defined.add(s.varName); useExpr(s.from); useExpr(s.to); walk(s.body);
          break;
        case "call": s.args.forEach(useExpr); break;
      }
    }
  };
  // definition pass must be order-aware; do a simple ordered walk
  const ordered = (stmts: Stmt[], scope: Set<string>) => {
    for (const s of stmts) {
      const check = (e: Expr) =>
        exprVars(e).forEach(v => {
          if (!scope.has(v)) {
            issues.push({ level: "warning", message: `Variable '${v}' is used before it gets a value.`, nodeId: s.id });
            scope.add(v);
          }
        });
      switch (s.kind) {
        case "input": scope.add(s.varName); break;
        case "assign": check(s.expr); scope.add(s.target); break;
        case "output": s.exprs.forEach(check); break;
        case "if": s.branches.forEach(b => { check(b.cond); ordered(b.body, new Set(scope)); }); ordered(s.elseBody, new Set(scope)); break;
        case "while": case "dowhile": check(s.cond); ordered(s.body, new Set(scope)); break;
        case "for": { const inner = new Set(scope); inner.add(s.varName); check(s.from); check(s.to); ordered(s.body, inner); break; }
        case "call": s.args.forEach(check); break;
      }
    }
  };
  walk(prog.statements);
  ordered(prog.statements, new Set());

  for (const v of inputs) {
    if (!used.has(v)) {
      issues.push({ level: "warning", message: `Input '${v}' is never used in the algorithm.` });
    }
  }

  // naive infinite-loop detection: while loop whose body assigns nothing from cond vars
  const loopCheck = (stmts: Stmt[]) => {
    for (const s of stmts) {
      if (s.kind === "while" || s.kind === "dowhile") {
        const condVars = exprVars(s.cond);
        const assigns = new Set<string>();
        const collectA = (l: Stmt[]) => l.forEach(x => {
          if (x.kind === "assign") assigns.add(x.target);
          if (x.kind === "input") assigns.add(x.varName);
          if (x.kind === "if") { x.branches.forEach(b => collectA(b.body)); collectA(x.elseBody); }
          if (x.kind === "while" || x.kind === "dowhile") collectA(x.body);
          if (x.kind === "for") collectA(x.body);
        });
        collectA(s.body);
        if (![...condVars].some(v => assigns.has(v))) {
          issues.push({ level: "warning", message: `Loop "${exprToPseudo(s.cond)}" might never end — its condition variables are not changed inside the loop.`, nodeId: s.id });
        }
        loopCheck(s.body);
      }
      if (s.kind === "if") { s.branches.forEach(b => loopCheck(b.body)); loopCheck(s.elseBody); }
      if (s.kind === "for") loopCheck(s.body);
    }
  };
  loopCheck(prog.statements);
  return issues;
}

// ═════════════════════════════════════════════════════════════════════════════
// Flowchart → IR
// ═════════════════════════════════════════════════════════════════════════════

export function flowchartToIR(graph: FlowGraph): { program?: IRProgram; issues: FcIssue[] } {
  const issues = validateFlowchart(graph);
  if (issues.some(i => i.level === "error")) return { issues };

  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const out = new Map<string, FlowEdgeType[]>();
  for (const e of graph.edges) {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source)!.push(e);
  }
  type E = FlowGraph["edges"][number];
  interface FlowEdgeType extends E { }
  const next = (id: string, handle?: string): string | undefined => {
    const es = out.get(id) ?? [];
    const hit = es.find(e => e.sourceHandle === handle) ?? (!handle ? es[0] : undefined);
    return hit?.target;
  };

  const start = graph.nodes.find(n => n.type === "start")!;
  const consumed = new Set<string>();

  const parseLoop = (node: FlowNode): { varName: string; from: Expr; to: Expr } | null => {
    try {
      if (node.loop) return { varName: node.loop.varName, from: parseExpr(node.loop.from), to: parseExpr(node.loop.to) };
      const m = node.label.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s+(?:TO|to)\s+(.+)$/);
      if (m) return { varName: m[1], from: parseExpr(m[2]), to: parseExpr(m[3]) };
    } catch { /* fallthrough */ }
    return null;
  };

  const reach = (from: string | undefined, stop: Set<string>): Map<string, number> => {
    const dist = new Map<string, number>();
    if (!from) return dist;
    const q: [string, number][] = [[from, 0]];
    while (q.length) {
      const [id, d] = q.shift()!;
      if (dist.has(id) || stop.has(id)) continue;
      dist.set(id, d);
      for (const e of out.get(id) ?? []) q.push([e.target, d + 1]);
    }
    return dist;
  };

  const findMerge = (a?: string, b?: string): string | undefined => {
    const ra = reach(a, new Set()), rb = reach(b, new Set());
    let best: string | undefined, bestScore = Infinity;
    for (const [id, da] of ra) {
      const db = rb.get(id);
      if (db === undefined) continue;
      const score = da + db + Math.abs(da - db);
      if (score < bestScore) { bestScore = score; best = id; }
    }
    return best;
  };

  const stmtFrom = (node: FlowNode): Stmt | null => {
    const label = node.label.trim();
    try {
      switch (node.type) {
        case "input": {
          const name = label.replace(/^(INPUT|READ)\s*/i, "").trim();
          return /^[A-Za-z_]\w*$/.test(name) ? { id: node.id, kind: "input", varName: name } : null;
        }
        case "output": {
          const src = label.replace(/^(OUTPUT|PRINT|DISPLAY)\s*/i, "");
          const exprs = splitTopLevel(src).map(s => parseExpr(s.trim()));
          return exprs.length ? { id: node.id, kind: "output", exprs } : null;
        }
        case "process": {
          const m = label.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|←|:=|<-)\s*(.+)$/);
          if (!m) return null;
          return { id: node.id, kind: "assign", target: m[1], expr: parseExpr(m[2]) };
        }
        case "call": return { id: node.id, kind: "call", name: label.replace(/^CALL\s*/i, "") || "function", args: [] };
        default: return null;
      }
    } catch {
      issues.push({ level: "warning", message: `Cannot parse "${label}" on the ${node.type} node — it was skipped.`, nodeId: node.id });
      return null;
    }
  };

  const walk = (id: string | undefined, stop: Set<string>): Stmt[] => {
    const stmts: Stmt[] = [];
    let cur = id;
    while (cur && !stop.has(cur)) {
      if (consumed.has(cur)) break;
      const node = nodes.get(cur);
      if (!node) break;
      if (node.type === "connector" || node.type === "start") { consumed.add(cur); cur = next(cur); continue; }
      if (node.type === "end") break;

      if (node.type === "decision") {
        consumed.add(cur);
        const tT = next(cur, "true"), fT = next(cur, "false");
        const merge = findMerge(tT, fT);
        const tStop = new Set(stop), fStop = new Set(stop);
        if (merge) { tStop.add(merge); fStop.add(merge); }
        let cond: Expr;
        try { cond = parseExpr(node.label); }
        catch {
          issues.push({ level: "warning", message: `Decision "${node.label}" is not a valid condition.`, nodeId: node.id });
          cond = { kind: "bool", value: true };
        }
        const tb = walk(tT, tStop);
        const fb = walk(fT, fStop);
        stmts.push({ id: node.id, kind: "if", branches: [{ cond, body: tb }], elseBody: fb });
        cur = merge;
        if (cur && (stop.has(cur) || consumed.has(cur))) break;
        continue;
      }

      if (node.type === "while" || node.type === "dowhile" || node.type === "for") {
        consumed.add(cur);
        const bodyHandle = node.type === "while" ? "true" : "body";
        const exitHandle = node.type === "while" ? "false" : "exit";
        const loopStop = new Set(stop); loopStop.add(cur);
        const body = walk(next(cur, bodyHandle), loopStop);
        let cond: Expr = { kind: "bool", value: true };
        if (node.type !== "for") {
          try { cond = parseExpr(node.label); } catch {
            issues.push({ level: "warning", message: `Loop condition "${node.label}" is not valid.`, nodeId: node.id });
          }
        }
        if (node.type === "while") stmts.push({ id: node.id, kind: "while", cond, body });
        else if (node.type === "dowhile") stmts.push({ id: node.id, kind: "dowhile", cond, body });
        else {
          const meta = parseLoop(node);
          if (meta) stmts.push({ id: node.id, kind: "for", varName: meta.varName, from: meta.from, to: meta.to, body });
          else issues.push({ level: "warning", message: `FOR loop "${node.label}" should look like "i = 1 TO n".`, nodeId: node.id });
        }
        cur = next(cur, exitHandle);
        continue;
      }

      consumed.add(cur);
      const s = stmtFrom(node);
      if (s) stmts.push(s);
      cur = next(cur);
    }
    return stmts;
  };

  const stmts = walk(start.id, new Set());
  const program: IRProgram = { statements: stmts, vars: collectVars(stmts) };
  issues.push(...analyzeIR(program));
  return { program, issues };
}

function splitTopLevel(src: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "", inStr: string | null = null;
  for (const c of src) {
    if (inStr) { cur += c; if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'") { inStr = c; cur += c; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// IR → Flowchart (structured, auto-layout, fully editable)
// ═════════════════════════════════════════════════════════════════════════════

interface Exit { id: string; handle?: string; }
interface Built {
  nodes: FlowNode[];
  edges: FlowGraph["edges"];
  entry?: FlowNode;
  exits: Exit[];
  w: number; h: number;
}

export function irToFlowchart(prog: IRProgram): FlowGraph {
  const mk = (type: FlowNodeType, label: string, cx: number, cy: number, id?: string, loop?: FlowNode["loop"]): FlowNode =>
    ({ id: id ?? uid(), type, label, x: cx, y: cy, loop });
  const edge = (source: string, target: string, sourceHandle?: string, label?: string) =>
    ({ id: uid(), source, target, sourceHandle, label });

  const offset = (b: Built, dx: number, dy: number) => {
    for (const n of b.nodes) { n.x += dx; n.y += dy; }
  };

  function layoutSeq(stmts: Stmt[], cx: number, y: number): Built {
    const all: Built = { nodes: [], edges: [], exits: [], w: 170, h: 0 };
    let curY = y;
    let prevExits: Exit[] | null = null;
    for (const s of stmts) {
      const b = layoutStmt(s, cx, curY);
      if (!all.entry && b.entry) all.entry = b.entry;
      if (prevExits && b.entry) for (const e of prevExits) all.edges.push(edge(e.id, b.entry.id, e.handle));
      prevExits = b.exits.length ? b.exits : prevExits;
      all.nodes.push(...b.nodes);
      all.edges.push(...b.edges);
      if (b.exits.length) all.exits = b.exits;
      curY += b.h + GAP_Y;
      all.w = Math.max(all.w, b.w);
    }
    all.h = Math.max(curY - y - GAP_Y, 0);
    return all;
  }

  function layoutStmt(s: Stmt, cx: number, y: number): Built {
    switch (s.kind) {
      case "input": case "output": case "assign": case "call": {
        const t: FlowNodeType = s.kind === "assign" ? "process" : s.kind === "call" ? "call" : s.kind;
        const label =
          s.kind === "input" ? `INPUT ${s.varName}` :
          s.kind === "output" ? `OUTPUT ${s.exprs.map(exprToPseudo).join(", ")}` :
          s.kind === "call" ? s.name :
          `${s.target} = ${exprToPseudo(s.expr)}`;
        const [w, h] = NODE_SIZES[t];
        const n = mk(t, label, cx, y + h / 2, s.id);
        return { nodes: [n], edges: [], entry: n, exits: [{ id: n.id }], w, h };
      }
      case "if": return layoutIf(s, cx, y);
      case "while": case "dowhile": case "for": return layoutLoop(s, cx, y);
    }
  }

  function layoutIf(s: Extract<Stmt, { kind: "if" }>, cx: number, y: number): Built {
    const [dw, dh] = NODE_SIZES.decision;
    const d = mk("decision", exprToPseudo(s.branches[0].cond), cx, y + dh / 2, s.id);
    const out: Built = { nodes: [d], edges: [], entry: d, exits: [], w: dw, h: dh };
    const bodyY = y + dh + GAP_Y;
    const hasElse = s.elseBody.length > 0 || s.branches.length > 1;
    const tBuilt = layoutSeq(s.branches[0].body, 0, 0);

    if (hasElse) {
      const fBuilt: Built = s.branches.length > 1
        ? layoutIf({ ...s, branches: s.branches.slice(1) } , 0, 0)
        : layoutSeq(s.elseBody, 0, 0);
      const lx = cx - (dw / 2 + GUTTER + (tBuilt.w || 214) / 2);
      const rx = cx + (dw / 2 + GUTTER + (fBuilt.w || 214) / 2);
      offset(tBuilt, lx, bodyY); offset(fBuilt, rx, bodyY);
      if (tBuilt.entry) {
        out.edges.push(edge(d.id, tBuilt.entry.id, "true", "TRUE"));
        out.nodes.push(...tBuilt.nodes); out.edges.push(...tBuilt.edges);
      }
      if (fBuilt.entry) {
        out.edges.push(edge(d.id, fBuilt.entry.id, "false", "FALSE"));
        out.nodes.push(...fBuilt.nodes); out.edges.push(...fBuilt.edges);
      }
      const bottomY = bodyY + Math.max(tBuilt.h, fBuilt.h) + GAP_Y;
      const m = mk("connector", "", cx, bottomY + 13);
      out.nodes.push(m);
      if (tBuilt.entry) for (const e of tBuilt.exits) out.edges.push(edge(e.id, m.id, e.handle));
      else out.edges.push(edge(d.id, m.id, "true", "TRUE"));
      for (const e of fBuilt.entry ? fBuilt.exits : []) out.edges.push(edge(e.id, m.id, e.handle));
      if (!fBuilt.entry) out.edges.push(edge(d.id, m.id, "false", "FALSE"));
      out.exits = [{ id: m.id }];
      out.h = bottomY + 26 - y;
      out.w = (dw / 2 + GUTTER + Math.max(tBuilt.w || 214, fBuilt.w || 214) / 2) * 2;
      return out;
    }

    // no else: TRUE branch on the left, FALSE straight down to merge
    const lx = cx - (dw / 2 + GUTTER + (tBuilt.w || 214) / 2);
    offset(tBuilt, lx, bodyY);
    const bottomY = bodyY + tBuilt.h + GAP_Y;
    const m = mk("connector", "", cx, bottomY + 13);
    out.nodes.push(m);
    if (tBuilt.entry) {
      out.edges.push(edge(d.id, tBuilt.entry.id, "true", "TRUE"));
      out.nodes.push(...tBuilt.nodes); out.edges.push(...tBuilt.edges);
      for (const e of tBuilt.exits) out.edges.push(edge(e.id, m.id, e.handle));
    } else {
      out.edges.push(edge(d.id, m.id, "true", "TRUE"));
    }
    out.edges.push(edge(d.id, m.id, "false", "FALSE"));
    out.exits = [{ id: m.id }];
    out.h = bottomY + 26 - y;
    out.w = dw / 2 + GUTTER + (tBuilt.w || 214) + dw / 2;
    return out;
  }

  function layoutLoop(s: Stmt, cx: number, y: number): Built {
    const kind = s.kind as "while" | "dowhile" | "for";
    const [lw, lh] = NODE_SIZES[kind];
    const label = kind === "for"
      ? `${(s as { varName: string }).varName} = ${exprToPseudo((s as { from: Expr }).from)} TO ${exprToPseudo((s as { to: Expr }).to)}`
      : exprToPseudo((s as { cond: Expr }).cond);
    const loopMeta = kind === "for"
      ? { varName: (s as { varName: string }).varName, from: exprToPseudo((s as { from: Expr }).from), to: exprToPseudo((s as { to: Expr }).to) }
      : kind === "dowhile" || kind === "while" ? undefined : undefined;
    const L = mk(kind === "for" ? "for" : kind, label, cx, y + lh / 2, s.id, loopMeta ?? undefined);
    if (kind === "dowhile") L.type = "dowhile";
    if (kind === "while") L.type = "while";
    const out: Built = { nodes: [L], edges: [], entry: L, exits: [], w: lw, h: lh };
    const body = layoutSeq((s as { body: Stmt[] }).body, 0, 0);
    const bx = cx + lw / 2 + GUTTER + (body.w || 214) / 2;
    const by = y + lh + GAP_Y;
    offset(body, bx, by);
    const bodyHandle = kind === "while" ? "true" : "body";
    const exitHandle = kind === "while" ? "false" : "exit";
    if (body.entry) {
      out.edges.push(edge(L.id, body.entry.id, bodyHandle, kind === "while" ? "TRUE" : "LOOP"));
      out.nodes.push(...body.nodes); out.edges.push(...body.edges);
      for (const e of body.exits) out.edges.push(edge(e.id, L.id, e.handle));
      out.h = Math.max(by + body.h, y + lh) - y;
      out.w = lw / 2 + GUTTER + (body.w || 214) + lw / 2;
    }
    out.exits = [{ id: L.id, handle: exitHandle }];
    return out;
  }

  // top level
  const [sw, sh] = NODE_SIZES.start;
  const allNodes: FlowNode[] = [];
  const allEdges: FlowGraph["edges"] = [];
  const startN = mk("start", "START", 0, sh / 2, "__start");
  allNodes.push(startN);
  const body = layoutSeq(prog.statements.filter(s => s.kind !== "if" || true), 0, sh + GAP_Y);
  allNodes.push(...body.nodes);
  allEdges.push(...body.edges);
  if (body.entry) allEdges.push(edge(startN.id, body.entry.id));
  let maxY = sh;
  for (const n of allNodes) maxY = Math.max(maxY, n.y + NODE_SIZES[n.type][1] / 2);
  const [, eh] = NODE_SIZES.end;
  const endN = mk("end", "END", 0, maxY + GAP_Y + eh / 2, "__end");
  allNodes.push(endN);
  if (body.exits.length) for (const e of body.exits) allEdges.push(edge(e.id, endN.id, e.handle));
  else if (!body.entry) allEdges.push(edge(startN.id, endN.id));
  void sw;
  return { nodes: allNodes, edges: allEdges };
}
