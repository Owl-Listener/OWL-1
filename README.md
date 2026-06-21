# OWL-1

A design prototype for orchestrating AI design agents. Built by MC Dean.

OWL-1 borrows from the language of digital audio workstations: your design agents are tracks, the pipeline is a transport, and the whole system runs on a shared clock. The result is a UI where you can watch ten agents think, intervene when they need you, and stay oriented in a complex creative process.

## Run real design agents

OWL-1 now drives a **real** team of 10 [Designpowers](https://github.com/Owl-Listener/designpowers) agents (vendored in `vendor/designpowers/`) through the Claude Agent SDK. Describe what you want, watch the team work in real time, approve each handoff, and steer any agent along the way — it produces real design work.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start                    # open http://localhost:4318/?source=live
```

**→ Full walkthrough: [QUICKSTART.md](QUICKSTART.md)** (prerequisites, how to direct, troubleshooting).

No key / just looking? `npm run demo` runs a scripted mock of the same experience — same lanes, babble, and approval gates, no agents, no cost.

### How it works

OWL-1 (front end) and Designpowers (agents) talk over the **OWL Agent Protocol** ([`docs/owl-agent-protocol.md`](docs/owl-agent-protocol.md)). The backend runs Designpowers headless via the Claude Agent SDK and translates the live run into OAP events the UI renders; OWL-1's **APPROVE** button is the SDK's per-handoff permission gate (`canUseTool`). Internals and the offline spike live in `spike/oap-gate/`.

The sections below describe the original design prototype — still the default when you open the app without `?source=live`.

## What's in here

```
owl-1/
  src/
    main.jsx                  # React entry point
    owl-1-prototype.jsx       # The full prototype (single file)
  docs/
    design-brief.md           # Original design brief
    design-critique.md        # Design critique notes
    component-spec.md         # Component specification
  index.html                  # Vite entry (loads Google Fonts)
  vite.config.js              # Vite config
  package.json                # React 18 + Vite 5
```

## Running it

Real agents (see [QUICKSTART.md](QUICKSTART.md)):

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start            # http://localhost:4318/?source=live
```

Just the design prototype (simulated, no key):

```bash
npm install
npm run dev          # http://localhost:5173
```

## Building

```bash
npm run build
```

## The design

Neomorphic surfaces on warm grey. Three-size type scale (9/11/14). JetBrains Mono throughout. Synthesized sound design via Web Audio API. Light and dark mode. Every design decision is in the code, there's no separate design file.

Ten agents, each with a proper name: Design Lead, Design Scout, Design Strategist, Inspiration Scout, Content Writer, Motion Designer, Design Builder, Design Critic, Accessibility Reviewer, Heuristic Evaluator.

Three transport modes: Auto (agents run freely), Human (you approve each step), Stop.

## Views

**Arrangement** is the main workspace: agent swim lanes with live waveforms, a project header with agent banter, deliverables, and blockers that route you to the right agent with a clear CTA.

**Agents** is the full directory: profiles, capabilities, handoff maps, pipeline stage, and management controls for each agent.

**Nodes** is a spatial view of the agent network: who hands off to whom, with particles flowing along active edges.

The left nav gives you Projects, Tracks, Memory (editable taste profile and design context), and Telemetry (token usage, cost, latency). Guide lives at the bottom.

## Status

Alpha. Two ways to run: the **real** path (`npm start`) drives live Designpowers agents via the Claude Agent SDK and produces real design work; the **prototype** path (`npm run dev`) is the original simulated design artifact. The real backend is new and best-effort — the SDK message/hook field shapes are the thing to confirm on your first run (see `spike/oap-gate/sdk-runner.mjs`). Treat it as a working alpha, not a hardened product.
