import { randomUUID } from "node:crypto";

export const RUN_STATES = Object.freeze(["awaiting_approval","executing","testing","building","repairing","review","deploying","deployed","failed","cancelled","recovery_required"]);
const TERMINAL=new Set(["deployed","failed","cancelled"]);
const ALLOWED={
  awaiting_approval:new Set(["executing","failed","cancelled","recovery_required"]),
  executing:new Set(["testing","building","repairing","review","failed","cancelled","recovery_required"]),
  testing:new Set(["building","repairing","review","failed","cancelled","recovery_required"]),
  building:new Set(["testing","repairing","review","failed","cancelled","recovery_required"]),
  repairing:new Set(["testing","repairing","review","failed","cancelled","recovery_required"]),
  review:new Set(["deploying","executing","failed","cancelled"]),
  deploying:new Set(["deployed","failed","cancelled","recovery_required"]),
  recovery_required:new Set(["executing","cancelled","failed"]),
  failed:new Set(["executing","cancelled"]),
  deployed:new Set([]),
  cancelled:new Set([])
};
export function canTransition(from,to){return from===to||Boolean(ALLOWED[from]?.has(to));}
export async function transitionRun(pool,runId,to,{eventStage="state",message=null,level="info",allowSame=true}={}) {
  if(!pool) throw new Error("worker_database_not_configured");
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const row=(await client.query("SELECT id,status FROM ai_runs WHERE id=$1 FOR UPDATE",[runId])).rows[0];
    if(!row) throw new Error("run_not_found");
    if(row.status===to&&allowSame){await client.query("COMMIT");return row;}
    if(!canTransition(row.status,to)) throw new Error("invalid_run_transition:"+row.status+"->"+to);
    const completed=TERMINAL.has(to);
    await client.query("UPDATE ai_runs SET status=$2,completed_at="+(completed?"now()":"NULL")+",updated_at=now() WHERE id=$1",[runId,to]);
    await client.query("INSERT INTO ai_events(id,run_id,level,stage,message) VALUES($1,$2,$3,$4,$5)",[randomUUID(),runId,level,eventStage,message||("Run state: "+row.status+" -> "+to)]);
    await client.query("COMMIT");
    return {id:runId,status:to,previousStatus:row.status};
  }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}
  finally{client.release();}
}
export function isTerminalRun(status){return TERMINAL.has(status);}
