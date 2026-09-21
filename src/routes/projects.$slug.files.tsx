import { createFileRoute } from "@tanstack/react-router";
import { File, Folder, FolderOpen } from "lucide-react";
import { useMemo, useState } from "react";

import { PageBody, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { getProject } from "@/lib/forge/data";
import type { FileNode } from "@/lib/forge/types";

export const Route = createFileRoute("/projects/$slug/files")({
  component: Files,
});

function flatten(node: FileNode): FileNode[] {
  if (node.kind === "file") return [node];
  return (node.children ?? []).flatMap(flatten);
}

function filesByStatus(files: FileNode[]) {
  return {
    new: files.filter((file) => file.status === "new").length,
    modified: files.filter((file) => file.status === "modified").length,
    unchanged: files.filter((file) => file.status === "unchanged").length,
  };
}

function Files() {
  const { slug } = Route.useParams();
  const project = getProject(slug)!;
  const flatFiles = useMemo(() => project.files.flatMap(flatten), [project]);
  const counts = useMemo(() => filesByStatus(flatFiles), [flatFiles]);
  const [selectedPath, setSelectedPath] = useState<string | undefined>(flatFiles[0]?.path);
  const selected = flatFiles.find((file) => file.path === selectedPath) ?? flatFiles[0];

  return (
    <PageBody>
      <Panel
        title="Source explorer"
        description="Read-only generated source inventory. This is not a full IDE."
        actions={<Pill tone="info">{flatFiles.length} files</Pill>}
      >
        <div className="grid min-h-[560px] gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.7fr)]">
          <div className="overflow-auto rounded-md border border-border bg-background p-2">
            <div className="mb-2 flex items-center gap-2 px-2 text-xs text-muted-foreground">
              <FolderOpen className="size-3.5" />
              project tree
            </div>
            <Tree nodes={project.files} selectedPath={selected?.path} onSelect={setSelectedPath} />
          </div>

          <div className="min-w-0 overflow-hidden rounded-md border border-border bg-background">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
              <code className="truncate">{selected?.path ?? "Select a file"}</code>
              {selected ? (
                <div className="flex items-center gap-2">
                  <Pill tone={selected.status === "new" ? "success" : selected.status === "modified" ? "warning" : "neutral"}>
                    {selected.status ?? "unchanged"}
                  </Pill>
                  <span className="text-muted-foreground">
                    {selected.language ?? "text"} · {selected.loc ?? 0} LOC
                  </span>
                </div>
              ) : null}
            </div>
            <pre className="max-h-[500px] overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {selected?.content ?? "No file selected or no seeded content available."}
            </pre>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        {([
          { key: "new", label: "new" },
          { key: "modified", label: "modified" },
          { key: "unchanged", label: "unchanged" },
        ] as const).map((status) => (
          <div key={status.key} className="panel p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{status.label}</div>
            <div className="mt-1 font-mono text-xl">{counts[status.key]}</div>
          </div>
        ))}
      </div>
    </PageBody>
  );
}

function Tree({
  nodes,
  depth = 0,
  selectedPath,
  onSelect,
}: {
  nodes: FileNode[];
  depth?: number | undefined;
  selectedPath?: string | undefined;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => {
        if (node.kind === "dir") {
          return (
            <div key={node.path}>
              <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground" style={{ paddingLeft: depth * 12 }}>
                <Folder className="size-3.5 text-primary" />
                {node.path.split("/").at(-1)}
              </div>
              {node.children ? (
                <Tree nodes={node.children} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
              ) : null}
            </div>
          );
        }

        return (
          <button
            key={node.path}
            type="button"
            onClick={() => onSelect(node.path)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-elevated ${selectedPath === node.path ? "bg-elevated text-foreground" : "text-muted-foreground"}`}
            style={{ paddingLeft: depth * 12 + 8 }}
          >
            <File className="size-3.5" />
            <span className="truncate">{node.path.split("/").at(-1)}</span>
          </button>
        );
      })}
    </div>
  );
}
