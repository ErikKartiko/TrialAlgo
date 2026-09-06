// IR → idiomatic source code in C, C++, C#, Python, Java
import type { IRProgram, Language, LineMap, Stmt, Expr } from "./types";
import { exprToCode, exprToPseudo } from "./expr";

export interface GeneratedCode { code: string; map: LineMap; language: Language; }

const idt = (depth: number, unit: string) => unit.repeat(depth);

/** Does the loop upper bound need +1 (inclusive range) adjustments? */
function plusOne(e: Expr): string | null {
  if (e.kind === "num") return String(e.value + 1);
  return null;
}

export function irToCode(prog: IRProgram, lang: Language): GeneratedCode {
  const map: LineMap = {};
  const lines: string[] = [];
  const emit = (depth: number, text: string) => lines.push(idt(depth, lang === "python" ? "    " : "    ") + text);

  const numericVars = new Set<string>();
  for (const v of prog.vars) numericVars.add(v);

  function gen(stmts: Stmt[], depth: number) {
    for (const s of stmts) {
      const start = lines.length;
      switch (s.kind) {
        case "input": genInput(s, depth); break;
        case "output": genOutput(s, depth); break;
        case "assign": emit(depth, assignText(s, lang)); break;
        case "call": emit(depth, lang === "python" ? `${s.name}()` : `${s.name}();`); break;
        case "if": {
          s.branches.forEach((b, i) => {
            if (lang === "python") {
              emit(depth, `${i === 0 ? "if" : "elif"} ${exprToCode(b.cond, lang)}:`);
              if (b.body.length) gen(b.body, depth + 1); else emit(depth + 1, "pass");
            } else {
              emit(depth, `${i === 0 ? "if" : "else if"} (${exprToCode(b.cond, lang)}) {`);
              gen(b.body, depth + 1);
              emit(depth, "}");
            }
          });
          if (s.elseBody.length) {
            if (lang === "python") { emit(depth, "else:"); gen(s.elseBody, depth + 1); }
            else { emit(depth, "else {"); gen(s.elseBody, depth + 1); emit(depth, "}"); }
          }
          break;
        }
        case "while": {
          if (lang === "python") {
            emit(depth, `while ${exprToCode(s.cond, lang)}:`);
            if (s.body.length) gen(s.body, depth + 1); else emit(depth + 1, "pass");
          } else {
            emit(depth, `while (${exprToCode(s.cond, lang)}) {`);
            gen(s.body, depth + 1);
            emit(depth, "}");
          }
          break;
        }
        case "dowhile": {
          if (lang === "python") {
            emit(depth, "while True:");
            gen(s.body, depth + 1);
            emit(depth + 1, `if not (${exprToCode(s.cond, lang)}):`);
            emit(depth + 2, "break");
          } else {
            emit(depth, "do {");
            gen(s.body, depth + 1);
            emit(depth, `} while (${exprToCode(s.cond, lang)});`);
          }
          break;
        }
        case "for": {
          const a = exprToCode(s.from, lang);
          const b = exprToCode(s.to, lang);
          if (lang === "python") {
            const one = plusOne(s.to);
            emit(depth, `for ${s.varName} in range(${a}, ${one ?? `${b} + 1`}):`);
            if (s.body.length) gen(s.body, depth + 1); else emit(depth + 1, "pass");
          } else {
            emit(depth, `for (int ${s.varName} = ${a}; ${s.varName} <= ${b}; ${s.varName}++) {`);
            gen(s.body, depth + 1);
            emit(depth, "}");
          }
          break;
        }
      }
      map[s.id] = [start, lines.length - 1];
    }
  }

  function assignText(s: Extract<Stmt, { kind: "assign" }>, l: Language): string {
    return l === "python" ? `${s.target} = ${exprToCode(s.expr, l)}` : `${s.target} = ${exprToCode(s.expr, l)};`;
  }

  function genInput(s: Extract<Stmt, { kind: "input" }>, depth: number) {
    switch (lang) {
      case "python": emit(depth, `${s.varName} = float(input())`); break;
      case "c": emit(depth, `scanf("%lf", &${s.varName});`); break;
      case "cpp": emit(depth, `cin >> ${s.varName};`); break;
      case "csharp": emit(depth, `${s.varName} = double.Parse(Console.ReadLine());`); break;
      case "java": emit(depth, `${s.varName} = sc.nextDouble();`); break;
    }
  }

  function cPrintf(s: Extract<Stmt, { kind: "output" }>): string {
    let fmt = "";
    const args: string[] = [];
    for (const e of s.exprs) {
      if (e.kind === "str") fmt += e.value.replace(/%/g, "%%");
      else if (e.kind === "num") fmt += String(e.value);
      else { fmt += "%g"; args.push(exprToCode(e, "c")); }
      fmt += "";
    }
    fmt = fmt.trimEnd();
    const argStr = args.length ? ", " + args.join(", ") : "";
    return `printf("${fmt}\\n"${argStr});`;
  }

  function genOutput(s: Extract<Stmt, { kind: "output" }>, depth: number) {
    switch (lang) {
      case "python": {
        const parts = s.exprs.map(e => pyExpr(e));
        emit(depth, parts.length ? `print(${parts.join(", ")})` : "print()");
        break;
      }
      case "c": emit(depth, cPrintf(s)); break;
      case "cpp": {
        const parts = s.exprs.map(e => exprToCode(e, lang));
        emit(depth, `cout << ${parts.join(" << ")} << endl;`);
        break;
      }
      case "csharp": emit(depth, `Console.WriteLine(${concatArgs(s.exprs, lang)});`); break;
      case "java": emit(depth, `System.out.println(${concatArgs(s.exprs, lang)});`); break;
    }
  }

  function pyExpr(e: Expr): string {
    // format floats that are integral without trailing .0 using :g
    if (e.kind === "var" || e.kind === "binop" || e.kind === "unop") {
      return `f"{${exprToCode(e, lang)}:g}"`;
    }
    if (e.kind === "str") return JSON.stringify(e.value);
    if (e.kind === "num") return String(e.value);
    return e.value ? "True" : "False";
  }

  function concatArgs(exprs: Expr[], l: Language): string {
    if (!exprs.length) return '""';
    const parts: string[] = exprs.map(e => e.kind === "str" ? JSON.stringify(e.value) : exprToCode(e, l));
    return parts.join(" + ");
  }

  // ── scaffold per language ────────────────────────────────────────────────
  const body: string[] = lines;
  void body;

  switch (lang) {
    case "python": {
      emit(0, "# Generated by AlgoStudio from the algorithm model (IR)");
      gen(prog.statements, 0);
      break;
    }
    case "c": {
      emit(0, "#include <stdio.h>");
      emit(0, "");
      emit(0, "int main(void) {");
      const decl = [...numericVars].filter(v => v);
      if (decl.length) emit(1, `double ${decl.join(", ")};`);
      gen(prog.statements, 1);
      emit(1, "return 0;");
      emit(0, "}");
      break;
    }
    case "cpp": {
      emit(0, "#include <iostream>");
      emit(0, "using namespace std;");
      emit(0, "");
      emit(0, "int main() {");
      if (numericVars.size) emit(1, `double ${[...numericVars].join(", ")};`);
      gen(prog.statements, 1);
      emit(1, "return 0;");
      emit(0, "}");
      break;
    }
    case "csharp": {
      emit(0, "using System;");
      emit(0, "");
      emit(0, "class Program {");
      emit(1, "static void Main() {");
      if (numericVars.size) emit(2, `double ${[...numericVars].join(", ")};`);
      gen(prog.statements, 2);
      emit(1, "}");
      emit(0, "}");
      break;
    }
    case "java": {
      emit(0, "import java.util.Scanner;");
      emit(0, "");
      emit(0, "public class Main {");
      emit(1, "public static void main(String[] args) {");
      if (numericVars.size) emit(2, `double ${[...numericVars].join(", ")};`);
      emit(2, "Scanner sc = new Scanner(System.in);");
      gen(prog.statements, 2);
      emit(1, "}");
      emit(0, "}");
      break;
    }
  }

  return { code: lines.join("\n"), map, language: lang };
}

/** Small helper for "what is this statement" in the sync panel. */
export function describeStmt(s: Stmt): string {
  switch (s.kind) {
    case "input": return `Input '${s.varName}'`;
    case "output": return "Output statement";
    case "assign": return `Assign ${s.target}`;
    case "if": return `Decision: ${exprToPseudo(s.branches[0].cond)}`;
    case "while": return `While loop: ${exprToPseudo(s.cond)}`;
    case "dowhile": return "Do-while loop";
    case "for": return `For loop (${s.varName})`;
    case "call": return `Call ${s.name}`;
  }
}
