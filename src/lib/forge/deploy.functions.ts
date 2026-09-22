import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input=z.object({runId:z.string().min(1),projectSlug:z.string().min(1),environment:z.enum(["preview","staging","production"]).default("production")});

export const releaseForgeProject=createServerFn({method:"POST"})
  .validator(input)
  .handler(async({data})=>{
    // Reuse the server-side worker configuration without exposing credentials to the browser.
    const { url, token } = (()=>{ const u=process.env.FORGEOS_EXECUTOR_URL||process.env.FORGEOS_WORKER_URL; const t=process.env.FORGEOS_WORKER_TOKEN; if(!u)throw new Error("FORGEOS_EXECUTOR_URL is not configured"); if(!t)throw new Error("FORGEOS_WORKER_TOKEN is not configured"); return {url:u.replace(/\/$/,""),token:t}; })();
    const response=await fetch(`${url}/worker/deploy`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify(data)});
    const text=await response.text(); let payload:any; try{payload=JSON.parse(text)}catch{throw new Error(`Deployment worker returned invalid JSON (HTTP ${response.status})`)}
    if(!response.ok)throw new Error(payload.error||`Deployment failed with HTTP ${response.status}`);
    if(payload.simulated!==false)throw new Error("Deployment was not reported as real");
    return payload;
  });
