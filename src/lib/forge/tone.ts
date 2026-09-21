import type {
  Deployment,
  IntegrationRef,
  Project,
  Requirement,
  RiskLevel,
  StageStatus,
  TestCase,
} from "./types";

/**
 * Single source of truth for status -> visual tone mapping.
 * Screens must not re-implement these ternaries inline.
 */
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

export const riskTone: Record<RiskLevel, Tone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
};

export const stageStatusTone: Record<StageStatus, Tone> = {
  locked: "neutral",
  pending: "neutral",
  running: "info",
  needs_approval: "warning",
  blocked: "danger",
  complete: "success",
};

export const requirementTone: Record<Requirement["status"], Tone> = {
  draft: "warning",
  approved: "info",
  implemented: "success",
};

export const integrationTone: Record<IntegrationRef["status"], Tone> = {
  connected: "success",
  configured: "info",
  planned: "warning",
  error: "danger",
};

export const testTone: Record<TestCase["status"], Tone> = {
  passing: "success",
  failing: "danger",
  flaky: "warning",
  skipped: "neutral",
};

export const deploymentTone: Record<Deployment["status"], Tone> = {
  live: "success",
  building: "info",
  queued: "warning",
  failed: "danger",
};

export const healthTone: Record<Project["health"], Tone> = {
  healthy: "success",
  attention: "warning",
  failing: "danger",
};

export const projectStatusTone: Record<Project["status"], Tone> = {
  drafting: "neutral",
  building: "info",
  review: "warning",
  live: "success",
  paused: "neutral",
};
