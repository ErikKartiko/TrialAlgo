"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/shell";
import { CHALLENGES, type Challenge } from "@/lib/samples";
import { Target, ChevronRight, Lightbulb, PlayCircle, X, Trophy, Layers, GitFork, Repeat2, Grid2x2, Type, FunctionSquare, Search, ArrowDownWideNarrow, Braces } from "lucide-react";

const CAT_ICON: Record<string, React.ReactNode> = {
  Sequence: <Layers size={13} />, Selection: <GitFork size={13} />, "Nested Selection": <GitFork size={13} />,
  Loop: <Repeat2 size={13} />, "Nested Loop": <Grid2x2 size={13} />, Array: <Braces size={13} />,
  String: <Type size={13} />, Function: <FunctionSquare size={13} />, Recursion: <Repeat2 size={13} />,
  Searching: <Search size={13} />, Sorting: <ArrowDownWideNarrow size={13} />,
};

const DIFF_CLS: Record<Challenge["difficulty"], string> = {
  Beginner: "chip-green", Intermediate: "chip-blue", Advanced: "chip-amber", Expert: "chip-red",
};

export default function ChallengesPage() {
  const [cat, setCat] = useState<string>("All");
  const [diff, setDiff] = useState<string>("All");
  const [active, setActive] = useState<Challenge | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const router = useRouter();

  const cats = ["All", ...Array.from(new Set(CHALLENGES.map(c => c.category)))];
  const diffs = ["All", "Beginner", "Intermediate", "Advanced", "Expert"];
  const shown = useMemo(() => CHALLENGES.filter(c =>
    (cat === "All" || c.category === cat) && (diff === "All" || c.difficulty === diff)), [cat, diff]);

  const start = async (c: Challenge) => {
    fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "project_created", detail: `Challenge: ${c.title}` }) }).catch(() => { });
    const r = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Challenge — ${c.title}`,
        problem: `${c.problem}\n\nInput: ${c.inputFormat}\nOutput: ${c.outputFormat}\n\nContoh:\ninput:  ${c.examples[0].input}\noutput: ${c.examples[0].output.replace(/\n/g, " | ")}`,
      }),
    }).then(r => r.json());
    router.push(`/playground/${r.id}`);
  };

  return (
    <Shell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1050px] mx-auto px-6 py-7">
          <div className="fade-up">
            <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2"><Trophy size={20} className="text-warnc" /> Challenges</h1>
            <p className="text-[13px] text-mut mt-0.5">Latihan bertingkat dari Sequence sampai Searching. Setiap challenge terbuka langsung di Playground sebagai project baru.</p>
          </div>

          <div className="flex gap-2 mt-5 flex-wrap fade-up">
            {cats.map(c => (
              <button key={c} className={`btn btn-sm ${cat === c ? "btn-blue" : ""}`} onClick={() => setCat(c)}>{CAT_ICON[c]}{c}</button>
            ))}
            <div className="w-px bg-line mx-1" />
            {diffs.map(d => (
              <button key={d} className={`btn btn-sm ${diff === d ? "border-[color:var(--accent-2)] text-accent2" : ""}`} onClick={() => setDiff(d)}>{d}</button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {shown.map(c => (
              <div key={c.id} className="card p-4 fade-up flex flex-col hover:border-[color:var(--muted)] transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-accent2">{CAT_ICON[c.category]}</span>
                  <span className="text-[11px] text-mut">{c.category}</span>
                  <span className={`chip ml-auto ${DIFF_CLS[c.difficulty]}`}>{c.difficulty}</span>
                </div>
                <h3 className="font-bold text-[15px] mt-2">{c.title}</h3>
                <p className="text-[12px] text-mut mt-1 line-clamp-2 flex-1">{c.problem}</p>
                <button className="btn btn-sm mt-3 self-start" onClick={() => { setActive(c); setHintsShown(0); }}>
                  <Target size={12} /> View & Start
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* detail modal */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActive(null)} />
          <div className="relative card max-w-[640px] w-full p-6 fade-up max-h-[86vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] text-mut">
                  <span>{active.category}</span>·<span className={DIFF_CLS[active.difficulty].replace("chip ", "chip ")}>{active.difficulty}</span>
                </div>
                <h2 className="text-[19px] font-bold mt-1">{active.title}</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setActive(null)}><X size={15} /></button>
            </div>

            <div className="mt-4 space-y-4 text-[13px]">
              <div><div className="text-[10px] font-bold tracking-[0.12em] text-mut mb-1">PROBLEM</div><p>{active.problem}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line bg-panel2 p-3"><div className="text-[10px] font-bold text-mut mb-1">INPUT FORMAT</div>{active.inputFormat}</div>
                <div className="rounded-xl border border-line bg-panel2 p-3"><div className="text-[10px] font-bold text-mut mb-1">OUTPUT FORMAT</div>{active.outputFormat}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-[0.12em] text-mut mb-1.5">EXAMPLES</div>
                {active.examples.map((ex, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 mb-2">
                    <div className="mono text-[12px] rounded-lg border border-line bg-soft p-2.5"><span className="text-mut text-[9px] font-sans font-bold block mb-1">INPUT</span>{ex.input}</div>
                    <div className="mono text-[12px] rounded-lg border border-line bg-soft p-2.5 whitespace-pre-wrap"><span className="text-mut text-[9px] font-sans font-bold block mb-1">OUTPUT</span>{ex.output}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-[0.12em] text-mut mb-1.5">HINTS — Practice Mode (terbuka bertahap)</div>
                {active.hints.slice(0, hintsShown).map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] rounded-lg border border-line bg-panel2 p-2.5 mb-1.5 fade-up">
                    <Lightbulb size={12} className="text-warnc mt-0.5 flex-shrink-0" /> <span><b>Hint {i + 1}:</b> {h}</span>
                  </div>
                ))}
                {hintsShown < active.hints.length && (
                  <button className="btn btn-sm" onClick={() => {
                    setHintsShown(h => h + 1);
                    fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "hint_requested", detail: `Challenge ${active.title} — hint ${hintsShown + 1}` }) }).catch(() => { });
                  }}>
                    <Lightbulb size={12} /> Show Hint {hintsShown + 1}/{active.hints.length}
                  </button>
                )}
              </div>
              <button className="btn btn-primary w-full" onClick={() => start(active)}>
                <PlayCircle size={15} /> Start in Playground <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
