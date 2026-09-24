import http from "node:http";
import { createBuildProviders } from "./providers/build-provider.mjs";
import { createDeployProviders } from "./providers/deploy-provider.mjs";
import { selectProvider } from "./providers/registry.mjs";
import { randomUUID } from "node:crypto";
import { createDatabaseProvider } from "./providers/database-provider.mjs";
import { createSourceProvider } from "./providers/source-provider.mjs";
import { createSecretsProvider } from "./providers/secrets-provider.mjs";
import { createAuthProvider } from "./providers/auth-provider.mjs";
import { createStorageProvider } from "./providers/storage-provider.mjs";
import { buildAndPersist, repairAndBuild, autoRepairAndBuild, latestSource, capabilities, readProject, listProjects, createProject } from "./forge-core.mjs";
import { runMigrations } from "./migrate.mjs";
import { prepareBuild, approveBuild, assertApproved } from "./approval-core.mjs";
import { transitionRun } from "./run-state.mjs";

const PORT = Number(process.env.PORT || 8080);
const WORKER_TOKEN = process.env.FORGEOS_WORKER_TOKEN || "";

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_MS = 120000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

const databaseProvider = createDatabaseProvider();
const secretsProvider = createSecretsProvider();
const authProvider = createAuthProvider();
const sourceProvider = createSourceProvider(secretsProvider);
const storageProvider = createStorageProvider(databaseProvider);
const pool = databaseProvider;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

async function body(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_TOTAL_BYTES + 1024 * 1024) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function authorized(req) {
  const result = await authProvider.authenticate(req);
  return result.ok === true;
}

const buildProviders = createBuildProviders();
const deployProviders = createDeployProviders(secretsProvider);
const preferredBuildProvider = process.env.FORGEOS_BUILD_PROVIDER || "local-process";
const preferredDeployProvider = process.env.FORGEOS_DEPLOY_PROVIDER || "vercel";

async function execute(runId, files) {
  const ordered = [];
  const preferred = buildProviders.find((p) => p.id === preferredBuildProvider);
  if (preferred) ordered.push(preferred);
  for (const provider of buildProviders) if (!ordered.includes(provider)) ordered.push(provider);
  const checks = [];
  const attempts = [];
  for (const provider of ordered) {
    let health;
    try { health = await provider.health(); }
    catch (error) { health = {ok:false,provider:provider.id,error:error instanceof Error?error.message:String(error)}; }
    checks.push({provider,health});
    if (!health?.ok) { attempts.push({provider:provider.id,status:"unavailable",error:health?.error||"provider_unhealthy"}); continue; }
    try {
      const result = await provider.build(runId, files);
      return { ...result, providerSelection:{selected:provider.id,preferred:preferredBuildProvider,failover:provider.id!==preferredBuildProvider}, providerAttempts:[...attempts,{provider:provider.id,status:"succeeded"}] };
    } catch (error) {
      const message=error instanceof Error?error.message:String(error);
      attempts.push({provider:provider.id,status:"failed",error:message});
    }
  }
  throw new Error("all_build_providers_failed:"+attempts.map((a)=>a.provider+":"+a.error).join(","));
}

