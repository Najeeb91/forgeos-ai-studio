import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(pool) {
  if (!pool) return;
  await pool.query("CREATE TABLE IF NOT EXISTS forgeos_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const files = ["001_baseline.sql", "002_memory_and_provider.sql", "003_portable_storage_and_source_sync.sql", "004_deployment_run_binding.sql", "005_source_run_binding.sql", "006_test_run_binding.sql",
 "007_ai_run_timestamps.sql"];
  for (const id of files) {
    const exists = await pool.query("SELECT 1 FROM forgeos_migrations WHERE id=$1", [id]);
    if (exists.rowCount) continue;
    const sql = await readFile(join(here, "migrations", id), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const statement of sql.split(/;\s*(?=CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)/i).map((s) => s.trim()).filter(Boolean)) {
        await client.query(statement);
      }
      await client.query("INSERT INTO forgeos_migrations(id) VALUES($1)", [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}