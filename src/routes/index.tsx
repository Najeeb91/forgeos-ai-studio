import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GitBranch, Plus, Rocket, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageBody, PageHeader, Panel, WorkspaceShell } from "@/components/forge/shell";
import { StageRail } from "@/components/forge/stage-rail";
import { Dot, Pill } from "@/components/forge/status";
import { listForgeProjects } from "@/lib/forge/repository";

export const Route = createFileRoute("/")({
  loader: async () => {
    return await listForgeProjects();
  },
  head: () => ({
    meta: [
      { title: "ForgeOS — Universal AI Software Factory" },
      {
        name: "description",
        content:
          "ForgeOS turns a software idea into a maintainable, deployable application across requirements, architecture, UI, data, code, testing and deployment.",
      },
      { property: "og:title", content: "ForgeOS — Universal AI Software Factory" },
      {
        property: "og:description",
        content: "An AI engineering workspace for building real applications end to end.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const data = Route.useLoaderData();
  const projects = data.projects;

  const approvals = projects.flatMap((p) =>
    p.stages.filter((s) => s.status === "needs_approval").map((s) => ({ project: p, stage: s })),
  );
  const failing = projects.flatMap((p) =>
    p.brain.tests.filter((t) => t.status === "failing").map((t) => ({ project: p, test: t })),
  );

  return (
    <WorkspaceShell>
      <PageHeader
        title="Workspace"
        description="Every project ForgeOS is building, with lifecycle state, risk gates and runtime health in one view."
        actions={
          <Button asChild>
            <Link to="/new">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        }
        meta={
          <>
            <Pill tone="primary">{projects.length} projects</Pill>
            <Pill tone="warning">{approvals.length} awaiting approval</Pill>
            <Pill tone="danger">{failing.length} failing tests</Pill>
            {data.source === "seed" ? <Pill tone="warning">demo data</Pill> : null}
            <Pill tone="info">provider router: active</Pill>
          </>
        }
      />

      <PageBody>
        {approvals.length > 0 ? (
          <Panel
            title="Human approval required"
            description="High-risk actions are held until a person signs off."
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {approvals.map(({ project, stage }) => (
                <li
                  key={`${project.id}-${stage.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {project.name} · {stage.label}
                      </div>
                      <p className="text-xs text-muted-foreground">{stage.summary}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/projects/$slug/builder" params={{ slug: project.slug }}>
                      Review
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              to="/projects/$slug"
              params={{ slug: project.slug }}
              className="panel block space-y-4 p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold tracking-tight">{project.name}</h3>
                    {project.benchmark ? <Pill tone="primary">benchmark</Pill> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{project.tagline}</p>
                </div>
                <Pill
                  tone={
                    project.health === "healthy"
                      ? "success"
                      : project.health === "attention"
                        ? "warning"
                        : "danger"
                  }
                >
                  <Dot
                    tone={
                      project.health === "healthy"
                        ? "success"
                        : project.health === "attention"
                          ? "warning"
                          : "danger"
                    }
                  />
                  {project.status}
                </Pill>
              </div>

              <StageRail stages={project.stages} compact />

              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch className="size-3.5" />
                  {project.stack.slice(0, 3).join(" · ")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Rocket className="size-3.5" />
                  {project.deployments.find((d) => d.env === "production")?.url ?? "not deployed"}
                </span>
                <span>updated {new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      </PageBody>
    </WorkspaceShell>
  );
}
