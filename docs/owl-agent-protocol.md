# OWL Agent Protocol (OAP) — v0.1 draft

**Status:** Draft. The contract between an agent swarm (the "backend") and the OWL-1 UI (the "front end").
**Audience:** Anyone wiring a real agent system into OWL-1 — starting with Designpowers.

---

## Why this exists

OWL-1 is currently a prototype on simulated data. Every agent's "activity" is faked by a
sine curve driven by a single `clock` (see `src/owl-1-prototype.jsx`: `getActivity()`,
`pipelineMode`, the `setInterval` in the root component). Nothing is real, and nothing
*needs* to be — the UI only consumes a small, stable set of entities and events.

This document defines that set as a **normalized protocol** so the UI never has to know
which swarm is driving it. A swarm plugs in by emitting OAP **events** (server → UI) and
honouring OAP **commands** (UI → server). One thin **adapter** per swarm does the
translation; the UI only ever speaks OAP.

```
┌─────────────┐  framework-native   ┌──────────┐   OAP events    ┌─────────┐
│ Agent swarm │── events/callbacks ─▶│ Adapter  │── WS/SSE ──────▶│ OWL-1 UI│
│ (any)       │◀── resume/stop ──────│ (relay)  │◀── REST/RPC ────│         │
└─────────────┘                      └──────────┘                 └─────────┘
```

