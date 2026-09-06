"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/shell";
import { TutorPanel } from "@/components/pg/panels";
import type { IRProgram } from "@/lib/ir/types";
import type { NLResult, TutorReply, TutorMode } from "@/lib/ir/tutor";
import { irToFlowchart } from "@/lib/ir/flowchart";
import { irToPseudocode } from "@/lib/ir/pseudocode";
import { irToCode } from "@/lib/ir/codegen";
import { LANGUAGES } from "@/lib/ir/types";
import { Sparkles, Info } from "lucide-react";

export default function TutorPage() {
  const [program, setProgram] = useState<IRProgram>({ statements: [], vars: [] });
  const [problem, setProblem] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [log, setLog] = useState<(TutorReply & { at: number })[]>([]);
  const [busy, setBusy] = useState(false);
  const [nl, setNl] = useState<NLResult | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const list = await fetch("/api/projects").then(r => r.json());
      const p = (list.projects ?? [])[0];
      if (!p) return;
      const full = await fetch(`/api/projects/${p.id}`).then(r => r.json());
      if (full.project?.ir) setProgram(full.project.ir);
      setProblem(full.project?.problem ?? "");
      setProjectTitle(full.project?.title ?? "");
    })();
  }, []);

  const ask = async (mode: TutorMode) => {
    setBusy(true);
    fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "hint_requested", detail: `AI Tutor page — ${mode}` }) }).catch(() => { });
    try {
      const r = await fetch("/api/tutor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, program, problem }),
      });
      const reply = await r.json();
      setLog(l => [...l, { ...reply, at: Date.now() }]);
    } finally { setBusy(false); }
  };

  const runNL = async (desc: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/tutor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "nl2algo", description: desc }),
      });
      setNl(await r.json());
    } finally { setBusy(false); }
  };

  const applyNL = async () => {
    if (!nl) return;
    const prog = nl.program;
    const flowchart = irToFlowchart(prog);
    const pseudo = irToPseudocode(prog);
    const codes: Record<string, unknown> = {};
    for (const l of LANGUAGES) { const g = irToCode(prog, l.id); codes[l.id] = { code: g.code, map: g.map }; }
    const created = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "AI Generated Algorithm", problem: `Input: ${nl.understanding.input}\nProcess: ${nl.understanding.process}\nOutput: ${nl.understanding.output}` }),
    }).then(r => r.json());
    const full = await fetch(`/api/projects/${created.id}`).then(r => r.json());
    await fetch(`/api/projects/${created.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...full.project, flowchart, pseudocode: pseudo.text, ir: prog, codes }),
    });
    router.push(`/playground/${created.id}`);
  };

  return (
    <Shell>
      <div className="h-full flex flex-col min-h-0">
        <div className="px-5 h-14 border-b border-line flex items-center gap-3 flex-shrink-0">
          <Sparkles size={17} className="text-violetc" />
          <div>
            <h1 className="font-bold text-[15px]">AI Tutor</h1>
            <div className="text-[11px] text-mut">{projectTitle ? `context: "${projectTitle}"` : "no project context"}</div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-mut max-w-[440px]">
            <Info size={12} className="flex-shrink-0" />
            Rule-based pedagogical engine — Socratic questioning first, answers last. Designed so an LLM provider can be plugged in behind the same API.
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <TutorPanel log={log} busy={busy} onAsk={ask} onNL={runNL} nl={nl} onApplyNL={applyNL} onClear={() => setLog([])} />
        </div>
      </div>
    </Shell>
  );
}
