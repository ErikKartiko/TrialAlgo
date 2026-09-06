// Demo projects, challenges, lessons — realistic seed content.
// Demos are authored as IR first; every representation is *derived* from it,
// demonstrating the core architecture: one model, many views.
import type { IRProgram, Stmt, Expr, TestCase } from "./ir/types";
import { irToFlowchart } from "./ir/flowchart";
import { irToPseudocode } from "./ir/pseudocode";
import { irToCode } from "./ir/codegen";
import { LANGUAGES, uid } from "./ir/types";
import type { ProjectData } from "./project";

const E = {
  num: (value: number): Expr => ({ kind: "num", value }),
  var: (name: string): Expr => ({ kind: "var", name }),
  str: (value: string): Expr => ({ kind: "str", value }),
  bin: (op: string, left: Expr, right: Expr): Expr => ({ kind: "binop", op, left, right }),
};

function demoProject(
  id: string, title: string, description: string, problem: string,
  statements: Stmt[], tests: Omit<TestCase, "id">[],
): ProjectData {
  const prog: IRProgram = { statements, vars: [] };
  const flowchart = irToFlowchart(prog);
  const pseudo = irToPseudocode(prog);
  const codes: ProjectData["codes"] = {};
  for (const l of LANGUAGES) {
    const g = irToCode(prog, l.id);
    codes[l.id] = { code: g.code, map: g.map };
  }
  const now = new Date().toISOString();
  return {
    id, title, description, problem,
    flowchart, pseudocode: pseudo.text, ir: prog, codes,
    tests: tests.map(t => ({ ...t, id: uid() })),
    versions: [], history: [], demo: true,
    createdAt: now, updatedAt: now,
  };
}

export function buildDemoProjects(): ProjectData[] {
  return [
    demoProject(
      "demo-grade-checker",
      "Student Grade Checker",
      "Menentukan kelulusan mahasiswa berdasarkan nilai — contoh Selection (IF/ELSE).",
      "Buat algoritma untuk menentukan apakah mahasiswa lulus berdasarkan nilai. Mahasiswa dinyatakan LULUS jika nilai >= 75, selain itu TIDAK LULUS.",
      [
        { id: "s-input", kind: "input", varName: "nilai" },
        {
          id: "s-if", kind: "if",
          branches: [{
            cond: E.bin(">=", E.var("nilai"), E.num(75)),
            body: [{ id: "s-out-yes", kind: "output", exprs: [E.str("Lulus")] }],
          }],
          elseBody: [{ id: "s-out-no", kind: "output", exprs: [E.str("Tidak Lulus")] }],
        },
      ],
      [
        { name: "Test 1 — tepat di batas", input: "75", expected: "Lulus" },
        { name: "Test 2 — di atas batas", input: "80", expected: "Lulus" },
        { name: "Test 3 — di bawah batas", input: "60", expected: "Tidak Lulus" },
      ],
    ),
    demoProject(
      "demo-max-three",
      "Largest of Three Numbers",
      "Mencari bilangan terbesar dari tiga angka — latihan Nested/Sequence Selection.",
      "Buat algoritma untuk menentukan bilangan terbesar dari tiga angka a, b, dan c. Cetak bilangan terbesarnya.",
      [
        { id: "m-in-a", kind: "input", varName: "a" },
        { id: "m-in-b", kind: "input", varName: "b" },
        { id: "m-in-c", kind: "input", varName: "c" },
        { id: "m-set", kind: "assign", target: "maks", expr: E.var("a") },
        {
          id: "m-if-b", kind: "if",
          branches: [{
            cond: E.bin(">", E.var("b"), E.var("maks")),
            body: [{ id: "m-set-b", kind: "assign", target: "maks", expr: E.var("b") }],
          }],
          elseBody: [],
        },
        {
          id: "m-if-c", kind: "if",
          branches: [{
            cond: E.bin(">", E.var("c"), E.var("maks")),
            body: [{ id: "m-set-c", kind: "assign", target: "maks", expr: E.var("c") }],
          }],
          elseBody: [],
        },
        { id: "m-out", kind: "output", exprs: [E.str("Terbesar = "), E.var("maks")] },
      ],
      [
        { name: "Test 1", input: "3\n7\n5", expected: "Terbesar = 7" },
        { name: "Test 2", input: "9\n2\n4", expected: "Terbesar = 9" },
        { name: "Test 3", input: "1\n1\n1", expected: "Terbesar = 1" },
      ],
    ),
    demoProject(
      "demo-sum-n",
      "Sum from 1 to N",
      "Menjumlahkan 1 sampai n dengan perulangan FOR — cocok untuk Execution Visualizer.",
      "Buat algoritma untuk menghitung jumlah bilangan dari 1 sampai n. Contoh: jika n = 5, hasilnya 1+2+3+4+5 = 15.",
      [
        { id: "t-in", kind: "input", varName: "n" },
        { id: "t-zero", kind: "assign", target: "total", expr: E.num(0) },
        {
          id: "t-for", kind: "for", varName: "i", from: E.num(1), to: E.var("n"),
          body: [{ id: "t-add", kind: "assign", target: "total", expr: E.bin("+", E.var("total"), E.var("i")) }],
        },
        { id: "t-out", kind: "output", exprs: [E.str("Jumlah = "), E.var("total")] },
      ],
      [
        { name: "Test 1 — kecil", input: "5", expected: "Jumlah = 15" },
        { name: "Test 2 — sedang", input: "10", expected: "Jumlah = 55" },
        { name: "Test 3 — n = 1", input: "1", expected: "Jumlah = 1" },
      ],
    ),
  ];
}

