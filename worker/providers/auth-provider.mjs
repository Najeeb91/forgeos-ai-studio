import { AuthProvider } from "../../core/provider-contracts.mjs";

export class StaticTokenAuthProvider extends AuthProvider {
  constructor({ token = process.env.FORGEOS_WORKER_TOKEN || "" } = {}) {
    super({ id: "static-worker-token", capability: "auth" });
    this.token = token;
  }

  async health() {
    return {
      ok: Boolean(this.token),
      provider: this.id,
      capability: this.capability,
      realExecution: true,
      mode: "bearer-token",
    };
  }

  async authenticate(request) {
    if (!this.token) return { ok: false, reason: "auth_not_configured" };
    const value = request?.headers?.authorization || "";
    return value === `Bearer ${this.token}`
      ? { ok: true, subject: "worker-service", method: "bearer-token" }
      : { ok: false, reason: "invalid_credentials" };
  }
}

export function createAuthProvider() {
  return new StaticTokenAuthProvider();
}
