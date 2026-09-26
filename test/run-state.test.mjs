import assert from "node:assert/strict";
import test from "node:test";
import { canTransition, isTerminalRun } from "../worker/run-state.mjs";

test("run state machine accepts the canonical happy path",()=>{
  const path=["awaiting_approval","executing","testing","building","review","deploying","deployed"];
  for(let i=0;i<path.length-1;i++) assert.equal(canTransition(path[i],path[i+1]),true,path[i]+" -> "+path[i+1]);
});

test("run state machine rejects terminal resurrection",()=>{
  assert.equal(canTransition("deployed","executing"),false);
  assert.equal(canTransition("cancelled","executing"),false);
  assert.equal(canTransition("deployed","failed"),false);
  assert.equal(isTerminalRun("deployed"),true);
  assert.equal(isTerminalRun("cancelled"),true);
  assert.equal(isTerminalRun("failed"),true);
});

test("recovery only resumes recovery-required runs",()=>{
  assert.equal(canTransition("recovery_required","executing"),true);
  assert.equal(canTransition("building","executing"),false);
  assert.equal(canTransition("review","executing"),true);
});

test("bounded repair states remain explicit",()=>{
  assert.equal(canTransition("building","repairing"),true);
  assert.equal(canTransition("repairing","repairing"),true);
  assert.equal(canTransition("repairing","review"),true);
  assert.equal(canTransition("repairing","deployed"),false);
});

test("cancellation is available from active states but not after terminal completion",()=>{
  for(const state of ["awaiting_approval","executing","testing","building","repairing","review","deploying","recovery_required"])
    assert.equal(canTransition(state,"cancelled"),true,state+" should cancel");
  assert.equal(canTransition("deployed","cancelled"),false);
  assert.equal(canTransition("cancelled","cancelled"),true);
});
