import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkle, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageBody, PageHeader, Panel, WorkspaceShell } from "@/components/forge/shell";
import { Pill } from "@/components/forge/status";
import { STAGE_ORDER } from "@/lib/forge/data";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New project — ForgeOS" },
      {
        name: "description",
        content:
          "Describe a software idea in natural language and ForgeOS drafts requirements, architecture and a build plan.",
      },
      { property: "og:title", content: "New project — ForgeOS" },
      {
        property: "og:description",
        content: "Start a ForgeOS build from a natural-language product idea.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewProject,
});

const examples = [
  "A fuel retail operations platform with pump telemetry, shift reconciliation and loss alerts.",
  "An outpatient clinic scheduler with triage queues, clinician rotas and no-show prediction.",
  "A field service app for HVAC engineers with job dispatch, parts stock and offline reports.",
];

function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);

  return (
    <WorkspaceShell>
      <PageHeader
        title="New project"
        description="Describe the software you want. ForgeOS captures intent into a project brain, then plans the lifecycle before writing any code."
        meta={
          <>
            <Pill tone="primary">provider-agnostic</Pill>
            <Pill tone="info">plan before code</Pill>
            <Pill tone="warning">approval gates on destructive steps</Pill>
          </>
        }
      />

      <PageBody className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Panel title="Product idea" description="Natural language. Constraints welcome.">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (idea.trim().length < 20) {
                  toast.error("Describe the idea in a little more detail first.");
                  return;
                }
                toast.success("Intent captured — opening the builder on the benchmark project.");
                void navigate({ to: "/projects/$slug/builder", params: { slug: "pumpos" } });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  placeholder="e.g. PumpOS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idea">What should it do?</Label>
                <Textarea
                  id="idea"
                  rows={9}
                  className="font-mono text-[13px] leading-relaxed"
                  placeholder="Who uses it, what they need to accomplish, the rules that must hold, and anything it must integrate with."
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                />
                <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span>{idea.trim().length} chars</span>
                  <span>brain seed</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border bg-elevated/50 px-3 py-3">
                <div>
                  <div className="text-sm font-medium">Auto-approve low-risk steps</div>
                  <p className="text-xs text-muted-foreground">
                    Destructive schema, data and deploy actions always pause for a human.
                  </p>
                </div>
                <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
              </div>

              <Button type="submit" className="w-full sm:w-auto">
                <Wand2 className="size-4" />
                Draft requirements and plan
              </Button>
            </form>
          </Panel>

          <Panel title="Starting points">
            <div className="grid gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setIdea(example)}
                  className="flex items-start gap-2.5 rounded-md border border-border bg-elevated/40 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Sparkle className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {example}
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="What happens next" description="The lifecycle ForgeOS drives for every build.">
          <ol className="space-y-3">
            {STAGE_ORDER.map((stage, i) => (
              <li key={stage.id} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-border bg-elevated font-mono text-[11px] text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-medium">{stage.label}</div>
                  <p className="text-xs text-muted-foreground">{stage.blurb}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </PageBody>
    </WorkspaceShell>
  );
}
