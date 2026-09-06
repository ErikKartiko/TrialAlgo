"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/shell";
import { GraduationCap, Users, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { ScoreBar } from "@/components/pg/panels";

interface Assignment { id: string; title: string; weights: { flowchart: number; pseudocode: number; code: number; tests: number } }
interface Submission {
  id: string; assignmentId: string; studentName: string;
  scoreFlowchart: number; scorePseudocode: number; scoreCode: number; scoreTests: number;
  hintsUsed: number; mistakes: string[]; createdAt: string;
}

export default function ClassPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [student, setStudent] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/assignments").then(r => r.json()).then(d => {
      setAssignments(d.assignments ?? []);
      setSubmissions(d.submissions ?? []);
    });
  }, []);

  const stats = useMemo(() => {
    const w = assignments[0]?.weights ?? { flowchart: 20, pseudocode: 20, code: 40, tests: 20 };
    const n = submissions.length || 1;
    const avg = (k: (s: Submission) => number, max: number) => Math.round(submissions.reduce((a, s) => a + k(s), 0) / n / max * 100) || 0;
    const totals = submissions.map(s => s.scoreFlowchart + s.scorePseudocode + s.scoreCode + s.scoreTests);
    const avgScore = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;

    const mistakeCount = new Map<string, number>();
    for (const s of submissions) for (const m of s.mistakes) mistakeCount.set(m, (mistakeCount.get(m) ?? 0) + 1);
    const mistakes = [...mistakeCount.entries()].sort((a, b) => b[1] - a[1]);

    const byStudent = new Map<string, Submission[]>();
    for (const s of submissions) {
      if (!byStudent.has(s.studentName)) byStudent.set(s.studentName, []);
      byStudent.get(s.studentName)!.push(s);
    }
    return { w, avgScore, flow: avg(s => s.scoreFlowchart, w.flowchart), pseudo: avg(s => s.scorePseudocode, w.pseudocode), code: avg(s => s.scoreCode, w.code), testsAvg: avg(s => s.scoreTests, w.tests), mistakes, byStudent };
  }, [assignments, submissions]);

  const studentSubs = student ? stats.byStudent.get(student) ?? [] : [];

  return (
    <Shell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1080px] mx-auto px-6 py-7">
          <div className="fade-up">
            <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2"><GraduationCap size={21} className="text-accent2" /> My Class — Teacher Dashboard</h1>
            <p className="text-[13px] text-mut mt-0.5">Performa kelas, kesalahan umum, dan progres tiap mahasiswa.</p>
          </div>

          {/* overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 fade-up">
            <div className="card px-4 py-3.5 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-panel2 border border-line flex items-center justify-center"><Users size={15} className="text-accent2" /></span>
              <div><div className="text-[20px] font-bold leading-none">{stats.byStudent.size}</div><div className="text-[11px] text-mut mt-1">Students</div></div>
            </div>
            <div className="card px-4 py-3.5 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-panel2 border border-line flex items-center justify-center"><TrendingUp size={15} className="text-accent" /></span>
              <div><div className="text-[20px] font-bold leading-none">{stats.avgScore}</div><div className="text-[11px] text-mut mt-1">Average Score</div></div>
            </div>
            <div className="card px-4 py-3.5 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-panel2 border border-line flex items-center justify-center"><Lightbulb size={15} className="text-warnc" /></span>
              <div><div className="text-[20px] font-bold leading-none">{submissions.reduce((a, s) => a + s.hintsUsed, 0)}</div><div className="text-[11px] text-mut mt-1">Hints Used</div></div>
            </div>
            <div className="card px-4 py-3.5 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-panel2 border border-line flex items-center justify-center"><AlertTriangle size={15} className="text-dangerc" /></span>
              <div><div className="text-[20px] font-bold leading-none">{stats.mistakes.reduce((a, m) => a + m[1], 0)}</div><div className="text-[11px] text-mut mt-1">Mistake Reports</div></div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="card p-5 fade-up">
              <div className="text-[11px] font-bold tracking-[0.12em] text-mut mb-4">CLASS PERFORMANCE (rata-rata per komponen)</div>
              <div className="space-y-3.5">
                <ScoreBar label="Flowchart" value={stats.flow} />
                <ScoreBar label="Pseudocode" value={stats.pseudo} />
                <ScoreBar label="Coding" value={stats.code} />
                <ScoreBar label="Test Cases" value={stats.testsAvg} />
              </div>
            </div>
            <div className="card p-5 fade-up">
              <div className="text-[11px] font-bold tracking-[0.12em] text-mut mb-4">COMMON MISTAKES</div>
              <div className="space-y-2.5">
                {stats.mistakes.length ? stats.mistakes.map(([m, c], i) => {
                  const pct = Math.round(c / stats.byStudent.size * 100);
                  return (
                    <div key={m}>
                      <div className="flex justify-between text-[12px] mb-1">
                        <span className="flex items-center gap-2"><span className="text-mut mono w-4">{i + 1}.</span>{m}</span>
                        <span className="text-mut mono">{pct}%</span>
                      </div>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#f59e0b,#ef4444)" }} /></div>
                    </div>
                  );
                }) : <div className="text-[12px] text-mut">No mistakes reported yet.</div>}
              </div>
            </div>
          </div>

          {/* students */}
          <div className="grid md:grid-cols-[280px_1fr] gap-4 mt-4">
            <div className="card p-3">
              <div className="text-[11px] font-bold tracking-[0.12em] text-mut px-2 py-2">STUDENTS</div>
              <div className="space-y-1">
                {[...stats.byStudent.entries()].map(([name, subs]) => {
                  const tot = subs.reduce((a, s) => a + s.scoreFlowchart + s.scorePseudocode + s.scoreCode + s.scoreTests, 0) / subs.length;
                  return (
                    <button
                      key={name}
                      onClick={() => setStudent(name)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors ${student === name ? "bg-panel2 border border-line" : "hover:bg-panel2/50 border border-transparent"}`}
                    >
                      <span className="font-medium">{name}</span>
                      <span className={`mono text-[11px] font-bold ${tot >= 80 ? "text-accent" : tot >= 60 ? "text-warnc" : "text-dangerc"}`}>{Math.round(tot)}</span>
                    </button>
                  );
                })}
                {!stats.byStudent.size && <div className="text-mut text-[12px] px-3 py-4">No students yet.</div>}
              </div>
            </div>
            <div className="card p-5 min-h-[220px]">
              {!student ? (
                <div className="text-mut text-[13px]">Pilih mahasiswa untuk melihat detail: assignments, attempts, errors, dan hint usage.</div>
              ) : (
                <>
                  <h3 className="font-bold text-[16px] mb-3">{student}</h3>
                  <table className="w-full text-[12px]">
                    <thead><tr className="text-mut text-[10px] uppercase"><th className="text-left pb-2">Assignment</th><th className="text-right pb-2">FC</th><th className="text-right pb-2">PS</th><th className="text-right pb-2">Code</th><th className="text-right pb-2">Tests</th><th className="text-right pb-2">Total</th><th className="text-right pb-2">Hints</th></tr></thead>
                    <tbody>
                      {studentSubs.map(s => (
                        <tr key={s.id} className="border-t border-line">
                          <td className="py-2">{assignments.find(a => a.id === s.assignmentId)?.title ?? "—"}</td>
                          <td className="text-right mono">{s.scoreFlowchart}</td>
                          <td className="text-right mono">{s.scorePseudocode}</td>
                          <td className="text-right mono">{s.scoreCode}</td>
                          <td className="text-right mono">{s.scoreTests}</td>
                          <td className="text-right mono font-bold">{s.scoreFlowchart + s.scorePseudocode + s.scoreCode + s.scoreTests}</td>
                          <td className="text-right mono">{s.hintsUsed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {studentSubs.some(s => s.mistakes.length) && (
                    <div className="mt-4">
                      <div className="text-[10px] font-bold tracking-[0.12em] text-mut mb-1.5">RECORDED ERRORS</div>
                      <div className="space-y-1">
                        {[...new Set(studentSubs.flatMap(s => s.mistakes))].map(m => (
                          <div key={m} className="flex items-start gap-2 text-[12px] text-warnc"><AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />{m}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
