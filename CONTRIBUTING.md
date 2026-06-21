# Contributing to OWL-1

Thanks for being here. OWL-1 is a workstation for directing AI design agents — a DAW-style
UI that drives the [Designpowers](https://github.com/Owl-Listener/designpowers) team through
real models. It's an **alpha**: the core works (real agents produce real design work), and
there's a clear list of things that would make it a product. Help is genuinely welcome.

## The one concept to understand first

OWL-1 has three parts, and the seam between them is the whole architecture:

```
  OWL-1 UI  ──OAP events──▶  a backend runner  ──drives──▶  a model + Designpowers
 (src/)      ◀──commands──   (spike/oap-gate/)              (Claude or Gemini)
```

Everything talks over the **OWL Agent Protocol** ([`docs/owl-agent-protocol.md`](docs/owl-agent-protocol.md)) —
a small set of events (server→UI) and commands (UI→server). **The UI never knows which model
or framework is running.** That's the point: the UI is provider-agnostic, and a backend is a
swappable adapter.

If you read one thing before contributing, read the protocol doc.

## Run it, three ways

```bash
npm install

npm run dev      # the UI on simulated data — no key, no cost (http://localhost:5173)
npm run demo     # the UI on a scripted mock backend (http://localhost:4318/?source=live)
npm start        # the real thing — needs a key (below)
```

Real backends:

```bash
export ANTHROPIC_API_KEY=sk-ant-...   && npm start                 # Claude (default)
export GEMINI_API_KEY=...             && OWL_BACKEND=gemini npm start  # Gemini
```

Real runs take ~10–20 min and cost credit — see [QUICKSTART.md](QUICKSTART.md).

## Project layout

| Path | What it is |
|------|------------|
| `src/owl-1-prototype.jsx` | The full UI (single file — yes, it's large; see the roadmap) |
| `src/oap/` | The OAP frontend layer: reducer, event source, the live runtime |
| `src/sampleData.js` | Placeholder data for the offline/sim experience |
| `spike/oap-gate/` | The backends + protocol plumbing |
| `spike/oap-gate/sdk-runner.mjs` | **Claude** runner (reference backend) |
| `spike/oap-gate/gemini-runner.mjs` | **Gemini** runner (reference backend) |
| `spike/oap-gate/live-server.mjs` | Serves the app + relays OAP; selects the runner |
| `vendor/designpowers/` | The 10-agent Designpowers team (markdown), vendored |
| `scripts/setup-designpowers.mjs` | Lays out the workspace a runner loads |
| `docs/owl-agent-protocol.md` | The contract |

## Adding a new backend (a model or a swarm)

This is the highest-leverage contribution, and the architecture is built for it. A backend is
one async function with this shape (see `sdk-runner.mjs` and `gemini-runner.mjs` as the two
reference implementations):

```js
export async function runX({ session, gates, brief, mode, workspace, inputQueue, automated }) {
  // 1. emit run.started + an agent.status (idle) per agent
  // 2. run the pipeline; for each handoff:
  //      - in mode 'human': gates.request() + emit gate.opened, await approval
  //      - emit agent.status running/done, message (babble/narration), artifact.created
  // 3. emit telemetry.tick (token/cost) and, at the end, run.finished
}
```

Then wire it into `live-server.mjs`'s `OWL_BACKEND` switch. If your backend emits valid OAP,
the UI, the gate, and everything else work unchanged. The two existing runners show the two
shapes: a native agent runtime (Claude) and an own-the-loop API orchestrator (Gemini).

## Where help is most wanted (the honest roadmap)

These are the real gaps. Several double as good first issues:

**Verification (hands-on, high value):**
- Confirm a full Claude run *finishes* cleanly and the live panels render real data.
- Run the Gemini backend with a real key and fix any `@google/genai` response-shape mismatches (the parsing in `gemini-runner.mjs` is defensive but unconfirmed).

**The "trust" features (the ones that matter most for real use):**
- **Spend estimate + cap** before a run starts, with a hard kill at the cap (Govern).
- **Cancel / rollback** a run mid-flight (Recover) — we only have a soft reset today.

**Finish the live surfaces** (these still show sample data in live mode):
- Real **blockers** parsed from Designpowers' safeguards / fix-list.
- Surfacing agent-**initiated questions** in the UI.
- **Memory / taste profile** persistence.

**Hardening (toward a real release):**
- A real test suite around the OAP reducer and the runners, and CI to run it.
- Breaking up `owl-1-prototype.jsx` into modules.

## Conventions

- **Match the surrounding code.** No new frameworks or build steps without discussion.
- **Keep the sim path working.** Live features are additive and gated by `?source=live`;
  `npm run dev` (no key) must keep working unchanged.
- **Verify what you can, and say what you verified.** `npm run build` and
  `npm run spike:test` should pass. If a change needs a real run to confirm, say so in the PR
  rather than implying it's verified — honesty about what's tested is a core norm here.
- **Be kind.** Assume good faith; keep discussion constructive.

## Submitting

1. Branch, make your change, run `npm run build` + `npm run spike:test`.
2. Open a pull request (draft is fine) describing **what** changed and **what you verified**.
3. Note any follow-ups or known gaps — partial, honest PRs beat polished, overclaimed ones.

Licensed under MIT (see [LICENSE](LICENSE)); contributions are accepted under the same terms.
