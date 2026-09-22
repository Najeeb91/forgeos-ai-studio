import type { FileNode, Project, ProviderEntry } from "@/lib/forge/types";
import { sql } from "./index";

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
function buildTree(rows: any[]): FileNode[] {
  const root: FileNode[] = [];
  for (const row of rows) {
    const parts = String(row.path).split("/").filter(Boolean);
    let level = root; let current = "";
    parts.forEach((part, i) => {
      current = current ? current + "/" + part : part;
      const existing = level.find((n) => n.path === current);
      if (existing) { if (existing.kind === "dir") level = existing.children ?? (existing.children = []); return; }
      const isFile = i === parts.length - 1 && row.kind === "file";
      const node: FileNode = isFile
        ? { path: current, kind: "file", language: row.language ?? undefined, loc: row.loc ?? undefined, status: row.status === "generated" ? "new" : row.status ?? undefined, content: row.content ?? undefined }
        : { path: current, kind: "dir", children: [] };
      level.push(node); if (!isFile) level = node.children!;
    });
  }
  return root;
}

export async function getRemoteProject(slug: string): Promise<Project | null> {
  if (!sql) return null;
  const [p] = await sql`select * from projects where slug=${slug} limit 1`;
  if (!p) return null;
  const [stages, brains, runs, deployments, snapshots, audit] = await Promise.all([
    sql`select * from pipeline_stages where project_id=${p.id} order by stage_id`,
    sql`select * from project_brain_versions where project_id=${p.id} order by version desc limit 1`,
    sql`select * from ai_runs where project_id=${p.id} order by started_at desc`,
    sql`select * from deployments where project_id=${p.id} order by created_at desc`,
    sql`select * from source_snapshots where project_id=${p.id} order by created_at desc limit 1`,
    sql`select * from audit_events where project_id=${p.id} order by created_at desc`,
  ]);
  const runIds = runs.map((r:any)=>r.id);
  const steps = runIds.length ? await sql`select * from ai_run_steps where run_id = any(${sql.array(runIds,"uuid")}) order by order_idx` : [];
  const events = runIds.length ? await sql`select * from ai_events where run_id = any(${sql.array(runIds,"uuid")}) order by created_at` : [];
  const stepIds = steps.map((s:any)=>s.id);
  const approvals = stepIds.length ? await sql`select * from approvals where step_id = any(${sql.array(stepIds,"uuid")}) order by created_at` : [];
  const snapshot = snapshots[0];
  const files = snapshot ? await sql`select * from source_files where snapshot_id=${snapshot.id} order by path` : [];
  const testRun = snapshot ? (await sql`select * from test_runs where snapshot_id=${snapshot.id} order by created_at desc limit 1`)[0] : null;
  const testRows = testRun ? await sql`select * from test_results where test_run_id=${testRun.id} order by name` : [];

  const mappedRuns = runs.map((r:any)=>({
    id:r.id,prompt:r.prompt,provider:r.provider,model:r.model,startedAt:iso(r.started_at),
    status:(r.status==="testing"||r.status==="review"?"completed":r.status==="repairing"?"failed":r.status) as "running"|"awaiting_approval"|"completed"|"failed",
    tokensIn:r.tokens_in??0,tokensOut:r.tokens_out??0,
    plan:steps.filter((s:any)=>s.run_id===r.id).map((s:any)=>({id:s.id,title:s.title,detail:s.detail,stage:s.stage,risk:s.risk,status:s.status,decision:approvals.find((a:any)=>a.step_id===s.id)?.decision})),
    events:events.filter((e:any)=>e.run_id===r.id).map((e:any)=>({id:e.id,at:iso(e.created_at),level:e.level,stage:e.stage,message:e.message}))
  }));

  const tests = testRows.map((t:any)=>({
    id:t.id,name:t.name,suite:t.suite==="execution"?"integration":t.suite,
    status:(t.status==="passed"?"passing":t.status==="failed"?"failing":"skipped") as "passing"|"failing"|"skipped"|"flaky",
    durationMs:t.duration_ms??0,detail:t.detail
  }));
  const brain=brains[0];
  const brainValue={
    vision:brain?.vision??"",requirements:brain?.requirements??[],decisions:brain?.decisions??[],
    architecture:brain?.architecture??[],schema:brain?.schema??[],integrations:brain?.integrations??[],
    tests,history:audit.map((a:any)=>({id:a.id,at:iso(a.created_at),actor:a.actor,actorName:a.actor_name,action:a.action,target:a.target,risk:a.risk,approved:a.approved,diffSummary:a.diff_summary,stage:a.stage}))
  };
  return {
    id:p.id,slug:p.slug,name:p.name,tagline:p.tagline,description:p.description,status:p.status,health:p.health,
    createdAt:iso(p.created_at),updatedAt:iso(p.updated_at),owner:p.owner,stack:p.stack??[],benchmark:p.benchmark??false,
    stages:stages.map((s:any)=>({id:s.stage_id,label:s.label,status:s.status,summary:s.summary,progress:s.progress,updatedAt:iso(s.updated_at)})),
    brain:brainValue,files:buildTree(files),
    deployments:deployments.map((d:any)=>({id:d.id,env:d.env,status:d.status,commit:d.commit_sha??"",url:d.url,at:iso(d.created_at),adapter:d.adapter})),
    runs:mappedRuns,preview:{route:p.preview_route??"/preview",status:p.preview_status==="ready"?"ready":"cold",lastBuiltAt:p.preview_last_built_at?iso(p.preview_last_built_at):iso(p.updated_at)}
  } as Project;
}
export async function listRemoteProjects() {
  if (!sql) return null;
  const rows = await sql`select slug from projects order by created_at desc`;
  const projects: Project[] = [];
  for (const row of rows) { const project = await getRemoteProject(row.slug); if (project) projects.push(project); }
  return projects;
}
export async function listRemoteProviders(): Promise<ProviderEntry[] | null> { return null; }
