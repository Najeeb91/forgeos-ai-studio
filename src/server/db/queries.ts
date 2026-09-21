import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../db/index";
import {
  projects,
  projectBrainVersions,
  pipelineStages,
  aiRuns,
  aiRunSteps,
  aiEvents,
  sourceSnapshots,
  sourceFiles,
  deployments,
  testRuns,
  testResults,
  auditEvents,
  approvals,
} from "../db/schema";
import type { Project, ProjectBrain } from "@/lib/forge/types";
import { mapProject } from "./mapper";

export async function listProjects() {
  if (!db) return null;
  return await db.select().from(projects);
}

export async function getProjectBySlug(slug: string) {
  if (!db) return null;
  const projectRows = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);

  if (projectRows.length === 0) return null;
  return projectRows[0];
}

export async function getFullProject(slug: string): Promise<Project | null> {
  if (!db) return null;

  const projectRow = await getProjectBySlug(slug);
  if (!projectRow) return null;

  const projectId = projectRow.id;

  // Fetch all related entities
  const [stagesRows, brainRow, runsRows, deploymentsRows, snapshotsRows, auditEventsRows] =
    await Promise.all([
      db.select().from(pipelineStages).where(eq(pipelineStages.projectId, projectId)),
      getLatestProjectBrain(projectId),
      db.select().from(aiRuns).where(eq(aiRuns.projectId, projectId)),
      db.select().from(deployments).where(eq(deployments.projectId, projectId)),
      db
        .select()
        .from(sourceSnapshots)
        .where(eq(sourceSnapshots.projectId, projectId))
        .orderBy(desc(sourceSnapshots.createdAt))
        .limit(1),
      db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.projectId, projectId))
        .orderBy(desc(auditEvents.createdAt)),
    ]);

  const runIds = runsRows.map((r) => r.id);
  const [runsStepsRows, runsEventsRows] = await Promise.all([
    runIds.length
      ? db.select().from(aiRunSteps).where(inArray(aiRunSteps.runId, runIds))
      : Promise.resolve([]),
    runIds.length
      ? db.select().from(aiEvents).where(inArray(aiEvents.runId, runIds))
      : Promise.resolve([]),
  ]);

  const stepIds = runsStepsRows.map((s) => s.id);
  const approvalsRows =
    stepIds.length > 0
      ? await db.select().from(approvals).where(inArray(approvals.stepId, stepIds))
      : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filesRows: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testsRows: any[] = [];

  if (snapshotsRows.length > 0 && snapshotsRows[0]) {
    const snapshotId = snapshotsRows[0].id;
    filesRows = await db.select().from(sourceFiles).where(eq(sourceFiles.snapshotId, snapshotId));

    const trs = await db
      .select()
      .from(testRuns)
      .where(eq(testRuns.snapshotId, snapshotId))
      .limit(1);
    if (trs.length > 0 && trs[0]) {
      testsRows = await db.select().from(testResults).where(eq(testResults.testRunId, trs[0].id));
    }
  }

  return mapProject(
    projectRow,
    stagesRows,
    brainRow,
    runsRows,
    runsStepsRows,
    runsEventsRows,
    filesRows,
    deploymentsRows,
    testsRows,
    auditEventsRows,
    approvalsRows,
  );
}

export async function getAllFullProjects(): Promise<Project[] | null> {
  if (!db) return null;
  const allProjects = await listProjects();
  if (!allProjects) return null;

  // Ideally we would do a more efficient bulk query here if project count is high.
  // For now we map sequentially since this is control-plane data.
  const mapped: Project[] = [];
  for (const p of allProjects) {
    const full = await getFullProject(p.slug);
    if (full) mapped.push(full);
  }
  return mapped;
}

export async function createProject(data: typeof projects.$inferInsert) {
  if (!db) return null;
  const inserted = await db.insert(projects).values(data).returning();
  return inserted[0];
}

export async function updateProjectMetadata(
  slug: string,
  data: Partial<typeof projects.$inferInsert>,
) {
  if (!db) return null;
  const updated = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.slug, slug))
    .returning();
  return updated[0];
}

export async function getLatestProjectBrain(projectId: string) {
  if (!db) return null;
  const versions = await db
    .select()
    .from(projectBrainVersions)
    .where(eq(projectBrainVersions.projectId, projectId))
    .orderBy(desc(projectBrainVersions.version))
    .limit(1);

  if (versions.length === 0) return null;
  return versions[0];
}