// ── Challenges ───────────────────────────────────────────────────────────────

export interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  problem: string;
  inputFormat: string;
  outputFormat: string;
  examples: { input: string; output: string }[];
  hints: string[];
}

export const CHALLENGES: Challenge[] = [
  { id: "ch-hello-square", title: "Square of a Number", category: "Sequence", difficulty: "Beginner",
    problem: "Baca sebuah bilangan n, cetak kuadratnya (n × n).", inputFormat: "Satu bilangan n", outputFormat: "Kuadrat dari n",
    examples: [{ input: "5", output: "25" }], hints: ["Butuh 1 INPUT dan 1 OUTPUT.", "Kuadrat berarti perkalian dengan dirinya sendiri: n * n."] },
  { id: "ch-even-odd", title: "Even or Odd", category: "Selection", difficulty: "Beginner",
    problem: "Baca bilangan bulat n. Cetak 'Genap' jika genap, 'Ganjil' jika ganjil.", inputFormat: "Satu bilangan n", outputFormat: "Genap / Ganjil",
    examples: [{ input: "7", output: "Ganjil" }, { input: "10", output: "Genap" }], hints: ["Gunakan MOD 2.", "n MOD 2 = 0 berarti genap."] },
  { id: "ch-grade", title: "Grade Checker", category: "Selection", difficulty: "Beginner",
    problem: "Mahasiswa lulus jika nilai >= 75. Cetak Lulus atau Tidak Lulus.", inputFormat: "Satu nilai (0-100)", outputFormat: "Lulus / Tidak Lulus",
    examples: [{ input: "75", output: "Lulus" }, { input: "60", output: "Tidak Lulus" }], hints: ["Perhatikan nilai tepat 75 — harus LULUS.", "Operator yang tepat: >=, bukan >."] },
  { id: "ch-max3", title: "Largest of Three", category: "Nested Selection", difficulty: "Intermediate",
    problem: "Baca a, b, c lalu cetak yang terbesar.", inputFormat: "Tiga bilangan, satu per baris", outputFormat: "Bilangan terbesar",
    examples: [{ input: "3\n7\n5", output: "7" }], hints: ["Simpan kandidat terbesar dalam variabel 'maks'.", "Bandingkan b dengan maks, lalu c dengan maks."] },
  { id: "ch-sum-n", title: "Sum 1 to N", category: "Loop", difficulty: "Beginner",
    problem: "Hitung 1+2+...+n.", inputFormat: "Satu bilangan n", outputFormat: "Jumlahnya",
    examples: [{ input: "5", output: "15" }], hints: ["Mulai dengan total = 0.", "FOR i = 1 TO n: total = total + i."] },
  { id: "ch-factorial", title: "Factorial", category: "Loop", difficulty: "Intermediate",
    problem: "Hitung n! = 1×2×...×n.", inputFormat: "Satu bilangan n", outputFormat: "Faktorial",
    examples: [{ input: "5", output: "120" }], hints: ["Akumulator perkalian mulai dari 1, bukan 0.", "Kalikan setiap i dari 1 sampai n."] },
  { id: "ch-count-even", title: "Count Evens 1..N", category: "Nested Loop", difficulty: "Intermediate",
    problem: "Hitung berapa banyak bilangan genap dari 1 sampai n.", inputFormat: "Satu bilangan n", outputFormat: "Banyaknya bilangan genap",
    examples: [{ input: "10", output: "5" }], hints: ["Gunakan counter yang naik saat i MOD 2 = 0.", "Bisa juga tanpa IF: loncat 2 langkah... tapi coba dengan IF dulu."] },
  { id: "ch-fizzbuzz", title: "FizzBuzz (1..N)", category: "Loop", difficulty: "Advanced",
    problem: "Untuk setiap i dari 1..n: cetak 'FizzBuzz' jika kelipatan 15, 'Fizz' jika kelipatan 3, 'Buzz' jika kelipatan 5, selain itu cetak i.", inputFormat: "Satu bilangan n", outputFormat: "n baris sesuai aturan",
    examples: [{ input: "3", output: "1\n2\nFizz" }], hints: ["Periksa kelipatan 15 DULU sebelum 3 atau 5.", "Urutan IF/ELSE IF sangat menentukan."] },
  { id: "ch-reverse", title: "Digit Sum", category: "Loop", difficulty: "Advanced",
    problem: "Baca bilangan bulat n, cetak jumlah digit-digitnya. Contoh: 123 → 6.", inputFormat: "Satu bilangan n", outputFormat: "Jumlah digit",
    examples: [{ input: "123", output: "6" }], hints: ["Ambil digit terakhir dengan n MOD 10.", "Kecilkan n dengan pembagian bulat... di AlgoStudio gunakan (n - n MOD 10) / 10.", "Ulangi selama n > 0 (WHILE)."] },
  { id: "ch-prime", title: "Prime Check", category: "Searching", difficulty: "Expert",
    problem: "Tentukan apakah n bilangan prima. Cetak 'Prima' atau 'Bukan'.", inputFormat: "Satu bilangan n (n >= 2)", outputFormat: "Prima / Bukan",
    examples: [{ input: "7", output: "Prima" }, { input: "9", output: "Bukan" }], hints: ["Prima: tidak punya pembagi dari 2 sampai n-1.", "Gunakan flag boolean atau counter pembagi."] },
];

