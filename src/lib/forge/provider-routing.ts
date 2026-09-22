export type ForgeProviderKind = "execution" | "deployment" | "ai" | "database";
export type ForgeProviderStatus = "configured" | "standby" | "unavailable";
export interface ForgeProvider { id:string; kind:ForgeProviderKind; label:string; status:ForgeProviderStatus; priority:number; capabilities:string[]; endpointEnv?:string; notes:string; }

const providers: ForgeProvider[] = [
{ id:"http-executor", kind:"execution", label:"HTTP Execution Adapter", status:process.env.FORGEOS_EXECUTOR_URL || process.env.FORGEOS_WORKER_URL ? "configured" : "unavailable", priority:10, capabilities:["source-build","test","bounded-repair"], endpointEnv:"FORGEOS_EXECUTOR_URL", notes:"Provider-neutral execution contract; the host can be Railway, another container platform, or self-hosted infrastructure." },
{ id:"github-actions", kind:"execution", label:"GitHub Actions", status:process.env.FORGEOS_GITHUB_EXECUTOR_ENABLED === "true" ? "configured" : "standby", priority:20, capabilities:["source-build","test","artifact"], notes:"Secondary CI/build plane. GitHub remains source infrastructure, not the ForgeOS runtime." },
{ id:"appdeploy", kind:"deployment", label:"AppDeploy", status:process.env.FORGEOS_APPDEPLOY_ENABLED === "true" ? "configured" : "standby", priority:20, capabilities:["hosted-preview","deployment","qa"], notes:"Optional deployment/QA adapter; the existing factory is a feature reference, not source of truth." },
{ id:"railway", kind:"deployment", label:"Railway", status:"standby", priority:30, capabilities:["container-hosting","persistent-service","worker-hosting"], notes:"Hosting adapter only; never a ForgeOS architectural dependency." },
{ id:"vercel", kind:"deployment", label:"Vercel", status:process.env.VERCEL_TOKEN ? "configured" : "standby", priority:40, capabilities:["web-deployment","preview"], notes:"Optional deployment adapter. ForgeOS core does not require it." },
];
export function listForgeProviders(): ForgeProvider[] { return [...providers].sort((a,b)=>a.priority-b.priority); }
export function selectForgeProvider(kind:ForgeProviderKind, preferred?:string): ForgeProvider|null { const candidates=providers.filter(p=>p.kind===kind && p.status==="configured").sort((a,b)=>a.priority-b.priority); if(preferred){const exact=candidates.find(p=>p.id===preferred); if(exact)return exact;} return candidates[0]??null; }