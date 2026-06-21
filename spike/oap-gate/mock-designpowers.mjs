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

// Ids/stages match OAP slugs; the OWL-1 UI maps them via src/oap/agentMap.js.

// The 2-agent slice: design-strategist → design-lead. Used by the headless demo.
export const slice = [
  { id: 'design-strategist', name: 'Design Strategist', stage: 'strategy', handsTo: ['design-lead'] },
  { id: 'design-lead', name: 'Design Lead', stage: 'design', handsTo: ['motion-designer'] },
];

// The full 10-agent Designpowers pipeline, in order. Used by the demo server so the
// whole OWL-1 team lights up across every stage.
export const fullSlice = [
  { id: 'design-scout', name: 'Design Scout', stage: 'discover', handsTo: ['design-strategist'] },
  { id: 'design-strategist', name: 'Design Strategist', stage: 'strategy', handsTo: ['inspiration-scout'] },
  { id: 'inspiration-scout', name: 'Inspiration Scout', stage: 'taste', handsTo: ['content-writer'] },
  { id: 'content-writer', name: 'Content Writer', stage: 'design', handsTo: ['design-lead'] },
  { id: 'design-lead', name: 'Design Lead', stage: 'design', handsTo: ['motion-designer'] },
  { id: 'motion-designer', name: 'Motion Designer', stage: 'design', handsTo: ['design-builder'] },
  { id: 'design-builder', name: 'Design Builder', stage: 'design', handsTo: ['design-critic'] },
  { id: 'design-critic', name: 'Design Critic', stage: 'verify', handsTo: ['accessibility-reviewer'] },
  { id: 'accessibility-reviewer', name: 'Accessibility Reviewer', stage: 'verify', handsTo: ['heuristic-evaluator'] },
  { id: 'heuristic-evaluator', name: 'Heuristic Evaluator', stage: 'verify', handsTo: ['design-lead'] },
];

const scripts = {
  'design-scout': {
    narration: ['Scanning consent-banner patterns — most bury "reject" or pre-tick analytics. That\'s the anti-pattern to avoid.'],
    artifact: { id: 'art_scan', name: 'Competitive scan', status: 'staged', preview: '6 banners reviewed; 4 fail reject-symmetry; 2 pre-tick analytics.' },
    babble: 'Reject is buried or weaker than accept in most competitors. Our differentiator is genuine symmetry. Over to you, strategist.',
  },
  'design-strategist': {
    narration: ['Framing the banner as "honest by default" — reject must be as easy as accept, no pre-ticked boxes.'],
    artifact: { id: 'art_strategy', name: 'Strategy & principles', status: 'staged', preview: '3 principles: honest by default; plain specific copy; non-blocking but focus-first.' },
    babble: 'Core constraint is legal + ethical symmetry. I framed it as "honest by default." Inspiration-scout — keep the references calm and trustworthy.',
  },
  'inspiration-scout': {
    narration: ['Pulling calm, trustworthy references — banking-grade restraint, single accent, no alarm-red.'],
    artifact: { id: 'art_taste', name: 'Taste profile', status: 'staged', preview: 'Calm, neutral, single blue accent (#2b5cd9). Soft 12px radius, one soft shadow.' },
    babble: 'Direction is calm and straight — this is a consent surface, it should feel honest, not playful. Content-writer, the copy carries that tone.',
  },
  'content-writer': {
    narration: ['Equal-commitment labels: "Accept analytics" / "Reject analytics" / "Choose individually". Body at Grade 6.'],
    artifact: { id: 'art_copy', name: 'Interface copy', status: 'staged', preview: 'Three equal-weight labels; body explains analytics plainly; points to Privacy settings.' },
    babble: 'Wrote three labels with equal commitment — don\'t restyle reject to look weaker, that undoes the symmetry. Over to you, design-lead.',
  },
  'design-lead': {
    narration: ['Single blue accent on Accept; Reject is an equal-size outline button, not a faint link — symmetry holds.'],
    artifact: { id: 'art_visual', name: 'Visual design', status: 'staged', preview: 'Calm neutral, single #2b5cd9 accent, equal-weight buttons, 44px targets, 12px radius.' },
    babble: 'Equal-weight Accept/Reject, labelled dialog pinned bottom, non-blocking. Keep it quiet, motion-designer — a consent surface shouldn\'t bounce.',
  },
  'motion-designer': {
    narration: ['Keeping it quiet — at most a 150ms fade-in, fully removed under prefers-reduced-motion. No looping.'],
    artifact: { id: 'art_motion', name: 'Motion spec', status: 'staged', preview: '150ms fade-in; reduced-motion removes it; no attention-grabbing movement.' },
    babble: 'Quiet fade, reduced-motion safe. Don\'t animate focus movement. Builder — wire it with the content-writer\'s exact strings.',
  },
  'design-builder': {
    narration: ['Built consent-banner.html with the exact strings — role=dialog, aria-labelledby, 44px targets, :focus-visible ring.'],
    artifact: { id: 'art_build', name: 'consent-banner.html', status: 'staged', preview: 'role=dialog + aria-labelledby/describedby, focusable container, reduced-motion handled.' },
    babble: 'Built to spec. One thing to check: aria-modal is false (non-blocking) — confirm that\'s right for screen-reader flow. Reviewers, over to you.',
  },
  'design-critic': {
    narration: ['Matches the "honest by default" brief; symmetry intact. Minor: body could name retention — logged to debt, not fixed now.'],
    babble: 'Proceed with fixes — symmetry holds, copy is plain. Accessibility-reviewer, your turn on the focus and contrast.',
  },
  'accessibility-reviewer': {
    narration: ['Contrast all AA; role/labelling correct; targets ≥44px. One finding: build must move focus to the dialog on load.'],
    artifact: { id: 'art_a11y', name: 'Accessibility evidence', status: 'staged', preview: 'All pairings WCAG AA PASS; structural checks PASS; focus-on-load flagged to confirm.' },
    babble: 'Pass with one finding — confirm focus-on-load or SR users may never reach it. Heuristic-evaluator, check the flow.',
  },
  'heuristic-evaluator': {
    narration: ['9/10. H2/H4/H6 strong — plain language, consistent, recognition over recall. Note: "Choose individually" must wire to real settings.'],
    babble: 'Strong overall. One H-note: the "Choose individually" stub must lead somewhere real before ship. Back to you, design-lead, to close out.',
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
