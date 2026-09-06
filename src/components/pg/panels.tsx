"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play, FlaskConical, CheckCircle2, XCircle, AlertTriangle, Info,
  SkipBack, StepBack, StepForward, SkipForward, Pause, Plus, Trash2, Bot,
  ChevronRight, History as HistoryIcon, Save, GitCompareArrows, RotateCcw,
  TerminalSquare, Lightbulb, Wand2, ShieldAlert,
} from "lucide-react";
import type { ExecutionResult, TestCase, LineMap, Language, IRProgram } from "@/lib/ir/types";
import { uid } from "@/lib/ir/types";
import type { Analysis } from "@/lib/ir/analyzer";
import type { FcIssue } from "@/lib/ir/flowchart";
import type { NLResult, TutorMode, TutorReply } from "@/lib/ir/tutor";
import type { ProjectVersion, TransformRecord } from "@/lib/project";

// ── helpers ──────────────────────────────────────────────────────────────────

export function Md({ text }: { text: string }) {
  return (
    <div className="text-[12.5px] leading-relaxed space-y-1.5">
      {text.split("\n").map((l, i) => {
        const parts = l.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**")) return <strong key={j} className="text-app">{p.slice(2, -2)}</strong>;
          if (p.startsWith("`") && p.endsWith("`")) return <code key={j} className="mono text-[11px] bg-panel2 border border-line rounded px-1">{p.slice(1, -1)}</code>;
          return <span key={j}>{p}</span>;
        });
        if (l.startsWith("- ")) return <div key={i} className="flex gap-1.5 pl-1"><ChevronRight size={12} className="mt-1 flex-shrink-0 text-accent2" /><span>{parts}</span></div>;
        if (l.startsWith("> ")) return <div key={i} className="border-l-2 border-[color:var(--accent-2)] pl-2.5 text-mut italic">{parts}</div>;
        return <div key={i}>{parts}</div>;
      })}
    </div>
  );
}

export function ScoreBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div title={hint}>
      <div className="flex justify-between text-[11.5px] mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-mut mono">{value}%</span>
      </div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

export function IssueList({ issues, onJump }: { issues: FcIssue[]; onJump?: (nodeId?: string) => void }) {
  if (!issues.length) return (
    <div className="flex items-center gap-2 text-[12px] text-accent"><CheckCircle2 size={14} /> No issues found — the algorithm structure looks good.</div>
  );
  return (
    <div className="space-y-1.5">
      {issues.map((i, k) => (
        <button
          key={k}
          onClick={() => onJump?.(i.nodeId)}
          className="w-full text-left flex items-start gap-2 text-[12px] rounded-lg border border-line bg-panel2 px-2.5 py-2 hover:border-[color:var(--muted)]"
        >
          {i.level === "error" ? <XCircle size={13} className="text-dangerc mt-0.5 flex-shrink-0" /> : <AlertTriangle size={13} className="text-warnc mt-0.5 flex-shrink-0" />}
          <span className="flex-1">{i.message}</span>
          {i.nodeId && <span className="chip">node</span>}
        </button>
      ))}
    </div>
  );
}

// ── Console ──────────────────────────────────────────────────────────────────

