// End-to-end demo: serve the BUILT OWL-1 app and drive it from a live OAP run of
// the full Designpowers team. This is the "OWL-1 as front end for Designpowers"
// moment — the real DAW UI, real handoff babble, real approval gates.
//
//   npm run build              # produce dist/
//   node spike/oap-gate/demo-server.mjs
//   open http://localhost:4318/?source=live
//
// On connect, a full 10-agent run starts in Human mode. Each handoff opens a gate;
// OWL-1 auto-expands the waiting lane and its "✓ APPROVE + CONTINUE" button posts
// gate.approve back here, resolving the canUseTool gate and dispatching the next
// agent. Swap mock-designpowers.dispatchAgent for a real Agent SDK query() and this
// same server drives a live Designpowers pipeline with no UI changes.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { OapSession } from './oap.mjs';
import { runSlice } from './runner.mjs';
import { fullSlice } from './mock-designpowers.mjs';
import { GateController } from './gate-controller.mjs';
import { makeHumanCanUseTool } from './policies.mjs';

const PORT = process.env.PORT || 4318;
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

const clients = new Set();
let session = null;
let gates = null;

function broadcast(env) {
  const line = `data: ${JSON.stringify(env)}\n\n`;
  for (const res of clients) res.write(line);
}

function startRun() {
  session = new OapSession(`run_${Date.now()}`);
  gates = new GateController();
  session.on('event', broadcast);
  // Human mode so the approval gates are exercised through OWL-1's own button.
  runSlice({ session, mode: 'human', canUseTool: makeHumanCanUseTool(session, gates), agents: fullSlice });
}

async function serveStatic(req, res, pathname) {
  // SPA: unknown non-asset routes fall back to index.html.
  let rel = pathname === '/' ? '/index.html' : pathname;
  let filePath = normalize(join(DIST, rel));
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    if (extname(filePath)) {
      res.writeHead(404).end('not found');
    } else {
      // route without extension → SPA entry
      try {
        const body = await readFile(join(DIST, 'index.html'));
        res.writeHead(200, { 'content-type': MIME['.html'] });
        res.end(body);
      } catch {
        res.writeHead(500).end('dist/ not found — run `npm run build` first');
      }
    }
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    if (clients.size === 1) startRun(); // first viewer kicks off a fresh run
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url.pathname === '/command' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let ok = false;
      try {
        const cmd = JSON.parse(body || '{}');
        if (cmd.type === 'gate.approve' && gates) ok = gates.resolve(cmd.gateId, { action: 'approve' });
        else if (cmd.type === 'gate.skip' && gates) ok = gates.resolve(cmd.gateId, { action: 'skip', note: cmd.note });
      } catch {
        /* ignore */
      }
      res.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok }));
    });
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`OWL-1 × Designpowers demo → http://localhost:${PORT}/?source=live`);
  console.log(`Serving built app from ${DIST} (run \`npm run build\` if you see a dist error).`);
});
