# OWL-1 Component Spec for Google Stitch

**Purpose:** Complete UI component and interaction specification for building OWL-1 in Google Stitch. This document defines every screen, component, state, and interaction needed to orchestrate Designpowers' 10 design agents through a DAW-inspired interface.

**Visual Language:** Neomorphic hardware instrument — warm cream/off-white surfaces with soft embossed and debossed panels. Horizontal swim lanes showing agent waveforms. Single accent color: orange. Inspired by the Pharsonic FXR-805 synthesizer and PHARSONIC_OS orchestrator aesthetic. The interface should feel like a physical instrument you want to touch.

**Key layout concept:** Agents live in horizontal swim lanes stacked vertically, each showing a real-time waveform of activity. Collapsed lanes show the waveform + status at a glance. Expanded lanes reveal the agent's conversation, output, and controls. The right panel shows collective output — the work in progress on the actual project.

---

## Design Tokens

### Colors

```
Background/Surface
  --surface-base:        #E8E4DF    (warm cream — main background)
  --surface-raised:      #EDEBE7    (convex panels — lighter than base)
  --surface-inset:       #D9D5D0    (concave/recessed areas — waveform wells, output stream)
  --surface-deep:        #CCC8C3    (deeply recessed — expanded lane content wells)
  --border-none:         transparent (no visible borders — depth from shadow only)

Neomorphic Shadows
  --shadow-convex:       6px 6px 12px #C5C1BC, -6px -6px 12px #FFFFFF
  --shadow-concave:      inset 4px 4px 8px #C5C1BC, inset -4px -4px 8px #FFFFFF
  --shadow-pressed:      inset 2px 2px 4px #C5C1BC, inset -2px -2px 4px #FFFFFF
  --shadow-knob:         3px 3px 6px #B8B4AF, -2px -2px 4px #FFFFFF

Text
  --text-primary:        #4A4744    (dark warm gray — agent names, primary labels)
  --text-secondary:      #8A8683    (medium gray — descriptions, status)
  --text-muted:          #B0ADA9    (light gray — disabled, inactive lanes)
  --text-engraved:       #6B6865    (labels stamped into surface)

Accent — Orange (the ONLY chromatic color)
  --accent:              #F27A3A    (primary orange — waveforms, active elements, brand)
  --accent-light:        #F5995F    (lighter orange — hover, secondary waveforms)
  --accent-muted:        #E8C4A8    (desaturated orange — inactive waveforms, subtle accents)
  --accent-glow:         rgba(242, 122, 58, 0.3)  (orange glow for active LEDs)

Status LEDs (tiny dots — use orange for active, gray for idle)
  --led-active:          #F27A3A    (orange LED — running/active)
  --led-staged:          #F5995F    (lighter orange — awaiting approval)
  --led-idle:            #B0ADA9    (gray, unlit)
  --led-error:           #D94F4F    (muted red — the only non-orange chromatic, for errors only)
  --led-approved:        #4A4744    (dark — done, recedes)

LED Glow
  --glow-active:         0 0 6px 2px rgba(242, 122, 58, 0.4)
  --glow-staged:         0 0 6px 2px rgba(245, 153, 95, 0.3)
  --glow-error:          0 0 6px 2px rgba(217, 79, 79, 0.4)
```

### Typography

```
--font-mono:    "JetBrains Mono", "SF Mono", monospace
--font-label:   "Inter", "Helvetica Neue", sans-serif
--font-brand:   "Inter", weight 800, letter-spacing 0.15em

--type-xs:      9px / 12px, uppercase, letter-spacing 0.08em   (lane metadata, LED labels)
--type-sm:      11px / 14px, uppercase, letter-spacing 0.06em  (status text, knob labels)
--type-base:    13px / 18px                                     (body, conversation text)
--type-lg:      15px / 20px, uppercase, letter-spacing 0.04em  (agent names, section headers)
--type-xl:      18px / 24px, uppercase, letter-spacing 0.06em  (view titles)
--type-brand:   28px / 32px, uppercase, letter-spacing 0.15em  (OWL-1 stamp)
```

