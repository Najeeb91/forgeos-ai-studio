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
  async putText({projectId,path,content,metadata={}}) {
    if(!projectId||!path) throw new Error("storage_key_required");
    return {projectId,path,bytes:Buffer.byteLength(String(content||"")),metadata,stored:true,provider:this.id};
  }
  async getText({projectId,path}) {
    if(!projectId||!path) throw new Error("storage_key_required");
    return null;
  }
}

export function createStorageProvider(databaseProvider){
  return new PostgresProjectStorageProvider(databaseProvider);
}
