import type { StageId } from "./types";

/** Additional metadata is optional because older seeded Brain records predate these fields. */
export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  note?: string;
  key?: "primary" | "foreign" | "unique";
  references?: string;
}

export interface SchemaTable {
  name: string;
  purpose: string;
  rls: string;
  columns: SchemaColumn[];
  indexes?: string[];
}

export interface IntegrationRef {
  id: string;
  name: string;
  category: "ai" | "auth" | "data" | "payments" | "messaging" | "storage" | "observability";
  status: "connected" | "configured" | "planned" | "error";
  provider: string;
  note: string;
  capability?: string;
  environment?: string;
}

export interface ChangeEntry {
  id: string;
  at: string;
  actor: "ai" | "human" | "system";
  actorName: string;
  action: string;
  target: string;
  risk: "low" | "medium" | "high";
  approved: boolean | null;
  diffSummary?: string;
  stage?: StageId;
}
