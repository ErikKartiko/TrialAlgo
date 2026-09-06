"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Play, FlaskConical, Workflow, ScrollText, Code2, TerminalSquare,
  ListChecks, Footprints, BarChart3, Bot, History as HistoryIcon, ChevronDown,
  ChevronRight, Maximize2, Minimize2, Download, Upload, Save, Check, Loader2,
  RefreshCw, GitBranch, PanelRightClose, PanelRightOpen, Wand2,
  FileJson, FileText, Printer, Columns2,
} from "lucide-react";
import type { FlowGraph, IRProgram, Language, LineMap, TestCase, ExecutionResult } from "@/lib/ir/types";
import { LANGUAGES, uid } from "@/lib/ir/types";
import { flowchartToIR, irToFlowchart, type FcIssue } from "@/lib/ir/flowchart";
import { irToPseudocode, parsePseudocode, type PseudoError } from "@/lib/ir/pseudocode";
import { irToCode } from "@/lib/ir/codegen";
import { codeToIR } from "@/lib/ir/codeparse";
import { analyzeProgram, type Analysis } from "@/lib/ir/analyzer";
import type { NLResult, TutorMode, TutorReply } from "@/lib/ir/tutor";
import type { ProjectData, ProjectVersion, TransformRecord } from "@/lib/project";
import FlowCanvas from "./fcanvas";
import SrcEditor, { type EditorLang } from "./srceditor";
import {
  ConsolePanel, TestsPanel, VizPanel, AnalysisPanel, TutorPanel, HistoryPanel,
  LangTabs, mapLineForStmt, type TestResultRow,
} from "./panels";

type FocusPanel = "flow" | "pseudo" | "code";
type BottomTab = "console" | "tests" | "viz" | "analysis" | "tutor" | "history";

const logEvent = (kind: string, detail = "", projectId?: string) => {
  fetch("/api/events", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, detail, projectId }),
  }).catch(() => { });
};

const editorLang = (l: Language): EditorLang => (l === "python" ? "python" : "clike");

