import { ForgeOSProvider, ProviderCapability } from "../../core/provider-contracts.mjs";

export class PostgresProjectStorageProvider extends ForgeOSProvider {
  constructor(databaseProvider) {
    super({id:"postgres-project-storage", capability:ProviderCapability.STORAGE});
    this.database=databaseProvider;
  }
  async health() {
    const db=await this.database.health();
    return {ok:db.ok,provider:this.id,capability:this.capability,realExecution:db.ok,backend:db.provider,mode:"database-backed-project-storage"};
  }
  async putText() { throw new Error("storage_write_adapter_not_connected"); }
  async getText() { throw new Error("storage_read_adapter_not_connected"); }
}

export function createStorageProvider(databaseProvider){
  return new PostgresProjectStorageProvider(databaseProvider);
}
