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

## Files

| File | Role |
|------|------|
| `oap.mjs` | OAP session + envelope + enums (slice of `docs/owl-agent-protocol.md`) |
| `runner.mjs` | The gated runner. Asks `canUseTool` before each handoff dispatch |
| `policies.mjs` | `autoCanUseTool` and `makeHumanCanUseTool` — the Auto/Human switch |
| `gate-controller.mjs` | Bridges the awaited gate promise to the UI's approve command |
| `mock-designpowers.mjs` | **Swap point.** Scripted 2-agent slice → becomes a real SDK run |
| `demo.mjs` | Headless proof |
| `server.mjs` | Interactive HTTP/SSE OWL-1 stand-in |

## The real-backend swap

`mock-designpowers.mjs`'s `dispatchAgent` is the only thing that's fake. To go live:

1. Replace `dispatchAgent` with a Claude Agent SDK `query()` that runs the Designpowers
   subagent for `agentId`, feeding `onNarrate`/`onArtifact`/`onBabble` from the SDK
   message stream and `design-state.md` writes.
2. Pass the SDK's real `canUseTool` option straight through to `makeHumanCanUseTool`'s
   decision — the gate logic is unchanged.
3. Point OWL-1's frontend at the same event stream the `server.mjs` SSE endpoint emits
   (next milestone: frontend decoupling).
