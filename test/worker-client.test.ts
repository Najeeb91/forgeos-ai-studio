import assert from "node:assert/strict";
import test from "node:test";
import { getLatestGeneratedSource, getProjectFromWorker } from "../src/lib/forge/worker-client.ts";

test("getLatestGeneratedSource parses valid JSON correctly", async () => {
  process.env.FORGEOS_EXECUTOR_URL = "http://localhost:9999";
  process.env.FORGEOS_WORKER_TOKEN = "test-token";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url, options) => {
    return new Response(
      JSON.stringify({ files: [{ path: "src/index.ts", content: "console.log('hi')" }] }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof globalThis.fetch;

  try {
    const files = await getLatestGeneratedSource("test-project");
    assert.deepEqual(files, [{ path: "src/index.ts", content: "console.log('hi')" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getLatestGeneratedSource throws error on invalid JSON", async () => {
  process.env.FORGEOS_EXECUTOR_URL = "http://localhost:9999";
  process.env.FORGEOS_WORKER_TOKEN = "test-token";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url, options) => {
    return new Response("Not JSON content <html...", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as typeof globalThis.fetch;

  try {
    await assert.rejects(
      async () => {
        await getLatestGeneratedSource("test-project");
      },
      (err: Error) => {
        assert.match(err.message, /Generated source lookup returned invalid JSON \(HTTP 200\)/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getProjectFromWorker parses valid JSON correctly", async () => {
  process.env.FORGEOS_EXECUTOR_URL = "http://localhost:9999";
  process.env.FORGEOS_WORKER_TOKEN = "test-token";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url, options) => {
    return new Response(JSON.stringify({ project: { id: "p1", name: "Project 1" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  try {
    const res = await getProjectFromWorker("test-project");
    assert.deepEqual(res, { project: { id: "p1", name: "Project 1" } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getProjectFromWorker throws error on invalid JSON with 200 OK", async () => {
  process.env.FORGEOS_EXECUTOR_URL = "http://localhost:9999";
  process.env.FORGEOS_WORKER_TOKEN = "test-token";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url, options) => {
    return new Response("Invalid JSON body", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as typeof globalThis.fetch;

  try {
    await assert.rejects(
      async () => {
        await getProjectFromWorker("test-project");
      },
      (err: Error) => {
        assert.match(err.message, /Project lookup returned invalid JSON \(HTTP 200\)/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getProjectFromWorker throws HTTP error when response is not ok", async () => {
  process.env.FORGEOS_EXECUTOR_URL = "http://localhost:9999";
  process.env.FORGEOS_WORKER_TOKEN = "test-token";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url, options) => {
    return new Response("502 Bad Gateway html...", {
      status: 502,
      headers: { "content-type": "text/html" },
    });
  }) as typeof globalThis.fetch;

  try {
    await assert.rejects(
      async () => {
        await getProjectFromWorker("test-project");
      },
      (err: Error) => {
        assert.match(err.message, /Project lookup failed \(HTTP 502\)/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
