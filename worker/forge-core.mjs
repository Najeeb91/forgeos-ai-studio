
import { randomUUID } from "node:crypto";

import { createAIProviders } from "./providers/ai-provider.mjs";
import { selectProvider } from "./providers/registry.mjs";
import { transitionRun } from "./run-state.mjs";

const aiProviders = createAIProviders();
const preferredAIProvider = process.env.FORGEOS_AI_PROVIDER || "openai-compatible";

export function capabilities() {
  const configured = Boolean(process.env.FORGEOS_AI_API_KEY);
  return {
    ai: { configured, provider: preferredAIProvider, model: process.env.FORGEOS_AI_MODEL || "gpt-5.6", fallback: "local-template" },
    realExecution: true,
    repair: { available: configured, bounded: true },
    persistence: { canonicalSchema: true, migrations: true },
    approvals: { durable: true, highRiskGate: true },
    memory: { projectMemory: true, conversation: true, brainProjection: true },
    providers: { routing: true, attemptsPersisted: true, automaticFailover: true, database: process.env.FORGEOS_DATABASE_PROVIDER || "postgres", source: process.env.FORGEOS_SOURCE_PROVIDER || "github", secrets: "environment" },
  };
}

function validateArtifacts(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length < 5) throw new Error("invalid_generated_artifacts");
  const paths = new Set(artifacts.map((a)=>a.path));
  for (const required of ["index.html","src/main.jsx","package.json","vite.config.js"]) if (!paths.has(required)) throw new Error("missing_"+required);
  for (const file of artifacts) {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string") throw new Error("invalid_generated_file");
    if (file.path.startsWith("/") || file.path.includes("..") || file.path.includes("\\")) throw new Error("unsafe_path");
  }
  const pkg = JSON.parse(artifacts.find((a)=>a.path==="package.json").content);
  if (pkg?.scripts?.preinstall || pkg?.scripts?.postinstall || pkg?.scripts?.prepare) throw new Error("lifecycle_scripts_not_allowed");
  if (String(pkg?.scripts?.build || "").trim() !== "vite build") throw new Error("unsupported_build_profile");
  return artifacts;
}

async function aiGenerate(prompt) {
  const ordered=[];
  const preferred=aiProviders.find((p)=>p.id===preferredAIProvider);
  if(preferred) ordered.push(preferred);
  for(const provider of aiProviders) if(!ordered.includes(provider)) ordered.push(provider);
  const attempts=[];
  for(const provider of ordered){
    let health;
    try{health=await provider.health();}catch(error){health={ok:false,error:error instanceof Error?error.message:String(error)};}
    if(!health?.ok){attempts.push({provider:provider.id,status:"unavailable",error:health?.error||"provider_unhealthy"});continue;}
    try{
      const generated=await provider.generate(prompt);
      return {...generated,artifacts:validateArtifacts(generated.artifacts),
        providerSelection:{selected:provider.id,preferred:preferredAIProvider,failover:provider.id!==preferredAIProvider},
        providerAttempts:[...attempts,{provider:provider.id,status:"succeeded"}]};
    }catch(error){
      attempts.push({provider:provider.id,status:"failed",error:error instanceof Error?error.message:String(error)});
    }
  }
  throw new Error("all_ai_providers_failed:"+attempts.map((a)=>a.provider+":"+a.error).join(","));
}

export async function listProjects(pool) {
  if (!pool) throw new Error("worker_database_not_configured");
  const rows = (await pool.query("select slug from projects order by updated_at desc, created_at desc")).rows;
  return (await Promise.all(rows.map((row) => readProject(pool, row.slug)))).filter(Boolean);
}

