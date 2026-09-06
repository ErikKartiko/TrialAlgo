"use client";

import { useState } from "react";
import Shell, { useTheme } from "@/components/shell";
import { Sun, Moon, Keyboard, Database, ShieldAlert, Trash2, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const { light, toggle } = useTheme();
  const [resetDone, setResetDone] = useState(false);

  const resetProjects = async () => {
    if (!confirm("Hapus semua project NON-demo? Project demo akan tetap ada.")) return;
    const list = await fetch("/api/projects").then(r => r.json());
    for (const p of list.projects ?? []) {
      if (!p.demo) await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    }
    setResetDone(true);
    setTimeout(() => setResetDone(false), 2500);
  };

  const SHORTCUTS: [string, string][] = [
    ["Ctrl/Cmd + Z", "Undo (flowchart)"],
    ["Ctrl/Cmd + Y / Shift+Z", "Redo (flowchart)"],
    ["Ctrl/Cmd + D", "Duplicate selected node"],
    ["Delete / Backspace", "Delete selected node or edge"],
    ["Shift + drag", "Select multiple nodes"],
    ["Scroll", "Zoom canvas"],
    ["Drag on canvas", "Pan"],
    ["Click code line", "Sync-highlight across representations"],
  ];

  return (
    <Shell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-6 py-7 space-y-5">
          <h1 className="text-[22px] font-bold tracking-tight fade-up">Settings</h1>

          <div className="card p-5 fade-up">
            <h3 className="font-bold text-[15px] mb-1">Appearance</h3>
            <p className="text-[12px] text-mut mb-3">Dark and light themes — your choice is remembered.</p>
            <button className="btn" onClick={toggle}>{light ? <Moon size={14} /> : <Sun size={14} />} Switch to {light ? "dark" : "light"} mode</button>
          </div>

          <div className="card p-5 fade-up">
            <h3 className="font-bold text-[15px] mb-1 flex items-center gap-2"><ShieldAlert size={15} className="text-warnc" /> Code Execution</h3>
            <p className="text-[12px] text-mut leading-relaxed">
              AlgoStudio runs in <b>Demo Execution Mode</b>: the <i>Run</i>, <i>Tests</i> and <i>Visualizer</i> features execute the
              <b> Algorithm IR</b> through a step-recording interpreter — honest execution of your algorithm&apos;s logic, not machine-compiled binaries.
              The execution layer is abstracted (<code className="mono">POST /api/execute</code>) so a sandboxed compiler service
              (Docker containers / Judge0 with CPU, RAM, time, process and network limits) can be connected without changing the frontend.
            </p>
          </div>

          <div className="card p-5 fade-up">
            <h3 className="font-bold text-[15px] mb-3 flex items-center gap-2"><Keyboard size={15} /> Keyboard Shortcuts</h3>
            <div className="grid sm:grid-cols-2 gap-x-8">
              {SHORTCUTS.map(([k, v]) => (
                <div key={v} className="flex items-center justify-between py-1.5 border-b border-line/60 text-[12px]">
                  <span className="text-mut">{v}</span>
                  <kbd className="mono text-[10.5px] bg-panel2 border border-line rounded-md px-1.5 py-0.5">{k}</kbd>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 fade-up">
            <h3 className="font-bold text-[15px] mb-1 flex items-center gap-2"><Database size={15} /> Data</h3>
            <p className="text-[12px] text-mut mb-3">Projects persist in PostgreSQL with autosave. Demo projects are read-only templates and can&apos;t be deleted.</p>
            <button className="btn text-dangerc" onClick={resetProjects}><Trash2 size={14} /> Delete my non-demo projects</button>
            {resetDone && <span className="ml-3 text-[12px] text-accent inline-flex items-center gap-1"><CheckCircle2 size={13} /> Done</span>}
          </div>

          <div className="text-[11px] text-mut fade-up">AlgoStudio v1 — Design the logic once. See it everywhere.</div>
        </div>
      </div>
    </Shell>
  );
}
