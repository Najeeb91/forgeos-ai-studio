import postgres from "postgres";

const url = process.env.DATABASE_URL;
export const sql = url ? postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 }) : null;
export async function checkDatabaseReadiness(client = sql) {
  if (!client) return false;
  try {
    await client`select 1`;
    return true;
  } catch {
    return false;
  }
}
