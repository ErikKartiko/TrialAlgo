"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, BookOpen, FlaskConical, Target, Workflow, ScrollText,
  Code2, FolderGit2, History, PlayCircle, BarChart3, Footprints, Sparkles,
  ClipboardList, GraduationCap, Settings, PanelLeftClose, PanelLeftOpen,
  Sun, Moon, Boxes,
} from "lucide-react";

interface NavItem { href: string; label: string; icon: ReactNode; }
interface NavGroup { title?: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  { items: [{ href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> }] },
  {
    title: "LEARN",
    items: [
      { href: "/lessons", label: "Lessons", icon: <BookOpen size={16} /> },
      { href: "/playground/latest", label: "Algorithm Playground", icon: <FlaskConical size={16} /> },
      { href: "/challenges", label: "Challenges", icon: <Target size={16} /> },
    ],
  },
  {
    title: "CREATE",
    items: [
      { href: "/playground/latest?focus=flowchart", label: "Flowchart", icon: <Workflow size={16} /> },
      { href: "/playground/latest?focus=pseudo", label: "Pseudocode", icon: <ScrollText size={16} /> },
      { href: "/playground/latest?focus=code", label: "Code", icon: <Code2 size={16} /> },
    ],
  },
  {
    title: "PROJECTS",
    items: [
      { href: "/projects", label: "My Projects", icon: <FolderGit2 size={16} /> },
      { href: "/projects?view=recent", label: "Recent Projects", icon: <History size={16} /> },
    ],
  },
  {
    title: "COMPILER",
    items: [{ href: "/playground/latest?focus=run", label: "Code Runner", icon: <PlayCircle size={16} /> }],
  },
  {
    title: "ANALYZE",
    items: [
      { href: "/playground/latest?focus=analysis", label: "Algorithm Analyzer", icon: <BarChart3 size={16} /> },
      { href: "/playground/latest?focus=viz", label: "Execution Visualizer", icon: <Footprints size={16} /> },
    ],
  },
  { title: "AI", items: [{ href: "/tutor", label: "AI Tutor", icon: <Sparkles size={16} /> }] },
  {
    title: "CLASS",
    items: [
      { href: "/assignments", label: "Assignments", icon: <ClipboardList size={16} /> },
      { href: "/class", label: "My Class", icon: <GraduationCap size={16} /> },
    ],
  },
  { title: "PROFILE", items: [{ href: "/settings", label: "Settings", icon: <Settings size={16} /> }] },
];

export function useTheme() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("algostudio-theme");
    if (saved === "light") { setLight(true); document.documentElement.classList.add("light"); }
  }, []);
  const toggle = () => {
    setLight(v => {
      const next = !v;
      document.documentElement.classList.toggle("light", next);
      localStorage.setItem("algostudio-theme", next ? "light" : "dark");
      return next;
    });
  };
  return { light, toggle };
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { light, toggle } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex-shrink-0 border-r border-line bg-soft flex flex-col transition-all duration-200 ${collapsed ? "w-0 overflow-hidden border-r-0" : "w-[228px]"}`}
        aria-label="Main navigation"
      >
        <Link href="/" className="flex items-center gap-2.5 px-4 h-14 border-b border-line flex-shrink-0">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center flex-shrink-0">
            <Boxes size={15} className="text-gray-950" strokeWidth={2.4} />
          </span>
          <span className="font-bold tracking-tight text-[15px]">AlgoStudio</span>
        </Link>
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {NAV.map((g, gi) => (
            <div key={gi}>
              {g.title && <div className="px-2.5 mb-1.5 text-[10px] font-bold tracking-[0.14em] text-mut/70">{g.title}</div>}
              <div className="space-y-0.5">
                {g.items.map(item => {
                  const base = item.href.split("?")[0];
                  const active = item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(base) && !item.href.includes("?focus");
                  return (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors ${
                        active ? "bg-panel2 text-app border border-line" : "text-mut hover:text-app hover:bg-panel2/60 border border-transparent"
                      }`}
                    >
                      <span className={active ? "text-accent" : ""}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-line text-[11px] text-mut leading-relaxed">
          Design the logic once.<br />See it everywhere.
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-line bg-soft/70 backdrop-blur flex items-center gap-3 px-4 flex-shrink-0 z-20">
          <button className="btn-ghost btn btn-sm" onClick={() => setCollapsed(v => !v)} aria-label="Toggle sidebar">
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-mut mono">
            <span className="chip chip-blue">PROBLEM</span>→
            <span className="chip">ALGORITHM</span>→
            <span className="chip chip-violet">FLOWCHART</span>→
            <span className="chip chip-amber">PSEUDOCODE</span>→
            <span className="chip chip-green">CODE</span>→
            <span className="chip">RUN</span>→
            <span className="chip chip-red">ANALYZE</span>
          </div>
          <div className="flex-1" />
          <button className="btn btn-ghost btn-sm" onClick={toggle} aria-label="Toggle theme">
            {light ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </header>
        <main className="flex-1 overflow-hidden min-h-0">{children}</main>
      </div>
    </div>
  );
}
