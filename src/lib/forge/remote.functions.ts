import { createServerFn } from "@tanstack/react-start";
import { projects as seedProjects, providerRegistry } from "./data";
import { getRemoteProject, listRemoteProjects } from "@/server/db/repository";

export const getForgeProject = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    try { const project = await getRemoteProject(slug); if (project) return { project, source: "remote" as const }; } catch {}
    const project = seedProjects.find((p) => p.slug === slug);
    return project ? { project, source: "seed" as const } : null;
  });

export const listForgeProjects = createServerFn({ method: "GET" }).handler(async () => {
  try { const projects = await listRemoteProjects(); if (projects?.length) return { projects, source: "remote" as const }; } catch {}
  return { projects: seedProjects, source: "seed" as const };
});

export const listForgeProviders = createServerFn({ method: "GET" }).handler(async () => ({ providers: providerRegistry, source: "seed" as const }));
