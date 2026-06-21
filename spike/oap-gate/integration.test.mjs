// Integration check: run the gate spike, capture its OAP event stream, fold it
// through the frontend reducer, and assert the UI-facing state is correct.
// Run:  node spike/oap-gate/integration.test.mjs

import assert from 'node:assert';
import { OapSession } from './oap.mjs';
import { runSlice } from './runner.mjs';
import { GateController } from './gate-controller.mjs';
import { makeHumanCanUseTool } from './policies.mjs';
import { oapReduceAll } from '../../src/oap/reducer.js';
import { deriveOwlAgents } from '../../src/oap/agentMap.js';

const session = new OapSession('run_test');
const gates = new GateController();
const captured = [];

session.on('event', (env) => {
  captured.push(env);
  if (env.type === 'gate.opened') gates.resolve(env.payload.gateId, { action: 'approve' });
});

await runSlice({ session, mode: 'human', canUseTool: makeHumanCanUseTool(session, gates) });

const state = oapReduceAll(captured);

// --- assertions ---
assert.equal(state.finished, true, 'run should be finished');
assert.equal(state.mode, 'human', 'mode should be human');
assert.equal(state.agents['design-strategist'].status, 'done', 'strategist done');
assert.equal(state.agents['design-lead'].status, 'done', 'lead done');
assert.ok(
  state.messages.some((m) => m.kind === 'handoff' && m.from === 'design-strategist' && m.to === 'design-lead'),
  'handoff babble strategist → lead present',
);
assert.equal(state.artifacts.length, 2, 'two artifacts created');
assert.equal(state.gates.length, 0, 'no gates left open');

const owl = deriveOwlAgents(state);
assert.ok(owl.strategy, 'design-strategist maps to owl id "strategy"');
assert.ok(owl.lead, 'design-lead maps to owl id "lead"');
assert.equal(owl.lead.status, 'done', 'mapped lead status done');

console.log(`✅ integration.test: ${captured.length} OAP events folded → UI state correct`);
console.log(`   agents: ${Object.keys(state.agents).join(', ')}`);
console.log(`   owl-mapped: ${Object.keys(owl).join(', ')}  | messages: ${state.messages.length}  artifacts: ${state.artifacts.length}`);
