"use client";

import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";

export type EditorLang = "pseudo" | "clike" | "python";

const KEYWORDS: Record<EditorLang, Set<string>> = {
  pseudo: new Set(["START", "BEGIN", "END", "INPUT", "OUTPUT", "PRINT", "READ", "DISPLAY", "WRITE", "IF", "THEN", "ELSE", "WHILE", "DO", "FOR", "TO", "AND", "OR", "NOT", "MOD", "TRUE", "FALSE", "CALL", "ENDIF", "ENDWHILE", "ENDFOR", "NEXT", "REPEAT"]),
  clike: new Set(["int", "double", "float", "long", "void", "if", "else", "while", "do", "for", "return", "include", "using", "namespace", "std", "class", "static", "public", "cin", "cout", "endl", "scanf", "printf", "true", "false", "new", "Scanner", "System", "out", "println", "Console", "WriteLine", "ReadLine", "String", "Main", "args", "Program"]),
  python: new Set(["def", "if", "elif", "else", "while", "for", "in", "range", "print", "input", "float", "int", "True", "False", "not", "and", "or", "return", "break", "pass", "continue"]),
};

const TOKEN_RE = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/[^\n]*|#[^\n]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|\S)/g;

function renderLine(line: string, lang: EditorLang, key: number): ReactNode {
  const kw = KEYWORDS[lang];
  const out: ReactNode[] = [];
  let last = 0; let i = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const tok = m[0];
    let cls = "";
    if (tok.startsWith('"') || tok.startsWith("'")) cls = "tok-str";
    else if (tok.startsWith("//") || tok.startsWith("#")) cls = "tok-com";
    else if (/^\d/.test(tok)) cls = "tok-num";
    else if (kw.has(tok)) cls = "tok-kw";
    out.push(<span key={i++} className={cls || undefined}>{tok}</span>);
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  if (line === "") out.push("\n");
  return <div key={key} style={{ display: "block" }}>{out}</div>;
}

export interface SrcEditorProps {
  value: string;
  onChange?: (v: string) => void;
  lang: EditorLang;
  readOnly?: boolean;
  /** 0-based inclusive line range to softly highlight (sync across representations) */
  hlRange?: [number, number] | null;
  /** 0-based line currently executing */
  execLine?: number | null;
  errorLines?: Set<number>;
  onLineClick?: (line: number) => void;
  fontSize?: number;
  placeholder?: string;
}

export default function SrcEditor({
  value, onChange, lang, readOnly, hlRange, execLine, errorLines, onLineClick, fontSize = 13, placeholder,
}: SrcEditorProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const lines = useMemo(() => value.split("\n"), [value]);
  const lineH = Math.round(fontSize * 1.62);

  const rendered = useMemo(() =>
    lines.map((l, i) => {
      let cls = "";
      if (errorLines?.has(i)) cls = "editor-line-err";
      else if (execLine === i) cls = "editor-line-hl";
      else if (hlRange && i >= hlRange[0] && i <= hlRange[1]) cls = "editor-line-hl";
      return (
        <div key={i} className={cls || undefined} style={{ minHeight: lineH, display: "flex" }}>
          <span
            className="inline-block flex-shrink-0 select-none text-right pr-3 mr-3 text-[10px] leading-[inherit]"
            style={{ width: 34, color: execLine === i ? "var(--accent)" : "var(--muted)", opacity: execLine === i ? 1 : 0.65, position: "sticky", left: 0, background: cls ? undefined : "transparent", zIndex: 4 }}
          >{i + 1}</span>
          <span style={{ flex: 1, pointerEvents: onLineClick ? "auto" : "none", cursor: onLineClick ? "pointer" : undefined }}
            onClick={() => onLineClick?.(i)}
          >{renderLine(l, lang, i)}</span>
        </div>
      );
    }), [lines, lang, hlRange, execLine, errorLines, lineH, onLineClick]);

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = t.scrollTop;
      preRef.current.scrollLeft = t.scrollLeft;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!onLineClick) return;
    const ta = e.currentTarget;
    const upto = ta.value.slice(0, ta.selectionStart);
    const line = upto.split("\n").length - 1;
    onLineClick(line);
  };

  const pad: CSSProperties = { paddingLeft: 46, paddingTop: 10, paddingBottom: 10, paddingRight: 12 };

  return (
    <div className="editor-wrap w-full h-full bg-soft" style={{ fontSize }}>
      <pre
        ref={preRef}
        className="editor-pre"
        style={{ ...pad, fontSize, lineHeight: `${lineH}px` }}
        aria-hidden="true"
      >{rendered}</pre>
      <textarea
        className="editor-ta"
        style={{ ...pad, fontSize, lineHeight: `${lineH}px` }}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        onScroll={syncScroll}
        onClick={handleClick}
        onKeyUp={handleClick as unknown as React.KeyboardEventHandler<HTMLTextAreaElement>}
        readOnly={readOnly}
        spellCheck={false}
        placeholder={placeholder}
        aria-label="code editor"
      />
    </div>
  );
}
