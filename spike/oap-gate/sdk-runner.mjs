// THE REAL BACKEND. Runs Designpowers for real via the Claude Agent SDK and
// translates the live run into the OAP event stream OWL-1 already consumes.
//
// This replaces mock-designpowers.dispatchAgent. Nothing in the protocol, the OAP
// reducer, the SSE relay, or the OWL-1 UI changes — only the source of the events.
//
// Requires: ANTHROPIC_API_KEY in the environment, and `npm install` (which pulls
// @anthropic-ai/claude-agent-sdk). The SDK is imported dynamically so this module
// loads fine without it (the mock demo still runs offline).
//
// Docs: https://code.claude.com/docs/en/agent-sdk/overview

import { AgentStatus, nextMessageId } from './oap.mjs';

// Designpowers agent id -> OWL-1 pipeline stage (for stage.changed events).
const STAGE_BY_AGENT = {
  'design-scout': 'discover',
  'design-strategist': 'strategy',
  'inspiration-scout': 'taste',
  'content-writer': 'design',
  'design-lead': 'design',
  'motion-designer': 'design',
  'design-builder': 'design',
  'design-critic': 'verify',
  'accessibility-reviewer': 'verify',
  'heuristic-evaluator': 'verify',
};

const prettyName = (id) =>
  String(id || '')
    .split('-')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');

// A tiny async queue: the UI pushes director messages, the SDK prompt generator pulls.
export class InputQueue {
  constructor() {
    this._items = [];
    this._waiters = [];
    this._closed = false;
  }
  push(item) {
    if (this._closed) return;
    const w = this._waiters.shift();
    if (w) w({ value: item, done: false });
    else this._items.push(item);
  }
  close() {
    this._closed = true;
    while (this._waiters.length) this._waiters.shift()({ value: undefined, done: true });
  }
  next() {
    if (this._items.length) return Promise.resolve({ value: this._items.shift(), done: false });
    if (this._closed) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve) => this._waiters.push(resolve));
  }
  // Non-blocking: take everything queued right now (used by the Gemini runner to
  // fold director steering in between turns without awaiting).
  drain() {
    const out = this._items;
    this._items = [];
    return out;
  }
  [Symbol.asyncIterator]() {
    return this;
  }
}

