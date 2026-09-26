import assert from "node:assert/strict";
import test from "node:test";
import { checkDatabaseReadiness, sql } from "../src/server/db/index.ts";

test("checkDatabaseReadiness returns false when client is explicitly null", async () => {
  const readiness = await checkDatabaseReadiness(null);
  assert.equal(readiness, false);
});

test("checkDatabaseReadiness uses default sql export when called without arguments", async () => {
  const readiness = await checkDatabaseReadiness();
  if (sql === null) {
    assert.equal(readiness, false);
  } else {
    assert.equal(typeof readiness, "boolean");
  }
});

test("checkDatabaseReadiness returns true when query execution succeeds", async () => {
  let executedQuery: string | undefined;
  const mockClient = async (strings: TemplateStringsArray, ..._values: unknown[]) => {
    executedQuery = strings[0];
    return [{ "?column?": 1 }];
  };

  const readiness = await checkDatabaseReadiness(mockClient as unknown as typeof sql);
  assert.equal(readiness, true);
  assert.equal(executedQuery, "select 1");
});

test("checkDatabaseReadiness catches errors and returns false when query fails", async () => {
  let executedQuery: string | undefined;
  const mockClient = async (strings: TemplateStringsArray, ..._values: unknown[]) => {
    executedQuery = strings[0];
    throw new Error("Connection timed out");
  };

  const readiness = await checkDatabaseReadiness(mockClient as unknown as typeof sql);
  assert.equal(readiness, false);
  assert.equal(executedQuery, "select 1");
});
