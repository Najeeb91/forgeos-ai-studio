import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Link2, Table2 } from "lucide-react";

import { PageBody, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { getProject } from "@/lib/forge/data";

export const Route = createFileRoute("/projects/$slug/data")({ component: Data });

function Data() {
  const { slug } = Route.useParams();
  const tables = getProject(slug)!.brain.schema;
  return <PageBody><Panel title="Generated application schema" description="Schema browser sourced from Project Brain. This is not ForgeOS's own database." actions={<Pill tone="warning">no database connection</Pill>}><div className="space-y-4">{tables.length ? tables.map((table) => <section key={table.name} className="overflow-hidden rounded-md border border-border"><header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-elevated/40 px-4 py-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Table2 className="size-4 text-primary" />{table.name}</h2><p className="mt-1 text-xs text-muted-foreground">{table.purpose}</p></div><div className="flex items-center gap-2"><Pill tone="info">{table.columns.length} columns</Pill><Pill tone="neutral">RLS tracked</Pill></div></header><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Column</th><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 font-medium">Nullability</th><th className="px-4 py-2 font-medium">Keys / notes</th></tr></thead><tbody className="divide-y divide-border">{table.columns.map((column) => <tr key={column.name}><td className="px-4 py-2 font-mono">{column.name}</td><td className="px-4 py-2 font-mono text-info">{column.type}</td><td className="px-4 py-2">{column.nullable ? "nullable" : "not null"}</td><td className="px-4 py-2 text-muted-foreground">{column.key ? <span className="mr-2 inline-flex items-center gap-1"><KeyRound className="size-3" />{column.key}</span> : null}{column.references ? <span className="mr-2 inline-flex items-center gap-1"><Link2 className="size-3" />{column.references}</span> : null}{column.note ?? "—"}</td></tr>)}</tbody></table></div><div className="border-t border-border px-4 py-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">RLS:</span> {table.rls} <span className="ml-4"><span className="font-medium text-foreground">Indexes:</span> {table.indexes?.join(" · ") ?? "Not recorded in Brain"}</span></div></section>) : <p className="text-sm text-muted-foreground">No schema has been captured yet.</p>}</div></Panel></PageBody>;
}
