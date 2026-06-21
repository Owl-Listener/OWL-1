// canUseTool policies — the heart of the spike.
//
// Both functions have the EXACT signature of the Claude Agent SDK `canUseTool`
// option:  (toolName, input, context) -> PermissionResult
//   PermissionResult = { behavior: 'allow', updatedInput? } | { behavior: 'deny', message }
//
// The runner treats "dispatch the next agent" as a `Task` tool use. Whether a run
// is Auto or Human mode is decided ENTIRELY by which policy you hand the runner —
// the runner code is identical either way. That is the thesis this spike proves,
// and it is exactly how the real backend will gate a live Designpowers run.

import { AgentStatus, nextMessageId } from './oap.mjs';

// AUTO mode: every dispatch is allowed immediately. The pipeline never pauses.
export const autoCanUseTool = async () => ({ behavior: 'allow' });

// HUMAN mode: open a gate, emit gate.opened, and AWAIT an external decision.
// This is the staged-approval model — OWL-1's "✓ APPROVE + CONTINUE" button
// resolves the awaited promise.
export function makeHumanCanUseTool(session, gates) {
  return async (toolName, input, _ctx) => {
    const agentId = input.subagent_type;

    const { id, decision } = gates.request({ toolName, input });

    // Surface the pause in the UI: the receiving agent is now "awaiting".
    session.emitEvent('agent.status', {
      id: agentId,
      status: AgentStatus.AWAITING,
      waiting: 'AWAITING INPUT',
      confidence: 'inferred',
    });
    session.emitEvent('gate.opened', {
      gateId: id,
      agentId,
      kind: 'handoff',
      fromAgent: input.fromAgent,
      stage: input.stage,
      context: `Dispatch ${agentId} (handoff from ${input.fromAgent})?`,
    });

    // *** The run blocks on this line until the UI/test resolves the gate. ***
    const d = await decision;

    session.emitEvent('gate.closed', { gateId: id, agentId, resolution: d.action });

    switch (d.action) {
      case 'approve':
        return { behavior: 'allow' };
      case 'skip':
        return { behavior: 'deny', message: d.note || 'skipped by user' };
      case 'redirect':
        return { behavior: 'deny', message: `redirect to ${d.toAgentId || 'previous agent'}` };
      case 'correct':
      case 'add':
        // A steer mutates the brief the agent receives (SDK: updatedInput).
        session.emitEvent('message', {
          id: nextMessageId(),
          kind: 'system',
          text: `User steer into ${agentId}: ${d.note}`,
          stage: input.stage,
        });
        return { behavior: 'allow', updatedInput: { ...input, note: d.note } };
      default:
        return { behavior: 'allow' };
    }
  };
}