async function providerHealth() {
  const checks = [];
  for (const provider of [...buildProviders, ...deployProviders, databaseProvider, storageProvider, sourceProvider, secretsProvider, authProvider]) {
    try {
      checks.push(await provider.health());
    } catch (error) {
      checks.push({ ok:false, provider:provider.id, capability:provider.capability, error:error instanceof Error ? error.message : String(error) });
    }
  }
  return checks;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, {
        ok: true,
        service: "forgeos-execution-worker",
        realExecution: true,
        authenticatedExecution: Boolean(WORKER_TOKEN),
        databaseConfigured: Boolean(pool),
        databaseReady,
        databaseLastError: databaseReady ? null : databaseLastError,
        canonicalPersistence: true,
      });
    }

    if (req.method === "GET" && req.url === "/worker/capabilities") {
      if (!(await authorized(req))) return json(res, 401, { error: "worker_auth_required" });
      return json(res, 200, { ...capabilities(), runtimeProviders: await providerHealth() });
    }

    if (req.method === "POST" && req.url === "/worker/build") {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      const payload = await body(req);
      if (!payload.prompt || typeof payload.prompt !== "string") return json(res, 400, { error: "prompt_required" });
      const runId = payload.runId || randomUUID();
      const gate = await prepareBuild(pool, { runId, projectSlug: payload.projectSlug || "forgeos", prompt: payload.prompt });
      if (gate.state === "awaiting_approval" && payload.approved !== true) {
        return json(res, 200, { ...gate, simulated: false });
      }
      await assertApproved(pool, runId);
      const currentRun=(await pool.query("SELECT status FROM ai_runs WHERE id=$1",[runId])).rows[0];
      if(currentRun?.status==="cancelled") return json(res,409,{error:"run_cancelled",simulated:false});
      let result = await buildAndPersist(pool, {
        runId,
        projectSlug: payload.projectSlug || "forgeos",
        prompt: payload.prompt,
        execute,
      });
      if(result.state !== "passed" && process.env.FORGEOS_AI_API_KEY){
        result = await autoRepairAndBuild({
          pool,
          runId,
          projectSlug: payload.projectSlug || "forgeos",
          prompt: payload.prompt,
          files: result.sourceFiles || [],
          failure: result.error || result.stderr || result.message || "real build failed",
          execute,
          maxAttempts: 2,
        });
      }
      return json(res, result.state === "passed" ? 200 : 422, { ...result, approvalRequired: false });
    }

    if (req.method === "POST" && req.url === "/worker/deploy") {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      const payload = await body(req);
      const runId = payload.runId;
      const projectSlug = payload.projectSlug || "forgeos";
      const environment = payload.environment || "production";
      if (!runId) return json(res, 400, { error: "runId_required" });

      const run = (await pool.query("SELECT ar.id,ar.project_id,ar.status,(SELECT status FROM test_runs WHERE run_id=ar.id ORDER BY created_at DESC LIMIT 1) AS latest_test_status FROM ai_runs ar WHERE ar.id=$1 LIMIT 1",[runId])).rows[0];
      if (!run) return json(res, 404, { error: "run_not_found" });
      if (run.status !== "review") return json(res, 409, { error: "real_test_review_required" });
      if (run.latest_test_status !== "passed") return json(res, 409, { error: "real_tests_required" });
      const exactSnapshot=(await pool.query("SELECT id FROM source_snapshots WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1",[runId])).rows[0];
      const exactTest=(await pool.query("SELECT id FROM test_runs WHERE run_id=$1 AND status='passed' ORDER BY created_at DESC LIMIT 1",[runId])).rows[0];
      if(!exactSnapshot || !exactTest) return json(res,409,{error:"exact_run_evidence_required",snapshot:!!exactSnapshot,test:!!exactTest});
      
      if (environment === "production") {
        const approved = (await pool.query("SELECT id FROM approval_requests WHERE run_id=$1 AND action_type='deploy_production' AND status='approved' ORDER BY decided_at DESC LIMIT 1",[runId])).rows[0];
        if (!approved) {
          const pending = (await pool.query("SELECT id,target,reason,risk,status FROM approval_requests WHERE run_id=$1 AND action_type='deploy_production' AND status='pending' ORDER BY created_at DESC LIMIT 1",[runId])).rows[0];
          if (pending) return json(res, 200, { state:"awaiting_approval", simulated:false, approval:pending });
          const stepId=randomUUID();
          await pool.query("INSERT INTO ai_run_steps(id,run_id,title,detail,stage,risk,status,order_idx) VALUES($1,$2,'Production deployment approval','Release the verified source snapshot to the production deployment adapter.','deploying','critical','awaiting_approval',999)",[stepId,runId]);
          const id=randomUUID();
          await pool.query("INSERT INTO approval_requests(id,project_id,run_id,step_id,action_type,target,reason,risk,status) VALUES($1,$2,$3,$4,'deploy_production',$5,$6,'critical','pending')",[id,run.project_id,runId,stepId,environment,"Release the verified source snapshot to the production deployment adapter."]);
          await pool.query("INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,'approval','deploying','Production deployment is waiting for durable human approval.')",[randomUUID(),runId]);
          return json(res, 200, { state:"awaiting_approval", simulated:false, approval:{id,step_id:stepId,actionType:"deploy_production",target:environment,reason:"Release verified source to production.",risk:"critical",status:"pending"} });
        }
      }

      const existingDeployment=(await pool.query("SELECT id,status,url,adapter FROM deployments WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1",[runId])).rows[0];
      if (existingDeployment && !["failed","cancelled"].includes(existingDeployment.status)) {
        return json(res,200,{state:existingDeployment.status,simulated:false,deployment:{id:existingDeployment.id,provider:existingDeployment.adapter,url:existingDeployment.url||null,reused:true}});
      }

      const files=await latestSource(pool,projectSlug,runId);
      if (!files.length) return json(res, 409, { error:"source_required" });
      const selectedDeploy=await selectProvider(deployProviders, preferredDeployProvider);
      let deployment=null;
      let selectedProvider=null;
      const providerAttempts=[];
      for (const candidate of selectedDeploy.candidates || [{provider:selectedDeploy.provider,health:selectedDeploy.health}]) {
        const provider=candidate.provider;
        const secretName=provider.id === "netlify" ? "NETLIFY_AUTH_TOKEN" : "VERCEL_TOKEN";
        const deploySecret=await secretsProvider.get(secretName);
        const token=deploySecret?.value || "";
        const providerAttemptId=randomUUID();
        await pool.query("INSERT INTO provider_attempts(id,project_id,run_id,kind,provider,capability,status,priority,simulated) VALUES($1,$2,$3,'deploy',$4,'deploy','running',$5,false)",[providerAttemptId,run.project_id,runId,provider.id,candidate.health?.priority||0]).catch(()=>{});
        try {
          deployment=await provider.deploy({token,projectName:("forgeos-"+projectSlug+"-"+runId.slice(0,8)).toLowerCase(),files,environment});
          selectedProvider=provider;
          providerAttempts.push({provider:provider.id,status:"succeeded"});
          await pool.query("UPDATE provider_attempts SET status='succeeded',completed_at=now(),job_id=$1,observations=$2::jsonb WHERE id=$3",[deployment.deploymentId||null,JSON.stringify({state:deployment.state,url:deployment.url,provider:provider.id}),providerAttemptId]).catch(()=>{});
          break;
        } catch (error) {
          const message=error instanceof Error?error.message:String(error);
          providerAttempts.push({provider:provider.id,status:"failed",error:message});
          await pool.query("UPDATE provider_attempts SET status='failed',completed_at=now(),error=$1 WHERE id=$2",[message,providerAttemptId]).catch(()=>{});
        }
      }
      if (!deployment || !selectedProvider) {
        const message=providerAttempts.map((a)=>a.provider+":"+a.error).join(";") || "all_deploy_providers_failed";
        await transitionRun(pool,runId,"failed",{eventStage:"deploying",message:"All deployment providers failed: "+message,level:"error"});
        await pool.query("INSERT INTO audit_events(id,project_id,actor,actor_name,action,target,risk,approved,diff_summary,stage) VALUES($1,$2,'system','ForgeOS','deploy_failed',$3,'critical',true,$4,'deploying')",[randomUUID(),run.project_id,environment,message]).catch(()=>{});
        return json(res,502,{state:"failed",simulated:false,error:message,providerAttempts});
      }
      const deploymentId=randomUUID();
      const snapshot=(await pool.query("SELECT id FROM source_snapshots WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1",[runId])).rows[0]?.id || null;
      await pool.query("INSERT INTO deployments(id,project_id,run_id,env,status,commit_sha,url,adapter,simulated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,false)",[deploymentId,run.project_id,runId,environment,deployment.state||"building",snapshot||"",deployment.url||"",selectedDeploy.provider.id]);
      await pool.query("INSERT INTO deployment_observations(id,deployment_id,status,url,provider_job_id,simulated,detail) VALUES($1,$2,$3,$4,$5,false,$6::jsonb)",[randomUUID(),deploymentId,deployment.state||"building",deployment.url||"",deployment.deploymentId||null,JSON.stringify(deployment)]);
      await pool.query("INSERT INTO audit_events(id,project_id,actor,actor_name,action,target,risk,approved,diff_summary,stage) VALUES($1,$2,'system','ForgeOS','deploy',$3,'critical',$4,$5,'deploying')",[randomUUID(),run.project_id,environment,true,"Real deployment provider invoked: "+selectedProvider.id+". Attempts: "+JSON.stringify(providerAttempts)]);
      await transitionRun(pool,runId,"deploying",{eventStage:"deploying",message:"Deployment provider accepted the deployment request."});
      await pool.query("UPDATE ai_run_steps SET status='done' WHERE run_id=$1 AND stage='review' AND status NOT IN ('rejected')",[runId]);
      await pool.query("UPDATE ai_run_steps SET status='running' WHERE run_id=$1 AND stage='deploy' AND status NOT IN ('done','rejected')",[runId]);
      return json(res,200,{state:"deploying",simulated:false,deployment,provider:selectedProvider.id,providerAttempts});
    }

    if (req.method === "GET" && req.url?.startsWith("/worker/deploy/status")) {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      const url = new URL(req.url, "http://forgeos-worker");
      const deploymentId = url.searchParams.get("deploymentId");
      const runId = url.searchParams.get("runId");
      let row;
      if (deploymentId) {
        row = (await pool.query("SELECT d.id,d.project_id,d.run_id,d.status,d.url,d.adapter,d.created_at,do.provider_job_id FROM deployments d LEFT JOIN LATERAL (SELECT provider_job_id FROM deployment_observations WHERE deployment_id=d.id ORDER BY observed_at DESC LIMIT 1) do ON true WHERE d.id=$1 LIMIT 1",[deploymentId])).rows[0];
      } else if (runId) {
        row = (await pool.query("SELECT d.id,d.project_id,d.run_id,d.status,d.url,d.adapter,d.created_at,do.provider_job_id FROM ai_runs ar JOIN deployments d ON d.run_id=ar.id LEFT JOIN LATERAL (SELECT provider_job_id FROM deployment_observations WHERE deployment_id=d.id ORDER BY observed_at DESC LIMIT 1) do ON true WHERE ar.id=$1 ORDER BY d.created_at DESC LIMIT 1",[runId])).rows[0];
      } else {
        return json(res, 400, { error: "deploymentId_or_runId_required" });
      }
      if (!row) return json(res, 404, { error: "deployment_not_found" });
      const provider = deployProviders.find((item) => item.id === row.adapter);
      if (!provider || typeof provider.status !== "function") return json(res, 409, { error: "deployment_status_provider_unavailable", provider: row.adapter });
      const secretName = provider.id === "netlify" ? "NETLIFY_AUTH_TOKEN" : "VERCEL_TOKEN";
      const secret = await secretsProvider.get(secretName);
      let observed;
      try {
        observed = await provider.status({ token: secret?.value || "", deploymentId: row.provider_job_id });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await pool.query(
          "INSERT INTO deployment_observations(id,deployment_id,status,url,provider_job_id,simulated,detail) VALUES($1,$2,'observation_error',$3,$4,false,$5::jsonb)",
          [randomUUID(), row.id, row.url || "", row.provider_job_id || null, JSON.stringify({ provider: row.adapter, error: message })]
        );
        return json(res, 503, {
          error: "deployment_status_provider_failed",
          simulated: false,
          provider: row.adapter,
          deployment: { id: row.id, runId: row.run_id, status: row.status },
          detail: message,
        });
      }
      const statusMap = {
        READY: "ready",
        COMPLETED: "ready",
        BUILDING: "building",
        QUEUED: "queued",
        INITIALIZING: "building",
        DEPLOYING: "deploying",
        ERROR: "failed",
        CANCELED: "cancelled",
        CANCELLED: "cancelled",
        FAILED: "failed",
      };
      const normalized = statusMap[String(observed.state || "").toUpperCase()] || String(observed.state || row.status || "unknown").toLowerCase();
      await pool.query("UPDATE deployments SET status=$1,url=$2 WHERE id=$3",[normalized,observed.url||row.url||"",row.id]);
      await pool.query("INSERT INTO deployment_observations(id,deployment_id,status,url,provider_job_id,simulated,detail) VALUES($1,$2,$3,$4,$5,false,$6::jsonb)",[randomUUID(),row.id,normalized,observed.url||row.url||"",observed.deploymentId||row.provider_job_id||null,JSON.stringify(observed)]);
      if (normalized === "ready") {
        await transitionRun(pool,row.run_id,"deployed",{eventStage:"deploy",message:"Deployment provider reports the deployment is ready."});
        await pool.query("UPDATE ai_run_steps SET status='done' WHERE run_id=$1 AND stage='deploy'",[row.run_id]);
      } else if (normalized === "failed") {
        await transitionRun(pool,row.run_id,"failed",{eventStage:"deploy",message:"Deployment provider reports deployment failure.",level:"error"});
        await pool.query("UPDATE ai_run_steps SET status='failed' WHERE run_id=$1 AND stage='deploy' AND status NOT IN ('done','rejected')",[row.run_id]);
      }
      return json(res, 200, { state: normalized, simulated: false, deployment: { id: row.id, provider: row.adapter, providerStatus: observed.state, deploymentId: observed.deploymentId, url: observed.url||row.url||null, environment: observed.environment||null } });
    }

    if (req.method === "POST" && req.url === "/worker/source/push") {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      const payload = await body(req);
      const runId = payload.runId;
      const projectSlug = String(payload.projectSlug || "forgeos").toLowerCase();
      if (!runId) return json(res, 400, { error: "runId_required" });
      if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(projectSlug)) return json(res, 400, { error: "unsafe_project_slug" });
      const run = (await pool.query("SELECT id,project_id,status FROM ai_runs WHERE id=$1 LIMIT 1",[runId])).rows[0];
      if (!run) return json(res, 404, { error: "run_not_found" });
      if (run.status !== "review") return json(res, 409, { error: "source_push_requires_review" });
      const approved = (await pool.query("SELECT id FROM approval_requests WHERE run_id=$1 AND action_type='source_push' AND status='approved' ORDER BY decided_at DESC LIMIT 1",[runId])).rows[0];
      if (!approved) {
        const pending = (await pool.query("SELECT id,step_id,target,reason,risk,status FROM approval_requests WHERE run_id=$1 AND action_type='source_push' AND status='pending' ORDER BY created_at DESC LIMIT 1",[runId])).rows[0];
        if (pending) return json(res, 200, { state:"awaiting_approval", simulated:false, approval:pending });
        const stepId=randomUUID(), approvalId=randomUUID();
        await pool.query("INSERT INTO ai_run_steps(id,run_id,title,detail,stage,risk,status,order_idx) VALUES($1,$2,'GitHub source synchronization','Push the verified source snapshot to an isolated ForgeOS branch.','review','high','awaiting_approval',998)",[stepId,runId]);
        await pool.query("INSERT INTO approval_requests(id,project_id,run_id,step_id,action_type,target,reason,risk,status) VALUES($1,$2,$3,$4,'source_push',$5,$6,'high','pending')",[approvalId,run.project_id,runId,stepId,"github/"+projectSlug,"Synchronize the verified source snapshot to an isolated branch."]);
        return json(res,200,{state:"awaiting_approval",simulated:false,approval:{id:approvalId,step_id:stepId,actionType:"source_push",target:"github/"+projectSlug,reason:"Synchronize verified source.",risk:"high",status:"pending"}});
      }
      const files=await latestSource(pool,projectSlug);
      if (!files.length) return json(res,409,{error:"source_required"});
      const branch="forgeos/"+projectSlug+"/run-"+runId.replace(/-/g,"").slice(0,8);
      const pushed=await sourceProvider.pushFiles({files,branch,base:"main",message:"ForgeOS: generated source for run "+runId});
      await pool.query("UPDATE source_snapshots SET provider=$1,verified=true WHERE id=(SELECT id FROM source_snapshots WHERE run_id=$2 ORDER BY created_at DESC LIMIT 1)",[sourceProvider.id,run.project_id]);
      await pool.query("INSERT INTO audit_events(id,project_id,actor,actor_name,action,target,risk,approved,diff_summary,stage) VALUES($1,$2,'system','ForgeOS','source_push',$3,'high',true,$4,'review')",[randomUUID(),run.project_id,"github/"+branch,"Verified source synchronized to isolated GitHub branch."]);
      return json(res,200,{state:"synchronized",simulated:false,branch,pushed});
    }

    if (req.method === "POST" && req.url === "/worker/approve") {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      const payload = await body(req);
      if (!payload.runId || !payload.approvalId) return json(res, 400, { error: "runId_and_approvalId_required" });
      try {
        const result = await approveBuild(pool, {
          runId: payload.runId,
          approvalId: payload.approvalId,
          decision: payload.decision,
          actorId: payload.actorId || "user",
        });
        return json(res, 200, { ...result, simulated: false });
      } catch (error) {
        return json(res, 409, { error: error instanceof Error ? error.message : "approval_failed" });
      }
    }

    if (req.method === "POST" && req.url === "/worker/repair") {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      const payload = await body(req);
      const result = await repairAndBuild({
        pool,
        runId: payload.runId || randomUUID(),
        projectSlug: payload.projectSlug || "forgeos",
        prompt: payload.prompt || "",
        files: payload.files || [],
        failure: payload.failure || "real build failed",
        execute,
      });
      return json(res, result.state === "passed" ? 200 : 422, result);
    }

    if (req.method === "GET" && req.url?.startsWith("/worker/run/")) {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      const runId = decodeURIComponent(req.url.slice("/worker/run/".length));
      if (!runId) return json(res, 400, { error: "runId_required" });
      const run = (await pool.query("SELECT id,project_id,prompt,provider,model,status,started_at,created_at,updated_at,completed_at FROM ai_runs WHERE id=$1 LIMIT 1",[runId])).rows[0];
      if (!run) return json(res, 404, { error: "run_not_found" });
      const [steps,events,approvals,tests,deployments] = await Promise.all([
        pool.query("SELECT id,title,detail,stage,risk,status,order_idx FROM ai_run_steps WHERE run_id=$1 ORDER BY order_idx,id",[runId]),
        pool.query("SELECT id,level,stage,message,created_at FROM ai_events WHERE run_id=$1 ORDER BY created_at,id",[runId]),
        pool.query("SELECT id,step_id,action_type,target,reason,risk,status,created_at,decided_at FROM approval_requests WHERE run_id=$1 ORDER BY created_at,id",[runId]),
        pool.query("SELECT id,status,provider,created_at,completed_at,error FROM test_runs WHERE run_id=$1 ORDER BY created_at,id",[runId]),
        pool.query("SELECT id,env,status,url,adapter,created_at FROM deployments WHERE run_id=$1 ORDER BY created_at,id",[runId])
      ]);
      return json(res,200,{run,steps:steps.rows,events:events.rows,approvals:approvals.rows,tests:tests.rows,deployments:deployments.rows,simulated:false});
    }

    if (req.method === "GET" && req.url === "/worker/projects") {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      return json(res, 200, { projects: await listProjects(pool), simulated: false });
    }

    if (req.method === "POST" && req.url === "/worker/project") {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      const payload = await body(req);
      if (!payload.slug || !payload.name || !payload.prompt) return json(res, 400, { error: "slug_name_prompt_required" });
      const project = await createProject(pool, { slug: payload.slug, name: payload.name, prompt: payload.prompt });
      return json(res, 201, { project: project?.project || null, simulated: false });
    }

    if (req.method === "GET" && req.url?.startsWith("/worker/project/")) {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      const slug = decodeURIComponent(req.url.slice("/worker/project/".length));
      const project = await readProject(pool, slug);
      return json(res, 200, { project });
    }

    if (req.method === "GET" && req.url === "/worker/source/latest") {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      if (!pool) return json(res, 503, { error: "worker_database_not_configured" });
      return json(res, 200, { files: await latestSource(pool, req.headers["x-forgeos-project-slug"] || "forgeos") });
    }

    if (req.method === "POST" && req.url === "/worker/jobs") {
      if (!authorized(req)) {
        return json(res, 401, { error: "worker_auth_required" });
      }

      const payload = await body(req);
      const result = await execute(payload.runId || null, payload.files || []);

      return json(res, result.state === "passed" ? 200 : 422, result);
    }

    if (req.method === "POST" && req.url === "/worker/run/recover") {
      if (!authorized(req)) return json(res,401,{error:"worker_auth_required"});
      if (!pool) return json(res,503,{error:"worker_database_not_configured"});
      const payload=await body(req);
      if(!payload.runId)return json(res,400,{error:"runId_required"});
      const run=(await pool.query("SELECT id,status FROM ai_runs WHERE id=$1 LIMIT 1",[payload.runId])).rows[0];
      if(!run)return json(res,404,{error:"run_not_found"});
      if(run.status!=="recovery_required")return json(res,409,{error:"run_not_recoverable",status:run.status});
      await transitionRun(pool,payload.runId,"executing",{eventStage:"recovery",message:"Run explicitly recovered after worker interruption."});
      return json(res,200,{state:"recovered",simulated:false,runId:payload.runId});
    }

    if (req.method === "POST" && req.url === "/worker/jobs/cancel") {
      if (!authorized(req)) {
        return json(res, 401, { error: "worker_auth_required" });
      }

      const payload=await body(req);
      if(!payload.runId)return json(res,400,{error:"runId_required"});
      const run=(await pool.query("SELECT id,status FROM ai_runs WHERE id=$1 LIMIT 1",[payload.runId])).rows[0];
      if(!run)return json(res,404,{error:"run_not_found"});
      if(["deployed","failed","cancelled","rejected"].includes(run.status))return json(res,409,{error:"run_already_terminal",status:run.status});
      await transitionRun(pool,payload.runId,"cancelled",{eventStage:"cancelled",message:"Run cancelled by user."});
      await pool.query("UPDATE provider_attempts SET status='cancelled',completed_at=now(),error=coalesce(error,'cancelled_by_user') WHERE run_id=$1 AND status IN ('running','pending')",[payload.runId]);
      await pool.query("UPDATE ai_run_steps SET status='cancelled' WHERE run_id=$1 AND status IN ('running','pending','awaiting_review')",[payload.runId]);
      return json(res,200,{accepted:true,cancelled:true,simulated:false,runId:payload.runId});
    }

    return json(res, 404, { error: "not_found" });
  } catch (error) {
    return json(res, 400, {
      error: error instanceof Error ? error.message : "worker_error",
    });
  }
});