// ── Lessons ──────────────────────────────────────────────────────────────────

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  level: string;
  sections: { heading: string; body: string }[];
}

export const LESSONS: Lesson[] = [
  {
    id: "ls-sequence", title: "Sequence — Urutan Langkah", summary: "Algoritma paling dasar: langkah demi langkah dari atas ke bawah.", minutes: 8, level: "Beginner",
    sections: [
      { heading: "Apa itu Sequence?", body: "Sequence adalah struktur di mana perintah dijalankan satu per satu dari atas ke bawah, tanpa percabangan maupun pengulangan. Contoh: INPUT n → hitung luas → OUTPUT luas." },
      { heading: "Input → Process → Output", body: "Hampir semua program mengikuti pola IPO: membaca data (INPUT), mengolahnya (PROCESS/assignment), lalu menampilkan hasil (OUTPUT). Di flowchart, INPUT/OUTPUT digambar sebagai jajar genjang dan PROCESS sebagai persegi panjang." },
      { heading: "Coba sendiri", body: "Buka challenge 'Square of a Number' dan rancang flowchart-nya: START → INPUT n → PROCESS luas = n * n → OUTPUT luas → END." },
    ],
  },
  {
    id: "ls-selection", title: "Selection — IF & ELSE", summary: "Membuat program yang mengambil keputusan berdasarkan kondisi.", minutes: 12, level: "Beginner",
    sections: [
      { heading: "Kondisi Boolean", body: "Selection bekerja berdasarkan ekspresi boolean — sesuatu yang bernilai TRUE atau FALSE, misalnya nilai >= 75. Di flowchart digambarkan sebagai belah ketupat (decision) dengan dua cabang: TRUE dan FALSE." },
      { heading: "IF / ELSE IF / ELSE", body: "Untuk lebih dari dua kemungkinan, gunakan ELSE IF bertingkat. Urutan sangat penting: kondisi pertama yang TRUE akan dijalankan dan sisanya dilewati." },
      { heading: "Jebakan batas (boundary)", body: "Kesalahan paling umum: menulis nilai > 75 padahal soal meminta nilai >= 75. Nilai persis 75 akan menghasilkan jawaban berbeda! Selalu uji dengan nilai tepat di batas." },
    ],
  },
  {
    id: "ls-loop", title: "Iteration — FOR & WHILE", summary: "Mengulang pekerjaan tanpa menulis ulang perintah.", minutes: 15, level: "Intermediate",
    sections: [
      { heading: "FOR", body: "FOR dipakai ketika jumlah pengulangan sudah diketahui, mis. FOR i = 1 TO n. Tiga komponennya: inisialisasi (i = 1), kondisi batas (TO n), dan perubahan (i naik 1 setiap iterasi)." },
      { heading: "WHILE", body: "WHILE dipakai ketika kita tidak tahu pasti berapa kali harus mengulang — selama kondisi masih TRUE, badan loop dijalankan. Pastikan ada sesuatu di dalam loop yang membuat kondisi akhirnya FALSE, atau program tidak akan berhenti!" },
      { heading: "Pola Akumulator", body: "Pola paling umum dalam loop: total = 0 sebelum loop, lalu total = total + sesuatu di dalamnya. Variabel seperti total disebut akumulator." },
    ],
  },
  {
    id: "ls-ir", title: "Satu Algoritma, Banyak Representasi", summary: "Mengapa Flowchart, Pseudocode, dan Kode adalah hal yang sama.", minutes: 10, level: "Semua",
    sections: [
      { heading: "Ide inti AlgoStudio", body: "Flowchart, pseudocode, dan source code bukan tiga hal berbeda — ketiganya adalah *representasi* dari satu model logika yang sama. Di AlgoStudio model itu disebut Algorithm IR (Intermediate Representation)." },
      { heading: "Konversi dua arah", body: "Karena semuanya berasal dari satu model, kamu bisa berpindah: rancang flowchart → konversi ke pseudocode → generate ke C++, Python, Java, C#, atau C. Atau tulis pseudocode dulu, lalu generate flowchart-nya." },
      { heading: "Latihan", body: "Buka demo 'Sum from 1 to N', klik Flowchart → Pseudocode → Python, lalu bandingkan dengan C++ lewat fitur Compare. Logikanya sama — hanya sintaksnya berbeda." },
    ],
  },
];
