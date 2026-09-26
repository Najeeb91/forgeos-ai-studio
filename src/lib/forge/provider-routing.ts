export type ForgeProviderKind = "execution" | "deployment" | "ai" | "database";
export type ForgeProviderStatus = "configured" | "standby" | "unavailable";
export interface ForgeProvider {
  id: string;
  kind: ForgeProviderKind;
  label: string;
  status: ForgeProviderStatus;
  priority: number;
  capabilities: string[];
  endpointEnv?: string;
  notes: string;
}

const hasAi = Boolean(process.env.FORGEOS_AI_API_KEY);
const hasGitHubExecutor =
  process.env.FORGEOS_GITHUB_EXECUTOR_ENABLED === "true" &&
  Boolean(process.env.FORGEOS_GITHUB_TOKEN) &&
  Boolean(process.env.FORGEOS_GITHUB_REPO);

const providers: ForgeProvider[] = [
  {
    id: "http-executor",
    kind: "execution",
    label: "HTTP Execution Adapter",
    status:
      process.env.FORGEOS_EXECUTOR_URL || process.env.FORGEOS_WORKER_URL
        ? "configured"
        : "unavailable",
    priority: 10,
    capabilities: ["source-build", "test", "bounded-repair"],
    endpointEnv: "FORGEOS_EXECUTOR_URL",
    notes: "Provider-neutral execution contract; host infrastructure is replaceable.",
  },
  {
    id: "github-actions",
    kind: "execution",
    label: "GitHub Actions",
    status: hasGitHubExecutor ? "configured" : "standby",
    priority: 20,
    capabilities: ["source-build", "test", "artifact"],
    endpointEnv: "FORGEOS_GITHUB_TOKEN",
    notes:
      "Portable secondary build/test plane; requires an explicitly configured GitHub executor adapter.",
  },
  {
    id: "openai-compatible",
    kind: "ai",
    label: "OpenAI-compatible AI",
    status: hasAi ? "configured" : "standby",
    priority: 10,
    capabilities: ["generation", "planning", "repair"],
    endpointEnv: "FORGEOS_AI_API_KEY",
    notes: "Provider-neutral chat-completions adapter; model and base URL remain configurable.",
  },
  {
    id: "appdeploy-ai",
    kind: "ai",
    label: "AppDeploy AI",
    status: "standby",
    priority: 20,
    capabilities: ["generation", "repair", "structured-output"],
    notes:
      "Reference/provider option from the feature-complete AppDeploy implementation; not hard-coded into ForgeOS runtime.",
  },
  {
    id: "appdeploy",
    kind: "deployment",
    label: "AppDeploy",
    status: process.env.FORGEOS_APPDEPLOY_ENABLED === "true" ? "configured" : "standby",
    priority: 20,
    capabilities: ["hosted-preview", "deployment", "qa"],
    notes: "Optional deployment/QA adapter; existing app is a reference implementation.",
  },
  {
    id: "railway",
    kind: "deployment",
    label: "Railway",
    status: "standby",
    priority: 30,
    capabilities: ["container-hosting", "persistent-service", "worker-hosting"],
    notes: "Hosting adapter only; never a ForgeOS architectural dependency.",
  },
  {
    id: "vercel",
    kind: "deployment",
    label: "Vercel",
    status: process.env.VERCEL_TOKEN ? "configured" : "standby",
    priority: 40,
    capabilities: ["web-deployment", "preview"],
    notes: "Optional deployment adapter; credentials are external to the ForgeOS core.",
  },
  {
    id: "netlify",
    kind: "deployment",
    label: "Netlify",
    status: process.env.NETLIFY_AUTH_TOKEN ? "configured" : "standby",
    priority: 50,
    capabilities: ["web-deployment", "preview"],
    notes: "Portable deployment option; configured only when credentials are explicitly supplied.",
  },
  {
    id: "neon",
    kind: "database",
    label: "Neon PostgreSQL",
    status: process.env.DATABASE_URL ? "configured" : "standby",
    priority: 10,
    capabilities: ["postgres", "branching", "durable-persistence"],
    endpointEnv: "DATABASE_URL",
    notes: "Persistence adapter; ForgeOS schema and migrations remain portable PostgreSQL.",
  },
];

export function listForgeProviders(): ForgeProvider[] {
  return [...providers].sort((a, b) => a.kind.localeCompare(b.kind) || a.priority - b.priority);
}
export function selectForgeProvider(
  kind: ForgeProviderKind,
  preferred?: string,
): ForgeProvider | null {
  const candidates = providers
    .filter((p) => p.kind === kind && p.status === "configured")
    .sort((a, b) => a.priority - b.priority);
  if (preferred) {
    const exact = candidates.find((p) => p.id === preferred);
    if (exact) return exact;
  }
  return candidates[0] ?? null;
}
