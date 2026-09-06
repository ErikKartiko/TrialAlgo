// AI Tutor — pattern-based pedagogical engine (rule-based, honest: not an LLM).
// Implements: explain / hint / debug / socratic / review + NL → Algorithm.
import type { IRProgram, Stmt, Expr } from "./types";
import { exprToPseudo, exprVars } from "./expr";
import { collectVars, uid } from "./types";
import { analyzeIR } from "./flowchart";
import { analyzeProgram } from "./analyzer";

export type TutorMode = "explain" | "hint" | "debug" | "socratic" | "review";

export interface TutorReply {
  mode: TutorMode;
  title: string;
  message: string;      // markdown-ish
  followUps?: string[];
}

const listStmts = (stmts: Stmt[], acc: Stmt[] = []): Stmt[] => {
  for (const s of stmts) {
    acc.push(s);
    if (s.kind === "if") { s.branches.forEach(b => listStmts(b.body, acc)); listStmts(s.elseBody, acc); }
    if (s.kind === "while" || s.kind === "dowhile" || s.kind === "for") listStmts(s.body, acc);
  }
  return acc;
};

export function tutorRespond(mode: TutorMode, prog: IRProgram, problem: string, error?: string): TutorReply {
  switch (mode) {
    case "explain": return explain(prog);
    case "hint": return hint(prog, problem);
    case "debug": return debug(prog, error);
    case "socratic": return socratic(prog, problem);
    case "review": return review(prog);
  }
}

function explain(prog: IRProgram): TutorReply {
  const parts: string[] = [];
  const narrate = (stmts: Stmt[], depth: number) => {
    const pad = "  ".repeat(depth);
    for (const s of stmts) {
      switch (s.kind) {
        case "input": parts.push(`${pad}1. Membaca nilai **${s.varName}** dari pengguna.`); break;
        case "assign": parts.push(`${pad}- Menghitung **${exprToPseudo(s.expr)}** dan menyimpannya ke **${s.target}**.`); break;
        case "output": parts.push(`${pad}- Menampilkan **${s.exprs.map(exprToPseudo).join(", ")}** ke layar.`); break;
        case "if":
          parts.push(`${pad}- Membuat **keputusan**: jika **${exprToPseudo(s.branches[0].cond)}** bernilai benar, maka:`);
          narrate(s.branches[0].body, depth + 1);
          if (s.elseBody.length) { parts.push(`${pad}  Jika tidak:`); narrate(s.elseBody, depth + 1); }
          break;
        case "while": parts.push(`${pad}- **Mengulang** selama **${exprToPseudo(s.cond)}**:`); narrate(s.body, depth + 1); break;
        case "dowhile": parts.push(`${pad}- Menjalankan blok **minimal sekali**, lalu mengulang selama **${exprToPseudo(s.cond)}**:`); narrate(s.body, depth + 1); break;
        case "for": parts.push(`${pad}- **Perulangan** dari ${s.varName} = ${exprToPseudo(s.from)} sampai ${exprToPseudo(s.to)}:`); narrate(s.body, depth + 1); break;
        case "call": parts.push(`${pad}- Memanggil fungsi **${s.name}**.`); break;
      }
    }
  };
  parts.push("Algoritma ini bekerja seperti ini:");
  narrate(prog.statements, 0);
  return {
    mode: "explain", title: "Penjelasan Algoritma",
    message: parts.join("\n"),
    followUps: ["Beri saya hint", "Review kualitas algoritma saya", "Tanya saya (mode Socratic)"],
  };
}

