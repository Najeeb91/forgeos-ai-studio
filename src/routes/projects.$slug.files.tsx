import { createFileRoute } from "@tanstack/react-router";
import { File, Folder, GitBranch } from "lucide-react";
import { useState } from "react";

import { PageBody, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { getProject } from "@/lib/forge/data";
import type { FileNode } from "@/lib/forge/types";

export const Route = createFileRoute("/projects/$slug/files")({ component: Files });

function flatten(nodes: FileNode): FileNode[] { return nodes.kind === "file" ? [nodes] : (nodes.children ?? []).flatMap(flatten); }
function statusTone(status?: FileNode["status"]): "success" | "warning" | "neutral" { return status === "new" ? "success" : status === "modified" ? "warning" : "neutral"; }

function Files() {
  const { slug } = Route.useParams();
  const project = getProject(slug)!;
  const files = project.files.flatMap(flatten);
  const [selected, setSelected] = useState<FileNode | undefined>(files[0]);
  return <PageBody>
    <Panel title="Source explorer" description="Read-only generated source inventory. ForgeOS is not presenting a full IDE." actions={<Pill tone="info">{files.length} files · generated source</Pill>}>
      <div className="grid min-h-[520px] gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.7fr)]">
        <div className="overflow-auto rounded-md border border-border bg-background p-2"><div className="mb-2 flex items-center gap-2 px-2 text-xs text-muted-foreground"><Folder className="size-3.5" /> project tree</div><Tree nodes={project.files} selected={selected?.path} onSelect={setSelected} /></div>
        <div className="min-w-0 overflow-hidden rounded-md border border-border bg-background"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs"><code className="truncate">{selected?.path ?? "Select a file"}</code>{selected ? <div className="flex gap-2"><Pill tone={statusTone(selected.status)}>{selected.status ?? "untracked"}</Pill><span className="text-muted-foreground">{selected.language ?? "text"} · {selected.loc ?? 0} LOC</span></div> : null}</div><pre className="max-h-[470px] overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground">{selected?.content ?? "No file selected or no seeded content available."}</pre></div>
      </div>
    </Panel>
    <div className="grid gap-3 sm:grid-cols-3">{(["new", "modified", "unchanged"] as const).map((status) => <div key={status} className="panel p-3"><div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{status}</div><div className="mt-1 font-mono text-xl">{files.filter((file) => file.status === status).length}</div></div>)}</div>
  </PageBody>;
}

function Tree({ nodes, depth = 0, selected, onSelect }: { nodes: FileNode[]; depth?: number; selected?: string; onSelect: (file: FileNode) => void }) {
  return <div className="space-y-0.5">{nodes.map((node) => node.kind === "dir" ? <div key={node.path}><div className="flex items-center gap-2 py-1 text-xs text-muted-foreground" style={{ paddingLeft: depth * 12 }}><Folder className="size-3.5 text-primary" />{node.path.split("/").at(-1)}</div><Tree nodes={node.children ?? []} depth={depth + 1} selected={selected} onSelect={onSelect} /></div> : <button key={node.path} onClick={() => onSelect(node)} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-elevated ${selected === node.path ? "bg-elevated text-foreground" : "text-muted-foreground"}`} style={{ paddingLeft: depth * 12 + 8 }}><File className="size-3.5" /> <span className="truncate">{node.path.split("/").at(-1)}</span><GitBranch className="ml-auto size-3 text-muted-foreground" /></button>)}</div>;
}
