import { createFileRoute } from "@tanstack/react-router";

import { PageBody, EmptyState, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProject } from "@/lib/forge/data";

export const Route = createFileRoute("/projects/$slug/brain")({ component: Brain });

function Brain() {
  const { slug } = Route.useParams();
  const project = getProject(slug)!;
  const { requirements, decisions, architecture, schema, integrations, tests, history } = project.brain;
  return <PageBody>
    <Panel title="Project brain" description="Durable knowledge that survives every AI run."><p className="text-sm leading-relaxed text-muted-foreground">{project.brain.vision}</p></Panel>
    <Tabs defaultValue="requirements"><TabsList className="flex-wrap"><TabsTrigger value="requirements">Requirements</TabsTrigger><TabsTrigger value="decisions">Decisions</TabsTrigger><TabsTrigger value="architecture">Architecture</TabsTrigger><TabsTrigger value="schema">Schema</TabsTrigger><TabsTrigger value="integrations">Integrations</TabsTrigger><TabsTrigger value="tests">Tests</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
      <TabsContent value="requirements" className="mt-4"><Requirements items={requirements} /></TabsContent>
      <TabsContent value="decisions" className="mt-4"><div className="grid gap-4 xl:grid-cols-2">{decisions.length ? decisions.map((d) => <Panel key={d.id} title={d.title}><p className="text-xs leading-relaxed text-muted-foreground">{d.rationale}</p><div className="mt-3 font-mono text-[11px] text-muted-foreground">alternatives: {d.alternatives.join(" · ")}<br />decided: {new Date(d.decidedAt).toLocaleDateString()}</div><div className="mt-3"><Pill tone={d.status === "accepted" ? "success" : "warning"}>{d.status}</Pill></div></Panel>) : <EmptyState title="No decisions recorded" hint="Architecture decisions will appear here." />}</div></TabsContent>
      <TabsContent value="architecture" className="mt-4">{architecture.length ? <Panel bodyClassName="p-0"><ul className="divide-y divide-border">{architecture.map((a) => <li key={a.layer} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]"><span className="font-mono text-xs text-muted-foreground">{a.layer}</span><div><div className="text-sm">{a.choice}</div><p className="text-xs text-muted-foreground">{a.note}</p></div></li>)}</ul></Panel> : <EmptyState title="Architecture not drafted" hint="The Architecture stage records the system shape per layer." />}</TabsContent>
      <TabsContent value="schema" className="mt-4"><Summary title="Schema" count={schema.length} detail="Tables tracked in the generated application's Brain." /></TabsContent><TabsContent value="integrations" className="mt-4"><Summary title="Integrations" count={integrations.length} detail="Provider references with secrets redacted." /></TabsContent><TabsContent value="tests" className="mt-4"><Summary title="Tests" count={tests.length} detail="Recorded test inventory; execution is not implied." /></TabsContent><TabsContent value="history" className="mt-4"><Summary title="History" count={history.length} detail="Brain change entries retained for auditability." /></TabsContent>
    </Tabs>
  </PageBody>;
}
function Requirements({ items }: { items: typeof getProject extends never ? never : NonNullable<ReturnType<typeof getProject>>["brain"]["requirements"] }) { return items.length ? <Panel bodyClassName="p-0"><ul className="divide-y divide-border">{items.map((r) => <li key={r.id} className="space-y-1.5 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{r.title}</span><div className="flex gap-2"><Pill tone="neutral">{r.kind.replace("_", " ")}</Pill><Pill tone={r.priority === "must" ? "primary" : "neutral"}>{r.priority}</Pill><Pill tone={r.status === "implemented" ? "success" : r.status === "approved" ? "info" : "warning"}>{r.status}</Pill></div></div><p className="text-xs leading-relaxed text-muted-foreground">{r.detail}</p></li>)}</ul></Panel> : <EmptyState title="No requirements captured" hint="Run the Requirements stage to populate the brain." />; }
function Summary({ title, count, detail }: { title: string; count: number; detail: string }) { return <Panel title={`${title} section`}><div className="flex items-center gap-4"><div className="font-mono text-3xl text-primary">{count}</div><p className="text-sm text-muted-foreground">{detail}</p></div></Panel>; }
