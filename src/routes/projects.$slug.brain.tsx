import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, PageBody, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForgeProject } from "@/lib/forge/use-project";
import type {
  ChangeEntry,
  Decision,
  IntegrationRef,
  Requirement,
  SchemaTable,
  TestCase,
} from "@/lib/forge/types";

export const Route = createFileRoute("/projects/$slug/brain")({
  component: Brain,
});

function BrainRequirementsTab({ requirements }: { requirements: Requirement[] }) {
  if (!requirements.length) {
    return (
      <EmptyState
        title="No requirements captured"
        hint="The requirements stage will populate durable product constraints here."
      />
    );
  }

  return (
    <Panel bodyClassName="p-0">
      <ul className="divide-y divide-border">
        {requirements.map((item) => (
          <li key={item.id} className="space-y-1.5 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{item.title}</span>
              <div className="flex flex-wrap gap-2">
                <Pill tone="neutral">{item.kind.replace("_", " ")}</Pill>
                <Pill tone={item.priority === "must" ? "primary" : "neutral"}>{item.priority}</Pill>
                <Pill
                  tone={
                    item.status === "implemented"
                      ? "success"
                      : item.status === "approved"
                        ? "info"
                        : "warning"
                  }
                >
                  {item.status}
                </Pill>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function BrainDecisionsTab({ decisions }: { decisions: Decision[] }) {
  if (!decisions.length) {
    return (
      <EmptyState
        title="No decisions recorded"
        hint="Architecture decisions are written here with rationale and trade-offs."
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {decisions.map((decision) => (
        <Panel key={decision.id} title={decision.title}>
          <p className="text-xs leading-relaxed text-muted-foreground">{decision.rationale}</p>
          <div className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
            <div>alternatives: {decision.alternatives.join(" · ")}</div>
            <div>decided: {new Date(decision.decidedAt).toLocaleDateString()}</div>
          </div>
          <div className="mt-3">
            <Pill tone={decision.status === "accepted" ? "success" : "warning"}>
              {decision.status}
            </Pill>
          </div>
        </Panel>
      ))}
    </div>
  );
}

interface ArchitectureItem {
  layer: string;
  choice: string;
  note: string;
}

function BrainArchitectureTab({ architecture }: { architecture: ArchitectureItem[] }) {
  if (!architecture.length) {
    return (
      <EmptyState
        title="Architecture not drafted"
        hint="The architecture layer records the system shape."
      />
    );
  }

  return (
    <Panel bodyClassName="p-0">
      <ul className="divide-y divide-border">
        {architecture.map((item) => (
          <li key={item.layer} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
            <span className="font-mono text-xs text-muted-foreground">{item.layer}</span>
            <div>
              <div className="text-sm">{item.choice}</div>
              <p className="text-xs text-muted-foreground">{item.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function BrainSchemaTab({ schema }: { schema: SchemaTable[] }) {
  if (!schema.length) {
    return (
      <EmptyState
        title="No schema captured"
        hint="This project does not yet have a generated schema in the brain."
      />
    );
  }

  return (
    <div className="space-y-4">
      {schema.map((table) => (
        <Panel key={table.name} title={table.name} description={table.purpose}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Nullability</th>
                  <th className="px-3 py-2 font-medium">Key / relationship</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {table.columns.map((column) => (
                  <tr key={`${table.name}-${column.name}`}>
                    <td className="px-3 py-2 font-mono">{column.name}</td>
                    <td className="px-3 py-2 font-mono text-info">{column.type}</td>
                    <td className="px-3 py-2">{column.nullable ? "nullable" : "not null"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {column.key ? column.key : column.references ? column.references : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{column.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">RLS:</span>
            <span>{table.rls}</span>
            {table.indexes && table.indexes.length ? (
              <>
                <span className="font-medium text-foreground">Index(es):</span>
                <span>{table.indexes.join(" · ")}</span>
              </>
            ) : null}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function BrainIntegrationsTab({ integrations }: { integrations: IntegrationRef[] }) {
  if (!integrations.length) {
    return (
      <EmptyState
        title="No integrations captured"
        hint="Integration references recorded here will show provider status and notes."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {integrations.map((item) => (
        <Panel key={item.id} title={item.name}>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Provider</span>
              <span>{item.provider}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Category</span>
              <span>{item.category}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Capability</span>
              <span>{item.capability ?? "not recorded"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Environment</span>
              <span>{item.environment ?? "not recorded"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <Pill
                tone={
                  item.status === "connected"
                    ? "success"
                    : item.status === "configured"
                      ? "info"
                      : item.status === "error"
                        ? "danger"
                        : "warning"
                }
              >
                {item.status}
              </Pill>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{item.note}</p>
        </Panel>
      ))}
    </div>
  );
}

function BrainTestsTab({ tests }: { tests: TestCase[] }) {
  if (!tests.length) {
    return (
      <EmptyState
        title="No tests captured"
        hint="The test stage stores suites and test status for the project."
      />
    );
  }

  return (
    <Panel bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Test</th>
              <th className="px-3 py-2 font-medium">Suite</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Duration</th>
              <th className="px-3 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tests.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2">{item.suite}</td>
                <td className="px-3 py-2">
                  <Pill
                    tone={
                      item.status === "passing"
                        ? "success"
                        : item.status === "failing"
                          ? "danger"
                          : item.status === "flaky"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {item.status}
                  </Pill>
                </td>
                <td className="px-3 py-2 font-mono">{item.durationMs} ms</td>
                <td className="px-3 py-2 text-muted-foreground">{item.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function BrainHistoryTab({ history }: { history: ChangeEntry[] }) {
  if (!history.length) {
    return (
      <EmptyState
        title="No history recorded"
        hint="Project Brain history will accumulate AI and human actions here."
      />
    );
  }

  return (
    <Panel bodyClassName="p-0">
      <div className="space-y-0">
        {history.map((item) => (
          <div key={item.id} className="border-b border-border px-4 py-3 last:border-0">
            <div className="flex flex-wrap items-center gap-2">
              <time className="font-mono text-[11px] text-muted-foreground">
                {new Date(item.at).toLocaleString()}
              </time>
              <Pill tone="neutral">{item.actor}</Pill>
              {item.stage ? <Pill tone="info">{item.stage}</Pill> : null}
              <Pill
                tone={
                  item.risk === "high" ? "danger" : item.risk === "medium" ? "warning" : "neutral"
                }
              >
                risk: {item.risk}
              </Pill>
            </div>
            <div className="mt-2 text-sm font-medium">{item.action}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              target: {item.target}
              {item.diffSummary ? ` · ${item.diffSummary}` : ""}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Brain() {
  const project = useForgeProject();
  const { requirements, decisions, architecture, schema, integrations, tests, history } =
    project.brain;

  return (
    <PageBody>
      <Panel title="Project brain" description="Durable knowledge that survives every AI run.">
        <p className="text-sm leading-relaxed text-muted-foreground">{project.brain.vision}</p>
      </Panel>

      <Tabs defaultValue="requirements">
        <TabsList className="flex-wrap">
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="architecture">Architecture</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="mt-4">
          <BrainRequirementsTab requirements={requirements} />
        </TabsContent>

        <TabsContent value="decisions" className="mt-4">
          <BrainDecisionsTab decisions={decisions} />
        </TabsContent>

        <TabsContent value="architecture" className="mt-4">
          <BrainArchitectureTab architecture={architecture} />
        </TabsContent>

        <TabsContent value="schema" className="mt-4">
          <BrainSchemaTab schema={schema} />
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <BrainIntegrationsTab integrations={integrations} />
        </TabsContent>

        <TabsContent value="tests" className="mt-4">
          <BrainTestsTab tests={tests} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <BrainHistoryTab history={history} />
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
