import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../worker/node_modules/pg");

import { runMigrations } from "../worker/migrate.mjs";
import { buildAndPersist } from "../worker/forge-core.mjs";
import { ensureProject, prepareBuild, approveBuild } from "../worker/approval-core.mjs";
import { LocalProcessBuildProvider } from "../worker/providers/build-provider.mjs";
import { deployVercel, getVercelDeployment } from "../worker/deployment-core.mjs";
import { transitionRun } from "../worker/run-state.mjs";

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
const vercelToken = process.env.VERCEL_TOKEN || "";
if (!vercelToken) throw new Error("VERCEL_TOKEN is required for the real deployment lifecycle E2E");
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
function assertEqual(actual, expected, label) { assert.equal(actual, expected, label); }

try {
  await runMigrations(pool);
  const slug = "e2e-" + randomUUID().replaceAll("-", "").slice(0, 12);
  const prompt = "Build a small verified ForgeOS generated React application for the end-to-end lifecycle test.";
  const projectId = await ensureProject(pool, slug, prompt);
  assert.ok(projectId, "project must be created");

  const runId = randomUUID();
  const gate = await prepareBuild(pool, { runId, projectSlug: slug, prompt });
  assertEqual(gate.state, "awaiting_approval", "high-risk build must require approval");
  assert.ok(gate.approval?.id, "build approval must be durable");
  const approved = await approveBuild(pool, { runId, approvalId: gate.approval.id, decision: "approved", actorId: "e2e-test" });
  assertEqual(approved.state, "executing", "approved build must enter execution");

  const buildProvider = new LocalProcessBuildProvider();
  const result = await buildAndPersist(pool, { runId, projectSlug: slug, prompt, execute: (id, files) => buildProvider.build(id, files) });
  if (result.state !== "passed") console.error("E2E_BUILD_RESULT", JSON.stringify(result, null, 2));
  assertEqual(result.state, "passed", "generated source must pass a real Vite build");
  assertEqual(result.simulated, false, "build evidence must be real");
  assert.ok(result.snapshotId, "run-bound source snapshot must exist");
  assert.ok(result.sourceFiles?.length, "generated source files must exist");

  const evidence = await pool.query("SELECT ar.status, ss.id AS snapshot_id, tr.id AS test_id, tr.status AS test_status FROM ai_runs ar JOIN source_snapshots ss ON ss.run_id=ar.id JOIN test_runs tr ON tr.run_id=ar.id WHERE ar.id=$1 ORDER BY ss.created_at DESC, tr.created_at DESC LIMIT 1", [runId]);
  assert.equal(evidence.rows[0].status, "review");
  assert.equal(evidence.rows[0].snapshot_id, result.snapshotId);
  assert.equal(evidence.rows[0].test_status, "passed");

  const preview = await deployVercel({ token: vercelToken, projectName: ("forgeos-" + slug + "-preview").toLowerCase(), files: result.sourceFiles, environment: "preview" });
  assertEqual(preview.simulated, false, "preview deployment must be real");
  assert.ok(preview.deploymentId, "preview deployment id must exist");
  let previewStatus = preview;
  for (let i = 0; i < 18 && !["READY", "ERROR", "CANCELED"].includes(previewStatus.state); i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    previewStatus = await getVercelDeployment({ token: vercelToken, deploymentId: preview.deploymentId });
  }
  assertEqual(previewStatus.state, "READY", "preview deployment must become ready");
  assert.ok(previewStatus.url, "ready preview must expose a URL");

  const deployStepId = randomUUID();
  const deployApprovalId = randomUUID();
  await pool.query("INSERT INTO ai_run_steps(id,run_id,title,detail,stage,risk,status,order_idx) VALUES($1,$2,'E2E production release','Release the verified run snapshot using the deployment contract.','deploying','critical','awaiting_approval',999)",[deployStepId, runId]);
  await pool.query("INSERT INTO approval_requests(id,project_id,run_id,step_id,action_type,target,reason,risk,status) VALUES($1,$2,$3,$4,'deploy_production','production','E2E lifecycle release gate','critical','pending')",[deployApprovalId, projectId, runId, deployStepId]);
  const deployApproved = await approveBuild(pool, { runId, approvalId: deployApprovalId, decision: "approved", actorId: "e2e-test" });
  assertEqual(deployApproved.state, "review", "production approval must preserve review state until deployment starts");
  await transitionRun(pool, runId, "deploying", { eventStage: "deploy", message: "E2E real deployment adapter started." });

  const production = await deployVercel({ token: vercelToken, projectName: ("forgeos-" + slug + "-production").toLowerCase(), files: result.sourceFiles, environment: "production" });
  assertEqual(production.simulated, false, "production deployment must be real");
  assert.ok(production.deploymentId, "production deployment id must exist");
  let productionStatus = production;
  for (let i = 0; i < 24 && !["READY", "ERROR", "CANCELED"].includes(productionStatus.state); i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    productionStatus = await getVercelDeployment({ token: vercelToken, deploymentId: production.deploymentId });
  }
  assertEqual(productionStatus.state, "READY", "production deployment must become ready");
  assert.ok(productionStatus.url, "ready production deployment must expose a URL");

  const deploymentId = randomUUID();
  await pool.query("INSERT INTO deployments(id,project_id,run_id,env,status,commit_sha,url,adapter,simulated) VALUES($1,$2,$3,'production','ready',$4,$5,'vercel',false)",[deploymentId, projectId, runId, result.snapshotId, productionStatus.url]);
  await transitionRun(pool, runId, "deployed", { eventStage: "deploy", message: "Real Vercel deployment lifecycle completed." });

  const cancelRunId = randomUUID();
  await pool.query("INSERT INTO ai_runs(id,project_id,prompt,status) VALUES($1,$2,$3,'executing')",[cancelRunId, projectId, "Cancellation-path verification"]);
  await transitionRun(pool, cancelRunId, "cancelled", { eventStage: "cancelled", message: "E2E cancellation requested." });
  const cancelled = (await pool.query("SELECT status FROM ai_runs WHERE id=$1", [cancelRunId])).rows[0];
  assertEqual(cancelled.status, "cancelled", "cancellation must persist as a terminal run state");

  const final = await pool.query("SELECT ar.status, d.run_id AS deployment_run_id, tr.run_id AS test_run_id, ss.run_id AS snapshot_run_id FROM ai_runs ar JOIN deployments d ON d.run_id=ar.id JOIN test_runs tr ON tr.run_id=ar.id JOIN source_snapshots ss ON ss.run_id=ar.id WHERE ar.id=$1",[runId]);
  assert.ok(final.rows.length > 0, "complete run evidence must be queryable");
  assertEqual(final.rows[0].status, "deployed", "complete lifecycle must end deployed");
  assertEqual(final.rows[0].deployment_run_id, runId, "deployment must bind to exact run");
  assertEqual(final.rows[0].test_run_id, runId, "test must bind to exact run");
  assertEqual(final.rows[0].snapshot_run_id, runId, "source snapshot must bind to exact run");

  console.log(JSON.stringify({ok:true,simulatedDeploymentOnly:false,realBuild:true,realPreview:true,realProductionDeploy:true,cancellation:true,lifecycle:["project","approval","generation","real-build","test","preview","review","deployment-approval","deploying","deployed","cancelled","history"],runId,projectId,snapshotId:result.snapshotId,previewUrl:previewStatus.url,productionUrl:productionStatus.url}));
} finally { await pool.end(); }
