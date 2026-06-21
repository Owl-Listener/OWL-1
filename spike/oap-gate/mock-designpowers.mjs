// A deterministic stand-in for a Designpowers run — no LLM, no API key required.
//
// This is the SWAP POINT. `dispatchAgent` here just replays scripted narration and
// babble drawn from the real Designpowers traced-run example (the Aurora cookie-consent
// banner). In the real backend, `dispatchAgent` becomes a Claude Agent SDK `query()`
// call that runs the corresponding Designpowers subagent, and the onNarrate/onArtifact/
// onBabble callbacks are fed from the SDK message stream + design-state.md writes.
//
// Nothing else in the spike changes when you make that swap — the gate logic in
// runner.mjs + policies.mjs is orchestration-engine agnostic.

// The 2-agent slice: design-strategist → design-lead. Ids match OWL-1's agentsData.
export const slice = [
  { id: 'design-strategist', name: 'Design Strategist', stage: 'strategy', handsTo: ['design-lead'] },
  { id: 'design-lead', name: 'Design Lead', stage: 'design', handsTo: ['motion-designer'] },
];

const scripts = {
  'design-strategist': {
    narration: [
      'Framing the consent banner as "honest by default" — reject must be as easy as accept, no pre-ticked boxes.',
    ],
    artifact: {
      id: 'art_strategy',
      name: 'Strategy & principles',
      status: 'staged',
      preview: '3 principles: honest by default; plain specific copy; non-blocking but focus-first.',
    },
    babble:
      'Core constraint is legal + ethical symmetry: reject as easy as accept, no pre-ticked boxes. I framed it as "honest by default." Copy needs to name analytics plainly at a low reading level.',
  },
  'design-lead': {
    narration: [
      'Single blue accent on Accept; Reject is an equal-size outline button, not a faint link — symmetry holds.',
    ],
    artifact: {
      id: 'art_visual',
      name: 'Visual design',
      status: 'staged',
      preview: 'Calm neutral, single #2b5cd9 accent, equal-weight buttons, 44px targets, 12px radius.',
    },
    babble:
      'Equal-weight Accept/Reject, 44px targets, 12px radius, one soft shadow. Banner is a labelled dialog pinned bottom, non-blocking. Keep it quiet — a consent surface shouldn\'t bounce.',
  },
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Simulate one agent doing work. Emits via callbacks, then resolves on handoff.
export async function dispatchAgent(agentId, { onNarrate, onArtifact, onBabble }) {
  const s = scripts[agentId];
  if (!s) throw new Error(`No mock script for agent ${agentId}`);
  await delay(120); // "arrival"
  for (const line of s.narration) {
    onNarrate(line);
    await delay(120); // "working"
  }
  if (s.artifact) onArtifact(s.artifact);
  onBabble(s.babble); // "departure"
  return s;
}
