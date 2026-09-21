import type { Project, ProjectBrain, Stage, AiRun, FileNode, Deployment } from "@/lib/forge/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapProject(
  projectRow: any,
  stagesRows: any[],
  brainRow: any | undefined,
  runsRows: any[],
  runsStepsRows: any[],
  runsEventsRows: any[],
  filesRows: any[],
  deploymentsRows: any[],
  testsRows: any[],
  auditEventsRows: any[],
  approvalsRows: any[],
): Project {
  // Map stages
  const stages: Stage[] = stagesRows.map((s) => ({
    id: s.stageId,
    label: s.label,
    status: s.status,
    summary: s.summary,
    progress: s.progress,
    updatedAt: s.updatedAt.toISOString(),
  }));

  // Map AI Runs
  const runs: AiRun[] = runsRows.map((r) => {
    const runSteps = runsStepsRows
      .filter((s) => s.runId === r.id)
      .sort((a, b) => a.orderIdx - b.orderIdx);
    const runEvents = runsEventsRows.filter((e) => e.runId === r.id);

    return {
      id: r.id,
      prompt: r.prompt,
      provider: r.provider,
      model: r.model,
      status: r.status,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      startedAt: r.startedAt.toISOString(),
      plan: runSteps.map((s) => {
        const approval = approvalsRows.find((a) => a.stepId === s.id);
        return {
          id: s.id,
          title: s.title,
          detail: s.detail,
          stage: s.stage,
          risk: s.risk,
          status: s.status,
          decision: approval?.decision, // If approvals were loaded on the step
        };
      }),
      events: runEvents.map((e) => ({
        id: e.id,
        at: e.createdAt.toISOString(),
        level: e.level,
        stage: e.stage,
        message: e.message,
      })),
    };
  });

  // Map files (reconstructing the tree structure from flat rows)
  const files = buildFileTree(filesRows);

  // Map deployments
  const deployments: Deployment[] = deploymentsRows.map((d) => ({
    id: d.id,
    env: d.env,
    status: d.status,
    commit: d.commitSha,
    url: d.url,
    at: d.createdAt.toISOString(),
    adapter: d.adapter,
  }));

  // Construct the ProjectBrain
  const brain: ProjectBrain = {
    vision: brainRow?.vision ?? "",
    requirements: brainRow?.requirements ?? [],
    decisions: brainRow?.decisions ?? [],
    architecture: brainRow?.architecture ?? [],
    schema: brainRow?.schema ?? [],
    integrations: brainRow?.integrations ?? [],
    tests: testsRows.map((t) => ({
      id: t.id,
      name: t.name,
      suite: t.suite,
      status: t.status,
      durationMs: t.durationMs,
      detail: t.detail,
    })),
    history: auditEventsRows.map((a) => ({
      id: a.id,
      at: a.createdAt.toISOString(),
      actor: a.actor,
      actorName: a.actorName,
      action: a.action,
      target: a.target,
      risk: a.risk,
      approved: a.approved,
      diffSummary: a.diffSummary,
      stage: a.stage,
    })),
  };

  return {
    id: projectRow.id,
    slug: projectRow.slug,
    name: projectRow.name,
    tagline: projectRow.tagline,
    description: projectRow.description,
    status: projectRow.status as any,
    health: projectRow.health as any,
    createdAt: projectRow.createdAt.toISOString(),
    updatedAt: projectRow.updatedAt.toISOString(),
    owner: projectRow.owner,
    stack: projectRow.stack,
    benchmark: projectRow.benchmark,
    stages,
    brain,
    files,
    deployments,
    runs,
    preview: {
      route: projectRow.previewRoute ?? "",
      status: (projectRow.previewStatus as any) ?? "cold",
      lastBuiltAt: projectRow.previewLastBuiltAt?.toISOString() ?? "",
    },
  };
}

// Simple helper to reconstruct file tree if we flatten it.
// For demo seeds we only map root or nested, assuming `path` uniquely identifies it.
function buildFileTree(flatFiles: any[]): FileNode[] {
  const rootNodes: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  // Create all nodes first
  for (const f of flatFiles) {
    const node: FileNode = {
      path: f.path,
      kind: f.kind,
      language: f.language,
      loc: f.loc,
      status: f.status,
      content: f.content,
    };
    if (f.kind === "dir") {
      node.children = [];
    }
    nodeMap.set(f.path, node);
  }

  // Assign children based on path structure
  for (const [path, node] of nodeMap) {
    // Find parent path. e.g. "src/components/button.tsx" -> "src/components"
    const parts = path.split("/");
    if (parts.length === 1) {
      rootNodes.push(node);
    } else {
      parts.pop();
      const parentPath = parts.join("/");
      const parent = nodeMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      } else {
        // If parent doesn't exist in map, treat as root for safety
        rootNodes.push(node);
      }
    }
  }

  return rootNodes;
}
