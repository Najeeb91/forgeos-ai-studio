import assert from "node:assert/strict";
import test from "node:test";

process.env.FORGEOS_EXECUTOR_URL = "http://localhost:9999";
process.env.FORGEOS_WORKER_TOKEN = "test-token";

const { getProjectFromWorker, getLatestGeneratedSource } =
  await import("../src/lib/forge/worker-client.ts");

test("getProjectFromWorker throws descriptive error on invalid JSON", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("Invalid JSON string", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(
      async () => {
        await getProjectFromWorker("test-project");
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Project lookup worker returned invalid JSON \(HTTP 200\)/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getLatestGeneratedSource throws descriptive error on invalid JSON", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("Invalid JSON string", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    await assert.rejects(
      async () => {
        await getLatestGeneratedSource("test-project");
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(
          err.message,
          /Generated source lookup worker returned invalid JSON \(HTTP 200\)/,
        );
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
