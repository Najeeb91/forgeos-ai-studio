import { createFileRoute } from "@tanstack/react-router";

import { PageBody, EmptyState, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProject } from "@/lib/forge/data";

export const Route = createFileRoute("/projects/$slug/brain")({
  component: Brain,
});

function Brain() {
  const { slug } = Route.useParams();
  const project = getProject(slug)!;
  const { requirements, decisions, architecture } = project.brain;

  return (
    <PageBody>
      <Panel title="Project brain" description="Durable knowledge that survives every AI run.">
        <p className="text-sm leading-relaxed text-muted-foreground">{project.brain.vision}</p>
      </Panel>

      <Tabs defaultValue="requirements">
        <TabsList>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="architecture">Architecture</TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="mt-4">
          {requirements.length ? (
            <Panel bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {requirements.map((r) => (
                  <li key={r.id} className="space-y-1.5 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{r.title}</span>
                      <div className="flex gap-2">
                        <Pill tone="neutral">{r.kind.replace("_", " ")}</Pill>
                        <Pill tone={r.priority === "must" ? "primary" : "neutral"}>
                          {r.priority}
                        </Pill>
                        <Pill
                          tone={
                            r.status === "implemented"
                              ? "success"
                              : r.status === "approved"
                                ? "info"
                                : "warning"
                          }
                        >
                          {r.status}
                        </Pill>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{r.detail}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <EmptyState
              title="No requirements captured"
              hint="Run the Requirements stage to populate the brain from the project idea."
            />
          )}
        </TabsContent>

        <TabsContent value="decisions" className="mt-4">
          {decisions.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {decisions.map((d) => (
                <Panel key={d.id} title={d.title}>
                  <p className="text-xs leading-relaxed text-muted-foreground">{d.rationale}</p>
                  <div className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
                    <div>alternatives: {d.alternatives.join(" · ")}</div>
                    <div>decided: {new Date(d.decidedAt).toLocaleDateString()}</div>
                  </div>
                  <div className="mt-3">
                    <Pill tone={d.status === "accepted" ? "success" : "warning"}>{d.status}</Pill>
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No decisions recorded"
              hint="Architecture decisions are written here with rationale and rejected alternatives."
            />
          )}
        </TabsContent>

        <TabsContent value="architecture" className="mt-4">
          {architecture.length ? (
            <Panel bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {architecture.map((a) => (
                  <li key={a.layer} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
                    <span className="font-mono text-xs text-muted-foreground">{a.layer}</span>
                    <div>
                      <div className="text-sm">{a.choice}</div>
                      <p className="text-xs text-muted-foreground">{a.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <EmptyState
              title="Architecture not drafted"
              hint="The Architecture stage records the system shape per layer."
            />
          )}
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
