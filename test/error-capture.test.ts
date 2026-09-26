import assert from "node:assert/strict";
import test from "node:test";
import { describeError, consumeLastCapturedError } from "../src/lib/error-capture.ts";

test("describeError - standard Error formatting with stack", () => {
  const err = new Error("Something went wrong");
  const result = describeError(err);
  assert.match(result, /^Error: Something went wrong/);
  assert.ok(result.includes("test/error-capture.test.ts"));
});

test("describeError - Error without stack falls back to name and message", () => {
  const err = new Error("No stack error");
  delete err.stack;
  const result = describeError(err);
  assert.equal(result, "Error: No stack error");
});

test("describeError - includes status or statusCode if present", () => {
  const errWithStatus = new Error("Not found") as Error & { status: number };
  errWithStatus.status = 404;
  assert.ok(describeError(errWithStatus).includes("(status 404)"));

  const errWithStatusCode = new Error("Server error") as Error & { statusCode: number };
  errWithStatusCode.statusCode = 500;
  assert.ok(describeError(errWithStatusCode).includes("(status 500)"));
});

test("describeError - formatting error cause chains", () => {
  const innerError = new Error("Database connection failed");
  const outerError = new Error("Service unavailable", { cause: innerError });

  const result = describeError(outerError);
  assert.ok(result.includes("Service unavailable"));
  assert.ok(result.includes("caused by: "));
  assert.ok(result.includes("Database connection failed"));
});

test("describeError - respects cause depth limit", () => {
  let rootErr: unknown = new Error("Root cause 0");
  for (let i = 1; i < 10; i++) {
    rootErr = new Error(`Layer ${i}`, { cause: rootErr });
  }

  const result = describeError(rootErr);
  const causedByCount = (result.match(/caused by:/g) || []).length;
  // Depth limit is 5 (1 primary error + 4 causes)
  assert.equal(causedByCount, 4);
  assert.ok(result.includes("Layer 9"));
  assert.ok(!result.includes("Layer 0"));
});

test("describeError - handles non-Error cause", () => {
  const err = new Error("Outer error", { cause: "plain string failure" });
  const result = describeError(err);
  assert.ok(result.includes("Outer error"));
  assert.ok(result.includes("plain string failure"));
});

test("describeError - handles non-Error values", () => {
  assert.equal(describeError("Direct string error"), "Direct string error");
  assert.equal(describeError({ foo: "bar" }), '{"foo":"bar"}');

  // Circular object handling in safeStringify
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(describeError(circular), "[object Object]");

  // null and undefined
  assert.equal(describeError(null), "");
  assert.equal(describeError(undefined), "");
});

test("describeError - truncates output exceeding length limit", () => {
  const longMessage = "a".repeat(10_000);
  const err = new Error(longMessage);
  const result = describeError(err);
  assert.equal(result.length, 8_000);
});

test("console.error capture and consumeLastCapturedError", () => {
  const err = new Error("Captured via console.error");
  console.error("Context message", err);

  const captured = consumeLastCapturedError();
  assert.equal(captured, err);

  // Subsequent call should return undefined
  assert.equal(consumeLastCapturedError(), undefined);
});

test("consumeLastCapturedError - expires after TTL", () => {
  const err = new Error("Expiring error");
  console.error(err);

  const realNow = Date.now;
  try {
    // Advance time past 5000ms TTL
    Date.now = () => realNow() + 6_000;
    assert.equal(consumeLastCapturedError(), undefined);
  } finally {
    Date.now = realNow;
  }
});
