import assert from "node:assert/strict";
import test from "node:test";
import {
  executeBuild,
  approveBuild,
  createForgeProject,
  getDeploymentStatus,
  listProjectsFromWorker,
  recoverForgeRun,
  getForgeRun,
} from "../src/lib/forge/worker-client.ts";

function setupEnv() {
  process.env.FORGEOS_WORKER_URL = "http://localhost:8080";
  process.env.FORGEOS_WORKER_TOKEN = "test-token";
}

function cleanupEnv() {
  delete process.env.FORGEOS_WORKER_URL;
  delete process.env.FORGEOS_WORKER_TOKEN;
  delete process.env.FORGEOS_EXECUTOR_URL;
}

test("executeBuild throws error on invalid JSON response", async (t) => {
  setupEnv();
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    cleanupEnv();
  });

  globalThis.fetch = async () => {
    return new Response("<html>500 Internal Server Error</html>", {
      status: 500,
      headers: { "content-type": "text/html" },
    });
  };

  await assert.rejects(
    async () => {
      await executeBuild("run-1", "proj-1", "build prompt", false);
    },
    {
      name: "Error",
      message: "Execution worker returned invalid JSON (HTTP 500)",
    }
  );
});

test("executeBuild throws error on HTTP error response with parsed JSON payload error", async (t) => {
  setupEnv();
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    cleanupEnv();
  });

  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ error: "Build failed during compilation" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  };

  await assert.rejects(
    async () => {
      await executeBuild("run-1", "proj-1", "build prompt", false);
    },
    {
      name: "Error",
      message: "Build failed during compilation",
    }
  );
});

test("executeBuild throws error when execution is simulated", async (t) => {
  setupEnv();
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    cleanupEnv();
  });

  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ simulated: true, runId: "run-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await assert.rejects(
    async () => {
      await executeBuild("run-1", "proj-1", "build prompt", false);
    },
    {
      name: "Error",
      message: "Execution worker did not report a real execution",
    }
  );
});

test("executeBuild succeeds with valid JSON response and real execution", async (t) => {
  setupEnv();
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    cleanupEnv();
  });

  const mockPayload = {
    runId: "run-1",
    state: "passed",
    simulated: false,
    ok: true,
  };

  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8080/worker/build");
    assert.equal(options?.method, "POST");
    assert.equal((options?.headers as Record<string, string>)?.authorization, "Bearer test-token");
    return new Response(JSON.stringify(mockPayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await executeBuild("run-1", "proj-1", "build prompt", false);
  assert.deepEqual(result, mockPayload);
});

test("worker client functions throw on invalid JSON responses", async (t) => {
  setupEnv();
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    cleanupEnv();
  });

  globalThis.fetch = async () => {
    return new Response("Bad Response", { status: 502 });
  };

  await assert.rejects(
    () => approveBuild("run-1", "app-1"),
    { message: "Approval worker returned invalid JSON (HTTP 502)" }
  );

  await assert.rejects(
    () => createForgeProject({ slug: "s", name: "n", prompt: "p" }),
    { message: "Project creation worker returned invalid JSON (HTTP 502)" }
  );

  await assert.rejects(
    () => getDeploymentStatus("run-1"),
    { message: "Deployment status worker returned invalid JSON (HTTP 502)" }
  );

  await assert.rejects(
    () => listProjectsFromWorker(),
    { message: "Project list worker returned invalid JSON (HTTP 502)" }
  );

  await assert.rejects(
    () => recoverForgeRun("run-1"),
    { message: "Run recovery worker returned invalid JSON (HTTP 502)" }
  );

  await assert.rejects(
    () => getForgeRun("run-1"),
    { message: "Run history worker returned invalid JSON (HTTP 502)" }
  );
});
