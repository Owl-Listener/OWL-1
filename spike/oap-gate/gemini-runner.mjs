// THE GEMINI BACKEND. Runs Designpowers on Google Gemini via the @google/genai SDK,
// and emits the same OAP event stream OWL-1 already consumes. Drop-in alternative to
// sdk-runner.runDesignpowers (Claude) — selected by OWL_BACKEND=gemini in live-server.
//
// Why the API (not the Gemini CLI): the CLI is being retired (June 2026) and its
// successor is closed-source; and only by owning the function-calling loop ourselves
// can we PAUSE a subagent dispatch for human approval (Google's docs: tool execution
// "happens outside the scope of the API"). So OWL-1 *is* the orchestrator here:
//   - a lead model decides the pipeline and dispatches subagents via a `dispatch_agent`
//     function call → we GATE that call (the approval gate) → on approve we run the
//     subagent as its own Gemini call with that agent's markdown as the system prompt;
//   - subagents get write_file/read_file tools so they produce real design-state.md +
//     artifacts, exactly like the Claude backend.
//
// Requires GEMINI_API_KEY and `npm install` (pulls @google/genai). Imported dynamically
// so the module loads fine without the SDK. The exact @google/genai response shape is
// the thing to confirm on the first real run; the parsing here is defensive.
// Docs: https://ai.google.dev/gemini-api/docs/function-calling

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, normalize, dirname } from 'node:path';
import { AgentStatus, nextMessageId } from './oap.mjs';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// USD per token, from published per-1M pricing (Gemini returns token counts, not cost).
const PRICING = {
  'gemini-2.5-flash': { in: 0.30 / 1e6, out: 2.5 / 1e6 },
  'gemini-2.5-pro': { in: 1.25 / 1e6, out: 10 / 1e6 },
};
const rate = PRICING[MODEL] || PRICING['gemini-2.5-flash'];

const STAGE_BY_AGENT = {
  'design-scout': 'discover', 'design-strategist': 'strategy', 'inspiration-scout': 'taste',
  'content-writer': 'design', 'design-lead': 'design', 'motion-designer': 'design',
  'design-builder': 'design', 'design-critic': 'verify', 'accessibility-reviewer': 'verify',
  'heuristic-evaluator': 'verify',
};
const prettyName = (id) => String(id || '').split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');

function fail(session, text) {
  session.emitEvent('message', { id: nextMessageId(), kind: 'system', text });
  session.emitEvent('run.finished', { summary: 'Could not start Gemini run.' });
}

