import { Check, Play, ShieldAlert, X } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, Panel } from "@/components/forge/shell";
import { Pill, RiskPill } from "@/components/forge/status";
import type { RiskLevel } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

const levelTone = {
  info: "text-muted-foreground",
  action: "text-info",
  warn: "text-warning",
  error: "text-destructive",
  approval: "text-primary",
} as const;

export type LocalStep = {
  id: string;
  title: string;
  detail: string;
  stage: string;
  risk: string;
  status: string;
  order_idx?: number;
};

export type LocalRun = {
  id: string;
  prompt: string;
  provider: string;
  model: string;
  status: string;
  startedAt: string;
  plan: LocalStep[];
  events: Array<{
    id: string;
    at: string;
    level: keyof typeof levelTone;
    stage: string;
    message: string;
  }>;
  approval?: {
    id: string;
    step_id?: string;
    actionType?: string;
    target?: string;
    reason?: string;
    risk?: string;
    status: string;
  };
  testsPassed?: boolean;
  sourceFileCount?: number;
  providerAttempts?: Array<{
    id: string;
    kind: string;
    provider: string;
    capability: string;
    status: string;
    priority?: number;
    simulated: boolean;
    started_at?: string;
    completed_at?: string;
    error?: string;
  }>;
};

interface BuilderPromptFormProps {
  prompt: string;
  setPrompt: (value: string) => void;
  building: boolean;
  onSubmit: (e: FormEvent) => void;
}

export function BuilderPromptForm({
  prompt,
  setPrompt,
  building,
  onSubmit,
}: BuilderPromptFormProps) {
  return (
    <Panel
      title="Instruct the builder"
      description="Scoped to this project's durable Brain and Memory."
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        <Textarea
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="font-mono text-[13px]"
          placeholder="e.g. Add tank dip capture to the shift close flow and include it in variance evidence."
        />
        <Button type="submit" size="sm" disabled={building || !prompt.trim()}>
          <Play className="size-3.5" />
          {building ? "Working…" : "Start Build"}
        </Button>
      </form>
    </Panel>
  );
}

interface PlanStepItemProps {
  step: LocalStep;
  gated: boolean;
  building: boolean;
  onDecide: (decision: "approved" | "rejected") => void;
}

export function PlanStepItem({ step, gated, building, onDecide }: PlanStepItemProps) {
  const riskLevel = (step.risk === "critical" ? "high" : step.risk) as RiskLevel;

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{step.title}</div>
        <div className="flex gap-2">
          <Pill tone="neutral">{step.stage}</Pill>
          <RiskPill risk={riskLevel} />
          <Pill
            tone={
              step.status === "done"
                ? "success"
                : step.status === "awaiting_approval"
                  ? "warning"
                  : "neutral"
            }
          >
            {step.status.replace("_", " ")}
          </Pill>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
      {step.status === "awaiting_approval" && gated ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/8 px-3 py-2">
          <ShieldAlert className="size-3.5 text-warning" />
          <span className="text-xs text-muted-foreground">
            High-risk real execution requires durable human approval.
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={building}
              onClick={() => onDecide("rejected")}
            >
              <X className="size-3.5" />
              Reject
            </Button>
            <Button size="sm" disabled={building} onClick={() => onDecide("approved")}>
              <Check className="size-3.5" />
              Approve & Execute
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

interface ExecutionPlanListProps {
  run: LocalRun | null;
  gated: boolean;
  building: boolean;
  onDecide: (decision: "approved" | "rejected") => void;
}

export function ExecutionPlanList({ run, gated, building, onDecide }: ExecutionPlanListProps) {
  if (!run) {
    return (
      <EmptyState
        title="No run in flight"
        hint="Describe a change and ForgeOS will create a durable plan before real execution."
      />
    );
  }

  return (
    <Panel
      title="Durable execution plan"
      description="High-risk execution is blocked until an approval record is created and decided."
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-border">
        {run.plan.map((step) => (
          <PlanStepItem
            key={step.id}
            step={step}
            gated={gated}
            building={building}
            onDecide={onDecide}
          />
        ))}
      </ul>
    </Panel>
  );
}

interface RunContextPanelProps {
  run: LocalRun;
}

export function RunContextPanel({ run }: RunContextPanelProps) {
  return (
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
          <dt className="text-muted-foreground">model</dt>
          <dd>{run.model}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">started</dt>
          <dd>{new Date(run.startedAt).toLocaleTimeString()}</dd>
        </div>
      </dl>
    </Panel>
  );
}

interface ProviderAttemptsPanelProps {
  attempts?: LocalRun["providerAttempts"];
}

export function ProviderAttemptsPanel({ attempts }: ProviderAttemptsPanelProps) {
  if (!attempts?.length) return null;

  return (
    <Panel title="Provider execution evidence">
      <div className="space-y-2 font-mono text-xs">
        {attempts.map((attempt) => (
          <div
            key={attempt.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
          >
            <Pill
              tone={
                attempt.status === "succeeded"
                  ? "success"
                  : attempt.status === "failed"
                    ? "danger"
                    : attempt.status === "running"
                      ? "warning"
                      : "neutral"
              }
            >
              {attempt.status}
            </Pill>
            <span>{attempt.provider}</span>
            <span className="text-muted-foreground">
              {attempt.kind}/{attempt.capability}
            </span>
            {attempt.error ? <span className="text-destructive">{attempt.error}</span> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

interface ExecutionLogPanelProps {
  events: LocalRun["events"];
}

export function ExecutionLogPanel({ events }: ExecutionLogPanelProps) {
  return (
    <Panel title="Execution log" bodyClassName="p-0">
      <div className="max-h-[520px] overflow-y-auto font-mono text-xs">
        {events.map((e) => (
          <div key={e.id} className="flex gap-3 border-b border-border/60 px-4 py-2 last:border-0">
            <span className="text-muted-foreground">{e.at}</span>
            <span className="w-24 shrink-0 text-muted-foreground">{e.stage}</span>
            <span className={cn("min-w-0 flex-1", levelTone[e.level])}>{e.message}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

interface VerifiedOutcomePanelProps {
  testsPassed?: boolean;
  building: boolean;
  runStatus: string;
  onRelease: () => void;
}

export function VerifiedOutcomePanel({
  testsPassed,
  building,
  runStatus,
  onRelease,
}: VerifiedOutcomePanelProps) {
  if (!testsPassed) return null;

  return (
    <Panel title="Verified outcome">
      <p className="text-sm text-success">
        Real build passed. ForgeOS recorded the result as non-simulated.
      </p>
      <div className="mt-3">
        <Button size="sm" onClick={onRelease} disabled={building || runStatus === "deploying"}>
          {building ? "Releasing…" : "Release to production"}
        </Button>
      </div>
    </Panel>
  );
}
