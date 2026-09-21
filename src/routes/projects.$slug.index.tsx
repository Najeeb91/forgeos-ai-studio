import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageBody, Panel } from "@/components/forge/shell";
import { StageRail } from "@/components/forge/stage-rail";
import { Pill, RiskPill } from "@/components/forge/status";
import { getProject } from "@/lib/forge/data";

export const Route = createFileRoute("/projects/$slug/")({
  component: Overview,
});

function Overview() {
  const { slug } = Route.useParams();
  const project = getProject(slug)!;
  const run = project.runs[0];
  const failing = project.brain.tests.filter((t) => t.status === "failing").length;

  return (
    <PageBody>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Requirements", value: project.brain.requirements.length, hint: "in brain" },
          { label: "Schema tables", value: project.brain.schema.length, hint: "tracked" },
          { label: "Failing tests", value: failing, hint: "blocking deploy" },
          {
            label: "Environments",
            value: project.deployments.length,
            hint: "preview / staging / prod",
          },
        ].map((stat) => (
          <div key={stat.label} className="panel p-4">
            <div className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              {stat.label}
            </div>
            <div className="mt-2 font-mono text-2xl">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.hint}</div>
          </div>
        ))}
      </div>

      <Panel
        title="Build pipeline"
        description="Lifecycle state for this project."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/projects/$slug/builder" params={{ slug }}>
              Open builder
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      >
        <StageRail stages={project.stages} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Vision">
          <p className="text-sm leading-relaxed text-muted-foreground">{project.brain.vision}</p>
        </Panel>

        <Panel title="Current AI run" {...(run ? { bodyClassName: "space-y-3" } : {})}>
          {run ? (
            <>
              <p className="rounded-md border border-border bg-elevated/50 p-3 font-mono text-xs leading-relaxed">
                {run.prompt}
              </p>
              <div className="flex flex-wrap gap-2">
                <Pill tone="info">{run.provider}</Pill>
                <Pill tone="warning">{run.status.replace("_", " ")}</Pill>
                <Pill tone="neutral">
                  {run.tokensIn + run.tokensOut} tokens
                </Pill>
              </div>
              <ul className="space-y-1.5">
                {run.plan.map((step) => (
                  <li key={step.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted-foreground">{step.title}</span>
                    <RiskPill risk={step.risk} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No AI run in flight.</p>
          )}
        </Panel>
      </div>
    </PageBody>
  );
}
