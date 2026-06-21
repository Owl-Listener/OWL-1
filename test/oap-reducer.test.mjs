// Unit tests for the OAP reducer — the pure heart of the frontend (events -> UI state).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialOapState, oapReduce } from '../src/oap/reducer.js';

const ev = (type, payload, seq = 1) => ({ type, payload, seq });

test('initial state shape', () => {
  const s = initialOapState();
  assert.equal(s.mode, 'stop');
  assert.deepEqual(s.agents, {});
  assert.deepEqual(s.messages, []);
  assert.equal(s.finished, false);
  assert.deepEqual(s.telemetry, { byAgent: {}, totalInput: 0, totalOutput: 0, totalCost: 0 });
});

test('run.started resets state and sets mode', () => {
  let s = oapReduce(initialOapState(), ev('agent.status', { id: 'x', status: 'running' }));
  s = oapReduce(s, ev('run.started', { mode: 'human' }, 5));
  assert.equal(s.mode, 'human');
  assert.deepEqual(s.agents, {});
});

test('agent.status creates then merges (preserving fields)', () => {
  let s = oapReduce(initialOapState(), ev('agent.status', { id: 'lead', name: 'Lead', status: 'idle' }));
  assert.equal(s.agents.lead.status, 'idle');
  s = oapReduce(s, ev('agent.status', { id: 'lead', status: 'running', activity: 0.9 }));
  assert.equal(s.agents.lead.status, 'running');
  assert.equal(s.agents.lead.name, 'Lead');
  assert.equal(s.agents.lead.activity, 0.9);
});

test('messages append and cap at 60', () => {
  let s = initialOapState();
  for (let i = 0; i < 65; i++) s = oapReduce(s, ev('message', { id: 'm' + i, text: 't' + i }));
  assert.equal(s.messages.length, 60);
  assert.equal(s.messages.at(-1).id, 'm64');
});

test('artifacts: created then updated by id', () => {
  let s = oapReduce(initialOapState(), ev('artifact.created', { id: 'a1', name: 'X', status: 'staged' }));
  assert.equal(s.artifacts.length, 1);
  s = oapReduce(s, ev('artifact.updated', { id: 'a1', status: 'approved' }));
  assert.equal(s.artifacts[0].status, 'approved');
});

test('blockers: raise dedupes by id, clear removes', () => {
  let s = oapReduce(initialOapState(), ev('blocker.raised', { id: 'b1', text: 'x' }));
  s = oapReduce(s, ev('blocker.raised', { id: 'b1', text: 'y' }));
  assert.equal(s.blockers.length, 1);
  assert.equal(s.blockers[0].text, 'y');
  s = oapReduce(s, ev('blocker.cleared', { id: 'b1' }));
  assert.equal(s.blockers.length, 0);
});

test('gates open and close by gateId', () => {
  let s = oapReduce(initialOapState(), ev('gate.opened', { gateId: 'g1', agentId: 'lead' }));
  assert.equal(s.gates.length, 1);
  s = oapReduce(s, ev('gate.closed', { gateId: 'g1' }));
  assert.equal(s.gates.length, 0);
});

test('telemetry accumulates per agent and in totals', () => {
  let s = initialOapState();
  s = oapReduce(s, ev('telemetry.tick', { agentId: 'lead', inputTokens: 100, outputTokens: 50, costUsd: 0.01 }));
  s = oapReduce(s, ev('telemetry.tick', { agentId: 'lead', inputTokens: 200, outputTokens: 80, costUsd: 0.02 }));
  assert.equal(s.telemetry.totalInput, 300);
  assert.equal(s.telemetry.totalOutput, 130);
  assert.ok(Math.abs(s.telemetry.totalCost - 0.03) < 1e-9);
  assert.equal(s.telemetry.byAgent.lead.input, 300);
});

test('stage.changed and run.finished', () => {
  let s = oapReduce(initialOapState(), ev('stage.changed', { id: 'design' }));
  assert.equal(s.stage, 'design');
  s = oapReduce(s, ev('run.finished', {}));
  assert.equal(s.finished, true);
});

test('snapshot hydrates full state', () => {
  const s = oapReduce(initialOapState(), ev('snapshot', { mode: 'auto', stage: 'verify' }));
  assert.equal(s.mode, 'auto');
  assert.equal(s.stage, 'verify');
});

test('unknown event is a no-op (returns same reference)', () => {
  const s0 = initialOapState();
  assert.equal(oapReduce(s0, ev('memory.changed', {})), s0);
});