export async function runDesignpowersGemini({ session, gates, brief, mode, workspace, inputQueue, automated = false, cap = 0, signal = null }) {
  const aborted = () => !!signal?.aborted;
  let GoogleGenAI;
  try {
    ({ GoogleGenAI } = await import('@google/genai'));
  } catch {
    return fail(session, 'The Gemini SDK is not installed. Run `npm install`, then try again.');
  }
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return fail(session, 'No GEMINI_API_KEY set. Add your key and restart: GEMINI_API_KEY=... OWL_BACKEND=gemini npm start');

  const ai = new GoogleGenAI({ apiKey });
  const agentsDir = join(workspace, '.claude', 'agents');
  let agentIds = [];
  try { agentIds = (await readdir(agentsDir)).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')); } catch {}
  if (!agentIds.length) agentIds = Object.keys(STAGE_BY_AGENT);

  session.emitEvent('run.started', {
    mode, lane: 'build', projectId: 'designpowers-gemini',
    capabilities: { stream: true, artifacts: true, pauseMidRun: true, steer: true, telemetry: true },
  });
  for (const id of agentIds) {
    session.emitEvent('agent.status', { id, name: prettyName(id), stage: STAGE_BY_AGENT[id], status: AgentStatus.IDLE, confidence: 'inferred' });
  }

  let totalIn = 0, totalOut = 0, capped = false, askSeq = 0;
  const cumCost = () => totalIn * rate.in + totalOut * rate.out;
  const addUsage = (u, agentId) => {
    if (!u) return;
    const i = u.promptTokenCount || 0, o = u.candidatesTokenCount || 0;
    totalIn += i; totalOut += o;
    session.emitEvent('telemetry.tick', { agentId, inputTokens: i, outputTokens: o, costUsd: i * rate.in + o * rate.out });
  };
  // Spend cap (USD): stop before the next dispatch once cumulative cost reaches it.
  const overCap = () => cap > 0 && cumCost() >= cap;
  const flagCap = () => {
    if (capped) return; capped = true;
    const spent = cumCost();
    session.emitEvent('blocker.raised', { id: 'blk_cap', agent: 'design-lead', severity: 'warn', text: `Spend cap reached ($${spent.toFixed(2)} / $${cap.toFixed(2)}) — run stopped.`, cta: 'RESOLVE' });
    session.emitEvent('message', { id: nextMessageId(), kind: 'system', text: `⚠ Spend cap of $${cap.toFixed(2)} reached ($${spent.toFixed(2)}). Stopping the run.` });
  };

  // --- file tools given to subagents (sandboxed to the workspace) ---
  const wsRoot = normalize(workspace);
  const safePath = (p) => {
    const fp = normalize(join(workspace, p));
    if (!fp.startsWith(wsRoot)) throw new Error('path outside workspace');
    return fp;
  };
  const fileTools = [{ functionDeclarations: [
    { name: 'write_file', description: 'Write/overwrite a project file (e.g. design-state.md, output/component.html).', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
    { name: 'read_file', description: 'Read a project file. Returns contents or NOT_FOUND.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'ask_director', description: 'Ask the human director a question — ONLY when you need a decision only they can make (e.g. brand colours, an unresolved trade-off). Returns their answer. Do not use for routine work.', parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } },
  ] }];
  async function execFileTool(call, agentId) {
    const a = call.args || {};
    if (call.name === 'write_file') {
      try {
        const fp = safePath(a.path);
        await mkdir(dirname(fp), { recursive: true });
        await writeFile(fp, a.content ?? '');
        const name = String(a.path).split('/').pop();
        if (/design-state\.md$/.test(a.path)) session.emitEvent('message', { id: nextMessageId(), kind: 'system', text: 'design-state.md updated', stage: STAGE_BY_AGENT[agentId] });
        else session.emitEvent('artifact.created', { id: `art_${name}`, name, status: 'staged', agent: agentId, url: `/artifacts/${name}` });
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    if (call.name === 'read_file') {
      try { return { content: await readFile(safePath(a.path), 'utf8') }; } catch { return { content: 'NOT_FOUND' }; }
    }
    if (call.name === 'ask_director') {
      const q = (a.question || 'I need your input.').trim();
      const bid = `blk_ask_${++askSeq}`;
      // Surface the question to the UI (the "needs your input" blocker) and wait for the
      // director's next chat message as the answer.
      session.emitEvent('blocker.raised', { id: bid, agent: agentId, severity: 'input', text: q, cta: 'RESPOND', stage: STAGE_BY_AGENT[agentId] });
      session.emitEvent('message', { id: nextMessageId(), kind: 'system', text: `❓ ${prettyName(agentId)} asks: ${q}` });
      const next = await inputQueue.next();
      session.emitEvent('blocker.cleared', { id: bid });
      const answer = next?.done ? '(no answer provided — proceed with your best judgement)' : next.value;
      if (!next?.done) session.emitEvent('message', { id: nextMessageId(), kind: 'system', text: `You → ${prettyName(agentId)}: ${answer}` });
      return { answer };
    }
    return { error: 'unknown tool' };
  }

  const partsOf = (res) => res?.candidates?.[0]?.content?.parts || [];
  const callsOf = (parts) => parts.filter((p) => p.functionCall).map((p) => p.functionCall);
  const textOf = (parts) => parts.filter((p) => p.text).map((p) => p.text).join('').trim();

  // --- run one subagent as its own function-calling session ---
  async function runSubagent(agentId, taskBrief) {
    let sys = '';
    try { sys = await readFile(join(agentsDir, `${agentId}.md`), 'utf8'); } catch { sys = `You are ${prettyName(agentId)}, a design specialist.`; }
    sys += '\n\n--- Runtime ---\nYou run inside OWL-1. Use read_file to load design-state.md for context, do your part, then use write_file to save your output and update design-state.md (artifacts go under output/). If you genuinely need a decision only the director can make (e.g. brand colours, an unresolved trade-off), call ask_director and use the answer — otherwise proceed without asking. Finish with a 1–2 sentence handoff note.';
    session.emitEvent('stage.changed', { id: STAGE_BY_AGENT[agentId], active: true });
    session.emitEvent('agent.status', { id: agentId, status: AgentStatus.RUNNING, activity: 0.9, confidence: 'inferred' });

    const contents = [{ role: 'user', parts: [{ text: taskBrief }] }];
    let finalText = '';
    for (let step = 0; step < 8; step++) {
      if (aborted()) break;
      const res = await ai.models.generateContent({ model: MODEL, contents, config: { systemInstruction: sys, tools: fileTools, abortSignal: signal } });
      addUsage(res.usageMetadata, agentId);
      const parts = partsOf(res);
      const calls = callsOf(parts);
      const text = textOf(parts);
      if (text) { finalText = text; session.emitEvent('message', { id: nextMessageId(), kind: 'narration', from: agentId, to: null, text, stage: STAGE_BY_AGENT[agentId] }); }
      if (!calls.length) break;
      contents.push({ role: 'model', parts: calls.map((c) => ({ functionCall: c })) });
      const responses = [];
      for (const c of calls) responses.push({ functionResponse: { name: c.name, response: await execFileTool(c, agentId) } });
      contents.push({ role: 'user', parts: responses });
    }
    session.emitEvent('agent.status', { id: agentId, status: AgentStatus.DONE, activity: 0, confidence: 'inferred' });
    return finalText || `${prettyName(agentId)} completed.`;
  }

  // --- orchestrator (the lead model drives the pipeline) ---
  const dispatchTool = [{ functionDeclarations: [
    { name: 'dispatch_agent', description: 'Dispatch one Designpowers specialist subagent for the next piece of work. Call ONE AT A TIME, in pipeline order.', parameters: { type: 'object', properties: { agent: { type: 'string', enum: agentIds, description: 'subagent id' }, brief: { type: 'string', description: 'what this agent should do, with context' } }, required: ['agent', 'brief'] } },
  ] }];
  let workflow = '';
  try { workflow = await readFile(join(workspace, '.claude', 'skills', 'using-designpowers', 'SKILL.md'), 'utf8'); } catch {}
  const orchSys =
    `You are the Designpowers orchestrator inside OWL-1. You DIRECT a team of design subagents — you do not do the detailed work yourself. Run a sensible pipeline (discover → strategy → taste → design → build → review) by calling dispatch_agent ONE AT A TIME. Before each dispatch, write a short handoff note (2–3 sentences) addressed to the next agent by name. Available agents: ${agentIds.join(', ')}. When the work is built and reviewed, STOP calling dispatch_agent and give a 2–3 sentence final summary.` +
    (automated ? ' Do not ask the user questions; treat the first message as the approved brief and begin immediately.' : '') +
    `\n\n=== WORKFLOW REFERENCE ===\n${workflow.slice(0, 6000)}`;

  const contents = [{ role: 'user', parts: [{ text: brief }] }];
  try {
    for (let turn = 0; turn < 14; turn++) {
      if (aborted()) break;
      if (overCap()) { flagCap(); break; }
      const res = await ai.models.generateContent({ model: MODEL, contents, config: { systemInstruction: orchSys, tools: dispatchTool, abortSignal: signal } });
      addUsage(res.usageMetadata, 'design-lead');
      const parts = partsOf(res);
      const calls = callsOf(parts);
      const text = textOf(parts);
      if (text) session.emitEvent('message', { id: nextMessageId(), kind: 'handoff', from: 'design-lead', to: null, text });
      if (!calls.length) break; // orchestrator is done

      contents.push({ role: 'model', parts: calls.map((c) => ({ functionCall: c })) });
      const responses = [];
      for (const call of calls) {
        if (call.name !== 'dispatch_agent') { responses.push({ functionResponse: { name: call.name, response: { error: 'unknown tool' } } }); continue; }
        const agentId = call.args?.agent;
        const subBrief = call.args?.brief || brief;

        if (overCap()) {
          flagCap();
          responses.push({ functionResponse: { name: 'dispatch_agent', response: { result: 'Spend cap reached — not dispatched.' } } });
          continue;
        }

        let allowed = true;
        if (mode === 'human') {
          session.emitEvent('agent.status', { id: agentId, status: AgentStatus.AWAITING, waiting: 'AWAITING INPUT', confidence: 'inferred' });
          const { id, decision } = gates.request({ agentId });
          session.emitEvent('gate.opened', { gateId: id, agentId, kind: 'handoff', stage: STAGE_BY_AGENT[agentId], context: `Dispatch ${prettyName(agentId)}?` });
          const d = await decision;
          session.emitEvent('gate.closed', { gateId: id, agentId, resolution: d.action });
          allowed = d.action === 'approve';
        }
        if (!allowed) {
          session.emitEvent('agent.status', { id: agentId, status: AgentStatus.SKIPPED, confidence: 'inferred' });
          responses.push({ functionResponse: { name: 'dispatch_agent', response: { result: `Skipped ${agentId} by director.` } } });
          continue;
        }
        const result = await runSubagent(agentId, subBrief);
        responses.push({ functionResponse: { name: 'dispatch_agent', response: { result } } });
      }
      // Fold any director steering into the next turn as a user message.
      const steer = inputQueue?.drain ? inputQueue.drain() : [];
      for (const s of steer) {
        session.emitEvent('message', { id: nextMessageId(), kind: 'system', text: `You → team: ${s}` });
        responses.push({ text: `Director says: ${s}` });
      }
      contents.push({ role: 'user', parts: responses });
    }
  } catch (err) {
    if (!aborted()) session.emitEvent('message', { id: nextMessageId(), kind: 'system', text: `Run error: ${err?.message || err}` });
  } finally {
    if (inputQueue) inputQueue.close();
    session.emitEvent('run.finished', { summary: `Designpowers (Gemini) run ${aborted() ? 'cancelled' : 'complete'} — ~$${(totalIn * rate.in + totalOut * rate.out).toFixed(2)}.` });
  }
}