export async function readProject(pool, slug) {
  if (!pool) throw new Error("worker_database_not_configured");
  const projectResult = await pool.query("select * from projects where slug=$1 limit 1", [slug]);
  const p = projectResult.rows[0];
  if (!p) return null;
  await seedRecoveredContext(pool, p.id);
  const contextEntries = (await pool.query(
    "select id,kind,title,content,source,occurred_at from project_context_entries where project_id=$1 order by occurred_at desc",
    [p.id]
  )).rows;
  const memory = (await pool.query(
    "select id,kind,title,content,author_type,author_id,source,occurred_at,supersedes_id from project_memory_entries where project_id=$1 and status='active' order by occurred_at desc limit 200",
    [p.id]
  )).rows;
  const conversation = (await pool.query(
    "select id,title from conversations where project_id=$1 order by updated_at desc limit 1",
    [p.id]
  )).rows[0];
  const messages = conversation ? (await pool.query(
    "select id,role,content,created_at from conversation_messages where conversation_id=$1 order by created_at",
    [conversation.id]
  )).rows : [];
  const approvals = (await pool.query(
    "select id,run_id,step_id,action_type,target,reason,risk,status,actor_id,decision_reason,created_at,decided_at from approval_requests where project_id=$1 order by created_at desc limit 100",
    [p.id]
  )).rows;
  const providerAttempts = (await pool.query(
    "select id,run_id,kind,provider,capability,status,priority,job_id,simulated,error,started_at,completed_at from provider_attempts where project_id=$1 order by started_at desc limit 100",
    [p.id]
  )).rows;
  const deploymentHistory = (await pool.query(
    "select id,env,status,commit_sha,url,adapter,created_at from deployments where project_id=$1 order by created_at desc limit 100",
    [p.id]
  )).rows;
  const brainRow = (await pool.query(
    "select vision,requirements,decisions,architecture,schema,integrations,version from project_brain_versions where project_id=$1 order by version desc limit 1",
    [p.id]
  )).rows[0];
  const runs = (await pool.query(
    "select id,prompt,provider,model,status,started_at,completed_at,tokens_in,tokens_out from ai_runs where project_id=$1 order by started_at desc limit 20",
    [p.id]
  )).rows;
  const runIds = runs.map((r) => r.id);
  const steps = runIds.length ? (await pool.query(
    "select id,run_id,title,detail,stage,risk,status,order_idx from ai_run_steps where run_id=any($1::uuid[]) order by order_idx",
    [runIds]
  )).rows : [];
  const events = runIds.length ? (await pool.query(
    "select id,run_id,level,stage,message,created_at from ai_events where run_id=any($1::uuid[]) order by created_at",
    [runIds]
  )).rows : [];
  const audit = (await pool.query(
    "select id,actor,actor_name,action,target,risk,approved,diff_summary,stage,created_at from audit_events where project_id=$1 order by created_at desc limit 200",
    [p.id]
  )).rows;
  const latest = (await pool.query(
    "select ss.id as snapshot_id,ss.created_at,sf.path,sf.language,sf.content from source_snapshots ss left join source_files sf on sf.snapshot_id=ss.id where ss.project_id=$1 order by ss.created_at desc,sf.path",
    [p.id]
  )).rows;
  const latestSnapshotId = latest[0]?.snapshot_id;
  const files = latest.filter((r) => r.snapshot_id === latestSnapshotId && r.path).map((r) => ({
    path: r.path, language: r.language || "text", content: r.content || ""
  }));
  return {
    project: {
      id: p.id, slug: p.slug, name: p.name, tagline: p.tagline, description: p.description,
      status: p.status, health: p.health, owner: p.owner, stack: p.stack || [],
      benchmark: Boolean(p.benchmark), createdAt: p.created_at, updatedAt: p.updated_at,
      contextHistory: contextEntries.map((e) => ({
        id: e.id, kind: e.kind, title: e.title, content: e.content,
        source: e.source, occurredAt: e.occurred_at
      })),
      memory: memory.map((e) => ({
        id:e.id, kind:e.kind, title:e.title, content:e.content,
        authorType:e.author_type, authorId:e.author_id, source:e.source,
        occurredAt:e.occurred_at, supersedesId:e.supersedes_id
      })),
      approvals: approvals.map((a) => ({
        id:a.id, runId:a.run_id, stepId:a.step_id, actionType:a.action_type,
        target:a.target, reason:a.reason, risk:a.risk, status:a.status,
        actorId:a.actor_id, decisionReason:a.decision_reason,
        createdAt:a.created_at, decidedAt:a.decided_at
      })),
      providerAttempts: providerAttempts.map((a) => ({
        id:a.id, runId:a.run_id, kind:a.kind, provider:a.provider,
        capability:a.capability, status:a.status, priority:a.priority,
        jobId:a.job_id, simulated:a.simulated, error:a.error,
        startedAt:a.started_at, completedAt:a.completed_at
      })),
      conversation: conversation ? {
        id:conversation.id, title:conversation.title,
        messages:messages.map((m) => ({id:m.id,role:m.role,content:m.content,createdAt:m.created_at}))
      } : undefined,
      deployments: deploymentHistory.map((d) => ({
        id:d.id, env:d.env, status:d.status, commit:d.commit_sha || "",
        url:d.url, at:d.created_at, adapter:d.adapter
      })),
      deploymentHistory: deploymentHistory.map((d) => ({
        id:d.id, env:d.env, status:d.status, commit:d.commit_sha || "",
        url:d.url, at:d.created_at, adapter:d.adapter
      })),
      brain: brainRow ? {
        vision: brainRow.vision,
        requirements: brainRow.requirements || [],
        decisions: brainRow.decisions || [],
        architecture: brainRow.architecture || [],
        schema: brainRow.schema || [],
        integrations: brainRow.integrations || [],
        tests: [],
        history: []
      } : undefined,
      runs: runs.map((run) => ({
        id: run.id, prompt: run.prompt, provider: run.provider, model: run.model,
        status: run.status, startedAt: run.started_at, completedAt: run.completed_at,
        tokensIn: run.tokens_in || 0, tokensOut: run.tokens_out || 0,
        plan: steps.filter((s) => s.run_id === run.id),
        events: events.filter((e) => e.run_id === run.id).map((e) => ({
          id: e.id, at: e.created_at, level: e.level, stage: e.stage, message: e.message
        }))
      })),
      auditHistory: audit.map((e) => ({
        id: e.id, at: e.created_at, actor: e.actor === "user" ? "human" : e.actor,
        actorName: e.actor_name, action: e.action, target: e.target,
        risk: e.risk, approved: e.approved, diffSummary: e.diff_summary, stage: e.stage
      })),
      generatedFiles: files,
      lastGeneratedAt: latestSnapshotId ? latest[0]?.created_at : null
    }
  };
}