export function ConsolePanel(props: {
  stdin: string; setStdin: (v: string) => void;
  onRun: () => void; running: boolean;
  exec: ExecutionResult | null;
  onDebugError: (msg: string) => void;
}) {
  const { stdin, setStdin, onRun, running, exec, onDebugError } = props;
  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[230px_1fr] gap-0">
      <div className="border-r border-line p-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-[0.12em] text-mut">INPUT (STDIN)</span>
          <button className="btn btn-sm btn-primary" onClick={onRun} disabled={running}>
            <Play size={12} /> {running ? "Running…" : "Run"}
          </button>
        </div>
        <textarea
          className="textarea mono flex-1 text-[12px] min-h-[60px]"
          placeholder={"One value per line\ne.g.\n75"}
          value={stdin}
          onChange={e => setStdin(e.target.value)}
        />
        <div className="mt-2 flex items-start gap-1.5 text-[10.5px] text-mut leading-snug">
          <ShieldAlert size={11} className="mt-0.5 flex-shrink-0 text-warnc" />
          <span><b className="text-warnc">Demo Execution Mode</b> — runs the algorithm model (IR interpreter), not machine-compiled code. Connect a sandbox compiler service (Docker/Judge0) for real compilation.</span>
        </div>
      </div>
      <div className="p-3 overflow-y-auto min-h-0 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <TerminalSquare size={13} className="text-mut" />
          <span className="text-[10px] font-bold tracking-[0.12em] text-mut">OUTPUT</span>
          {exec && <span className={`chip ${exec.ok ? "chip-green" : "chip-red"}`}>{exec.ok ? "finished" : "error"} · {exec.stepCount} steps</span>}
        </div>
        {!exec ? (
          <div className="text-[12px] text-mut">Press <b>Run</b> to execute the algorithm step by step. Output will appear here.</div>
        ) : (
          <div className="mono text-[12.5px] space-y-1">
            {exec.output.map((l, i) => (
              <div key={i} className="flex gap-2"><span className="text-mut select-none">›</span><span>{l}</span></div>
            ))}
            {exec.error && (
              <div className="mt-2 rounded-xl border border-[color:color-mix(in_srgb,var(--danger)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_8%,transparent)] p-3">
                <div className="flex items-center gap-2 text-dangerc text-[12px] font-semibold"><XCircle size={14} /> Runtime Error</div>
                <div className="text-[12px] text-mut mt-1 font-sans">{exec.error}</div>
                <button className="btn btn-sm mt-2" onClick={() => onDebugError(exec.error!)}><Bot size={12} /> Ask AI Tutor to explain</button>
              </div>
            )}
            {exec.ok && exec.output.length === 0 && <div className="text-mut text-[12px] font-sans">(program finished without producing output)</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

export interface TestResultRow {
  id?: string; name: string; input: string;
  passed: boolean; actual: string; expected: string; error?: string;
}

export function TestsPanel(props: {
  tests: TestCase[];
  setTests: (t: TestCase[]) => void;
  onRunTests: () => void;
  running: boolean;
  results: TestResultRow[] | null;
  score: number | null;
}) {
  const { tests, setTests, onRunTests, running, results, score } = props;
  const update = (id: string, patch: Partial<TestCase>) =>
    setTests(tests.map(t => t.id === id ? { ...t, ...patch } : t));
  const resBy = new Map((results ?? []).map(r => [r.id, r]));
  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[1fr_1.1fr]">
      <div className="border-r border-line p-3 overflow-y-auto min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-[0.12em] text-mut">TEST CASES</span>
          <div className="flex gap-1.5">
            <button className="btn btn-sm" onClick={() => setTests([...tests, { id: uid(), name: `Test ${tests.length + 1}`, input: "", expected: "" }])}><Plus size={12} /> Add</button>
            <button className="btn btn-sm btn-blue" onClick={onRunTests} disabled={running || !tests.length}><FlaskConical size={12} /> {running ? "Running…" : "Run Tests"}</button>
          </div>
        </div>
        <div className="space-y-2">
          {tests.map(t => (
            <div key={t.id} className="rounded-lg border border-line bg-panel2 p-2">
              <div className="flex items-center gap-2">
                <input className="input text-[11.5px] py-1" value={t.name} onChange={e => update(t.id, { name: e.target.value })} aria-label="test name" />
                <button className="btn btn-ghost btn-sm text-dangerc" onClick={() => setTests(tests.filter(x => x.id !== t.id))}><Trash2 size={12} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <div>
                  <label className="text-[9px] font-bold text-mut">INPUT</label>
                  <textarea className="textarea mono text-[11px] mt-0.5" rows={2} value={t.input} onChange={e => update(t.id, { input: e.target.value })} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-mut">EXPECTED OUTPUT</label>
                  <textarea className="textarea mono text-[11px] mt-0.5" rows={2} value={t.expected} onChange={e => update(t.id, { expected: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
          {!tests.length && <div className="text-[12px] text-mut">No test cases yet. Add one with edge values (batas) — mis. nilai tepat 75.</div>}
        </div>
      </div>
      <div className="p-3 overflow-y-auto min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold tracking-[0.12em] text-mut">TEST RESULTS</span>
          {score !== null && results && (
            <>
              <span className="chip chip-blue">Passed: {results.filter(r => r.passed).length}/{results.length}</span>
              <span className={`chip ${score >= 100 ? "chip-green" : score >= 60 ? "chip-amber" : "chip-red"}`}>Score: {score}%</span>
            </>
          )}
        </div>
        {!results ? (
          <div className="text-[12px] text-mut">Run the tests to see pass/fail per test case, with expected vs actual output.</div>
        ) : (
          <div className="space-y-2">
            {tests.map(t => {
              const r = resBy.get(t.id);
              if (!r) return null;
              return (
                <div key={t.id} className={`rounded-lg border p-2.5 ${r.passed ? "border-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_6%,transparent)]" : "border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_6%,transparent)]"}`}>
                  <div className="flex items-center gap-2 text-[12px] font-semibold">
                    {r.passed ? <CheckCircle2 size={14} className="text-accent" /> : <XCircle size={14} className="text-dangerc" />}
                    {t.name}
                    <span className="text-mut font-normal mono text-[10px]">input: {t.input.replace(/\n/g, ", ") || "(none)"}</span>
                  </div>
                  {!r.passed && (
                    <div className="grid grid-cols-2 gap-2 mt-2 mono text-[11px]">
                      <div><div className="text-[9px] font-bold text-mut mb-0.5">EXPECTED</div><pre className="whitespace-pre-wrap">{r.expected || "(empty)"}</pre></div>
                      <div><div className="text-[9px] font-bold text-mut mb-0.5">ACTUAL</div><pre className="whitespace-pre-wrap">{r.actual || "(empty)"}</pre></div>
                    </div>
                  )}
                  {r.error && <div className="text-[11px] text-dangerc mt-1">{r.error}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Execution Visualizer ─────────────────────────────────────────────────────

export function VizPanel(props: {
  exec: ExecutionResult | null;
  step: number; setStep: (n: number) => void;
  onRun: () => void; running: boolean;
  stdin: string;
}) {
  const { exec, step, setStep, onRun, running, stdin } = props;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const listRef = useRef<HTMLDivElement>(null);
  const total = exec?.steps.length ?? 0;
  const cur = exec && total ? exec.steps[Math.min(step, total - 1)] : null;
  const prevVars = step > 0 && exec ? exec.steps[Math.min(step - 1, total - 1)].vars : {};

  useEffect(() => {
    if (!playing || !exec) return;
    if (step >= total - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setStep(step + 1), speed);
    return () => clearTimeout(t);
  }, [playing, step, total, speed, exec]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.querySelector(`[data-step="${step}"]`)?.scrollIntoView({ block: "nearest" });
  }, [step]);

  if (!exec) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
        <div className="text-[13px] text-mut max-w-[420px]">
          The Execution Visualizer replays the algorithm <b className="text-app">step by step</b>, showing variable values and the current flowchart node / code line.
        </div>
        <button className="btn btn-primary" onClick={onRun} disabled={running}>
          <Play size={14} /> {running ? "Running…" : stdin.trim() ? "Visualize Execution" : "Visualize Execution (n input dari STDIN di tab Console)"}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[200px_1fr_210px] min-h-0">
      {/* controls */}
      <div className="border-r border-line p-3 flex flex-col gap-2 min-h-0 overflow-y-auto">
        <div className="text-[10px] font-bold tracking-[0.12em] text-mut">CONTROLS</div>
        <div className="flex gap-1">
          <button className="btn btn-sm flex-1" onClick={() => { setStep(0); setPlaying(false); }} title="Restart"><SkipBack size={12} /></button>
          <button className="btn btn-sm flex-1" onClick={() => { setStep(Math.max(0, step - 1)); setPlaying(false); }} title="Step back"><StepBack size={12} /></button>
          <button className="btn btn-sm flex-1 btn-primary" onClick={() => setPlaying(!playing)} title={playing ? "Pause" : "Play"}>{playing ? <Pause size={12} /> : <Play size={12} />}</button>
          <button className="btn btn-sm flex-1" onClick={() => { setStep(Math.min(total - 1, step + 1)); setPlaying(false); }} title="Step forward"><StepForward size={12} /></button>
          <button className="btn btn-sm flex-1" onClick={() => { setStep(total - 1); setPlaying(false); }} title="End"><SkipForward size={12} /></button>
        </div>
        <input
          type="range" min={0} max={Math.max(total - 1, 0)} value={step}
          onChange={e => { setStep(Number(e.target.value)); setPlaying(false); }}
          className="w-full accent-emerald-400" aria-label="step slider"
        />
        <div className="text-[11px] text-mut text-center mono">Step {step + 1} / {total}</div>
        <div className="flex gap-1 items-center text-[10px] text-mut">
          Speed:
          {[["0.5×", 1400], ["1×", 700], ["2×", 350]].map(([l, v]) => (
            <button key={l} className={`btn btn-sm flex-1 ${speed === v ? "border-[color:var(--accent-2)]" : ""}`} onClick={() => setSpeed(v as number)}>{l}</button>
          ))}
        </div>
        <div className="mt-1 text-[10px] font-bold tracking-[0.12em] text-mut">CURRENT STEP</div>
        <div className="rounded-lg border border-line bg-panel2 p-2 mono text-[11.5px]">
          {cur?.note}
        </div>
        <div className="text-[10.5px] text-mut flex gap-1.5 items-start"><Info size={11} className="mt-0.5 flex-shrink-0" /> The matching flowchart node, pseudocode line and code line are highlighted live.</div>
      </div>

      {/* trace */}
      <div ref={listRef} className="overflow-y-auto p-3 min-h-0">
        <div className="text-[10px] font-bold tracking-[0.12em] text-mut mb-2">EXECUTION TRACE</div>
        <div className="space-y-1">
          {exec.steps.map((s, i) => (
            <button
              key={s.n} data-step={i}
              onClick={() => { setStep(i); setPlaying(false); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border text-left mono text-[11.5px] transition-colors ${i === step ? "border-[color:var(--accent-2)] bg-panel2" : "border-transparent hover:bg-panel2/60"}`}
            >
              <span className="text-mut w-7 text-right flex-shrink-0">{s.n}</span>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.type === "output" ? "bg-emerald-400" : s.type === "cond" || s.type === "loop" ? "bg-amber-400" : s.type === "input" ? "bg-blue-400" : "bg-violet-400"}`} />
              <span className="truncate">{s.note}</span>
            </button>
          ))}
        </div>
      </div>

      {/* variables */}
      <div className="border-l border-line p-3 overflow-y-auto min-h-0">
        <div className="text-[10px] font-bold tracking-[0.12em] text-mut mb-2">VARIABLES</div>
        <table className="w-full text-[12px] mono">
          <thead><tr className="text-mut text-[10px]"><th className="text-left pb-1">NAME</th><th className="text-right pb-1">VALUE</th></tr></thead>
          <tbody>
            {cur && Object.entries(cur.vars).map(([k, v]) => {
              const changed = prevVars[k] !== v;
              return (
                <tr key={k} className={changed ? "text-accent font-semibold" : ""}>
                  <td className="py-1 border-t border-line">{k}</td>
                  <td className="py-1 border-t border-line text-right">{String(v)}</td>
                </tr>
              );
            })}
            {!cur && <tr><td colSpan={2} className="text-mut text-[11px] py-2">No variables yet.</td></tr>}
          </tbody>
        </table>
        {exec.error && step >= total - 1 && (
          <div className="mt-3 text-[11px] text-dangerc flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> {exec.error}</div>
        )}
      </div>
    </div>
  );
}

// ── Analysis ─────────────────────────────────────────────────────────────────

export function AnalysisPanel(props: {
  analysis: Analysis | null;
  issues: FcIssue[];
  onJump: (nodeId?: string) => void;
}) {
  const { analysis, issues, onJump } = props;
  if (!analysis) return <div className="p-4 text-[12px] text-mut">Build a valid flowchart or parse pseudocode to analyze the algorithm.</div>;
  const a = analysis;
  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[240px_1fr_1fr] min-h-0">
      <div className="border-r border-line p-3 space-y-3 overflow-y-auto">
        <div className="text-[10px] font-bold tracking-[0.12em] text-mut">ALGORITHM ANALYSIS</div>
        <ScoreBar label="Correctness" value={a.correctness} hint="Structural & semantic checks passed" />
        <ScoreBar label="Readability" value={a.readability} hint="Identifier & naming quality" />
        <ScoreBar label="Structure" value={a.structure} hint="Nesting depth & organization" />
        <ScoreBar label="Efficiency" value={a.efficiency} hint="Loop nesting depth" />
        <div className="rounded-lg border border-line bg-panel2 p-2.5 mt-2">
          <div className="text-[10px] text-mut font-bold">COMPLEXITY (estimated)</div>
          <div className="mono text-[13px] mt-1">Time: <b className="text-accent2">{a.timeComplexity ?? "?"}</b> · Space: <b className="text-accent2">{a.spaceComplexity}</b></div>
          <div className="text-[10.5px] text-mut mt-1 leading-snug">{a.complexityNote}</div>
        </div>
      </div>
      <div className="border-r border-line p-3 overflow-y-auto min-h-0">
        <div className="text-[10px] font-bold tracking-[0.12em] text-mut mb-2">STRUCTURE DETECTED</div>
        <div className="flex flex-wrap gap-1.5">
          <span className="chip chip-blue">Sequence: {a.counts.sequences + a.counts.inputs + a.counts.outputs}</span>
          <span className="chip chip-amber">Decision: {a.counts.decisions}</span>
          <span className="chip chip-violet">Loop: {a.counts.loops}</span>
          <span className="chip">Inputs: {a.counts.inputs}</span>
          <span className="chip">Outputs: {a.counts.outputs}</span>
          <span className="chip">Max depth: {a.counts.maxDepth}</span>
        </div>
        <div className="text-[10px] font-bold tracking-[0.12em] text-mut mt-4 mb-2">SUGGESTIONS</div>
        <div className="space-y-1.5">
          {a.suggestions.length ? a.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] text-mut"><Lightbulb size={12} className="mt-0.5 text-warnc flex-shrink-0" />{s}</div>
          )) : <div className="text-[12px] text-mut">Nothing major — nice work.</div>}
        </div>
      </div>
      <div className="p-3 overflow-y-auto min-h-0">
        <div className="text-[10px] font-bold tracking-[0.12em] text-mut mb-2">VALIDATION ISSUES</div>
        <IssueList issues={issues} onJump={onJump} />
      </div>
    </div>
  );
}

// ── Tutor ────────────────────────────────────────────────────────────────────

export function TutorPanel(props: {
  log: (TutorReply & { at: number })[];
  busy: boolean;
  onAsk: (mode: TutorMode) => void;
  onNL: (desc: string) => void;
  nl: NLResult | null;
  onApplyNL: () => void;
  onClear: () => void;
}) {
  const { log, busy, onAsk, onNL, nl, onApplyNL, onClear } = props;
  const [desc, setDesc] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [log, nl, busy]);

  const MODES: { m: TutorMode; label: string; desc: string }[] = [
    { m: "socratic", label: "Socratic", desc: "asks guiding questions — no direct answers" },
    { m: "hint", label: "Hint", desc: "next small step, not the solution" },
    { m: "explain", label: "Explain", desc: "explains your algorithm in plain language" },
    { m: "debug", label: "Debug", desc: "analyzes errors & warnings" },
    { m: "review", label: "Review", desc: "quality score + suggestions" },
  ];

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[1fr_290px] min-h-0">
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-2 border-b border-line flex-wrap">
          <Bot size={14} className="text-violetc" />
          <span className="text-[11px] font-bold mr-1">AI Tutor</span>
          {MODES.map(x => (
            <button key={x.m} className="btn btn-sm" title={x.desc} onClick={() => onAsk(x.m)} disabled={busy}>{x.label}</button>
          ))}
          <span className="text-[9.5px] text-mut ml-2 hidden lg:inline">pedagogical rule engine — guides first, never just dumps answers</span>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={onClear}>Clear</button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {!log.length && (
            <div className="text-[12px] text-mut max-w-[480px]">
              Pilih mode di atas. <b className="text-app">Socratic</b> akan mengajukan pertanyaan yang menuntunmu menemukan jawaban sendiri;
              <b className="text-app"> Hint</b> memberi petunjuk bertahap; <b className="text-app">Review</b> menilai kualitas flowchart/pseudocode/code-mu.
            </div>
          )}
          {log.map((r, i) => (
            <div key={i} className="fade-up max-w-[720px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="chip chip-violet uppercase">{r.mode}</span>
                <span className="text-[11px] font-semibold">{r.title}</span>
              </div>
              <div className="rounded-xl border border-line bg-panel2 p-3"><Md text={r.message} /></div>
              {r.followUps && (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {r.followUps.map(f => (
                    <button key={f} className="chip hover:border-[color:var(--accent-2)]" onClick={() => onAsk(f.includes("hint") || f.includes("Hint") ? "hint" : f.includes("Socratic") ? "socratic" : f.includes("Review") || f.includes("Review") ? "review" : f.includes("Jelaskan") || f.includes("Explain") ? "explain" : f.includes("Debug") ? "debug" : "hint")}>{f}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="text-[12px] text-mut flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-violet-400 pulse-dot" /> Tutor is thinking…</div>}
        </div>
      </div>
      <div className="border-l border-line p-3 flex flex-col gap-2 min-h-0 overflow-y-auto">
        <div className="text-[10px] font-bold tracking-[0.12em] text-mut flex items-center gap-1.5"><Wand2 size={11} /> DESCRIBE YOUR PROBLEM</div>
        <textarea
          className="textarea text-[12px] min-h-[64px]"
          placeholder="cth: Buat program untuk menentukan bilangan terbesar dari tiga angka."
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
        <button className="btn btn-blue btn-sm" disabled={!desc.trim() || busy} onClick={() => onNL(desc)}>Generate Algorithm</button>
        {nl && (
          <div className="rounded-xl border border-line bg-panel2 p-2.5 fade-up">
            <div className="text-[10px] font-bold text-mut mb-1.5">PROBLEM UNDERSTANDING</div>
            <div className="space-y-1 text-[11.5px]">
              <div><span className="text-accent2 font-semibold">Input: </span>{nl.understanding.input}</div>
              <div><span className="text-warnc font-semibold">Process: </span>{nl.understanding.process}</div>
              <div><span className="text-accent font-semibold">Output: </span>{nl.understanding.output}</div>
            </div>
            <div className="text-[9.5px] text-mut mt-2">{nl.confidence}</div>
            <button className="btn btn-primary btn-sm w-full mt-2.5" onClick={onApplyNL}>
              Build Flowchart + Pseudocode + Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── History / Versions ───────────────────────────────────────────────────────

export function HistoryPanel(props: {
  history: TransformRecord[];
  versions: ProjectVersion[];
  current: string;
  onSaveVersion: (label: string) => void;
  onRestore: (v: ProjectVersion) => void;
}) {
  const { history, versions, current, onSaveVersion, onRestore } = props;
  const [label, setLabel] = useState("");
  const [diff, setDiff] = useState<{ a: string[]; b: string[] } | null>(null);

  const compare = (v: ProjectVersion) => {
    const a = v.pseudocode.split("\n");
    const b = current.split("\n");
    const max = Math.max(a.length, b.length);
    const da: string[] = [], db: string[] = [];
    for (let i = 0; i < max; i++) {
      if (a[i] !== b[i]) { da.push(a[i] ?? ""); db.push(b[i] ?? ""); }
    }
    setDiff({ a: da.slice(0, 12), b: db.slice(0, 12) });
  };

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-2 min-h-0">
      <div className="border-r border-line p-3 overflow-y-auto min-h-0">
        <div className="text-[10px] font-bold tracking-[0.12em] text-mut mb-2">TRANSFORMATION HISTORY</div>
        {!history.length ? (
          <div className="text-[12px] text-mut">Every conversion (Flowchart → Pseudocode → C++ → …) will be listed here.</div>
        ) : (
          <div className="space-y-1.5">
            {[...history].reverse().map(h => (
              <div key={h.id} className="flex items-center gap-2.5 text-[12px] rounded-lg border border-line bg-panel2 px-2.5 py-2">
                <HistoryIcon size={12} className="text-accent2 flex-shrink-0" />
                <span className="font-medium">{h.from}</span>
                <ChevronRight size={11} className="text-mut" />
                <span className="font-medium text-accent">{h.to}</span>
                {h.detail && <span className="text-mut truncate">· {h.detail}</span>}
                <span className="ml-auto text-[10px] text-mut mono flex-shrink-0">{new Date(h.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-3 overflow-y-auto min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-[0.12em] text-mut">VERSIONS</span>
          <div className="flex gap-1.5">
            <input className="input text-[11px] py-1 w-[130px]" placeholder="Version label" value={label} onChange={e => setLabel(e.target.value)} />
            <button className="btn btn-sm" onClick={() => { onSaveVersion(label || `v${versions.length + 1}`); setLabel(""); }}><Save size={12} /> Save</button>
          </div>
        </div>
        {!versions.length && <div className="text-[12px] text-mut">Save snapshots of the algorithm (pseudocode) to compare and restore later — e.g. before/after fixing <code className="mono">nilai &gt; 75</code> → <code className="mono">nilai &gt;= 75</code>.</div>}
        <div className="space-y-1.5">
          {[...versions].reverse().map(v => (
            <div key={v.id} className="flex items-center gap-2 text-[12px] rounded-lg border border-line bg-panel2 px-2.5 py-2">
              <span className="font-semibold">{v.label}</span>
              <span className="text-[10px] text-mut mono">{new Date(v.createdAt).toLocaleString()}</span>
              <div className="ml-auto flex gap-1">
                <button className="btn btn-sm btn-ghost" title="Compare with current" onClick={() => compare(v)}><GitCompareArrows size={12} /></button>
                <button className="btn btn-sm btn-ghost" title="Restore this version" onClick={() => onRestore(v)}><RotateCcw size={12} /></button>
              </div>
            </div>
          ))}
        </div>
        {diff && (
          <div className="mt-3 rounded-xl border border-line bg-panel p-2.5 fade-up">
            <div className="text-[10px] font-bold text-mut mb-1.5">DIFF — version vs current</div>
            <div className="grid grid-cols-2 gap-2 mono text-[11px]">
              <div>{diff.a.map((l, i) => <div key={i} className="text-dangerc">- {l || "∅"}</div>)}</div>
              <div>{diff.b.map((l, i) => <div key={i} className="text-accent">+ {l || "∅"}</div>)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Code panel header helpers ────────────────────────────────────────────────

export function LangTabs(props: { lang: Language; setLang: (l: Language) => void; overridden: Set<Language> }) {
  const LANGS: { id: Language; name: string }[] = [
    { id: "c", name: "C" }, { id: "cpp", name: "C++" }, { id: "csharp", name: "C#" },
    { id: "python", name: "Python" }, { id: "java", name: "Java" },
  ];
  return (
    <div className="flex gap-0.5">
      {LANGS.map(l => (
        <button
          key={l.id}
          onClick={() => props.setLang(l.id)}
          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors relative ${props.lang === l.id ? "bg-[color:var(--panel-2)] text-app border border-line" : "text-mut hover:text-app"}`}
        >
          {l.name}
          {props.overridden.has(l.id) && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" title="Manually edited" />}
        </button>
      ))}
    </div>
  );
}

export function mapLineForStmt(map: LineMap | undefined, id: string | null): [number, number] | null {
  if (!map || !id) return null;
  const r = map[id];
  return r ? [r[0], r[1]] : null;
}
