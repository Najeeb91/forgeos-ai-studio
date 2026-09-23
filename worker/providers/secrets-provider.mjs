import { ForgeOSProvider, ProviderCapability } from "../../core/provider-contracts.mjs";

const ALLOWED=["FORGEOS_AI_API_KEY","FORGEOS_AI_BASE_URL","FORGEOS_AI_MODEL","FORGEOS_AI_PROVIDER","VERCEL_TOKEN","GITHUB_TOKEN","NETLIFY_AUTH_TOKEN"];
export class EnvironmentSecretsProvider extends ForgeOSProvider{
 constructor(){super({id:"environment",capability:ProviderCapability.SECRETS});}
 async health(){return {ok:true,provider:this.id,capability:this.capability,configured:true,realExecution:true,mode:"process-environment",managedKeys:ALLOWED.filter(k=>Boolean(process.env[k]))};}
 async get(name){if(!ALLOWED.includes(name))throw new Error("secret_not_allowed");const value=process.env[name];return value?{name,configured:true,value}:null;}
}
export function createSecretsProvider(){return new EnvironmentSecretsProvider();}
