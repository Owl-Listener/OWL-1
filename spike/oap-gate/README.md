# OAP gate spike

Proves the one genuinely hard part of giving OWL-1 a real backend: **Human-mode
approval gates**. It demonstrates that a `canUseTool`-style permission callback can
pause agent dispatch until an external UI (OWL-1) sends approval — the mechanism that
turns OWL-1's `✓ APPROVE + CONTINUE` button into Designpowers' "pause for user."

Zero dependencies. Pure Node (≥18). No API key.

## What it shows

- The **same runner** is Auto-mode or Human-mode purely by which `canUseTool` policy it
  receives (`policies.mjs`). The runner has no pause logic of its own.
- `canUseTool` has the **exact Claude Agent SDK signature**
  (`(toolName, input, ctx) => { behavior: 'allow' | 'deny', ... }`), so the mock runner
  swaps for a real SDK `query()` over the Designpowers subagents with no change to the
  gate code.
- OAP events stream out (`run.started`, `agent.status`, `message`, `artifact.created`,
  `gate.opened`/`gate.closed`, `run.finished`) and OAP commands (`gate.approve`,
  `gate.skip`) come back — the contract in `docs/owl-agent-protocol.md`.

## Run it

Headless (prints the OAP stream, shows the run block at the handoff):

```bash
node spike/oap-gate/demo.mjs          # Human mode — pauses at the handoff
node spike/oap-gate/demo.mjs --auto   # Auto mode — same runner, no pause
```

Interactive (OWL-1 stand-in with a real APPROVE button):

```bash
node spike/oap-gate/server.mjs        # open http://localhost:4317
```

## End-to-end demo (the real OWL-1 UI on a live run)

Serve the **built** OWL-1 app and drive it from a full 10-agent Designpowers run:

```bash
npm run demo                          # vite build + demo-server
# open http://localhost:4318/?source=live
```

On connect, the run auto-starts in Human mode. Each handoff opens a gate; OWL-1
auto-expands the waiting lane, and its `✓ APPROVE + CONTINUE` button posts
`gate.approve` back to the server (`postCommand`), resolving the `canUseTool` gate
and dispatching the next agent. The agent-chatter feed shows the real handoff babble.

Verified headlessly: the built app is served at `/`, an SSE connect auto-starts the
run and blocks at `gate_1`, and `POST /command {gate.approve, gate_1}` resumes the
pipeline (`gate.closed` → next agent runs → next gate opens).

## Files

| File | Role |
|------|------|
| `oap.mjs` | OAP session + envelope + enums (slice of `docs/owl-agent-protocol.md`) |
| `runner.mjs` | The gated runner. Asks `canUseTool` before each handoff dispatch |
| `policies.mjs` | `autoCanUseTool` and `makeHumanCanUseTool` — the Auto/Human switch |
| `gate-controller.mjs` | Bridges the awaited gate promise to the UI's approve command |
| `mock-designpowers.mjs` | **Swap point.** Scripted 2-agent slice → becomes a real SDK run |
| `demo.mjs` | Headless proof |
| `server.mjs` | Interactive HTTP/SSE OWL-1 stand-in (minimal page) |
| `demo-server.mjs` | Serves the **built OWL-1 app** + OAP relay (full 10-agent run) |
| `integration.test.mjs` | Folds a real run through `src/oap` reducer and asserts |

## This was a spike — the real backends now exist

The files above (`demo.mjs`, `runner.mjs`, `policies.mjs`, `mock-designpowers.mjs`) are the
**offline mock proof** — no model, no key, used by `npm run demo` and the tests. The real
backends were built alongside them and live in the same directory:

| File | Backend |
|------|---------|
| `sdk-runner.mjs` | **Claude** — Designpowers via the Claude Agent SDK. The handoff gate is a **`PreToolUse` hook** (not `canUseTool`, which the Claude Code runtime never calls — verified empirically). |
| `gemini-runner.mjs` | **Gemini** — OWL-1 owns the function-calling loop and pauses before each dispatch. |
| `live-server.mjs` | Serves the built app + relays OAP; selects the runner via `OWL_BACKEND`; handles `run.start`/`run.cancel`/`agent.create`. |

Run the real thing with `npm start` (Claude) or `OWL_BACKEND=gemini npm start` — see the
top-level [QUICKSTART.md](../../QUICKSTART.md). Both real runners reuse the exact gate
plumbing this spike proved (`GateController`, the `gate.opened`/`gate.approve` OAP events).