function hint(prog: IRProgram, problem: string): TutorReply {
  const issues = analyzeIR(prog);
  if (issues.length) {
    const i = issues[0];
    return {
      mode: "hint", title: "Hint — mulai dari sini",
      message: `Ada satu hal yang perlu diperiksa dulu:\n\n> ${i.message}\n\nCoba perbaiki bagian itu, lalu minta hint lagi kalau masih buntu.`,
      followUps: ["Jelaskan konsep yang terkait", "Tanya saya (mode Socratic)"],
    };
  }
  const stmts = listStmts(prog.statements);
  if (!prog.statements.length) {
    return {
      mode: "hint", title: "Hint 1 — pecahkan masalah",
      message: `Mulailah dari soal:\n\n**${problem || "(belum ada problem statement)"}**\n\nTanyakan pada diri sendiri:\n1. Apa **input** yang dibutuhkan? → buat node INPUT.\n2. Apa **proses** yang terjadi? → assignment atau keputusan (IF) atau perulangan (FOR/WHILE).\n3. Apa **output** akhirnya? → buat node OUTPUT.\n\nSusun dulu tiga hal itu di flowchart, hubungkan dengan panah, lalu konversi ke pseudocode.`,
      followUps: ["Jelaskan konsep Selection", "Lihat contoh project demo"],
    };
  }
  const hasIf = stmts.some(s => s.kind === "if");
  const hasLoop = stmts.some(s => ["while", "for", "dowhile"].includes(s.kind));
  return {
    mode: "hint", title: "Hint — arah berikutnya",
    message: hasIf
      ? "Logika IF kamu sudah terbentuk. Periksa **kondisi batas** (boundary): apakah operator perbandingan sudah tepat untuk nilai persis di ambang (mis. 75)? Lalu jalankan **Run Tests** dengan input tepat di batas itu."
      : hasLoop
        ? "Loop kamu sudah berjalan. Coba lacak manual (trace) dengan nilai kecil, mis. n = 3: tulis nilai setiap variabel setelah tiap iterasi. Bandingkan dengan hasil **Execution Visualizer**."
        : "Algoritma sekuensial kamu sudah lengkap. Coba klik **Run** dan **Analyze** untuk memeriksa hasil & kualitasnya.",
    followUps: ["Tanya saya (mode Socratic)", "Review kualitas algoritma saya"],
  };
}

function debug(prog: IRProgram, error?: string): TutorReply {
  if (error) {
    let friendly = error;
    if (/not defined/i.test(error)) {
      const v = error.match(/'(\w+)'/)?.[1];
      friendly = `Runtime error saat eksekusi.\n\nVariabel **${v ?? "?"}** dipakai sebelum diberi nilai.\n\n**Cara memperbaiki:** pastikan ada INPUT ${v ?? "variabel"} atau assignment \`${v ?? "x"} = ...\` *sebelum* baris yang menggunakannya.`;
    }
    if (/Division by zero/i.test(error)) {
      friendly = "Runtime error: **pembagian dengan nol**.\n\nPenyebab umum: penyebut belum diisi atau loop membuat penyebut menjadi 0. Tambahkan IF untuk menjaga penyebut ≠ 0.";
    }
    if (/never becomes FALSE|stopped after/i.test(error)) {
      friendly = "Sepertinya ada **infinite loop**: kondisi perulangan tidak pernah menjadi FALSE.\n\nCek: apakah variabel di kondisi loop diubah di dalam badan loop?";
    }
    return { mode: "debug", title: "Analisis Debug", message: friendly, followUps: ["Beri saya hint", "Jelaskan kode ini"] };
  }
  const issues = analyzeIR(prog);
  if (!issues.length) {
    return { mode: "debug", title: "Analisis Debug", message: "Tidak ditemukan masalah struktural dan eksekusi terakhir tidak menghasilkan error. Jalankan ulang dengan input berbeda atau cek **Test Cases** untuk menguji kasus tepi (boundary).", followUps: ["Review kualitas algoritma saya"] };
  }
  return {
    mode: "debug", title: "Analisis Debug",
    message: "Saya menemukan beberapa hal untuk diperiksa:\n\n" + issues.map(i => `- **${i.level === "error" ? "Error" : "Warning"}**: ${i.message}`).join("\n") + "\n\nPerbaiki yang berlabel Error terlebih dahulu.",
    followUps: ["Beri saya hint langkah demi langkah"],
  };
}

