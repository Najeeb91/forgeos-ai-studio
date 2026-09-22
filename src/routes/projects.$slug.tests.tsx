import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3, FlaskConical, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { PageBody, Panel } from "@/components/forge/shell";
import { DataTable, FilterBar, ProvenanceBadge, StatGrid } from "@/components/forge/primitives";
import { Pill } from "@/components/forge/status";
import { useForgeProject } from "@/lib/forge/use-project";
import { testTone } from "@/lib/forge/tone";
import type { TestCase } from "@/lib/forge/types";

export const Route = createFileRoute("/projects/$slug/tests")({
  component: Tests,
});

const icons = {
  passing: CheckCircle2,
  failing: XCircle,
  skipped: Clock3,
  flaky: FlaskConical,
} as const;

const statuses = ["passing", "failing", "skipped", "flaky"] as const;
const suites = ["unit", "integration", "e2e", "security"] as const;

type StatusFilter = "all" | TestCase["status"];
type SuiteFilter = "all" | TestCase["suite"];

function Tests() {
  const { slug } = Route.useParams();
  const project = useForgeProject();
  const tests = project.brain.tests;

  const [status, setStatus] = useState<StatusFilter>("all");
  const [suite, setSuite] = useState<SuiteFilter>("all");

  const rows = useMemo(
    () =>
      tests.filter(
        (test) => (status === "all" || test.status === status) && (suite === "all" || test.suite === suite),
      ),
    [status, suite, tests],
  );

  return (
    <PageBody>
      <Panel
        title="Test control room"
        description="Test inventory and outcomes recorded in Project Brain. ForgeOS does not execute these tests yet — no runner is attached."
        actions={<ProvenanceBadge kind="seeded">seeded results · not executed</ProvenanceBadge>}
      >
        <StatGrid
          stats={statuses.map((value) => ({
            label: value,
            value: tests.filter((test) => test.status === value).length,
          }))}
        />

        <div className="mt-5 flex flex-col gap-2">
          <FilterBar
            label="status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all" as StatusFilter, label: "all", count: tests.length },
              ...statuses.map((value) => ({
                value: value as StatusFilter,
                label: value,
                count: tests.filter((test) => test.status === value).length,
              })),
            ]}
          />
          <FilterBar
            label="suite"
            value={suite}
            onChange={setSuite}
            options={[
              { value: "all" as SuiteFilter, label: "all" },
              ...suites.map((value) => ({
                value: value as SuiteFilter,
                label: value,
                count: tests.filter((test) => test.suite === value).length,
              })),
            ]}
          />
        </div>

        <div className="mt-4">
          <DataTable
            rows={rows}
            rowKey={(test) => test.id}
            empty="No tests match these filters."
            columns={[
              {
                key: "name",
                header: "Test",
                cell: (test) => {
                  const Icon = icons[test.status];
                  return (
                    <span className="flex items-center gap-2 font-medium">
                      <Icon
                        className={`size-3.5 ${
                          test.status === "passing"
                            ? "text-success"
                            : test.status === "failing"
                              ? "text-destructive"
                              : "text-warning"
                        }`}
                      />
                      {test.name}
                    </span>
                  );
                },
              },
              { key: "suite", header: "Suite", cell: (test) => <Pill tone="neutral">{test.suite}</Pill> },
              {
                key: "status",
                header: "Status",
                cell: (test) => <Pill tone={testTone[test.status]}>{test.status}</Pill>,
              },
              {
                key: "duration",
                header: "Duration",
                className: "font-mono",
                cell: (test) => `${test.durationMs} ms`,
              },
              {
                key: "detail",
                header: "Failure detail",
                className: "max-w-sm text-muted-foreground",
                cell: (test) => test.detail ?? "—",
              },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Execution boundary">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Verified state requires a real runner (sandboxed execution or CI adapter). Until one is
          attached, every row above is seeded project data, and ForgeOS will not report a test run as
          passing or failing in reality.
        </p>
      </Panel>
    </PageBody>
  );
}
