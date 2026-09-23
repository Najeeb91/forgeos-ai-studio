import http from "node:http";
import { createBuildProvider } from "./providers/build-provider.mjs";
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, {
        ok: true,
        service: "forgeos-execution-worker",
        realExecution: true,
        authenticatedExecution: Boolean(WORKER_TOKEN),
        databaseConfigured: Boolean(DATABASE_URL),
        canonicalPersistence: true,
      });
    }

    if (req.method === "GET" && req.url === "/worker/capabilities") {
      if (!authorized(req)) return json(res, 401, { error: "worker_auth_required" });
      return json(res, 200, capabilities());
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
      const result = await buildAndPersist(pool, {
        runId,
        projectSlug: payload.projectSlug || "forgeos",
        prompt: payload.prompt,
        execute,
      });
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

      const files=await latestSource(pool,projectSlug);
      if (!files.length) return json(res, 409, { error:"source_required" });
      const token=process.env.VERCEL_TOKEN || "";
      const deployment=await deployVercel({token,projectName:("forgeos-"+projectSlug+"-"+runId.slice(0,8)).toLowerCase(),files,environment});
      const deploymentId=randomUUID();
      const snapshot=(await pool.query("SELECT id FROM source_snapshots WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1",[run.project_id])).rows[0]?.id || null;
      await pool.query("INSERT INTO deployments(id,project_id,env,status,commit_sha,url,adapter,simulated) VALUES($1,$2,$3,$4,$5,$6,'vercel',false)",[deploymentId,run.project_id,environment,deployment.state||"building",snapshot||"",deployment.url||""]);
      await pool.query("INSERT INTO deployment_observations(id,deployment_id,status,url,provider_job_id,simulated,detail) VALUES($1,$2,$3,$4,$5,false,$6::jsonb)",[randomUUID(),deploymentId,deployment.state||"building",deployment.url||"",deployment.deploymentId||null,JSON.stringify(deployment)]);
      await pool.query("INSERT INTO audit_events(id,project_id,actor,actor_name,action,target,risk,approved,diff_summary,stage) VALUES($1,$2,'system','ForgeOS','deploy',$3,'critical',$4,$5,'deploying')",[randomUUID(),run.project_id,environment,true,"Real Vercel deployment adapter invoked."]);
      await pool.query("UPDATE ai_runs SET status='deploying',completed_at=now() WHERE id=$1",[runId]);
      return json(res,200,{state:"deploying",simulated:false,deployment});
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
        runId: payload.runId || randomUUID(),
        prompt: payload.prompt || "",
        files: payload.files || [],
        failure: payload.failure || "real build failed",
        execute,
      });
      return json(res, result.state === "passed" ? 200 : 422, result);
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

    if (req.method === "POST" && req.url === "/worker/jobs/cancel") {
      if (!authorized(req)) {
        return json(res, 401, { error: "worker_auth_required" });
      }

      return json(res, 202, {
        accepted: true,
        cancelled: false,
        reason: "cancellation_registry_not_enabled",
      });
    }

    return json(res, 404, { error: "not_found" });
  } catch (error) {
    return json(res, 400, {
      error: error instanceof Error ? error.message : "worker_error",
    });
  }
});

async function bootstrap() {
  if (pool) {
    await runMigrations(pool);
    console.log(JSON.stringify({ service: "forgeos-execution-worker", databaseSchema: "migrations-ready" }));
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(JSON.stringify({
      service: "forgeos-execution-worker",
      port: PORT,
      realExecution: true,
      authenticatedExecution: Boolean(WORKER_TOKEN),
    }));
  });
}

bootstrap().catch((error) => {
  console.error(JSON.stringify({
    service: "forgeos-execution-worker",
    startup: "failed",
    error: error instanceof Error ? error.message : String(error)
  }));
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await pool?.end().catch(() => {});
  server.close(() => process.exit(0));
});
