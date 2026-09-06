"use client";

import { useEffect, useMemo, useState, type JSX } from "react";
import Link from "next/link";
import Shell from "@/components/shell";
import {
  ArrowRight, Copy, FlaskConical, FolderPlus, Trash2, Workflow,
  Activity, Sparkles, BookOpen, TrendingUp, Zap, CheckCircle2, Lightbulb,
} from "lucide-react";
import { LESSONS } from "@/lib/samples";

interface ProjRow {
  id: string; title: string; description: string; problem: string;
  demo: boolean; updatedAt: string; createdAt: string;
  flowchart: { nodes: unknown[] };
}
interface EvRow { id: string; kind: string; detail: string; createdAt: string; }

const fmtRel = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const EVENT_LABEL: Record<string, { label: string; icon: JSX.Element }> = {
  project_created: { label: "Project created", icon: <FolderPlus size={13} /> },
  flowchart_modified: { label: "Flowchart modified", icon: <Workflow size={13} /> },
  pseudocode_generated: { label: "Pseudocode generated", icon: <BookOpen size={13} /> },
  pseudocode_parsed: { label: "Pseudocode parsed", icon: <BookOpen size={13} /> },
  code_generated: { label: "Code generated", icon: <Zap size={13} /> },
  code_run: { label: "Algorithm executed", icon: <Activity size={13} /> },
  test_passed: { label: "Test passed", icon: <CheckCircle2 size={13} /> },
  test_failed: { label: "Test failed", icon: <CheckCircle2 size={13} /> },
  hint_requested: { label: "Hint requested", icon: <Lightbulb size={13} /> },
  solution_viewed: { label: "Solution viewed", icon: <BookOpen size={13} /> },
  conversion: { label: "Representation converted", icon: <Sparkles size={13} /> },
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjRow[]>([]);
  const [events, setEvents] = useState<EvRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      fetch("/api/projects").then(r => r.json()),
      fetch("/api/events").then(r => r.json()),
    ]).then(([p, e]) => {
      setProjects(p.projects ?? []);
      setEvents(e.events ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [events]);

  const skill = (base: number, ev: number, cap = 97) => Math.min(cap, base + ev * 3);
  const skills = [
    { name: "Flowchart", pct: skill(70, (counts.flowchart_modified ?? 0)) },
    { name: "Pseudocode", pct: skill(60, (counts.pseudocode_generated ?? 0) + (counts.pseudocode_parsed ?? 0)) },
    { name: "Programming", pct: skill(50, (counts.code_generated ?? 0) + (counts.code_run ?? 0)) },
    { name: "Debugging", pct: skill(40, (counts.test_failed ?? 0) + (counts.test_passed ?? 0)) },
  ];
  const progress = Math.round(45 + Math.min(50, events.length * 2));

  const remove = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  };
  const duplicate = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: "POST", body: JSON.stringify({ action: "duplicate" }) });
    load();
  };

  const lesson = LESSONS[1]; // Selection

  return (
    <Shell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1180px] mx-auto px-6 py-7 space-y-7">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-4 fade-up">
            <div>
              <div className="text-[12px] text-mut font-medium mb-1">Selamat datang kembali 👋 — siap merancang algoritma?</div>
              <h1 className="text-[26px] font-bold tracking-tight">Design the logic once. <span className="text-accent">See it everywhere.</span></h1>
            </div>
            <div className="flex gap-2">
              <Link href="/projects" className="btn"><FolderPlus size={15} /> New Project</Link>
              <Link href="/playground/latest" className="btn btn-primary"><FlaskConical size={15} /> Open Playground</Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 fade-up">
            {[
              { label: "Projects", value: projects.length, icon: <FolderPlus size={16} className="text-accent2" /> },
              { label: "Code Runs", value: counts.code_run ?? 0, icon: <Activity size={16} className="text-accent" /> },
              { label: "Tests Passed", value: counts.test_passed ?? 0, icon: <CheckCircle2 size={16} className="text-accent" /> },
              { label: "Hints Used", value: counts.hint_requested ?? 0, icon: <Lightbulb size={16} className="text-warnc" /> },
            ].map(s => (
              <div key={s.label} className="card px-4 py-3.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-panel2 border border-line flex items-center justify-center">{s.icon}</span>
                <div>
                  <div className="text-[20px] font-bold leading-none">{s.value}</div>
                  <div className="text-[11px] text-mut mt-1">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Continue learning + recent projects (2 cols) */}
            <div className="lg:col-span-2 space-y-5">
              <div className="card p-5 fade-up relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-accent2/10 blur-2xl" />
                <div className="text-[11px] font-bold tracking-[0.12em] text-mut mb-2">CONTINUE LEARNING</div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[17px] font-bold">{lesson.title}</h3>
                    <p className="text-[13px] text-mut mt-1 max-w-[420px]">{lesson.sections[2].body}</p>
                  </div>
                  <span className="chip chip-violet flex-shrink-0">{lesson.minutes} min</span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="progress-track flex-1 max-w-[320px]"><div className="progress-fill" style={{ width: "66%" }} /></div>
                  <span className="text-[12px] text-mut">2/3 sections</span>
                  <Link href="/lessons" className="btn btn-sm btn-blue ml-auto">Continue <ArrowRight size={13} /></Link>
                </div>
              </div>

              <div className="fade-up">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[15px] font-bold flex items-center gap-2"><TrendingUp size={15} className="text-accent2" /> Recent Projects</h3>
                  <Link href="/projects" className="text-[12px] text-accent2 hover:underline">View all</Link>
                </div>
                {loading ? (
                  <div className="card p-8 text-center text-mut text-[13px]">Loading projects…</div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {projects.slice(0, 4).map(p => (
                      <div key={p.id} className="card p-4 group hover:border-[color:var(--muted)] transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/playground/${p.id}`} className="font-semibold text-[14px] hover:text-accent leading-snug">{p.title}</Link>
                          {p.demo && <span className="chip chip-blue flex-shrink-0">DEMO</span>}
                        </div>
                        <p className="text-[12px] text-mut mt-1.5 line-clamp-2 min-h-[32px]">{p.description || p.problem}</p>
                        <div className="flex items-center gap-1.5 mt-3">
                          <Link href={`/playground/${p.id}`} className="btn btn-sm btn-primary">Open</Link>
                          <button className="btn btn-sm btn-ghost" onClick={() => duplicate(p.id)} title="Duplicate"><Copy size={13} /></button>
                          {!p.demo && (
                            <button className="btn btn-sm btn-ghost text-dangerc" onClick={() => remove(p.id)} title="Delete"><Trash2 size={13} /></button>
                          )}
                          <span className="text-[11px] text-mut ml-auto">{fmtRel(p.updatedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-5">
              <div className="card p-5 fade-up">
                <div className="text-[11px] font-bold tracking-[0.12em] text-mut mb-3">LEARNING PROGRESS</div>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-[28px] font-bold leading-none">{progress}%</span>
                  <span className="text-[12px] text-mut pb-0.5">Algorithm Fundamentals</span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                <div className="mt-5 space-y-3.5">
                  <div className="text-[11px] font-bold tracking-[0.12em] text-mut">SKILLS</div>
                  {skills.map(s => (
                    <div key={s.name}>
                      <div className="flex justify-between text-[12px] mb-1">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-mut mono">{s.pct}%</span>
                      </div>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${s.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5 fade-up">
                <div className="text-[11px] font-bold tracking-[0.12em] text-mut mb-3">RECENT ACTIVITY</div>
                {events.length === 0 ? (
                  <p className="text-[12px] text-mut">Belum ada aktivitas. Buka Playground dan jalankan algoritma pertamamu!</p>
                ) : (
                  <div className="space-y-2.5">
                    {events.slice(0, 7).map(e => {
                      const meta = EVENT_LABEL[e.kind] ?? { label: e.kind, icon: <Activity size={13} /> };
                      return (
                        <div key={e.id} className="flex items-center gap-2.5 text-[12px]">
                          <span className="w-6 h-6 rounded-md bg-panel2 border border-line flex items-center justify-center text-accent flex-shrink-0">{meta.icon}</span>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{meta.label}</div>
                            {e.detail && <div className="text-mut truncate text-[11px]">{e.detail}</div>}
                          </div>
                          <span className="ml-auto text-[10px] text-mut flex-shrink-0">{fmtRel(e.createdAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