function socratic(prog: IRProgram, problem: string): TutorReply {
  const stmts = listStmts(prog.statements);
  const ifStmt = stmts.find((s): s is Extract<Stmt, { kind: "if" }> => s.kind === "if");
  const loopStmt = stmts.find((s): s is Extract<Stmt, { kind: "for" | "while" }> => s.kind === "for" || s.kind === "while");
  if (ifStmt) {
    const cond = ifStmt.branches[0].cond;
    const c = exprToPseudo(cond);
    let boundary = "";
    const b = findBoundary(cond);
    if (b) boundary = `\n\nJika **${b.v}** nilainya **tepat ${b.bound}**, menurut aturan soal apa yang seharusnya terjadi?\n\nDengan operator yang kamu tulis (\`${b.op}\`), apa yang benar-benar terjadi?`;
    return {
      mode: "socratic", title: "Pertanyaan untukmu",
      message: `Saya tidak akan memberi jawaban langsung — coba pikirkan ini:\n\n1. Baca lagi soal: *"${problem || "…"}"*\n2. Kondisi yang kamu tulis adalah **${c}**.${boundary}\n3. Kalau ada kasus yang lolos padahal seharusnya tidak (atau sebaliknya), bagian mana yang harus diubah?`,
      followUps: ["Saya sudah coba — beri hint", "Jelaskan konsep Selection"],
    };
  }
  if (loopStmt) {
    const desc = loopStmt.kind === "for"
      ? `dari ${exprToPseudo(loopStmt.from)} sampai ${exprToPseudo(loopStmt.to)}`
      : `selama ${exprToPseudo((loopStmt as Extract<Stmt, { kind: "while" }>).cond)}`;
    return {
      mode: "socratic", title: "Pertanyaan untukmu",
      message: `Coba jawab tanpa menjalankan program:\n\n1. Perulangan kamu berjalan ${desc}. Berapa kali badan loop dieksekusi jika nilai akhirnya kecil (mis. 3)?\n2. Variabel apa yang **berubah** setiap iterasi? Tulis nilainya di kertas per iterasi.\n3. Setelah loop selesai, apa arti nilai akhir variabel itu menurut soal?`,
      followUps: ["Saya sudah coba — beri hint", "Lihat Execution Visualizer"],
    };
  }
  return {
    mode: "socratic", title: "Pertanyaan untukmu",
    message: "Mari berpikir dari soalnya:\n\n1. Informasi apa yang **diberikan** (input) dan apa yang **diminta** (output)?\n2. Aturan apa yang menghubungkan keduanya? Tulis satu kalimat dalam bahasamu sendiri.\n3. Kalimat itu mengandung kata **'jika'** (→ IF) atau **'ulangi / setiap'** (→ loop)?",
    followUps: ["Beri saya hint", "Lihat contoh project demo"],
  };
}

function findBoundary(cond: Expr): { v: string; bound: string; op: string } | null {
  if (cond.kind === "binop" && [">", "<", ">=", "<="].includes(cond.op)) {
    const vars = exprVars(cond.left);
    const v = vars.size ? [...vars][0] : (exprVars(cond.right).size ? [...exprVars(cond.right)][0] : "nilai");
    const bound = cond.right.kind === "num" ? String(cond.right.value) : cond.left.kind === "num" ? String(cond.left.value) : "?";
    return { v, bound, op: cond.op };
  }
  return null;
}

