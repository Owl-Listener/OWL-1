// Tests for the gate/queue primitives shared by both backends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GateController } from '../spike/oap-gate/gate-controller.mjs';
import { InputQueue } from '../spike/oap-gate/sdk-runner.mjs';
import { OapSession } from '../spike/oap-gate/oap.mjs';
import { autoCanUseTool, makeHumanCanUseTool } from '../spike/oap-gate/policies.mjs';

test('GateController resolves the awaited decision', async () => {
  const gates = new GateController();
  const { id, decision } = gates.request({ agentId: 'lead' });
  assert.equal(gates.list().length, 1);
  setTimeout(() => gates.resolve(id, { action: 'approve' }), 5);
  const d = await decision;
  assert.equal(d.action, 'approve');
  assert.equal(gates.list().length, 0);
});

test('InputQueue supports push / next / drain / close', async () => {
  const q = new InputQueue();
  q.push('a'); q.push('b');
  assert.deepEqual(q.drain(), ['a', 'b']);
  const pending = q.next(); // nothing queued -> resolves on next push
  q.push('c');
  assert.equal((await pending).value, 'c');
  q.close();
  assert.equal((await q.next()).done, true);
});

test('autoCanUseTool always allows (Auto mode)', async () => {
  const r = await autoCanUseTool('Task', { subagent_type: 'x' });
  assert.equal(r.behavior, 'allow');
});

test('human canUseTool opens a gate and resolves allow on approve', async () => {
  const session = new OapSession('t');
  const events = [];
  session.on('event', (e) => events.push(e));
  const gates = new GateController();
  const canUse = makeHumanCanUseTool(session, gates);

  const pending = canUse('Task', { subagent_type: 'design-lead' }, {});
  await new Promise((r) => setTimeout(r, 5));
  const opened = events.find((e) => e.type === 'gate.opened');
  assert.ok(opened, 'a gate.opened event should be emitted');

  gates.resolve(opened.payload.gateId, { action: 'approve' });
  const result = await pending;
  assert.equal(result.behavior, 'allow');
});

test('human canUseTool denies on skip', async () => {
  const session = new OapSession('t2');
  const events = [];
  session.on('event', (e) => events.push(e));
  const gates = new GateController();
  const canUse = makeHumanCanUseTool(session, gates);

  const pending = canUse('Task', { subagent_type: 'motion-designer' }, {});
  await new Promise((r) => setTimeout(r, 5));
  const opened = events.find((e) => e.type === 'gate.opened');
  gates.resolve(opened.payload.gateId, { action: 'skip' });
  const result = await pending;
  assert.equal(result.behavior, 'deny');
});
