import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env["DATABASE_URL"];

// We export a singleton db instance, but keep it undefined if there's no connection
// so that the app can fallback to mock data when run locally without a database.
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;
let sql: ReturnType<typeof postgres> | undefined;

if (connectionString) {
  // Use postgres.js for connection with production-safe settings
  sql = postgres(connectionString, {
    max: 10, // Small production-safe connection pool
    idle_timeout: 20, // Connection timeout
    connect_timeout: 10,
  });
  db = drizzle(sql, { schema });
} else {
  console.warn(
    "⚠️ DATABASE_URL not found. Database features will be unavailable or use mock data.",
  );
}

/**
 * Safely checks if the database is configured, reachable, and ready to serve requests.
 * Does not expose credentials or throw unhandled exceptions.
 */
export async function checkDatabaseReadiness(): Promise<boolean> {
  if (!db || !sql) {
    return false;
  }

  try {
    // Perform a lightweight query to prove the connection is actually alive
    await sql`SELECT 1`;
    return true;
  } catch (err) {
    // Do not log the full err object to prevent credential/connection string leakage in production logs
    console.error(
      "⚠️ Database connection failed during readiness check. Falling back to mock data.",
    );
    return false;
  }
}

export { db, sql };
