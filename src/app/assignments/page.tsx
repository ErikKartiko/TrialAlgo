"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { ClipboardList, Plus, Send, Check, X, Users } from "lucide-react";

interface Assignment {
  id: string; title: string; description: string; className: string; language: string; dueAt: string;
  requireFlowchart: boolean; requirePseudocode: boolean; requireCode: boolean;
  weights: { flowchart: number; pseudocode: number; code: number; tests: number };
}
interface Submission {
  id: string; assignmentId: string; studentName: string;
  scoreFlowchart: number; scorePseudocode: number; scoreCode: number; scoreTests: number;
  feedback: string; hintsUsed: number; mistakes: string[]; createdAt: string;
}

const LANGS = [["c", "C"], ["cpp", "C++"], ["csharp", "C#"], ["python", "Python"], ["java", "Java"]] as const;

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", className: "IF-01 — Algoritma & Pemrograman", language: "cpp", dueAt: "",
    requireFlowchart: true, requirePseudocode: true, requireCode: true,
    wFlow: 20, wPseudo: 20, wCode: 40, wTests: 20,
  });
  const [fb, setFb] = useState<Record<string, string>>({});
  const [fbSaved, setFbSaved] = useState<string | null>(null);

  const load = () => fetch("/api/assignments").then(r => r.json()).then(d => {
    setAssignments(d.assignments ?? []);
    setSubmissions(d.submissions ?? []);
    if (!sel && d.assignments?.length) setSel(d.assignments[0].id);
  });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = assignments.find(a => a.id === sel);
  const subs = useMemo(() => submissions.filter(s => s.assignmentId === sel), [submissions, sel]);

  const create = async () => {
    await fetch("/api/assignments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create", title: form.title, description: form.description, className: form.className,
        language: form.language, dueAt: form.dueAt,
        requireFlowchart: form.requireFlowchart, requirePseudocode: form.requirePseudocode, requireCode: form.requireCode,
        weights: { flowchart: form.wFlow, pseudocode: form.wPseudo, code: form.wCode, tests: form.wTests },
      }),
    });
    setCreating(false);
    load();
  };

  const saveFeedback = async (submissionId: string) => {
    await fetch("/api/assignments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "feedback", submissionId, feedback: fb[submissionId] ?? "" }),
    });
    setFbSaved(submissionId);
    setTimeout(() => setFbSaved(null), 1800);
    load();
  };

  const totalOf = (s: Submission) => s.scoreFlowchart + s.scorePseudocode + s.scoreCode + s.scoreTests;
  const w = active?.weights ?? { flowchart: 20, pseudocode: 20, code: 40, tests: 20 };

  return (
    <Shell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1080px] mx-auto px-6 py-7">
          <div className="flex items-end justify-between mb-5 fade-up">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2"><ClipboardList size={20} className="text-accent2" /> Assignments</h1>
              <p className="text-[13px] text-mut mt-0.5">Buat tugas dengan komponen flowchart/pseudocode/code & bobot nilai, lalu nilai submission mahasiswa.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setCreating(!creating)}><Plus size={15} /> New Assignment</button>
          </div>

          {creating && (
            <div className="card p-5 mb-5 fade-up">
              <h3 className="font-bold text-[15px] mb-3">Create Assignment</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className="text-[11px] font-bold text-mut">TITLE</label>
                  <input className="input mt-1" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="cth: Program Nilai Mahasiswa" /></div>
                <div className="sm:col-span-2"><label className="text-[11px] font-bold text-mut">DESCRIPTION</label>
                  <textarea className="textarea mt-1" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><label className="text-[11px] font-bold text-mut">CLASS</label>
                  <input className="input mt-1" value={form.className} onChange={e => setForm(f => ({ ...f, className: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] font-bold text-mut">LANGUAGE</label>
                    <select className="select mt-1" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                      {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select></div>
                  <div><label className="text-[11px] font-bold text-mut">DUE</label>
                    <input className="input mt-1" value={form.dueAt} onChange={e => setForm(f => ({ ...f, dueAt: e.target.value }))} placeholder="Jumat, 23:59" /></div>
                </div>
                <div className="sm:col-span-2 flex gap-4 items-center text-[12px]">
                  <span className="font-bold text-[11px] text-mut">REQUIRED:</span>
                  {([["requireFlowchart", "Flowchart"], ["requirePseudocode", "Pseudocode"], ["requireCode", "Code"]] as const).map(([k, l]) => (
                    <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} className="accent-emerald-400" /> {l}
                    </label>
                  ))}
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[11px] font-bold text-mut mb-1.5">SCORE WEIGHTS (total = {(form.wFlow + form.wPseudo + form.wCode + form.wTests)}%)</div>
                  <div className="grid grid-cols-4 gap-2">
                    {([["wFlow", "Flowchart"], ["wPseudo", "Pseudocode"], ["wCode", "Code"], ["wTests", "Tests"]] as const).map(([k, l]) => (
                      <div key={k}>
                        <label className="text-[10px] text-mut">{l} %</label>
                        <input className="input mono mt-0.5" type="number" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: Number(e.target.value) }))} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="btn btn-primary" onClick={create} disabled={!form.title}>Create</button>
                <button className="btn" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-[300px_1fr] gap-4">
            {/* assignment list */}
            <div className="space-y-2.5">
              {assignments.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSel(a.id)}
                  className={`w-full text-left card p-4 transition-colors ${sel === a.id ? "border-[color:var(--accent-2)]" : "hover:border-[color:var(--muted)]"}`}
                >
                  <div className="font-semibold text-[14px]">{a.title}</div>
                  <div className="text-[11px] text-mut mt-1">{a.className}</div>
                  <div className="flex gap-1 mt-2.5 flex-wrap">
                    {a.requireFlowchart && <span className="chip chip-violet">Flowchart</span>}
                    {a.requirePseudocode && <span className="chip chip-amber">Pseudocode</span>}
                    {a.requireCode && <span className="chip chip-green">{LANGS.find(l => l[0] === a.language)?.[1] ?? a.language}</span>}
                    {a.dueAt && <span className="chip chip-red">{a.dueAt}</span>}
                  </div>
                </button>
              ))}
            </div>

            {/* submissions */}
            <div className="card p-5 min-h-[300px]">
              {!active ? <div className="text-mut text-[13px]">Select an assignment.</div> : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={15} className="text-accent2" />
                    <h3 className="font-bold text-[15px]">{active.title} — Submissions</h3>
                    <span className="chip">{subs.length} students</span>
                  </div>
                  <p className="text-[12px] text-mut mb-4">{active.description}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-mut text-[10px] uppercase tracking-wide">
                          <th className="text-left pb-2">Student</th>
                          <th className="text-right pb-2">Flowchart /{w.flowchart}</th>
                          <th className="text-right pb-2">Pseudo /{w.pseudocode}</th>
                          <th className="text-right pb-2">Code /{w.code}</th>
                          <th className="text-right pb-2">Tests /{w.tests}</th>
                          <th className="text-right pb-2">Total</th>
                          <th className="text-right pb-2">Hints</th>
                          <th className="text-left pb-2 pl-3">Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subs.map(s => (
                          <tr key={s.id} className="border-t border-line align-top">
                            <td className="py-2.5 pr-3 font-medium">
                              {s.studentName}
                              {s.mistakes.length > 0 && (
                                <div className="text-[10px] text-warnc font-normal mt-0.5">{s.mistakes[0]}{s.mistakes.length > 1 ? ` +${s.mistakes.length - 1}` : ""}</div>
                              )}
                            </td>
                            <td className="text-right mono">{s.scoreFlowchart}</td>
                            <td className="text-right mono">{s.scorePseudocode}</td>
                            <td className="text-right mono">{s.scoreCode}</td>
                            <td className="text-right mono">{s.scoreTests}</td>
                            <td className="text-right mono font-bold">
                              <span className={totalOf(s) >= 80 ? "text-accent" : totalOf(s) >= 60 ? "text-warnc" : "text-dangerc"}>{totalOf(s)}</span>
                            </td>
                            <td className="text-right mono">{s.hintsUsed}</td>
                            <td className="pl-3 py-2 min-w-[180px]">
                              <div className="flex gap-1">
                                <input
                                  className="input text-[11px] py-1"
                                  placeholder="Write feedback…"
                                  value={fb[s.id] ?? s.feedback}
                                  onChange={e => setFb(f => ({ ...f, [s.id]: e.target.value }))}
                                />
                                <button className="btn btn-sm btn-primary" onClick={() => saveFeedback(s.id)} title="Save feedback">
                                  {fbSaved === s.id ? <Check size={12} /> : <Send size={12} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!subs.length && <tr><td colSpan={8} className="py-8 text-center text-mut"><X size={14} className="inline mr-1" /> No submissions yet for this assignment.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
