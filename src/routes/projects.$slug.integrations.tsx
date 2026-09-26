import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, PageBody, Panel } from "@/components/forge/shell";
import { FilterBar, MetaList, ProvenanceBadge } from "@/components/forge/primitives";
import { Pill } from "@/components/forge/status";
import { integrationTone } from "@/lib/forge/tone";
import type { IntegrationRef } from "@/lib/forge/types";

export const Route = createFileRoute("/projects/$slug/integrations")({
  component: Integrations,
});

const states = ["connected", "configured", "planned", "error"] as const;
type StateFilter = "all" | IntegrationRef["status"];

function Integrations() {
  const { slug } = Route.useParams();
  const items = readProjectSync(slug)!.brain.integrations;
  const [state, setState] = useState<StateFilter>("all");

  const rows = useMemo(
    () => items.filter((item) => state === "all" || item.status === state),
    [items, state],
  );

  return (
    <PageBody>
      <Panel
        title="Integration registry"
        description="Provider contracts and connection state from Project Brain. Configuration is metadata only — secrets are never stored or displayed here."
        actions={<ProvenanceBadge kind="seeded" />}
      >
        <FilterBar
          label="state"
          value={state}
          onChange={setState}
          options={[
            { value: "all" as StateFilter, label: "all", count: items.length },
            ...states.map((value) => ({
              value: value as StateFilter,
              label: value,
              count: items.filter((item) => item.status === value).length,
            })),
          ]}
        />

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {rows.length ? (
            rows.map((item) => (
              <article key={item.id} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{item.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{item.provider}</p>
                  </div>
                  <Pill tone={integrationTone[item.status]}>{item.status}</Pill>
                </div>

                <MetaList
                  className="mt-4"
                  items={[
                    { label: "Category", value: item.category },
                    { label: "Capability", value: item.capability ?? "not recorded" },
                    { label: "Environment", value: item.environment ?? "not recorded" },
                  ]}
                />

                <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                  {item.note}
                </p>

                <div className="mt-3 flex items-center gap-2 text-[11px] text-success">
                  <ShieldCheck className="size-3.5" />
                  Credentials redacted
                  <KeyRound className="ml-auto size-3.5" />
                </div>
              </article>
            ))
          ) : (
            <div className="md:col-span-2">
              <EmptyState
                title="No integrations in this state"
                hint="Integration references are captured by the integrations stage of the pipeline."
              />
            </div>
          )}
        </div>
      </Panel>
    </PageBody>
  );
}
