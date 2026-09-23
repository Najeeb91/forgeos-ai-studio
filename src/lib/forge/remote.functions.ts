import { createServerFn } from "@tanstack/react-start";
import { projects as seedProjects } from "./data";
import { createForgeProject as createForgeProjectWorker, getProjectFromWorker, listProjectsFromWorker } from "./worker-client";
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
  try {
    const remote = await listProjectsFromWorker();
    const bySlug = new Map(remote.map((project) => [project.slug, project]));
    const mergedSeeds = seedProjects.map((seed) => ({ ...seed, ...(bySlug.get(seed.slug) ?? {}), brain: bySlug.get(seed.slug)?.brain ?? seed.brain }));
    const remoteOnly = remote.filter((project) => !seedProjects.some((seed) => seed.slug === project.slug));
    return { projects: [...mergedSeeds, ...remoteOnly], source: "remote" as const };
  } catch {
    return { projects: seedProjects, source: "seed" as const };
  }
});

export const listForgeProviders = createServerFn({ method: "GET" }).handler(async () => ({
  providers: listConfiguredProviders(),
  source: "seed" as const,
}));

export const createForgeProjectRemote = createServerFn({ method: "POST" })
  .validator((data: { slug: string; name: string; prompt: string }) => data)
  .handler(async ({ data }) => createForgeProjectWorker(data));