### Spacing

```
Base unit: 4px
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-6:  24px
--space-8:  32px
--space-12: 48px
```

### Borders & Radius

```
--radius-panel:     12px     (main panels)
--radius-inset:     8px      (recessed areas, waveform wells)
--radius-button:    6px      (buttons, toggles)
--radius-knob:      50%      (circular — knobs and LEDs)
--radius-fader:     4px      (fader channels)
--border-width:     0px      (NO borders — all depth from shadows)
```

### Control Components

```
Knob (rotary dial)
  Size: 40px (standard), 28px (compact), 56px (large)
  Style: --surface-raised, --shadow-knob
  Indicator line: 1px, --accent when active, --text-muted when idle
  Label: below, --font-mono --type-xs

Toggle button
  Off: --surface-inset, --shadow-concave, --text-muted
  On: --surface-raised, --shadow-convex, --text-primary
  Active: orange indicator dot or accent-colored label
  Size: label + 12px padding, 28px tall

LED
  Size: 6px (inline), 8px (lane header), 10px (transport)
  Off: --led-idle
  On: --led-active + --glow-active
```

---

## Global Shell

### Top Bar

- **Height:** 56px
- **Style:** --surface-raised with --shadow-convex
- **Left:** `OWL-1` in --font-brand --type-brand --text-engraved. Below in --type-xs: version (e.g., `v1.0.4-STABLE`)
- **Center:** Three view tabs: `ARRANGEMENT` (underlined when active) | `MIXER` | `NODES`
  - ARRANGEMENT = the swim lane view (primary, described below)
  - MIXER = per-agent parameter knobs (future)
  - NODES = routing/signal flow diagram (future)
- **Right:** Transport controls (▶ ■ ● ) + Settings gear

### Transport Controls (top right)

Compact cluster, like PHARSONIC_OS:

```
  (▶)  (■)  (●)    ⚙
  PLAY STOP  REC   SETTINGS
```

- ▶ PLAY: Run pipeline. When running, button stays pressed, orange LED glows beside it
- ■ STOP: Halt all agents
- ● REC: Record mode — capture user input into design-state (for conversational stages)
- Buttons are physical toggles: convex when up, concave when pressed

---

## Screen 1: Main View — Arrangement (Swim Lanes)

The primary interface. Two-column layout: swim lanes on the left (~70% width), collective output on the right (~30% width).

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  OWL-1              ARRANGEMENT  MIXER  NODES           ▶ ■ ●  ⚙   │
│  v1.0.4                                                              │
├─────────────────────────────────────────────┬────────────────────────┤
│                                             │                        │
│  ● DISCOVERY    STATUS: MAPPING LATENT SP ∧ │  SYSTEM DIAGNOSTICS    │
│  ┌─────────────────────────────────────────┐│                        │
│  │ [expanded lane content — see below]     ││  NEURAL_LOAD     42%   │
│  │                                         ││  ████████░░░░         │
│  │                                         ││                        │
│  └─────────────────────────────────────────┘│  CONTEXT_MEMORY        │
│                                             │  7.8 / 16 GB           │
│  ● STRATEGY    ┌──── waveform ────┐  IDLE  ││  █████████░░░         │
│                └──────────────────┘    ∨   ││                        │
│                                             │  I/O_LATENCY    14MS   │
│  ● TASTE       ┌──── waveform ────┐ ONLINE ││  ████████████████     │
│                └──────────────────┘    ∨   ││                        │
│                                             │  GLOBAL CONTROLS       │
│  ● VISUAL D.   ┌──── waveform ────┐OFFLINE ││                        │
│                └──────────────────┘    ∨   ││  ◎ HANDOFF   ◎ OVERRIDE│
│                                             │                        │
│  ● MOTION D.   ┌──── waveform ────┐FETCHING││  EVENT_LOG             │
│                └──────────────────┘    ∨   ││  [14:22:01] AGENT...   │
│                                             │  [14:22:15] VECTOR...  │
│  ● CONTENT W.  ┌──── waveform ────┐SYNCING ││  [14:23:05] AGENT...   │
│                └──────────────────┘    ∨   ││                        │
│                                             │                        │
│  ● BUILDER     ┌──── waveform ────┐OFFLINE ││                        │
│                └──────────────────┘    ∨   ││                        │
│                                             │                        │
│  ● CRITIC      ┌──── waveform ────┐  IDLE  ││  ┌────────────────────┐│
│                └──────────────────┘    ∨   ││  │ RENDER ARRANGEMENT ││
│                                             │  └────────────────────┘│
│  ● A11Y        ┌──── waveform ────┐  IDLE  ││                        │
│                └──────────────────┘    ∨   ││                        │
│                                             │                        │
│  ● HEURISTIC   ┌──── waveform ────┐  IDLE  ││                        │
│                └──────────────────┘    ∨   ││                        │
│                                             │                        │
├─────────────────────────────────────────────┴────────────────────────┤
│  ◎ CPU: 24%    ≡ MEM: 4.2GB    ✓ LAT: 12ms                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Left Column: Swim Lanes

