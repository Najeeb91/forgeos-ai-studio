import { deployVercel } from "../deployment-core.mjs";
import { createNetlifyDeployProvider } from "./netlify-deploy-provider.mjs";

export class VercelDeployProvider {
  constructor(secretsProvider=null) {
    this.id = "vercel";
    this.capability = "deploy";
    this.secrets = secretsProvider;
  }

  async health() {
    return {
      ok: Boolean(this.secrets ? await this.secrets.get("VERCEL_TOKEN") : process.env.VERCEL_TOKEN),
      provider: this.id,
      capability: this.capability,
      configured: Boolean(this.secrets ? await this.secrets.get("VERCEL_TOKEN") : process.env.VERCEL_TOKEN),
      realExecution: Boolean(this.secrets ? await this.secrets.get("VERCEL_TOKEN") : process.env.VERCEL_TOKEN),
    };
  }

  async deploy({ token, projectName, files, environment = "production" }) {
    return deployVercel({ token, projectName, files, environment });
  }
}

export function createDeployProviders(secretsProvider=null) {
  return [new VercelDeployProvider(secretsProvider), createNetlifyDeployProvider(secretsProvider)];
}

export function createDeployProvider(secretsProvider=null) {
  const provider = process.env.FORGEOS_DEPLOY_PROVIDER || "vercel";
  if (provider === "vercel") return new VercelDeployProvider(secretsProvider);
  if (provider === "netlify") return createNetlifyDeployProvider(secretsProvider);
  throw new Error("unsupported_deploy_provider:" + provider);
}
