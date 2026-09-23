export type WorkerSourceFile={path:string;content:string};
export type WorkerBuildResponse={ok?:boolean;jobId?:string;runId:string|null;state:"awaiting_approval"|"passed"|"failed"|"executing";phase?:string;simulated:false;artifact?:{type:string;path:string}|null;install?:any;build?:any;policy?:any;error?:string;generationMode?:string;provider?:string;model?:string;sourceFiles?:WorkerSourceFile[];projectId?:string|null;snapshotId?:string|null;approval?:any;plan?:any[];approvalRequired?:boolean};

function workerConfig(){const url=process.env.FORGEOS_EXECUTOR_URL || process.env.FORGEOS_WORKER_URL;const token=process.env.FORGEOS_WORKER_TOKEN;if(!url)throw new Error("FORGEOS_EXECUTOR_URL is not configured");if(!token)throw new Error("FORGEOS_WORKER_TOKEN is not configured");return{url:url.replace(/\/$/,""),token};}

export async function executeBuild(runId:string,projectSlug:string,prompt:string,approved=false):Promise<WorkerBuildResponse>{
  const {url,token}=workerConfig();
  const response=await fetch(`${url}/worker/build`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({runId,projectSlug,prompt,approved})});
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

export async function approveBuild(runId:string,approvalId:string,decision:"approved"|"rejected"="approved"):Promise<any>{
  const {url,token}=workerConfig();
  const response=await fetch(`${url}/worker/approve`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({runId,approvalId,decision})});
  const text=await response.text();
  let payload:any; try{payload=JSON.parse(text)}catch{throw new Error(`Approval worker returned invalid JSON (HTTP ${response.status})`)}
  if(!response.ok)throw new Error(payload.error||`Approval failed with HTTP ${response.status}`);
  if(payload.simulated!==false)throw new Error("Approval was not durably recorded");
  return payload;
}

export async function createForgeProject(input:{slug:string;name:string;prompt:string}):Promise<{project:any}>{
  const {url,token}=workerConfig();
  const response=await fetch(url+"/worker/project",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},body:JSON.stringify(input)});
  const text=await response.text();
  let payload:any; try{payload=JSON.parse(text)}catch{throw new Error("Project creation worker returned invalid JSON (HTTP "+response.status+")");}
  if(!response.ok)throw new Error(payload.error||"Project creation failed with HTTP "+response.status);
  if(payload.simulated!==false)throw new Error("Project creation was not reported as real");
  return payload;
}

export async function getDeploymentStatus(runId:string):Promise<any>{
  const {url,token}=workerConfig();
  const response=await fetch(url+"/worker/deploy/status?runId="+encodeURIComponent(runId),{headers:{authorization:"Bearer "+token}});
  const text=await response.text();
  let payload:any; try{payload=JSON.parse(text)}catch{throw new Error("Deployment status worker returned invalid JSON (HTTP "+response.status+")");}
  if(!response.ok)throw new Error(payload.error||"Deployment status failed with HTTP "+response.status);
  if(payload.simulated!==false)throw new Error("Deployment status was not reported as real");
  return payload;
}

export async function listProjectsFromWorker():Promise<any[]>{
  const {url,token}=workerConfig();
  const response=await fetch(url+"/worker/projects",{headers:{authorization:"Bearer "+token}});
  const text=await response.text();
  let payload:any; try{payload=JSON.parse(text)}catch{throw new Error("Project list worker returned invalid JSON (HTTP "+response.status+")");}
  if(!response.ok)throw new Error(payload.error||"Project list failed with HTTP "+response.status);
  if(payload.simulated!==false)throw new Error("Project list was not reported as real");
  return Array.isArray(payload.projects) ? payload.projects : [];
}
