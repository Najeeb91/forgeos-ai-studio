import { deployVercel } from "../deployment-core.mjs";

export class VercelDeployProvider {
  constructor() {
    this.id = "vercel";
    this.capability = "deploy";
  }

  async health() {
    return {
      ok: Boolean(process.env.VERCEL_TOKEN),
      provider: this.id,
      capability: this.capability,
      configured: Boolean(process.env.VERCEL_TOKEN),
      realExecution: Boolean(process.env.VERCEL_TOKEN),
    };
  }

  async deploy({ token, projectName, files, environment = "production" }) {
    return deployVercel({ token, projectName, files, environment });
  }
}

export function createDeployProviders() {
  return [new VercelDeployProvider()];
}

export function createDeployProvider() {
  const provider = process.env.FORGEOS_DEPLOY_PROVIDER || "vercel";
  if (provider === "vercel") return new VercelDeployProvider();
  throw new Error("unsupported_deploy_provider:" + provider);
}
