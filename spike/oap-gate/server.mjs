// Interactive stand-in for OWL-1: a zero-dependency HTTP server that streams OAP
// events over SSE and exposes the APPROVE button as a real click. This is the
// "OWL-1 as front end" moment in miniature.
//
//   node spike/oap-gate/server.mjs   →   open http://localhost:4317
//
// Click "Start run" to launch the Designpowers slice in Human mode. The page shows
// the live event stream and an APPROVE button when the handoff gate opens. Clicking
// it posts gate.approve, which resolves the awaited canUseTool promise server-side.

import { createServer } from 'node:http';
import { OapSession } from './oap.mjs';
import { runSlice } from './runner.mjs';
import { GateController } from './gate-controller.mjs';
import { makeHumanCanUseTool } from './policies.mjs';

const PORT = process.env.PORT || 4317;
const clients = new Set(); // SSE responses
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
  runSlice({ session, mode: 'human', canUseTool: makeHumanCanUseTool(session, gates) });
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url.pathname === '/start' && req.method === 'POST') {
    startRun();
    res.writeHead(204).end();
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
        /* ignore malformed */
      }
      res.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok }));
    });
    return;
  }

  res.writeHead(404).end();
});

server.listen(PORT, () => {
  console.log(`OAP gate spike UI → http://localhost:${PORT}`);
});

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>OAP gate spike — OWL-1 stand-in</title>
<style>
  body { font: 13px ui-monospace, Menlo, monospace; background:#1c1b19; color:#e8e4dc; margin:0; padding:20px; }
  h1 { font-size:14px; letter-spacing:.08em; }
  button { font:inherit; padding:8px 14px; border:1px solid #4a463f; background:#2a2823; color:#e8e4dc; cursor:pointer; border-radius:6px; }
  button.primary { background:#2b5cd9; border-color:#2b5cd9; }
  button:disabled { opacity:.4; cursor:default; }
  #log { margin-top:16px; white-space:pre-wrap; line-height:1.5; }
  .ev { opacity:.85; } .gate { color:#ffcf6b; } .done { color:#7fd18b; }
  #gatebar { margin-top:14px; min-height:40px; }
</style>
<h1>▓▓ OAP GATE SPIKE — OWL-1 stand-in ▓▓</h1>
<button id="start" class="primary">Start run (Human mode)</button>
<div id="gatebar"></div>
<div id="log"></div>
<script>
const log = document.getElementById('log');
const gatebar = document.getElementById('gatebar');
const add = (txt, cls='ev') => { const d=document.createElement('div'); d.className=cls; d.textContent=txt; log.appendChild(d); };

const es = new EventSource('/events');
es.onmessage = (m) => {
  const e = JSON.parse(m.data);
  const p = e.payload;
  add('#'+e.seq+'  '+e.type+'  '+summarize(e), e.type==='run.finished'?'done':'ev');
  if (e.type === 'gate.opened') {
    gatebar.innerHTML = '';
    const b = document.createElement('button');
    b.className='primary'; b.textContent='✓ APPROVE + CONTINUE';
    b.onclick = async () => {
      b.disabled = true;
      await fetch('/command', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({type:'gate.approve', gateId:p.gateId})});
      add('▶ approved '+p.gateId, 'gate');
    };
    const note = document.createElement('span'); note.className='gate'; note.textContent = ' ⏸ '+p.context+'  ';
    gatebar.appendChild(note); gatebar.appendChild(b);
  }
  if (e.type === 'gate.closed' || e.type === 'run.finished') gatebar.innerHTML='';
};

document.getElementById('start').onclick = async () => {
  log.innerHTML=''; gatebar.innerHTML='';
  await fetch('/start', {method:'POST'});
};

function summarize(e){
  const p=e.payload;
  switch(e.type){
    case 'run.started': return 'mode='+p.mode+' project='+p.projectId;
    case 'agent.status': return p.id+' → '+p.status+(p.waiting?' ('+p.waiting+')':'');
    case 'message': return '['+p.kind+'] '+(p.from||'—')+(p.to?' → '+p.to:'')+': '+p.text;
    case 'artifact.created': return p.name+' ('+p.status+') by '+p.agent;
    case 'gate.opened': return p.agentId+' ← '+p.context;
    case 'gate.closed': return p.agentId+' resolution='+p.resolution;
    case 'run.finished': return p.summary;
    default: return JSON.stringify(p);
  }
}
</script>
`;