async function seedRecoveredContext(pool, projectId) {
  const requirement=(await pool.query("SELECT content FROM project_context_entries WHERE project_id=$1 AND kind='requirement' ORDER BY occurred_at LIMIT 1",[projectId])).rows[0]?.content;
  if(requirement) return;
  const p=(await pool.query("SELECT description FROM projects WHERE id=$1",[projectId])).rows[0];
  if(!p) return;
  const req=p.description||"ForgeOS project";
  await pool.query("INSERT INTO project_context_entries(id,project_id,kind,title,content,source,occurred_at) VALUES($1,$2,'requirement',$3,$4,'user',now())", [randomUUID(), projectId, "Initial project requirement", req]);
  await pool.query("INSERT INTO project_brain_versions(id,project_id,version,vision,requirements,decisions,architecture,\"schema\",integrations) VALUES($1,$2,1,$3,$4::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb) ON CONFLICT DO NOTHING", [randomUUID(), projectId, req.slice(0, 500), JSON.stringify([{id: randomUUID(), title: "Initial requirement", detail: req, kind: "functional", priority: "must", status: "draft"}])]);
}

async function recordPlan(pool,runId) {
  const existing=await pool.query("SELECT count(*)::int AS count FROM ai_run_steps WHERE run_id=$1",[runId]);
  if(Number(existing.rows[0]?.count||0)>0) return;
  const steps=[
    ["Understand requirement","Read the requirement and current project context.","brain","low","done"],
    ["Draft implementation plan","Translate the requirement into a bounded source change.","plan","low","done"],
    ["Generate source","Produce a coherent runnable source tree.","build","medium","pending"],
    ["Real build verification","Install dependencies under policy and run the allowed build command.","test","high","awaiting_approval"],
    ["Review result","Record artifacts, tests, and audit evidence.","review","low","pending"]
  ];
  for(let i=0;i<steps.length;i++){const s=steps[i];await pool.query("INSERT INTO ai_run_steps(id,run_id,title,detail,stage,risk,status,order_idx) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[randomUUID(),runId,...s,i]);}
}

async function recordBuild(pool,{runId,projectSlug,prompt,artifacts,result,generation}) {
  if(!pool) return null;
  const projectId=await ensureProject(pool,projectSlug||"forgeos",prompt);
  let conversationId=(await pool.query("SELECT id FROM conversations WHERE project_id=$1 ORDER BY updated_at DESC LIMIT 1",[projectId])).rows[0]?.id;
  if(!conversationId){
    conversationId=randomUUID();
    await pool.query("INSERT INTO conversations(id,project_id,title) VALUES($1,$2,$3)",[conversationId,projectId,"ForgeOS Project Conversation"]);
  }
  await pool.query("INSERT INTO conversation_messages(id,conversation_id,role,content,run_id) VALUES($1,$2,'user',$3,$4)",[randomUUID(),conversationId,prompt,runId]);
  await pool.query("INSERT INTO project_memory_entries(id,project_id,kind,title,content,author_type,source,provenance_run_id) VALUES($1,$2,'requirement',$3,$4,'user','builder',$5)",[randomUUID(),projectId,"Builder requirement",prompt,runId]);
  const previousBrain=(await pool.query("SELECT version,vision,requirements,decisions,architecture,\"schema\",integrations FROM project_brain_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1",[projectId])).rows[0];
  const brainVersion=Number(previousBrain?.version||0)+1;
  const brainVersionId=randomUUID();
  const requirements=Array.isArray(previousBrain?.requirements)?[...previousBrain.requirements,{id:randomUUID(),title:"Builder requirement",detail:prompt,kind:"functional",priority:"must",status:"draft"}]:[{id:randomUUID(),title:"Builder requirement",detail:prompt,kind:"functional",priority:"must",status:"draft"}];
  await pool.query("INSERT INTO project_brain_versions(id,project_id,version,vision,requirements,decisions,architecture,\"schema\",integrations) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb)",[brainVersionId,projectId,brainVersion,previousBrain?.vision||"Build complete real software from natural language.",JSON.stringify(requirements),JSON.stringify(previousBrain?.decisions||[]),JSON.stringify(previousBrain?.architecture||[{layer:"frontend",choice:"React + TypeScript",note:"canonical ForgeOS studio"},{layer:"execution",choice:"provider adapters",note:"replaceable execution infrastructure"}]),JSON.stringify(previousBrain?.schema||[]),JSON.stringify(previousBrain?.integrations||[])]);
  await pool.query("INSERT INTO project_memory_entries(id,project_id,kind,title,content,author_type,source,provenance_run_id,provenance_brain_version_id) VALUES($1,$2,'milestone',$3,$4,'system','brain-projection',$5,$6)",[randomUUID(),projectId,"Project Brain version "+brainVersion,"Brain projection updated from the latest Builder requirement.",runId,brainVersionId]);
  for(const attempt of (generation.providerAttempts||[])) await pool.query("INSERT INTO provider_attempts(id,project_id,run_id,kind,provider,capability,status,simulated,error,completed_at) VALUES($1,$2,$3,'generation',$4,'ai',$5,false,$6,now())",[randomUUID(),projectId,runId,attempt.provider,attempt.status==="succeeded"?"succeeded":"failed",attempt.error||null]);
  const providerAttemptId=randomUUID();
  const executionProvider=result.provider || result.providerSelection?.selected || generation.provider || "http-executor";
  await pool.query("INSERT INTO provider_attempts(id,project_id,run_id,kind,provider,capability,status,simulated) VALUES($1,$2,$3,'execution',$4,'source-build','running',false)",[providerAttemptId,projectId,runId,executionProvider]);
  await recordPlan(pool,runId);
  await pool.query("INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,'info','brain',$3)",[randomUUID(),runId,"Requirement accepted by ForgeOS."]);
  await pool.query("INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,'info','build',$3)",[randomUUID(),runId,"Source generated using "+generation.mode+"."]);
  const snapshotId=randomUUID();
  await pool.query("INSERT INTO source_snapshots(id,project_id,run_id,message) VALUES($1,$2,$3,$4)",[snapshotId,projectId,runId,"Generated source ("+generation.mode+") for run "+runId]);
  for(const file of artifacts) await pool.query("INSERT INTO source_files(id,snapshot_id,path,kind,language,loc,status,content) VALUES($1,$2,$3,'file',$4,$5,'generated',$6)",[randomUUID(),snapshotId,file.path,file.language||"text",String(file.content||"").split("\n").length,file.content]);
  const passed=result.state==="passed"&&result.simulated===false;
  const testRunId=randomUUID();
  await pool.query("INSERT INTO test_runs(id,project_id,run_id,snapshot_id,status) VALUES($1,$2,$3,$4,$5)",[testRunId,projectId,runId,snapshotId,passed?"passed":"failed"]);
  await pool.query("INSERT INTO test_results(id,test_run_id,name,suite,status,duration_ms,detail) VALUES($1,$2,'real build','execution',$3,$4,$5)",[randomUUID(),testRunId,passed?"passed":"failed",Number(result?.build?.durationMs||result?.install?.durationMs||0),JSON.stringify(result)]);
  await pool.query("INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,$3,'test',$4)",[randomUUID(),runId,passed?"info":"error",passed?"Real build verification passed.":"Real build verification failed during "+result.phase+"."]);
  await pool.query("INSERT INTO audit_events(id,project_id,actor,actor_name,action,target,risk,approved,diff_summary,stage) VALUES($1,$2,'system','ForgeOS',$3,$4,'low',NULL,$5,'test')",[randomUUID(),projectId,passed?"real_build_passed":"real_build_failed",runId,result.error||result.phase]);
  await transitionRun(pool,runId,passed?"review":"repairing",{eventStage:"test",message:passed?"Real build verification passed; run is ready for review.":"Real build verification failed; run entered bounded repair."});
  await pool.query("UPDATE provider_attempts SET status=$1,completed_at=now(),job_id=$2,error=$3,observations=$4::jsonb WHERE id=$5",[passed?"succeeded":"failed",result.jobId||null,result.error||result.build?.error||result.install?.error||null,JSON.stringify({phase:result.phase||null,state:result.state||null,generationMode:generation.mode,provider:generation.provider,model:generation.model,providerAttempts:result.providerAttempts||[]}),providerAttemptId]);
  for(const attempt of (result.providerAttempts||[])) if(attempt.provider!==executionProvider) await pool.query("INSERT INTO provider_attempts(id,project_id,run_id,kind,provider,capability,status,simulated,error,completed_at) VALUES($1,$2,$3,'execution',$4,'source-build',$5,false,$6,now())",[randomUUID(),projectId,runId,attempt.provider,attempt.status==="succeeded"?"succeeded":"failed",attempt.error||null]);
  await pool.query("UPDATE conversations SET updated_at=now() WHERE id=$1",[conversationId]);
  return {projectId,snapshotId};
}

async function advanceRunSteps(pool,runId,{activeStage,status="running",completedStages=[]}={}) {
  if(!pool)return;
  if(completedStages.length) await pool.query("UPDATE ai_run_steps SET status='done' WHERE run_id=$1 AND stage=ANY($2::text[])",[runId,completedStages]);
  if(activeStage) await pool.query("UPDATE ai_run_steps SET status=$1 WHERE run_id=$2 AND stage=$3 AND status NOT IN ('done','rejected')",[status,runId,activeStage]);
}

export async function buildAndPersist(pool,{runId,projectSlug,prompt,execute}) {
  await transitionRun(pool,runId,"building",{eventStage:"build",message:"Run entered real source build execution."});
  await advanceRunSteps(pool,runId,{activeStage:"build",status:"running",completedStages:["brain","plan"]});
  const generation=await aiGenerate(prompt);
  const result=await execute(runId,generation.artifacts);
  await advanceRunSteps(pool,runId,{activeStage:"test",status:result.state==="passed"?"done":"failed",completedStages:["build"]});
  const persistence=await recordBuild(pool,{runId,projectSlug,prompt,artifacts:generation.artifacts,result,generation});
  await advanceRunSteps(pool,runId,{activeStage:"review",status:result.state==="passed"?"awaiting_review":"failed",completedStages:result.state==="passed"?["test"]:[]});
  return {...result,generationMode:generation.mode,provider:generation.provider,model:generation.model,sourceFiles:generation.artifacts,projectId:persistence?.projectId||null,snapshotId:persistence?.snapshotId||null};
}

async function persistRepair(pool,{runId,prompt,files,failure,result,generation,projectSlug="forgeos"}) {
  if (!pool) return null;
  const project = await pool.query("select id from projects where slug=$1 limit 1",[projectSlug]);
  if (!project.rows[0]) return null;
  const projectId=project.rows[0].id;
  const snapshotId=randomUUID();
  await pool.query("insert into source_snapshots(id,project_id,run_id,message) values($1,$2,$3,$4)",[snapshotId,projectId,runId,"AI repair source for run "+runId]);
  for(const file of generation.artifacts) await pool.query("insert into source_files(id,snapshot_id,path,kind,language,loc,status,content) values($1,$2,$3,'file',$4,$5,'generated',$6)",[randomUUID(),snapshotId,file.path,file.language||"text",String(file.content||"").split("\n").length,file.content]);
  const passed=result.state==="passed"&&result.simulated===false;
  const testRunId=randomUUID();
  await pool.query("insert into test_runs(id,project_id,run_id,snapshot_id,status) values($1,$2,$3,$4,$5)",[testRunId,projectId,runId,snapshotId,passed?"passed":"failed"]);
  await pool.query("insert into test_results(id,test_run_id,name,suite,status,duration_ms,detail) values($1,$2,'AI repair build','repair',$3,$4,$5)",[randomUUID(),testRunId,passed?"passed":"failed",Number(result?.build?.durationMs||result?.install?.durationMs||0),JSON.stringify({failure,phase:result.phase,state:result.state})]);
  await pool.query("insert into ai_events(id,run_id,level,stage,message) values($1,$2,$3,'repair',$4)",[randomUUID(),runId,passed?"info":"error",passed?"AI repair produced a build-verified source snapshot.":"AI repair attempt failed during real execution."]);
  await pool.query("insert into audit_events(id,project_id,actor,actor_name,action,target,risk,approved,diff_summary,stage) values($1,$2,'system','ForgeOS',$3,$4,'medium',NULL,$5,'repair')",[randomUUID(),projectId,passed?"repair_passed":"repair_failed",runId,String(failure).slice(0,2000)]);
  await transitionRun(pool,runId,passed?"review":"repairing",{eventStage:"repair",message:passed?"Repair build verified; run is ready for review.":"Repair attempt failed; run remains in bounded repair."});
  return {projectId,snapshotId,testRunId};
}

export async function autoRepairAndBuild({pool=null,runId,projectSlug="forgeos",prompt,files,failure,execute,maxAttempts=2,signal=null}) {
  let currentFiles=Array.isArray(files)?files:[];
  let currentFailure=String(failure||"real build failed");
  const attempts=Math.max(0,Math.min(2,Number(maxAttempts)||2));
  const history=[];
  for(let attempt=1;attempt<=attempts;attempt++){
    if(signal?.aborted) return {state:"cancelled",simulated:false,repairAttempts:history};
    if(pool){
      const state=(await pool.query("SELECT status FROM ai_runs WHERE id=$1",[runId])).rows[0]?.status;
      if(state==="cancelled") return {state:"cancelled",simulated:false,repairAttempts:history};
      await pool.query("INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,'info','repair',$3)",[randomUUID(),runId,"Automatic repair attempt "+attempt+" of "+attempts+" started."]);
    }
    try{
      const result=await repairAndBuild({pool,runId,projectSlug,prompt,files:currentFiles,failure:currentFailure,execute,signal});
      history.push({attempt,state:result.state,provider:result.provider||null,error:result.state==="passed"?null:(result.error||"repair_failed")});
      if(result.state==="passed") return {...result,repairAttempts:history};
      currentFiles=result.sourceFiles?.length?result.sourceFiles:currentFiles;
      currentFailure=String(result.error||"repair build failed");
    }catch(error){
      currentFailure=error instanceof Error?error.message:String(error);
      history.push({attempt,state:"failed",provider:null,error:currentFailure});
      if(pool) await pool.query("INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,'warn','repair',$3)",[randomUUID(),runId,"Automatic repair attempt "+attempt+" failed: "+currentFailure.slice(0,1500)]);
    }
  }
  if(pool && !signal?.aborted){
    await transitionRun(pool,runId,"failed",{eventStage:"repair",message:"Automatic repair attempts exhausted.",level:"error"}).catch(()=>{});
    await pool.query("INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,'error','repair',$3)",[randomUUID(),runId,"Automatic repair exhausted after "+attempts+" bounded attempt(s)."]);
  }
  return {state:signal?.aborted?"cancelled":"failed",simulated:false,repairAttempts:history,error:signal?.aborted?"run_cancelled":currentFailure};
}

export async function repairAndBuild({pool=null,runId,projectSlug="forgeos",prompt,files,failure,execute,signal=null}) {
  if(signal?.aborted) return {state:"cancelled",simulated:false};
  const selected = await selectProvider(aiProviders, preferredAIProvider);
  let generated=null;
  let selectedProvider=null;
  const repairProjectId = pool ? (await pool.query("SELECT project_id FROM ai_runs WHERE id=$1 LIMIT 1",[runId])).rows[0]?.project_id : null;
  const providerAttempts=[];
  for (const candidate of selected.candidates || [{provider:selected.provider,health:selected.health}]) {
    if(signal?.aborted) return {state:"cancelled",simulated:false,providerAttempts};
    const provider=candidate.provider;
    if (typeof provider.repair !== "function") {
      providerAttempts.push({provider:provider.id,status:"skipped",error:"provider_cannot_repair"});
      continue;
    }
    const attemptId=randomUUID();
    if(pool) await pool.query("INSERT INTO provider_attempts(id,project_id,run_id,kind,provider,capability,status,priority,simulated) VALUES($1,$2,$3,'repair',$4,'ai','running',$5,false)",[attemptId,repairProjectId,runId,provider.id,candidate.health?.priority||0]).catch(()=>{});
    try {
      generated=await provider.repair({prompt,files,failure});
      if(signal?.aborted) return {state:"cancelled",simulated:false,providerAttempts};
      selectedProvider=provider;
      providerAttempts.push({provider:provider.id,status:"succeeded"});
      if(pool) await pool.query("UPDATE provider_attempts SET status='succeeded',completed_at=now(),observations=$1::jsonb WHERE id=$2",[JSON.stringify({model:generated.model,mode:generated.mode}),attemptId]).catch(()=>{});
      break;
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      providerAttempts.push({provider:provider.id,status:"failed",error:message});
      if(pool) await pool.query("UPDATE provider_attempts SET status='failed',completed_at=now(),error=$1 WHERE id=$2",[message,attemptId]).catch(()=>{});
    }
  }
  if(signal?.aborted) return {state:"cancelled",simulated:false,providerAttempts};
  if(!generated || !selectedProvider) throw new Error("all_ai_repair_providers_failed:"+providerAttempts.map((a)=>a.provider+":"+a.error).join(";"));
  const artifacts = validateArtifacts(generated.artifacts);
  const result = await execute(runId,artifacts,{signal});
  if(signal?.aborted) return {state:"cancelled",simulated:false,providerAttempts};
  const persistence=await persistRepair(pool,{runId,prompt,files,failure,result,generation:{...generated,artifacts},projectSlug});
  return {...result,repairSimulated:false,generationMode:"ai-repair",provider:generated.provider || selectedProvider.id,model:generated.model,sourceFiles:artifacts,projectId:persistence?.projectId||null,snapshotId:persistence?.snapshotId||null,testRunId:persistence?.testRunId||null,providerSelection:{selected:selectedProvider.id,preferred:preferredAIProvider,failover:selectedProvider.id!==preferredAIProvider},providerAttempts};
}

export async function latestSource(pool, projectSlug, runId=null) {
  if(!pool)return [];
  await ensureSchema(pool);
  const snap=runId
    ? await pool.query("SELECT ss.id FROM source_snapshots ss JOIN projects p ON p.id=ss.project_id WHERE p.slug=$1 AND ss.run_id=$2 ORDER BY ss.created_at DESC LIMIT 1",[projectSlug || "forgeos",runId])
    : await pool.query("SELECT ss.id FROM source_snapshots ss JOIN projects p ON p.id=ss.project_id WHERE p.slug=$1 ORDER BY ss.created_at DESC LIMIT 1",[projectSlug || "forgeos"]);
  if(!snap.rows[0])return [];
  const rows=await pool.query("SELECT path,content FROM source_files WHERE snapshot_id=$1 ORDER BY path",[snap.rows[0].id]);
  return rows.rows.map((r)=>({path:r.path,content:r.content}));
}
