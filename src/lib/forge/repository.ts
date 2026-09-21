import { createServerFn } from "@tanstack/react-start";
import { getProject as getMockProject, projects as mockProjects } from "@/lib/forge/data";
import type { Project } from "@/lib/forge/types";

export type DataSource = "seed" | "remote";

export type ProjectResponse = {
  project: Project;
  source: DataSource;
};

export type ProjectsResponse = {
  projects: Project[];
  source: DataSource;
};

export const getForgeProject = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<ProjectResponse | null> => {
    try {
      const { checkDatabaseReadiness } = await import("@/server/db/index");
      const isDbReady = await checkDatabaseReadiness();

      if (isDbReady) {
        const { getFullProject } = await import("@/server/db/queries");
        const project = await getFullProject(slug);
        if (project) {
          return { project, source: "remote" as DataSource };
        }
      }
    } catch (err) {
      // Explicit fallback handling below
    }

    // Explicit and observable fallback to seed data
    const project = getMockProject(slug);
    if (!project) return null;
    return { project, source: "seed" as DataSource };
  });

export const listForgeProjects = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProjectsResponse> => {
    try {
      const { checkDatabaseReadiness } = await import("@/server/db/index");
      const isDbReady = await checkDatabaseReadiness();

      if (isDbReady) {
        const { getAllFullProjects } = await import("@/server/db/queries");
        const projects = await getAllFullProjects();
        if (projects && projects.length > 0) {
          return { projects, source: "remote" as DataSource };
        }
      }
    } catch (err) {
      // Explicit fallback handling below
    }

    return { projects: mockProjects, source: "seed" as DataSource };
  },
);
