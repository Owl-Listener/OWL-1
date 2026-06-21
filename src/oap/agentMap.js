// Binding between Designpowers/OAP agent ids (slugs) and OWL-1's internal ids.
// This is the agent-id half of the "Designpowers binding" in the protocol doc.

export const OWL_ID_BY_OAP = {
  'design-lead': 'lead',
  'design-scout': 'discovery',
  'design-strategist': 'strategy',
  'inspiration-scout': 'taste',
  'content-writer': 'content',
  'motion-designer': 'motion',
  'design-builder': 'builder',
  'design-critic': 'critic',
  'accessibility-reviewer': 'a11y',
  'heuristic-evaluator': 'heuristic',
};

export const OAP_ID_BY_OWL = Object.fromEntries(
  Object.entries(OWL_ID_BY_OAP).map(([oap, owl]) => [owl, oap]),
);

export const owlIdFor = (oapId) => OWL_ID_BY_OAP[oapId] || oapId;
export const oapIdFor = (owlId) => OAP_ID_BY_OWL[owlId] || owlId;

// Map an OAP AgentStatus to a 0..1 activity value the OWL-1 waveform/getStatus
// machinery understands. 'awaiting'/'blocked' read as "running" so the existing
// lane UI surfaces the AWAITING/attention state without new plumbing.
const ACTIVITY_BY_STATUS = {
  running: 0.9,
  awaiting: 0.9,
  blocked: 0.7,
  online: 0.35,
  done: 0,
  idle: 0,
  skipped: 0,
};

export function activityForStatus(status, fallback = 0) {
  return ACTIVITY_BY_STATUS[status] ?? fallback;
}

// Derive an OWL-1-keyed runtime map from reduced OAP state:
//   { [owlId]: { activity, status, waiting } }
export function deriveOwlAgents(oapState) {
  const out = {};
  for (const oapId of Object.keys(oapState.agents)) {
    const a = oapState.agents[oapId];
    const owlId = owlIdFor(oapId);
    out[owlId] = {
      status: a.status,
      waiting: a.waiting || null,
      activity: typeof a.activity === 'number' ? a.activity : activityForStatus(a.status),
    };
  }
  return out;
}
