"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  Handle, Position, addEdge, applyEdgeChanges, applyNodeChanges,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps,
  useReactFlow, MarkerType,
} from "@xyflow/react";
import {
  CirclePlay, RectangleHorizontal, Diamond, Hexagon,
  CircleDot, CircleStop, Trash2, Copy, Undo2, Redo2, Sparkles,
  LogIn, LogOut,
} from "lucide-react";
import type { FlowGraph, FlowNode, FlowNodeType } from "@/lib/ir/types";
import { NODE_SIZES } from "@/lib/ir/flowchart";
import { uid } from "@/lib/ir/types";

// ─────────────────────────────────────────────────────────────────────────────

type FcData = { ft: FlowNodeType; label: string; w: number; h: number } & Record<string, unknown>;
type RFN = Node<FcData>;

const HANDLES: Record<FlowNodeType, { "in"?: Position; sources: { id: string; pos: Position; style?: React.CSSProperties }[] }> = {
  start: { sources: [{ id: "out", pos: Position.Bottom }] },
  end: { in: Position.Top, sources: [] },
  process: { in: Position.Top, sources: [{ id: "out", pos: Position.Bottom }] },
  input: { in: Position.Top, sources: [{ id: "out", pos: Position.Bottom }] },
  output: { in: Position.Top, sources: [{ id: "out", pos: Position.Bottom }] },
  call: { in: Position.Top, sources: [{ id: "out", pos: Position.Bottom }] },
  connector: { in: Position.Top, sources: [{ id: "out", pos: Position.Bottom }] },
  decision: {
    in: Position.Top,
    sources: [
      { id: "true", pos: Position.Left, style: { background: "#10b981" } },
      { id: "false", pos: Position.Right, style: { background: "#f87171" } },
    ],
  },
  while: {
    in: Position.Top,
    sources: [
      { id: "true", pos: Position.Right, style: { background: "#10b981" } },
      { id: "false", pos: Position.Bottom, style: { background: "#f87171" } },
    ],
  },
  for: {
    in: Position.Top,
    sources: [
      { id: "body", pos: Position.Right, style: { background: "#a78bfa" } },
      { id: "exit", pos: Position.Bottom },
    ],
  },
  dowhile: {
    in: Position.Top,
    sources: [
      { id: "body", pos: Position.Right, style: { background: "#a78bfa" } },
      { id: "exit", pos: Position.Bottom },
    ],
  },
};

function nodeClass(ft: FlowNodeType): string {
  switch (ft) {
    case "start": return "fc-node fc-start";
    case "end": return "fc-node fc-end";
    case "input": case "output": return "fc-node fc-io";
    case "decision": return "fc-node fc-decision";
    case "while": case "for": case "dowhile": return "fc-node fc-loop";
    case "connector": return "fc-node fc-connector";
    default: return "fc-node fc-process";
  }
}

function FlowNodeEl({ data, selected }: NodeProps<RFN>) {
  const cfg = HANDLES[data.ft];
  const cls = nodeClass(data.ft);
  return (
    <div className={cls + (selected ? " selected" : "")} style={{ width: data.w, height: data.h }}>
      {data.ft === "decision" && <div className="fc-diamond" />}
      {(data.ft === "while" || data.ft === "for" || data.ft === "dowhile") && <div className="fc-hex" />}
      <span className={data.ft === "decision" || data.ft === "for" || data.ft === "while" || data.ft === "dowhile" ? "fc-label" : undefined}>
        {data.ft === "decision"
          ? data.label
          : <span>{data.label}</span>}
      </span>
      {cfg.in && <Handle type="target" position={cfg.in} id="in" />}
      {cfg.sources.map(s => (
        <Handle key={s.id} type="source" position={s.pos} id={s.id} style={s.style} />
      ))}
    </div>
  );
}

const nodeTypes = { fc: FlowNodeEl };

// ── Palette ──────────────────────────────────────────────────────────────────

const PALETTE: { type: FlowNodeType; label: string; name: string; icon: React.ReactNode; hint: string }[] = [
  { type: "start", label: "START", name: "Start", icon: <CirclePlay size={13} />, hint: "Where the algorithm begins" },
  { type: "input", label: "INPUT x", name: "Input", icon: <LogIn size={13} />, hint: "Read a value from the user" },
  { type: "output", label: "OUTPUT x", name: "Output", icon: <LogOut size={13} />, hint: "Show a value to the user" },
  { type: "process", label: "x = 0", name: "Process", icon: <RectangleHorizontal size={13} />, hint: "Assignment / calculation" },
  { type: "decision", label: "x > 0", name: "Decision", icon: <Diamond size={13} />, hint: "IF — branches on TRUE / FALSE" },
  { type: "for", label: "i = 1 TO n", name: "For Loop", icon: <Hexagon size={13} />, hint: "Counted repetition" },
  { type: "while", label: "x < n", name: "While Loop", icon: <Hexagon size={13} />, hint: "Repeat while condition is TRUE" },
  { type: "dowhile", label: "x < n", name: "Do-While", icon: <Hexagon size={13} />, hint: "Run once, then repeat while TRUE" },
  { type: "end", label: "END", name: "End", icon: <CircleStop size={13} />, hint: "Where the algorithm finishes" },
];