A scrollable stack of horizontal agent lanes. Each lane can be collapsed or expanded.

**Left sidebar (optional, 200px):** Navigation — Library, Agents, Signal, Telemetry links. Like PHARSONIC_OS. Can be collapsed.

### Component: Collapsed Swim Lane

The default state. Shows the agent at a glance.

```
┌──────────────────────────────────────────────────────────────────┐
│  ● DESIGN LEAD   ┌──────── waveform ─────────┐   RUNNING    ∨  │
│                   └───────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

**Height:** 56px
**Style:** --surface-raised strip with --shadow-convex, full width of the lane column

**Elements left to right:**
- **LED** (8px): --led-active (orange) when running, --led-idle (gray) when off
- **Agent name:** --font-mono --type-lg --text-primary, UPPERCASE, letter-spaced
- **Waveform well:** --surface-inset recessed area, --shadow-concave. ~60% of lane width. Contains the live waveform visualization (see Waveform component below)
- **Status label:** --font-mono --type-sm --text-secondary. Right-aligned. States: `IDLE` / `RUNNING` / `STAGED` / `FETCHING` / `SYNCING` / `ONLINE` / `OFFLINE` / `ERROR`
- **Expand chevron** (∨): Click to expand this lane

**Lane States:**
- **Idle:** LED gray, waveform flat line (--accent-muted), status "IDLE" in --text-muted
- **Running:** LED orange with glow, waveform animating in --accent, status "RUNNING"
- **Staged:** LED lighter orange, waveform frozen at last state, status "STAGED"
- **Error:** LED red, waveform shows spike pattern in --led-error, status "ERROR"
- **Offline:** LED gray, waveform empty, status "OFFLINE" in --text-muted, entire lane at 60% opacity

### Component: Waveform

A real-time visualization of agent activity inside the recessed well of each lane.

**Visual style:**
- Line waveform drawn in --accent (#F27A3A) when active
- Stroke width: 2px
- Background: --surface-inset
- The waveform represents agent processing activity — peaks when the agent is actively generating, valleys when waiting for input or dependencies
- When idle: flat line in --accent-muted
- When running: animated oscillating waveform in --accent, with slight variation (not a perfect sine — organic, slightly irregular, like audio waveforms)
- When staged: waveform freezes at its last shape, color shifts to --accent-light
- Fill below the line: very subtle gradient from --accent at 10% opacity to transparent

**Different waveform patterns per status:**
- FETCHING: slow, wide waves (gathering data)
- SYNCING: regular, tight waves (processing/writing)
- RUNNING: irregular, active waves (generating content)
- IDLE: flat line with occasional tiny blip

### Component: Expanded Swim Lane

When the user clicks the expand chevron (∨), the lane grows to reveal the agent's full workspace. This is where you talk to the agent, see its output, and control its parameters.

**Height:** ~400px (adjustable by dragging)
**Style:** Lane expands smoothly (200ms ease-out). Other lanes push down. The expanded area is a --surface-inset recessed panel within the lane.

```
┌── EXPANDED SWIM LANE ───────────────────────────────────────────────┐
│  ● DISCOVERY   |  STATUS: MAPPING LATENT SPACE                  ∧  │
│  ───────────────────────────────────────────────────────────────────│
│                                                                      │
│  ┌─ USER ──────────────────────┐  ┌─ OUTPUT_PREVIEW ─────────────┐  │
│  │                              │  │                               │  │
│  │ Analyze the current trend    │  │ [VECTOR_ID: 99x2]            │  │
│  │ vectors for modular synth    │  │ >                             │  │
│  │ aesthetics in the 2024       │  │ ANALYZING_SURFACE_REFLEC...   │  │
│  │ industrial design landscape. │  │ CALCULATING_SPECULAR_VA...    │  │
│  │                              │  │ >                             │  │
│  └──────────────────────────────┘  │ MAPPING_ROUGHNESS: 0.85      │  │
│                                     │ METALNESS: 0.12              │  │
│          DISCOVERY AGENT            │ > STATUS: COMPLETE            │  │
│                                     │                               │  │
│  ┌──────────────────────────────┐  │  ┌───────────┐ ┌───────────┐ │  │
│  │ I've identified three        │  │  │EXPORT JSON│ │COMMIT NODE│ │  │
│  │ primary vectors:             │  │  └───────────┘ └───────────┘ │  │
│  │ 1. Tactile Neumorphism:     │  └───────────────────────────────┘  │
│  │ Moving away from flat glass  │                                     │
│  │ to physically-informed       │                                     │
│  │ depth. 2. Muted              │                                     │
│  │ Functionalism: Desaturated   │                                     │
│  │ palettes with high-contrast  │                                     │
│  │ technical typography...      │                                     │
│  └──────────────────────────────┘                                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ Enter prompt for Discovery agent...                           ▶ ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Layout within expanded lane — two columns:**

