# OWL-1 Design Brief

**Project:** OWL-1 — Agent Orchestration Interface
**Repo:** Owl-Listener
**Date:** March 28, 2026
**Author:** MC

---

## Project Overview

OWL-1 is an agent orchestration interface inspired by digital audio workstations (DAWs) and Teenage Engineering's industrial design language. It provides a visual production environment where designers (and eventually other practitioners) can conduct, monitor, and refine the work of multiple AI agents operating in concert.

Designpowers is the first test case: its pipeline of specialized design agents (discovery, strategy, taste, generation) becomes the first "session" running inside OWL-1.

The name follows Teenage Engineering's product naming convention (OP-1, TX-6, OB-4) and connects to the Owl-Listener repository. Owls are nature's most precise listeners — they triangulate sound in three-dimensional space using asymmetric ears. OWL-1 triangulates agent output into coherent design work.

---

## Problem Statement

**What's broken:** Current agent orchestration interfaces fall into two traps. "Chat" interfaces serialize everything into a single thread, hiding the parallel nature of multi-agent work. "Workflow builder" interfaces (node-and-wire canvases) expose the plumbing but lose the output — you see the graph, not the result.

Neither gives practitioners the feeling of conducting a team. Neither makes the orchestration legible at a glance. Neither lets you tune individual agents while keeping the ensemble coherent.

**Who feels it:** Designers and creative practitioners who work with multi-agent AI systems but aren't engineers. People who think spatially, who are used to sophisticated production tools, and who need to feel in control of the process — not just a passenger.

**Consequence of not solving it:** Agent systems remain opaque black boxes. Practitioners can't develop intuition about how agents interact. Trust stays low. Adoption stays shallow. The potential of multi-agent collaboration goes unrealized because the interface makes it inaccessible.

---

## The Core Insight

DAWs are the most sophisticated real-time orchestration interfaces ever designed. They solve the exact same fundamental problem: orchestrating multiple independent processes that must produce coherent output together. A mix is an emergent property of tracks working in concert. A design system — or any complex agent output — is the same thing.

The key structural parallels:

- **Tracks → Agents.** Each has its own input, processing chain, and output, but they share a timeline and a master bus. In OWL-1, each agent has its own skill, context window, and output, but they all share design-state and the project scope.

- **Mixer → Orchestration control.** Per-track volume, pan, mute, solo, sends, inserts — all visible simultaneously. Translates to: per-agent priority, focus area, enable/disable, isolate for review, routing to other agents, and processing configuration.

- **Bus routing → Agent communication.** Aux sends and bus routing let one track feed signal to another's processing chain. Discovery output feeding into strategy is the same pattern. Making routing visible and editable lets practitioners rewire the pipeline.

- **Transport bar → Pipeline state.** Play, pause, rewind. Run the pipeline, pause for human review, roll back to a previous state. Non-destructive editing and undo history solved the "go back to where I was" problem decades ago.

---

## Design Philosophy

**"Cursor for design."** Cursor (the code editor) succeeded by embedding AI into the existing workflow rather than replacing it. Mozart AI did the same for music production. OWL-1 embeds AI agents into a visual production workflow. The designer isn't replaced — they gain a team.

**The output is the primary object.** In a DAW, the music is the primary object. The mixer, routing, and effects chains serve what you hear. OWL-1 must keep the design output front and center. Orchestration controls recede into peripheral awareness until needed.

**Staged output with approval gates.** Agents run and their output progressively appears (so you see them working), but it lands in a "staged" state — visible but not committed. You review, approve, and it merges into shared state. This is the non-destructive editing model. Nothing is permanent until you say so. This solves the trust problem: real-time energy without loss of control.

---

## Two Views

Inspired by Ableton Live's dual-view architecture:

### Session View — "Conducting"

