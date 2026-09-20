import type { FileNode, Project, ProviderEntry, StageId } from "./types";

export type StageId =
  | "requirements"
  | "architecture"
  | "ui"
  | "data"
  | "backend"
  | "integrations"
  | "test"
  | "fix"
  | "deploy";

export interface Stage { id: StageId; label: string; status: StageStatus; summary: string; progress: number; updatedAt: string; }
export type StageStatus = "locked" | "pending" | "running" | "needs_approval" | "blocked" | "complete";
export type RiskLevel = "low" | "medium" | "high";
export interface Requirement { id: string; title: string; detail: string; kind: "functional" | "non_functional" | "constraint"; priority: "must" | "should" | "could"; status: "draft" | "approved" | "implemented"; }
export interface Decision { id: string; title: string; rationale: string; alternatives: string[]; status: "proposed" | "accepted" | "superseded"; decidedAt: string; }
export interface SchemaColumn { name: string; type: string; nullable: boolean; note?: string; key?: "primary" | "foreign" | "unique"; references?: string; }
export interface SchemaTable { name: string; purpose: string; rls: string; columns: SchemaColumn[]; indexes?: string[]; }
export interface IntegrationRef { id: string; name: string; category: "ai" | "auth" | "data" | "payments" | "messaging" | "storage" | "observability"; status: "connected" | "configured" | "planned" | "error"; provider: string; note: string; capability?: string; environment?: string; }
export interface TestCase { id: string; name: string; suite: "unit" | "integration" | "e2e" | "security"; status: "passing" | "failing" | "skipped" | "flaky"; durationMs: number; detail?: string; }
export interface ChangeEntry { id: string; at: string; actor: "ai" | "human" | "system"; actorName: string; action: string; target: string; risk: RiskLevel; approved: boolean | null; diffSummary?: string; stage?: StageId; }
export interface ProjectBrain { vision: string; requirements: Requirement[]; decisions: Decision[]; architecture: { layer: string; choice: string; note: string }[]; schema: SchemaTable[]; integrations: IntegrationRef[]; tests: TestCase[]; history: ChangeEntry[]; }
export interface FileNode { path: string; kind: "file" | "dir"; language?: string; loc?: number; status?: "new" | "modified" | "unchanged"; content?: string; children?: FileNode[]; }
export interface Deployment { id: string; env: "preview" | "staging" | "production"; status: "live" | "building" | "failed" | "queued"; commit: string; url: string; at: string; adapter: string; }
export interface AiEvent { id: string; at: string; level: "info" | "action" | "warn" | "error" | "approval"; stage: StageId; message: string; }
export interface PlanStep { id: string; title: string; detail: string; stage: StageId; risk: RiskLevel; status: "queued" | "running" | "awaiting_approval" | "done" | "rejected"; }
export interface AiRun { id: string; prompt: string; provider: string; model: string; startedAt: string; status: "running" | "awaiting_approval" | "completed" | "failed"; tokensIn: number; tokensOut: number; plan: PlanStep[]; events: AiEvent[]; }
export interface Project { id: string; slug: string; name: string; tagline: string; description: string; status: "drafting" | "building" | "review" | "live" | "paused"; health: "healthy" | "attention" | "failing"; createdAt: string; updatedAt: string; owner: string; stack: string[]; benchmark?: boolean; stages: Stage[]; brain: ProjectBrain; files: FileNode[]; deployments: Deployment[]; runs: AiRun[]; preview: { route: string; status: "ready" | "cold" | "error"; lastBuiltAt: string }; }
export interface ProviderEntry { id: string; name: string; kind: "llm" | "image" | "embedding" | "execution" | "deploy"; status: "active" | "standby" | "disabled"; routedFor: string[]; latencyMs: number; note: string; }
