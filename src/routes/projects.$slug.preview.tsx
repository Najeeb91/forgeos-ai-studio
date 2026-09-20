import { createFileRoute } from "@tanstack/react-router";
import { Monitor, RefreshCw, Smartphone, Tablet, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PageBody, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { getProject } from "@/lib/forge/data";

export const Route = createFileRoute("/projects/$slug/preview")({ component: Preview });

function Preview() {
  const { slug } = Route.useParams();
  const project = getProject(slug)!;
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [refreshes, setRefreshes] = useState(0);
  const deployment = project.deployments.find((item) => item.env === "preview");
  const frameClass = device === "desktop" ? "w-full" : device === "tablet" ? "mx-auto w-[720px] max-w-full" : "mx-auto w-[390px] max-w-full";

  return (
    <PageBody>
      <Panel title="Preview workspace" description="A controlled view of the generated application contract, not a live generated runtime." actions={<Pill tone="warning">seeded / simulated runtime</Pill>}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm"><span className={project.preview.status === "ready" ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-warning"} /> Runtime {project.preview.status === "ready" ? "ready" : "cold"}</div>
          <div className="flex flex-wrap gap-2">
            {(["desktop", "tablet", "mobile"] as const).map((value) => <Button key={value} size="sm" variant={device === value ? "secondary" : "ghost"} onClick={() => setDevice(value)}>{value === "desktop" ? <Monitor /> : value === "tablet" ? <Tablet /> : <Smartphone />}{value}</Button>)}
            <Button size="sm" variant="outline" onClick={() => setRefreshes((value) => value + 1)}><RefreshCw />Refresh</Button>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <div className={`${frameClass} overflow-hidden rounded-md border border-border bg-surface transition-all`}>
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground"><span>simulated://{project.slug}{project.preview.route}</span><span>refresh {refreshes}</span></div>
            <div className="grid min-h-[280px] place-items-center bg-grid-backdrop p-8 text-center">
              <div className="max-w-md"><div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary"><Monitor className="size-5" /></div><h2 className="text-lg font-semibold">{project.name}</h2><p className="mt-2 text-sm text-muted-foreground">{project.tagline}</p><p className="mt-4 text-xs text-warning">Generated-app preview is simulated from seeded project data. No runtime has been generated or executed.</p></div>
            </div>
          </div>
        </div>
      </Panel>
      <div className="grid gap-5 md:grid-cols-3">
        <Panel title="Runtime status"><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Route</span><code>{project.preview.route}</code></div><div className="flex justify-between"><span className="text-muted-foreground">Source</span><span>Project preview contract</span></div><div className="flex justify-between"><span className="text-muted-foreground">Execution</span><Pill tone="warning">not executed</Pill></div></div></Panel>
        <Panel title="Build status"><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">State</span><Pill tone="warning">seeded metadata</Pill></div><div className="flex justify-between"><span className="text-muted-foreground">Last built</span><span>{new Date(project.preview.lastBuiltAt).toLocaleString()}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Commit</span><code>{deployment?.commit ?? "—"}</code></div></div></Panel>
        <Panel title="Release boundary"><div className="space-y-2 text-sm"><p className="text-muted-foreground">ForgeOS does not claim a successful build or runtime here.</p>{deployment ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`https://${deployment.url}`} onClick={(event) => event.preventDefault()}>Preview URL <ExternalLink className="size-3" /></a> : null}</div></Panel>
      </div>
    </PageBody>
  );
}