function review(prog: IRProgram): TutorReply {
  const a = analyzeProgram(prog);
  const bars = (x: number) => "█".repeat(Math.round(x / 10)) + "░".repeat(10 - Math.round(x / 10));
  return {
    mode: "review", title: "Review Kualitas",
    message: [
      `Correctness   ${bars(a.correctness)} ${a.correctness}%`,
      `Readability   ${bars(a.readability)} ${a.readability}%`,
      `Structure     ${bars(a.structure)} ${a.structure}%`,
      `Efficiency    ${bars(a.efficiency)} ${a.efficiency}%`,
      "",
      a.timeComplexity ? `Perkiraan kompleksitas waktu: **${a.timeComplexity}** (${a.complexityNote})` : "",
      a.suggestions.length ? "\nSaran teratas:\n" + a.suggestions.slice(0, 3).map(s => `- ${s}`).join("\n") : "\nTidak ada saran besar — algoritma rapi. Coba challenge yang lebih sulit!",
    ].filter(Boolean).join("\n"),
    followUps: ["Jelaskan kode ini", "Beri tantangan baru"],
  };
}

// ── Natural Language → Algorithm (template engine) ───────────────────────────

export interface NLResult {
  understanding: { input: string; process: string; output: string };
  program: IRProgram;
  confidence: string;
}

const E = {
  num: (value: number): Expr => ({ kind: "num", value }),
  var: (name: string): Expr => ({ kind: "var", name }),
  str: (value: string): Expr => ({ kind: "str", value }),
  bin: (op: string, left: Expr, right: Expr): Expr => ({ kind: "binop", op, left, right }),
};

