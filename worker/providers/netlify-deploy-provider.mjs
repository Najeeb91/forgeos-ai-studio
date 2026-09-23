import { createHash } from "node:crypto";
import { ForgeOSProvider, ProviderCapability } from "../../core/provider-contracts.mjs";

const API="https://api.netlify.com/api/v1";
const SAFE_NAME=/^[a-z0-9][a-z0-9-]{0,62}$/;

export class NetlifyDeployProvider extends ForgeOSProvider {
  constructor(secretsProvider=null){super({id:"netlify",capability:ProviderCapability.DEPLOY});this.secrets=secretsProvider;}
  async token(){const s=this.secrets?await this.secrets.get("NETLIFY_AUTH_TOKEN"):null;return s?.value||process.env.NETLIFY_AUTH_TOKEN||"";}
  async health(){const token=await this.token();if(!token)return {ok:false,provider:this.id,capability:this.capability,configured:false,realExecution:false,error:"netlify_auth_token_missing"};const r=await fetch(API+"/sites?per_page=1",{headers:{Authorization:"Bearer "+token}});return {ok:r.ok,provider:this.id,capability:this.capability,configured:true,realExecution:r.ok,error:r.ok?null:"netlify_api_unavailable"};}
  async status({token,deploymentId}){
    if(!token)throw new Error("netlify_credentials_required");
    if(!deploymentId)throw new Error("netlify_deployment_id_required");
    const r=await fetch(API+"/deploys/"+encodeURIComponent(deploymentId),{headers:{Authorization:"Bearer "+token}});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body?.message||body?.error||"netlify_deployment_status_failed");
    return {provider:this.id,simulated:false,deploymentId:body?.id||deploymentId,url:body?.ssl_url||body?.url||null,state:body?.state||"UNKNOWN",project:body?.site_name||null,environment:body?.production?"production":"preview",raw:body};
  }

  async deploy({token,projectName,files,environment="production"}){
    if(!token)throw new Error("netlify_credentials_required");
    if(!Array.isArray(files)||!files.length)throw new Error("netlify_files_required");
    const name=String(projectName).replace(/[^a-z0-9-]/gi,"-").toLowerCase().slice(0,63);
    if(!SAFE_NAME.test(name))throw new Error("unsafe_netlify_site_name");
    const headers={Authorization:"Bearer "+token,"Content-Type":"application/json"};
    let siteId=process.env.FORGEOS_NETLIFY_SITE_ID||"";
    if(!siteId){
      const created=await fetch(API+"/sites",{method:"POST",headers,body:JSON.stringify({name})});
      const body=await created.json().catch(()=>({}));
      if(!created.ok && created.status!==422)throw new Error(body?.message||body?.error||"netlify_site_create_failed");
      siteId=body?.id||"";
      if(!siteId){
        const list=await fetch(API+"/sites?name="+encodeURIComponent(name),{headers:{Authorization:"Bearer "+token}});
        const sites=await list.json().catch(()=>[]);
        siteId=Array.isArray(sites)?sites.find(s=>s.name===name)?.id||"":""; 
      }
    }
    if(!siteId)throw new Error("netlify_site_id_unavailable");
    const manifest={};
    const bySha=new Map();
    for(const f of files){
      if(!f?.path||f.path.startsWith("/")||f.path.includes("..")||f.path.includes("\\"))throw new Error("unsafe_netlify_path");
      const path="/"+f.path.replace(/^\/+/,"");
      const data=Buffer.from(String(f.content??""),"utf8");
      const sha=createHash("sha1").update(data).digest("hex");
      manifest[path]=sha;
      bySha.set(sha,{path,data});
    }
    const deployResponse=await fetch(API+"/sites/"+encodeURIComponent(siteId)+"/deploys?"+new URLSearchParams({production:environment==="production"?"true":"false"}),{method:"POST",headers,body:JSON.stringify({files:manifest,async:false})});
    const deploy=await deployResponse.json().catch(()=>({}));
    if(!deployResponse.ok)throw new Error(deploy?.message||deploy?.error||"netlify_deploy_create_failed");
    const required=new Set(deploy.required||[]);
    for(const sha of required){
      const item=bySha.get(sha); if(!item)throw new Error("netlify_required_file_missing");
      const upload=await fetch(API+"/deploys/"+encodeURIComponent(deploy.id)+"/files/"+item.path.split("/").map(encodeURIComponent).join("/"),{method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"application/octet-stream"},body:item.data});
      if(!upload.ok){const b=await upload.json().catch(()=>({}));throw new Error(b?.message||"netlify_file_upload_failed");}
    }
    return {provider:this.id,simulated:false,deploymentId:deploy.id||null,url:deploy.ssl_url||deploy.url||deploy.deploy_ssl_url||deploy.deploy_url||null,state:deploy.state||"uploading",project:name,environment,siteId};
  }
}

export function createNetlifyDeployProvider(secretsProvider=null){return new NetlifyDeployProvider(secretsProvider);}
