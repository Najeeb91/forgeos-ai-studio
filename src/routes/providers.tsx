import { createFileRoute } from "@tanstack/react-router";

import { PageBody, PageHeader, Panel, WorkspaceShell } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { providerRegistry } from "@/lib/forge/data";

export const Route = createFileRoute("/providers")({
  head: () => ({
    meta: [
      { title: "AI providers — ForgeOS" },
      {
        name: "description",
        content:
          "Provider-agnostic AI routing in ForgeOS: task-class policies, failover and execution adapters.",
      },
      { property: "og:title", content: "AI providers — ForgeOS" },
      {
        property: "og:description",
        content: "Task-class routing across AI providers so projects are never vendor-locked.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Providers,
});

const policies = [
  { task: "Planning & architecture", policy: "primary reasoning → secondary on failure" },
  { task: "Code generation", policy: "codegen route, chunked per file" },
  { task: "Repair & triage", policy: "codegen route with failing-test context" },
  { task: "Retrieval", policy: "embedding route over brain + source index" },
  { task: "Execution", policy: "sandbox adapter (contract defined)" },
];

function Providers() {
  return (
    <WorkspaceShell>
      <PageHeader
        title="AI provider registry"
        description="ForgeOS routes each task class independently. No generated application is bound to a single AI vendor, and every run records the provider that produced it."
        meta={
          <>
            <Pill tone="success">
              {providerRegistry.filter((p) => p.status === "active").length} active
            </Pill>
            <Pill tone="neutral">
              {providerRegistry.filter((p) => p.status === "standby").length} standby
            </Pill>
            <Pill tone="info">router contract v1</Pill>
          </>
        }
      />

      <PageBody className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Providers" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {providerRegistry.map((p) => (
              <li key={p.id} className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="flex gap-2">
                    <Pill tone="neutral">{p.kind}</Pill>
                    <Pill
                      tone={
                        p.status === "active"
                          ? "success"
                          : p.status === "standby"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {p.status}
                    </Pill>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{p.note}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.routedFor.map((r) => (
                    <span
                      key={r}
                      className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {r}
                    </span>
                  ))}
                  {p.latencyMs ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      p50 {p.latencyMs}ms
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-5">
          <Panel title="Routing policies" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {policies.map((p) => (
                <li key={p.task} className="px-4 py-3">
                  <div className="text-sm">{p.task}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{p.policy}</div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Extension points">
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>· Browser automation adapter for UI verification runs</li>
              <li>· Code execution sandbox for tests and migration dry-runs</li>
              <li>· Deployment adapters per environment and hosting target</li>
              <li>· Native mobile packaging adapter</li>
            </ul>
          </Panel>
        </div>
      </PageBody>
    </WorkspaceShell>
  );
}
