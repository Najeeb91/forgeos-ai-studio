import { createFileRoute } from "@tanstack/react-router";
import { Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageBody, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { getLatestGeneratedApp } from "@/lib/forge/execution.functions";
import { getProject } from "@/lib/forge/data";

export const Route = createFileRoute("/projects/$slug/preview")({ component: Preview });

function Preview() {
  const { slug } = Route.useParams();
  const project = getProject(slug)!;
  const [device,setDevice]=useState<"desktop"|"tablet"|"mobile">("desktop");
  const [refreshes,setRefreshes]=useState(0);
  const [srcDoc,setSrcDoc]=useState("");
  const [real,setReal]=useState(false);

  useEffect(()=>{
    let active=true;
    getLatestGeneratedApp({}).then(files=>{
      if(!active||!files.length)return;
      const index=files.find(f=>f.path==="index.html")?.content??"";
      const main=files.find(f=>f.path==="src/main.js")?.content??"";
      const css=files.find(f=>f.path==="src/styles.css")?.content??"";
      const safeMain=main.replaceAll("</script","<\\/script");
      const doc=index.replace('<script type="module" src="/src/main.js"></script>',`<style>${css}</style><script>${safeMain}</script>`);
      setSrcDoc(doc);setReal(true);
    }).catch(()=>setReal(false));
    return()=>{active=false};
  },[refreshes]);

  const frameClass=device==="desktop"?"w-full":device==="tablet"?"mx-auto w-[720px] max-w-full":"mx-auto w-[390px] max-w-full";
  return <PageBody>
    <Panel title="Preview workspace" description={real?"Live preview of the latest successfully built generated source tree.":"No successfully built generated app is available yet."} actions={<Pill tone={real?"success":"warning"}>{real?"real generated runtime":"waiting for build"}</Pill>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm"><span className={real?"size-2 rounded-full bg-success":"size-2 rounded-full bg-warning"}/>{real?"Runtime ready":"Runtime unavailable"}</div>
        <div className="flex flex-wrap gap-2">
          {(["desktop","tablet","mobile"] as const).map(value=><Button key={value} size="sm" variant={device===value?"secondary":"ghost"} onClick={()=>setDevice(value)}>{value==="desktop"?<Monitor/>:value==="tablet"?<Tablet/>:<Smartphone/>}{value}</Button>)}
          <Button size="sm" variant="outline" onClick={()=>setRefreshes(v=>v+1)}><RefreshCw/>Refresh</Button>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-border bg-background p-3">
        <div className={`${frameClass} overflow-hidden rounded-md border border-border bg-white`}>
          {srcDoc?<iframe key={refreshes} title="ForgeOS generated application" sandbox="allow-scripts" srcDoc={srcDoc} className="h-[560px] w-full border-0"/>:<div className="grid min-h-[360px] place-items-center text-sm text-muted-foreground">Build an application from Builder to populate this preview.</div>}
        </div>
      </div>
    </Panel>
    <Panel title="Runtime boundary"><p className="text-xs leading-relaxed text-muted-foreground">Preview is rendered only from a source tree that completed the real authenticated execution-worker build. Simulated deployment state is not presented as a real runtime.</p></Panel>
  </PageBody>;
}
