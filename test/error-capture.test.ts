import assert from "node:assert/strict";
import test from "node:test";
import { describeError, consumeLastCapturedError } from "../src/lib/error-capture.ts";

test("safeStringify error path handles circular references in describeError", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  const result = describeError(circular);
  assert.equal(result, "[object Object]");
});

test("safeStringify error path handles circular references with custom toString", () => {
  const circular: Record<string, unknown> = {
    toString() {
      return "custom circular error string";
    },
  };
  circular.self = circular;

  const result = describeError(circular);
  assert.equal(result, "custom circular error string");
});

test("safeStringify error path handles BigInt values which fail JSON.stringify", () => {
  const result = describeError(1234567890123456789n);
  assert.equal(result, "1234567890123456789");
});

test("safeStringify handles functions and undefined where JSON.stringify returns undefined", () => {
  const fnResult = describeError(() => "test");
  assert.ok(fnResult.includes("test"));

  const objWithFn = describeError({ a: 1, b: () => {} });
  assert.equal(objWithFn, '{"a":1}');
});

test("describeError formats plain objects and primitive values", () => {
  assert.equal(describeError("simple error string"), "simple error string");
  assert.equal(
    describeError({ code: "ERR_SOMETHING", detail: "failed" }),
    '{"code":"ERR_SOMETHING","detail":"failed"}',
  );
});

test("describeError formats Error objects with stack and status", () => {
  const err = new Error("something went wrong") as Error & { status?: number };
  err.status = 404;
  const result = describeError(err);
  assert.ok(result.includes("Error: something went wrong"));
  assert.ok(result.includes("(status 404)"));
});

test("describeError handles cause chain", () => {
  const rootCause = new Error("root cause");
  const outerError = new Error("outer error", { cause: rootCause });
  const result = describeError(outerError);
  assert.ok(result.includes("outer error"));
  assert.ok(result.includes("caused by:"));
  assert.ok(result.includes("root cause"));
});

test("describeError handles cause chain with circular non-Error cause", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const err = new Error("outer error", { cause: circular });
  const result = describeError(err);
  assert.ok(result.includes("outer error"));
  assert.ok(result.includes("[object Object]"));
});

test("console.error interception and consumeLastCapturedError", () => {
  const capturedErr = new Error("captured error test");
  console.error("Logging error", capturedErr);

  const lastError = consumeLastCapturedError();
  assert.strictEqual(lastError, capturedErr);

  // Subsequent call should return undefined as it was consumed
  assert.strictEqual(consumeLastCapturedError(), undefined);
});
