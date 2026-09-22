import postgres from "postgres";

const url = process.env.DATABASE_URL;
export const sql = url ? postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 }) : null;
export async function checkDatabaseReadiness() {
  if (!sql) return false;
  try { await sql`select 1`; return true; } catch { return false; }
}
