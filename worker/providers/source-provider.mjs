import { ForgeOSProvider, ProviderCapability } from "../../core/provider-contracts.mjs";

export class GitHubSourceProvider extends ForgeOSProvider {
  constructor(){super({id:"github",capability:ProviderCapability.SOURCE});this.token=process.env.GITHUB_TOKEN||"";this.owner=process.env.FORGEOS_GITHUB_OWNER||"Najeeb91";this.repo=process.env.FORGEOS_GITHUB_REPO||"forgeos-ai-studio";}
  async health(){
    if(!this.token)return {ok:false,provider:this.id,capability:this.capability,configured:false,realExecution:false,error:"github_token_missing"};
    const r=await fetch("https://api.github.com/repos/"+encodeURIComponent(this.owner)+"/"+encodeURIComponent(this.repo),{headers:{Authorization:"Bearer "+this.token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});
    return {ok:r.ok,provider:this.id,capability:this.capability,configured:true,realExecution:r.ok,repository:this.owner+"/"+this.repo,error:r.ok?null:"github_repository_unavailable"};
  }
  async getFile(path,ref="main"){
    if(!this.token)throw new Error("github_token_missing");
    const r=await fetch("https://api.github.com/repos/"+this.owner+"/"+this.repo+"/contents/"+path+"?ref="+encodeURIComponent(ref),{headers:{Authorization:"Bearer "+this.token,Accept:"application/vnd.github.raw+json","X-GitHub-Api-Version":"2022-11-28"}});
    if(!r.ok)throw new Error("github_source_read_failed_"+r.status);
    return {path,content:await r.text(),ref};
  }
  async putFile({path,content,message,branch="main"}){
    if(!this.token)throw new Error("github_token_missing");
    const api="https://api.github.com/repos/"+this.owner+"/"+this.repo+"/contents/"+path;
    const existing=await fetch(api+"?ref="+encodeURIComponent(branch),{headers:{Authorization:"Bearer "+this.token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});
    const body=existing.ok?await existing.json():null;
    const r=await fetch(api,{method:"PUT",headers:{Authorization:"Bearer "+this.token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},body:JSON.stringify({message:message||"ForgeOS source update",content:Buffer.from(String(content)).toString("base64"),branch,...(body?.sha?{sha:body.sha}:{})})});
    const result=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(result?.message||"github_source_write_failed");
    return {provider:this.id,path,branch,commitSha:result?.commit?.sha||null,url:result?.content?.html_url||null};
  }
}
export function createSourceProviders(){return [new GitHubSourceProvider()];}
export function createSourceProvider(){const id=process.env.FORGEOS_SOURCE_PROVIDER||"github";if(id==="github")return new GitHubSourceProvider();throw new Error("unsupported_source_provider:"+id);}
