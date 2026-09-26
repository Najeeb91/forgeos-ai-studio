import assert from "node:assert/strict";
import test from "node:test";

test("benchmark demonstration of sequential vs concurrent project list fetching", async () => {
  const slugs = Array.from({ length: 10 }, (_, i) => `project-${i}`);
  const fetchDelayMs = 20;

  const mockGetRemoteProject = async (slug) => {
    await new Promise((resolve) => setTimeout(resolve, fetchDelayMs));
    return { slug, name: `Project ${slug}` };
  };

  // Baseline sequential execution
  const startSeq = performance.now();
  const seqProjects = [];
  for (const slug of slugs) {
    const project = await mockGetRemoteProject(slug);
    if (project) seqProjects.push(project);
  }
  const durationSeq = performance.now() - startSeq;

  // Optimized concurrent execution
  const startConc = performance.now();
  const concResults = await Promise.all(slugs.map((slug) => mockGetRemoteProject(slug)));
  const concProjects = concResults.filter((p) => p !== null);
  const durationConc = performance.now() - startConc;

  assert.equal(seqProjects.length, 10);
  assert.equal(concProjects.length, 10);
  assert.deepEqual(seqProjects, concProjects);

  // Concurrent execution should be significantly faster than sequential
  // Sequential: ~200ms (10 * 20ms)
  // Concurrent: ~20-30ms (max 20ms)
  assert.ok(
    durationConc < durationSeq / 3,
    `Expected concurrent duration (${durationConc.toFixed(2)}ms) to be < 1/3 of sequential duration (${durationSeq.toFixed(2)}ms)`,
  );
});