export default function Playground({ id, initialFocus }: { id: string; initialFocus?: string }) {
  // ─── project state ───
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [graph, setGraph] = useState<FlowGraph>({ nodes: [], edges: [] });
  const [graphKey, setGraphKey] = useState(0);
  const [pseudo, setPseudo] = useState("START\n\nEND");
  const [ir, setIr] = useState<IRProgram | null>(null);
  const [pseudoMap, setPseudoMap] = useState<LineMap>({});
  const [codes, setCodes] = useState<Partial<Record<Language, { code: string; map: LineMap }>>>({});
  const [overridden, setOverridden] = useState<Set<Language>>(new Set());
  const [lang, setLang] = useState<Language>("cpp");
  const [tests, setTests] = useState<TestCase[]>([]);
  const [history, setHistory] = useState<TransformRecord[]>([]);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [irOrigin, setIrOrigin] = useState<string>("flowchart");

  // ─── UI state ───
  const [issues, setIssues] = useState<FcIssue[]>([]);
  const [parseErrors, setParseErrors] = useState<PseudoError[]>([]);
  const [syncId, setSyncId] = useState<string | null>(null);
  const [bottom, setBottom] = useState<BottomTab>("console");
  const [collapsed, setCollapsed] = useState<Set<FocusPanel>>(new Set());
  const [maximized, setMaximized] = useState<FocusPanel | "bottom" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [bottomH, setBottomH] = useState(230);
  const [fracs, setFracs] = useState<[number, number, number]>([1.25, 1, 1.15]);

  // ─── execution state ───
  const [stdin, setStdin] = useState("");
  const [exec, setExec] = useState<ExecutionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [vizStep, setVizStep] = useState(0);
  const [testResults, setTestResults] = useState<TestResultRow[] | null>(null);
  const [testScore, setTestScore] = useState<number | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);

  // ─── tutor state ───
  const [tutorLog, setTutorLog] = useState<(TutorReply & { at: number })[]>([]);
  const [tutorBusy, setTutorBusy] = useState(false);
  const [nl, setNl] = useState<NLResult | null>(null);

  const dirtyRef = useRef<() => void>(() => { });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef({ title, problem, graph, pseudo, ir, codes, tests, versions, history });
  stateRef.current = { title, problem, graph, pseudo, ir, codes, tests, versions, history };

  // ─── load project ───
  useEffect(() => {
    (async () => {
      try {
        let pid = id;
        if (id === "latest") {
          const list = await fetch("/api/projects").then(r => r.json());
          const first = (list.projects ?? [])[0];
          if (!first) {
            const created = await fetch("/api/projects", { method: "POST" }).then(r => r.json());
            pid = created.id;
          } else pid = first.id;
        }
        let res = await fetch(`/api/projects/${pid}`);
        if (res.status === 404 && id !== "latest") {
          const list = await fetch("/api/projects").then(r => r.json());
          pid = (list.projects ?? [])[0]?.id ?? pid;
          res = await fetch(`/api/projects/${pid}`);
        }
        const { project } = await res.json();
        if (!project) return;
        applyProject(project);
        setProjectId(project.id);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const applyProject = (p: ProjectData & { updatedAt?: string }) => {
    setTitle(p.title); setProblem(p.problem);
    setGraph(p.flowchart); setGraphKey(k => k + 1);
    setPseudo(p.pseudocode);
    setIr(p.ir ?? null);
    setCodes(p.codes ?? {});
    setTests(p.tests ?? []);
    setVersions(p.versions ?? []);
    setHistory(p.history ?? []);
    if (p.ir) setPseudoMap(irToPseudocode(p.ir).map);
    setOverridden(new Set());
    setSaveState("saved");
  };

  // ─── autosave ───
  const save = useCallback(async () => {
    if (!projectId) return;
    setSaveState("saving");
    const s = stateRef.current;
    await fetch(`/api/projects/${projectId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: s.title, problem: s.problem, flowchart: s.graph, pseudocode: s.pseudo,
        ir: s.ir, codes: s.codes, tests: s.tests, versions: s.versions, history: s.history,
      }),
    }).catch(() => { });
    setSaveState("saved");
  }, [projectId]);

  const markDirty = useCallback(() => {
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1200);
  }, [save]);
  dirtyRef.current = markDirty;

  const pushHistory = (from: string, to: string, detail?: string) =>
    setHistory(h => [...h.slice(-49), { id: uid(), from, to, detail, at: new Date().toISOString() }]);

  // debounced validation on graph change
  useEffect(() => {
    const t = setTimeout(() => {
      setIssues(flowchartToIR(graph).issues);
    }, 400);
    return () => clearTimeout(t);
  }, [graph]);

  // ─── representation refresh from IR ───
  const refreshFromIR = useCallback((program: IRProgram, origin: string, record = true) => {
    setIr(program);
    setIrOrigin(origin);
    const pg = irToPseudocode(program);
    setPseudo(pg.text);
    setPseudoMap(pg.map);
    setParseErrors([]);
    const nextCodes: Partial<Record<Language, { code: string; map: LineMap }>> = {};
    for (const l of LANGUAGES) {
      const g = irToCode(program, l.id);
      nextCodes[l.id] = { code: g.code, map: g.map };
    }
    setCodes(nextCodes);
    setOverridden(new Set());
    if (record) {
      pushHistory(origin === "flowchart" ? "Flowchart" : origin === "pseudocode" ? "Pseudocode" : origin === "natural language" ? "Natural Language" : "Code", "All representations", "Algorithm IR regenerated");
      logEvent("conversion", `${origin} → IR → flowchart/pseudocode/code`, projectId ?? undefined);
    }
  }, [projectId]);

  // ─── conversion actions ───
  const flowchartToAll = useCallback(() => {
    setConvertBusy(true);
    setTimeout(() => {
      const { program, issues: iss } = flowchartToIR(graph);
      setIssues(iss);
      if (program) {
        const fc = irToFlowchart(program);      // normalize + keep ids
        setGraph(fc); setGraphKey(k => k + 1);
        refreshFromIR(program, "flowchart");
        logEvent("pseudocode_generated", "Flowchart → Pseudocode", projectId ?? undefined);
      }
      setConvertBusy(false);
    }, 30);
  }, [graph, refreshFromIR, projectId]);

  const pseudoToFlow = useCallback(() => {
    setConvertBusy(true);
    setTimeout(() => {
      const res = parsePseudocode(pseudo);
      setParseErrors(res.errors);
      if (res.program && res.ok) {
        refreshFromIR(res.program, "pseudocode");
        const fc = irToFlowchart(res.program);
        setGraph(fc); setGraphKey(k => k + 1);
        setIssues(flowchartToIR(fc).issues);
        logEvent("pseudocode_parsed", "Pseudocode → Flowchart", projectId ?? undefined);
      }
      setConvertBusy(false);
    }, 30);
  }, [pseudo, refreshFromIR, projectId]);

  const codeToAll = useCallback(() => {
    const cur = codes[lang];
    if (!cur) return;
    const { program, warnings } = codeToIR(cur.code, lang);
    if (program && program.statements.length) {
      refreshFromIR(program, "code");
      const fc = irToFlowchart(program);
      setGraph(fc); setGraphKey(k => k + 1);
      setIssues(flowchartToIR(fc).issues);
      if (warnings.length) setIssues(prev => [...prev, ...warnings.map(w => ({ level: "warning" as const, message: `Code import: ${w}` }))]);
    } else {
      setIssues(prev => [...prev, { level: "warning", message: `Could not recognize algorithm statements in the ${lang} code. Supported: input, output, assignment, if/else, for, while.` }]);
    }
  }, [codes, lang, refreshFromIR]);

  const autoArrange = useCallback(() => {
    const { program } = flowchartToIR(graph);
    if (program) {
      const fc = irToFlowchart(program);
      setGraph(fc); setGraphKey(k => k + 1);
    }
  }, [graph]);

  // ─── execution ───
  const ensureIR = useCallback((): IRProgram | null => {
    const hasNodes = graph.nodes.length > 0;
    if (ir) return ir;
    if (hasNodes) {
      const { program } = flowchartToIR(graph);
      if (program) { setIr(program); return program; }
    }
    return ir;
  }, [ir, graph]);

  const run = useCallback(async (goto?: BottomTab) => {
    const program = ensureIR();
    if (goto) setBottom(goto);
    if (!program) {
      setExec({ mode: "demo-ir", ok: false, output: [], steps: [], vars: {}, stepCount: 0, error: "Tidak ada algoritma yang bisa dijalankan. Buat flowchart/pseudocode dulu, lalu konversi ke IR." });
      return;
    }
    setRunning(true);
    logEvent("code_run", "Run via Demo Execution (IR interpreter)", projectId ?? undefined);
    try {
      const r = await fetch("/api/execute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program, input: stdin }),
      });
      const result = await r.json();
      setExec(result);
      setVizStep(0);
    } finally {
      setRunning(false);
    }
  }, [ensureIR, stdin, projectId]);

  const runTests = useCallback(async () => {
    const program = ensureIR();
    if (!program || !tests.length) return;
    setRunningTests(true);
    setBottom("tests");
    try {
      const r = await fetch("/api/execute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program, tests }),
      });
      const data = await r.json();
      setTestResults(data.results ?? []);
      setTestScore(data.score ?? null);
      const passed = (data.results ?? []).filter((x: TestResultRow) => x.passed).length;
      logEvent(passed === (data.results ?? []).length ? "test_passed" : "test_failed", `${passed}/${(data.results ?? []).length} tests passed`, projectId ?? undefined);
    } finally {
      setRunningTests(false);
    }
  }, [ensureIR, tests, projectId]);

  // ─── tutor ───
  const askTutor = useCallback(async (mode: TutorMode, error?: string) => {
    setBottom("tutor");
    setTutorBusy(true);
    logEvent("hint_requested", `AI Tutor mode: ${mode}`, projectId ?? undefined);
    try {
      const r = await fetch("/api/tutor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, program: ensureIR() ?? { statements: [], vars: [] }, problem, error }),
      });
      const reply = await r.json();
      setTutorLog(l => [...l, { ...reply, at: Date.now() }]);
    } finally {
      setTutorBusy(false);
    }
  }, [ensureIR, problem, projectId]);

  const runNL = useCallback(async (desc: string) => {
    setTutorBusy(true);
    try {
      const r = await fetch("/api/tutor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "nl2algo", description: desc }),
      });
      setNl(await r.json());
    } finally {
      setTutorBusy(false);
    }
  }, []);

  const applyNL = useCallback(() => {
    if (!nl) return;
    refreshFromIR(nl.program, "natural language");
    const fc = irToFlowchart(nl.program);
    setGraph(fc); setGraphKey(k => k + 1);
    setProblemsFromNL(nl);
    setNl(null);
    setIssues(flowchartToIR(fc).issues);
    pushHistory("Natural Language", "Algorithm IR", "Generated from problem description");
  }, [nl, refreshFromIR]);
  const setProblemsFromNL = (r: NLResult) => {
    setProblem(`Input: ${r.understanding.input}\nProcess: ${r.understanding.process}\nOutput: ${r.understanding.output}`);
  };

  useEffect(() => { if (ir === null && projectId === null) return; }, [ir, projectId]);

  // mark dirty on core data changes
  useEffect(() => { if (!loading) markDirty(); }, [graph, pseudo, codes, tests, title, problem, versions, history]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── sync helpers ───
  const pseudoHl = useMemo(() => mapLineForStmt(pseudoMap, syncId), [pseudoMap, syncId]);
  const codeHl = useMemo(() => mapLineForStmt(codes[lang]?.map, syncId), [codes, lang, syncId]);

  const execStmtId = exec && exec.steps.length ? exec.steps[Math.min(vizStep, exec.steps.length - 1)]?.stmtId ?? null : null;
  const inViz = bottom === "viz" && exec;
  const execNodeId = inViz ? execStmtId : null;
  const pseudoExecLine = inViz && execStmtId && pseudoMap[execStmtId] ? pseudoMap[execStmtId][0] : null;
  const codeExecLine = inViz && execStmtId && codes[lang]?.map[execStmtId] ? codes[lang]!.map[execStmtId][0] : null;

  const onPseudoLineClick = (line: number) => {
    for (const [sid, [a, b]] of Object.entries(pseudoMap)) {
      if (line >= a && line <= b) { setSyncId(sid === "__start" || sid === "__end" ? null : sid); return; }
    }
    setSyncId(null);
  };
  const onCodeLineClick = (line: number) => {
    const m = codes[lang]?.map;
    if (!m) return;
    for (const [sid, [a, b]] of Object.entries(m)) {
      if (line >= a && line <= b) { setSyncId(sid); return; }
    }
    setSyncId(null);
  };

  const jumpToNode = (nodeId?: string) => {
    if (!nodeId) return;
    setCollapsed(c => { const n = new Set(c); n.delete("flow"); return n; });
    setSyncId(nodeId);
  };

  // ─── export / import ───
  const exportJSON = () => {
    const s = stateRef.current;
    const data = { format: "algostudio-project@1", title: s.title, problem: s.problem, flowchart: s.graph, pseudocode: s.pseudo, ir: s.ir, codes: s.codes, tests: s.tests, versions: s.versions, history: s.history };
    download(`${s.title.replace(/\W+/g, "-").toLowerCase()}.algostudio.json`, JSON.stringify(data, null, 2), "application/json");
  };
  const exportTXT = () => download("pseudocode.txt", stateRef.current.pseudo, "text/plain");
  const exportPrint = () => {
    const s = stateRef.current;
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    w.document.write(`<html><head><title>${esc(s.title)} — AlgoStudio export</title><style>body{font-family:ui-monospace,monospace;padding:32px;max-width:800px;margin:auto}pre{background:#f5f5f5;padding:14px;border-radius:8px;overflow:auto;font-size:12px}h1{font-size:20px}h2{font-size:14px;margin-top:26px;color:#555;text-transform:uppercase;letter-spacing:.1em}</style></head><body>
<h1>${esc(s.title)}</h1><p>${esc(s.problem).replace(/\n/g, "<br>")}</p>
<h2>Pseudocode</h2><pre>${esc(s.pseudo)}</pre>
${LANGUAGES.map(l => s.codes[l.id] ? `<h2>${l.name}</h2><pre>${esc(s.codes[l.id]!.code)}</pre>` : "").join("")}
<p style="color:#888;font-size:11px;margin-top:30px">Exported from AlgoStudio — choose "Save as PDF" in the print dialog.</p>
<script>window.onload = () => window.print()</script></body></html>`);
    w.document.close();
  };
  const download = (name: string, text: string, mime: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJSON = (file: File) => {
    file.text().then(t => {
      const d = JSON.parse(t);
      if (d.format !== "algostudio-project@1" || !d.flowchart?.nodes) {
        alert("File tidak valid — bukan project AlgoStudio (format 'algostudio-project@1').");
        return;
      }
      setTitle(d.title ?? "Imported Project"); setProblem(d.problem ?? "");
      setGraph(d.flowchart); setGraphKey(k => k + 1);
      setPseudo(d.pseudocode ?? "START\n\nEND"); setIr(d.ir ?? null);
      setCodes(d.codes ?? {}); setTests(d.tests ?? []);
      setVersions(d.versions ?? []); setHistory(d.history ?? []);
      if (d.ir) setPseudoMap(irToPseudocode(d.ir).map);
      pushHistory("Import", "Project", file.name);
    }).catch(() => alert("Gagal membaca file — pastikan format JSON valid."));
  };

  // ─── versions ───
  const saveVersion = (label: string) =>
    setVersions(v => [...v, { id: uid(), label, createdAt: new Date().toISOString(), pseudocode: stateRef.current.pseudo }]);
  const restoreVersion = (v: ProjectVersion) => {
    setPseudo(v.pseudocode);
    setTimeout(() => {
      const res = parsePseudocode(v.pseudocode);
      if (res.program && res.ok) {
        refreshFromIR(res.program, "pseudocode");
        const fc = irToFlowchart(res.program);
        setGraph(fc); setGraphKey(k => k + 1);
      }
    }, 30);
  };

  // ─── layout helpers ───
  const toggleCollapse = (p: FocusPanel) =>
    setCollapsed(c => { const n = new Set(c); n.has(p) ? n.delete(p) : n.add(p); return n; });

  const startDragFrac = (idx: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = [...fracs] as [number, number, number];
    const parent = (e.target as HTMLElement).parentElement!;
    const totalW = parent.clientWidth;
    const move = (ev: PointerEvent) => {
      const d = (ev.clientX - startX) / totalW * (start[0] + start[1] + start[2]);
      const next = [...start] as [number, number, number];
      next[idx] = Math.max(0.35, start[idx] + d);
      next[idx + 1] = Math.max(0.35, start[idx + 1] - d);
      setFracs(next);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const startDragBottom = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY; const startH = bottomH;
    const move = (ev: PointerEvent) => setBottomH(Math.min(520, Math.max(140, startH - (ev.clientY - startY))));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const analysis: Analysis | null = useMemo(() => (ir ? analyzeProgram(ir) : null), [ir]);
  const parseErrorLines = useMemo(() => new Set(parseErrors.map(e => e.line - 1)), [parseErrors]);
  const curCode = codes[lang];
  const issueCount = issues.filter(i => i.level === "error").length;

  useEffect(() => {
    if (!initialFocus) return;
    if (initialFocus === "flowchart") { setCollapsed(new Set(["pseudo"])); }
    if (initialFocus === "pseudo") { setCollapsed(new Set(["flow"])); }
    if (initialFocus === "code") { setCollapsed(new Set(["flow"])); }
    if (initialFocus === "run") setBottom("console");
    if (initialFocus === "viz") setBottom("viz");
    if (initialFocus === "analysis") setBottom("analysis");
    if (initialFocus === "tutor") setBottom("tutor");
  }, [initialFocus]);

  const PIPELINE: { n: number; label: string; action?: () => void; active: boolean }[] = [
    { n: 1, label: "Problem", active: false, action: undefined },
    { n: 2, label: "Algorithm", active: false },
    { n: 3, label: "Flowchart", active: !collapsed.has("flow"), action: () => toggleCollapse("flow") },
    { n: 4, label: "Pseudocode", active: !collapsed.has("pseudo"), action: () => toggleCollapse("pseudo") },
    { n: 5, label: "Code", active: !collapsed.has("code"), action: () => toggleCollapse("code") },
    { n: 6, label: "Test", active: bottom === "tests" || bottom === "console", action: () => setBottom("tests") },
    { n: 7, label: "Analyze", active: bottom === "analysis", action: () => setBottom("analysis") },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-mut text-[13px]">
        <Loader2 className="animate-spin" size={16} /> Loading project…
      </div>
    );
  }

  const syncInfo = syncId ? `synced: ${syncId}` : null;

  // ═══════════════════════════ RENDER ═══════════════════════════
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* ── topbar ── */}
      <div className="flex items-center gap-2 px-3 h-12 border-b border-line bg-soft flex-shrink-0 overflow-x-auto">
        <Link href="/projects" className="btn btn-ghost btn-sm flex-shrink-0" title="Back to projects"><ArrowLeft size={15} /></Link>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="bg-transparent font-semibold text-[14px] outline-none border-b border-transparent focus:border-[color:var(--accent-2)] px-1 min-w-[120px] max-w-[280px] flex-shrink-0"
          aria-label="project title"
        />
        <div className="flex items-center gap-1 text-[10.5px] text-mut flex-shrink-0" title={`Algorithm IR is synced with: ${irOrigin}`}>
          {saveState === "saving" ? <><Loader2 size={11} className="animate-spin" /> saving…</> :
            saveState === "dirty" ? <><Save size={11} /> unsaved</> :
              <><Check size={11} className="text-accent" /> saved</>}
        </div>
        {overridden.has(lang) && <span className="chip chip-amber flex-shrink-0" title={`The ${lang} code was manually edited — demo runs still execute the algorithm model (IR).`}>manual edits</span>}
        <div className="flex-1" />
        <button className="btn btn-sm btn-primary" onClick={() => run("console")} disabled={running}><Play size={13} /> Run</button>
        <button className="btn btn-sm" onClick={runTests} disabled={runningTests || !tests.length}><FlaskConical size={13} /> Test {tests.length ? `(${tests.length})` : ""}</button>
        <button className="btn btn-sm" onClick={() => { run("viz"); }}><Footprints size={13} /> Visualize</button>
        <button className="btn btn-sm" onClick={() => askTutor("hint")}><Bot size={13} /> Tutor</button>
        <MenuButton icon={<Download size={13} />} label="Export">
          <MenuItem onClick={exportJSON}><FileJson size={13} /> Export JSON</MenuItem>
          <MenuItem onClick={exportTXT}><FileText size={13} /> Pseudocode TXT</MenuItem>
          <MenuItem onClick={exportPrint}><Printer size={13} /> Print / PDF…</MenuItem>
          <label className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-panel2 rounded-md cursor-pointer">
            <Upload size={13} /> Import JSON
            <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && importJSON(e.target.files[0])} />
          </label>
          <MenuItem onClick={() => {
            sessionStorage.setItem("algostudio-compare", JSON.stringify({ title, codes: stateRef.current.codes }));
            window.open("/compare", "_blank");
          }}><Columns2 size={13} /> Compare Languages</MenuItem>
        </MenuButton>
      </div>

      {/* ── problem + pipeline ── */}
      <div className="border-b border-line bg-soft/60 px-3 py-1.5 flex items-center gap-3 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-[11px] text-mut flex-shrink-0" title={problem}>
          <GitBranch size={12} className="text-accent2" />
          <span className="truncate max-w-[340px]">{problem ? problem.split("\n")[0] : "No problem statement yet — add one via AI Tutor → Describe your problem."}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 flex-shrink-0">
          {PIPELINE.map((p, i) => (
            <div key={p.n} className="flex items-center gap-1">
              <button
                onClick={p.action}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors ${p.active ? "text-accent2" : "text-mut hover:text-app"}`}
              >
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] ${p.active ? "border-[color:var(--accent-2)] bg-[color:color-mix(in_srgb,var(--accent-2)_15%,transparent)]" : "border-line"}`}>{p.n}</span>
                {p.label}
              </button>
              {i < PIPELINE.length - 1 && <ChevronRight size={10} className="text-mut/50" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── main panels ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* FLOWCHART */}
        <Panel
          name="flow" collapsed={collapsed.has("flow")} frac={fracs[0]}
          maximized={maximized === "flow"} anyMax={maximized !== null}
          onCollapse={() => toggleCollapse("flow")}
          onMax={() => setMaximized(maximized === "flow" ? null : "flow")}
          icon={<Workflow size={13} className="text-violetc" />}
          title="Flowchart"
          badge={issueCount ? <span className="chip chip-red">{issueCount} error{issueCount > 1 ? "s" : ""}</span> : <span className="chip chip-green">valid</span>}
          actions={
            <>
              <button className="btn btn-sm" onClick={() => { setIssues(flowchartToIR(graph).issues); setBottom("analysis"); }}>Validate</button>
              <button className="btn btn-sm btn-blue" onClick={flowchartToAll} disabled={convertBusy} title="Flowchart → Algorithm IR → Pseudocode + all languages">
                <RefreshCw size={12} className={convertBusy ? "animate-spin" : ""} /> Convert to Pseudocode + Code
              </button>
            </>
          }
        >
          <FlowCanvas
            graph={graph} graphKey={graphKey}
            onChange={g => { setGraph(g); }}
            syncId={syncId}
            execNode={execNodeId}
            onSelectNode={id2 => setSyncId(id2 && id2 !== "__start" && id2 !== "__end" ? id2 : null)}
            onAutoArrange={autoArrange}
            paletteOpen={paletteOpen} setPaletteOpen={setPaletteOpen}
          />
        </Panel>

        {!collapsed.has("flow") && !collapsed.has("pseudo") && <div className="w-1 bg-line/50 hover:bg-accent2/60 cursor-col-resize flex-shrink-0" onPointerDown={startDragFrac(0)} />}

        {/* PSEUDOCODE */}
        <Panel
          name="pseudo" collapsed={collapsed.has("pseudo")} frac={fracs[1]}
          maximized={maximized === "pseudo"} anyMax={maximized !== null}
          onCollapse={() => toggleCollapse("pseudo")}
          onMax={() => setMaximized(maximized === "pseudo" ? null : "pseudo")}
          icon={<ScrollText size={13} className="text-warnc" />}
          title="Pseudocode"
          badge={parseErrors.length ? <span className="chip chip-red">{parseErrors.length} issue{parseErrors.length > 1 ? "s" : ""}</span> : undefined}
          actions={
            <>
              <button className="btn btn-sm" onClick={pseudoToFlow} disabled={convertBusy} title="Parse pseudocode → IR → Flowchart + Code">
                <Workflow size={12} /> Generate Flowchart
              </button>
              <button className="btn btn-sm btn-blue" onClick={() => {
                const res = parsePseudocode(pseudo);
                setParseErrors(res.errors);
                if (res.program && res.ok) {
                  refreshFromIR(res.program, "pseudocode");
                  const fc = irToFlowchart(res.program);
                  setGraph(fc); setGraphKey(k => k + 1);
                  setIssues(flowchartToIR(fc).issues);
                  logEvent("code_generated", "Pseudocode → all languages", projectId ?? undefined);
                }
              }} disabled={convertBusy}>
                <Code2 size={12} /> Generate Code
              </button>
            </>
          }
          footer={parseErrors.length > 0 ? (
            <div className="max-h-[110px] overflow-y-auto border-t border-line bg-[color:color-mix(in_srgb,var(--danger)_5%,transparent)] px-3 py-2 space-y-1.5">
              {parseErrors.slice(0, 3).map((e, i) => (
                <div key={i} className="text-[11px] leading-snug">
                  <span className="text-dangerc font-bold mono">Line {e.line}</span>
                  <span className="text-app"> — {e.message}</span>
                  {e.expected && <div className="text-mut ml-4">Expected: <code className="mono text-warnc">{e.expected}</code>{e.found && <> · Found: <code className="mono text-dangerc">{e.found}</code></>}</div>}
                  {e.hint && <div className="text-accent2 ml-4">Hint: {e.hint}</div>}
                </div>
              ))}
            </div>
          ) : undefined}
        >
          <SrcEditor
            value={pseudo}
            onChange={v => { setPseudo(v); }}
            lang="pseudo"
            hlRange={pseudoHl}
            execLine={pseudoExecLine}
            errorLines={parseErrorLines}
            onLineClick={onPseudoLineClick}
            placeholder={"START\n\nINPUT nilai\nIF nilai >= 75 THEN\n    OUTPUT \"Lulus\"\nELSE\n    OUTPUT \"Tidak Lulus\"\nEND IF\n\nEND"}
          />
        </Panel>

        {!collapsed.has("pseudo") && !collapsed.has("code") && <div className="w-1 bg-line/50 hover:bg-accent2/60 cursor-col-resize flex-shrink-0" onPointerDown={startDragFrac(1)} />}

        {/* CODE */}
        <Panel
          name="code" collapsed={collapsed.has("code")} frac={fracs[2]}
          maximized={maximized === "code"} anyMax={maximized !== null}
          onCollapse={() => toggleCollapse("code")}
          onMax={() => setMaximized(maximized === "code" ? null : "code")}
          icon={<Code2 size={13} className="text-accent" />}
          title="Code"
          badge={<LangTabs lang={lang} setLang={setLang} overridden={overridden} />}
          actions={
            <>
              <button className="btn btn-sm" onClick={codeToAll} title={`Import ${lang} code → Algorithm IR → Flowchart + Pseudocode`}>
                <Workflow size={12} /> Import to IR
              </button>
              <button className="btn btn-sm btn-blue" onClick={() => {
                if (!ir) { flowchartToAll(); return; }
                const nextCodes: Partial<Record<Language, { code: string; map: LineMap }>> = {};
                for (const l of LANGUAGES) {
                  const g = irToCode(ir, l.id);
                  nextCodes[l.id] = { code: g.code, map: g.map };
                }
                setCodes(nextCodes); setOverridden(new Set());
                pushHistory("Algorithm IR", "C / C++ / C# / Python / Java", "Code regenerated from IR");
                logEvent("code_generated", `IR → ${lang}`, projectId ?? undefined);
              }} title="Regenerate all languages from the algorithm model">
                <RefreshCw size={12} /> Generate from IR
              </button>
            </>
          }
          footer={
            <div className="border-t border-line px-3 py-1 flex items-center gap-2 text-[10px] text-mut flex-shrink-0">
              <Wand2 size={10} />
              <span>{syncInfo ? <>Linked selection <code className="mono text-violetc">{syncInfo}</code> — highlights appear in all three views.</> : "Click any line to sync-highlight its flowchart node & pseudocode block."}</span>
              <span className="ml-auto chip">Demo exec runs the IR, not this file</span>
            </div>
          }
        >
          <SrcEditor
            value={curCode?.code ?? "// No code yet — click 'Generate from IR' (or Convert on the Flowchart panel)."}
            onChange={v => {
              setCodes(c => ({ ...c, [lang]: { code: v, map: c[lang]?.map ?? {} } }));
              setOverridden(o => new Set(o).add(lang));
            }}
            lang={editorLang(lang)}
            hlRange={codeHl}
            execLine={codeExecLine}
            onLineClick={onCodeLineClick}
          />
        </Panel>
      </div>

      {/* ── bottom workbench ── */}
      <div className="border-t border-line bg-panel flex-shrink-0" style={{ height: maximized === "bottom" ? "70vh" : bottomH }}>
        <div className="h-1 -mt-1 hover:bg-accent2/60 cursor-row-resize" onPointerDown={startDragBottom} />
        <div className="flex items-center gap-0.5 px-2 h-9 border-b border-line">
          {(
            [
              ["console", "Console", <TerminalSquare key="c" size={13} />],
              ["tests", "Tests", <ListChecks key="t" size={13} />],
              ["viz", "Visualizer", <Footprints key="v" size={13} />],
              ["analysis", "Analysis", <BarChart3 key="a" size={13} />],
              ["tutor", "AI Tutor", <Bot key="b" size={13} />],
              ["history", "History", <HistoryIcon key="h" size={13} />],
            ] as [BottomTab, string, React.ReactNode][]
          ).map(([t, label, icon]) => (
            <button
              key={t}
              onClick={() => setBottom(t)}
              className={`flex items-center gap-1.5 px-2.5 h-full text-[11.5px] font-semibold border-b-2 transition-colors ${bottom === t ? "border-[color:var(--accent-2)] text-app" : "border-transparent text-mut hover:text-app"}`}
            >
              {icon}{label}
              {t === "analysis" && issueCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
            </button>
          ))}
          <div className="flex-1" />
          <button className="btn btn-ghost btn-sm" onClick={() => setMaximized(maximized === "bottom" ? null : "bottom")} title="Maximize panel">
            {maximized === "bottom" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
        <div className="overflow-hidden" style={{ height: (maximized === "bottom" ? 0 : 0) || "calc(100% - 37px)" }}>
          {bottom === "console" && (
            <ConsolePanel stdin={stdin} setStdin={setStdin} onRun={() => run()} running={running} exec={exec} onDebugError={msg => askTutor("debug", msg)} />
          )}
          {bottom === "tests" && (
            <TestsPanel tests={tests} setTests={setTests} onRunTests={runTests} running={runningTests} results={testResults} score={testScore} />
          )}
          {bottom === "viz" && (
            <VizPanel exec={exec} step={vizStep} setStep={setVizStep} onRun={() => run()} running={running} stdin={stdin} />
          )}
          {bottom === "analysis" && <AnalysisPanel analysis={analysis} issues={issues} onJump={jumpToNode} />}
          {bottom === "tutor" && (
            <TutorPanel
              log={tutorLog} busy={tutorBusy}
              onAsk={m => askTutor(m)}
              onNL={runNL} nl={nl} onApplyNL={applyNL}
              onClear={() => setTutorLog([])}
            />
          )}
          {bottom === "history" && (
            <HistoryPanel history={history} versions={versions} current={pseudo} onSaveVersion={saveVersion} onRestore={restoreVersion} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Panel wrapper ────────────────────────────────────────────────────────────

function Panel(props: {
  name: string;
  collapsed: boolean;
  frac: number;
  maximized: boolean;
  anyMax: boolean;
  onCollapse: () => void;
  onMax: () => void;
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { collapsed, frac, maximized, anyMax, onCollapse, onMax } = props;
  if (collapsed) {
    return (
      <div className="w-[38px] flex-shrink-0 border-r border-line bg-soft flex flex-col items-center py-2 gap-2">
        <button className="btn btn-ghost btn-sm" onClick={onCollapse} title={`Expand ${props.title}`}><PanelRightOpen size={14} /></button>
        <div className="[writing-mode:vertical-rl] text-[10px] font-bold tracking-[0.14em] text-mut mt-1 flex items-center gap-2">
          {props.icon} {props.title.toUpperCase()}
        </div>
      </div>
    );
  }
  if (anyMax && !maximized) return null;
  return (
    <div
      className="flex flex-col min-w-0 bg-panel border-r border-line last:border-r-0"
      style={maximized ? { position: "absolute", inset: 0, zIndex: 30 } : { flex: frac }}
    >
      <div className="flex items-center gap-2 px-2.5 h-10 border-b border-line flex-shrink-0 overflow-x-auto">
        {props.icon}
        <span className="text-[12px] font-bold flex-shrink-0">{props.title}</span>
        {props.badge}
        <div className="flex-1" />
        {props.actions}
        <button className="btn btn-ghost btn-sm" onClick={onMax} title={maximized ? "Restore" : "Maximize"}>
          {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCollapse} title="Collapse"><PanelRightClose size={13} /></button>
      </div>
      <div className="flex-1 min-h-0 relative">{props.children}</div>
      {props.footer}
    </div>
  );
}

function MenuButton(props: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="btn btn-sm" onClick={() => setOpen(!open)}>{props.icon} {props.label} <ChevronDown size={11} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 card p-1.5 w-[210px] fade-up" onClick={() => setOpen(false)}>
            {props.children}
          </div>
        </>
      )}
    </div>
  );
}
function MenuItem(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-panel2 rounded-md text-left" onClick={props.onClick}>
      {props.children}
    </button>
  );
}
