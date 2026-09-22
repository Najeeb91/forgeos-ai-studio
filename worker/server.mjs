import http from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { buildAndPersist, repairAndBuild, latestSource, capabilities, readProject } from "./forge-core.mjs";
import { runMigrations } from "./migrate.mjs";
import { prepareBuild, approveBuild, assertApproved } from "./approval-core.mjs";
import { deployVercel } from "./deployment-core.mjs";

const PORT = Number(process.env.PORT || 8080);
const WORKER_TOKEN = process.env.FORGEOS_WORKER_TOKEN || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_MS = 120000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 4 }) : null;

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

function authorized(req) {
  if (!WORKER_TOKEN) return false;
  const value = req.headers.authorization || "";
  return value === `Bearer ${WORKER_TOKEN}`;
}

function validateFiles(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error("files_required");
  let total = 0;
  for (const file of files) {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string") {
      throw new Error("invalid_file");
    }
    if (file.path.startsWith("/") || file.path.includes("..") || file.path.includes("\\")) {
      throw new Error("unsafe_path");
    }
    const bytes = Buffer.byteLength(file.content);
    if (bytes > MAX_FILE_BYTES) throw new Error("file_too_large");
    total += bytes;
    if (total > MAX_TOTAL_BYTES) throw new Error("source_too_large");
  }
}

function exec(command, args, cwd) {
  return new Promise((resolveRun) => {
    execFile(
      command,
      args,
      {
        cwd,
        timeout: MAX_DURATION_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        env: {
          PATH: process.env.PATH,
          HOME: cwd,
          NODE_ENV: "production",
          CI: "1",
        },
      },
      (error, stdout, stderr) => {
        resolveRun({
          ok: !error,
          code: typeof error?.code === "number" ? error.code : error ? null : 0,
          stdout: String(stdout || "").slice(-MAX_OUTPUT_BYTES),
          stderr: String(stderr || "").slice(-MAX_OUTPUT_BYTES),
          error: error?.message || null,
        });
      }
    );
  });
}

async function execute(runId, files) {
  validateFiles(files);
  const jobId = randomUUID();
  const root = await mkdtemp(join(tmpdir(), "forgeos-job-"));

  try {
    for (const file of files) {
      const target = resolve(root, file.path);
      if (!target.startsWith(root + "/")) throw new Error("unsafe_path");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }

    const packageFile = files.find((f) => f.path === "package.json");
    if (!packageFile) throw new Error("package_json_required");

    let pkg;
    try {
      pkg = JSON.parse(packageFile.content);
    } catch {
      throw new Error("invalid_package_json");
    }

    const scripts = pkg?.scripts || {};
    if (scripts.preinstall || scripts.postinstall || scripts.prepare) {
      throw new Error("lifecycle_scripts_not_allowed");
    }

    const build = typeof scripts.build === "string" ? scripts.build.trim() : "";
    if (!["vite build", "next build", "tsc --noEmit"].includes(build)) {
      throw new Error("unsupported_build_profile");
    }

    const install = await exec(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
      root
    );

    if (!install.ok) {
      const result = {
        jobId,
        runId,
        state: "failed",
        phase: "install",
        simulated: false,
        install,
      };
      return result;
    }

    const built = await exec("npm", ["run", "build"], root);

    const artifact = await stat(join(root, "dist"))
      .then(() => ({ type: "directory", path: "dist" }))
      .catch(() => null);

    const result = {
      jobId,
      runId,
      state: built.ok ? "passed" : "failed",
      phase: "build",
      simulated: false,
      artifact,
      build: built,
      policy: {
        workspaceOnly: true,
        commandAllowlist: [
          "npm install --ignore-scripts --no-audit --no-fund",
          "npm run build",
        ],
        maxDurationMs: MAX_DURATION_MS,
        maxOutputBytes: MAX_OUTPUT_BYTES,
        network: "dependency-install-only",
      },
    };

    return result;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

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

      const run = (await pool.query("SELECT ar.id,ar.project_id,ar.status,(SELECT status FROM test_runs WHERE project_id=ar.project_id AND snapshot_id IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS latest_test_status FROM ai_runs ar WHERE ar.id=$1 LIMIT 1",[runId])).rows[0];
      if (!run) return json(res, 404, { error: "run_not_found" });
      if (run.status !== "review") return json(res, 409, { error: "real_test_review_required" });
      if (run.latest_test_status !== "passed") return json(res, 409, { error: "real_tests_required" });

      if (environment === "production") {
        const approved = (await pool.query("SELECT id FROM approval_requests WHERE run_id=$1 AND action_type='deploy_production' AND status='approved' ORDER BY decided_at DESC LIMIT 1",[runId])).rows[0];
        if (!approved) {
          const pending = (await pool.query("SELECT id,target,reason,risk,status FROM approval_requests WHERE run_id=$1 AND action_type='deploy_production' AND status='pending' ORDER BY created_at DESC LIMIT 1",[runId])).rows[0];
          if (pending) return json(res, 200, { state:"awaiting_approval", simulated:false, approval:pending });
          const id=randomUUID();
          await pool.query("INSERT INTO approval_requests(id,project_id,run_id,action_type,target,reason,risk,status) VALUES($1,$2,$3,'deploy_production',$4,$5,'critical','pending')",[id,run.project_id,runId,environment,"Release the verified source snapshot to the production deployment adapter."]);
          await pool.query("INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,'approval','deploying','Production deployment is waiting for durable human approval.')",[randomUUID(),runId]);
          return json(res, 200, { state:"awaiting_approval", simulated:false, approval:{id,target:environment,reason:"Release verified source to production.",risk:"critical",status:"pending"} });
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
