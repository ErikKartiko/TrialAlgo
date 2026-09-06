// Project domain model shared by client + server
import type { FlowGraph, IRProgram, Language, LineMap, TestCase } from "./ir/types";

export interface ProjectVersion {
  id: string;
  label: string;
  createdAt: string;
  pseudocode: string;
}

export interface TransformRecord {
  id: string;
  from: string;   // e.g. "Flowchart"
  to: string;     // e.g. "Pseudocode"
  detail?: string;
  at: string;
}

export interface ProjectData {
  id: string;
  title: string;
  description: string;
  problem: string;
  flowchart: FlowGraph;
  pseudocode: string;
  ir: IRProgram | null;
  codes: Partial<Record<Language, { code: string; map: LineMap }>>;
  tests: TestCase[];
  versions: ProjectVersion[];
  history: TransformRecord[];
  demo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EventKind =
  | "project_created" | "flowchart_created" | "flowchart_modified"
  | "pseudocode_generated" | "pseudocode_parsed" | "code_generated"
  | "code_run" | "test_passed" | "test_failed" | "hint_requested"
  | "solution_viewed" | "assignment_submitted" | "conversion";
