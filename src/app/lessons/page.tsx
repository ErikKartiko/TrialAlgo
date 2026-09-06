"use client";

import { useState } from "react";
import Shell from "@/components/shell";
import { LESSONS, type Lesson } from "@/lib/samples";
import { BookOpen, Clock, ChevronLeft, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LessonsPage() {
  const [active, setActive] = useState<Lesson | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  if (active) {
    const idx = LESSONS.indexOf(active);
    return (
      <Shell>
        <div className="h-full overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-6 py-8">
            <button className="btn btn-sm btn-ghost mb-5" onClick={() => setActive(null)}><ChevronLeft size={14} /> All lessons</button>
            <div className="fade-up">
              <div className="flex items-center gap-2 text-[11px] text-mut">
                <span className="chip chip-blue">{active.level}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {active.minutes} min read</span>
              </div>
              <h1 className="text-[26px] font-bold tracking-tight mt-2">{active.title}</h1>
              <div className="space-y-6 mt-6">
                {active.sections.map((s, i) => (
                  <section key={i} className="card p-5">
                    <h2 className="text-[15px] font-bold flex items-center gap-2"><span className="w-5 h-5 rounded-md bg-panel2 border border-line flex items-center justify-center text-[10px] text-accent2">{i + 1}</span>{s.heading}</h2>
                    <p className="text-[13.5px] text-mut leading-relaxed mt-2.5">{s.body}</p>
                  </section>
                ))}
              </div>
              <div className="flex gap-2 mt-6">
                <button className="btn btn-primary" onClick={() => { setDone(d => new Set(d).add(active.id)); setActive(LESSONS[idx + 1] ?? null); }}>
                  <CheckCircle2 size={14} /> Mark complete{LESSONS[idx + 1] ? " & next" : ""}
                </button>
                <Link href="/playground/latest" className="btn">Practice in Playground <ArrowRight size={14} /></Link>
              </div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-[950px] mx-auto px-6 py-7">
          <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2 fade-up"><BookOpen size={20} className="text-accent2" /> Lessons</h1>
          <p className="text-[13px] text-mut mt-0.5 fade-up">Konsep dasar algoritma — singkat, langsung, bisa langsung dipraktikkan di Playground.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            {LESSONS.map((l, i) => (
              <button key={l.id} onClick={() => setActive(l)} className="card p-5 text-left fade-up hover:border-[color:var(--muted)] transition-colors group">
                <div className="flex items-center gap-2 text-[11px] text-mut">
                  <span className="chip chip-blue">{l.level}</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {l.minutes} min</span>
                  {done.has(l.id) && <CheckCircle2 size={13} className="text-accent ml-auto" />}
                </div>
                <h3 className="font-bold text-[16px] mt-2 group-hover:text-accent transition-colors">{i + 1}. {l.title}</h3>
                <p className="text-[12.5px] text-mut mt-1">{l.summary}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
