// OWL Agent Protocol — pure frontend reducer.
// Folds the OAP event stream (see docs/owl-agent-protocol.md) into the normalized
// state the OWL-1 UI renders. No React, no DOM — unit-testable in plain Node.

export function initialOapState() {
  return {
    mode: 'stop', // 'auto' | 'human' | 'stop'
    stage: null, // current pipeline stage id
    agents: {}, // oapId -> { id, name, stage, handsTo, status, activity, waiting }
    messages: [], // { id, kind, from, to, text, stage }
    artifacts: [], // { id, name, status, agent, preview, ... }
    blockers: [], // { id, agent, severity, text, cta, stage }
    gates: [], // { gateId, agentId, kind, fromAgent, context, stage }
    finished: false,
    seq: 0,
  };
}

const MAX_MESSAGES = 60;

// Apply one OAP envelope. Returns a NEW state object (immutably).
export function oapReduce(state, env) {
  if (!env || typeof env.type !== 'string') return state;
  const p = env.payload || {};
  const next = { ...state, seq: env.seq ?? state.seq };

  switch (env.type) {
    case 'snapshot':
      // Full-state hydrate / gap recovery.
      return { ...initialOapState(), ...p, seq: env.seq ?? 0 };

    case 'run.started':
      return {
        ...initialOapState(),
        mode: p.mode ?? 'stop',
        seq: env.seq ?? 0,
      };

    case 'run.mode':
      next.mode = p.mode ?? state.mode;
      return next;

    case 'run.finished':
      next.finished = true;
      return next;

    case 'stage.changed':
      next.stage = p.id ?? state.stage;
      return next;

    case 'agent.status': {
      if (!p.id) return state;
      const prev = state.agents[p.id] || { id: p.id };
      next.agents = { ...state.agents, [p.id]: { ...prev, ...p } };
      return next;
    }

    case 'agent.activity': {
      if (!p.id) return state;
      const prev = state.agents[p.id] || { id: p.id };
      next.agents = { ...state.agents, [p.id]: { ...prev, activity: p.activity } };
      return next;
    }

    case 'message':
      next.messages = [...state.messages, p].slice(-MAX_MESSAGES);
      return next;

    case 'artifact.created':
      next.artifacts = [...state.artifacts, p];
      return next;

    case 'artifact.updated':
      next.artifacts = state.artifacts.map((a) => (a.id === p.id ? { ...a, ...p } : a));
      return next;

    case 'blocker.raised':
      next.blockers = [...state.blockers.filter((b) => b.id !== p.id), p];
      return next;

    case 'blocker.cleared':
      next.blockers = state.blockers.filter((b) => b.id !== p.id);
      return next;

    case 'gate.opened':
      next.gates = [...state.gates.filter((g) => g.gateId !== p.gateId), p];
      return next;

    case 'gate.closed':
      next.gates = state.gates.filter((g) => g.gateId !== p.gateId);
      return next;

    default:
      return state; // telemetry.tick, memory.changed, command.* — ignored by this slice
  }
}

// Convenience: fold an array of envelopes from a fresh state.
export function oapReduceAll(envelopes, from = initialOapState()) {
  return envelopes.reduce(oapReduce, from);
}
