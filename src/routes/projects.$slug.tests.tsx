import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3, FlaskConical, XCircle } from "lucide-react";

import { PageBody, Panel } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { Route as parentRoute } from "./projects.$slug";

export const Route = createFileRoute("/projects/$slug/tests")({
  component: Tests,
});

const icons = {
  passing: CheckCircle2,
  failing: XCircle,
  skipped: Clock3,
  flaky: FlaskConical,
} as const;

function Tests() {
  const { project } = parentRoute.useLoaderData();
  const tests = project.brain.tests;

  return (
    <PageBody>
      <Panel
        title="Test control room"
        description="Seeded test inventory and outcomes. This workspace does not execute real tests."
        actions={<Pill tone="warning">demo / seeded results</Pill>}
      >
        <div className="grid gap-3 sm:grid-cols-4">
          {(["passing", "failing", "skipped", "flaky"] as const).map((status) => (
            <div key={status} className="rounded-md border border-border p-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {status}
              </div>
              <div className="mt-1 font-mono text-xl">
                {tests.filter((item) => item.status === status).length}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Test</th>
                <th className="px-3 py-2 font-medium">Suite</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Failure detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tests.length ? (
                tests.map((test) => {
                  const Icon = icons[test.status];

                  return (
                    <tr key={test.id}>
                      <td className="px-3 py-3 font-medium">
                        <span className="flex items-center gap-2">
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
                      </td>
                      <td className="px-3 py-3">
                        <Pill tone="neutral">{test.suite}</Pill>
                      </td>
                      <td className="px-3 py-3">{test.status}</td>
                      <td className="px-3 py-3 font-mono">{test.durationMs} ms</td>
                      <td className="max-w-sm px-3 py-3 text-muted-foreground">
                        {test.detail ?? "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground" colSpan={5}>
                    No tests captured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageBody>
  );
}
