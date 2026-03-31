# OWL-1

A design prototype for orchestrating AI design agents. Built by [Designpowers](https://designpowers.com).

OWL-1 borrows from the language of digital audio workstations: your design agents are tracks, the pipeline is a transport, and the whole system runs on a shared clock. The result is a UI where you can watch ten agents think, intervene when they need you, and stay oriented in a complex creative process.

This is a prototype. It runs on simulated data, not live agents. The interaction design, visual language, sound design, and information architecture are all here. The backend integration is not.

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

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

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

Alpha prototype. Simulated data. No backend. This is a design artifact that communicates how agent orchestration should feel, not a production application. Yet.