// ─────────────────────────────────────────────────────────────────────────────

export interface FlowCanvasProps {
  graph: FlowGraph;
  graphKey: number;
  onChange: (g: FlowGraph) => void;
  syncId?: string | null;
  execNode?: string | null;
  onSelectNode?: (id: string | null) => void;
  onAutoArrange: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

function Inner(props: FlowCanvasProps) {
  const { graph, graphKey, onChange, syncId, execNode, onSelectNode, onAutoArrange } = props;
  const [nodes, setNodes] = useState<RFN[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const undo = useRef<FlowGraph[]>([]);
  const redo = useRef<FlowGraph[]>([]);
  const rf = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  // external graph → RF state
  useEffect(() => {
    const rfNodes: RFN[] = graph.nodes.map(n => {
      const [w, h] = NODE_SIZES[n.type];
      return {
        id: n.id, type: "fc",
        position: { x: n.x - w / 2, y: n.y - h / 2 },
        data: { ft: n.type, label: n.label, w, h },
        selected: n.id === selId,
      };
    });
    const rfEdges: Edge[] = graph.edges.map(e => ({
      id: e.id, source: e.source, target: e.target,
      sourceHandle: e.sourceHandle ?? "out",
      type: "smoothstep",
      label: e.label,
      labelStyle: { fill: "var(--accent)", fontWeight: 700, fontSize: 10, letterSpacing: "0.06em" },
      labelBgStyle: { fill: "var(--bg)", fillOpacity: 0.85 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "var(--muted)" },
    }));
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [graph, graphKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((g: FlowGraph, pushUndo = true) => {
    if (pushUndo) { undo.current.push(structuredClone(graph)); redo.current = []; }
    onChange(g);
  }, [graph, onChange]);

  const doUndo = () => {
    const prev = undo.current.pop();
    if (!prev) return;
    redo.current.push(structuredClone(graph));
    onChange(prev);
  };
  const doRedo = () => {
    const nxt = redo.current.pop();
    if (!nxt) return;
    undo.current.push(structuredClone(graph));
    onChange(nxt);
  };

  const rfToGraph = useCallback((ns: RFN[], es: Edge[]): FlowGraph => {
    const loopById = new Map(graph.nodes.map(n => [n.id, n.loop]));
    const typeById = new Map(graph.nodes.map(n => [n.id, n.type]));
    return {
      nodes: ns.map(n => ({
        id: n.id,
        type: (n.data as FcData).ft ?? typeById.get(n.id) ?? "process",
        label: (n.data as FcData).label,
        x: n.position.x + ((n.data as FcData).w ?? 200) / 2,
        y: n.position.y + ((n.data as FcData).h ?? 60) / 2,
        loop: loopById.get(n.id),
      })),
      edges: es.map(e => ({
        id: e.id, source: e.source, target: e.target,
        sourceHandle: e.sourceHandle === "out" ? undefined : e.sourceHandle ?? undefined,
        label: typeof e.label === "string" ? e.label : undefined,
      })),
    };
  }, [graph.nodes]);

  const onNodesChange = useCallback((changes: NodeChange<RFN>[]) => {
    const removed = changes.filter(c => c.type === "remove");
    const next = applyNodeChanges(changes, nodes);
    if (removed.length) {
      const ids = new Set(removed.map(r => r.id));
      const es = edges.filter(e => !ids.has(e.source) && !ids.has(e.target));
      setEdges(es);
      setNodes(next);
      commit(rfToGraph(next, es));
      return;
    }
    setNodes(next);
  }, [nodes, edges, commit, rfToGraph]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = changes.filter(c => c.type === "remove");
    const next = applyEdgeChanges(changes, edges);
    if (removed.length) commit(rfToGraph(nodes, next));
    setEdges(next);
  }, [edges, commit, nodes, rfToGraph]);

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    const srcNode = graph.nodes.find(n => n.id === conn.source);
    const tgtNode = graph.nodes.find(n => n.id === conn.target);
    if (!srcNode || !tgtNode) return;
    if (tgtNode.type === "start" || srcNode.type === "end") return;

    let handle = conn.sourceHandle ?? "out";
    if (srcNode.type === "decision" || srcNode.type === "while") {
      if (handle !== "true" && handle !== "false") return;
    }
    if (srcNode.type === "for" || srcNode.type === "dowhile") {
      if (handle !== "body" && handle !== "exit") return;
    }
    let label: string | undefined;
    if ((srcNode.type === "decision" || srcNode.type === "while") && handle === "true") label = "TRUE";
    if ((srcNode.type === "decision" || srcNode.type === "while") && handle === "false") label = "FALSE";

    // one outgoing edge per handle (or per node for simple nodes)
    const filtered = edges.filter(e => !(e.source === conn.source && (e.sourceHandle ?? "out") === handle));
    const edge: Edge = {
      id: uid(), source: conn.source, target: conn.target,
      sourceHandle: handle, type: "smoothstep", label,
      labelStyle: { fill: "var(--accent)", fontWeight: 700, fontSize: 10 },
      labelBgStyle: { fill: "var(--bg)", fillOpacity: 0.85 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "var(--muted)" },
    };
    const next = addEdge(edge, filtered);
    setEdges(next);
    commit(rfToGraph(nodes, next));
  }, [graph.nodes, edges, commit, nodes, rfToGraph]);

  const addNode = (type: FlowNodeType, label: string) => {
    const center = rf.screenToFlowPosition({
      x: (wrapRef.current?.clientWidth ?? 600) / 2,
      y: (wrapRef.current?.clientHeight ?? 400) / 2,
    });
    const [w, h] = NODE_SIZES[type];
    const n: FlowNode = {
      id: uid(), type, label,
      x: center.x + (Math.random() * 60 - 30), y: center.y + (Math.random() * 60 - 30),
      loop: type === "for" ? { varName: "i", from: "1", to: "n" } : undefined,
    };
    void w; void h;
    commit({ nodes: [...graph.nodes, n], edges: graph.edges });
    setSelId(n.id);
  };

  const duplicateNode = (id: string) => {
    const src = graph.nodes.find(n => n.id === id);
    if (!src || src.type === "start" || src.type === "end") return;
    const copy: FlowNode = { ...src, id: uid(), x: src.x + 60, y: src.y + 60 };
    commit({ nodes: [...graph.nodes, copy], edges: graph.edges });
  };

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    commit({
      nodes: graph.nodes.map(n => n.id === id ? { ...n, ...patch } : n),
      edges: graph.edges,
    });
  };

  const deleteNode = (id: string) => {
    commit({
      nodes: graph.nodes.filter(n => n.id !== id),
      edges: graph.edges.filter(e => e.source !== id && e.target !== id),
    });
    setSelId(null);
  };

  // highlight classes
  const displayNodes = useMemo(() => nodes.map(n => ({
    ...n,
    className: n.id === execNode ? "hl-exec-wrap" : n.id === syncId ? "hl-sync-wrap" : "",
    data: { ...n.data },
  })), [nodes, syncId, execNode]);

  // keyboard shortcuts
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); doRedo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selId) { e.preventDefault(); duplicateNode(selId); }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  });

  const sel = selId ? graph.nodes.find(n => n.id === selId) : null;
  const [localLabel, setLocalLabel] = useState("");
  useEffect(() => { setLocalLabel(sel?.label ?? ""); }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrapRef} className="w-full h-full flex relative outline-none" tabIndex={0}>
      {/* palette */}
      {props.paletteOpen && (
        <div className="absolute left-2 top-2 bottom-2 z-10 w-[168px] card p-2 overflow-y-auto fade-up bg-panel">
          <div className="text-[10px] font-bold tracking-[0.12em] text-mut px-1 mb-2">NODE PALETTE</div>
          <div className="space-y-1">
            {PALETTE.map(p => (
              <button
                key={p.type + p.label}
                onClick={() => addNode(p.type, p.label)}
                title={p.hint}
                className="w-full flex items-center gap-2 px-2 py-[7px] rounded-lg border border-line bg-panel2 hover:border-[color:var(--muted)] text-[12px] font-medium transition-colors"
              >
                <span className="text-accent2">{p.icon}</span>{p.name}
              </button>
            ))}
          </div>
          <div className="mt-3 text-[10.5px] text-mut leading-relaxed px-1">
            Click a node to add it to the canvas, then drag it into place and connect the handles (dots).
          </div>
        </div>
      )}

      {/* toolbar */}
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button className="btn btn-sm" onClick={() => props.setPaletteOpen(!props.paletteOpen)} title="Toggle node palette">
          <CircleDot size={13} /> Nodes
        </button>
        <button className="btn btn-sm" onClick={doUndo} title="Undo (Ctrl+Z)"><Undo2 size={13} /></button>
        <button className="btn btn-sm" onClick={doRedo} title="Redo (Ctrl+Y)"><Redo2 size={13} /></button>
        <button className="btn btn-sm btn-blue" onClick={onAutoArrange} title="Re-layout from the algorithm model">
          <Sparkles size={13} /> Auto Arrange
        </button>
      </div>

      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={(_, __, ns) => { if (ns.length) commit(rfToGraph(nodes, edges), true); }}
        onSelectionChange={({ nodes: sns }) => {
          const id = sns[0]?.id ?? null;
          setSelId(id);
          onSelectNode?.(id);
        }}
        onNodeClick={(_, n) => { setSelId(n.id); onSelectNode?.(n.id); }}
        onPaneClick={() => { setSelId(null); onSelectNode?.(null); }}
        deleteKeyCode={["Delete", "Backspace"]}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.05 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        multiSelectionKeyCode="Shift"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--line)" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap pannable zoomable position="bottom-right" nodeColor="#334" maskColor="rgba(10,13,20,.7)" style={{ width: 120, height: 84 }} />
      </ReactFlow>

      {/* inspector */}
      {sel && (
        <div className="absolute right-2 top-12 z-10 w-[240px] card p-3 fade-up bg-panel" onKeyDown={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <span className="chip chip-blue uppercase">{sel.type}</span>
            <div className="flex gap-1">
              <button className="btn btn-ghost btn-sm" onClick={() => duplicateNode(sel.id)} title="Duplicate (Ctrl+D)"><Copy size={12} /></button>
              <button className="btn btn-ghost btn-sm text-dangerc" onClick={() => deleteNode(sel.id)} title="Delete"><Trash2 size={12} /></button>
            </div>
          </div>
          {sel.type !== "start" && sel.type !== "end" && sel.type !== "connector" ? (
            <>
              <label className="text-[10px] font-bold tracking-[0.1em] text-mut">LABEL</label>
              <textarea
                className="textarea mt-1 mono text-[12px]"
                rows={2}
                value={localLabel}
                onChange={e => setLocalLabel(e.target.value)}
                onBlur={() => { if (localLabel.trim()) updateNode(sel.id, { label: localLabel.trim() }); }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (localLabel.trim()) updateNode(sel.id, { label: localLabel.trim() }); } }}
              />
              {sel.type === "for" && (
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {(["varName", "from", "to"] as const).map(k => (
                    <div key={k}>
                      <label className="text-[9px] text-mut uppercase">{k === "varName" ? "var" : k}</label>
                      <input
                        className="input mono text-[11px] px-1.5 py-1 mt-0.5"
                        value={sel.loop?.[k] ?? ""}
                        onChange={e => {
                          const loop = { varName: "i", from: "1", to: "n", ...sel.loop, [k]: e.target.value };
                          updateNode(sel.id, { loop, label: `${loop.varName} = ${loop.from} TO ${loop.to}` });
                          setLocalLabel(`${loop.varName} = ${loop.from} TO ${loop.to}`);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10.5px] text-mut mt-2 leading-relaxed">
                {sel.type === "decision" && "Condition — write with operators like >=, <>, AND, OR. Connect the green (TRUE) and red (FALSE) handles."}
                {sel.type === "process" && "Assignment, e.g. total = total + i"}
                {sel.type === "input" && "Format: INPUT namaVariabel"}
                {sel.type === "output" && "Format: OUTPUT ekspresi, e.g. OUTPUT \"Lulus\" or OUTPUT total"}
                {sel.type === "while" && "Repeat while the condition is TRUE. Green handle = loop body, red = exit."}
                {sel.type === "for" && "Counted loop. Purple handle = loop body (it must loop back here), bottom = exit."}
                {sel.type === "dowhile" && "Body runs once first. Purple handle = body, bottom = exit."}
                {sel.type === "call" && "Function call step."}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-mut">{sel.type === "connector" ? "Merge point of two branches." : `${sel.type} marker. Every flowchart needs exactly one START and at least one END.`}</p>
          )}
        </div>
      )}
      <style jsx global>{`
        .hl-exec-wrap .fc-node { border-color: var(--accent) !important; box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent), 0 0 26px color-mix(in srgb, var(--accent) 30%, transparent) !important; }
        .hl-sync-wrap .fc-node { border-color: var(--violet) !important; box-shadow: 0 0 0 4px color-mix(in srgb, var(--violet) 30%, transparent) !important; }
        .react-flow__edge-text { fill: var(--accent) !important; }
      `}</style>
    </div>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
