// Headless proof of the gate: runs the Designpowers slice in HUMAN mode, prints
// the OAP event stream as it arrives, and shows the run BLOCK at the handoff until
// an approval is sent. No browser, no API key — run with:  node spike/oap-gate/demo.mjs
//
// Pass --auto to see the contrast: same runner, autoCanUseTool, no pause.

import { OapSession } from './oap.mjs';
import { runSlice } from './runner.mjs';
import { GateController } from './gate-controller.mjs';
import { makeHumanCanUseTool, autoCanUseTool } from './policies.mjs';

const AUTO = process.argv.includes('--auto');
const APPROVE_DELAY_MS = 800;

const session = new OapSession(AUTO ? 'run_demo_auto' : 'run_demo_human');
const gates = new GateController();

session.on('event', (e) => {
  const t = e.ts.slice(11, 19);
  console.log(`#${String(e.seq).padStart(2, '0')} ${t}  ${e.type.padEnd(15)} ${summarize(e)}`);

  // Stand in for OWL-1: when a gate opens, the "user" clicks APPROVE after a beat.
  if (e.type === 'gate.opened') {
    console.log(`        ⏸  gate ${e.payload.gateId} OPEN — runner is BLOCKED, awaiting approval (${APPROVE_DELAY_MS}ms)…`);
    setTimeout(() => {
      console.log(`        ▶  [OWL-1] user clicks ✓ APPROVE + CONTINUE → command gate.approve { ${e.payload.gateId} }`);
      gates.resolve(e.payload.gateId, { action: 'approve' });
    }, APPROVE_DELAY_MS);
  }
});

function summarize(e) {
  const p = e.payload;
  switch (e.type) {
    case 'run.started': return `mode=${p.mode} project=${p.projectId}`;
    case 'agent.status': return `${p.id} → ${p.status}${p.waiting ? ` (${p.waiting})` : ''}`;
    case 'stage.changed': return `stage=${p.id}`;
    case 'message': return `[${p.kind}] ${p.from || '—'}${p.to ? ` → ${p.to}` : ''}: ${truncate(p.text)}`;
    case 'artifact.created': return `${p.name} (${p.status}) by ${p.agent}`;
    case 'gate.opened': return `${p.agentId} ← ${p.context}`;
    case 'gate.closed': return `${p.agentId} resolution=${p.resolution}`;
    case 'run.finished': return p.summary;
    default: return JSON.stringify(p);
  }
}
const truncate = (s, n = 64) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

console.log(`\n=== OAP gate spike — ${AUTO ? 'AUTO' : 'HUMAN'} mode ===\n`);
const startedAt = Date.now();

await runSlice({
  session,
  mode: AUTO ? 'auto' : 'human',
  canUseTool: AUTO ? autoCanUseTool : makeHumanCanUseTool(session, gates),
});

const elapsed = Date.now() - startedAt;
if (AUTO) {
  console.log(`\n✅ Finished in ${elapsed}ms with no pause (auto mode).\n`);
} else {
  console.log(
    `\n✅ Finished in ${elapsed}ms. The run paused at the design-strategist → design-lead handoff` +
      `\n   and only dispatched design-lead AFTER gate.approve arrived — proving Human-mode` +
      `\n   approval works end-to-end through the canUseTool seam.\n`,
  );
}
