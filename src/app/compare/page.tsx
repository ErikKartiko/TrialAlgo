"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/shell";
import SrcEditor, { type EditorLang } from "@/components/pg/srceditor";
import { LANGUAGES, type Language, type LineMap } from "@/lib/ir/types";
import { Columns2, Info } from "lucide-react";

interface Stored { title?: string; codes?: Partial<Record<Language, { code: string; map: LineMap }>> }

export default function ComparePage() {
  const [data, setData] = useState<Stored>({});
  const [projectTitle, setProjectTitle] = useState("");
  const [left, setLeft] = useState<Language>("cpp");
  const [right, setRight] = useState<Language>("python");
  const [syncId, setSyncId] = useState<string | null>(null);

  useEffect(() => {
    // 1) explicit handoff from the playground export menu
    const handoff = sessionStorage.getItem("algostudio-compare");
    if (handoff) {
      try {
        const d = JSON.parse(handoff);
        setData(d); setProjectTitle(d.title ?? "Project");
        return;
      } catch { /* fallthrough */ }
    }
    // 2) fallback: latest project
    fetch("/api/projects").then(r => r.json()).then(d => {
      const p = (d.projects ?? [])[0];
      if (p) {
        fetch(`/api/projects/${p.id}`).then(r => r.json()).then(full => {
          setData(full.project ?? {});
          setProjectTitle(full.project?.title ?? "");
        });
      }
    });
  }, []);

  const editorLang = (l: Language): EditorLang => (l === "python" ? "python" : "clike");

  const pick = (side: "left" | "right") => (l: number) => {
    const src = side === "left" ? left : right;
    const m = data.codes?.[src]?.map;
    if (!m) return;
    for (const [sid, [a, b]] of Object.entries(m)) {
      if (l >= a && l <= b) { setSyncId(sid); return; }
    }
    setSyncId(null);
  };
  const hlOf = (l: Language): [number, number] | null => {
    if (!syncId) return null;
    return data.codes?.[l]?.map[syncId] ?? null;
  };

  const LangSel = ({ value, onChange }: { value: Language; onChange: (l: Language) => void }) => (
    <div className="flex gap-0.5">
      {LANGUAGES.map(l => (
        <button key={l.id} onClick={() => onChange(l.id)}
          className={`px-2 py-1 rounded-md text-[11px] font-semibold ${value === l.id ? "bg-panel2 border border-line text-app" : "text-mut hover:text-app"}`}>
          {l.name}
        </button>
      ))}
    </div>
  );

  return (
    <Shell>
      <div className="h-full flex flex-col min-h-0">
        <div className="px-5 h-14 border-b border-line flex items-center gap-3 flex-shrink-0">
          <Columns2 size={17} className="text-accent2" />
          <div>
            <h1 className="font-bold text-[15px]">Compare Languages</h1>
            <div className="text-[11px] text-mut">{projectTitle ? `from project "${projectTitle}"` : "Same algorithm, different syntax."}</div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-mut max-w-[380px]">
            <Info size={12} className="flex-shrink-0" />
            Click a line on either side — both panes highlight the same algorithm step. Same algorithm, different syntax.
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 min-h-0">
          {(["left", "right"] as const).map(side => {
            const l = side === "left" ? left : right;
            const set = side === "left" ? setLeft : setRight;
            const other = side === "left" ? right : left;
            const d = data.codes?.[l];
            void other;
            return (
              <div key={side} className={`flex flex-col min-h-0 ${side === "left" ? "border-r border-line" : ""}`}>
                <div className="h-10 border-b border-line flex items-center px-3 flex-shrink-0">
                  <LangSel value={l} onChange={set} />
                  <span className="ml-auto chip mono">{LANGUAGES.find(x => x.id === l)?.file}</span>
                </div>
                <div className="flex-1 min-h-0 relative">
                  <SrcEditor
                    value={d?.code ?? "// No generated code for this language yet.\n// Open the project in the Playground and click Convert."}
                    lang={editorLang(l)} readOnly hlRange={hlOf(l)} onLineClick={pick(side)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
