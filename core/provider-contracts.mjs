// ForgeOS vendor-neutral provider contracts.
// Providers are capabilities, not product dependencies.
// Implementations can target Railway, AWS, GCP, local Docker/VMs, etc.

export const ProviderCapability = Object.freeze({
  AI: "ai",
  DATABASE: "database",
  STORAGE: "storage",
  BUILD: "build",
  DEPLOY: "deploy",
  SECRETS: "secrets",
  SOURCE: "source",
});

export class ForgeOSProvider {
  constructor({ id, capability }) {
    this.id = id;
    this.capability = capability;
  }

  async health() {
    return { ok: true, provider: this.id, capability: this.capability };
  }
}

export class BuildProvider extends ForgeOSProvider {
  constructor(options) { super({ ...options, capability: ProviderCapability.BUILD }); }
  async build() { throw new Error("build_provider_not_implemented"); }
}

export class DeployProvider extends ForgeOSProvider {
  constructor(options) { super({ ...options, capability: ProviderCapability.DEPLOY }); }
  async deploy() { throw new Error("deploy_provider_not_implemented"); }
}

export class AIProvider extends ForgeOSProvider {
  constructor(options) { super({ ...options, capability: ProviderCapability.AI }); }
  async generate() { throw new Error("ai_provider_not_implemented"); }
  async repair() { throw new Error("ai_repair_not_implemented"); }
}

export function providerRegistry(providers = []) {
  const map = new Map();
  for (const provider of providers) {
    if (!provider?.id || !provider?.capability) continue;
    map.set(provider.capability + ":" + provider.id, provider);
  }
  return {
    get(capability, id) { return map.get(capability + ":" + id) || null; },
    list() { return [...map.values()]; },
  };
}
