export type WorkerSourceFile={path:string;content:string};
export type WorkerBuildResponse={ok?:boolean;jobId:string;runId:string|null;state:"passed"|"failed";phase:string;simulated:false;artifact?:{type:string;path:string}|null;install?:any;build?:any;policy?:any;error?:string;generationMode?:string;provider?:string;model?:string;sourceFiles?:WorkerSourceFile[];projectId?:string|null;snapshotId?:string|null};

function workerConfig(){const url=process.env.FORGEOS_EXECUTOR_URL || process.env.FORGEOS_WORKER_URL;const token=process.env.FORGEOS_WORKER_TOKEN;if(!url)throw new Error("FORGEOS_EXECUTOR_URL is not configured");if(!token)throw new Error("FORGEOS_WORKER_TOKEN is not configured");return{url:url.replace(/\/$/,""),token};}

export async function executeBuild(runId:string,projectSlug:string,prompt:string):Promise<WorkerBuildResponse>{
  const {url,token}=workerConfig();
  const response=await fetch(`${url}/worker/build`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({runId,projectSlug,prompt})});
  const text=await response.text();let payload:WorkerBuildResponse;
  try{payload=JSON.parse(text) as WorkerBuildResponse}catch{throw new Error(`Execution worker returned invalid JSON (HTTP ${response.status})`);}
  if(!response.ok)throw new Error(payload.error||payload.build?.stderr||payload.install?.stderr||`Execution worker failed with HTTP ${response.status}`);
  if(payload.simulated!==false)throw new Error("Execution worker did not report a real execution");
  return payload;
}

export async function getLatestGeneratedSource(projectSlug:string):Promise<WorkerSourceFile[]>{
  const {url,token}=workerConfig();
  const response=await fetch(`${url}/worker/source/latest`,{headers:{authorization:`Bearer ${token}`,"x-forgeos-project-slug":projectSlug}});
  const text=await response.text();
  if(!response.ok)throw new Error(`Generated source lookup failed (HTTP ${response.status})`);
  const payload=JSON.parse(text) as {files?:WorkerSourceFile[]};
  return payload.files??[];
}

export async function getProjectFromWorker(projectSlug:string):Promise<{project?:any}|null>{
  const {url,token}=workerConfig();
  const response=await fetch(`${url}/worker/project/${encodeURIComponent(projectSlug)}`,{headers:{authorization:`Bearer ${token}`}});
  const text=await response.text();
  if(!response.ok) throw new Error(`Project lookup failed (HTTP ${response.status})`);
  return JSON.parse(text) as {project?:any};
}
