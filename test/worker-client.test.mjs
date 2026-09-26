import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkerResponse } from "../src/lib/forge/worker-client.ts";

test("parseWorkerResponse parses valid JSON response when Content-Type is application/json", async () => {
  const res = new Response(JSON.stringify({ ok: true, data: "hello" }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

  const payload = await parseWorkerResponse(res, "Test worker");
  assert.deepEqual(payload, { ok: true, data: "hello" });
});

test("parseWorkerResponse extracts error field on failed HTTP response with JSON payload", async () => {
  const res = new Response(JSON.stringify({ error: "Unauthorized access" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    async () => {
      await parseWorkerResponse(res, "Test worker");
    },
    {
      name: "Error",
      message: "Unauthorized access",
    },
  );
});

test("parseWorkerResponse extracts stderr build/install error on failed HTTP response", async () => {
  const res = new Response(JSON.stringify({ build: { stderr: "Build failed syntax error" } }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    async () => {
      await parseWorkerResponse(res, "Test worker");
    },
    {
      name: "Error",
      message: "Build failed syntax error",
    },
  );
});

test("parseWorkerResponse handles non-JSON HTML response (e.g. 502 Bad Gateway from reverse proxy)", async () => {
  const res = new Response("<html><body>502 Bad Gateway</body></html>", {
    status: 502,
    headers: { "content-type": "text/html" },
  });

  await assert.rejects(
    async () => {
      await parseWorkerResponse(res, "Test worker");
    },
    {
      name: "Error",
      message: "Test worker failed with HTTP 502",
    },
  );
});

test("parseWorkerResponse handles invalid JSON content despite application/json header", async () => {
  const res = new Response("not valid json", {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    async () => {
      await parseWorkerResponse(res, "Test worker");
    },
    {
      name: "Error",
      message: "Test worker returned invalid JSON (HTTP 200)",
    },
  );
});