export function nlToAlgorithm(description: string): NLResult {
  const d = description.toLowerCase();

  if (/(terbesar|maksimum|maks|largest|maximum|biggest)/.test(d)) {
    const stmts: Stmt[] = [
      { id: uid(), kind: "input", varName: "a" },
      { id: uid(), kind: "input", varName: "b" },
      { id: uid(), kind: "input", varName: "c" },
      { id: uid(), kind: "assign", target: "maks", expr: E.var("a") },
      { id: uid(), kind: "if", branches: [{ cond: E.bin(">", E.var("b"), E.var("maks")), body: [{ id: uid(), kind: "assign", target: "maks", expr: E.var("b") }] }], elseBody: [] },
      { id: uid(), kind: "if", branches: [{ cond: E.bin(">", E.var("c"), E.var("maks")), body: [{ id: uid(), kind: "assign", target: "maks", expr: E.var("c") }] }], elseBody: [] },
      { id: uid(), kind: "output", exprs: [E.str("Terbesar = "), E.var("maks")] },
    ];
    return {
      understanding: { input: "Tiga bilangan: a, b, c", process: "Bandingkan setiap bilangan dengan nilai maksimum sementara", output: "Bilangan terbesar (maks)" },
      program: { statements: stmts, vars: collectVars(stmts) },
      confidence: "Template: max-of-three (match pada kata kunci 'terbesar/maksimum/largest')",
    };
  }

  if (/(lulus|grade|pass|nilai)/.test(d)) {
    const m = d.match(/(\d{1,3})/);
    const bound = m ? parseInt(m[1], 10) : 75;
    const stmts: Stmt[] = [
      { id: uid(), kind: "input", varName: "nilai" },
      { id: uid(), kind: "if", branches: [{ cond: E.bin(">=", E.var("nilai"), E.num(bound)), body: [{ id: uid(), kind: "output", exprs: [E.str("Lulus")] }] }], elseBody: [{ id: uid(), kind: "output", exprs: [E.str("Tidak Lulus")] }] },
    ];
    return {
      understanding: { input: "Satu nilai angka (nilai)", process: `Bandingkan nilai dengan batas ${bound} (IF/ELSE)`, output: "Status: Lulus / Tidak Lulus" },
      program: { statements: stmts, vars: collectVars(stmts) },
      confidence: `Template: grade-checker (batas terdeteksi: ${bound})`,
    };
  }

  if (/(jumlah.*(sampai|hingga|1 ke|to n)|sum.*(to|until)|menjumlahkan)/.test(d)) {
    const stmts: Stmt[] = [
      { id: uid(), kind: "input", varName: "n" },
      { id: uid(), kind: "assign", target: "total", expr: E.num(0) },
      { id: uid(), kind: "for", varName: "i", from: E.num(1), to: E.var("n"), body: [{ id: uid(), kind: "assign", target: "total", expr: E.bin("+", E.var("total"), E.var("i")) }] },
      { id: uid(), kind: "output", exprs: [E.str("Jumlah = "), E.var("total")] },
    ];
    return {
      understanding: { input: "Satu bilangan n", process: "Loop i = 1..n, akumulasi total = total + i", output: "Jumlah 1 sampai n" },
      program: { statements: stmts, vars: collectVars(stmts) },
      confidence: "Template: sum-1-to-n",
    };
  }

  if (/(ganjil|genap|even|odd)/.test(d)) {
    const stmts: Stmt[] = [
      { id: uid(), kind: "input", varName: "n" },
      { id: uid(), kind: "if", branches: [{ cond: E.bin("==", E.bin("mod", E.var("n"), E.num(2)), E.num(0)), body: [{ id: uid(), kind: "output", exprs: [E.str("Genap")] }] }], elseBody: [{ id: uid(), kind: "output", exprs: [E.str("Ganjil")] }] },
    ];
    return {
      understanding: { input: "Satu bilangan bulat n", process: "Periksa sisa bagi n MOD 2", output: "Genap / Ganjil" },
      program: { statements: stmts, vars: collectVars(stmts) },
      confidence: "Template: even-odd",
    };
  }

  if (/(faktorial|factorial)/.test(d)) {
    const stmts: Stmt[] = [
      { id: uid(), kind: "input", varName: "n" },
      { id: uid(), kind: "assign", target: "faktorial", expr: E.num(1) },
      { id: uid(), kind: "for", varName: "i", from: E.num(1), to: E.var("n"), body: [{ id: uid(), kind: "assign", target: "faktorial", expr: E.bin("*", E.var("faktorial"), E.var("i")) }] },
      { id: uid(), kind: "output", exprs: [E.str("Faktorial = "), E.var("faktorial")] },
    ];
    return {
      understanding: { input: "Satu bilangan n", process: "Loop i = 1..n, kalikan akumulator", output: "n! (faktorial)" },
      program: { statements: stmts, vars: collectVars(stmts) },
      confidence: "Template: factorial",
    };
  }

  if (/(rata-rata|rata2|average|mean)/.test(d)) {
    const stmts: Stmt[] = [
      { id: uid(), kind: "input", varName: "a" },
      { id: uid(), kind: "input", varName: "b" },
      { id: uid(), kind: "input", varName: "c" },
      { id: uid(), kind: "assign", target: "rata", expr: E.bin("/", E.bin("+", E.bin("+", E.var("a"), E.var("b")), E.var("c")), E.num(3)) },
      { id: uid(), kind: "output", exprs: [E.str("Rata-rata = "), E.var("rata")] },
    ];
    return {
      understanding: { input: "Tiga bilangan: a, b, c", process: "Jumlahkan lalu bagi 3", output: "Rata-rata" },
      program: { statements: stmts, vars: collectVars(stmts) },
      confidence: "Template: average-of-three",
    };
  }

  // generic skeleton
  const stmts: Stmt[] = [
    { id: uid(), kind: "input", varName: "x" },
    { id: uid(), kind: "assign", target: "hasil", expr: E.var("x") },
    { id: uid(), kind: "output", exprs: [E.str("Hasil = "), E.var("hasil")] },
  ];
  return {
    understanding: { input: "Satu nilai x (sesuaikan dengan soal)", process: "Proses generik — silakan edit sesuai logika soal", output: "hasil" },
    program: { statements: stmts, vars: collectVars(stmts) },
    confidence: "Template generik (tidak ada pola khusus yang dikenali) — edit flowchart untuk menyesuaikan",
  };
}
