import assert from "node:assert/strict";
import test from "node:test";
import { StaticTokenAuthProvider } from "../worker/providers/auth-provider.mjs";

test("static worker auth accepts the configured bearer token", async () => {
  const provider = new StaticTokenAuthProvider({ token: "test-token" });
  assert.deepEqual(await provider.authenticate({ headers: { authorization: "Bearer test-token" } }), {
    ok: true,
    subject: "worker-service",
    method: "bearer-token",
  });
});

test("static worker auth rejects missing or invalid credentials", async () => {
  const provider = new StaticTokenAuthProvider({ token: "test-token" });
  assert.equal((await provider.authenticate({ headers: {} })).ok, false);
  assert.equal((await provider.authenticate({ headers: { authorization: "Bearer wrong" } })).ok, false);
});