**Left column (~55%):** Conversation thread
- **User messages:** --surface-raised cards with --shadow-convex, left-aligned. Body text in --font-label --type-base
- **Agent responses:** Below user messages, right-aligned. --surface-raised cards. Agent name label above in --type-xs
- **Prompt input:** Bottom of the conversation column. Recessed text field (--surface-inset) with orange send arrow (▶). Placeholder: "Enter prompt for [Agent name]..."
- This is how you **talk to an individual agent** — give it direction, ask questions, steer its work

**Right column (~45%):** Output preview
- **Header:** `OUTPUT_PREVIEW` in --type-xs --text-secondary, with three LED dots (status indicators)
- **Content well:** --surface-inset recessed area showing the agent's raw output in --font-mono --type-sm. Monospaced, terminal-style. Auto-scrolls as agent produces output
- **Action buttons at bottom:** `EXPORT JSON` (--surface-raised toggle) and `COMMIT NODE` (--accent background, --surface-raised, acts as the APPROVE action). "Commit Node" = approve this output and merge to design-state

**Collapse:** Click ∧ chevron to collapse back to waveform view

### Component: Agent Banter (within expanded lane)

When multiple agents are active and communicating through design-state.md, their cross-talk appears as a subtle interleaved thread within the expanded lane:

```
  DESIGN SCOUT → STRATEGIST
  "Found strong pattern: competitors all use progressive disclosure.
   Flagging for principle consideration."

  STRATEGIST → DESIGN LEAD
  "Principle #3 confirmed: Progressive reveal over upfront complexity.
   Ready for visual interpretation."
```

- Banter messages are styled differently from user/agent conversation: --text-secondary, smaller (--type-sm), with a thin left border in --accent-muted
- Agent names in the handoff are --font-mono --type-xs
- This shows the "team talking to each other" — the agents' internal coordination made visible

---

### Right Column: Collective Output & Diagnostics

