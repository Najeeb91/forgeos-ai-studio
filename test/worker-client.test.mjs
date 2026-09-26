import assert from "node:assert/strict";
import test from "node:test";
import { executeBuild, approveBuild } from "../src/lib/forge/worker-client.ts";

test("worker-client handles non-JSON HTTP 500 error response safely", async (t) => {
  process.env.FORGEOS_EXECUTOR_URL = "http://localhost:9999";
  process.env.FORGEOS_WORKER_TOKEN = "test-token";

  t.mock.method(globalThis, "fetch", async () => {
    return new Response("<html><body>500 Internal Server Error</body></html>", {
      status: 500,
      headers: { "content-type": "text/html" },
    });
  });

  await assert.rejects(
    async () => {
      await executeBuild("run-1", "proj-1", "test prompt");
    },
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, "Execution worker failed with HTTP 500");
      return true;
    },
  );
});

test("worker-client extracts JSON error on non-OK HTTP response", async (t) => {
  process.env.FORGEOS_EXECUTOR_URL = "http://localhost:9999";
  process.env.FORGEOS_WORKER_TOKEN = "test-token";

  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({ error: "Unauthorized access" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  });

  await assert.rejects(
    async () => {
      await approveBuild("run-1", "app-1", "approved");
    },
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, "Unauthorized access");
      return true;
    },
  );
});

test("worker-client handles non-JSON HTTP 200 response with explicit error", async (t) => {
  process.env.FORGEOS_EXECUTOR_URL = "http://localhost:9999";
  process.env.FORGEOS_WORKER_TOKEN = "test-token";

  t.mock.method(globalThis, "fetch", async () => {
    return new Response("OK non-json text", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  });

  await assert.rejects(
    async () => {
      await executeBuild("run-1", "proj-1", "test prompt");
    },
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, "Execution worker returned invalid JSON (HTTP 200)");
      return true;
    },
  );
});
