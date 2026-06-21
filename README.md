# OWL-1

An **experimental** prototype exploring how directing a team of AI design agents could feel. Built by MC Dean.

> ⚠️ **Experimental personal project.** This is a research prototype / design exploration —
> not a product, not a service, and not affiliated with, endorsed by, or representing any
> employer. It's provided as-is, with no support or warranty. It explores ideas about
> human-in-the-loop agent orchestration; it is not a commercial or competitive offering.

![OWL-1 directing the Designpowers team — the Design Strategist track paused for your approval](docs/images/owl-1-arrangement.png)

OWL-1 borrows from the language of digital audio workstations: your design agents are tracks, the pipeline is a transport, and the whole system runs on a shared clock. The result is a UI where you direct a team of ten [Designpowers](https://github.com/Owl-Listener/designpowers) agents — watch them work, intervene when they need you, and stay oriented in a complex creative process. It's an experiment in *how agent orchestration should feel*, not a finished tool.

## Run it

OWL-1 drives a real team of 10 Designpowers agents (vendored in `vendor/designpowers/`) through the Claude Agent SDK. Describe what you want, watch the team work in real time, approve each handoff, and steer any agent along the way.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start                    # open http://localhost:4318/?source=live
```

**→ Full walkthrough: [QUICKSTART.md](QUICKSTART.md)** (prerequisites, how to direct, troubleshooting).

Want to look around without a key (or any spend)? `npm run demo` runs the same UI on a scripted offline mock — same lanes, babble, and approval gates, no agents, no cost.

### How it works

OWL-1 (front end) and Designpowers (agents) talk over the **OWL Agent Protocol** ([`docs/owl-agent-protocol.md`](docs/owl-agent-protocol.md)). The backend runs Designpowers headless via the Claude Agent SDK and translates the live run into OAP events the UI renders; OWL-1's **APPROVE** button is the SDK's per-handoff permission gate — a `PreToolUse` hook that pauses each subagent dispatch until you approve. Backend internals live in `spike/oap-gate/`.

### Run on Gemini instead of Claude

Because the UI only speaks OAP, the model provider is a swappable backend. Run on Google Gemini:

```bash
export GEMINI_API_KEY=...
OWL_BACKEND=gemini npm start      # default backend is Claude
```

On Gemini, OWL-1 *is* the orchestrator: a lead model dispatches each subagent via a function call, OWL-1 gates that call for your approval (Gemini's CLI is being retired, and owning the function-calling loop is the only durable way to pause for approval), and subagents run as their own Gemini calls that write real files. Same UI, same gate, same protocol — only the runner differs (`spike/oap-gate/gemini-runner.mjs`). Note: it's our own orchestration of the Designpowers markdown (not a native runtime), and output will differ from Claude.

## What's in here

```
owl-1/
  src/
    main.jsx                # React entry point
    owl-1-prototype.jsx     # The full OWL-1 interface (single file)
    oap/                    # OWL Agent Protocol client — live event source for the UI
  spike/oap-gate/           # The backends: sdk-runner (Claude) + gemini-runner (Gemini) + server (+ offline mock)
  vendor/designpowers/      # The 10-agent Designpowers team — agents, skills, vendored in
  scripts/
    setup-designpowers.mjs  # Lays out the workspace a runner loads Designpowers from
  test/                     # Test suite (node:test) — run with `npm test`
  docs/
    owl-agent-protocol.md   # The OWL Agent Protocol — backend ↔ UI contract
    design-brief.md         # Original design brief
    design-critique.md      # Design critique notes
    component-spec.md       # Component specification
  CONTRIBUTING.md           # How to contribute (start here for the architecture)
  QUICKSTART.md             # Designer quickstart
  .github/workflows/ci.yml  # CI: build + test on every PR
  index.html                # Vite entry (loads Google Fonts)
  package.json              # React 18 + Vite 5 + Claude Agent SDK + Gemini SDK
```

## Running it

Real agents (see [QUICKSTART.md](QUICKSTART.md)):

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start            # http://localhost:4318/?source=live
```

Offline preview — the same UI on simulated data, no key, no cost:

```bash
npm install
npm run demo         # scripted mock backend, http://localhost:4318/?source=live
# or: npm run dev    # the raw UI with built-in sample data, http://localhost:5173
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

![Arrangement view](docs/images/owl-1-arrangement.png)

**Agents** is the full directory: profiles, capabilities, handoff maps, pipeline stage, and management controls for each agent.

![Agents console](docs/images/owl-1-agents.png)

**Nodes** is a spatial view of the agent network: who hands off to whom, with particles flowing along active edges.

![Nodes view — the agent network](docs/images/owl-1-nodes.png)

The left nav gives you Projects, Tracks, Memory (editable taste profile and design context), and Telemetry (token usage, cost, latency). Guide lives at the bottom.

## Contributing

OWL-1 is provider-agnostic by design — the UI speaks the [OWL Agent Protocol](docs/owl-agent-protocol.md), and a backend (a model or a whole agent swarm) is a swappable adapter. Adding one is the highest-leverage contribution, and there's an honest roadmap of where help is most wanted (verification, the spend cap, finishing the live surfaces, hardening).

See **[CONTRIBUTING.md](CONTRIBUTING.md)** — start with the protocol doc, then the "Adding a new backend" guide.

## Status

**Experimental alpha — a prototype, not a product.** `npm start` runs live Designpowers agents via the Claude Agent SDK: agents dispatch (the SDK's `Agent` tool), the lanes light up, the Human-mode APPROVE button holds and resumes a handoff (via a `PreToolUse` hook), output streams back as babble, and the team writes into `.dp-workspace/design-state.md`. Much of this is build-verified but only lightly observed in real runs — treat it as a research artifact you can run, not something to rely on.

It exists to explore *how human-in-the-loop agent orchestration could feel*. Rough edges, partial features (some panels still show sample data), no support or warranty.