let databaseReady = false;
let databaseLastError = null;

async function recoverInterruptedRuns() {
  if (!pool) return;
  const interrupted=(await pool.query("SELECT id,status FROM ai_runs WHERE status IN ('testing','executing','building','repairing','deploying')")).rows;
  for (const run of interrupted) {
    try {
      await transitionRun(pool,run.id,"recovery_required",{eventStage:"recovery",level:"warn",message:"Worker restart detected; execution requires explicit recovery."});
    } catch (error) {
      console.error(JSON.stringify({service:"forgeos-execution-worker",recoveryTransitionFailed:true,runId:run.id,error:error instanceof Error?error.message:String(error)}));
    }
  }
  await pool.query("UPDATE provider_attempts SET status='interrupted',completed_at=now(),error=coalesce(error,'worker_restart_interrupted_attempt') WHERE status='running'");
}

async function initializeDatabase() {
  if (!pool) return;
  try {
    await runMigrations(pool);
    databaseReady = true;
    databaseLastError = null;
    await recoverInterruptedRuns();
    console.log(JSON.stringify({ service: "forgeos-execution-worker", databaseSchema: "migrations-ready" }));
  } catch (error) {
    databaseReady = false;
    databaseLastError = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      service: "forgeos-execution-worker",
      database: "unavailable",
      error: databaseLastError,
      retrying: true
    }));
    setTimeout(initializeDatabase, 10000);
  }
}

function startServer() {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(JSON.stringify({
      service: "forgeos-execution-worker",
      port: PORT,
      realExecution: true,
      authenticatedExecution: Boolean(WORKER_TOKEN),
      databaseConfigured: Boolean(pool),
    }));
  });
}

startServer();
initializeDatabase();

process.on("SIGTERM", async () => {
  await databaseProvider.close();
  server.close(() => process.exit(0));
});
