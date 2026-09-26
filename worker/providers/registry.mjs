import { providerRegistry } from "../../core/provider-contracts.mjs";

export async function healthyProviders(providers) {
  const checks = [];
  for (const provider of providers) {
    try {
      const health = await provider.health();
      checks.push({ provider, health });
    } catch (error) {
      checks.push({
        provider,
        health: {
          ok: false,
          provider: provider.id,
          capability: provider.capability,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
  return checks;
}

export async function selectProvider(providers, preferredId) {
  const registry = providerRegistry(providers);
  const ordered = [];
  if (preferredId) {
    const preferred = providers.find((p) => p.id === preferredId);
    if (preferred) ordered.push(preferred);
  }
  for (const provider of providers) if (!ordered.includes(provider)) ordered.push(provider);

  const checks = await healthyProviders(ordered);
  const selected = checks.find((entry) => entry.health?.ok);
  if (!selected) {
    const detail = checks
      .map((entry) => entry.provider.id + ":" + (entry.health?.error || "unavailable"))
      .join(",");
    throw new Error("no_healthy_provider:" + detail);
  }
  return {
    provider: selected.provider,
    health: selected.health,
    checks,
    registry,
    candidates: checks
      .filter((entry) => entry.health?.ok)
      .map((entry) => ({ provider: entry.provider, health: entry.health })),
  };
}
