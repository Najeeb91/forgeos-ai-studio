import assert from "node:assert/strict";
import test from "node:test";

// Mock globalThis.addEventListener BEFORE importing error-capture to test event listeners
const eventListeners = new Map();
globalThis.addEventListener = (type, listener) => {
  eventListeners.set(type, listener);
};

// Temporarily suppress stderr writes during test runs so error logs don't clutter terminal output
const originalStderrWrite = process.stderr.write;
function suppressStderr() {
  process.stderr.write = () => true;
}
function restoreStderr() {
  process.stderr.write = originalStderrWrite;
}

const { consumeLastCapturedError, describeError } = await import(
  "../src/lib/error-capture.ts"
);

test("consumeLastCapturedError returns undefined initially when no error is captured", () => {
  assert.equal(consumeLastCapturedError(), undefined);
});

test("consumeLastCapturedError returns and clears the error captured via console.error", () => {
  suppressStderr();
  try {
    const error = new Error("Console error capture test");
    console.error(error);

    assert.equal(consumeLastCapturedError(), error);
    // Single use: second consume returns undefined
    assert.equal(consumeLastCapturedError(), undefined);
  } finally {
    restoreStderr();
  }
});

test("non-Error console.error arguments do not set or overwrite lastCapturedError", () => {
  suppressStderr();
  try {
    // Ensure clear initial state
    consumeLastCapturedError();

    console.error("Simple string log", 123, { foo: "bar" });
    assert.equal(consumeLastCapturedError(), undefined);
  } finally {
    restoreStderr();
  }
});

test("consumeLastCapturedError keeps only the most recent error", () => {
  suppressStderr();
  try {
    const firstError = new Error("First error");
    const secondError = new Error("Second error");

    console.error(firstError);
    console.error(secondError);

    assert.equal(consumeLastCapturedError(), secondError);
    assert.equal(consumeLastCapturedError(), undefined);
  } finally {
    restoreStderr();
  }
});

test("consumeLastCapturedError respects 5000ms TTL", () => {
  suppressStderr();
  const originalDateNow = Date.now;
  try {
    let mockTime = 1_000_000;
    Date.now = () => mockTime;

    const error = new Error("TTL test error");
    console.error(error);

    // 5001ms elapsed -> expired
    mockTime += 5_001;
    assert.equal(consumeLastCapturedError(), undefined);

    // Re-record and test valid TTL (3000ms < 5000ms)
    console.error(error);
    mockTime += 3_000;
    assert.equal(consumeLastCapturedError(), error);
  } finally {
    Date.now = originalDateNow;
    restoreStderr();
  }
});

test("captures errors from globalThis 'error' event listener", () => {
  consumeLastCapturedError();
  const errorListener = eventListeners.get("error");
  assert.equal(typeof errorListener, "function", "error event listener should be registered");

  const testError = new Error("Window error");
  errorListener({ error: testError });

  assert.equal(consumeLastCapturedError(), testError);

  // Fallback to event itself if event.error is missing
  const eventObj = { type: "error" };
  errorListener(eventObj);
  assert.equal(consumeLastCapturedError(), eventObj);
});

test("captures errors from globalThis 'unhandledrejection' event listener", () => {
  consumeLastCapturedError();
  const rejectionListener = eventListeners.get("unhandledrejection");
  assert.equal(
    typeof rejectionListener,
    "function",
    "unhandledrejection event listener should be registered",
  );

  const rejectionReason = new Error("Unhandled promise rejection");
  rejectionListener({ reason: rejectionReason });

  assert.equal(consumeLastCapturedError(), rejectionReason);
});

test("describeError formats standard Error with stack", () => {
  const err = new Error("Test error message");
  const description = describeError(err);
  assert.match(description, /Test error message/);
  assert.match(description, /Error: Test error message/);
});

test("describeError handles status and statusCode properties", () => {
  const errWithStatus = new Error("HTTP failure");
  errWithStatus.status = 502;
  assert.match(describeError(errWithStatus), /\(status 502\)/);

  const errWithStatusCode = new Error("Another failure");
  errWithStatusCode.statusCode = 404;
  assert.match(describeError(errWithStatusCode), /\(status 404\)/);
});

test("describeError formats error cause chains up to depth limit", () => {
  const rootError = new Error("Root cause");
  const middleError = new Error("Middle error", { cause: rootError });
  const topError = new Error("Top error", { cause: middleError });

  const formatted = describeError(topError);
  assert.match(formatted, /Top error/);
  assert.match(formatted, /caused by: .*Middle error/);
  assert.match(formatted, /caused by: .*Root cause/);
});

test("describeError formats non-Error inputs gracefully", () => {
  assert.equal(describeError("Plain string error"), "Plain string error");
  assert.equal(describeError({ custom: "object" }), '{"custom":"object"}');

  // Circular object fallback to String()
  const circular = {};
  circular.self = circular;
  assert.equal(describeError(circular), "[object Object]");
});