The right panel (~30% width) shows two things: the system state and the work in progress.

**Style:** --surface-raised panel with --shadow-convex

### Component: System Diagnostics (top of right panel)

```
SYSTEM DIAGNOSTICS

NEURAL_LOAD                    42%
████████████░░░░░░░░░░░░░░░

CONTEXT_MEMORY           7.8 / 16 GB
████████████████░░░░░░░░░░░

I/O_LATENCY                   14MS
████████████████████████████
```

- Title: --font-mono --type-lg --text-engraved
- Each metric: label in --type-xs, value right-aligned in --type-sm
- Progress bars: --surface-inset wells with --accent fill (orange bars)
- These represent real system metrics — how much context the agents are using, latency, processing load

### Component: Global Controls (middle of right panel)

```
GLOBAL CONTROLS

  ◎ HANDOFF        ◎ OVERRIDE
```

- Two large knobs (56px) for system-wide controls
- HANDOFF: controls when the system hands off to the next pipeline stage
- OVERRIDE: master override — user can force-direct any agent
- Knob indicators glow --accent when engaged

### Component: Event Log (right panel, scrollable)

```
EVENT_LOG

[14:22:01] AGENT_DISCOVERY init
[14:22:15] VECTOR_MAP generated
[14:23:05] AGENT_TASTE online
[14:24:50] Handing off to STRATEGY...
[14:25:01] THREAD_77 active
```

- Recessed well (--surface-inset), --font-mono --type-xs
- Timestamps in --text-muted, event text in --text-secondary
- Active/important events in --text-primary with bold
- Auto-scrolls, can be scrolled up to review history

### Component: Work in Progress / Render (right panel, below event log)

The collective output viewport. Shows the actual design work being assembled.

```
┌─ WORK IN PROGRESS ───── (recessed viewport) ──────┐
│                                                     │
│  [Live preview of the design being built —          │
│   components, layouts, copy, all assembling         │
│   as agents contribute their pieces]                │
│                                                     │
└─────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│        RENDER ARRANGEMENT            │
└──────────────────────────────────────┘
```

- **Viewport:** Large --surface-deep recessed area showing the design output. Updates live as agents commit work to design-state
- **RENDER ARRANGEMENT button:** Large --accent-colored button at the bottom. Triggers a full render of all committed work into the final deliverable. Like "bounce to disk" in a DAW — compile everything into the output

### Component: Status Bar (bottom)

Thin bar at very bottom, like PHARSONIC_OS:

```
◎ CPU: 24%    ≡ MEM: 4.2GB    ✓ LAT: 12ms
```

- --surface-raised, 32px tall
- Metrics in --font-mono --type-xs --text-secondary
- LED dots before each metric

---

## Screen 2: Welcome / Onboarding

Centered on --surface-base. A single raised panel with the owl and brand.

