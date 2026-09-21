import { createFileRoute, Link } from "@tanstack/react-router";

import { PageBody, PageHeader, Panel, WorkspaceShell } from "@/components/forge/shell";
import { Pill, RiskPill } from "@/components/forge/status";
import { listForgeProjects } from "@/lib/forge/repository";

export const Route = createFileRoute("/activity")({
  loader: async () => {
    return await listForgeProjects();
  },
  head: () => ({
    meta: [
      { title: "Activity — ForgeOS" },
      {
        name: "description",
        content:
          "Auditable history of every AI and human change across ForgeOS projects, with risk level and approval state.",
      },
      { property: "og:title", content: "Activity — ForgeOS" },
      {
        property: "og:description",
        content: "Every AI change in ForgeOS is attributed, risk-rated and auditable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Activity,
});

function Activity() {
  const data = Route.useLoaderData();
  const projects = data.projects;

  const entries = projects
    .flatMap((p) => p.brain.history.map((h) => ({ project: p, entry: h })))
    .sort((a, b) => b.entry.at.localeCompare(a.entry.at));

  return (
    <WorkspaceShell>
      <PageHeader
        title="Activity"
        description="A single audit trail across projects. Every AI action is attributed to a run, scored for risk and marked with its approval state."
        meta={
          <>
            <Pill tone="info">{entries.length} events</Pill>
            <Pill tone="warning">
              {entries.filter((e) => e.entry.approved === null).length} unresolved
            </Pill>
            {data.source === "seed" ? <Pill tone="warning">demo data</Pill> : null}
          </>
        }
      />

      <PageBody>
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {entries.map(({ project, entry }) => (
              <li key={entry.id} className="flex flex-wrap items-start gap-3 px-4 py-4">
                <span className="w-36 shrink-0 font-mono text-[11px] text-muted-foreground">
                  {new Date(entry.at).toLocaleString()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/projects/$slug"
                      params={{ slug: project.slug }}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {project.name}
                    </Link>
                    <Pill
                      tone={
                        entry.actor === "ai"
                          ? "primary"
                          : entry.actor === "human"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {entry.actorName}
                    </Pill>
                    <RiskPill risk={entry.risk} />
                    <Pill
                      tone={
                        entry.approved === true
                          ? "success"
                          : entry.approved === null
                            ? "warning"
                            : "danger"
                      }
                    >
                      {entry.approved === true
                        ? "approved"
                        : entry.approved === null
                          ? "pending"
                          : "rejected"}
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm">{entry.action}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {entry.target}
                    {entry.diffSummary ? ` · ${entry.diffSummary}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </PageBody>
    </WorkspaceShell>
  );
}
