import { eq } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";
import { db } from "./index";
import {
  projects,
  projectBrainVersions,
  pipelineStages,
  sourceSnapshots,
  sourceFiles,
  aiRuns,
  aiRunSteps,
  aiEvents,
  deployments,
  testRuns,
  testResults,
  auditEvents,
} from "./schema";
import { getProject } from "@/lib/forge/data";

async function runSeed() {
  if (!db) {
    console.error("No database connection available to seed.");
    process.exit(1);
  }

  console.log("Seeding database from mock data...");

  // Seed the PumpOS project
  const mockProject = getProject("pump-os");
  if (!mockProject) {
    console.error("Mock project pump-os not found.");
    process.exit(1);
  }

  // 1. Project (Idempotent)
  const [project] = await db
    .insert(projects)
    .values({
      slug: mockProject.slug,
      name: mockProject.name,
      tagline: mockProject.tagline,
      description: mockProject.description,
      status: mockProject.status,
      health: mockProject.health,
      owner: mockProject.owner,
      stack: mockProject.stack,
      benchmark: mockProject.benchmark ?? false,
      previewRoute: mockProject.preview.route,
      previewStatus: mockProject.preview.status,
      previewLastBuiltAt: new Date(mockProject.preview.lastBuiltAt),
    })
    .onConflictDoUpdate({
      target: projects.slug,
      set: {
        name: mockProject.name,
        tagline: mockProject.tagline,
        description: mockProject.description,
        status: mockProject.status,
        health: mockProject.health,
        owner: mockProject.owner,
        stack: mockProject.stack,
        previewRoute: mockProject.preview.route,
        previewStatus: mockProject.preview.status,
      },
    })
    .returning();

  console.log(`Upserted project ${project?.slug} with ID ${project?.id}`);

  if (!project || !project.id) {
    console.error("Failed to upsert project.");
    process.exit(1);
  }

  // UUID namespace for deterministic seed generation
  const SEED_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";

  // 2. Project Brain
  const brainVersionId = uuidv5(`brain-${project.id}-1`, SEED_NAMESPACE);
  await db
    .insert(projectBrainVersions)
    .values({
      id: brainVersionId,
      projectId: project.id,
      version: 1,
      vision: mockProject.brain.vision,
      requirements: mockProject.brain.requirements,
      decisions: mockProject.brain.decisions,
      architecture: mockProject.brain.architecture,
      schema: mockProject.brain.schema,
      integrations: mockProject.brain.integrations,
    })
    .onConflictDoUpdate({
      target: projectBrainVersions.id,
      set: {
        vision: mockProject.brain.vision,
        requirements: mockProject.brain.requirements,
        decisions: mockProject.brain.decisions,
        architecture: mockProject.brain.architecture,
        schema: mockProject.brain.schema,
        integrations: mockProject.brain.integrations,
      },
    });
  console.log("Upserted project brain version 1.");

  // 3. Pipeline Stages
  for (const stage of mockProject.stages) {
    const stageId = uuidv5(`stage-${project.id}-${stage.id}`, SEED_NAMESPACE);
    await db
      .insert(pipelineStages)
      .values({
        id: stageId,
        projectId: project.id,
        stageId: stage.id,
        label: stage.label,
        status: stage.status,
        summary: stage.summary,
        progress: stage.progress,
        updatedAt: new Date(stage.updatedAt),
      })
      .onConflictDoUpdate({
        target: pipelineStages.id,
        set: {
          label: stage.label,
          status: stage.status,
          summary: stage.summary,
          progress: stage.progress,
          updatedAt: new Date(stage.updatedAt),
        },
      });
  }
  console.log(`Upserted ${mockProject.stages.length} pipeline stages.`);

  // 4. AI Runs
  for (const run of mockProject.runs) {
    const runId = uuidv5(`run-${project.id}-${run.id}`, SEED_NAMESPACE);
    const [insertedRun] = await db
      .insert(aiRuns)
      .values({
        id: runId,
        projectId: project.id,
        prompt: run.prompt,
        provider: run.provider,
        model: run.model,
        status: run.status,
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
        startedAt: new Date(run.startedAt),
      })
      .onConflictDoUpdate({
        target: aiRuns.id,
        set: {
          prompt: run.prompt,
          provider: run.provider,
          model: run.model,
          status: run.status,
          tokensIn: run.tokensIn,
          tokensOut: run.tokensOut,
        },
      })
      .returning();

    if (insertedRun && insertedRun.id) {
      for (let i = 0; i < run.plan.length; i++) {
        const step = run.plan[i];
        if (step) {
          const stepId = uuidv5(`runstep-${insertedRun.id}-${step.id}`, SEED_NAMESPACE);
          await db
            .insert(aiRunSteps)
            .values({
              id: stepId,
              runId: insertedRun.id,
              title: step.title,
              detail: step.detail,
              stage: step.stage,
              risk: step.risk,
              status: step.status,
              orderIdx: i,
            })
            .onConflictDoNothing();
        }
      }

      for (const event of run.events) {
        const eventId = uuidv5(`runevent-${insertedRun.id}-${event.id}`, SEED_NAMESPACE);
        await db
          .insert(aiEvents)
          .values({
            id: eventId,
            runId: insertedRun.id,
            level: event.level,
            stage: event.stage,
            message: event.message,
            createdAt: new Date(event.at),
          })
          .onConflictDoNothing();
      }
    }
  }
  console.log(`Upserted ${mockProject.runs.length} AI runs.`);

  // 5. Source Snapshots & Files
  const snapshotId = uuidv5(`snapshot-${project.id}-seed`, SEED_NAMESPACE);
  const [snapshot] = await db
    .insert(sourceSnapshots)
    .values({
      id: snapshotId,
      projectId: project.id,
      commitSha: "seed",
      message: "Seeded initial state",
    })
    .onConflictDoNothing()
    .returning();

  // Helper to recursively insert files
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function insertFiles(nodes: any[]) {
    // Note: since snapshot inserts onConflictDoNothing, `snapshot` will be undefined
    // on subsequent runs if the snapshot already existed, ensuring we don't duplicate files.
    if (!snapshot || !snapshot.id) return;

    for (const node of nodes) {
      await db!
        .insert(sourceFiles)
        .values({
          id: uuidv5(`file-${snapshot.id}-${node.path}`, SEED_NAMESPACE),
          snapshotId: snapshot.id,
          path: node.path,
          kind: node.kind,
          language: node.language,
          loc: node.loc,
          status: node.status,
          content: node.content,
        })
        .onConflictDoNothing();
      if (node.children) {
        await insertFiles(node.children);
      }
    }
  }
  if (mockProject && mockProject.files) {
    await insertFiles(mockProject.files);
  }
  console.log("Upserted mock source files.");

  // 6. Test Runs & Results
  // We use deterministic IDs to avoid spamming the DB on re-runs.
  const testRunId = uuidv5(`testrun-${project.id}-seed`, SEED_NAMESPACE);
  const [testRun] = await db
    .insert(testRuns)
    .values({
      id: testRunId,
      projectId: project.id,
      snapshotId: snapshotId, // Note: using generated ID since snapshot might be undefined on re-run
      status: "completed",
    })
    .onConflictDoUpdate({
      target: testRuns.id,
      set: { status: "completed" },
    })
    .returning();

  if (testRun && testRun.id) {
    for (const test of mockProject.brain.tests) {
      const testResultId = uuidv5(`testresult-${testRun.id}-${test.id}`, SEED_NAMESPACE);
      await db
        .insert(testResults)
        .values({
          id: testResultId,
          testRunId: testRun.id,
          name: test.name,
          suite: test.suite,
          status: test.status,
          durationMs: test.durationMs,
          detail: test.detail,
        })
        .onConflictDoUpdate({
          target: testResults.id,
          set: {
            status: test.status,
            durationMs: test.durationMs,
            detail: test.detail,
          },
        });
    }
  }
  console.log("Upserted test results.");

  // 7. Deployments
  for (const dep of mockProject.deployments) {
    const depId = uuidv5(`dep-${project.id}-${dep.id}`, SEED_NAMESPACE);
    await db
      .insert(deployments)
      .values({
        id: depId,
        projectId: project.id,
        env: dep.env,
        status: dep.status,
        commitSha: dep.commit,
        url: dep.url,
        adapter: dep.adapter,
        createdAt: new Date(dep.at),
      })
      .onConflictDoUpdate({
        target: deployments.id,
        set: {
          status: dep.status,
          commitSha: dep.commit,
          url: dep.url,
        },
      });
  }
  console.log("Upserted deployments.");

  // 8. Audit Events
  for (const entry of mockProject.brain.history) {
    const auditId = uuidv5(`audit-${project.id}-${entry.id}`, SEED_NAMESPACE);
    await db
      .insert(auditEvents)
      .values({
        id: auditId,
        projectId: project.id,
        actor: entry.actor,
        actorName: entry.actorName,
        action: entry.action,
        target: entry.target,
        risk: entry.risk,
        approved: entry.approved,
        diffSummary: entry.diffSummary,
        stage: entry.stage,
        createdAt: new Date(entry.at),
      })
      .onConflictDoNothing(); // Audit events are immutable history
  }
  console.log("Upserted audit events.");

  console.log("Seeding complete.");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
