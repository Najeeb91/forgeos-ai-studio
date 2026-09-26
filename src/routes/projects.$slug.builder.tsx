import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageBody } from "@/components/forge/shell";
import {
  BuilderPromptForm,
  ExecutionLogPanel,
  ExecutionPlanList,
  ProviderAttemptsPanel,
  RunContextPanel,
  VerifiedOutcomePanel,
  type LocalRun,
} from "@/components/forge/builder-views";
import { useForgeProject } from "@/lib/forge/use-project";
import {
  approveForgeBuild,
  getForgeExecutionRun,
  runForgeBuild,
} from "@/lib/forge/execution.functions";
import { getForgeDeploymentStatus, releaseForgeProject } from "@/lib/forge/deploy.functions";

export const Route = createFileRoute("/projects/$slug/builder")({
  component: Builder,
  validateSearch: z.object({
    run: z.string().optional(),
  }),
});

interface RemoteStep {
  id: string | number;
  title: string;
  detail?: string;
  stage: string;
  risk?: string;
  status?: string;
  order_idx?: number;
}

interface RemoteEvent {
  id: string | number;
  created_at: string;
  level: LocalRun["events"][number]["level"];
  stage: string;
  message: string;
}

interface RemoteApproval {
  id: string | number;
  step_id?: string;
  action_type?: string;
  target?: string;
  reason?: string;
  risk?: string;
  status: string;
}

interface RemoteTest {
  status: string;
}

interface RemoteProviderAttempt {
  id: string | number;
  kind: string;
  provider: string;
  capability: string;
  status: string;
  priority?: number;
  simulated: boolean;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

interface RemoteExecutionRun {
  run: {
    id: string;
    prompt: string;
    provider?: string;
    model?: string;
    status: string;
    started_at?: string;
    created_at: string;
  };
  approvals?: RemoteApproval[];
  tests?: RemoteTest[];
  steps?: RemoteStep[];
  events?: RemoteEvent[];
  providerAttempts?: RemoteProviderAttempt[];
}

function addEvent(run: LocalRun, event: LocalRun["events"][number]): LocalRun {
  return { ...run, events: [...run.events, event] };
}

function Builder() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  useForgeProject();

  const [prompt, setPrompt] = useState("");
  const [activeRun, setActiveRun] = useState<LocalRun | null>(null);
  const [building, setBuilding] = useState(false);
  const [approvalKind, setApprovalKind] = useState<"build" | "deployment">("build");

  useEffect(() => {
    const saved = search.run ?? globalThis.localStorage?.getItem(`forgeos:last-run:${slug}`);
    if (!saved) return;
    void getForgeExecutionRun({ data: { runId: saved } })
      .then((remote: RemoteExecutionRun) => {
        const latestApproval =
          [...(remote.approvals ?? [])].reverse().find((a) => a.status === "pending") ??
          [...(remote.approvals ?? [])].reverse()[0];
        const latestTest = [...(remote.tests ?? [])].reverse()[0];
        setApprovalKind(
          latestApproval?.action_type === "deploy_production" ? "deployment" : "build",
        );
        setActiveRun({
          id: remote.run.id,
          prompt: remote.run.prompt,
          provider: remote.run.provider ?? "provider-router",
          model: remote.run.model ?? "pending",
          status: remote.run.status,
          startedAt: remote.run.started_at ?? remote.run.created_at,
          plan: (remote.steps ?? []).map((s) => ({
            id: String(s.id),
            title: String(s.title),
            detail: String(s.detail ?? ""),
            stage: String(s.stage),
            risk: String(s.risk ?? "low"),
            status: String(s.status ?? "pending"),
            order_idx: Number(s.order_idx ?? 0),
          })),
          events: (remote.events ?? []).map((e) => ({
            id: String(e.id),
            at: e.created_at,
            level: e.level,
            stage: String(e.stage),
            message: String(e.message),
          })),
          approval: latestApproval
            ? {
                id: String(latestApproval.id),
                step_id: latestApproval.step_id ?? undefined,
                actionType: latestApproval.action_type ?? undefined,
                target: latestApproval.target ?? undefined,
                reason: latestApproval.reason ?? undefined,
                risk: latestApproval.risk ?? undefined,
                status: latestApproval.status,
              }
            : undefined,
          testsPassed: latestTest?.status === "passed",
          sourceFileCount: undefined,
          providerAttempts: (remote.providerAttempts ?? []).map((a) => ({
            id: String(a.id),
            kind: String(a.kind),
            provider: String(a.provider),
            capability: String(a.capability),
            status: String(a.status),
            priority: Number(a.priority ?? 0),
            simulated: Boolean(a.simulated),
            started_at: a.started_at,
            completed_at: a.completed_at,
            error: a.error ?? undefined,
          })),
        });
      })
      .catch(() => {
        globalThis.localStorage?.removeItem(`forgeos:last-run:${slug}`);
      });
  }, [slug, search.run]);

