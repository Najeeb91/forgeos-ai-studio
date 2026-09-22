import { createServerFn } from "@tanstack/react-start";
import { projects as seedProjects } from "./data";
import { getProjectFromWorker } from "./worker-client";
import { listForgeProviders as listConfiguredProviders } from "./provider-routing";

export const getForgeProject = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const seed = seedProjects.find((p) => p.slug === slug);
    try {
      const remote = await getProjectFromWorker(slug);
      if (remote?.project) return { project: { ...seed, ...remote.project, brain: remote.project.brain ?? seed.brain } as typeof seed, source: "remote" as const };
    } catch {}
    return seed ? { project: seed, source: "seed" as const } : null;
  });

export const listForgeProjects = createServerFn({ method: "GET" }).handler(async () => {
  const results = await Promise.all(seedProjects.map(async (seed) => {
    try {
      const remote = await getProjectFromWorker(seed.slug);
      return remote?.project ? ({ ...seed, ...remote.project, brain: remote.project.brain ?? seed.brain } as typeof seed) : seed;
    } catch { return seed; }
  }));
  return { projects: results, source: results.some((p, i) => p !== seedProjects[i]) ? "remote" as const : "seed" as const };
});

export const listForgeProviders = createServerFn({ method: "GET" }).handler(async () => ({
  providers: listConfiguredProviders(),
  source: "seed" as const,
}));
