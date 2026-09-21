import { projects, providerRegistry } from "./data";
import type { Project, ProviderEntry } from "./types";

/**
 * Backend seam.
 *
 * Every screen reads project state through this contract. Today the only
 * implementation is the in-memory seeded store below; a real control-plane
 * (Neon + server functions) can implement the same interface later without
 * touching any route component.
 */
export type DataSource = "seed" | "remote";

export interface ForgeRepository {
  readonly source: DataSource;
  listProjects(): Promise<Project[]>;
  getProject(slug: string): Promise<Project | undefined>;
  listProviders(): Promise<ProviderEntry[]>;
}

export const seedRepository: ForgeRepository = {
  source: "seed",
  async listProjects() {
    return projects;
  },
  async getProject(slug: string) {
    return projects.find((project) => project.slug === slug);
  },
  async listProviders() {
    return providerRegistry;
  },
};

/** Active repository. Swap here when a real backend lands. */
export const repository: ForgeRepository = seedRepository;

/**
 * Synchronous read used by route components while the store is in-memory.
 * Keeping it separate marks exactly which call sites must become async
 * (loader + useSuspenseQuery) once `repository.source === "remote"`.
 */
export function readProjectSync(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export const isSeededData = repository.source === "seed";
