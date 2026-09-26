import { createFileRoute } from "@tanstack/react-router";
import { Bot, CircleAlert, GitCommit, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { PageBody, Panel } from "@/components/forge/shell";
import { Pill, RiskPill } from "@/components/forge/status";
import { useForgeProject } from "@/lib/forge/use-project";
import type { ChangeEntry } from "@/lib/forge/types";

export const Route = createFileRoute("/projects/$slug/history")({
  component: History,
});

function History() {
  const project = useForgeProject();
  const [filter, setFilter] = useState("all");
  const contextHistory = ((project as typeof project & { contextHistory?: Array<{id:string;kind:string;title:string;content:string;source:string;occurredAt:string}> }).contextHistory ?? []);

  const conversation = useMemo(() => project.runs.map((run) => ({
    id: run.id,
    at: run.startedAt,
    prompt: run.prompt,
    provider: run.provider,
    model: run.model,
    status: run.status,
  })).sort((a,b) => b.at.localeCompare(a.at)), [project.runs]);

  const decisions = useMemo(() => (project.brain.decisions ?? []).slice().sort((a,b) => b.decidedAt.localeCompare(a.decidedAt)), [project.brain.decisions]);

  const entries = useMemo(() => {
    const brainEvents = project.brain.history.map((entry) => ({ ...entry, source: "brain" as const }));
    const persistedAudit = ((project as typeof project & { auditHistory?: ChangeEntry[] }).auditHistory ?? []).map((entry) => ({
      ...entry, source: "ai" as const,
    }));
    const aiEvents: Array<ChangeEntry & { source: "ai" }> = project.runs.flatMap((run) =>
      run.events.map((event) => ({
        id: `${run.id}-${event.id}`,
        at: event.at,
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
    return [...brainEvents, ...persistedAudit, ...aiEvents]
      .sort((a,b) => b.at.localeCompare(a.at))
      .filter((entry) => filter === "all" || entry.actor === filter || entry.stage === filter);
  }, [filter, project]);

  return (
    <PageBody>
      <Panel
        title="Project conversation & history"
        description="Persistent project context: Builder requests, decisions, and execution history. This is project data, not a copy of the ChatGPT conversation."
        actions={
          <select value={filter} onChange={(event) => setFilter(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs">
            <option value="all">all activity</option><option value="ai">AI</option><option value="human">Human</option>
            <option value="system">System</option><option value="requirements">requirements</option>
            <option value="data">data</option><option value="test">test</option>
          </select>
        }
      >
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold">Recovered project context</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Durable checkpoints recovered from the ForgeOS project history. These are summaries of prior project work, not fabricated ChatGPT transcript messages.
            </p>
            <div className="mt-4 space-y-3">
              {contextHistory.length ? contextHistory.map((entry) => (
                <article key={entry.id} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="neutral">{entry.kind}</Pill>
                    <time className="font-mono text-[11px] text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</time>
                    <Pill tone="info">{entry.source}</Pill>
                  </div>
                  <h3 className="mt-2 text-sm font-medium">{entry.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{entry.content}</p>
                </article>
              )) : <div className="py-4 text-sm text-muted-foreground">No recovered project context yet.</div>}
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold">Project Memory</h2>
            <p className="mt-1 text-xs text-muted-foreground">Durable context merged from requirements, decisions, constraints, milestones, changes and outcomes.</p>
            <div className="mt-4 space-y-3">
              {(project.memory ?? []).length ? (project.memory ?? []).map((entry) => (
                <article key={entry.id} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2"><Pill tone="neutral">{entry.kind}</Pill><Pill tone="info">{entry.authorType}</Pill><time className="font-mono text-[11px] text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</time></div>
                  <h3 className="mt-2 text-sm font-medium">{entry.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{entry.content}</p>
                </article>
              )) : <div className="py-4 text-sm text-muted-foreground">No Project Memory entries yet.</div>}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Durable approvals & provider attempts</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="text-xs font-semibold">Approval requests</div>
                <div className="mt-3 space-y-2">
                  {(project.approvals ?? []).length ? (project.approvals ?? []).map((a) => (
                    <div key={a.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2"><Pill tone={a.status==="approved"?"success":a.status==="rejected"?"danger":"warning"}>{a.status}</Pill><RiskPill risk={a.risk}/></div>
                      <div className="mt-2 text-xs">{a.target}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{a.reason}</div>
                    </div>
                  )) : <div className="text-xs text-muted-foreground">No durable approvals yet.</div>}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="text-xs font-semibold">Provider attempts</div>
                <div className="mt-3 space-y-2">
                  {(project.providerAttempts ?? []).length ? (project.providerAttempts ?? []).map((a) => (
                    <div key={a.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2"><span className="text-xs">{a.provider}</span><Pill tone={a.status==="succeeded"?"success":a.status==="failed"?"danger":"neutral"}>{a.status}</Pill></div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{a.kind} · {a.capability} · simulated={String(a.simulated)}</div>
                    </div>
                  )) : <div className="text-xs text-muted-foreground">No provider attempts yet.</div>}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Project conversation</h2>
            <p className="mt-1 text-xs text-muted-foreground">Every persisted Builder request appears here as the project’s working conversation.</p>
            <div className="mt-4 space-y-3">
              {conversation.length ? conversation.map((run) => (
                <article key={run.id} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <time>{new Date(run.at).toLocaleString()}</time><Pill tone="info">{run.status}</Pill>
                    <Pill tone="neutral">{run.provider} · {run.model}</Pill>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{run.prompt}</p>
                </article>
              )) : <div className="py-4 text-sm text-muted-foreground">No persisted Builder conversation yet.</div>}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Decisions recorded in Project Brain</h2>
            <div className="mt-4 space-y-3">
              {decisions.length ? decisions.map((decision) => (
                <article key={decision.id} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={decision.status === "accepted" ? "success" : "warning"}>{decision.status}</Pill>
                    <time className="font-mono text-[11px] text-muted-foreground">{new Date(decision.decidedAt).toLocaleString()}</time>
                  </div>
                  <h3 className="mt-2 text-sm font-medium">{decision.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{decision.rationale}</p>
                </article>
              )) : <div className="py-4 text-sm text-muted-foreground">No persisted decisions yet.</div>}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Execution & audit timeline</h2>
            <div className="relative mt-4 ml-2 space-y-0 border-l border-border">
              {entries.length ? entries.map((entry) => (
                <article key={entry.id} className="relative pl-6 pb-6 last:pb-0">
                  <span className="absolute -left-[9px] top-1 grid size-4 place-items-center rounded-full border border-border bg-surface">
                    {entry.actor === "ai" ? <Bot className="size-2.5 text-primary" /> : entry.actor === "human" ? <UserRound className="size-2.5 text-info" /> : <GitCommit className="size-2.5 text-muted-foreground" />}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <time className="font-mono text-[11px] text-muted-foreground">{new Date(entry.at).toLocaleString()}</time>
                    <Pill tone="neutral">{entry.actor}</Pill>{entry.stage ? <Pill tone="info">{entry.stage}</Pill> : null}<RiskPill risk={entry.risk} />
                  </div>
                  <h3 className="mt-2 text-sm font-medium">{entry.action}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">target: {entry.target}{entry.diffSummary ? ` · change ${entry.diffSummary}` : ""}</p>
                </article>
              )) : <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><CircleAlert className="size-4" />No persisted project activity yet.</div>}
            </div>
          </section>
        </div>
      </Panel>
    </PageBody>
  );
}
