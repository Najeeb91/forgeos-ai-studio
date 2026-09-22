import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ExternalLink, RotateCcw } from "lucide-react";

import { PageBody, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { useForgeProject } from "@/lib/forge/use-project";

export const Route = createFileRoute("/projects/$slug/deploy")({
  component: Deploy,
});

function Deploy() {
  const { slug } = Route.useParams();
  const project = useForgeProject();

  return (
    <PageBody>
      <Panel
        title="Release control plane"
        description="Environment state recorded by ForgeOS. No deployment is performed from this surface."
        actions={<Pill tone="warning">simulated deployments</Pill>}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {(["preview", "staging", "production"] as const).map((env) => {
            const deployment = project.deployments.find((item) => item.env === env);

            return (
              <article key={env} className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-mono text-sm uppercase">{env}</h2>
                  <Pill
                    tone={
                      deployment?.status === "live"
                        ? "success"
                        : deployment?.status === "failed"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {deployment?.status ?? "not recorded"}
                  </Pill>
                </div>

                {deployment ? (
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Commit</span>
                      <code>{deployment.commit}</code>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Adapter</span>
                      <span>{deployment.adapter}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Recorded</span>
                      <span>{new Date(deployment.at).toLocaleString()}</span>
                    </div>
                    <a
                      href={`https://${deployment.url}`}
                      onClick={(event) => event.preventDefault()}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {deployment.url}
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">No deployment record.</p>
                )}

                <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <RotateCcw className="size-3" />
                    logs / rollback placeholder
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="Production approval gate">
        <div className="flex items-start gap-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 text-warning" />
          <div>
            <p className="font-medium">Production release requires human approval.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The project currently holds staging behind failing tests. ForgeOS does not claim or initiate a production rollout.
            </p>
          </div>
        </div>
      </Panel>
    </PageBody>
  );
}