The mixer/ensemble view for actively working with agents. All agents visible as tracks, showing current status, streaming output, and controls. A design output preview sits to the side (like Ableton's detail pane). This is the mode for directing the ensemble — launching agents, soloing one to focus on its output, muting irrelevant ones, adjusting parameters.

### Arrangement View — "Producing"

The canvas/output view for reviewing and refining deliverables. Design output is primary — full screen, full fidelity. Agent controls collapse into a slim panel. The agents become background infrastructure. This is the mode for curating, editing, and polishing the actual work product.

Practitioners switch between views depending on their mode of thinking, just as music producers do.

---

## Visual Language: Teenage Engineering

The aesthetic is not glassmorphism, not gradient-heavy, not "AI startup." It's Teenage Engineering: industrial, playful, supremely confident in restraint.

### Principles

- **Exposed structure as aesthetic.** Don't abstract the pipeline — show it, and make the showing beautiful. Like the OP-1 showing tape reels and signal paths, OWL-1 shows agent-to-agent data flow as a visible, delightful mechanism.

- **Monospaced type, flat color, hard edges.** No gradients, no blur, no soft shadows. Everything on a grid. Utilitarian honesty elevated by obsessive proportioning and spacing. Dieter Rams by way of Stockholm.

- **Color as information, not decoration.** Mostly monochrome palette. Color appears with purpose — each agent type gets a distinct hue. The pipeline reads as a color-coded flow at a glance. Discovery in one hue, strategy in another, generation in another.

- **The "field device" feeling.** Terse labels. Physical-feeling controls. No marketing language in the UI. Status reads like instrument readouts: `DISCOVERY — RUNNING — 3/7 SIGNALS` not "Your AI Discovery Agent is analyzing design patterns..."

- **Warm dark gray, not black.** The background sets the tone — TE's characteristic dark surface that recedes without feeling cold. Design output pops against it.

### The Four-Parameter Constraint

The OP-1 constrains every screen to four controllable parameters mapped to four physical knobs. This brutal limitation keeps the interface learnable despite enormous depth. OWL-1 applies the same principle: each agent track's visible surface shows only its essential parameters — status, confidence, output preview, and one primary control. Deep configuration exists but requires drilling in.

---

## Target Audience

**Primary:** Designers and creative practitioners who use or want to use multi-agent AI tools. Visually literate, spatially oriented, accustomed to sophisticated production software. Not engineers, but capable of learning complex tools when the interface respects their intelligence.

**Secondary:** AI engineers building agent systems who need a better way to observe, debug, and demonstrate multi-agent behavior. The "mission control" framing serves them too.

---

## Scope

### In scope (v1)

- Session View with agent tracks, mixer-style controls, and transport bar
- Arrangement View with full-fidelity output and collapsed controls
- View switching between Session and Arrangement
- Designpowers as the first agent pipeline running inside OWL-1
- TE-inspired visual design system (tokens, components, type scale)
- Agent status, output preview, and staged approval flow

### Out of scope (v1)

- Custom agent creation or pipeline editing by end users
- Multi-project/multi-session management
- Collaboration or multi-user features
- Mobile or tablet layouts
- Audio or haptic feedback (future exploration)

---

## Success Criteria

- A designer can understand the state of all agents in the pipeline within 3 seconds of looking at Session View
- The staged output approval flow feels like non-destructive editing — safe, reversible, confidence-building
- The interface is visually quiet enough that design output reads as the primary content, not tool chrome
- Someone familiar with DAWs or TE products recognizes the interaction patterns immediately
- The four-parameter constraint holds: no agent track surface exceeds four visible controls

---

## Key References

- **Teenage Engineering OP-1, EP-133, TX-6** — visual language, interaction constraints, exposed-structure aesthetic
- **Ableton Live** — Session/Arrangement dual-view architecture, clip launching, mixer paradigm
- **Mozart AI (v0.5)** — per-track AI agents, context-aware generation, natural language control
- **Cursor** — AI embedded in existing workflow, not replacing it
- **Dieter Rams / Braun** — "less but better," information density without clutter

---

## Open Questions

1. **What are the exact agent parameters that surface on each track?** We said status, confidence, output preview, and one control — but what's the "one control" for each agent type?

2. **How does the transport bar behave when agents are at different stages?** In a DAW, all tracks share a playhead. But agents may be at different points in their work. Does the transport represent the pipeline as a whole, or per-agent?

3. **What does "soloing" an agent actually mean in practice?** In a DAW, solo = hear only this track. For agents, does solo = see only this agent's output? Pause all others? Route all context to this one agent?

4. **How does bus routing map to agent dependencies?** Is this purely visual (showing data flow) or can users rewire it? What are the constraints on valid routing?

5. **What happens in the staged area?** How does the designer interact with staged output before approving? Can they edit it? Annotate? Send it back to the agent with notes?

---

## Next Steps

- Map the information architecture: every element in both views, what data it shows, what controls it exposes
- Define the design token system (color, type, spacing) through the TE lens
- Prototype the Session View as a React component — get something on screen to react to
- Test the metaphor: put Designpowers' actual agent pipeline into the track structure and see if it holds