```
┌──────────────────────────────────────────────────────────────────────┐
│  OWL-1                                                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                    ┌─── (raised panel) ────────────┐                 │
│                    │                                │                 │
│                    │          <o)                    │                 │
│                    │          /) )                   │                 │
│                    │        ==#===                   │                 │
│                    │                                │                 │
│                    │     O W L - 1                  │                 │
│                    │                                │                 │
│                    │  You've got a design team now. │                 │
│                    │                                │                 │
│                    │  10 design agents work through │                 │
│                    │  your project — research,      │                 │
│                    │  strategy, visual design,      │                 │
│                    │  content, accessibility, code. │                 │
│                    │                                │                 │
│                    │  You're the creative director. │                 │
│                    │                                │                 │
│                    │  ┌────────────┐ ┌───────────┐ │                 │
│                    │  │ SHOW ME    │ │ LET'S GO  │ │                 │
│                    │  │ HOW        │ │           │ │                 │
│                    │  └────────────┘ └───────────┘ │                 │
│                    │                                │                 │
│                    └────────────────────────────────┘                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Buttons: --surface-raised toggles. "LET'S GO" has --accent background (orange).

---

## Screen 3: Discovery Stage (Expanded Lane)

When the project starts, the DISCOVERY lane auto-expands. All other lanes show as collapsed with OFFLINE status and flat waveforms.

This is Screen 1 with the Discovery lane expanded — the user has a conversation in the left column, the brief builds in the output preview on the right. The "COMMIT NODE" button here reads "APPROVE BRIEF → START."

---

## Screen 4: Strategy Stage

After brief approval, DISCOVERY lane collapses (waveform frozen, status "COMPLETE"). STRATEGY lane auto-expands.

Same layout — conversation left, output right. The Strategist agent leads the conversation about principles, competitive positioning, experience mapping. Output preview shows the strategy document building live.

"COMMIT NODE" reads "APPROVE STRATEGY → TASTE"

---

## Screen 5: Taste Calibration Stage

STRATEGY collapses. TASTE (mapped to Inspiration Scout) auto-expands.

Conversation: aesthetic questions, reference gathering.
Output preview: reference images, taste profile building.
A small gallery grid appears in the output area for visual references.

"COMMIT NODE" reads "APPROVE TASTE → RUN PIPELINE"

---

## Screen 6: Pipeline Running (All Agents)

After taste approval, multiple lanes activate simultaneously. Their waveforms begin animating in orange. The event log populates rapidly.

This is the core working state — the user watches waveforms moving across all active lanes, can expand any lane to see what that agent is doing, talk to it, or review its output.

Agents that are waiting for dependencies show IDLE with flat waveforms. As upstream agents commit, downstream agents activate.

The Work in Progress viewport on the right begins showing the design being assembled.

---

## Screen 7: Verification Stage

After main pipeline agents complete, three lanes activate together: CRITIC, A11Y, HEURISTIC.

Expanding any of these shows their audit results in the output preview. The expanded conversation shows the reviewer's findings.

The Work in Progress viewport shows the design with verification annotations overlaid (issues flagged inline).

---

## Screen 8: Handoff Stage

BUILDER lane activates to compile the deliverable package. Expanding it shows the export manifest:

```
  ◎ Components      12 specs              ● ready
  ◎ Design Tokens   42 tokens exported    ● ready
  ◎ Interactions    8 flows documented    ● ready
  ◎ Accessibility   WCAG AA matrix        ● ready
  ◎ Content         All copy finalized    ● ready
  ◎ Motion          Animation specs       ● ready
