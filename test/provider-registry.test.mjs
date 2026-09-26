import assert from "node:assert/strict";
import test from "node:test";
import { selectProvider } from "../worker/providers/registry.mjs";

function provider(id, ok = true) {
  return {
    id,
    capability: "build",
    async health() {
      return { ok, provider: id, capability: "build", priority: id === "preferred" ? 100 : 10 };
    },
  };
}

test("provider registry preserves preferred-first healthy failover candidates", async () => {
  const selected = await selectProvider(
    [provider("preferred", true), provider("fallback", true)],
    "preferred",
  );
  assert.equal(selected.provider.id, "preferred");
  assert.deepEqual(
    selected.candidates.map((x) => x.provider.id),
    ["preferred", "fallback"],
  );
});

test("provider registry skips unhealthy preferred provider and selects healthy fallback", async () => {
  const selected = await selectProvider(
    [provider("preferred", false), provider("fallback", true)],
    "preferred",
  );
  assert.equal(selected.provider.id, "fallback");
  assert.deepEqual(
    selected.candidates.map((x) => x.provider.id),
    ["fallback"],
  );
});

test("provider registry fails explicitly when all providers are unhealthy", async () => {
  await assert.rejects(
    () => selectProvider([provider("a", false), provider("b", false)], "a"),
    /no_healthy_provider/,
  );
});
