import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Play, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageBody, EmptyState, Panel } from "@/components/forge/shell";
import { Pill, RiskPill } from "@/components/forge/status";
import { useForgeProject } from "@/lib/forge/use-project";
import { approveForgeBuild, runForgeBuild } from "@/lib/forge/execution.functions";
import { getForgeDeploymentStatus, releaseForgeProject } from "@/lib/forge/deploy.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$slug/builder")({ component: Builder });

const levelTone = {
  info: "text-muted-foreground",
  action: "text-info",
  warn: "text-warning",
  error: "text-destructive",
  approval: "text-primary",
} as const;

type LocalStep = { id:string; title:string; detail:string; stage:string; risk:string; status:string; order_idx?:number };
type LocalRun = {
  id:string;
  prompt:string;
  provider:string;
  model:string;
  status:string;
  startedAt:string;
  plan:LocalStep[];
  events:Array<{id:string;at:string;level:keyof typeof levelTone;stage:string;message:string}>;
  approval?: { id:string; step_id?:string; actionType?:string; target?:string; reason?:string; risk?:string; status:string };
  testsPassed?:boolean;
  sourceFileCount?:number;
};

function Builder() {
  const { slug } = Route.useParams();
  useForgeProject();
  const [prompt, setPrompt] = useState("");
  const [activeRun, setActiveRun] = useState<LocalRun | null>(null);
  const [building, setBuilding] = useState(false);
  const [approvalKind, setApprovalKind] = useState<"build"|"deployment">("build");

  function addEvent(run:LocalRun,event:LocalRun["events"][number]) {
    return { ...run, events:[...run.events,event] };
  }

  async function startBuild() {
    if (!prompt.trim()) return;
    setBuilding(true);
    const requestedPrompt = prompt.trim();
    const runId = globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}`;
    const startedAt = new Date().toISOString();
    try {
      const result = await runForgeBuild({data:{runId,projectSlug:slug,prompt:requestedPrompt,approved:false}});
      const plan = (result.plan ?? []).map((s:any)=>({
        id:String(s.id ?? `${runId}-${s.order_idx ?? 0}`),
        title:String(s.title),
        detail:String(s.detail ?? ""),
        stage:String(s.stage),
        risk:String(s.risk ?? "low"),
        status:String(s.status ?? "pending"),
        order_idx:Number(s.order_idx ?? 0),
      }));
      let next:LocalRun = {
        id:runId,prompt:requestedPrompt,provider:result.provider ?? "provider-router",
        model:result.model ?? "pending",status:result.state,startedAt,plan,events:[],
        approval:result.approval ? {...result.approval} : undefined,
      };
      next=addEvent(next,{id:`${runId}-created`,at:new Date().toISOString(),level:"info",stage:"plan",message:result.state==="awaiting_approval"?"Durable plan created; waiting for human approval.":"Plan accepted for execution."});
      setActiveRun(next);
      if(result.state==="awaiting_approval") toast("Plan ready — approve the gated execution step.");
      else if(result.state==="passed") toast.success(`Real build passed — ${result.sourceFileCount ?? 0} source files verified.`);
      else toast.error("ForgeOS build failed. Review the execution log.");
      setPrompt("");
    } catch(error) {
      toast.error(error instanceof Error ? error.message : "ForgeOS execution failed");
    } finally { setBuilding(false); }
  }

  async function decide(decision:"approved"|"rejected") {
    if(!activeRun?.approval) return;
    setBuilding(true);
    try {
      const approval=await approveForgeBuild({data:{runId:activeRun.id,approvalId:activeRun.approval.id,decision}});
      let next=addEvent(activeRun,{id:`${activeRun.id}-approval-${Date.now()}`,at:new Date().toISOString(),level:"approval",stage:approvalKind==="deployment"?"deploying":"approval",message:`Human approval decision: ${decision}`});
      next={...next,approval:{...next.approval!,status:decision},status:approval.state};
      if(decision==="rejected") {
        setActiveRun(next);
        toast("Execution rejected and durably recorded.");
        return;
      }
      if(approvalKind==="deployment"){
        const deployed=await releaseForgeProject({data:{runId:activeRun.id,projectSlug:slug,environment:"production"}});
        next={...next,status:deployed.state,approval:deployed.approval ? {...deployed.approval,actionType:"deploy_production"} : undefined};
        next=addEvent(next,{id:`${activeRun.id}-deploy-${Date.now()}`,at:new Date().toISOString(),level:deployed.state==="deploying"?"info":"error",stage:"deploying",message:deployed.deployment?.url ? "Real deployment adapter returned a URL." : "Deployment adapter processed the request."});
        setActiveRun(next);
        if(deployed.state==="deploying") {
          toast.success("Deployment adapter accepted the release.");
          void watchDeployment(activeRun.id);
        }
        return;
      }
      const result=await runForgeBuild({data:{runId:activeRun.id,projectSlug:slug,prompt:activeRun.prompt,approved:true}});
      next={...next,status:result.state,plan:(result.plan ?? next.plan).map((s:any)=>({...s,id:String(s.id),title:String(s.title),detail:String(s.detail ?? ""),stage:String(s.stage),risk:String(s.risk ?? "low"),status:String(s.status ?? "pending"),order_idx:Number(s.order_idx ?? 0)})),sourceFileCount:result.sourceFiles?.length ?? result.sourceFileCount ?? 0,testsPassed:result.state==="passed"};
      next=addEvent(next,{id:`${activeRun.id}-result-${Date.now()}`,at:new Date().toISOString(),level:result.state==="passed"?"info":"error",stage:"test",message:result.state==="passed"?"Real build verification passed.":"Real build verification failed."});
      setActiveRun(next);
      if(result.state==="passed") toast.success("Approved execution completed and real build passed.");
      else toast.error("Approved execution ran, but the real build failed.");
    } catch(error) {
      toast.error(error instanceof Error ? error.message : "Approval/execution failed");
    } finally { setBuilding(false); }
  }

  async function watchDeployment(runId:string) {
    for(let attempt=0; attempt<60; attempt++){
      await new Promise((resolve)=>setTimeout(resolve,3000));
      try {
        const status=await getForgeDeploymentStatus({data:{runId}});
        const normalized=String(status.state ?? "unknown");
        setActiveRun((current)=>current ? addEvent({...current,status:normalized},{
          id:`${runId}-deploy-status-${Date.now()}`,
          at:new Date().toISOString(),
          level:normalized==="ready" ? "info" : normalized==="failed" ? "error" : "action",
          stage:"deploying",
          message:normalized==="ready" ? "Production deployment is live and verified by the provider." : `Deployment provider status: ${normalized}.`,
        }) : current);
        if(normalized==="ready" || normalized==="failed" || normalized==="cancelled") return;
      } catch(error) {
        setActiveRun((current)=>current ? addEvent(current,{
          id:`${runId}-deploy-status-error-${Date.now()}`,
          at:new Date().toISOString(),
          level:"warn",
          stage:"deploying",
          message:error instanceof Error ? `Deployment status check: ${error.message}` : "Deployment status check failed.",
        }) : current);
      }
    }
  }

  async function release() {
    if(!activeRun?.testsPassed) return;
    setBuilding(true);
    try {
      const result=await releaseForgeProject({data:{runId:activeRun.id,projectSlug:slug,environment:"production"}});
      if(result.state==="awaiting_approval" && result.approval){
        setApprovalKind("deployment");
        setActiveRun({...activeRun,status:"awaiting_approval",approval:{...result.approval,actionType:"deploy_production"}});
        toast("Production deployment is waiting for durable approval.");
      } else {
        setActiveRun({...activeRun,status:"deploying"});
        toast.success(result.deployment?.url ? `Deployment created: ${result.deployment.url}` : "Deployment request accepted.");
        void watchDeployment(activeRun.id);
      }
    } catch(error) { toast.error(error instanceof Error ? error.message : "Deployment failed"); }
    finally { setBuilding(false); }
  }

  const run=activeRun;
  const gated=run?.approval?.status==="pending";

  return (
    <PageBody className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="space-y-5">
        <Panel title="Instruct the builder" description="Scoped to this project's durable Brain and Memory.">
          <form className="space-y-3" onSubmit={(e)=>{e.preventDefault();void startBuild();}}>
            <Textarea rows={5} value={prompt} onChange={(e)=>setPrompt(e.target.value)} className="font-mono text-[13px]" placeholder="e.g. Add tank dip capture to the shift close flow and include it in variance evidence." />
            <Button type="submit" size="sm" disabled={building || !prompt.trim()}>
              <Play className="size-3.5" />{building ? "Working…" : "Start Build"}
            </Button>
          </form>
        </Panel>

        {run ? (
          <Panel title="Durable execution plan" description="High-risk execution is blocked until an approval record is created and decided." bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {run.plan.map((step)=>(
                <li key={step.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{step.title}</div>
                    <div className="flex gap-2">
                      <Pill tone="neutral">{step.stage}</Pill>
                      <RiskPill risk={step.risk as any} />
                      <Pill tone={step.status==="done"?"success":step.status==="awaiting_approval"?"warning":"neutral"}>{step.status.replace("_"," ")}</Pill>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                  {step.status==="awaiting_approval" && gated ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/8 px-3 py-2">
                      <ShieldAlert className="size-3.5 text-warning" />
                      <span className="text-xs text-muted-foreground">High-risk real execution requires durable human approval.</span>
                      <div className="ml-auto flex gap-2">
                        <Button size="sm" variant="outline" disabled={building} onClick={()=>void decide("rejected")}><X className="size-3.5" />Reject</Button>
                        <Button size="sm" disabled={building} onClick={()=>void decide("approved")}><Check className="size-3.5" />Approve & Execute</Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState title="No run in flight" hint="Describe a change and ForgeOS will create a durable plan before real execution." />
        )}
      </div>

      <div className="space-y-5">
        {run ? (
          <>
            <Panel title="Run context">
              <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div><dt className="text-muted-foreground">run</dt><dd>{run.id}</dd></div>
                <div><dt className="text-muted-foreground">route</dt><dd>{run.provider}</dd></div>
                <div><dt className="text-muted-foreground">model</dt><dd>{run.model}</dd></div>
                <div><dt className="text-muted-foreground">started</dt><dd>{new Date(run.startedAt).toLocaleTimeString()}</dd></div>
              </dl>
            </Panel>
            <Panel title="Execution log" bodyClassName="p-0">
              <div className="max-h-[520px] overflow-y-auto font-mono text-xs">
                {run.events.map((e)=><div key={e.id} className="flex gap-3 border-b border-border/60 px-4 py-2 last:border-0"><span className="text-muted-foreground">{e.at}</span><span className="w-24 shrink-0 text-muted-foreground">{e.stage}</span><span className={cn("min-w-0 flex-1",levelTone[e.level])}>{e.message}</span></div>)}
              </div>
            </Panel>
            {run.testsPassed ? <><Panel title="Verified outcome"><p className="text-sm text-success">Real build passed. ForgeOS recorded the result as non-simulated.</p><div className="mt-3"><Button size="sm" onClick={()=>void release()} disabled={building || run.status==="deploying"}>{building ? "Releasing…" : "Release to production"}</Button></div></Panel></> : null}
          </>
        ) : null}
      </div>
    </PageBody>
  );
}
