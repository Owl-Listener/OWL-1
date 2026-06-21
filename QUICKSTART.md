# OWL-1 — Quickstart (run real design agents)

Direct a team of 10 Designpowers agents from inside OWL-1: describe what you want,
watch them work in real time, approve each handoff, and steer any agent whenever you
like. This runs the **real** agents, so it produces real design work.

## You need

1. **Node 18 or newer.** Check with `node --version`. No Node? Install from
   [nodejs.org](https://nodejs.org) (or `brew install node` on a Mac).
2. **An Anthropic API key.** Get one at
   [console.anthropic.com](https://console.anthropic.com) → **API keys**. (Real agent
   runs use your Anthropic account and cost money — start with a small brief.)

## Run it (4 steps)

```bash
# 1. Get the pack
git clone https://github.com/Owl-Listener/OWL-1-Proto.git
cd OWL-1-Proto

# 2. Install
npm install

# 3. Add your key (this line lasts for the current terminal window)
export ANTHROPIC_API_KEY=sk-ant-...

# 4. Start
npm start
```

Then open **http://localhost:4318/?source=live** in your browser.

## Direct your team

1. **Type what you want to design** in the chat at the top (e.g. *"A calm cookie-consent
   banner that makes 'reject' as easy as 'accept'"*). That's your brief — it starts the run.
2. **Watch the lanes light up** as each agent works — research, strategy, taste, content,
   visual design, motion, build, and the reviewers. Their handoff notes stream in the
   chatter panel on the right.
3. **Approve each handoff.** When an agent is ready to hand to the next, its lane opens
   with **✓ APPROVE + CONTINUE**. You're the creative director — nothing proceeds until
   you say so.
4. **Steer anytime.** Type into the chat to redirect: *"Make it warmer,"* *"Design Lead,
   why frosted glass?"*, *"Skip motion,"* *"Also handle dark mode."* Your word wins.

The design output and `design-state.md` are written into `.dp-workspace/` as the team works.

## What to expect (pace + cost)

Real agents do real work, so this is not instant:

- **Give it time.** A full run takes roughly **10–20 minutes** — each agent genuinely
  researches, designs, and builds (the builder writing real HTML is the slow part). The
  lanes and chatter update live so you can watch progress; it's working even when a single
  agent is "thinking" for a while.
- **AUTO vs HUMAN.** In **HUMAN** mode (the default) it pauses at every handoff for your
  approval — most control, most clicking. Switch the transport to **AUTO** before you send
  the brief to let the team run hands-free and review at the end. Tip: start in AUTO for
  your first run so you can see the whole pipeline without babysitting it.
- **It costs real money.** A run uses your Anthropic credit — a lean POC is on the order of
  ~$1; a full multi-agent run with reviewers is more. Start small.

## Just want to look around first? (no key, no cost)

```bash
npm run demo          # open http://localhost:4318/?source=live
```

This runs a **scripted** mock of the same UI — same lanes, babble, and approval gates, but
no real agents and no API spend. Great for seeing how it feels before running for real.

## Troubleshooting

- **"No ANTHROPIC_API_KEY set"** in the chat → you skipped step 3, or opened a new terminal.
  Re-run `export ANTHROPIC_API_KEY=sk-ant-...` then `npm start`.
- **`npm: command not found`** → install Node (see "You need" above).
- **Port already in use** → `PORT=4400 npm start`, then open `http://localhost:4400/?source=live`.
- **Nothing happens after I type a brief** → check the terminal for errors; confirm the
  startup line said `✓ ANTHROPIC_API_KEY detected.`

## What's under the hood (optional)

OWL-1 is the front end; **Designpowers** (vendored in `vendor/designpowers/`) is the agent
team. They talk over the **OWL Agent Protocol** (`docs/owl-agent-protocol.md`). The real
runner drives Designpowers through the **Claude Agent SDK**; OWL-1's APPROVE button is
literally the SDK's per-handoff permission gate. See `spike/oap-gate/` for the internals.
