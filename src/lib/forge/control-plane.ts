import { Pool } from "pg";

let pool: Pool | null = null;
let initialized = false;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  pool ??= new Pool({ connectionString: url, max: 4, idleTimeoutMillis: 10_000 });
  return pool;
}

export async function ensureControlPlane() {
  if (initialized) return;
  const client = await db().connect();
  try {
    await client.query(`
      create table if not exists forge_runs (
        id text primary key, prompt text not null, state text not null,
        generation_mode text not null, simulated boolean not null default false,
        provider text not null default 'forgeos', created_at timestamptz not null default now(),
        completed_at timestamptz
      );
      create table if not exists forge_source_files (
        id bigserial primary key, run_id text not null references forge_runs(id) on delete cascade,
        path text not null, content text not null, unique(run_id, path)
      );
      create table if not exists forge_test_runs (
        id bigserial primary key, run_id text not null references forge_runs(id) on delete cascade,
        state text not null, simulated boolean not null default false, detail jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
      create table if not exists forge_audit_events (
        id bigserial primary key, run_id text references forge_runs(id) on delete cascade,
        event_type text not null, detail jsonb not null default '{}'::jsonb,
        simulated boolean not null default false, created_at timestamptz not null default now()
      );
      create index if not exists forge_source_files_run_idx on forge_source_files(run_id);
      create index if not exists forge_audit_events_run_idx on forge_audit_events(run_id, created_at desc);
    `);
    initialized = true;
  } finally { client.release(); }
}

export async function recordBuildStart(runId: string, prompt: string, generationMode: string) {
  await ensureControlPlane();
  await db().query(
    `insert into forge_runs(id,prompt,state,generation_mode,simulated) values($1,$2,'executing',$3,false)
     on conflict(id) do update set prompt=excluded.prompt,state='executing',generation_mode=excluded.generation_mode,simulated=false`,
    [runId, prompt, generationMode],
  );
  await db().query(
    `insert into forge_audit_events(run_id,event_type,detail,simulated) values($1,'build_started',$2,false)`,
    [runId, JSON.stringify({ generationMode })],
  );
}

export async function recordBuildResult(runId: string, files: Array<{path:string;content:string}>, result: {
  state: string; phase: string; build?: {ok:boolean;stdout:string;stderr:string;error:string|null}
}) {
  await ensureControlPlane();
  const client = await db().connect();
  try {
    await client.query("begin");
    for (const file of files) {
      await client.query(
        `insert into forge_source_files(run_id,path,content) values($1,$2,$3)
         on conflict(run_id,path) do update set content=excluded.content`,
        [runId, file.path, file.content],
      );
    }
    const detail = {
      phase: result.phase, buildOk: result.build?.ok ?? false,
      stderr: result.build?.stderr?.slice(-4000) ?? "", sourceFileCount: files.length,
    };
    await client.query(
      `insert into forge_test_runs(run_id,state,simulated,detail) values($1,$2,false,$3)`,
      [runId, result.state === "passed" ? "passed" : "failed", JSON.stringify(detail)],
    );
    await client.query(
      `insert into forge_audit_events(run_id,event_type,detail,simulated) values($1,$2,$3,false)`,
      [runId, result.state === "passed" ? "build_passed" : "build_failed", JSON.stringify(detail)],
    );
    await client.query(
      `update forge_runs set state=$2,completed_at=now(),simulated=false where id=$1`,
      [runId, result.state === "passed" ? "completed" : "failed"],
    );
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

export async function getLatestGeneratedSource() {
  await ensureControlPlane();
  const { rows } = await db().query(
    `select f.path,f.content,f.run_id as "runId" from forge_source_files f
     join forge_runs r on r.id=f.run_id where r.state='completed'
     order by r.completed_at desc nulls last,f.id asc`,
  );
  const latestRun = rows[0]?.runId ?? null;
  return latestRun ? rows.filter((row) => row.runId === latestRun).map(({path,content}) => ({path,content})) : [];
}
