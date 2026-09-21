import { createFileRoute } from "@tanstack/react-router";
import { Bot, CircleAlert, GitCommit, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { PageBody, Panel } from "@/components/forge/shell";
import { Pill, RiskPill } from "@/components/forge/status";
import { getProject } from "@/lib/forge/data";
import type { ChangeEntry } from "@/lib/forge/types";

export const Route = createFileRoute("/projects/$slug/history")({
  component: History,
});

function History() {
  const { slug } = Route.useParams();
  const project = getProject(slug)!;
  const [filter, setFilter] = useState("all");

  const entries = useMemo(() => {
    const brainEvents = project.brain.history.map((entry) => ({ ...entry, source: "brain" as const }));
    const aiEvents: Array<ChangeEntry & { source: "ai" }> = project.runs.flatMap((run) =>
      run.events.map((event) => ({
        id: `${run.id}-${event.id}`,
        at: `2026-09-20T${event.at}Z`,
        actor: (event.level === "approval" ? "human" : "ai") as ChangeEntry["actor"],
        actorName: event.level === "approval" ? "Approval gate" : "Forge Builder",
        action: event.message,
        target: event.stage,
        risk: (event.level === "error" || event.level === "warn" ? "high" : "low") as ChangeEntry["risk"],
        approved: event.level === "approval" ? null : true,
        stage: event.stage,
        source: "ai" as const,
      })),
    );

    const allEntries: Array<ChangeEntry & { source: "brain" | "ai" }> = [...brainEvents, ...aiEvents];

    return allEntries
      .sort((a, b) => b.at.localeCompare(a.at))
      .filter((entry) => filter === "all" || entry.actor === filter || entry.stage === filter);
  }, [filter, project]);

  return (
    <PageBody>
      <Panel
        title="Activity timeline"
        description="Chronological audit trail combining Project Brain changes and AI events."
        actions={
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="all">all activity</option>
            <option value="ai">AI</option>
            <option value="human">Human</option>
            <option value="system">System</option>
            <option value="requirements">requirements</option>
            <option value="data">data</option>
            <option value="test">test</option>
          </select>
        }
      >
        <div className="relative ml-2 space-y-0 border-l border-border">
          {entries.length ? (
            entries.map((entry) => (
              <article key={entry.id} className="relative pl-6 pb-6 last:pb-0">
                <span className="absolute -left-[9px] top-1 grid size-4 place-items-center rounded-full border border-border bg-surface">
                  {entry.actor === "ai" ? (
                    <Bot className="size-2.5 text-primary" />
                  ) : entry.actor === "human" ? (
                    <UserRound className="size-2.5 text-info" />
                  ) : (
                    <GitCommit className="size-2.5 text-muted-foreground" />
                  )}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <time className="font-mono text-[11px] text-muted-foreground">
                    {new Date(entry.at).toLocaleString()}
                  </time>
                  <Pill tone="neutral">{entry.actor}</Pill>
                  {entry.stage ? <Pill tone="info">{entry.stage}</Pill> : null}
                  <RiskPill risk={entry.risk} />
                  {entry.approved === null ? (
                    <Pill tone="warning">approval pending</Pill>
                  ) : entry.approved ? (
                    <Pill tone="success">approved</Pill>
                  ) : null}
                </div>

                <h2 className="mt-2 text-sm font-medium">{entry.action}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  target: {entry.target}
                  {entry.diffSummary ? ` · change ${entry.diffSummary}` : ""}
                </p>
              </article>
            ))
          ) : (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <CircleAlert className="size-4" />
              No activity matches this filter.
            </div>
          )}
        </div>
      </Panel>
    </PageBody>
  );
}
