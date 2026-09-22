import { randomUUID } from "node:crypto";

async function ensureProject(pool, projectSlug, prompt) {
  const id = randomUUID();
  const name = projectSlug === "forgeos"
    ? "ForgeOS"
    : String(projectSlug).replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const result = await pool.query(
    "INSERT INTO projects(id,slug,name,tagline,description,status,health,owner,stack,benchmark) VALUES($1,$2,$3,$4,$5,'building','healthy','forgeos',$6::jsonb,false) ON CONFLICT(slug) DO UPDATE SET updated_at=now() RETURNING id",
    [id, projectSlug, name, "AI software factory", "Project managed by ForgeOS. Initial requirement: " + String(prompt).slice(0, 1000), JSON.stringify(["React","TypeScript","Vite"])]
  );
  return result.rows[0].id;
}

const steps = [
  ["Understand requirement","Read the requirement and current Project Memory/Brain.","brain","low","done",false],
  ["Draft implementation plan","Translate the requirement into a bounded implementation plan.","plan","low","done",false],
  ["Generate source","Generate or patch the source snapshot without destructive actions.","build","medium","pending",false],
  ["Real build verification","Install dependencies under policy and execute the allowed build/test contract.","test","high","awaiting_approval",true],
  ["Review result","Record source, tests, provider observations and audit evidence.","review","low","pending",false],
];

export async function prepareBuild(pool, { runId, projectSlug, prompt }) {
  const projectId = await ensureProject(pool, projectSlug || "forgeos", prompt);
  const existing = await pool.query("SELECT id,status FROM ai_runs WHERE id=$1 LIMIT 1", [runId]);
  if (!existing.rows[0]) {
    await pool.query(
      "INSERT INTO ai_runs(id,project_id,prompt,provider,model,status) VALUES($1,$2,$3,$4,$5,$6)",
      [runId, projectId, prompt, "provider-router", "pending", "awaiting_approval"]
    );
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await pool.query(
        "INSERT INTO ai_run_steps(id,run_id,title,detail,stage,risk,status,order_idx) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [randomUUID(), runId, s[0], s[1], s[2], s[3], s[4], i]
      );
    }
  }
  const step = await pool.query(
    "SELECT id,title,detail,stage,risk,status,order_idx FROM ai_run_steps WHERE run_id=$1 ORDER BY order_idx",
    [runId]
  );
  let approval = (await pool.query(
    "SELECT id,step_id,action_type,target,reason,risk,status,created_at,decided_at FROM approval_requests WHERE run_id=$1 AND status='pending' ORDER BY created_at DESC LIMIT 1",
    [runId]
  )).rows[0];
  if (!approval) {
    const gated = step.rows.find((s) => s.status === "awaiting_approval" && ["high","critical"].includes(s.risk));
    if (gated) {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO approval_requests(id,project_id,run_id,step_id,action_type,target,reason,risk,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending')",
        [id, projectId, runId, gated.id, "run_test", gated.stage, gated.detail, gated.risk]
      );
      approval = (await pool.query("SELECT id,step_id,action_type,target,reason,risk,status,created_at,decided_at FROM approval_requests WHERE id=$1",[id])).rows[0];
    }
  }
  await pool.query(
    "INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,'info','plan',$3)",
    [randomUUID(), runId, "Durable plan created. High-risk execution is blocked until approval."]
  );
  return { projectId, runId, state: approval ? "awaiting_approval" : "executing", plan: step.rows, approval };
}

export async function approveBuild(pool, { runId, approvalId, decision, actorId = "user" }) {
  const approval = (await pool.query(
    "SELECT * FROM approval_requests WHERE id=$1 AND run_id=$2 LIMIT 1",
    [approvalId, runId]
  )).rows[0];
  if (!approval) throw new Error("approval_not_found");
  if (approval.status !== "pending") throw new Error("approval_already_decided");
  const normalized = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : null;
  if (!normalized) throw new Error("invalid_approval_decision");
  await pool.query(
    "UPDATE approval_requests SET status=$1,actor_id=$2,decided_at=now() WHERE id=$3",
    [normalized, actorId, approvalId]
  );
  await pool.query(
    "UPDATE approvals SET decision=$1,actor=$2 WHERE id IN (SELECT id FROM approvals WHERE step_id=$3) ",
    [normalized, actorId, approval.step_id]
  ).catch(async () => {});
  await pool.query(
    "INSERT INTO approvals(id,step_id,decision,actor) VALUES($1,$2,$3,$4)",
    [randomUUID(), approval.step_id, normalized, actorId]
  );
  await pool.query(
    "UPDATE ai_run_steps SET status=$1 WHERE id=$2",
    [normalized === "approved" ? "done" : "rejected", approval.step_id]
  );
  await pool.query(
    "UPDATE ai_runs SET status=$1,updated_at=now() WHERE id=$2",
    [normalized === "approved" ? "executing" : "failed", runId]
  );
  await pool.query(
    "INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,'approval','approval',$3)",
    [randomUUID(), runId, "Human approval decision: " + normalized]
  );
  return { runId, approvalId, decision: normalized, state: normalized === "approved" ? "executing" : "failed" };
}

export async function assertApproved(pool, runId) {
  const pending = await pool.query(
    "SELECT id FROM approval_requests WHERE run_id=$1 AND status='pending' LIMIT 1",
    [runId]
  );
  if (pending.rows[0]) throw new Error("approval_required");
  const rejected = await pool.query(
    "SELECT id FROM approval_requests WHERE run_id=$1 AND status='rejected' LIMIT 1",
    [runId]
  );
  if (rejected.rows[0]) throw new Error("approval_rejected");
  return true;
}
