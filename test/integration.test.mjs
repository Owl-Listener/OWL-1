// End-to-end: run a gated mock pipeline, fold its OAP stream through the reducer,
// and assert the UI-facing state — the same path the live UI takes, minus a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OapSession } from '../spike/oap-gate/oap.mjs';
import { runSlice } from '../spike/oap-gate/runner.mjs';
import { GateController } from '../spike/oap-gate/gate-controller.mjs';
import { makeHumanCanUseTool } from '../spike/oap-gate/policies.mjs';
import { oapReduceAll } from '../src/oap/reducer.js';
import { deriveOwlAgents } from '../src/oap/agentMap.js';

test('a gated mock run folds into correct UI state', async () => {
  const session = new OapSession('run_test');
  const gates = new GateController();
  const captured = [];
  session.on('event', (env) => {
    captured.push(env);
    if (env.type === 'gate.opened') gates.resolve(env.payload.gateId, { action: 'approve' });
  });

  await runSlice({ session, mode: 'human', canUseTool: makeHumanCanUseTool(session, gates) });

  const state = oapReduceAll(captured);
  assert.equal(state.finished, true);
  assert.equal(state.agents['design-strategist'].status, 'done');
  assert.equal(state.agents['design-lead'].status, 'done');
  assert.ok(state.messages.some((m) => m.kind === 'handoff'), 'has handoff babble');
  assert.equal(state.artifacts.length, 2);

  const owl = deriveOwlAgents(state);
  assert.ok(owl.strategy && owl.lead, 'agents map to OWL ids');
});