The first adapter is **Designpowers**, which is a near-perfect fit because OWL-1 was
modelled on it (same 10 agents, same phases, same modes, same handoff-babble shape, same
shared-state spine). See [Designpowers binding](#designpowers-binding) below.

---

## Design principles

1. **The UI is dumb and declarative.** It renders whatever state the events describe. It
   never infers swarm internals.
2. **State is event-sourced.** The server emits deltas; the UI keeps the reduced state.
   A late-joining client can ask for a full `snapshot`.
3. **Inferred state is allowed but labelled.** Some backends (LLM-orchestrated swarms like
   Designpowers) cannot emit a typed "agent is 63% done." Fields that are best-effort are
   marked `confidence: "exact" | "inferred"` so the UI can soften its rendering.
4. **Control is explicit and acknowledged.** Every command from the UI gets an `ack` or
   `reject`. Approval gates must not silently no-op.
5. **Artifacts are the primary object.** Per the design brief, the design output is what
   matters. Artifacts are first-class, not a side channel.

---

## Transport

- **Server → UI:** WebSocket (preferred) or SSE. A single ordered event stream.
- **UI → Server:** REST/RPC for commands (or the same WebSocket, bidirectional).
- **Envelope:** every message is JSON with a common envelope:

```jsonc
{
  "v": 1,                       // protocol version
  "type": "agent.status",       // event or command type (see registries below)
  "seq": 1024,                  // monotonic per-session sequence (server events)
  "ts": "2026-06-21T12:44:02Z", // ISO-8601
  "sessionId": "run_abc123",
  "payload": { /* type-specific */ }
}
```

Ordering is guaranteed by `seq`. If a client sees a gap it requests a `snapshot`.

---

## Core entities

These mirror what `src/owl-1-prototype.jsx` already renders. Field names are chosen to
drop into the existing component props with minimal churn.

### Agent

```jsonc
{
  "id": "design-lead",                 // stable slug; matches OWL-1 agentsData ids
  "name": "Design Lead",
  "desc": "Visual design — layout, colour, typography, components",
  "stage": "design",                   // current pipeline stage id (see Stage)
  "receives": ["design-strategist"],   // upstream agents (graph in-edges)
  "handsTo": ["motion-designer"],      // downstream agents (graph out-edges)
  "status": "running",                 // see AgentStatus
  "activity": 0.82,                    // 0..1 "how busy right now" — drives the waveform
  "confidence": "inferred",            // "exact" | "inferred" (see principle 3)
  "waiting": null                      // or "AWAITING INPUT" when a gate is open on this agent
}
```

**AgentStatus** (replaces the prototype's `getStatus(activity)` thresholds):

| value      | meaning                                              |
|------------|------------------------------------------------------|
| `idle`     | not dispatched / no work                             |
| `online`   | dispatched, warming up / light activity              |
| `running`  | actively producing                                   |
| `blocked`  | stopped on a blocker that needs resolution           |
| `awaiting` | paused at an approval gate (Human/Direct mode)       |
| `done`     | completed its contribution for this run              |
| `skipped`  | intentionally skipped (record why in an event/log)   |

### Stage

The pipeline stages. Matches OWL-1's `pipelineStages` and Designpowers' phases.

```jsonc
{ "id": "design", "label": "DESIGN", "order": 4, "active": true }
```

Canonical order: `discover → strategy → taste → design → verify → handoff → retro`.
(Designpowers has finer-grained phases; the adapter buckets them into these seven — see
the binding table.)

### Message (handoff babble + narration)

Maps to OWL-1 `banterMessages {from, to, text}` and the per-agent narration moments.

```jsonc
{
  "id": "msg_88",
  "kind": "handoff",        // "handoff" | "narration" | "question" | "system"
  "from": "design-lead",
  "to": "motion-designer",  // null for narration/system
  "text": "Frosted glass cards, mint/sage palette. The progress ring is the hero moment…",
  "stage": "design"
}
```

### Artifact (deliverable)

Maps to OWL-1 `projectDeliverables {name, status, agent, preview}`.

```jsonc
{
  "id": "art_consent_banner",
  "name": "Consent banner",
  "status": "in-progress",        // "draft" | "in-progress" | "staged" | "approved"
  "agent": "design-builder",
  "preview": "role=dialog, equal-weight Accept/Reject, 44px targets…",
  "mime": "text/html",            // optional, for renderable output
  "url": "/artifacts/run_abc123/consent-banner.html",  // optional served file
  "thumbnailUrl": "/artifacts/run_abc123/consent-banner.png"            // optional
}
```

> **Staged vs approved** is the heart of the brief's non-destructive model: artifacts land
> `staged` (visible, not committed) and become `approved` only on an `approve` command.

### Blocker

Maps to OWL-1 `projectBlockers {agent, severity, text}` **and** Designpowers' auto-mode
safeguards / reconciliation conflicts.

```jsonc
{
  "id": "blk_focus_on_load",
  "agent": "accessibility-reviewer",
  "severity": "warn",             // "warn" = action required | "input" = user knowledge needed
  "text": "Banner must move focus to the dialog on load or SR users may never reach it",
  "cta": "RESOLVE",               // "RESOLVE" (warn) | "RESPOND" (input)
  "stage": "verify"
}
```

### Telemetry tick

Maps to OWL-1's telemetry view. Unlike the prototype, these are real token counts.

```jsonc
{
  "agentId": "design-lead",
  "inputTokens": 4200,
  "outputTokens": 2600,
  "costUsd": 0.0231,
  "latencyMs": 340
}
```

### Memory / taste profile

Maps to OWL-1's Memory view and Designpowers' `~/.designpowers/taste-profile.md`.
Read/write; see `memory.update` command.

```jsonc
{
  "section": "taste",            // "taste" | "principles" | "patterns" | "context"
  "entries": [ { "key": "Emotional target", "value": "Calm authority" } ]
}
```

---

## Events (server → UI)

| type                | payload                          | drives in OWL-1                          |
|---------------------|----------------------------------|------------------------------------------|
| `snapshot`          | full state (all entities below)  | initial hydrate / gap recovery           |
| `run.started`       | `{ mode, lane, projectId, capabilities }` | transport state, project header     |
| `run.mode`          | `{ mode }`                       | `pipelineMode` (auto/human/stop)         |
| `run.finished`      | `{ summary }`                    | run ends (completed or cancelled)        |
| `run.reset`         | `{}`                             | New Project — clears the session         |
| `stage.changed`     | `Stage`                          | pipeline progress bar / `clock`          |
| `agent.status`      | `Agent` (partial, by `id`)       | lane status, waveform, Nodes view        |
| `agent.activity`    | `{ id, activity }` (high-freq)   | live waveform sampling                   |
| `message`           | `Message`                        | banter feed, event log, Nodes particles  |
| `artifact.created`  | `Artifact`                       | deliverables list, output preview        |
| `artifact.updated`  | `Artifact` (partial, by `id`)    | deliverable status (e.g. → `staged`)     |
| `blocker.raised`    | `Blocker`                        | blockers panel, lane blocker banner      |
| `blocker.cleared`   | `{ id }`                         | dismiss blocker                          |
| `gate.opened`       | `{ gateId, agentId, kind, context }` | approval CTA (`✓ APPROVE + CONTINUE`) |
| `gate.closed`       | `{ gateId, agentId, resolution }`| clears the gate                          |
| `telemetry.tick`    | `Telemetry`                      | telemetry view                           |
| `memory.changed`    | `Memory`                         | memory view                              |

`mode` enum: `auto` | `human` | `stop` (OWL-1's `playing` | `recording` | `stopped`).

---

## Commands (UI → server)

Every command receives a `command.ack {id}` or `command.reject {id, reason}`.

Implemented today (✓) vs. designed-but-not-yet-wired (◦):

| type              | payload                            | from OWL-1 control                       |     |
|-------------------|------------------------------------|------------------------------------------|-----|
| `run.start`       | `{ brief, mode, cap }`             | director's first message → start a run   | ✓   |
| `run.cancel`      | `{}`                               | transport STOP — abort the run (Recover) | ✓   |
| `run.reset`       | `{}`                               | New Project — cancel + clear             | ✓   |
| `agent.create`    | `{ agent: { name, role, stage, handsTo, prompt } }` | Create-Agent form       | ✓   |
| `agent.ask`       | `{ text }`                         | director chat — steer the running team   | ✓   |
| `gate.approve`    | `{ gateId }`                       | `✓ APPROVE + CONTINUE` on a handoff      | ✓   |
| `gate.skip`       | `{ gateId, note }`                 | skip a handoff                           | ✓   |
| `agent.correct`   | `{ text }`                         | "Use my design system instead"           | ◦¹  |
| `agent.add`       | `{ text }`                         | "Also handle dark mode"                  | ◦¹  |
| `agent.redirect`  | `{ fromAgentId, toAgentId, text }` | "Send this back to design-strategist"    | ◦   |
| `blocker.dismiss` | `{ id }`                           | blocker `×`                              | ◦   |
| `artifact.approve`| `{ id }`                           | staged → approved (review CTA)           | ◦   |
| `memory.update`   | `{ section, entries }`             | memory edits                             | ◦   |
| `snapshot.request`| `{}`                               | gap recovery                             | ◦   |

¹ `agent.correct`/`agent.add` are accepted by the server today but routed the same as
`agent.ask` (folded into the run as director input); dedicated handling is future work.

The `agent.*` steering commands map to Designpowers' creative-director moves
(approve / correct / add / redirect / skip / talk-to-agent).

---

## Mode semantics

- **`auto`** — agents run continuously; server streams `agent.status`/`message`/`artifact.*`
  without waiting. The UI is a glass box. Easy for any backend.
- **`human`** — before each handoff the server emits `gate.opened` and **waits** for
  `gate.approve` (or `correct`/`redirect`/`skip`). This is the staged-approval model. The
  hard part for backends that can't pause mid-run (see below).
- **`stop`** — halt dispatch; in-flight work may finish but nothing new starts.

Even in `auto`, the server **must** raise a `gate.opened` (forcing a pause) for safeguard
conditions — these are Designpowers' auto-mode safeguards verbatim:

1. accessibility-reviewer finds a critical issue
2. design-critic recommends "rethink" (not just "revise")
3. heuristic-evaluator finds a critical H3/H1 violation
4. synthetic-user-testing shows a persona can't complete the primary task
5. reconciliation produces an unresolvable conflict
6. any agent flags an open question requiring user knowledge

---

## Capability tiers

A backend declares what it supports in the `run.started` payload as `capabilities`:

```jsonc
"capabilities": {
  "stream": true,        // can emit live status/messages (tier 1 — required)
  "artifacts": true,     // can surface output files (required for the brief's thesis)
  "pauseMidRun": true,   // can pause at handoffs for gates (tier 2 — full Human mode)
  "steer": true,         // can accept correct/redirect/add mid-run (tier 3)
  "telemetry": true      // real token/cost/latency
}
```

- **Tier 1 (monitoring):** any swarm. Auto mode + waveforms + babble.
- **Tier 2 (gated):** `pauseMidRun` — Human-mode approval works. If false, the adapter
  **falls back to gating the commit, not the compute**: agents finish, artifacts stay
  `staged`, and `artifact.approve` controls whether they merge. This still satisfies the
  non-destructive model.
- **Tier 3 (steerable):** `steer` — full creative-director experience.

---

## Designpowers binding

Designpowers is markdown (skills + agents + hooks) whose **orchestrator is the LLM**
(Claude Code / Gemini / any agent runtime). There is no server emitting typed events, so
the adapter derives OAP events from three real sources:

### 1. Runtime: two implemented backends

OWL-1 ships two backends (`spike/oap-gate/`), selected by `OWL_BACKEND`; both emit the same OAP.

**Claude** (`sdk-runner.mjs`) — runs Designpowers headless via the Claude Agent SDK:

| OAP need                     | SDK mechanism                                              |
|------------------------------|-----------------------------------------------------------|
| `agent.status` running/done  | subagent (Task/Agent) dispatch + `PreToolUse`/`SubagentStop` hooks |
| `gate.opened` / Human mode   | a **`PreToolUse` hook** on the dispatch tool pauses until the UI sends `gate.approve` |
| `message` (babble/narration) | streamed assistant text + `PostToolUse` on `design-state.md` writes |
| `telemetry.tick`             | SDK usage reporting (real tokens; cost reported at the end of a turn) |
| `steer` commands             | SDK input streaming (inject director messages into the run) |

> **The gate is a `PreToolUse` hook, not `canUseTool`.** In the Claude Code runtime, tool
> permissioning flows through `PreToolUse` — verified empirically, `canUseTool` is never
> called. The hook awaits OWL-1's approval before the dispatch proceeds; OWL-1's APPROVE
> button *is* Designpowers' "pause for user."

**Gemini** (`gemini-runner.mjs`) — the Gemini CLI is being retired and can't gate cleanly, so
OWL-1 owns the function-calling loop: a lead model dispatches each subagent via a function
call, the runner pauses *before executing* it for approval (using the same `gates` +
`gate.opened`/`gate.approve`), and subagents run as their own Gemini calls with sandboxed
file tools. See the runner and the README's "Run on Gemini" section.

### 2. Source of truth: `design-state.md`

Designpowers maintains a structured shared doc (see `examples/traced-run/design-state.md`).
The adapter parses it into OAP entities:

| `design-state.md` section | OAP entity                                  |
|---------------------------|---------------------------------------------|
| Handoff Chain (babble)    | `message` (kind `handoff`)                  |
| Reviews / Fix list        | `blocker.raised`                            |
| Reconciliation conflicts  | `blocker.raised` (severity `input`)         |
| Pipeline status table     | `agent.status` (✅ done / ⏭️ skipped / …)    |
| Decisions log             | run history / `message` (kind `system`)     |
| Verification / artifact/  | `artifact.*` (served HTML/PNG)              |

### 3. Mapping tables

**Agents** — 1:1, ids already match OWL-1's `agentsData`:
`design-lead, design-scout, design-strategist, inspiration-scout, content-writer,
motion-designer, design-builder, design-critic, accessibility-reviewer, heuristic-evaluator`.

**Stages** — Designpowers' fine phases bucket into OWL-1's seven:

| OWL-1 stage | Designpowers phases (skills)                                              |
|-------------|--------------------------------------------------------------------------|
| `discover`  | design-discovery, research-planning, inclusive-personas                   |
| `strategy`  | design-strategy                                                           |
| `taste`     | design-taste, inspiration-scouting, design-debate                        |
| `design`    | writing-design-plans, ui-composition, interaction-design, motion, content, design-builder |
| `verify`    | taste-feedback, critique, accessibility/heuristic review, synthetic-user-testing, verification-before-shipping |
| `handoff`   | design-handoff                                                           |
| `retro`     | design-retrospective                                                     |

**Modes** — exact:

| OAP    | OWL-1       | Designpowers |
|--------|-------------|--------------|
| `auto` | `playing`   | Auto         |
| `human`| `recording` | Direct       |
| `stop` | `stopped`   | (pause)      |

**Declared capabilities (target):** `stream`, `artifacts`, `pauseMidRun`, `steer`,
`telemetry` all `true` via the Agent SDK runtime.

### What's hard (be honest)

- **State is inferred, not declared.** Stage/activity come from hook events + parsing
  narration and `design-state.md`. Mark these `confidence: "inferred"`. The Pipeline status
  table makes agent-level status fairly reliable; sub-agent "% done" is approximate.
- **Steering is the real engineering.** The `PreToolUse` gate cleanly handles approve/deny;
  injecting free-text corrections mid-run uses SDK input streaming (wired) but dedicated
  `correct`/`redirect`/`add` handling beyond "fold into the run" is future work.

---

## Open questions

1. WebSocket vs SSE for the primary stream? (SSE is simpler; WS enables one bidirectional
   channel.)
2. Where do served artifacts live — local static dir, or streamed as data URLs for the
   prototype?
3. Do we vendor Designpowers as a git submodule or clone-at-runtime? (Read-only either way.)
4. How much of `design-state.md` parsing is regex vs. asking the SDK to emit structured
   side-channel events from a `PostToolUse` hook?

---

## Implementation status

The original milestones are all built (see `spike/oap-gate/` and `src/oap/`):

1. ✅ **This doc** — the contract (v0.1).
2. ✅ **Gate spike** — the offline mock proof (`spike/oap-gate/`): a runner pauses at the
   handoff until a UI approval arrives.
3. ✅ **Frontend decoupling** — `src/owl-1-prototype.jsx` reads a pluggable OAP source
   (`src/oap/`) gated by `?source=live`; the sine-curve sim remains the offline default.
4. ✅ **Real backends** — `sdk-runner.mjs` (Claude, `PreToolUse` gate) and `gemini-runner.mjs`
   (Gemini, own-the-loop), selected by `OWL_BACKEND`.
5. ✅ **Govern + Recover** — pre-run spend cap (`run.start { cap }`) and cancel (`run.cancel`).

Still open: real blockers parsed from Designpowers safeguards, agent-initiated questions,
memory persistence, and broader runner test coverage. See `CONTRIBUTING.md`.
