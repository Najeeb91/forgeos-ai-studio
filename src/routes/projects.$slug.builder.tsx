import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Play, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageBody, EmptyState, Panel } from "@/components/forge/shell";
import { Pill, RiskPill } from "@/components/forge/status";
import { getProject } from "@/lib/forge/data";
import { runForgeBuild } from "@/lib/forge/execution.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$slug/builder")({
  component: Builder,
});

const levelTone = {
  info: "text-muted-foreground",
  action: "text-info",
  warn: "text-warning",
  error: "text-destructive",
  approval: "text-primary",
} as const;

function Builder() {
  const { slug } = Route.useParams();
  const project = getProject(slug)!;
  const run = project.runs[0];
  const [prompt, setPrompt] = useState("");
  const [decisions, setDecisions] = useState<Record<string, "approved" | "rejected">>({});
  const [building, setBuilding] = useState(false);

  return (
    <PageBody className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="space-y-5">
        <Panel title="Instruct the builder" description="Scoped to this project's brain.">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!prompt.trim()) return;
              setBuilding(true);
              const requestedPrompt = prompt.trim();
              const runId = globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}`;
              try {
                const result = await runForgeBuild({ data: { runId, prompt: requestedPrompt } });
                if (result.state === "passed") {
                  toast.success(`Real worker build passed — ${result.sourceFileCount} source files verified.`);
                } else {
                  toast.error("Real worker build failed. Open Tests/History for execution details.");
                }
                setPrompt("");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "ForgeOS execution failed");
              } finally {
                setBuilding(false);
              }
            }}
          >
            <Textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="font-mono text-[13px]"
              placeholder="e.g. Add tank dip capture to the shift close flow and include it in variance evidence."
            />
            <Button type="submit" size="sm" disabled={building}>
              <Play className="size-3.5" />
              {building ? "Building…" : "Build & verify"}
            </Button>
          </form>
        </Panel>

        {run ? (
          <Panel
            title="Generated plan"
            description="Approve each high-risk step before it executes."
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {run.plan.map((step) => {
                const decision = decisions[step.id];
                const awaiting = step.status === "awaiting_approval" && !decision;
                return (
                  <li key={step.id} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">{step.title}</div>
                      <div className="flex gap-2">
                        <Pill tone="neutral">{step.stage}</Pill>
                        <RiskPill risk={step.risk} />
                        <Pill
                          tone={
                            decision === "approved"
                              ? "success"
                              : decision === "rejected"
                                ? "danger"
                                : step.status === "done"
                                  ? "success"
                                  : step.status === "running"
                                    ? "info"
                                    : awaiting
                                      ? "warning"
                                      : "neutral"
                          }
                        >
                          {decision ?? step.status.replace("_", " ")}
                        </Pill>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                    {awaiting ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/8 px-3 py-2">
                        <ShieldAlert className="size-3.5 text-warning" />
                        <span className="text-xs text-muted-foreground">
                          Destructive change — human approval required.
                        </span>
                        <div className="ml-auto flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDecisions((d) => ({ ...d, [step.id]: "rejected" }));
                              toast("Step rejected — builder will re-plan.");
                            }}
                          >
                            <X className="size-3.5" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setDecisions((d) => ({ ...d, [step.id]: "approved" }));
                              toast.success("Approved — step released to the runner.");
                            }}
                          >
                            <Check className="size-3.5" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No run in flight"
            hint="Describe a change above and ForgeOS will draft a plan before touching any code."
          />
        )}
      </div>

      <div className="space-y-5">
        {run ? (
          <>
            <Panel title="Run context">
              <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div>
                  <dt className="text-muted-foreground">run</dt>
                  <dd>{run.id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">route</dt>
                  <dd>{run.provider}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">tokens in / out</dt>
                  <dd>
                    {run.tokensIn} / {run.tokensOut}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">started</dt>
                  <dd>{new Date(run.startedAt).toLocaleTimeString()}</dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Execution log" bodyClassName="p-0">
              <div className="max-h-[520px] overflow-y-auto font-mono text-xs">
                {run.events.map((e) => (
                  <div
                    key={e.id}
                    className="flex gap-3 border-b border-border/60 px-4 py-2 last:border-0"
                  >
                    <span className="text-muted-foreground">{e.at}</span>
                    <span className="w-24 shrink-0 text-muted-foreground">{e.stage}</span>
                    <span className={cn("min-w-0 flex-1", levelTone[e.level])}>{e.message}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        ) : null}
      </div>
    </PageBody>
  );
}
