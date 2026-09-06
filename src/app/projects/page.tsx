"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Shell from "@/components/shell";
import { FolderPlus, Copy, Trash2, Pencil, ExternalLink, Workflow, FlaskConical, Sparkles } from "lucide-react";
import { Suspense } from "react";

interface ProjRow {
  id: string; title: string; description: string; problem: string;
  demo: boolean; updatedAt: string; createdAt: string;
}

function ProjectsInner() {
  const [projects, setProjects] = useState<ProjRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", problem: "" });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const router = useRouter();
  const sp = useSearchParams();
  const recentMode = sp.get("view") === "recent";

  const load = () => {
    fetch("/api/projects").then(r => r.json()).then(d => {
      setProjects(d.projects ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const create = async () => {
    const r = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title || "Untitled Project", problem: form.problem }),
    }).then(r => r.json());
    router.push(`/playground/${r.id}`);
  };

  const actions = {
    duplicate: async (id: string) => { await fetch(`/api/projects/${id}`, { method: "POST", body: JSON.stringify({ action: "duplicate" }) }); load(); },
    remove: async (id: string) => { if (confirm("Hapus project ini?")) { await fetch(`/api/projects/${id}`, { method: "DELETE" }); load(); } },
    rename: async (p: ProjRow) => {
      const full = await fetch(`/api/projects/${p.id}`).then(r => r.json());
      await fetch(`/api/projects/${p.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...full.project, title: renameVal || p.title }),
      });
      setRenaming(null); load();
    },
  };

  const shown = [...projects].sort((a, b) =>
    recentMode ? +new Date(b.updatedAt) - +new Date(a.updatedAt) : Number(b.demo) - Number(a.demo) || +new Date(b.updatedAt) - +new Date(a.updatedAt));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1050px] mx-auto px-6 py-7">
        <div className="flex items-end justify-between mb-6 fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">{recentMode ? "Recent Projects" : "My Projects"}</h1>
            <p className="text-[13px] text-mut mt-0.5">Semua karya algoritmamu — flowchart, pseudocode, dan kode tersimpan otomatis.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><FolderPlus size={15} /> New Project</button>
        </div>

        {creating && (
          <div className="card p-5 mb-5 fade-up">
            <h3 className="font-bold text-[15px] mb-3">Create New Project</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-mut">TITLE</label>
                <input className="input mt-1" placeholder="cth: Program Menghitung Luas Segitiga" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-mut">PROBLEM STATEMENT (opsional)</label>
                <textarea className="textarea mt-1" rows={2} placeholder="Tuliskan soalnya di sini — ini membantu AI Tutor memberi hint yang relevan." value={form.problem} onChange={e => setForm(f => ({ ...f, problem: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={create}>Create & Open Playground</button>
                <button className="btn" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="card p-10 text-center text-mut text-[13px]">Loading…</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shown.map(p => (
              <div key={p.id} className="card p-4 flex flex-col fade-up hover:border-[color:var(--muted)] transition-colors">
                <div className="flex items-start justify-between gap-2">
                  {renaming === p.id ? (
                    <div className="flex gap-1 flex-1">
                      <input className="input text-[12px] py-1" value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => e.key === "Enter" && actions.rename(p)} autoFocus />
                      <button className="btn btn-sm btn-primary" onClick={() => actions.rename(p)}>OK</button>
                    </div>
                  ) : (
                    <Link href={`/playground/${p.id}`} className="font-semibold text-[14px] hover:text-accent leading-snug">{p.title}</Link>
                  )}
                  {p.demo && <span className="chip chip-blue flex-shrink-0">DEMO</span>}
                </div>
                <p className="text-[12px] text-mut mt-1.5 line-clamp-2 flex-1">{p.description || p.problem || "—"}</p>
                <div className="flex items-center gap-1 mt-3">
                  <Link href={`/playground/${p.id}`} className="btn btn-sm btn-primary"><ExternalLink size={12} /> Open</Link>
                  <button className="btn btn-sm btn-ghost" title="Rename" onClick={() => { setRenaming(p.id); setRenameVal(p.title); }}><Pencil size={12} /></button>
                  <button className="btn btn-sm btn-ghost" title="Duplicate" onClick={() => actions.duplicate(p.id)}><Copy size={12} /></button>
                  {!p.demo && <button className="btn btn-sm btn-ghost text-dangerc" title="Delete" onClick={() => actions.remove(p.id)}><Trash2 size={12} /></button>}
                </div>
                <div className="text-[10px] text-mut mt-2.5">Updated {new Date(p.updatedAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        <div className="card p-5 mt-6 fade-up">
          <div className="flex items-center gap-3 flex-wrap">
            <Sparkles size={16} className="text-violetc" />
            <div className="text-[13px] flex-1 min-w-[220px]">
              <b>Belum tahu mulai dari mana?</b> Coba demo <i>Student Grade Checker</i> — buka, klik <b>Convert to Pseudocode + Code</b>, lalu <b>Run</b> dan <b>Visualize</b>.
            </div>
            <Link href="/playground/demo-grade-checker" className="btn btn-blue btn-sm"><FlaskConical size={13} /> Try the demo</Link>
            <Link href="/challenges" className="btn btn-sm"><Workflow size={13} /> Browse challenges</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Shell>
      <Suspense fallback={<div className="p-8 text-mut text-[13px]">Loading…</div>}>
        <ProjectsInner />
      </Suspense>
    </Shell>
  );
}
