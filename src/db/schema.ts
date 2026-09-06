import { pgTable, text, timestamp, jsonb, integer, boolean, uuid } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  problem: text("problem").notNull().default(""),
  flowchart: jsonb("flowchart").notNull(),
  pseudocode: text("pseudocode").notNull().default(""),
  ir: jsonb("ir"),
  codes: jsonb("codes").notNull().default({}),
  tests: jsonb("tests").notNull().default([]),
  versions: jsonb("versions").notNull().default([]),
  history: jsonb("history").notNull().default([]),
  demo: boolean("demo").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const learningEvents = pgTable("learning_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  projectId: text("project_id"),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  className: text("class_name").notNull().default("IF-01"),
  language: text("language").notNull().default("cpp"),
  dueAt: text("due_at").notNull().default(""),
  requireFlowchart: boolean("require_flowchart").notNull().default(true),
  requirePseudocode: boolean("require_pseudocode").notNull().default(true),
  requireCode: boolean("require_code").notNull().default(true),
  weights: jsonb("weights").notNull().default({ flowchart: 20, pseudocode: 20, code: 40, tests: 20 }),
  tests: jsonb("tests").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: text("assignment_id").notNull(),
  studentName: text("student_name").notNull(),
  projectId: text("project_id"),
  scoreFlowchart: integer("score_flowchart").notNull().default(0),
  scorePseudocode: integer("score_pseudocode").notNull().default(0),
  scoreCode: integer("score_code").notNull().default(0),
  scoreTests: integer("score_tests").notNull().default(0),
  feedback: text("feedback").notNull().default(""),
  hintsUsed: integer("hints_used").notNull().default(0),
  mistakes: jsonb("mistakes").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
