import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  jsonb,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import type { StageId, RiskLevel, SchemaTable, IntegrationRef } from "@/lib/forge/types";

// Helper for common timestamp fields
const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    status: varchar("status", { length: 50 }).notNull(), // "drafting" | "building" | "review" | "live" | "paused"
    health: varchar("health", { length: 50 }).notNull(), // "healthy" | "attention" | "failing"
    owner: varchar("owner", { length: 255 }).notNull(),
    stack: jsonb("stack").notNull().$type<string[]>(),
    benchmark: boolean("benchmark").default(false),
    previewRoute: varchar("preview_route", { length: 255 }),
    previewStatus: varchar("preview_status", { length: 50 }), // "ready" | "cold" | "error"
    previewLastBuiltAt: timestamp("preview_last_built_at"),
    ...timestamps,
  },
  (table) => [
    index("projects_slug_idx").on(table.slug),
    index("projects_created_at_idx").on(table.createdAt),
  ],
);

export const projectBrainVersions = pgTable(
  "project_brain_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    vision: text("vision").notNull(),
    requirements: jsonb("requirements").notNull(),
    decisions: jsonb("decisions").notNull(),
    architecture: jsonb("architecture").notNull(),
    schema: jsonb("schema").notNull().$type<SchemaTable[]>(),
    integrations: jsonb("integrations").notNull().$type<IntegrationRef[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_brain_versions_project_id_idx").on(table.projectId),
    index("project_brain_versions_created_at_idx").on(table.createdAt),
  ],
);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    stageId: varchar("stage_id", { length: 50 }).notNull().$type<StageId>(),
    label: varchar("label", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    summary: text("summary").notNull(),
    progress: integer("progress").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("pipeline_stages_project_id_idx").on(table.projectId)],
);

export const sourceSnapshots = pgTable(
  "source_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    commitSha: varchar("commit_sha", { length: 255 }),
    message: text("message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("source_snapshots_project_id_idx").on(table.projectId),
    index("source_snapshots_created_at_idx").on(table.createdAt),
  ],
);

export const sourceFiles = pgTable(
  "source_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .references(() => sourceSnapshots.id, { onDelete: "cascade" })
      .notNull(),
    path: text("path").notNull(),
    kind: varchar("kind", { length: 50 }).notNull(), // "file" | "dir"
    language: varchar("language", { length: 50 }),
    loc: integer("loc"),
    status: varchar("status", { length: 50 }),
    content: text("content"),
  },
  (table) => [index("source_files_snapshot_id_idx").on(table.snapshotId)],
);

export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    prompt: text("prompt").notNull(),
    provider: varchar("provider", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("ai_runs_project_id_idx").on(table.projectId),
    index("ai_runs_started_at_idx").on(table.startedAt),
  ],
);

export const aiRunSteps = pgTable(
  "ai_run_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .references(() => aiRuns.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    detail: text("detail").notNull(),
    stage: varchar("stage", { length: 50 }).notNull().$type<StageId>(),
    risk: varchar("risk", { length: 50 }).notNull().$type<RiskLevel>(),
    status: varchar("status", { length: 50 }).notNull(),
    orderIdx: integer("order_idx").notNull(),
  },
  (table) => [index("ai_run_steps_run_id_idx").on(table.runId)],
);

export const aiEvents = pgTable(
  "ai_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .references(() => aiRuns.id, { onDelete: "cascade" })
      .notNull(),
    level: varchar("level", { length: 50 }).notNull(),
    stage: varchar("stage", { length: 50 }).notNull().$type<StageId>(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("ai_events_run_id_idx").on(table.runId)],
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stepId: uuid("step_id")
      .references(() => aiRunSteps.id, { onDelete: "cascade" })
      .notNull(),
    decision: varchar("decision", { length: 50 }).notNull(), // "approved" | "rejected"
    actor: varchar("actor", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("approvals_step_id_idx").on(table.stepId)],
);

export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    snapshotId: uuid("snapshot_id").references(() => sourceSnapshots.id),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("test_runs_project_id_idx").on(table.projectId),
    index("test_runs_created_at_idx").on(table.createdAt),
  ],
);

export const testResults = pgTable(
  "test_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testRunId: uuid("test_run_id")
      .references(() => testRuns.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    suite: varchar("suite", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    detail: text("detail"),
  },
  (table) => [index("test_results_test_run_id_idx").on(table.testRunId)],
);

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    env: varchar("env", { length: 50 }).notNull(), // "preview" | "staging" | "production"
    status: varchar("status", { length: 50 }).notNull(), // "live" | "building" | "failed" | "queued"
    commitSha: varchar("commit_sha", { length: 255 }),
    url: varchar("url", { length: 255 }).notNull(),
    adapter: varchar("adapter", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("deployments_project_id_idx").on(table.projectId),
    index("deployments_created_at_idx").on(table.createdAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    actor: varchar("actor", { length: 50 }).notNull(),
    actorName: varchar("actor_name", { length: 255 }).notNull(),
    action: varchar("action", { length: 255 }).notNull(),
    target: varchar("target", { length: 255 }).notNull(),
    risk: varchar("risk", { length: 50 }).notNull().$type<RiskLevel>(),
    approved: boolean("approved"),
    diffSummary: text("diff_summary"),
    stage: varchar("stage", { length: 50 }).$type<StageId>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_events_project_id_idx").on(table.projectId),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);
