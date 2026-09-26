import { Pool } from "pg";
import { ForgeOSProvider, ProviderCapability } from "../../core/provider-contracts.mjs";

export class PostgresDatabaseProvider extends ForgeOSProvider {
  constructor() {
    super({ id: "postgres", capability: ProviderCapability.DATABASE });
    this.url = process.env.DATABASE_URL || "";
    this.pool = this.url ? new Pool({ connectionString: this.url, max: 4 }) : null;
  }
  async health() {
    if (!this.pool)
      return {
        ok: false,
        provider: this.id,
        capability: this.capability,
        configured: false,
        realExecution: false,
        error: "database_url_missing",
      };
    try {
      await this.pool.query("select 1");
      return {
        ok: true,
        provider: this.id,
        capability: this.capability,
        configured: true,
        realExecution: true,
        dialect: "postgresql",
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.id,
        capability: this.capability,
        configured: true,
        realExecution: false,
        error: error instanceof Error ? error.message : String(error),
        dialect: "postgresql",
      };
    }
  }
  async query(text, params = []) {
    if (!this.pool) throw new Error("database_provider_not_configured");
    return this.pool.query(text, params);
  }
  async connect() {
    if (!this.pool) throw new Error("database_provider_not_configured");
    return this.pool.connect();
  }
  async close() {
    await this.pool?.end().catch(() => {});
  }
}

export function createDatabaseProviders() {
  return [new PostgresDatabaseProvider()];
}
export function createDatabaseProvider() {
  const provider = process.env.FORGEOS_DATABASE_PROVIDER || "postgres";
  if (provider === "postgres") return new PostgresDatabaseProvider();
  throw new Error("unsupported_database_provider:" + provider);
}
