import { randomUUID } from "node:crypto";
import { ForgeOSProvider, ProviderCapability } from "../../core/provider-contracts.mjs";

export class PostgresProjectStorageProvider extends ForgeOSProvider {
  constructor(databaseProvider) {
    super({ id: "postgres-project-storage", capability: ProviderCapability.STORAGE });
    this.database = databaseProvider;
  }
  async health() {
    const db = await this.database.health();
    return {
      ok: db.ok,
      provider: this.id,
      capability: this.capability,
      realExecution: db.ok,
      backend: db.provider,
      mode: "database-backed-project-storage",
    };
  }
  async putText({ projectId, key, content, contentType = "text/plain", metadata = {} }) {
    if (!projectId || !key) throw new Error("storage_project_and_key_required");
    if (typeof content !== "string") throw new Error("storage_text_required");
    const r = await this.database.query(
      "INSERT INTO project_artifacts(id,project_id,key,content,content_type,provider,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(project_id,key) DO UPDATE SET content=excluded.content,content_type=excluded.content_type,provider=excluded.provider,metadata=excluded.metadata,updated_at=now() RETURNING id,key,updated_at",
      [randomUUID(), projectId, key, content, contentType, this.id, JSON.stringify(metadata)],
    );
    return { provider: this.id, ...r.rows[0] };
  }
  async getText({ projectId, key }) {
    if (!projectId || !key) throw new Error("storage_project_and_key_required");
    const r = await this.database.query(
      "SELECT key,content,content_type,metadata,updated_at FROM project_artifacts WHERE project_id=$1 AND key=$2 LIMIT 1",
      [projectId, key],
    );
    return r.rows[0] ? { provider: this.id, ...r.rows[0] } : null;
  }
}
export function createStorageProvider(databaseProvider) {
  return new PostgresProjectStorageProvider(databaseProvider);
}
