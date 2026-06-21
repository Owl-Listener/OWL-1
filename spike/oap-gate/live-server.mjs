// The real OWL-1 server: serves the built app and runs Designpowers for real via the
// Claude Agent SDK. The designer directs from inside OWL-1 — their first message is the
// brief that starts the run; later messages steer it; APPROVE releases each handoff.
//
//   ANTHROPIC_API_KEY=sk-...  npm start
//   open http://localhost:4318/?source=live
//
// Falls back to a friendly in-UI message if the key or SDK is missing.

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { OapSession } from './oap.mjs';
import { GateController } from './gate-controller.mjs';
import { runDesignpowers, InputQueue } from './sdk-runner.mjs';

const PORT = process.env.PORT || 4318;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(ROOT, 'dist');
const WORKSPACE = join(ROOT, '.dp-workspace');
const ARTIFACTS = join(WORKSPACE, 'output');
const AGENTS_DIR = join(WORKSPACE, '.claude', 'agents'); // what the SDK loads
const VENDOR_AGENTS = join(ROOT, 'vendor', 'designpowers', 'agents'); // persists in the pack
const CUSTOM_JSON = join(WORKSPACE, 'custom-agents.json'); // roster registry for the UI

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.png': 'image/png', '.html.': 'text/html',
};

const clients = new Set();
let session = null;
let gates = null;
let inputQueue = null;
let running = false;
let runGen = 0; // bumps on reset so a stale run's events stop broadcasting

function broadcast(env) {
  const line = `data: ${JSON.stringify(env)}\n\n`;
  for (const res of clients) res.write(line);
}

function startRun(brief, mode = 'human') {
  if (running) return;
  running = true;
  const gen = ++runGen;
  session = new OapSession(`run_${Date.now()}`);
  gates = new GateController();
  inputQueue = new InputQueue();
  session.on('event', (env) => {
    if (gen !== runGen) return; // a New Project reset superseded this run
    broadcast(env);
    if (env.type === 'run.finished') running = false;
  });
  // OWL-1 is the onboarding UI, so always skip Designpowers' text welcome and
  // blocking questions; `mode` still controls the per-handoff approval gate.
  runDesignpowers({ session, gates, brief, mode, workspace: WORKSPACE, inputQueue, automated: true });
}

// New Project: drop the current run so the next brief starts a fresh one.
function resetRun() {
  runGen++; // stale events from any in-flight run are now ignored
  if (inputQueue) inputQueue.close();
  running = false;
  gates = null;
  session = null;
  broadcast({ v: 1, type: 'run.reset', seq: 0, ts: new Date().toISOString(), payload: {} });
}

const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Create a real Designpowers subagent: write its markdown into the workspace (so the
// SDK loads it next run) and into the vendored team (so it persists), and register it
// for the UI roster.
async function createAgent(a) {
  const id = a && a.name ? slugify(a.name) : '';
  if (!id) return false;
  const md =
    `---\nname: ${id}\n` +
    `description: ${(a.desc || a.role || 'Custom design agent').replace(/\n/g, ' ')}. ` +
    `Dispatch in the ${a.stage || 'design'} stage.\nmodel: sonnet\n---\n\n` +
    `# ${a.name}\n\n${a.prompt || 'You are a custom design agent. Do focused, high-craft work and write a short handoff note when done.'}\n`;
  try {
    await mkdir(AGENTS_DIR, { recursive: true });
    await writeFile(join(AGENTS_DIR, `${id}.md`), md);
    await mkdir(VENDOR_AGENTS, { recursive: true });
    await writeFile(join(VENDOR_AGENTS, `${id}.md`), md);
    let reg = [];
    try { reg = JSON.parse(await readFile(CUSTOM_JSON, 'utf8')); } catch {}
    reg = reg.filter((x) => x.id !== id);
    reg.push({ id, name: a.name, desc: a.desc || a.role || '', stage: a.stage || 'design', handsTo: a.handsTo || [] });
    await writeFile(CUSTOM_JSON, JSON.stringify(reg, null, 2));
    return id;
  } catch {
    return false;
  }
}

async function handleCommand(cmd) {
  switch (cmd?.type) {
    case 'run.start':
      if (cmd.brief?.trim()) startRun(cmd.brief.trim(), cmd.mode || 'human');
      return true;
    case 'run.reset':
      resetRun();
      return true;
    case 'agent.create':
      return await createAgent(cmd.agent);
    case 'agent.ask':
    case 'agent.correct':
    case 'agent.add':
      if (inputQueue && cmd.text?.trim()) inputQueue.push(cmd.text.trim());
      return !!inputQueue;
    case 'gate.approve':
      return gates ? gates.resolve(cmd.gateId, { action: 'approve' }) : false;
    case 'gate.skip':
      return gates ? gates.resolve(cmd.gateId, { action: 'skip', note: cmd.note }) : false;
    default:
      return false;
  }
}

async function serveFile(res, base, rel, fallbackIndex) {
  const filePath = normalize(join(base, rel));
  if (!filePath.startsWith(base)) return res.writeHead(403).end();
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    if (fallbackIndex && !extname(filePath)) {
      try {
        const body = await readFile(join(DIST, 'index.html'));
        return res.writeHead(200, { 'content-type': MIME['.html'] }).end(body);
      } catch {}
    }
    res.writeHead(404).end('not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/agents') {
    let reg = [];
    try { reg = JSON.parse(await readFile(CUSTOM_JSON, 'utf8')); } catch {}
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reg));
    return;
  }

  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url.pathname === '/command' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let ok = false;
      try { ok = await handleCommand(JSON.parse(body || '{}')); } catch {}
      res.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' }).end(JSON.stringify({ ok }));
    });
    return;
  }

  if (url.pathname.startsWith('/artifacts/')) {
    return serveFile(res, ARTIFACTS, url.pathname.replace('/artifacts/', '/'), false);
  }

  serveFile(res, DIST, url.pathname === '/' ? '/index.html' : url.pathname, true);
});

server.listen(PORT, () => {
  const keyed = !!process.env.ANTHROPIC_API_KEY;
  console.log(`OWL-1 × Designpowers (real) → http://localhost:${PORT}/?source=live`);
  console.log(keyed ? '✓ ANTHROPIC_API_KEY detected.' : '⚠ No ANTHROPIC_API_KEY — set it and restart to run real agents.');
  console.log('Type your brief into OWL-1 to start directing the team.');
});