// Run a real Designpowers session.
//   session   : OapSession (event sink)
//   gates     : GateController (handoff approval, in human mode)
//   brief     : the designer's initial brief (string)
//   mode      : 'human' (approve each handoff) | 'auto'
//   workspace : path to .dp-workspace (cwd the SDK loads Designpowers from)
//   inputQueue: InputQueue the UI feeds director messages into (mid-run steering)
export async function runDesignpowers({ session, gates, brief, mode, workspace, inputQueue, automated = false }) {
  let query;
  try {
    ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  } catch {
    session.emitEvent('message', {
      id: nextMessageId(),
      kind: 'system',
      text: 'The Claude Agent SDK is not installed. Run `npm install`, then try again.',
    });
    session.emitEvent('run.finished', { summary: 'SDK not installed.' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    session.emitEvent('message', {
      id: nextMessageId(),
      kind: 'system',
      text: 'No ANTHROPIC_API_KEY set. Add your key and restart: ANTHROPIC_API_KEY=sk-... npm start',
    });
    session.emitEvent('run.finished', { summary: 'No API key.' });
    return;
  }

  session.emitEvent('run.started', {
    mode,
    lane: 'build',
    projectId: 'designpowers-run',
    capabilities: { stream: true, artifacts: true, pauseMidRun: true, steer: true, telemetry: true },
  });

  // The prompt is a streaming async iterable: first the brief, then whatever the
  // designer types mid-run (the "leave feedback along the way" path).
  async function* prompt() {
    yield { type: 'user', message: { role: 'user', content: brief } };
    for await (const text of inputQueue) {
      session.emitEvent('message', { id: nextMessageId(), kind: 'system', text: `You → team: ${text}` });
      yield { type: 'user', message: { role: 'user', content: text } };
    }
  }

  let currentAgent = null;
  const announce = (id) => {
    if (!session.agentsSeen?.has(id)) {
      (session.agentsSeen ||= new Set()).add(id);
      session.emitEvent('agent.status', { id, name: prettyName(id), stage: STAGE_BY_AGENT[id], status: AgentStatus.IDLE, confidence: 'inferred' });
    }
  };

  // canUseTool: allow everything EXCEPT subagent dispatch in human mode, which we
  // gate. Returning a Promise holds the agentic loop until OWL-1 approves — this is
  // Designpowers' Direct mode, expressed through OWL-1's APPROVE button.
  // NOTE: in the Claude Code runtime, tool permissioning flows through PreToolUse
  // hooks, not canUseTool (verified empirically — canUseTool is called 0 times).
  // So the handoff GATE and dispatch detection live in the PreToolUse hook below.
  // canUseTool is kept only as a harmless fallback + to skip interactive questions
  // in automated runs.
  const canUseTool = async (tool, input) => {
    if (automated && tool === 'AskUserQuestion') {
      return { behavior: 'deny', message: 'Automated run — proceed using the brief; do not ask.' };
    }
    return { behavior: 'allow', updatedInput: input };
  };

  function announceDispatch(agentId) {
    announce(agentId);
    currentAgent = agentId;
    session.emitEvent('stage.changed', { id: STAGE_BY_AGENT[agentId], active: true });
    session.emitEvent('agent.status', { id: agentId, status: AgentStatus.RUNNING, activity: 0.9, confidence: 'inferred' });
  }

  // The handoff gate, run from PreToolUse. In human mode it pauses the dispatch
  // (the hook is awaited) until OWL-1 sends approval. Returns 'allow' | 'deny'.
  async function gateDispatch(agentId) {
    announce(agentId);
    session.emitEvent('agent.status', { id: agentId, status: AgentStatus.AWAITING, waiting: 'AWAITING INPUT', confidence: 'inferred' });
    const { id, decision } = gates.request({ agentId });
    session.emitEvent('gate.opened', { gateId: id, agentId, kind: 'handoff', stage: STAGE_BY_AGENT[agentId], context: `Dispatch ${prettyName(agentId)}?` });
    const d = await decision;
    session.emitEvent('gate.closed', { gateId: id, agentId, resolution: d.action });
    return d.action === 'approve' ? 'allow' : 'deny';
  }

  const options = {
    cwd: workspace,
    settingSources: ['project'], // loads .claude/agents, .claude/skills, CLAUDE.md
    permissionMode: 'default', // so canUseTool is the decider
    canUseTool,
    appendSystemPrompt:
      'You are orchestrating the Designpowers team inside OWL-1. Run the using-designpowers ' +
      'workflow. When you hand off between agents, write the short conversational babble ' +
      'addressed to the next agent by name, as Designpowers specifies. Keep the shared state at ' +
      './design-state.md (the working-directory root) updated, and write any built artifacts ' +
      '(HTML, images) into ./output/. The human directing you is the creative director — incorporate their messages.' +
      (automated
        ? ' AUTOMATED RUN: do not show the welcome screen or walkthrough, and do not ask ' +
          'clarifying questions — treat the first message as the already-approved brief and ' +
          'begin the build pipeline immediately, dispatching subagents via the Task tool ' +
          '(design-scout, design-strategist, design-lead, design-builder, and the reviewers). ' +
          'Write decisions and the handoff chain into design-state.md as you go.'
        : ''),
    hooks: {
      // Dispatch detection + handoff gate. tool=Agent, tool_input.subagent_type.
      PreToolUse: [
        {
          matcher: 'Agent|Task',
          hooks: [
            async (hookInput) => {
              const agentId = hookInput?.tool_input?.subagent_type || 'agent';
              if (mode === 'human') {
                const verdict = await gateDispatch(agentId);
                if (verdict === 'deny') {
                  session.emitEvent('agent.status', { id: agentId, status: AgentStatus.SKIPPED, confidence: 'inferred' });
                  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Skipped by director.' } };
                }
              }
              announceDispatch(agentId);
              return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } };
            },
          ],
        },
      ],
      // Subagent finished. Real fields: agent_type, last_assistant_message.
      SubagentStop: [
        {
          hooks: [
            async (hookInput) => {
              const id = hookInput?.agent_type || hookInput?.subagent_type || currentAgent;
              if (!id) return {};
              const last = hookInput?.last_assistant_message;
              const text = typeof last === 'string' ? last : last?.content?.find?.((b) => b.type === 'text')?.text;
              if (text && text.trim()) {
                session.emitEvent('message', { id: nextMessageId(), kind: 'handoff', from: id, to: null, text: text.trim().slice(0, 600), stage: STAGE_BY_AGENT[id] });
              }
              session.emitEvent('agent.status', { id, status: AgentStatus.DONE, activity: 0, confidence: 'inferred' });
              return {};
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [
            async (hookInput) => {
              const fp = hookInput?.tool_input?.file_path || '';
              if (/design-state\.md$/.test(fp)) {
                session.emitEvent('message', { id: nextMessageId(), kind: 'system', text: 'design-state.md updated', stage: STAGE_BY_AGENT[currentAgent] });
              } else if (fp) {
                const name = fp.split('/').pop();
                session.emitEvent('artifact.created', { id: `art_${name}`, name, status: 'staged', agent: currentAgent, url: `/artifacts/${name}` });
              }
              return {};
            },
          ],
        },
      ],
    },
  };

  try {
    for await (const msg of query({ prompt: prompt(), options })) {
      translate(msg, session, () => currentAgent);
      // A `result` marks the end of the orchestrator's pass. Close the input stream
      // so the run completes (and emits run.finished) instead of hanging open
      // forever waiting for more director messages.
      if (msg.type === 'result') inputQueue.close();
    }
  } catch (err) {
    session.emitEvent('message', { id: nextMessageId(), kind: 'system', text: `Run error: ${err?.message || err}` });
  } finally {
    inputQueue.close();
    session.emitEvent('run.finished', { summary: 'Designpowers run complete.' });
  }
}

// Map one SDK message to OAP events. Defensive about field shapes — the exact
// SDK message schema is the thing to confirm on first real run.
function translate(msg, session, getCurrent) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'assistant' && msg.message?.content) {
    for (const block of msg.message.content) {
      if (block.type === 'text' && block.text?.trim()) {
        session.emitEvent('message', { id: nextMessageId(), kind: 'narration', from: getCurrent(), to: null, text: block.text.trim() });
      }
    }
  }

  if (msg.type === 'result') {
    const u = msg.usage || {};
    session.emitEvent('telemetry.tick', {
      agentId: getCurrent(),
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      costUsd: msg.total_cost_usd ?? msg.cost ?? 0,
    });
  }
}
