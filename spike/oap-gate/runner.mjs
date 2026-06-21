// The gated agent runner. Runs the slice and emits OAP events.
//
// The ONLY thing that differs between Auto and Human mode is the `canUseTool`
// policy passed in (see policies.mjs). This runner has no idea whether it's
// pausing for a human — it just asks permission before each handoff dispatch,
// exactly as the Claude Agent SDK asks permission before a Task tool use.

import { AgentStatus, nextMessageId } from './oap.mjs';
import { slice as defaultSlice, dispatchAgent } from './mock-designpowers.mjs';

export async function runSlice({ session, mode, canUseTool, agents = defaultSlice }) {
  session.emitEvent('run.started', {
    mode,
    lane: 'build',
    projectId: 'aurora-consent',
    capabilities: { stream: true, artifacts: true, pauseMidRun: true, steer: true, telemetry: false },
  });

  // Announce the roster + graph (Nodes view / lanes).
  for (const a of agents) {
    session.emitEvent('agent.status', {
      id: a.id,
      name: a.name,
      stage: a.stage,
      handsTo: a.handsTo,
      status: AgentStatus.IDLE,
      confidence: 'inferred',
    });
  }

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const next = agents[i + 1];

    // GATE: dispatching this agent is a Task tool use that must be permitted.
    // The first agent (i === 0) starts the run; every later agent is a handoff
    // from the previous one, so that's where the human gate lives.
    if (i > 0) {
      const prev = agents[i - 1];
      const decision = await canUseTool(
        'Task',
        { subagent_type: a.id, fromAgent: prev.id, stage: a.stage },
        { session, prev, nextAgent: a },
      );

      if (decision.behavior === 'deny') {
        session.emitEvent('agent.status', { id: a.id, status: AgentStatus.SKIPPED, confidence: 'inferred' });
        session.emitEvent('message', {
          id: nextMessageId(),
          kind: 'system',
          text: `Skipped ${a.name}: ${decision.message || 'user direction'}`,
          stage: a.stage,
        });
        continue;
      }
    }

    session.emitEvent('stage.changed', { id: a.stage, active: true });
    session.emitEvent('agent.status', {
      id: a.id,
      status: AgentStatus.RUNNING,
      activity: 0.9,
      confidence: 'inferred',
    });

    await dispatchAgent(a.id, {
      onNarrate: (text) =>
        session.emitEvent('message', { id: nextMessageId(), kind: 'narration', from: a.id, to: null, text, stage: a.stage }),
      onArtifact: (art) =>
        session.emitEvent('artifact.created', { ...art, agent: a.id }),
      onBabble: (text) =>
        session.emitEvent('message', {
          id: nextMessageId(),
          kind: 'handoff',
          from: a.id,
          to: next?.id || a.handsTo?.[0] || null,
          text,
          stage: a.stage,
        }),
    });

    session.emitEvent('agent.status', { id: a.id, status: AgentStatus.DONE, activity: 0, confidence: 'inferred' });
  }

  session.emitEvent('run.finished', {
    summary: 'Slice complete (design-strategist → design-lead).',
  });
}