```

"RENDER ARRANGEMENT" button in the right panel becomes the primary action — it compiles everything into the final export.

---

## Screen 9: Retrospective

All lanes show completed waveforms (frozen, --accent-muted). A special RETRO lane appears at the bottom:

Expanding it shows:
- Decisions log (scrollable)
- What worked / what to improve
- Taste evolution signals
- "SAVE TO MEMORY" button (writes to persistent taste profile)
- "CLOSE PROJECT" button

---

## Interaction Specifications

### 1. Expanding a Lane

**Trigger:** Click anywhere on a collapsed lane, or click the ∨ chevron
**Flow:**
1. Lane smoothly expands (200ms ease-out) to ~400px height
2. Other lanes push down, remaining scrollable
3. Conversation thread and output preview appear
4. Prompt input field is immediately focusable
5. If the agent is running, output stream is live-scrolling
6. Click ∧ to collapse

### 2. Talking to an Agent

**Trigger:** User types in the prompt input field within an expanded lane and hits enter or clicks ▶
**Flow:**
1. User message appears in conversation thread (left column, --surface-raised card)
2. Agent processes the input
3. Agent's response appears below (right-aligned card)
4. Output preview updates with any generated content
5. Waveform shows spike of activity during processing

### 3. Seeing Agent Banter

**Trigger:** Agents pass data between each other through design-state.md
**Flow:**
1. In any expanded lane, cross-agent messages appear as subtle interleaved entries
2. Format: `AGENT_A → AGENT_B: "message"`
3. Styled in --text-secondary, smaller than direct conversation
4. Thin left border in --accent-muted
5. Shows the team coordinating — builds trust and transparency

### 4. Committing Output

**Trigger:** User clicks "COMMIT NODE" in an expanded lane's output preview
**Flow:**
1. Agent's output merges into design-state.md
2. Waveform freezes at current shape, color shifts to --accent-muted
3. Status changes to "COMPLETE"
4. Downstream agents that depend on this output may activate (their waveforms start)
5. Work in Progress viewport on right updates with the new contribution
6. Event log records: `[timestamp] AGENT_NAME committed to STATE`

### 5. Rendering the Arrangement

**Trigger:** User clicks "RENDER ARRANGEMENT" button in right panel
**Flow:**
1. All committed agent outputs compile into the final deliverable
2. Button shows progress: "RENDERING... 45%"
3. Work in Progress viewport shows the final output assembling
4. On complete: button changes to "EXPORT" — click to download/save the deliverable

### 6. Running the Full Pipeline

**Trigger:** User clicks ▶ PLAY in transport, or approves a stage that triggers the next
**Flow:**
1. Play button presses down (concave), orange LED glows
2. Active lanes' waveforms begin animating
3. Inactive lanes stay flat
4. Event log scrolls with activity
5. System diagnostics update in real time
6. User can expand any lane at any time to observe or intervene

### 7. Error in an Agent

**Trigger:** Agent encounters a failure
**Flow:**
1. Lane's LED turns red (--led-error with --glow-error)
2. Waveform shows sharp spike pattern in red
3. Status reads "ERROR"
4. Expanding the lane shows error details in the output preview
5. Conversation column offers: "RETRY" / "SKIP" / "REPORT" buttons
6. Other agents continue around the failure

### 8. Stage Progression

**Trigger:** User commits output at a stage boundary (e.g., APPROVE BRIEF, APPROVE STRATEGY)
**Flow:**
1. Current stage's lane collapses with COMPLETE status
2. Next stage's lane auto-expands
3. View tabs in top bar could show stage progress (optional)
4. Event log records stage transition

---

## Keyboard Shortcuts

```
SPACE           Play/Pause pipeline
ESC             Stop all agents
↑ / ↓           Navigate between lanes
ENTER           Expand selected lane (or focus prompt input if expanded)
CMD+ENTER       Commit current agent's output
M               Mute selected lane (skip agent)
CMD+Z           Undo last commit
```

---

## Responsive Behavior

Desktop-first (1440px+).

- **1440px+:** Full two-column layout (lanes + right panel)
- **1200–1439px:** Right panel collapses to a slim 280px sidebar, event log hidden
- **1024–1199px:** Right panel becomes a collapsible drawer (slides in from right)
- **Below 1024px:** Not supported. Message: "OWL-1 is designed for desktop screens."

---

## Agent-to-Lane Mapping

All 10 Designpowers agents mapped to swim lanes:

| Lane Name | Agent | Waveform Pattern | Pipeline Stage |
|-----------|-------|------------------|----------------|
| DISCOVERY | Design Scout + Strategist | Slow, wide waves | DISCOVER |
| STRATEGY | Design Strategist | Regular, structured | STRATEGY |
| TASTE | Inspiration Scout | Irregular, organic | TASTE |
| DESIGN LEAD | Design Lead | Dense, active | PIPELINE |
| CONTENT W. | Content Writer | Even, rhythmic | PIPELINE |
| MOTION D. | Motion Designer | Bouncy, spring-like | PIPELINE |
| BUILDER | Design Builder | Steady, mechanical | PIPELINE + HANDOFF |
| CRITIC | Design Critic | Sharp, analytical | VERIFY |
| A11Y | Accessibility Reviewer | Methodical, scanning | VERIFY |
| HEURISTIC | Heuristic Evaluator | Stepped, systematic | VERIFY |

---

## Brand Stamp

Bottom of the interface, centered below the status bar:

```
O W L - 1
```

In --font-brand --text-muted --type-xs. Embossed into the chassis like "PHARSONIC" on the reference hardware.
