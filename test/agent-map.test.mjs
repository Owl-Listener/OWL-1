// Tests for the Designpowers<->OWL-1 agent id binding and status->activity mapping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { owlIdFor, oapIdFor, activityForStatus, deriveOwlAgents } from '../src/oap/agentMap.js';

test('known ids round-trip', () => {
  assert.equal(owlIdFor('design-strategist'), 'strategy');
  assert.equal(oapIdFor('strategy'), 'design-strategist');
  assert.equal(owlIdFor('design-lead'), 'lead');
  assert.equal(owlIdFor('design-scout'), 'discovery');
});

test('unknown ids pass through unchanged', () => {
  assert.equal(owlIdFor('brand-strategist'), 'brand-strategist');
  assert.equal(oapIdFor('brand-strategist'), 'brand-strategist');
});

test('activityForStatus maps statuses to 0..1', () => {
  assert.equal(activityForStatus('running'), 0.9);
  assert.equal(activityForStatus('awaiting'), 0.9);
  assert.equal(activityForStatus('online'), 0.35);
  assert.equal(activityForStatus('idle'), 0);
  assert.equal(activityForStatus('done'), 0);
  assert.equal(activityForStatus('mystery', 0.5), 0.5);
});

test('deriveOwlAgents keys by OWL id with activity/status', () => {
  const oapState = { agents: {
    'design-lead': { id: 'design-lead', status: 'running' },
    'design-scout': { id: 'design-scout', status: 'online', activity: 0.4 },
  } };
  const owl = deriveOwlAgents(oapState);
  assert.ok(owl.lead && owl.discovery);
  assert.equal(owl.lead.status, 'running');
  assert.equal(owl.lead.activity, 0.9); // derived from status
  assert.equal(owl.discovery.activity, 0.4); // explicit activity preserved
});