  async function startBuild() {
    if (!prompt.trim()) return;
    setBuilding(true);
    const requestedPrompt = prompt.trim();
    const runId = globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}`;
    const startedAt = new Date().toISOString();
    try {
      const result = await runForgeBuild({
        data: { runId, projectSlug: slug, prompt: requestedPrompt, approved: false },
      });
      const plan = ((result.plan as RemoteStep[] | undefined) ?? []).map((s) => ({
        id: String(s.id ?? `${runId}-${s.order_idx ?? 0}`),
        title: String(s.title),
        detail: String(s.detail ?? ""),
        stage: String(s.stage),
        risk: String(s.risk ?? "low"),
        status: String(s.status ?? "pending"),
        order_idx: Number(s.order_idx ?? 0),
      }));
      let next: LocalRun = {
        id: runId,
        prompt: requestedPrompt,
        provider: result.provider ?? "provider-router",
        model: result.model ?? "pending",
        status: result.state,
        startedAt,
        plan,
        events: [],
        approval: result.approval ? { ...result.approval } : undefined,
        providerAttempts: [],
      };
      next = addEvent(next, {
        id: `${runId}-created`,
        at: new Date().toISOString(),
        level: "info",
        stage: "plan",
        message:
          result.state === "awaiting_approval"
            ? "Durable plan created; waiting for human approval."
            : "Plan accepted for execution.",
      });
      globalThis.localStorage?.setItem(`forgeos:last-run:${slug}`, runId);
      setActiveRun(next);
      if (result.state === "awaiting_approval")
        toast("Plan ready — approve the gated execution step.");
      else if (result.state === "passed")
        toast.success(`Real build passed — ${result.sourceFileCount ?? 0} source files verified.`);
      else toast.error("ForgeOS build failed. Review the execution log.");
      setPrompt("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ForgeOS execution failed");
    } finally {
      setBuilding(false);
    }
  }

  async function decide(decision: "approved" | "rejected") {
    if (!activeRun?.approval) return;
    setBuilding(true);
    try {
      const approval = await approveForgeBuild({
        data: { runId: activeRun.id, approvalId: activeRun.approval.id, decision },
      });
      let next = addEvent(activeRun, {
        id: `${activeRun.id}-approval-${Date.now()}`,
        at: new Date().toISOString(),
        level: "approval",
        stage: approvalKind === "deployment" ? "deploying" : "approval",
        message: `Human approval decision: ${decision}`,
      });
      next = { ...next, approval: { ...next.approval!, status: decision }, status: approval.state };
      if (decision === "rejected") {
        setActiveRun(next);
        toast("Execution rejected and durably recorded.");
        return;
      }
      if (approvalKind === "deployment") {
        const deployed = await releaseForgeProject({
          data: { runId: activeRun.id, projectSlug: slug, environment: "production" },
        });
        next = {
          ...next,
          status: deployed.state,
          approval: deployed.approval
            ? { ...deployed.approval, actionType: "deploy_production" }
            : undefined,
        };
        next = addEvent(next, {
          id: `${activeRun.id}-deploy-${Date.now()}`,
          at: new Date().toISOString(),
          level: deployed.state === "deploying" ? "info" : "error",
          stage: "deploying",
          message: deployed.deployment?.url
            ? "Real deployment adapter returned a URL."
            : "Deployment adapter processed the request.",
        });
        setActiveRun(next);
        if (deployed.state === "deploying") {
          toast.success("Deployment adapter accepted the release.");
          void watchDeployment(activeRun.id);
        }
        return;
      }
      const result = await runForgeBuild({
        data: { runId: activeRun.id, projectSlug: slug, prompt: activeRun.prompt, approved: true },
      });
      next = {
        ...next,
        status: result.state,
        plan: ((result.plan as RemoteStep[] | undefined) ?? next.plan).map((s) => ({
          ...s,
          id: String(s.id),
          title: String(s.title),
          detail: String(s.detail ?? ""),
          stage: String(s.stage),
          risk: String(s.risk ?? "low"),
          status: String(s.status ?? "pending"),
          order_idx: Number(s.order_idx ?? 0),
        })),
        sourceFileCount: result.sourceFiles?.length ?? result.sourceFileCount ?? 0,
        testsPassed: result.state === "passed",
      };
      next = addEvent(next, {
        id: `${activeRun.id}-result-${Date.now()}`,
        at: new Date().toISOString(),
        level: result.state === "passed" ? "info" : "error",
        stage: "test",
        message:
          result.state === "passed"
            ? "Real build verification passed."
            : "Real build verification failed.",
      });
      setActiveRun(next);
      if (result.state === "passed")
        toast.success("Approved execution completed and real build passed.");
      else toast.error("Approved execution ran, but the real build failed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval/execution failed");
    } finally {
      setBuilding(false);
    }
  }

  async function watchDeployment(runId: string) {
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const status = await getForgeDeploymentStatus({ data: { runId } });
        const normalized = String(status.state ?? "unknown");
        setActiveRun((current) =>
          current
            ? addEvent(
                { ...current, status: normalized },
                {
                  id: `${runId}-deploy-status-${Date.now()}`,
                  at: new Date().toISOString(),
                  level:
                    normalized === "ready" ? "info" : normalized === "failed" ? "error" : "action",
                  stage: "deploying",
                  message:
                    normalized === "ready"
                      ? "Production deployment is live and verified by the provider."
                      : `Deployment provider status: ${normalized}.`,
                },
              )
            : current,
        );
        if (normalized === "ready" || normalized === "failed" || normalized === "cancelled") return;
      } catch (error) {
        setActiveRun((current) =>
          current
            ? addEvent(current, {
                id: `${runId}-deploy-status-error-${Date.now()}`,
                at: new Date().toISOString(),
                level: "warn",
                stage: "deploying",
                message:
                  error instanceof Error
                    ? `Deployment status check: ${error.message}`
                    : "Deployment status check failed.",
              })
            : current,
        );
      }
    }
  }

  async function release() {
    if (!activeRun?.testsPassed) return;
    setBuilding(true);
    try {
      const result = await releaseForgeProject({
        data: { runId: activeRun.id, projectSlug: slug, environment: "production" },
      });
      if (result.state === "awaiting_approval" && result.approval) {
        setApprovalKind("deployment");
        setActiveRun({
          ...activeRun,
          status: "awaiting_approval",
          approval: { ...result.approval, actionType: "deploy_production" },
        });
        toast("Production deployment is waiting for durable approval.");
      } else {
        setActiveRun({ ...activeRun, status: "deploying" });
        toast.success(
          result.deployment?.url
            ? `Deployment created: ${result.deployment.url}`
            : "Deployment request accepted.",
        );
        void watchDeployment(activeRun.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deployment failed");
    } finally {
      setBuilding(false);
    }
  }

  const run = activeRun;
  const gated = run?.approval?.status === "pending";

  const handlePromptSubmit = (e: FormEvent) => {
    e.preventDefault();
    void startBuild();
  };

  return (
    <PageBody className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="space-y-5">
        <BuilderPromptForm
          prompt={prompt}
          setPrompt={setPrompt}
          building={building}
          onSubmit={handlePromptSubmit}
        />
        <ExecutionPlanList
          run={run}
          gated={gated}
          building={building}
          onDecide={(decision) => void decide(decision)}
        />
      </div>

      <div className="space-y-5">
        {run ? (
          <>
            <RunContextPanel run={run} />
            <ProviderAttemptsPanel attempts={run.providerAttempts} />
            <ExecutionLogPanel events={run.events} />
            <VerifiedOutcomePanel
              testsPassed={run.testsPassed}
              building={building}
              runStatus={run.status}
              onRelease={() => void release()}
            />
          </>
        ) : null}
      </div>
    </PageBody>
  );
}
