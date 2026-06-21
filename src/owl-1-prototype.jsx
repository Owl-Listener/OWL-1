import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { useOapRuntime, liveRuntime, OWL_ID_BY_OAP, owlIdFor, oapIdFor, postCommand } from "./oap/index.js";
import { sampleProject, eventLogs, conversationData, outputPreviewData, banterMessages, projectConstraints, projectBlockers, projectDeliverables } from "./sampleData.js";

// === CUSTOM SCROLLBAR + PSEUDO-SELECTOR STYLES ===
// Injected as a <style> tag because ::-webkit-scrollbar can't be set inline.
// Built as a function so it adapts to the current theme.
function buildCSS(t) {
  // Extract shadow components from the convex shadow string
  const isDark = t.surface.base.startsWith("#1") || t.surface.base.startsWith("#2");
  const shadowDark = isDark ? "#0A0A0A" : "#C5C1BC";
  const shadowLight = isDark ? "#333333" : "#FFFFFF";
  return `
  *::-webkit-scrollbar { width: 6px; height: 6px; }
  *::-webkit-scrollbar-track { background: transparent; margin: 4px 0; }
  *::-webkit-scrollbar-thumb { background: ${t.scrollbar.thumb}; border-radius: 3px; transition: background 0.2s ease; }
  *::-webkit-scrollbar-thumb:hover { background: ${t.scrollbar.thumbHover}; }
  *::-webkit-scrollbar-corner { background: transparent; }
  * { scrollbar-width: thin; scrollbar-color: ${t.scrollbar.thumb} transparent; }

  .neo-btn { transition: box-shadow 0.15s ease, transform 0.1s ease !important; }
  .neo-btn:hover { box-shadow: 8px 8px 16px ${shadowDark}, -8px -8px 16px ${shadowLight} !important; transform: translateY(-1px); }
  .neo-btn:active { box-shadow: inset 2px 2px 4px ${shadowDark}, inset -2px -2px 4px ${shadowLight} !important; transform: translateY(0px); }

  .neo-btn-primary { transition: box-shadow 0.15s ease, transform 0.1s ease, filter 0.15s ease !important; }
  .neo-btn-primary:hover { box-shadow: 8px 8px 16px ${shadowDark}, -8px -8px 16px ${shadowLight} !important; transform: translateY(-1px); filter: brightness(1.05); }
  .neo-btn-primary:active { box-shadow: inset 2px 2px 4px rgba(0,0,0,0.15), inset -2px -2px 4px rgba(255,255,255,0.1) !important; transform: translateY(0px); filter: brightness(0.95); }

  @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes inputPulse {
    0%, 100% { box-shadow: inset 2px 2px 4px ${shadowDark}, inset -2px -2px 4px ${shadowLight}; }
    50% { box-shadow: inset 2px 2px 4px ${shadowDark}, inset -2px -2px 4px ${shadowLight}, 0 0 0 2px ${t.accent.glow}; }
  }

  .neo-lane:hover {
    box-shadow: 8px 8px 16px ${shadowDark}, -8px -8px 16px ${shadowLight} !important;
    background: ${t.surface.raised} !important;
    transform: translateY(-1px);
    transition: box-shadow 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.2s cubic-bezier(0.16,1,0.3,1), background 0.2s ease-out;
  }
  .neo-lane:hover .idle-name { color: ${t.text.secondary} !important; }

  .neo-nav:hover { box-shadow: 4px 4px 8px ${shadowDark}, -4px -4px 8px ${shadowLight} !important; }
  .neo-nav:active { box-shadow: inset 2px 2px 4px ${shadowDark}, inset -2px -2px 4px ${shadowLight} !important; }
  `;
}

// === DESIGN TOKENS ===
// === THEME SYSTEM ===
// Light and dark token sets. The app switches between them via React state.
// Neomorphic shadows adapt: light mode uses white highlights, dark mode uses subtle bright edges.

const lightTokens = {
  surface: { base: "#E8E4DF", raised: "#EDEBE7", inset: "#D9D5D0", deep: "#CCC8C3" },
  text: { primary: "#4A4744", secondary: "#5E5B58", muted: "#8A8683", hint: "#656260" },
  accent: { main: "#F27A3A", text: "#9E4716", light: "#F5995F", muted: "#E8C4A8", glow: "rgba(242,122,58,0.3)" },
  led: { active: "#F27A3A", staged: "#F5995F", idle: "#8A8683", error: "#D94F4F", approved: "#4A4744" },
  shadow: {
    convex: "6px 6px 12px #C5C1BC, -6px -6px 12px #FFFFFF",
    concave: "inset 4px 4px 8px #C5C1BC, inset -4px -4px 8px #FFFFFF",
    pressed: "inset 2px 2px 4px #C5C1BC, inset -2px -2px 4px #FFFFFF",
    knob: "3px 3px 6px #B8B4AF, -2px -2px 4px #FFFFFF",
  },
  scrollbar: { thumb: "#C5C1BC", thumbHover: "#B0ADA9" },
};

const darkTokens = {
  surface: { base: "#1E1E1E", raised: "#2A2A2A", inset: "#161616", deep: "#111111" },
  text: { primary: "#E0DDD9", secondary: "#B0ADA9", muted: "#6B6866", hint: "#8A8683" },
  accent: { main: "#F27A3A", text: "#F5995F", light: "#F5995F", muted: "#5C3A22", glow: "rgba(242,122,58,0.25)" },
  led: { active: "#F27A3A", staged: "#F5995F", idle: "#6B6866", error: "#E85555", approved: "#E0DDD9" },
  shadow: {
    convex: "6px 6px 14px #0A0A0A, -6px -6px 14px #333333",
    concave: "inset 4px 4px 8px #0A0A0A, inset -4px -4px 8px #333333",
    pressed: "inset 2px 2px 4px #0A0A0A, inset -2px -2px 4px #333333",
    knob: "3px 3px 6px #0A0A0A, -2px -2px 4px #333333",
  },
  scrollbar: { thumb: "#444", thumbHover: "#555" },
};

// Shared tokens that don't change between themes
const sharedTokens = {
  radius: { panel: 12, inset: 8, button: 6 },
  font: { mono: "'JetBrains Mono', 'SF Mono', monospace", sans: "'Inter', 'Helvetica Neue', sans-serif" },
  type: { label: 9, body: 11, title: 14, display: 24 },
};

function buildTokens(theme) {
  const base = theme === "dark" ? darkTokens : lightTokens;
  return { ...base, ...sharedTokens };
}

// Default — will be overridden by React state, but needed for initial render and non-component code
let tokens = buildTokens("light");

// Theme context — components call useTheme() to get current tokens + toggle
const ThemeContext = createContext({ tokens: buildTokens("light"), theme: "light", toggleTheme: () => {} });
function useTheme() { return useContext(ThemeContext); }

// === SOUND DESIGN ===
// Synthesized audio feedback using Web Audio API.
// Warm, minimal, unobtrusive. Every sound is under 200ms.
// Respects the soundEnabled setting passed from the app.

const SoundEngine = (() => {
  let ctx = null;
  let enabled = false;

  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  // Utility: play a tone with attack/release envelope
  const tone = (freq, duration, { type = "sine", gain = 0.12, attack = 0.01, release = 0.08, detune = 0 } = {}) => {
    if (!enabled) return;
    const c = getCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + attack);
    g.gain.linearRampToValueAtTime(0, c.currentTime + duration - release);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  };

  // Utility: filtered noise burst (for clicks and knocks)
  const noise = (duration, { freq = 800, gain = 0.08, attack = 0.002, release = 0.04 } = {}) => {
    if (!enabled) return;
    const c = getCtx();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + attack);
    g.gain.linearRampToValueAtTime(0, c.currentTime + duration - release);
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start(c.currentTime);
  };

  return {
    setEnabled: (v) => { enabled = v; },

    // Transport: play — warm rising two-note (C5 → E5)
    play: () => {
      tone(523, 0.12, { gain: 0.10, attack: 0.005, release: 0.06 });
      setTimeout(() => tone(659, 0.14, { gain: 0.08, attack: 0.005, release: 0.08 }), 60);
    },

    // Transport: stop — gentle descending note (E5 → C5)
    stop: () => {
      tone(659, 0.10, { gain: 0.07, attack: 0.005, release: 0.05 });
      setTimeout(() => tone(523, 0.16, { gain: 0.06, attack: 0.005, release: 0.10 }), 50);
    },

    // Transport: record — brighter pulse with slight detune for warmth
    record: () => {
      tone(587, 0.10, { gain: 0.10, attack: 0.003, release: 0.05, detune: 5 });
      setTimeout(() => tone(784, 0.18, { gain: 0.09, attack: 0.005, release: 0.10, detune: -5 }), 70);
    },

    // Lane expand — breathy pop
    expand: () => {
      noise(0.06, { freq: 2400, gain: 0.05, attack: 0.002, release: 0.03 });
      tone(880, 0.08, { gain: 0.04, attack: 0.003, release: 0.05 });
    },

    // Lane collapse — same, pitched down
    collapse: () => {
      noise(0.06, { freq: 1600, gain: 0.04, attack: 0.002, release: 0.03 });
      tone(660, 0.08, { gain: 0.03, attack: 0.003, release: 0.05 });
    },

    // Approve/confirm — satisfying major third chime (C5 + E5 together)
    approve: () => {
      tone(523, 0.22, { gain: 0.09, attack: 0.005, release: 0.12, type: "triangle" });
      tone(659, 0.22, { gain: 0.07, attack: 0.01, release: 0.12, type: "triangle" });
      setTimeout(() => tone(784, 0.20, { gain: 0.06, attack: 0.005, release: 0.14, type: "triangle" }), 100);
    },

    // Save draft — single warm tone
    save: () => {
      tone(440, 0.18, { gain: 0.07, attack: 0.005, release: 0.10, type: "triangle" });
    },

    // Blocker attention — gentle wooden knock
    knock: () => {
      noise(0.08, { freq: 1200, gain: 0.10, attack: 0.001, release: 0.05 });
      tone(350, 0.06, { gain: 0.05, attack: 0.002, release: 0.04 });
    },

    // UI click — tiny tick for buttons
    tick: () => {
      noise(0.03, { freq: 3000, gain: 0.03, attack: 0.001, release: 0.02 });
    },
  };
})();

// === AGENTS DATA ===
// phase = when in the cycle (0–1) this agent peaks. duration = how long it stays active.
const agentsData = [
  { id: "lead", name: "Design Lead", desc: "Central creative orchestrator. Harmonizes inputs from research into visual solutions.", phase: 0.0, duration: 0.9, receives: ["ALL AGENTS"], handsTo: ["ALL AGENTS"], stage: "ALL STAGES" },
  { id: "discovery", name: "Design Scout", desc: "Explores the problem space. Maps competitors, gathers evidence, surfaces patterns.", phase: 0.0, duration: 0.25, receives: ["Design Lead"], handsTo: ["Design Strategist", "Inspiration Scout"], stage: "DISCOVER" },
  { id: "strategy", name: "Design Strategist", desc: "Sets design direction. Defines principles, maps user journeys, aligns decisions.", phase: 0.15, duration: 0.2, receives: ["Design Scout", "Design Lead"], handsTo: ["Inspiration Scout", "Content Writer", "Design Builder"], stage: "STRATEGY" },
  { id: "taste", name: "Inspiration Scout", desc: "Calibrates aesthetic direction. Curates references, defines emotional targets.", phase: 0.25, duration: 0.2, receives: ["Design Scout", "Design Strategist"], handsTo: ["Design Lead", "Design Builder"], stage: "TASTE" },
  { id: "content", name: "Content Writer", desc: "Linguistic precision engine. Crafts narratives and microcopy for maximum clarity.", phase: 0.4, duration: 0.2, receives: ["Design Strategist", "Design Lead"], handsTo: ["Design Builder", "Design Critic"], stage: "DESIGN" },
  { id: "motion", name: "Motion Designer", desc: "Animation and choreography. Ensures motion is purposeful, performant, and safe.", phase: 0.5, duration: 0.15, receives: ["Design Lead", "Design Builder"], handsTo: ["Design Builder", "Accessibility Reviewer"], stage: "DESIGN" },
  { id: "builder", name: "Design Builder", desc: "Production-grade assembler. Converts visual intent into structural reality.", phase: 0.55, duration: 0.25, receives: ["Design Strategist", "Inspiration Scout", "Content Writer", "Motion Designer"], handsTo: ["Design Critic", "Accessibility Reviewer"], stage: "DESIGN" },
  { id: "critic", name: "Design Critic", desc: "Reviews work against brief, principles, and design intent.", phase: 0.7, duration: 0.15, receives: ["Design Builder", "Content Writer"], handsTo: ["Design Lead", "Design Builder"], stage: "VERIFY" },
  { id: "a11y", name: "Accessibility Reviewer", desc: "Accessibility guardian. Evaluates against WCAG, COGA, and inclusive design.", phase: 0.75, duration: 0.15, receives: ["Design Builder", "Motion Designer"], handsTo: ["Design Builder", "Design Lead"], stage: "VERIFY" },
  { id: "heuristic", name: "Heuristic Evaluator", desc: "Usability evaluator. Runs Nielsen's heuristics and cognitive walkthroughs.", phase: 0.8, duration: 0.15, receives: ["Design Builder"], handsTo: ["Design Lead", "Design Builder"], stage: "VERIFY" },
];

// Compute activity level for an agent given global clock (0–1 cycling)
function getActivity(agentPhase, agentDuration, clock) {
  // How far into this agent's active window are we?
  let dist = clock - agentPhase;
  if (dist < 0) dist += 1; // wrap around
  if (dist > agentDuration) return 0;
  // Smooth bell curve within the active window
  const t = dist / agentDuration;
  return Math.sin(t * Math.PI); // 0 → 1 → 0
}

function getStatus(activity) {
  if (activity > 0.5) return "running";
  if (activity > 0.1) return "online";
  return "idle";
}

// Live-aware activity. When an OAP source is connected (liveRuntime.active), an
// agent's activity comes from real swarm events; otherwise it falls back to the
// original sine-curve simulation. This is the single seam that lets every view
// run on Designpowers' live event stream instead of fake data.
function getAgentActivity(agent, clock) {
  if (liveRuntime.active) {
    const live = liveRuntime.agents[agent.id];
    return live ? live.activity : 0;
  }
  return getActivity(agent.phase, agent.duration, clock);
}

// === PIPELINE STAGES ===
const pipelineStages = [
  { id: "discover", label: "DISCOVER", pct: 0.15 },
  { id: "strategy", label: "STRATEGY", pct: 0.25 },
  { id: "taste", label: "TASTE", pct: 0.35 },
  { id: "design", label: "DESIGN", pct: 0.55 },
  { id: "verify", label: "VERIFY", pct: 0.75 },
  { id: "handoff", label: "HANDOFF", pct: 0.9 },
  { id: "retro", label: "RETRO", pct: 1.0 },
];

// === PROJECT HEADER ===
function ProjectHeader({ clock, liveMessages, onDirectorSend, liveProject }) {
  const [banterIdx, setBanterIdx] = useState(0);
  const [visibleBanter, setVisibleBanter] = useState(banterMessages.slice(0, 4));
  const [projectInput, setProjectInput] = useState("");
  const [projectMessages, setProjectMessages] = useState(
    onDirectorSend
      ? [{ role: "lead", text: "Describe what you want to design, and I'll brief the team. You can steer any agent at any time." }]
      : [
          { role: "user", text: "Focus on reducing cognitive load on the overview screen. Data density is key but it needs to breathe." },
          { role: "lead", text: "Understood. I'll brief DISCOVERY to prioritize dashboard patterns and TASTE to explore calm, spacious aesthetics. STRATEGY will map the information hierarchy." },
        ]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setBanterIdx(prev => {
        const next = (prev + 1) % banterMessages.length;
        setVisibleBanter(curr => {
          const updated = [...curr, banterMessages[next]];
          if (updated.length > 5) updated.shift();
          return updated;
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const currentStageIdx = pipelineStages.findIndex(s => clock < s.pct);
  const overallProgress = Math.round(clock * 100);

  // When live OAP messages are present, the chatter feed shows the real handoff
  // babble + narration from the swarm instead of the simulated rotation.
  const prettyAgent = (id) => {
    if (!id) return "—";
    const owlId = OWL_ID_BY_OAP[id] || id;
    const a = agentsData.find(x => x.id === owlId);
    return a ? a.name : id;
  };
  const banterToShow = (liveMessages && liveMessages.length)
    ? liveMessages
        .filter(m => m.kind === "handoff" || m.kind === "narration")
        .slice(-5)
        .map(m => ({ from: prettyAgent(m.from), to: prettyAgent(m.to), text: m.text }))
    : visibleBanter;

  const handleSend = () => {
    if (!projectInput.trim()) return;
    if (onDirectorSend) {
      // Live mode: send the message to the real backend. The first message starts
      // the run (it's the brief); later messages steer the team. Replies arrive in
      // the live chatter feed and the agent lanes, not as a canned line here.
      onDirectorSend(projectInput.trim());
      setProjectMessages(prev => [...prev, { role: "user", text: projectInput }]);
    } else {
      setProjectMessages(prev => [...prev,
        { role: "user", text: projectInput },
        { role: "lead", text: "Got it. Relaying to the team now..." },
      ]);
    }
    setProjectInput("");
  };

  const deliveryStatusColor = { "approved": tokens.accent.main, "draft": tokens.text.secondary, "in-progress": tokens.led.staged };
  const deliveryStatusIcon = { "approved": "✓", "draft": "○", "in-progress": "◑" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, padding: "0 0 8px 0" }}>

      {/* === ROW 1: Project info | Chat | Chatter === */}
      <div style={{ display: "flex", gap: 24 }}>

        {/* Left: Project info + brief + constraints + progress */}
        <div style={{
          width: 320, flexShrink: 0,
          background: tokens.surface.raised,
          boxShadow: tokens.shadow.convex,
          borderRadius: tokens.radius.panel,
          padding: 24,
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {/* Project name + status */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em", marginBottom: 4 }}>
                PROJECT
              </div>
              <div style={{ fontFamily: tokens.font.sans, fontSize: 14, fontWeight: 600, color: tokens.text.primary, lineHeight: 1.3 }}>
                {liveProject ? liveProject.name : sampleProject.name}
              </div>
            </div>
            <div style={{
              fontFamily: tokens.font.mono, fontSize: 9,
              color: tokens.accent.text, letterSpacing: "0.06em",
              background: tokens.accent.main + "15",
              padding: "4px 8px", borderRadius: 12,
            }}>
              IN PROGRESS
            </div>
          </div>

          {/* Brief */}
          <div style={{
            fontFamily: tokens.font.sans, fontSize: 11,
            color: tokens.text.secondary, lineHeight: 1.5,
          }}>
            {liveProject ? (liveProject.brief || "Awaiting your brief — describe what you want to design above.") : sampleProject.brief}
          </div>

          {/* Constraints */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 4,
          }}>
            {(liveProject ? [] : projectConstraints).map(c => (
              <div key={c.label} style={{
                fontFamily: tokens.font.mono, fontSize: 9,
                color: tokens.text.secondary,
                background: tokens.surface.inset,
                padding: "4px 8px", borderRadius: 4,
                letterSpacing: "0.04em",
              }}>
                {c.label}: <span style={{ color: tokens.text.primary }}>{c.value}</span>
              </div>
            ))}
          </div>

          {/* Pipeline progress */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em" }}>PIPELINE</span>
              <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.accent.text }}>{overallProgress}%</span>
            </div>
            <div style={{
              height: 6, background: tokens.surface.inset,
              boxShadow: tokens.shadow.pressed,
              borderRadius: 4, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${overallProgress}%`,
                background: tokens.accent.main, borderRadius: 4,
                transition: "width 0.3s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              {pipelineStages.map((stage, i) => (
                <span key={stage.id} style={{
                  fontFamily: tokens.font.mono, fontSize: 9,
                  color: i <= currentStageIdx ? tokens.accent.text : tokens.text.muted,
                  letterSpacing: "0.04em",
                  fontWeight: i === currentStageIdx ? 700 : 400,
                }}>
                  {stage.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Project-level chat */}
        <div style={{
          flex: 1,
          background: tokens.surface.raised,
          boxShadow: tokens.shadow.convex,
          borderRadius: tokens.radius.panel,
          padding: 24,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em", marginBottom: 12 }}>
            DIRECT THE TEAM
          </div>
          <div style={{
            flex: 1,
            background: tokens.surface.inset,
            boxShadow: tokens.shadow.concave,
            borderRadius: tokens.radius.inset,
            padding: 16,
            overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 12,
            marginBottom: 12,
          }}>
            {projectMessages.map((msg, i) => (
              <div key={i}>
                <div style={{
                  fontFamily: tokens.font.mono, fontSize: 9,
                  color: msg.role === "user" ? tokens.text.secondary : tokens.accent.main,
                  letterSpacing: "0.06em", marginBottom: 4,
                  textTransform: "uppercase",
                }}>
                  {msg.role === "user" ? "YOU" : "Design Lead"}
                </div>
                <div style={{
                  fontFamily: tokens.font.sans, fontSize: 11,
                  color: tokens.text.primary, lineHeight: 1.5,
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: tokens.surface.inset,
            boxShadow: tokens.shadow.concave,
            borderRadius: tokens.radius.inset,
            padding: "8px 16px",
          }}>
            <input
              value={projectInput}
              onChange={e => setProjectInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Give direction to the whole team..."
              style={{
                flex: 1, border: "none", outline: "none",
                background: "transparent",
                fontFamily: tokens.font.sans, fontSize: 11,
                color: tokens.text.primary,
              }}
            />
            <div
              onClick={handleSend}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: tokens.surface.raised,
                boxShadow: tokens.shadow.convex,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: tokens.accent.text, fontSize: 14,
              }}
            >
              →
            </div>
          </div>
        </div>

        {/* Right: Agent chatter */}
        <div style={{
          width: 320, flexShrink: 0,
          background: tokens.surface.raised,
          boxShadow: tokens.shadow.convex,
          borderRadius: tokens.radius.panel,
          padding: 24,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em", marginBottom: 12 }}>
            AGENT CHATTER
          </div>
          <div style={{
            flex: 1,
            background: tokens.surface.inset,
            boxShadow: tokens.shadow.concave,
            borderRadius: tokens.radius.inset,
            padding: 12,
            overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {banterToShow.map((msg, i) => (
              <div key={i} style={{
                opacity: i === 0 && banterToShow.length >= 5 ? 0.4 : 1,
                transition: "opacity 0.5s ease",
              }}>
                <div style={{ display: "flex", gap: 4, alignItems: "baseline", marginBottom: 2 }}>
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.accent.text, fontWeight: 600, letterSpacing: "0.04em" }}>
                    {msg.from}
                  </span>
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted }}>→</span>
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.secondary, letterSpacing: "0.04em" }}>
                    {msg.to}
                  </span>
                </div>
                <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.primary, lineHeight: 1.4 }}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

// === WAVEFORM COMPONENT ===
// DAW-style scrolling timeline waveform. Activity samples accumulate left-to-right
// like audio being recorded — newest values at the right edge (playhead position).
// When the pipeline is stopped, the waveform freezes showing its history.
function Waveform({ activity = 0, width = 300, height = 40, color, pipelineMode = "playing" }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const activityRef = useRef(activity);
  const smoothActivityRef = useRef(0);

  // History buffer: stores sampled activity levels over time
  const historyRef = useRef([]);
  const maxSamples = Math.floor(width / 2); // 2px per sample = pixel density

  // Keep activity ref in sync
  activityRef.current = activity;

  // Sample activity into history buffer at ~50ms intervals
  useEffect(() => {
    const interval = setInterval(() => {
      const hist = historyRef.current;
      // Add some organic variation to the sample (like real audio)
      const raw = activityRef.current;
      const jitter = raw > 0.1 ? (Math.random() - 0.5) * raw * 0.3 : 0;
      const sample = Math.max(0, Math.min(1, raw + jitter));
      hist.push(sample);
      // Keep buffer at max size — oldest samples fall off the left
      if (hist.length > maxSamples) hist.shift();
    }, 50);
    return () => clearInterval(interval);
  }, [maxSamples]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const mid = height / 2;
    const sampleW = 2; // width per sample in pixels

    // Mode-aware colors:
    // AUTO → accent orange (energetic, flowing)
    // HITL → warm amber (attentive, paused-feeling)
    // STOPPED → muted (frozen)
    const modeColorRef = { current: color || tokens.accent.main };
    const hitlColor = tokens.accent.text; // warm amber — matches ModeSwitcher HUMAN color

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const isHitl = pipelineMode === "recording";
      const isStopped = pipelineMode === "stopped";
      const c = isStopped ? tokens.text.muted : (isHitl ? hitlColor : (color || tokens.accent.main));
      const hist = historyRef.current;

      // Smooth current activity for the playhead glow
      const target = activityRef.current;
      smoothActivityRef.current += (target - smoothActivityRef.current) * 0.08;

      // In HITL mode, when agent is active (waiting for input), create a gentle pulse
      const now = Date.now();
      const hitlPulse = isHitl && smoothActivityRef.current > 0.3
        ? 0.6 + 0.4 * Math.sin(now * 0.004) // slow sine pulse 0.2–1.0
        : 1;

      if (hist.length === 0) {
        ctx.fillStyle = tokens.text.muted + "30";
        ctx.fillRect(0, mid - 0.5, width, 1);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const startX = width - hist.length * sampleW;

      for (let i = 0; i < hist.length; i++) {
        const x = startX + i * sampleW;
        const amp = hist[i];

        if (amp > 0.02) {
          // In HITL: dampen amplitude to ~60% — feels "held back"
          const displayAmp = isHitl ? amp * 0.6 * hitlPulse : amp;
          const barH = Math.max(2, displayAmp * (height - 4));
          const y = mid - barH / 2;

          const age = i / hist.length;
          const alphaVal = Math.floor(40 + age * (isHitl ? 140 : 180));
          const alpha = alphaVal.toString(16).padStart(2, "0");
          ctx.fillStyle = c + alpha;
          ctx.beginPath();
          ctx.roundRect(x, y, sampleW - 0.5, barH, 0.5);
          ctx.fill();
        } else {
          ctx.fillStyle = tokens.text.muted + "20";
          ctx.fillRect(x, mid - 0.5, sampleW - 0.5, 1);
        }
      }

      // Playhead
      const currentAmp = smoothActivityRef.current;
      if (currentAmp > 0.05 && !isStopped) {
        const playheadX = width - 1;
        const playheadAmp = isHitl ? currentAmp * 0.6 * hitlPulse : currentAmp;
        ctx.fillStyle = c;
        ctx.globalAlpha = isHitl ? 0.6 : 0.8;
        ctx.fillRect(playheadX, mid - (playheadAmp * height * 0.4), 1.5, playheadAmp * height * 0.8);
        ctx.globalAlpha = 1;

        // Glow — wider and softer in HITL (breathing)
        const glowR = isHitl ? 12 * hitlPulse : 8;
        const grad = ctx.createRadialGradient(playheadX, mid, 0, playheadX, mid, glowR);
        grad.addColorStop(0, c + (isHitl ? "20" : "30"));
        grad.addColorStop(1, c + "00");
        ctx.fillStyle = grad;
        ctx.fillRect(playheadX - glowR, mid - glowR, glowR * 2, glowR * 2);
      }

      if (startX > 0) {
        ctx.fillStyle = tokens.text.muted + "15";
        ctx.fillRect(0, mid - 0.5, startX, 1);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [width, height, color, pipelineMode]);

  return <canvas ref={canvasRef} style={{ width, height, borderRadius: tokens.radius.inset, display: "block" }} />;
}

// === LED COMPONENT ===
function Led({ status, size = 8 }) {
  const colorMap = { running: tokens.led.active, online: tokens.led.active, staged: tokens.led.staged, idle: tokens.led.idle, error: tokens.led.error, approved: tokens.led.approved, offline: tokens.led.idle };
  const glowMap = { running: tokens.accent.glow, online: tokens.accent.glow, staged: "rgba(245,153,95,0.3)" };
  const c = colorMap[status] || tokens.led.idle;
  const g = glowMap[status];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", backgroundColor: c, flexShrink: 0,
      boxShadow: g ? `0 0 6px 2px ${g}` : "none",
      transition: "all 0.3s ease",
    }} />
  );
}

// === KNOB COMPONENT ===
function Knob({ label, value = 0.5, size = 44 }) {
  const rotation = -135 + (value * 270);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: tokens.surface.raised,
        boxShadow: tokens.shadow.knob,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <div style={{
          width: 2, height: size * 0.35, backgroundColor: tokens.accent.main,
          position: "absolute", top: 4, left: "50%", marginLeft: -1,
          transformOrigin: `center ${size * 0.5 - 4}px`,
          transform: `rotate(${rotation}deg)`,
          borderRadius: 1,
        }} />
      </div>
      <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.secondary, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

// === BUTTON COMPONENT ===
// Three variants: secondary (default), primary (accent fill), destructive (red text)
// Replaces all inline neo-btn / neo-btn-primary patterns with a single component.
function Button({ variant = "secondary", children, onClick, style = {}, disabled = false }) {
  const base = {
    padding: "8px 16px",
    border: "none",
    borderRadius: tokens.radius.button,
    fontFamily: tokens.font.mono,
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: disabled ? "default" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "all 0.15s ease",
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    secondary: {
      background: tokens.surface.raised,
      boxShadow: tokens.shadow.convex,
      color: tokens.text.secondary,
    },
    primary: {
      background: tokens.accent.main,
      boxShadow: tokens.shadow.convex,
      color: "#fff",
    },
    destructive: {
      background: tokens.surface.raised,
      boxShadow: tokens.shadow.convex,
      color: tokens.led.error,
    },
  };
  const className = variant === "primary" ? "neo-btn-primary" : "neo-btn";
  return (
    <button
      className={className}
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

// === STATUS BADGE COMPONENT ===
// Unified LED + label compound. Replaces ad-hoc LED+text combos across all views.
// Modes: "dot" (LED only), "label" (LED + text), "pill" (LED + text in colored pill)
function StatusBadge({ status, mode = "label", pipelineMode, size = 8 }) {
  const statusConfig = {
    running:  { color: tokens.accent.main, label: "RUNNING", ledStatus: "running" },
    online:   { color: tokens.accent.text, label: "ONLINE", ledStatus: "online" },
    idle:     { color: tokens.text.muted, label: "IDLE", ledStatus: "idle" },
    staged:   { color: tokens.led.staged, label: "STAGED", ledStatus: "staged" },
    error:    { color: tokens.led.error, label: "ERROR", ledStatus: "error" },
    approved: { color: tokens.text.primary, label: "APPROVED", ledStatus: "approved" },
    active:   { color: tokens.accent.main, label: "ACTIVE", ledStatus: "running" },
    paused:   { color: tokens.led.staged, label: "PAUSED", ledStatus: "staged" },
    queued:   { color: tokens.text.muted, label: "QUEUED", ledStatus: "idle" },
    completed:{ color: tokens.text.primary, label: "COMPLETED", ledStatus: "approved" },
    waiting:  { color: tokens.accent.text, label: "AWAITING INPUT", ledStatus: "staged" },
  };
  const config = statusConfig[status] || statusConfig.idle;

  if (mode === "dot") return <Led status={config.ledStatus} size={size} />;

  if (mode === "pill") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Led status={config.ledStatus} size={size} />
        <span style={{
          fontFamily: tokens.font.mono, fontSize: 9,
          color: config.color, letterSpacing: "0.06em",
          background: config.color + "15",
          padding: "4px 8px", borderRadius: 12,
        }}>
          {config.label}
        </span>
      </div>
    );
  }

  // Default: "label" mode — LED + plain text
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Led status={config.ledStatus} size={size} />
      <span style={{
        fontFamily: tokens.font.mono, fontSize: 9,
        color: config.color, letterSpacing: "0.06em",
      }}>
        {config.label}
      </span>
    </div>
  );
}

// === HOLD TO CONFIRM ===
// A button that requires holding for 2 seconds to trigger. A ring fills clockwise
// as you hold — release early and it resets. Designed for destructive actions.
function HoldToConfirm({ label, onConfirm, holdDuration = 2000 }) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(null);
  const animRef = useRef(null);
  const confirmedRef = useRef(false);

  const startHold = () => {
    confirmedRef.current = false;
    setHolding(true);
    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(1, elapsed / holdDuration);
      setProgress(pct);
      if (pct >= 1 && !confirmedRef.current) {
        confirmedRef.current = true;
        setHolding(false);
        setProgress(0);
        onConfirm();
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    setHolding(false);
    setProgress(0);
    cancelAnimationFrame(animRef.current);
  };

  // SVG ring parameters
  const ringSize = 28;
  const ringR = 11;
  const circumference = 2 * Math.PI * ringR;
  const dashOffset = circumference * (1 - progress);

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      className="neo-btn"
      style={{
        padding: "6px 12px 6px 6px",
        background: holding ? tokens.surface.inset : tokens.surface.raised,
        boxShadow: holding ? tokens.shadow.pressed : tokens.shadow.convex,
        border: "none",
        borderRadius: tokens.radius.button,
        fontFamily: tokens.font.mono, fontSize: 11,
        color: tokens.led.error,
        cursor: "pointer",
        letterSpacing: "0.04em",
        display: "flex", alignItems: "center", gap: 8,
        transition: "background 0.15s ease, box-shadow 0.15s ease",
        userSelect: "none",
      }}
    >
      {/* Ring indicator */}
      <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
        {/* Track */}
        <circle cx={ringSize/2} cy={ringSize/2} r={ringR}
          fill="none" stroke={tokens.surface.deep} strokeWidth="2.5" />
        {/* Progress arc */}
        <circle cx={ringSize/2} cy={ringSize/2} r={ringR}
          fill="none" stroke={tokens.led.error} strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${ringSize/2} ${ringSize/2})`}
          style={{ transition: holding ? "none" : "stroke-dashoffset 0.2s ease" }}
        />
        {/* Center icon */}
        <text x={ringSize/2} y={ringSize/2} textAnchor="middle" dominantBaseline="central"
          fontSize="10" fill={tokens.led.error}>
          ×
        </text>
      </svg>
      {holding ? "HOLD TO CONFIRM..." : label}
    </button>
  );
}

// === CONFIRM DIALOG ===
// Inline confirmation for moderate-risk actions like disabling an agent.
// Shows consequence text and requires explicit confirm click.
function ConfirmAction({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: tokens.surface.inset,
      boxShadow: tokens.shadow.concave,
      borderRadius: tokens.radius.inset,
      padding: "8px 12px",
    }}>
      <span style={{
        fontFamily: tokens.font.sans, fontSize: 11,
        color: tokens.text.primary, flex: 1, lineHeight: 1.4,
      }}>
        {message}
      </span>
      <Button variant="destructive" onClick={onConfirm} style={{ padding: "4px 12px", fontSize: 9 }}>
        CONFIRM
      </Button>
      <Button variant="secondary" onClick={onCancel} style={{ padding: "4px 12px", fontSize: 9 }}>
        CANCEL
      </Button>
    </div>
  );
}

// === COLLAPSED SWIM LANE ===
// Three visual tiers based on status:
//   active (running)  → full lane: LED, name, waveform, status badge
//   online (standing by) → compressed: LED, name, thin activity line
//   idle              → minimal: tiny LED + name, warms on hover
function CollapsedLane({ agent, onClick, isExpanded, activity, pipelineMode }) {
  const status = getStatus(activity);
  const isRunning = status === "running";
  const isOnline = status === "online";
  const isIdle = status === "idle";
  const isWaiting = pipelineMode === "recording" && isRunning;
  const displayStatus = isWaiting ? "AWAITING INPUT" : status.toUpperCase();

  // Every lane keeps the same container — same height, same card, same structure.
  // Active = full color. Online = muted. Idle = greyed out. Nothing moves.
  const laneHeight = 56;

  // Derive visual intensity from status
  const nameColor = isRunning ? tokens.accent.text : isOnline ? tokens.text.primary : tokens.text.muted;
  const nameSize = isRunning ? 12 : 11;
  const statusColor = isWaiting ? tokens.accent.main : isRunning ? tokens.accent.text : tokens.text.muted;
  const statusWeight = isWaiting ? 700 : 400;
  const ledStatus = isWaiting ? "staged" : status;
  const waveformOpacity = isRunning ? 1 : isOnline ? 0.3 : 0.12;
  const wellBackground = isRunning ? tokens.surface.inset : isOnline ? tokens.surface.inset : tokens.surface.deep + "60";
  const wellShadow = isRunning ? tokens.shadow.concave : isOnline ? tokens.shadow.pressed : tokens.shadow.pressed;
  const chevronOpacity = isRunning ? 1 : isOnline ? 0.6 : 0.3;

  return (
    <div className="neo-lane" onClick={onClick} style={{
      background: tokens.surface.raised,
      boxShadow: tokens.shadow.convex,
      borderRadius: tokens.radius.panel,
      padding: "0 24px",
      height: laneHeight, boxSizing: "border-box",
      display: "flex", alignItems: "center", gap: 16,
      cursor: "pointer",
      transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      <Led status={ledStatus} size={8} />
      <span style={{
        fontFamily: tokens.font.mono, fontSize: nameSize, fontWeight: 600,
        color: nameColor,
        letterSpacing: "0.06em", minWidth: 120, textTransform: "uppercase",
        transition: "color 0.4s ease-out",
      }}>
        {agent.name}
      </span>
      <div style={{
        flex: 1,
        background: wellBackground,
        boxShadow: wellShadow,
        borderRadius: tokens.radius.inset,
        padding: 4, overflow: "hidden",
        transition: "all 0.4s ease-out",
      }}>
        <div style={{ opacity: waveformOpacity, transition: "opacity 0.4s ease-out" }}>
          <Waveform activity={activity} width={400} height={32} pipelineMode={pipelineMode} />
        </div>
      </div>
      <span style={{
        fontFamily: tokens.font.mono, fontSize: 11,
        color: statusColor,
        letterSpacing: "0.06em", textTransform: "uppercase", minWidth: 100, textAlign: "right",
        fontWeight: statusWeight,
        transition: "color 0.4s ease-out",
      }}>
        {displayStatus}
      </span>
      <span style={{
        fontFamily: tokens.font.mono, fontSize: 14,
        color: tokens.text.muted,
        opacity: chevronOpacity,
        transition: "opacity 0.4s ease-out",
      }}>+</span>
    </div>
  );
}

// === EXPANDED SWIM LANE ===
// All spacing follows 8pt grid: 8, 16, 24
function ExpandedLane({ agent, onCollapse, activity, pipelineMode, onApprove, onSaveDraft, activeBlocker, onDismissBlocker, liveMessages }) {
  const [inputVal, setInputVal] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [approved, setApproved] = useState(false);
  const inputRef = useRef(null);
  const isWaiting = pipelineMode === "recording" && getStatus(activity) === "running";
  const isHITL = pipelineMode === "recording";
  const status = getStatus(activity);
  const pad = 24; // consistent panel padding

  // Live mode: this lane's conversation/output is the agent's real narration, not sample data.
  const liveActive = !!liveMessages;
  const liveConversation = liveActive
    ? liveMessages
        .filter(m => (m.kind === "narration" || m.kind === "handoff") && owlIdFor(m.from) === agent.id)
        .map(m => ({ role: "agent", name: agent.name, text: m.text }))
    : [];
  const conversation = liveActive ? liveConversation : conversationData;
  const liveOutput = liveConversation.length ? liveConversation[liveConversation.length - 1].text : null;

  // Determine if this agent has the active blocker
  const hasBlocker = activeBlocker && (activeBlocker.agent === agent.name || activeBlocker.agent === agent.id.toUpperCase());
  const blockerIsInput = hasBlocker && activeBlocker.severity === "input";

  // Sound: knock when blocker banner appears
  useEffect(() => { if (hasBlocker) SoundEngine.knock(); }, [hasBlocker]);

  return (
    <div style={{
      background: tokens.surface.raised,
      boxShadow: tokens.shadow.convex,
      borderRadius: tokens.radius.panel,
      display: "flex", flexDirection: "column",
    }}>
      {/* Attention banner — shown when navigating from "Needs Your Attention" */}
      {hasBlocker && (
        <div style={{
          padding: `12px ${pad}px`,
          display: "flex", alignItems: "center", gap: 12,
          background: blockerIsInput
            ? `linear-gradient(135deg, ${tokens.accent.main}14, ${tokens.accent.main}08)`
            : `linear-gradient(135deg, ${tokens.led.error}14, ${tokens.led.error}08)`,
          borderBottom: `2px solid ${blockerIsInput ? tokens.accent.main : tokens.led.error}`,
          borderRadius: `${tokens.radius.panel}px ${tokens.radius.panel}px 0 0`,
          animation: "slideDown 0.25s ease-out",
        }}>
          {/* Severity indicator */}
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: blockerIsInput ? tokens.accent.main + "20" : tokens.led.error + "20",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: blockerIsInput ? tokens.accent.main : tokens.led.error }}>
              {blockerIsInput ? "?" : "!"}
            </span>
          </div>
          {/* Blocker text */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{
              fontFamily: tokens.font.mono, fontSize: 9,
              color: blockerIsInput ? tokens.accent.main : tokens.led.error,
              letterSpacing: "0.08em", fontWeight: 600,
            }}>
              {blockerIsInput ? "YOUR INPUT NEEDED" : "ACTION REQUIRED"}
            </span>
            <span style={{
              fontFamily: tokens.font.sans, fontSize: 11,
              color: tokens.text.primary, lineHeight: 1.4,
            }}>
              {activeBlocker.text}
            </span>
          </div>
          {/* CTA button */}
          <Button
            variant="primary"
            style={{
              padding: "8px 20px",
              flexShrink: 0,
              background: blockerIsInput ? tokens.accent.main : tokens.led.error,
              boxShadow: `0 2px 8px ${blockerIsInput ? tokens.accent.glow : "rgba(217,79,79,0.3)"}`,
            }}
            onClick={() => {
              // Focus the input so the user can immediately respond
              if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          >
            {blockerIsInput ? "RESPOND →" : "RESOLVE →"}
          </Button>
          {/* Dismiss */}
          <span
            onClick={() => onDismissBlocker && onDismissBlocker()}
            style={{
              fontFamily: tokens.font.mono, fontSize: 14,
              color: tokens.text.muted, cursor: "pointer",
              padding: "0 4px", flexShrink: 0,
              opacity: 0.6,
            }}
            className="neo-btn"
          >
            ×
          </span>
        </div>
      )}

      {/* Header — 16px vertical, pad horizontal */}
      <div
        onClick={onCollapse}
        style={{
          padding: `16px ${pad}px`,
          display: "flex", alignItems: "center", gap: 16,
          cursor: "pointer",
          borderBottom: `1px solid ${tokens.surface.inset}`,
        }}
      >
        <Led status={getStatus(activity)} size={10} />
        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600, color: tokens.accent.text, letterSpacing: "0.06em" }}>
          {agent.name}
        </span>
        <div style={{ flex: 1, background: tokens.surface.inset, boxShadow: tokens.shadow.concave, borderRadius: tokens.radius.inset, padding: 4, overflow: "hidden" }}>
          <Waveform activity={activity} width={300} height={28} pipelineMode={pipelineMode} />
        </div>
        <span style={{
          fontFamily: tokens.font.mono, fontSize: 11, color: "#fff",
          background: tokens.accent.main, padding: "4px 12px",
          borderRadius: 12, letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {getStatus(activity).toUpperCase()}
        </span>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 14, color: tokens.text.muted, cursor: "pointer" }}>−</span>
      </div>

      {/* Agent identity bar */}
      <div style={{
        padding: `12px ${pad}px`,
        borderBottom: `1px solid ${tokens.surface.inset}`,
        display: "flex", alignItems: "center", gap: 24,
        background: tokens.surface.base,
      }}>
        {/* Role description */}
        <div style={{
          fontFamily: tokens.font.sans, fontSize: 11,
          color: tokens.text.secondary, lineHeight: 1.4,
          flex: 1,
        }}>
          {agent.desc}
        </div>

        {/* Pipeline stage */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em" }}>STAGE</span>
          <span style={{
            fontFamily: tokens.font.mono, fontSize: 9, fontWeight: 600,
            color: tokens.accent.text, letterSpacing: "0.06em",
            background: tokens.accent.main + "12",
            padding: "4px 8px", borderRadius: 4,
          }}>
            {agent.stage}
          </span>
        </div>

        {/* Receives from */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 4,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em" }}>RECEIVES FROM</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {agent.receives.map(r => (
              <span key={r} style={{
                fontFamily: tokens.font.mono, fontSize: 9,
                color: tokens.text.secondary,
                background: tokens.surface.inset,
                padding: "2px 8px", borderRadius: 4,
                letterSpacing: "0.04em",
              }}>
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* Hands to */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 4,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em" }}>HANDS OFF TO</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {agent.handsTo.map(h => (
              <span key={h} style={{
                fontFamily: tokens.font.mono, fontSize: 9,
                color: tokens.text.secondary,
                background: tokens.surface.inset,
                padding: "2px 8px", borderRadius: 4,
                letterSpacing: "0.04em",
              }}>
                {h}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content: two columns — pad on all sides */}
      <div style={{ display: "flex", gap: 16, padding: pad }}>
        {/* Left: Conversation */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {liveActive && conversation.length === 0 && (
            <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.muted, lineHeight: 1.5, padding: 16 }}>
              {agent.name} hasn't spoken yet — their narration will appear here as they work.
            </div>
          )}
          {conversation.map((msg, i) => (
            <div key={i} style={{
              background: tokens.surface.raised,
              boxShadow: tokens.shadow.convex,
              borderRadius: tokens.radius.inset,
              padding: 16,
            }}>
              <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: msg.role === "agent" ? tokens.accent.text : tokens.text.secondary, marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {msg.role === "agent" ? msg.name : "USER"}
              </div>
              <div style={{ fontFamily: msg.role === "agent" ? tokens.font.mono : tokens.font.sans, fontSize: msg.role === "agent" ? 12 : 14, color: tokens.text.primary, lineHeight: 1.5 }}>
                {msg.text}
              </div>
            </div>
          ))}

          {/* Prompt input */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: tokens.surface.inset,
            boxShadow: tokens.shadow.concave,
            borderRadius: tokens.radius.inset,
            padding: "8px 16px",
          }}>
            <input
              ref={inputRef}
              value={inputVal}
              onChange={e => {
                setInputVal(e.target.value);
                // Auto-dismiss the blocker banner once the user starts typing
                if (hasBlocker && e.target.value.length > 0 && onDismissBlocker) onDismissBlocker();
              }}
              placeholder={hasBlocker ? `Respond to ${agent.name} about this issue...` : `Talk to ${agent.name}...`}
              style={{
                flex: 1, border: "none", outline: "none",
                background: "transparent",
                fontFamily: tokens.font.sans, fontSize: 11,
                color: tokens.text.primary,
              }}
            />
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: tokens.surface.raised,
              boxShadow: tokens.shadow.convex,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: tokens.accent.text, fontSize: 14,
            }}>
              →
            </div>
          </div>
        </div>

        {/* Right: Output Preview */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{
            background: tokens.surface.inset,
            boxShadow: tokens.shadow.concave,
            borderRadius: tokens.radius.inset,
            padding: 16,
            flex: 1,
          }}>
            <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.accent.text, marginBottom: 8, letterSpacing: "0.08em" }}>
              {">"} {liveActive ? `${agent.name.toUpperCase()} — LATEST` : "ANALYZING_COMPETITIVE_LANDSCAPE"}
            </div>
            <pre style={{
              fontFamily: tokens.font.mono, fontSize: 11,
              color: liveActive && !liveOutput ? tokens.text.muted : tokens.text.primary,
              lineHeight: 1.6,
              margin: 0, whiteSpace: "pre-wrap",
            }}>
              {liveActive ? (liveOutput || "Output appears in Deliverables and design-state.md as this agent ships work.") : outputPreviewData}
            </pre>
          </div>
        </div>
      </div>

      {/* Action bar — mode-aware */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center",
        padding: `12px ${pad}px 16px ${pad}px`,
        justifyContent: "space-between",
        borderTop: `1px solid ${isWaiting ? tokens.accent.muted : tokens.surface.inset}`,
        background: isWaiting ? "rgba(242,122,58,0.06)" : "transparent",
        transition: "background 0.5s ease, border-color 0.5s ease",
      }}>
        {/* Left side: status context */}
        {isWaiting ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontFamily: tokens.font.mono, fontSize: 11,
            color: tokens.accent.text, letterSpacing: "0.06em",
          }}>
            <span style={{ fontSize: 11, color: tokens.accent.main }}>●</span>
            WAITING FOR YOUR REVIEW
          </div>
        ) : approved ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontFamily: tokens.font.mono, fontSize: 11,
            color: tokens.accent.text, letterSpacing: "0.06em",
          }}>
            <span style={{ fontSize: 11 }}>✓</span>
            APPROVED — HANDING OFF TO {agent.handsTo[0] || "NEXT"}
          </div>
        ) : pipelineMode === "playing" ? (
          <div style={{
            fontFamily: tokens.font.mono, fontSize: 11,
            color: tokens.text.muted, letterSpacing: "0.06em",
          }}>
            AUTO MODE — AGENT RUNNING FREELY
          </div>
        ) : pipelineMode === "stopped" ? (
          <div style={{
            fontFamily: tokens.font.mono, fontSize: 11,
            color: tokens.text.muted, letterSpacing: "0.06em",
          }}>
            PIPELINE STOPPED
          </div>
        ) : <div />}

        {/* Right side: actions — only in HITL mode */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* SAVE DRAFT — available in HITL when agent has output */}
          {isHITL && (status === "running" || status === "online") && !approved && (
            <Button
              variant="secondary"
              onClick={() => {
                setDraftSaved(true);
                onSaveDraft && onSaveDraft(agent.id);
                SoundEngine.save();
                setTimeout(() => setDraftSaved(false), 2000);
              }}
            >
              {draftSaved ? (
                <><span style={{ fontSize: 11 }}>✓</span> SAVED</>
              ) : (
                "SAVE DRAFT"
              )}
            </Button>
          )}

          {/* APPROVE + CONTINUE — only in HITL when agent is waiting */}
          {isWaiting && !approved && (
            <Button
              variant="primary"
              style={{ padding: "8px 24px" }}
              onClick={() => {
                setApproved(true);
                onApprove && onApprove(agent.id);
                SoundEngine.approve();
              }}
            >
              <span style={{ fontSize: 11 }}>✓</span> APPROVE + CONTINUE
            </Button>
          )}

          {/* Approved state — shows confirmation instead of buttons */}
          {approved && (
            <Button variant="secondary" onClick={() => setApproved(false)}>
              UNDO
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// === WELCOME GUIDE ===
// Two-step onboarding: (1) orient → (2) create first project
function WelcomeGuide({ onStart }) {
  const [step, setStep] = useState(1); // 1 = orient, 2 = create project
  const [hoveredZone, setHoveredZone] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [projectBrief, setProjectBrief] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const zones = [
    {
      id: "tracks",
      title: "Agent Tracks",
      icon: "≡",
      description: "Each agent gets a lane — like a channel strip in a DAW. Waveforms show real-time activity. Click any lane to expand it.",
    },
    {
      id: "mode",
      title: "Mode Switcher",
      icon: "◉",
      description: "Slide between STOP, AUTO, and HUMAN. In HUMAN mode, agents pause and wait for your approval at each step.",
    },
    {
      id: "sidenav",
      title: "Side Navigation",
      icon: "◧",
      description: "Switch between Projects, Tracks, Memory, and Telemetry views using the icons on the left.",
    },
    {
      id: "settings",
      title: "Settings",
      icon: "⚙",
      description: "Pick your model, set budgets, choose accent colors. The gear icon in the top bar opens it.",
    },
  ];

  const templates = [
    { id: "dashboard", name: "Dashboard Redesign", brief: "Redesign a data-heavy dashboard for clarity, speed, and WCAG AA compliance.", icon: "📊" },
    { id: "onboarding", name: "Onboarding Flow", brief: "Design a first-time user experience with progressive disclosure and trust signals.", icon: "👋" },
    { id: "audit", name: "Accessibility Audit", brief: "Full WCAG AA audit with remediation recommendations and priority matrix.", icon: "♿" },
    { id: "system", name: "Design System", brief: "Build or evolve a component library with tokens, variants, and documentation.", icon: "🧩" },
    { id: "blank", name: "Blank Project", brief: "Start from scratch — describe your design challenge and let the agents figure out the approach.", icon: "✦" },
  ];

  const inputStyle = {
    width: "100%", padding: "10px 14px",
    background: tokens.surface.base,
    boxShadow: tokens.shadow.concave,
    border: "none", borderRadius: tokens.radius.inset,
    fontFamily: tokens.font.sans, fontSize: tokens.type.lg,
    color: tokens.text.primary, outline: "none",
    transition: "box-shadow 0.15s ease",
  };

  const canLaunch = projectName.trim().length > 0;

  // === STEP 1: ORIENTATION ===
  if (step === 1) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "100%", padding: 48,
        gap: 40,
      }}>
        {/* Step indicator */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 24, height: 4, borderRadius: 2, background: tokens.accent.main }} />
          <div style={{ width: 24, height: 4, borderRadius: 2, background: tokens.surface.deep }} />
        </div>

        {/* Hero */}
        <div style={{ textAlign: "center", maxWidth: 520 }}>
          <div style={{
            fontFamily: tokens.font.mono, fontSize: tokens.type.xxl,
            fontWeight: 700, color: tokens.text.primary,
            letterSpacing: "-0.02em", marginBottom: 8,
          }}>
            Welcome to OWL-1
          </div>
          <div style={{
            fontFamily: tokens.font.sans, fontSize: tokens.type.lg,
            color: tokens.text.secondary, lineHeight: 1.6,
          }}>
            A design orchestration system that works like a DAW.
            Ten AI agents, one timeline, and you at the mixing desk.
          </div>
        </div>

        {/* Zone cards — 2x2 grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 16, maxWidth: 600, width: "100%",
        }}>
          {zones.map(zone => {
            const isHovered = hoveredZone === zone.id;
            return (
              <div
                key={zone.id}
                onMouseEnter={() => setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
                style={{
                  background: isHovered ? tokens.surface.raised : tokens.surface.base,
                  boxShadow: isHovered ? tokens.shadow.convex : "inset 1px 1px 3px rgba(0,0,0,0.06), inset -1px -1px 3px rgba(255,255,255,0.7)",
                  borderRadius: tokens.radius.panel,
                  padding: 20,
                  transition: "all 0.2s ease",
                  cursor: "default",
                }}
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: isHovered ? tokens.accent.main + "20" : tokens.surface.raised,
                    boxShadow: tokens.shadow.convex,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, color: isHovered ? tokens.accent.main : tokens.text.muted,
                    transition: "all 0.2s ease",
                  }}>
                    {zone.icon}
                  </div>
                  <span style={{
                    fontFamily: tokens.font.mono, fontSize: tokens.type.sm,
                    fontWeight: 600, color: tokens.text.primary,
                    letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>
                    {zone.title}
                  </span>
                </div>
                <div style={{
                  fontFamily: tokens.font.sans, fontSize: tokens.type.md,
                  color: tokens.text.secondary, lineHeight: 1.55,
                }}>
                  {zone.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA to step 2 */}
        <Button variant="primary" onClick={() => setStep(2)} style={{ padding: "12px 32px", fontSize: tokens.type.md }}>
          Create your first project <span style={{ fontSize: 14 }}>→</span>
        </Button>

        {/* Footer hint */}
        <div style={{
          fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
          color: tokens.text.muted, textAlign: "center",
        }}>
          You can always return to this guide from the ✦ icon in the left nav
        </div>
      </div>
    );
  }

  // === STEP 2: CREATE PROJECT ===
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100%", padding: 48,
      gap: 32,
    }}>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ width: 24, height: 4, borderRadius: 2, background: tokens.accent.main }} />
        <div style={{ width: 24, height: 4, borderRadius: 2, background: tokens.accent.main }} />
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <div style={{
          fontFamily: tokens.font.mono, fontSize: tokens.type.xl,
          fontWeight: 700, color: tokens.text.primary,
          letterSpacing: "-0.02em", marginBottom: 8,
        }}>
          Create your first project
        </div>
        <div style={{
          fontFamily: tokens.font.sans, fontSize: tokens.type.lg,
          color: tokens.text.secondary, lineHeight: 1.6,
        }}>
          Pick a template or start blank. Your agents will spin up the moment you hit launch.
        </div>
      </div>

      {/* Template picker */}
      <div style={{ maxWidth: 600, width: "100%" }}>
        <div style={{
          fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
          color: tokens.text.hint, letterSpacing: "0.08em",
          marginBottom: 10, textTransform: "uppercase",
        }}>
          Start from a template
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {templates.map(t => {
            const isSelected = selectedTemplate === t.id;
            return (
              <div
                key={t.id}
                onClick={() => {
                  setSelectedTemplate(t.id);
                  if (t.id !== "blank") {
                    setProjectName(t.name);
                    setProjectBrief(t.brief);
                  } else {
                    setProjectName("");
                    setProjectBrief("");
                  }
                }}
                style={{
                  padding: "10px 16px",
                  background: isSelected ? tokens.accent.main + "15" : tokens.surface.raised,
                  boxShadow: isSelected ? tokens.shadow.pressed : tokens.shadow.convex,
                  borderRadius: tokens.radius.button,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  border: isSelected ? `1px solid ${tokens.accent.main}40` : "1px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <span style={{
                  fontFamily: tokens.font.mono, fontSize: tokens.type.sm,
                  color: isSelected ? tokens.accent.text : tokens.text.secondary,
                  fontWeight: isSelected ? 600 : 400,
                  letterSpacing: "0.02em",
                }}>
                  {t.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project form */}
      <div style={{
        maxWidth: 600, width: "100%",
        background: tokens.surface.raised,
        boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel,
        padding: 24,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* Project name */}
        <div>
          <label style={{
            fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
            color: tokens.text.hint, letterSpacing: "0.08em",
            textTransform: "uppercase", display: "block", marginBottom: 8,
          }}>
            Project name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="e.g., Fintech Dashboard Redesign"
            style={inputStyle}
          />
        </div>

        {/* Brief */}
        <div>
          <label style={{
            fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
            color: tokens.text.hint, letterSpacing: "0.08em",
            textTransform: "uppercase", display: "block", marginBottom: 8,
          }}>
            Design brief
          </label>
          <textarea
            value={projectBrief}
            onChange={e => setProjectBrief(e.target.value)}
            placeholder="Describe the design challenge. What are you trying to achieve? Who is it for?"
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical", minHeight: 72,
              fontFamily: tokens.font.sans,
              lineHeight: 1.5,
            }}
          />
        </div>

        {/* What happens next — preview */}
        <div style={{
          background: tokens.surface.base,
          boxShadow: tokens.shadow.concave,
          borderRadius: tokens.radius.inset,
          padding: 14,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{
            fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
            color: tokens.text.hint, letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            What happens next
          </div>
          <div style={{
            fontFamily: tokens.font.sans, fontSize: tokens.type.md,
            color: tokens.text.secondary, lineHeight: 1.55,
          }}>
            Your 10 agents will spin up on the Tracks view. The Design Lead starts first, reads your brief, then delegates to the rest of the team. You'll see their waveforms light up in real time.
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Button variant="secondary" onClick={() => setStep(1)}>
          <span style={{ fontSize: 11 }}>←</span> Back
        </Button>
        <Button
          variant="primary"
          disabled={!canLaunch}
          onClick={() => canLaunch && onStart({ name: projectName, brief: projectBrief, template: selectedTemplate })}
          style={{ padding: "12px 32px", fontSize: tokens.type.md }}
        >
          <span style={{ fontSize: 14 }}>▶</span> Launch project
        </Button>
      </div>

      {/* Hint */}
      <div style={{
        fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
        color: tokens.text.muted, textAlign: "center",
      }}>
        Your agents will start in AUTO mode — you can switch to human-in-the-loop anytime
      </div>
    </div>
  );
}

// === EMPTY TRACKS STATE ===
// Shown when no project is loaded — ghost lanes with flatlined waveforms
function EmptyTracksState({ onLoadProject, onNewProject }) {
  const ghostAgents = [
    { name: "Design Lead", role: "Orchestration" },
    { name: "UX Strategist", role: "Research & Flows" },
    { name: "Visual Designer", role: "UI & Polish" },
    { name: "Content Writer", role: "Copy & Voice" },
    { name: "Accessibility", role: "WCAG Audit" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Ghost lanes — muted, no activity */}
      {ghostAgents.map((agent, i) => (
        <div key={i} style={{
          background: tokens.surface.raised,
          boxShadow: tokens.shadow.convex,
          borderRadius: tokens.radius.panel,
          padding: "14px 20px",
          display: "flex", alignItems: "center", gap: 16,
          opacity: 0.45,
        }}>
          {/* Idle LED */}
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: tokens.text.muted,
          }} />
          {/* Agent name */}
          <div style={{ minWidth: 120 }}>
            <div style={{
              fontFamily: tokens.font.mono, fontSize: tokens.type.md,
              fontWeight: 600, color: tokens.text.secondary,
            }}>{agent.name}</div>
            <div style={{
              fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
              color: tokens.text.muted, letterSpacing: "0.06em",
            }}>{agent.role}</div>
          </div>
          {/* Flatline waveform — just a horizontal line */}
          <div style={{ flex: 1, height: 32, position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: "50%", left: 0, right: 0,
              height: 1, background: tokens.surface.deep,
            }} />
          </div>
          {/* Idle status */}
          <span style={{
            fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
            color: tokens.text.muted, letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>IDLE</span>
        </div>
      ))}

      {/* CTA card — sits below the ghost lanes */}
      <div style={{
        background: tokens.surface.raised,
        boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel,
        padding: 32,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 16,
        marginTop: 8,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: tokens.accent.main + "15",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>
          📂
        </div>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{
            fontFamily: tokens.font.sans, fontSize: tokens.type.lg,
            fontWeight: 600, color: tokens.text.primary, marginBottom: 6,
          }}>
            No project loaded
          </div>
          <div style={{
            fontFamily: tokens.font.sans, fontSize: tokens.type.md,
            color: tokens.text.secondary, lineHeight: 1.55,
          }}>
            Load an existing project or start a new one. Your agents are standing by — they'll light up once there's work to do.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <Button variant="secondary" onClick={onLoadProject}>
            Open a project
          </Button>
          <Button variant="primary" onClick={onNewProject}>
            <span style={{ fontSize: 11 }}>+</span> New project
          </Button>
        </div>
      </div>
    </div>
  );
}

// === SIDE NAV ===
function NavIcon({ type, color }) {
  const c = color;
  const icons = {
    projects: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="11" rx="2" stroke={c} strokeWidth="1.5"/><path d="M5 4V3a1 1 0 011-1h6a1 1 0 011 1v1" stroke={c} strokeWidth="1.5"/></svg>,
    tracks: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 5h14M2 9h14M2 13h14" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><circle cx="6" cy="5" r="1.5" fill={c}/><circle cx="11" cy="9" r="1.5" fill={c}/><circle cx="8" cy="13" r="1.5" fill={c}/></svg>,
    memory: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6" stroke={c} strokeWidth="1.5"/><circle cx="9" cy="9" r="2" stroke={c} strokeWidth="1.5"/><path d="M9 3v2M9 13v2M3 9h2M13 9h2" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
    telemetry: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 14l3-4 3 2 3-5 3 3" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    help: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke={c} strokeWidth="1.5"/><path d="M6 6.5a2 2 0 013.5 1.5c0 1-1.5 1.5-1.5 1.5M8 12v.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
    guide: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/><path d="M13 12l1 2.5L16 15.5l-2 1L13 19l-1-2.5L10 15.5l2-1L13 12z" stroke={c} strokeWidth="1" strokeLinejoin="round" opacity="0.6"/></svg>,
  };
  return icons[type] || null;
}

function SideNav({ activeView, setActiveView }) {
  const items = [
    { id: "projects", label: "PROJECTS" },
    { id: "tracks", label: "TRACKS" },
    { id: "memory", label: "MEMORY" },
    { id: "telemetry", label: "TELEMETRY" },
  ];
  return (
    <div style={{
      width: 72, background: tokens.surface.base,
      display: "flex", flexDirection: "column",
      alignItems: "center", paddingTop: 20, gap: 12,
      borderRight: "none",
    }}>
      {items.map(item => {
        const isActive = activeView === item.id;
        const iconColor = isActive ? tokens.accent.main : tokens.text.muted;
        return (
          <div key={item.id} onClick={() => setActiveView(item.id)} style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 4, cursor: "pointer",
          }}>
            <div className="neo-nav" style={{
              width: 40, height: 40,
              borderRadius: "50%",
              background: isActive ? tokens.accent.main + "18" : tokens.surface.raised,
              boxShadow: isActive ? tokens.shadow.pressed : tokens.shadow.convex,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease",
            }}>
              <NavIcon type={item.id} color={iconColor} />
            </div>
            <span style={{
              fontFamily: tokens.font.mono, fontSize: 9,
              color: iconColor,
              letterSpacing: "0.05em",
            }}>{item.label}</span>
          </div>
        );
      })}
      <div style={{ flex: 1 }} />
      {/* GUIDE — bottom toggle */}
      <div
        onClick={() => setActiveView("guide")}
        style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 4, cursor: "pointer",
          marginBottom: 16,
        }}
      >
        <div className="neo-nav" style={{
          width: 40, height: 40,
          borderRadius: "50%",
          background: activeView === "guide" ? tokens.accent.main + "18" : tokens.surface.raised,
          boxShadow: activeView === "guide" ? tokens.shadow.pressed : tokens.shadow.convex,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s ease",
        }}>
          <NavIcon type="guide" color={activeView === "guide" ? tokens.accent.main : tokens.text.muted} />
        </div>
        <span style={{
          fontFamily: tokens.font.mono, fontSize: 9,
          color: activeView === "guide" ? tokens.accent.main : tokens.text.muted,
          letterSpacing: "0.05em",
        }}>GUIDE</span>
      </div>
    </div>
  );
}

// === AGENTS PANEL (sidebar view) ===
// Full agent directory with live status, descriptions, and click-to-focus
function AgentsPanel({ clock, pipelineMode, onSelectAgent }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{
        background: tokens.surface.raised,
        boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel,
        padding: 24,
      }}>
        <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em", marginBottom: 16 }}>
          AGENT DIRECTORY
        </div>
        <div style={{
          display: "flex", gap: 24, marginBottom: 24,
        }}>
          {/* Summary stats */}
          {[
            { label: "ACTIVE", value: agentsData.filter(a => getStatus(getAgentActivity(a, clock)) === "running").length, color: tokens.accent.main },
            { label: "ONLINE", value: agentsData.filter(a => getStatus(getAgentActivity(a, clock)) === "online").length, color: tokens.led.staged },
            { label: "IDLE", value: agentsData.filter(a => getStatus(getAgentActivity(a, clock)) === "idle").length, color: tokens.text.muted },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: tokens.font.mono, fontSize: 24, fontWeight: 600, color: s.color }}>{s.value}</span>
              <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Agent list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {agentsData.map(agent => {
            const activity = getAgentActivity(agent, clock);
            const status = getStatus(activity);
            const isWaiting = pipelineMode === "recording" && status === "running";
            return (
              <div
                key={agent.id}
                className="neo-lane"
                onClick={() => onSelectAgent(agent.id)}
                style={{
                  background: tokens.surface.raised,
                  boxShadow: tokens.shadow.convex,
                  borderRadius: tokens.radius.inset,
                  padding: 16,
                  cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 8,
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Led status={isWaiting ? "staged" : status} size={8} />
                  <span style={{
                    fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600,
                    color: status === "running" ? tokens.accent.main : tokens.text.primary,
                    letterSpacing: "0.06em", flex: 1,
                  }}>
                    {agent.name}
                  </span>
                  <span style={{
                    fontFamily: tokens.font.mono, fontSize: 9,
                    color: isWaiting ? tokens.accent.text : (status === "running" ? tokens.accent.text : tokens.text.muted),
                    letterSpacing: "0.06em",
                  }}>
                    {isWaiting ? "AWAITING INPUT" : status.toUpperCase()}
                  </span>
                </div>
                <div style={{
                  fontFamily: tokens.font.sans, fontSize: 11,
                  color: tokens.text.secondary, lineHeight: 1.4,
                }}>
                  {agent.desc}
                </div>
                {/* Mini waveform */}
                <div style={{
                  background: tokens.surface.inset,
                  boxShadow: tokens.shadow.pressed,
                  borderRadius: 4,
                  padding: 4,
                  overflow: "hidden",
                }}>
                  <Waveform activity={activity} width={300} height={20} pipelineMode={pipelineMode} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// === AGENTS TAB VIEW ===
// Agent management console. Full profile card for each agent showing role,
// description, capabilities, handoff graph, pipeline stage, and current status.
// Also includes an "Add Agent" card for extensibility.
function AgentConsoleView({ clock, pipelineMode }) {
  const [expandedAgent, setExpandedAgent] = useState(null);

  // Extended agent info — what each agent does, its capabilities, and how it's used
  const agentProfiles = {
    lead: {
      role: "Orchestrator",
      fullDesc: "The Design Lead is the central intelligence of the pipeline. It receives the initial brief, breaks it into tasks, assigns work to specialist agents, resolves conflicts between competing recommendations, and synthesizes outputs into a coherent design direction. Think of it as the creative director — it doesn't do the detail work, but it ensures everything connects.",
      capabilities: ["Brief decomposition", "Task assignment", "Conflict resolution", "Quality gates", "Cross-agent synthesis"],
      triggers: "Runs throughout the entire pipeline. Always active.",
      model: "claude-opus-4-6",
    },
    discovery: {
      role: "Researcher",
      fullDesc: "Discovery is the eyes and ears of the team. It scans competitors, harvests design patterns, maps the problem space, and surfaces evidence the other agents will build on. It doesn't make design decisions — it gathers the raw material that makes good decisions possible.",
      capabilities: ["Competitive analysis", "Pattern extraction", "Evidence gathering", "Landscape mapping", "Trend identification"],
      triggers: "Activated at pipeline start. Feeds into Strategy and Taste.",
      model: "claude-sonnet-4-6",
    },
    strategy: {
      role: "Strategist",
      fullDesc: "Strategy takes the raw findings from Discovery and turns them into a design direction. It defines principles, maps information architecture, creates user journey frameworks, and sets the decision criteria the rest of the team will follow. Strategy is opinionated — it makes calls.",
      capabilities: ["Design principles", "Information architecture", "User journey mapping", "Decision frameworks", "Prioritization"],
      triggers: "Activated after Discovery. Feeds into Taste, Content, and Builder.",
      model: "claude-sonnet-4-6",
    },
    taste: {
      role: "Aesthetic calibrator",
      fullDesc: "Taste is the aesthetic conscience of the team. It curates visual references, defines the emotional target, selects typography and color direction, and ensures the final design feels intentional. Taste works from your stored preferences and the project's emotional goals.",
      capabilities: ["Moodboard curation", "Color direction", "Typography selection", "Emotional targeting", "Aesthetic consistency"],
      triggers: "Activated after Discovery. Works with your stored taste profile.",
      model: "claude-sonnet-4-6",
    },
    content: {
      role: "Writer",
      fullDesc: "Content is the linguistic engine. It writes microcopy, crafts empty states, names features, writes error messages, and ensures every word in the interface earns its place. Content works closely with Strategy for tone and with the Critic for clarity.",
      capabilities: ["Microcopy", "UX writing", "Empty states", "Error messages", "Naming conventions"],
      triggers: "Activated during design phase. Feeds into Builder and Critic.",
      model: "claude-sonnet-4-6",
    },
    motion: {
      role: "Choreographer",
      fullDesc: "Motion designs transitions, animations, and temporal relationships. It ensures that movement is purposeful (never decorative), performant (never janky), and accessible (respects prefers-reduced-motion). Motion defines the timing and easing that make interfaces feel alive.",
      capabilities: ["Transition design", "Animation tokens", "Timing systems", "Reduced motion fallbacks", "Interaction choreography"],
      triggers: "Activated during design phase. Works with Builder and A11Y.",
      model: "claude-haiku-4-5",
    },
    builder: {
      role: "Assembler",
      fullDesc: "Builder is the production engine. It takes inputs from Strategy, Taste, Content, and Motion and assembles them into concrete component specs, layout definitions, and implementation-ready artifacts. Builder doesn't design — it builds what the team designed.",
      capabilities: ["Component specs", "Layout systems", "Token application", "Responsive rules", "Implementation guidance"],
      triggers: "Activated during design phase. Largest input surface — receives from 4 agents.",
      model: "claude-sonnet-4-6",
    },
    critic: {
      role: "Reviewer",
      fullDesc: "The Critic reviews all output against the original brief, the design principles, and the taste profile. It catches inconsistencies, flags deviations, and sends work back for revision. The Critic is deliberately adversarial — its job is to find problems before users do.",
      capabilities: ["Brief alignment", "Principle adherence", "Consistency checking", "Gap analysis", "Revision requests"],
      triggers: "Activated in verify phase. Can send work back to Builder or Design Lead.",
      model: "claude-sonnet-4-6",
    },
    a11y: {
      role: "Accessibility guardian",
      fullDesc: "A11Y evaluates every output against WCAG 2.2 AA, COGA guidelines, and inclusive design principles. It checks color contrast, keyboard navigation, screen reader semantics, cognitive load, and touch targets. A11Y doesn't just flag issues — it provides remediation paths.",
      capabilities: ["WCAG 2.2 AA audit", "COGA evaluation", "Contrast checking", "Keyboard navigation", "Screen reader semantics"],
      triggers: "Activated in verify phase. Works with Builder and Motion.",
      model: "claude-sonnet-4-6",
    },
    heuristic: {
      role: "Usability evaluator",
      fullDesc: "Heuristic runs Nielsen's 10 heuristics and cognitive walkthroughs against the assembled design. It evaluates learnability, efficiency, error prevention, and consistency. Where A11Y checks compliance, Heuristic checks whether it actually works for humans.",
      capabilities: ["Nielsen's heuristics", "Cognitive walkthrough", "Task analysis", "Error prevention audit", "Consistency review"],
      triggers: "Activated in verify phase. Reports to Design Lead and Builder.",
      model: "claude-haiku-4-5",
    },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{
        background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel, padding: 24,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em", marginBottom: 8 }}>
            AGENT CONSOLE
          </div>
          <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.secondary }}>
            {agentsData.length} agents in the pipeline. Click any agent to see its full profile, capabilities, and handoff relationships.
          </div>
        </div>
        <Button variant="primary" onClick={() => {}}>+ ADD AGENT</Button>
      </div>

      {/* Agent cards */}
      {agentsData.map(agent => {
        const activity = getAgentActivity(agent, clock);
        const status = getStatus(activity);
        const isActive = status === "running";
        const isExpanded = expandedAgent === agent.id;
        const profile = agentProfiles[agent.id] || {};

        return (
          <div key={agent.id} style={{
            background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
            borderRadius: tokens.radius.panel,
            border: isActive ? `1px solid ${tokens.accent.main}30` : "1px solid transparent",
            transition: "all 0.15s ease",
          }}>
            {/* Collapsed row — always visible */}
            <div
              className="neo-lane"
              onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
              style={{
                padding: 24, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 16,
              }}
            >
              <Led status={status} size={10} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600,
                    color: isActive ? tokens.accent.text : tokens.text.primary,
                    letterSpacing: "0.06em",
                  }}>
                    {agent.name}
                  </span>
                  <span style={{
                    fontFamily: tokens.font.mono, fontSize: 9,
                    color: tokens.text.muted, letterSpacing: "0.04em",
                  }}>
                    {profile.role}
                  </span>
                </div>
                <span style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.secondary }}>
                  {agent.desc}
                </span>
              </div>
              <span style={{
                fontFamily: tokens.font.mono, fontSize: 9,
                color: tokens.text.muted, letterSpacing: "0.04em",
                background: tokens.surface.inset, padding: "4px 8px", borderRadius: 12,
              }}>
                {agent.stage}
              </span>
              <span style={{
                fontFamily: tokens.font.mono, fontSize: 9,
                color: isActive ? tokens.accent.main : tokens.text.muted,
                letterSpacing: "0.06em", minWidth: 64, textAlign: "right",
              }}>
                {status.toUpperCase()}
              </span>
              <span style={{ fontFamily: tokens.font.mono, fontSize: 14, color: tokens.text.muted }}>
                {isExpanded ? "−" : "+"}
              </span>
            </div>

            {/* Expanded detail panel */}
            {isExpanded && (
              <div style={{
                padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16,
                borderTop: `1px solid ${tokens.surface.inset}`,
              }}>
                {/* Full description */}
                <div style={{
                  background: tokens.surface.inset, boxShadow: tokens.shadow.concave,
                  borderRadius: tokens.radius.inset, padding: 16, marginTop: 16,
                }}>
                  <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.06em", marginBottom: 8 }}>
                    ABOUT THIS AGENT
                  </div>
                  <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.primary, lineHeight: 1.6 }}>
                    {profile.fullDesc}
                  </div>
                </div>

                {/* Three-column info row */}
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Capabilities */}
                  <div style={{
                    flex: 1, background: tokens.surface.inset, boxShadow: tokens.shadow.concave,
                    borderRadius: tokens.radius.inset, padding: 16,
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.accent.text, letterSpacing: "0.06em" }}>
                      CAPABILITIES
                    </div>
                    {(profile.capabilities || []).map((cap, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: tokens.accent.main, flexShrink: 0 }} />
                        <span style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.primary }}>{cap}</span>
                      </div>
                    ))}
                  </div>

                  {/* Handoff relationships */}
                  <div style={{
                    flex: 1, background: tokens.surface.inset, boxShadow: tokens.shadow.concave,
                    borderRadius: tokens.radius.inset, padding: 16,
                    display: "flex", flexDirection: "column", gap: 12,
                  }}>
                    <div>
                      <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.accent.text, letterSpacing: "0.06em", marginBottom: 8 }}>
                        RECEIVES FROM
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {(agent.receives || []).map((r, i) => (
                          <span key={i} style={{
                            fontFamily: tokens.font.mono, fontSize: 9,
                            background: tokens.surface.deep, padding: "2px 8px",
                            borderRadius: 8, color: tokens.text.secondary,
                          }}>{r}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.accent.text, letterSpacing: "0.06em", marginBottom: 8 }}>
                        HANDS OFF TO
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {(agent.handsTo || []).map((h, i) => (
                          <span key={i} style={{
                            fontFamily: tokens.font.mono, fontSize: 9,
                            background: tokens.surface.deep, padding: "2px 8px",
                            borderRadius: 8, color: tokens.text.secondary,
                          }}>{h}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Config */}
                  <div style={{
                    flex: 1, background: tokens.surface.inset, boxShadow: tokens.shadow.concave,
                    borderRadius: tokens.radius.inset, padding: 16,
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.accent.text, letterSpacing: "0.06em" }}>
                      CONFIGURATION
                    </div>
                    {[
                      { label: "Model", value: profile.model || "claude-sonnet-4-6" },
                      { label: "Stage", value: agent.stage },
                      { label: "Phase offset", value: agent.phase.toFixed(2) },
                      { label: "Duration", value: agent.duration.toFixed(2) },
                    ].map((row, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.muted }}>{row.label}</span>
                        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.primary }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.secondary, lineHeight: 1.4 }}>
                      {profile.triggers}
                    </div>
                  </div>
                </div>

                {/* Action bar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button variant="secondary" onClick={() => {}} style={{ padding: "6px 16px", fontSize: 9 }}>EDIT PROMPT</Button>
                    <Button variant="secondary" onClick={() => {}} style={{ padding: "6px 16px", fontSize: 9 }}>VIEW LOGS</Button>
                    <Button variant="destructive" onClick={() => setExpandedAgent("confirm-" + agent.id)} style={{ padding: "6px 16px", fontSize: 9 }}>DISABLE</Button>
                  </div>
                  {expandedAgent === "confirm-" + agent.id && (
                    <ConfirmAction
                      message={`Disabling ${agent.name} will skip its stage. The pipeline will re-route around it. You can re-enable anytime.`}
                      onConfirm={() => setExpandedAgent(null)}
                      onCancel={() => setExpandedAgent(agent.id)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Agent card */}
      <div className="neo-btn" style={{
        background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel, padding: 32,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 12, cursor: "pointer",
        border: `2px dashed ${tokens.text.muted}40`,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: tokens.surface.inset, boxShadow: tokens.shadow.concave,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 24, color: tokens.text.muted }}>+</span>
        </div>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.muted, letterSpacing: "0.06em" }}>
          ADD A NEW AGENT TO THE PIPELINE
        </span>
        <span style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.secondary, textAlign: "center", maxWidth: 400, lineHeight: 1.5 }}>
          Define a custom agent with its own prompt, capabilities, and place in the handoff graph.
          It will join the pipeline at the stage you assign.
        </span>
      </div>
    </div>
  );
}

// === NODES VIEW ===
// Radically reduced agent graph. One material. One animation. White space as luxury.
// Principle: if removing it doesn't hurt, it was never needed.
function NodesView({ clock, pipelineMode }) {
  const [hoveredNode, setHoveredNode] = useState(null);

  // Layout: generous spacing, vertical rhythm implies stage grouping
  const nodePositions = {
    lead:      { x: 400, y: 72 },
    discovery: { x: 160, y: 208 },
    strategy:  { x: 400, y: 216 },
    taste:     { x: 640, y: 208 },
    content:   { x: 192, y: 360 },
    builder:   { x: 400, y: 368 },
    motion:    { x: 608, y: 360 },
    critic:    { x: 216, y: 504 },
    a11y:      { x: 400, y: 512 },
    heuristic: { x: 584, y: 504 },
  };

  const agentRoles = {
    lead: "Orchestrator", discovery: "Researcher", strategy: "Architect",
    taste: "Aesthetician", content: "Writer", builder: "Constructor",
    motion: "Choreographer", critic: "Reviewer", a11y: "Accessibility", heuristic: "Evaluator",
  };

  // Build edges — skip broadcast
  const edges = [];
  agentsData.forEach(agent => {
    (agent.handsTo || []).forEach(targetName => {
      if (targetName !== "ALL AGENTS") {
        const target = agentsData.find(a => a.name === targetName);
        if (target) edges.push({ from: agent.id, to: target.id });
      }
    });
  });

  // Clean Bézier — gentle curve, no exaggeration
  const bezierPath = (from, to) => {
    const dy = to.y - from.y;
    const tension = Math.min(64, Math.abs(dy) * 0.4);
    return `M${from.x},${from.y} C${from.x},${from.y + tension} ${to.x},${to.y - tension} ${to.x},${to.y}`;
  };

  const isRunning = pipelineMode !== "stopped";

  // Minimal CSS — entrance + one hover transition + one pulse
  const nodesCSS = `
    @keyframes iveEntrance {
      from { opacity: 0; transform: scale(0.92); }
      to   { opacity: 1; transform: scale(1); }
    }
    .ive-node {
      animation: iveEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
      cursor: pointer;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ive-node:hover {
      transform: scale(1.06);
    }
    .ive-edge {
      animation: iveEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
  `;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style dangerouslySetInnerHTML={{ __html: nodesCSS }} />

      {/* Canvas — the emptiness IS the design */}
      <div style={{
        background: tokens.surface.raised,
        boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel,
        overflow: "hidden",
      }}>
        <svg width="100%" height="600" viewBox="0 0 800 600" style={{ display: "block" }}>
          <defs>
            {/* One shadow. The only one. */}
            <filter id="iveShadow" x="-30%" y="-20%" width="160%" height="160%">
              <feDropShadow dx="3" dy="4" stdDeviation="6" floodColor={tokens.surface.deep} floodOpacity="0.35" />
              <feDropShadow dx="-2" dy="-2" stdDeviation="4" floodColor={tokens.surface.raised} floodOpacity="0.6" />
            </filter>
            {/* Active — same shadow + warm glow underneath */}
            <filter id="iveActive" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="12" floodColor={tokens.accent.main} floodOpacity="0.2" />
              <feDropShadow dx="3" dy="4" stdDeviation="5" floodColor={tokens.surface.deep} floodOpacity="0.25" />
              <feDropShadow dx="-2" dy="-2" stdDeviation="4" floodColor={tokens.surface.raised} floodOpacity="0.55" />
            </filter>
            {/* One gradient. Warm ceramic. */}
            <radialGradient id="iveNodeWarm" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor={tokens.surface.raised} />
              <stop offset="100%" stopColor={tokens.surface.base} />
            </radialGradient>
            {/* Neutral surface */}
            <radialGradient id="iveNodeNeutral" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor={tokens.surface.raised} />
              <stop offset="100%" stopColor={tokens.surface.inset} />
            </radialGradient>
            {/* Particle */}
            <radialGradient id="iveParticle">
              <stop offset="0%" stopColor={tokens.accent.main} stopOpacity="0.9" />
              <stop offset="70%" stopColor={tokens.accent.main} stopOpacity="0.15" />
              <stop offset="100%" stopColor={tokens.accent.main} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Edges first — behind everything */}
          {edges.map((edge, i) => {
            const fromPos = nodePositions[edge.from];
            const toPos = nodePositions[edge.to];
            if (!fromPos || !toPos) return null;
            const fromAgent = agentsData.find(a => a.id === edge.from);
            const fromActivity = getAgentActivity(fromAgent, clock);
            const isActive = fromActivity > 0.1 && isRunning;
            const isHovered = hoveredNode === edge.from || hoveredNode === edge.to;
            const path = bezierPath(fromPos, toPos);

            return (
              <g key={`e${i}`} className="ive-edge" style={{ animationDelay: `${0.2 + i * 0.03}s` }}>
                {/* The line — hair thin when idle, slightly heavier when active */}
                <path d={path} fill="none"
                  stroke={isActive ? tokens.accent.main : tokens.text.muted}
                  strokeWidth={isActive ? 1.5 : isHovered ? 1 : 0.5}
                  opacity={isActive ? 0.35 : isHovered ? 0.2 : 0.08}
                  strokeLinecap="round"
                  style={{ transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
                {/* One particle. Just one. Its direction IS the arrow. */}
                {isActive && (
                  <circle r="4" fill="url(#iveParticle)">
                    <animateMotion dur="3s" repeatCount="indefinite" path={path} />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {agentsData.map((agent, idx) => {
            const pos = nodePositions[agent.id];
            if (!pos) return null;
            const activity = getAgentActivity(agent, clock);
            const status = getStatus(activity);
            const isActive = status === "running" && isRunning;
            const isOnline = status === "online";
            const isLead = agent.id === "lead";
            const r = isLead ? 34 : 26;
            const isHovered = hoveredNode === agent.id;

            return (
              <g key={agent.id}
                className="ive-node"
                style={{ animationDelay: `${idx * 0.05}s`, transformOrigin: `${pos.x}px ${pos.y}px` }}
                onMouseEnter={() => setHoveredNode(agent.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Active halo — one soft ring, no pulsing, just present */}
                {isActive && (
                  <circle cx={pos.x} cy={pos.y} r={r + 10}
                    fill="none" stroke={tokens.accent.main}
                    strokeWidth="1" opacity="0.2"
                  />
                )}

                {/* The node. One circle. One material. */}
                <circle cx={pos.x} cy={pos.y} r={r}
                  fill={isActive ? "url(#iveNodeWarm)" : "url(#iveNodeNeutral)"}
                  stroke={isActive ? tokens.accent.main + "40" : "transparent"}
                  strokeWidth="1"
                  filter={isActive ? "url(#iveActive)" : "url(#iveShadow)"}
                  style={{ transition: "filter 0.4s ease-out" }}
                />

                {/* Specular — barely there */}
                <ellipse cx={pos.x - r * 0.15} cy={pos.y - r * 0.2}
                  rx={r * 0.4} ry={r * 0.25}
                  fill="white" opacity="0.08"
                  style={{ pointerEvents: "none" }}
                />

                {/* LED — tiny, precise */}
                <circle cx={pos.x} cy={pos.y - r + 8} r="2.5"
                  fill={isActive ? tokens.accent.main : isOnline ? tokens.led.staged : tokens.text.muted + "40"}
                  style={{ transition: "fill 0.3s ease-out" }}
                />

                {/* Name — the only text on the node */}
                <text x={pos.x} y={pos.y + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fontFamily={tokens.font.mono} fontSize={isLead ? 10 : 8.5}
                  fontWeight="600" letterSpacing="0.08em"
                  fill={isActive ? tokens.accent.text : tokens.text.primary}
                  style={{ transition: "fill 0.2s ease-out", pointerEvents: "none" }}
                >
                  {agent.name}
                </text>

                {/* Role — appears only on hover, clean fade */}
                <text x={pos.x} y={pos.y + r + 16}
                  textAnchor="middle" dominantBaseline="middle"
                  fontFamily={tokens.font.sans} fontSize="8"
                  fill={tokens.text.secondary}
                  opacity={isHovered ? 0.8 : 0}
                  style={{ transition: "opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)", pointerEvents: "none" }}
                >
                  {agentRoles[agent.id] || ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend — minimal, quiet */}
      <div style={{
        display: "flex", gap: 32, justifyContent: "center", padding: "8px 0",
      }}>
        {[
          { color: tokens.accent.main, label: "Active" },
          { color: tokens.led.staged, label: "Online" },
          { color: tokens.text.muted + "60", label: "Idle" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color }} />
            <span style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.muted }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// === PROJECTS VIEW ===
// Project list with status indicators, brief, and quick stats.
function ProjectsView({ clock, live }) {
  // In live mode, the only project is the current real session.
  const projects = live
    ? [{
        name: live.name,
        status: live.finished ? "completed" : (live.brief ? "active" : "queued"),
        progress: Math.round(clock * 100),
        brief: live.brief || "Awaiting your brief — describe what you want to design.",
        agents: 10, deliverables: live.deliverables, blockers: live.blockers, updated: "Just now",
      }]
    : [
    {
      name: "Fintech Dashboard Redesign", status: "active", progress: Math.round(clock * 100),
      brief: "Redesign the portfolio dashboard for clarity and speed. Reduce cognitive load, improve data density, ensure WCAG AA.",
      agents: 10, deliverables: 6, blockers: 2, updated: "Just now",
    },
    {
      name: "Mobile Onboarding Flow", status: "paused", progress: 68,
      brief: "Redesign the first-time experience for mobile users. Focus on progressive disclosure and trust signals.",
      agents: 7, deliverables: 4, blockers: 0, updated: "2 days ago",
    },
    {
      name: "Design System v3.0", status: "queued", progress: 0,
      brief: "Evolve the component library to support dark mode, density modes, and responsive tokens.",
      agents: 10, deliverables: 0, blockers: 0, updated: "Not started",
    },
    {
      name: "Checkout Accessibility Audit", status: "completed", progress: 100,
      brief: "Full WCAG AA audit of the checkout flow. Remediation recommendations for 23 issues found.",
      agents: 4, deliverables: 3, blockers: 0, updated: "Mar 15",
    },
  ];

  const statusColors = {
    active: tokens.accent.main,
    paused: tokens.led.staged,
    queued: tokens.text.muted,
    completed: tokens.text.primary,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel, padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em", marginBottom: 8 }}>
              ALL PROJECTS
            </div>
            <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.secondary }}>
              {projects.filter(p => p.status === "active").length} active · {projects.filter(p => p.status === "paused").length} paused · {projects.filter(p => p.status === "completed").length} completed
            </div>
          </div>
          <Button variant="secondary" onClick={() => {}}>+ NEW PROJECT</Button>
        </div>
      </div>

      {projects.map((project, idx) => {
        const isActive = project.status === "active";
        return (
          <div key={idx} className="neo-lane" style={{
            background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
            borderRadius: tokens.radius.panel, padding: 24,
            cursor: "pointer", display: "flex", flexDirection: "column", gap: 12,
            transition: "all 0.15s ease",
            border: isActive ? `1px solid ${tokens.accent.main}30` : "1px solid transparent",
          }}>
            {/* Project header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <StatusBadge status={project.status} mode="pill" size={8} />
              <span style={{
                fontFamily: tokens.font.sans, fontSize: 14, fontWeight: 600,
                color: isActive ? tokens.text.primary : tokens.text.secondary, flex: 1,
              }}>
                {project.name}
              </span>
            </div>

            {/* Brief */}
            <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.secondary, lineHeight: 1.5 }}>
              {project.brief}
            </div>

            {/* Progress bar */}
            <div style={{
              height: 4, background: tokens.surface.deep, borderRadius: 2,
              boxShadow: tokens.shadow.pressed, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${project.progress}%`,
                background: project.status === "completed" ? tokens.text.primary : tokens.accent.main,
                borderRadius: 2, transition: "width 0.3s ease",
              }} />
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 24 }}>
              {[
                { label: "AGENTS", value: project.agents },
                { label: "DELIVERABLES", value: project.deliverables },
                { label: "BLOCKERS", value: project.blockers, warn: project.blockers > 0 },
                { label: "UPDATED", value: project.updated },
              ].map(stat => (
                <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.06em" }}>{stat.label}</span>
                  <span style={{
                    fontFamily: tokens.font.mono, fontSize: 11,
                    color: stat.warn ? tokens.led.error : tokens.text.primary,
                    fontWeight: stat.warn ? 600 : 400,
                  }}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === MEMORY VIEW ===
// Shows stored taste profiles, design principles, and learned preferences.
function MemoryView() {
  const [editingSection, setEditingSection] = useState(null);
  const [memoryData, setMemoryData] = useState({
    taste: {
      label: "TASTE PROFILE",
      desc: "Your aesthetic preferences. Agents reference this before making any visual decision.",
      entries: [
        { key: "Emotional target", value: "Calm authority with warm precision" },
        { key: "Visual references", value: "Linear (density), Stripe (clarity), Wise (approachability)" },
        { key: "Palette bias", value: "Warm neutrals, single accent, restrained color use" },
        { key: "Typography", value: "Monospace for data, humanist sans for narrative" },
        { key: "Elevation model", value: "Neomorphic — depth signals interactivity" },
        { key: "Density preference", value: "High information, generous whitespace" },
      ],
    },
    principles: {
      label: "DESIGN PRINCIPLES",
      desc: "The rules every agent follows. Edit these to change how the whole team thinks.",
      entries: [
        { key: "1", value: "Clarity over density — every data point earns its place" },
        { key: "2", value: "Progressive confidence — reveal complexity as users demonstrate mastery" },
        { key: "3", value: "Accessible by default — AA compliance is the floor, not the ceiling" },
        { key: "4", value: "Speed is respect — sub-200ms interactions, no loading spinners" },
        { key: "5", value: "Calm authority — the interface whispers competence, never shouts" },
      ],
    },
    patterns: {
      label: "LEARNED PATTERNS",
      desc: "Design decisions the agents have picked up from your feedback and past projects.",
      entries: [
        { key: "Layout preference", value: "Sidebar nav with contextual panels. Avoids top-nav mega menus." },
        { key: "Interaction style", value: "Direct manipulation over modal confirmations. Inline editing preferred." },
        { key: "Data visualization", value: "Sparklines over pie charts. Tables with sorting over dashboards." },
        { key: "Motion philosophy", value: "Purposeful transitions only. Never decorative. 150-300ms range." },
        { key: "Error handling", value: "Inline validation, not toast notifications. Prevention over recovery." },
        { key: "Accessibility approach", value: "Baked in from start, not bolted on. COGA + WCAG together." },
      ],
    },
    context: {
      label: "PROJECT CONTEXT",
      desc: "Facts about the current project that shape every design decision.",
      entries: [
        { key: "Domain", value: "Fintech — portfolio management for retail investors" },
        { key: "Users", value: "Semi-experienced investors, 28-45, mobile-first but desktop power users" },
        { key: "Competitors analyzed", value: "Robinhood, Wise, Revolut, Wealthfront, M1 Finance, SoFi, Public" },
        { key: "Key constraint", value: "Must load under 2s on 3G. Bundle budget: 200KB JS." },
      ],
    },
  });

  const handleEntryChange = (sectionKey, entryIdx, field, newValue) => {
    setMemoryData(prev => {
      const updated = { ...prev };
      updated[sectionKey] = { ...updated[sectionKey], entries: [...updated[sectionKey].entries] };
      updated[sectionKey].entries[entryIdx] = { ...updated[sectionKey].entries[entryIdx], [field]: newValue };
      return updated;
    });
  };

  const handleAddEntry = (sectionKey) => {
    setMemoryData(prev => {
      const updated = { ...prev };
      const section = updated[sectionKey];
      const isNumbered = section.entries.length > 0 && /^\d+$/.test(section.entries[0].key);
      updated[sectionKey] = {
        ...section,
        entries: [...section.entries, { key: isNumbered ? String(section.entries.length + 1) : "", value: "" }],
      };
      return updated;
    });
  };

  const handleDeleteEntry = (sectionKey, entryIdx) => {
    setMemoryData(prev => {
      const updated = { ...prev };
      updated[sectionKey] = {
        ...updated[sectionKey],
        entries: updated[sectionKey].entries.filter((_, i) => i !== entryIdx),
      };
      return updated;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel, padding: 24,
      }}>
        <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em", marginBottom: 8 }}>
          DESIGN MEMORY
        </div>
        <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.secondary, lineHeight: 1.5 }}>
          Everything the agents have learned about your taste, preferences, and project context. This persists across sessions and informs every design decision. Click <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.accent.text }}>EDIT</span> on any section to modify it directly.
        </div>
      </div>

      {Object.entries(memoryData).map(([sectionKey, section]) => {
        const isEditing = editingSection === sectionKey;
        return (
          <div key={sectionKey} style={{
            background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
            borderRadius: tokens.radius.panel, padding: 24,
            display: "flex", flexDirection: "column", gap: 12,
            border: isEditing ? `1px solid ${tokens.accent.main}30` : "1px solid transparent",
            transition: "border 0.15s ease",
          }}>
            {/* Section header with edit toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.accent.text, letterSpacing: "0.08em" }}>
                  {section.label}
                </div>
                <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.muted }}>
                  {section.desc}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {isEditing && (
                  <Button variant="secondary" onClick={() => handleAddEntry(sectionKey)} style={{ padding: "4px 12px", fontSize: 9 }}>+ ADD</Button>
                )}
                <Button variant={isEditing ? "primary" : "secondary"} onClick={() => setEditingSection(isEditing ? null : sectionKey)} style={{ padding: "4px 12px", fontSize: 9 }}>{isEditing ? "DONE" : "EDIT"}</Button>
              </div>
            </div>

            {/* Entries */}
            <div style={{
              background: tokens.surface.inset, boxShadow: tokens.shadow.concave,
              borderRadius: tokens.radius.inset, padding: 16,
              display: "flex", flexDirection: "column", gap: isEditing ? 12 : 8,
            }}>
              {section.entries.map((entry, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, alignItems: isEditing ? "flex-start" : "baseline",
                }}>
                  {isEditing ? (
                    <>
                      {/* Editable key */}
                      <input
                        value={entry.key}
                        onChange={(e) => handleEntryChange(sectionKey, i, "key", e.target.value)}
                        style={{
                          fontFamily: tokens.font.mono, fontSize: 11,
                          color: tokens.text.primary, letterSpacing: "0.04em",
                          minWidth: 120, width: 140, flexShrink: 0,
                          background: tokens.surface.base, border: `1px solid ${tokens.surface.deep}`,
                          borderRadius: 4, padding: "4px 8px",
                          outline: "none",
                        }}
                        onFocus={(e) => e.target.style.borderColor = tokens.accent.main}
                        onBlur={(e) => e.target.style.borderColor = tokens.surface.deep}
                      />
                      {/* Editable value */}
                      <textarea
                        value={entry.value}
                        onChange={(e) => handleEntryChange(sectionKey, i, "value", e.target.value)}
                        rows={1}
                        style={{
                          flex: 1, fontFamily: tokens.font.sans, fontSize: 11,
                          color: tokens.text.primary, lineHeight: 1.5,
                          background: tokens.surface.base, border: `1px solid ${tokens.surface.deep}`,
                          borderRadius: 4, padding: "4px 8px",
                          resize: "vertical", minHeight: 28,
                          outline: "none",
                        }}
                        onFocus={(e) => e.target.style.borderColor = tokens.accent.main}
                        onBlur={(e) => e.target.style.borderColor = tokens.surface.deep}
                      />
                      {/* Delete button */}
                      <div
                        onClick={() => handleDeleteEntry(sectionKey, i)}
                        style={{
                          width: 24, height: 24, borderRadius: 4,
                          background: tokens.surface.base,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", flexShrink: 0, marginTop: 2,
                        }}
                      >
                        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.led.error, lineHeight: 1 }}>×</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{
                        fontFamily: tokens.font.mono, fontSize: 11,
                        color: tokens.text.muted, letterSpacing: "0.04em",
                        minWidth: entry.key.length > 3 ? 140 : 24, flexShrink: 0,
                      }}>
                        {entry.key}
                      </span>
                      <span style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.primary, lineHeight: 1.5 }}>
                        {entry.value}
                      </span>
                    </>
                  )}
                </div>
              ))}
              {isEditing && section.entries.length === 0 && (
                <div style={{
                  fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.muted,
                  textAlign: "center", padding: 16,
                }}>
                  No entries yet. Click <span style={{ fontFamily: tokens.font.mono, color: tokens.text.secondary }}>+ ADD</span> to create one.
                </div>
              )}
            </div>

            {/* Edit mode footer */}
            {isEditing && (
              <div style={{
                fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted,
                letterSpacing: "0.04em", textAlign: "right",
              }}>
                Changes are saved as you type. Click DONE when finished.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// === TELEMETRY VIEW ===
// Performance metrics, token usage, cost tracking, and agent efficiency data.
function TelemetryView({ clock, pipelineMode, live }) {
  // Token usage: real per-agent totals from the live run, or simulated in the prototype.
  const tokenUsage = live
    ? agentsData.map(agent => {
        const t = live.telemetry.byAgent[oapIdFor(agent.id)] || { input: 0, output: 0, cost: 0 };
        return { name: agent.name, input: t.input, output: t.output, cost: t.cost.toFixed(4) };
      })
    : agentsData.map(agent => {
        const activity = getAgentActivity(agent, clock);
        const baseTokens = Math.round(800 + activity * 4200);
        return { name: agent.name, input: baseTokens, output: Math.round(baseTokens * 0.6), cost: (baseTokens * 0.000015).toFixed(4) };
      });

  const totalInput = live ? live.telemetry.totalInput : tokenUsage.reduce((s, t) => s + t.input, 0);
  const totalOutput = live ? live.telemetry.totalOutput : tokenUsage.reduce((s, t) => s + t.output, 0);
  const totalCost = live ? live.telemetry.totalCost : tokenUsage.reduce((s, t) => s + parseFloat(t.cost), 0);

  // Latency/efficiency aren't measured from the live run yet — show honest placeholders
  // in live mode rather than fabricated numbers.
  const latencyData = live
    ? [
        { label: "Avg response", value: "—", status: "ok" },
        { label: "P95 response", value: "—", status: "ok" },
        { label: "P99 response", value: "—", status: "ok" },
        { label: "Pipeline cycle", value: "—", status: "ok" },
      ]
    : [
        { label: "Avg response", value: "340ms", status: "good" },
        { label: "P95 response", value: "890ms", status: "ok" },
        { label: "P99 response", value: "2.1s", status: "warn" },
        { label: "Pipeline cycle", value: "12.4s", status: "good" },
      ];

  const efficiencyData = live
    ? [
        { label: "Handoff success", value: "—", status: "ok" },
        { label: "Rework rate", value: "—", status: "ok" },
        { label: "Blocker resolution", value: "—", status: "ok" },
        { label: "Human interventions", value: "—", status: "ok" },
      ]
    : [
        { label: "Handoff success", value: "94%", status: "good" },
        { label: "Rework rate", value: "12%", status: "ok" },
        { label: "Blocker resolution", value: "~8 min avg", status: "good" },
        { label: "Human interventions", value: "3 this session", status: "ok" },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{
        background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel, padding: 24,
      }}>
        <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em", marginBottom: 8 }}>
          TELEMETRY
        </div>
        <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.secondary }}>
          Agent performance metrics, token consumption, and cost tracking for the current session.
        </div>
      </div>

      {/* Top-level stats */}
      <div style={{
        display: "flex", gap: 8,
      }}>
        {[
          { label: "TOTAL TOKENS", value: (totalInput + totalOutput).toLocaleString(), sub: `${totalInput.toLocaleString()} in · ${totalOutput.toLocaleString()} out` },
          { label: "SESSION COST", value: `$${totalCost.toFixed(3)}`, sub: `~$${(totalCost * 60).toFixed(2)}/hr projected` },
          { label: "ACTIVE AGENTS", value: agentsData.filter(a => getStatus(getAgentActivity(a, clock)) === "running").length + "/" + agentsData.length, sub: pipelineMode === "stopped" ? "Pipeline stopped" : "Pipeline running" },
          { label: "UPTIME", value: live ? "—" : "47m", sub: "Session duration" },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: 1, background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
            borderRadius: tokens.radius.panel, padding: 16,
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.06em" }}>{stat.label}</span>
            <span style={{ fontFamily: tokens.font.mono, fontSize: 24, fontWeight: 600, color: tokens.text.primary }}>{stat.value}</span>
            <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.secondary }}>{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* Latency + Efficiency side by side */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { title: "LATENCY", data: latencyData },
          { title: "EFFICIENCY", data: efficiencyData },
        ].map(section => (
          <div key={section.title} style={{
            flex: 1, background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
            borderRadius: tokens.radius.panel, padding: 24,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.accent.text, letterSpacing: "0.08em" }}>{section.title}</span>
            <div style={{
              background: tokens.surface.inset, boxShadow: tokens.shadow.concave,
              borderRadius: tokens.radius.inset, padding: 16,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              {section.data.map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.secondary }}>{row.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600,
                      color: row.status === "good" ? tokens.text.primary : row.status === "ok" ? tokens.led.staged : tokens.led.error,
                    }}>
                      {row.value}
                    </span>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: row.status === "good" ? "#6B8F71" : row.status === "ok" ? tokens.led.staged : tokens.led.error,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Per-agent token table */}
      <div style={{
        background: tokens.surface.raised, boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel, padding: 24,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.accent.text, letterSpacing: "0.08em" }}>TOKEN USAGE BY AGENT</span>
        <div style={{
          background: tokens.surface.inset, boxShadow: tokens.shadow.concave,
          borderRadius: tokens.radius.inset, overflow: "hidden",
        }}>
          {/* Table header */}
          <div style={{
            display: "flex", padding: "8px 16px",
            borderBottom: `1px solid ${tokens.surface.deep}`,
          }}>
            {["AGENT", "INPUT", "OUTPUT", "TOTAL", "COST"].map(col => (
              <span key={col} style={{
                flex: col === "AGENT" ? 2 : 1,
                fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted,
                letterSpacing: "0.06em", textAlign: col === "AGENT" ? "left" : "right",
              }}>
                {col}
              </span>
            ))}
          </div>
          {/* Table rows */}
          {tokenUsage.map((row, i) => {
            const total = row.input + row.output;
            const maxTotal = 5000;
            return (
              <div key={i} style={{
                display: "flex", padding: "8px 16px", alignItems: "center",
                borderBottom: i < tokenUsage.length - 1 ? `1px solid ${tokens.surface.deep}20` : "none",
              }}>
                <span style={{ flex: 2, fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.primary }}>{row.name}</span>
                <span style={{ flex: 1, fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.secondary, textAlign: "right" }}>{row.input.toLocaleString()}</span>
                <span style={{ flex: 1, fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.secondary, textAlign: "right" }}>{row.output.toLocaleString()}</span>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                  <div style={{ width: 48, height: 4, background: tokens.surface.deep, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (total / maxTotal) * 100)}%`, background: tokens.accent.main, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.primary, minWidth: 40, textAlign: "right" }}>{total.toLocaleString()}</span>
                </div>
                <span style={{ flex: 1, fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.muted, textAlign: "right" }}>${row.cost}</span>
              </div>
            );
          })}
          {/* Total row */}
          <div style={{
            display: "flex", padding: "10px 16px",
            borderTop: `1px solid ${tokens.surface.deep}`,
            background: tokens.surface.deep + "30",
          }}>
            <span style={{ flex: 2, fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600, color: tokens.text.primary }}>TOTAL</span>
            <span style={{ flex: 1, fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600, color: tokens.text.primary, textAlign: "right" }}>{totalInput.toLocaleString()}</span>
            <span style={{ flex: 1, fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600, color: tokens.text.primary, textAlign: "right" }}>{totalOutput.toLocaleString()}</span>
            <span style={{ flex: 1, fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600, color: tokens.text.primary, textAlign: "right" }}>{(totalInput + totalOutput).toLocaleString()}</span>
            <span style={{ flex: 1, fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600, color: tokens.accent.text, textAlign: "right" }}>${totalCost.toFixed(3)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// === WIP PREVIEW ===
// Animated preview that evolves through pipeline stages.
// The design assembles itself as agents work — from rough wireframes to polished UI.
function WipPreview({ clock, pipelineMode }) {
  const [directionNote, setDirectionNote] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [notes, setNotes] = useState([]);

  // Pipeline progress mapped to visual stages:
  // 0.00–0.15 DISCOVER: rough boxes, sitemap sketch
  // 0.15–0.25 STRATEGY: layout skeleton appears
  // 0.25–0.35 TASTE: color tokens applied, type hints
  // 0.35–0.55 DESIGN: components fill in, content appears
  // 0.55–0.75 VERIFY: refinements, a11y indicators
  // 0.75–1.00 HANDOFF+RETRO: polish, final state
  const p = pipelineMode === "stopped" ? 0 : clock;

  // Opacity helpers — elements fade in at their stage
  const fadeIn = (threshold) => Math.min(1, Math.max(0, (p - threshold) / 0.08));
  const stageLabel = p < 0.15 ? "DISCOVERING..."
    : p < 0.25 ? "SHAPING STRATEGY..."
    : p < 0.35 ? "APPLYING TASTE..."
    : p < 0.55 ? "DESIGNING..."
    : p < 0.75 ? "VERIFYING..."
    : p < 0.9 ? "PREPARING HANDOFF..."
    : "COMPLETE";

  // Color intensity ramps up during TASTE stage
  const colorIntensity = fadeIn(0.25);
  const accentFill = `rgba(242,122,58,${0.1 + colorIntensity * 0.5})`;
  const accentStroke = `rgba(242,122,58,${0.2 + colorIntensity * 0.6})`;

  return (
    <div
      onClick={() => !showInput && setShowInput(true)}
      style={{
        background: tokens.surface.deep,
        boxShadow: tokens.shadow.concave,
        borderRadius: tokens.radius.inset,
        flex: 1,
        display: "flex", flexDirection: "column",
        position: "relative", overflow: "hidden",
        cursor: showInput ? "default" : "pointer",
        minHeight: 180,
      }}
    >
      {/* The evolving design preview */}
      <svg style={{ width: "100%", flex: 1, minHeight: 0 }} viewBox="0 0 320 260" preserveAspectRatio="xMidYMid meet">

        {/* === STAGE 1: DISCOVER — rough boxes, structure hints === */}
        {/* Page frame — always visible */}
        <rect x="10" y="8" width="300" height="244" rx="6" fill={tokens.surface.inset} stroke={tokens.surface.deep} strokeWidth="1" opacity={0.4 + fadeIn(0) * 0.6} />

        {/* Navigation bar skeleton */}
        <rect x="16" y="14" width="288" height="22" rx="4"
          fill={colorIntensity > 0 ? tokens.surface.base : tokens.surface.inset}
          stroke={colorIntensity > 0 ? accentStroke : tokens.accent.muted}
          strokeWidth={colorIntensity > 0 ? 1 : 0.5}
          opacity={fadeIn(0)} />
        {/* Nav dots — appear during DISCOVER */}
        <circle cx="30" cy="25" r="4" fill={colorIntensity > 0 ? tokens.accent.main : tokens.text.muted} opacity={fadeIn(0.05) * 0.5} />
        <circle cx="42" cy="25" r="4" fill={tokens.text.muted} opacity={fadeIn(0.05) * 0.3} />
        <circle cx="54" cy="25" r="4" fill={tokens.text.muted} opacity={fadeIn(0.05) * 0.3} />
        {/* Nav text placeholders */}
        <rect x="110" y="21" width="40" height="6" rx="2" fill={tokens.text.muted} opacity={fadeIn(0.08) * 0.3} />
        <rect x="158" y="21" width="30" height="6" rx="2" fill={tokens.text.muted} opacity={fadeIn(0.08) * 0.2} />

        {/* === STAGE 2: STRATEGY — layout grid, sections defined === */}
        {/* Hero section */}
        <rect x="16" y="42" width="288" height="70" rx="4"
          fill={colorIntensity > 0.5 ? accentFill : tokens.surface.deep}
          stroke={colorIntensity > 0 ? accentStroke : tokens.accent.muted}
          strokeWidth={colorIntensity > 0 ? 1 : 0.5}
          opacity={fadeIn(0.15)} />
        {/* Hero headline */}
        <rect x="28" y="56" width="140" height="10" rx="3"
          fill={colorIntensity > 0 ? tokens.accent.main : tokens.text.muted}
          opacity={fadeIn(0.18) * (0.3 + colorIntensity * 0.4)} />
        {/* Hero subtext */}
        <rect x="28" y="72" width="200" height="5" rx="2" fill={tokens.text.muted} opacity={fadeIn(0.2) * 0.25} />
        <rect x="28" y="82" width="160" height="5" rx="2" fill={tokens.text.muted} opacity={fadeIn(0.2) * 0.2} />
        {/* Hero CTA button — appears during DESIGN */}
        <rect x="28" y="94" width="60" height="14" rx="4"
          fill={tokens.accent.main} opacity={fadeIn(0.4) * 0.7} />
        <rect x="36" y="99" width="36" height="4" rx="1"
          fill="#fff" opacity={fadeIn(0.4) * 0.6} />

        {/* === STAGE 3: TASTE + DESIGN — cards fill in === */}
        {/* Three-column card grid */}
        {[0, 1, 2].map(i => {
          const cardX = 16 + i * 98;
          const cardDelay = 0.25 + i * 0.06;
          const contentDelay = 0.35 + i * 0.05;
          return (
            <g key={i} opacity={fadeIn(cardDelay)}>
              {/* Card background */}
              <rect x={cardX} y="120" width="90" height="80" rx="4"
                fill={colorIntensity > 0.3 ? tokens.surface.base : tokens.surface.inset}
                stroke={colorIntensity > 0.3 ? accentStroke : tokens.accent.muted}
                strokeWidth={0.5 + colorIntensity * 0.5} />
              {/* Card icon area */}
              <circle cx={cardX + 20} cy="138" r="8"
                fill={colorIntensity > 0.5 ? tokens.accent.main + "25" : tokens.surface.deep}
                stroke={colorIntensity > 0.5 ? tokens.accent.main : tokens.text.muted}
                strokeWidth="1" opacity={fadeIn(contentDelay)} />
              {/* Card title */}
              <rect x={cardX + 10} y="152" width="50" height="5" rx="2"
                fill={colorIntensity > 0 ? tokens.text.primary : tokens.text.muted}
                opacity={fadeIn(contentDelay) * (0.3 + colorIntensity * 0.5)} />
              {/* Card body text */}
              <rect x={cardX + 10} y="162" width="70" height="3" rx="1"
                fill={tokens.text.muted} opacity={fadeIn(contentDelay + 0.05) * 0.25} />
              <rect x={cardX + 10} y="169" width="55" height="3" rx="1"
                fill={tokens.text.muted} opacity={fadeIn(contentDelay + 0.05) * 0.2} />
              {/* Card action — appears late during DESIGN */}
              <rect x={cardX + 10} y="180" width="40" height="10" rx="3"
                fill={tokens.accent.main} opacity={fadeIn(0.5 + i * 0.03) * 0.5} />
            </g>
          );
        })}

        {/* === STAGE 4: VERIFY — data table, polish === */}
        {/* Data table */}
        <rect x="16" y="208" width="288" height="40" rx="4"
          fill={colorIntensity > 0.5 ? tokens.surface.base : tokens.surface.inset}
          stroke={colorIntensity > 0.5 ? accentStroke : tokens.accent.muted}
          strokeWidth="0.5" opacity={fadeIn(0.55)} />
        {/* Table header */}
        <rect x="22" y="214" width="276" height="8" rx="2"
          fill={tokens.surface.deep} opacity={fadeIn(0.57)} />
        <rect x="28" y="216" width="35" height="4" rx="1" fill={tokens.text.muted} opacity={fadeIn(0.58) * 0.4} />
        <rect x="80" y="216" width="45" height="4" rx="1" fill={tokens.text.muted} opacity={fadeIn(0.58) * 0.3} />
        <rect x="145" y="216" width="40" height="4" rx="1" fill={tokens.text.muted} opacity={fadeIn(0.58) * 0.3} />
        <rect x="210" y="216" width="50" height="4" rx="1" fill={tokens.text.muted} opacity={fadeIn(0.58) * 0.3} />
        {/* Table rows */}
        {[0, 1, 2].map(r => (
          <g key={r} opacity={fadeIn(0.6 + r * 0.03)}>
            <rect x="28" y={226 + r * 7} width="30" height="3" rx="1" fill={tokens.text.muted} opacity="0.3" />
            <rect x="80" y={226 + r * 7} width="40" height="3" rx="1" fill={tokens.text.muted} opacity="0.2" />
            <rect x="145" y={226 + r * 7} width="35" height="3" rx="1" fill={tokens.accent.main} opacity="0.25" />
            <rect x="210" y={226 + r * 7} width="45" height="3" rx="1" fill={tokens.text.muted} opacity="0.2" />
          </g>
        ))}

        {/* === STAGE 5: HANDOFF — a11y check indicator === */}
        <g opacity={fadeIn(0.75)}>
          <circle cx="300" cy="246" r="6" fill="none" stroke={tokens.accent.main} strokeWidth="1.2" />
          <path d="M297 246l2 2 4-4" stroke={tokens.accent.main} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Direction note pins — show where user has left feedback */}
        {notes.map((note, i) => (
          <g key={i}>
            <circle cx={note.x} cy={note.y} r="5"
              fill={tokens.accent.main} stroke="#fff" strokeWidth="1.5" />
            <text x={note.x} y={note.y + 3}
              textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>

      {/* Stage label */}
      <div style={{
        padding: "8px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: `1px solid ${tokens.surface.inset}`,
      }}>
        <span style={{
          fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
          color: p >= 0.9 ? tokens.accent.main : tokens.accent.text,
          letterSpacing: "0.06em",
          fontWeight: p >= 0.9 ? 600 : 400,
        }}>
          {stageLabel}
        </span>
        {notes.length > 0 && (
          <span style={{
            fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
            color: tokens.accent.text, letterSpacing: "0.04em",
          }}>
            {notes.length} note{notes.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Inline direction input — appears when you click the preview */}
      {showInput && (
        <div style={{
          padding: "10px 14px",
          borderTop: `1px solid ${tokens.surface.inset}`,
          background: tokens.surface.base + "CC",
          display: "flex", gap: 8, alignItems: "flex-end",
        }}>
          <textarea
            autoFocus
            value={directionNote}
            onChange={e => setDirectionNote(e.target.value)}
            placeholder="Direct your agents — what should change?"
            rows={2}
            style={{
              flex: 1, padding: "8px 10px",
              background: tokens.surface.base,
              boxShadow: tokens.shadow.concave,
              border: "none", borderRadius: tokens.radius.inset,
              fontFamily: tokens.font.sans, fontSize: tokens.type.sm,
              color: tokens.text.primary, outline: "none",
              resize: "none", lineHeight: 1.4,
            }}
            onKeyDown={e => {
              if (e.key === "Escape") { setShowInput(false); setDirectionNote(""); }
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Button variant="primary" onClick={() => {
              if (directionNote.trim()) {
                setNotes(prev => [...prev, { text: directionNote.trim(), x: 160 + Math.random() * 100, y: 80 + Math.random() * 120 }]);
                setDirectionNote("");
              }
              setShowInput(false);
            }} style={{ padding: "6px 12px", fontSize: 9 }}>
              Send
            </Button>
            <Button variant="secondary" onClick={() => { setShowInput(false); setDirectionNote(""); }} style={{ padding: "6px 12px", fontSize: 9 }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Hint — only shows when input is closed and no notes yet */}
      {!showInput && notes.length === 0 && p > 0.1 && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          padding: "4px 8px", borderRadius: 4,
          background: tokens.surface.raised + "DD",
          boxShadow: tokens.shadow.convex,
          fontFamily: tokens.font.mono, fontSize: 9,
          color: tokens.text.hint, letterSpacing: "0.04em",
        }}>
          CLICK TO DIRECT
        </div>
      )}
    </div>
  );
}

// === RIGHT PANEL ===
function RightPanel({ expanded, onToggleExpand, clock, pipelineMode, onFocusAgent, blockers = projectBlockers, deliverables = projectDeliverables, liveActive = false }) {
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [reviewMode, setReviewMode] = useState("building"); // "building" | "ready" | "reviewing" | "iterating"
  const [reviewStep, setReviewStep] = useState(0); // which deliverable is being presented
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackItems, setFeedbackItems] = useState([]); // collected feedback per deliverable

  // Derive current stage from clock
  const currentStageIdx = pipelineStages.findIndex(s => clock < s.pct);
  const currentStage = pipelineStages[Math.max(0, currentStageIdx)];
  const isLastStage = currentStageIdx === pipelineStages.length - 1;

  const hasBlockers = blockers.some(b => b.severity === "warn");
  const allDone = clock > 0.9;

  // Transition to "ready" when pipeline completes
  useEffect(() => {
    if (allDone && reviewMode === "building") {
      setReviewMode("ready");
    }
  }, [allDone, reviewMode]);

  // Deliverables that are ready for review (approved or draft)
  const reviewableDeliverables = deliverables.filter(d => d.status === "approved" || d.status === "draft");
  return (
    <div style={{
      width: expanded ? "60%" : 384, flexShrink: 0,
      display: "flex", flexDirection: "column", gap: 16,
      overflowY: "auto", padding: "0 0 16px 0",
      transition: "width 0.3s ease",
    }}>
      {/* Work in Progress */}
      <div style={{
        background: tokens.surface.raised,
        boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel,
        padding: 24,
        flex: 1,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.secondary, letterSpacing: "0.08em" }}>WORK IN PROGRESS</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              onClick={onToggleExpand}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: tokens.surface.raised,
                boxShadow: tokens.shadow.convex,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                {expanded ? (
                  <>{/* Collapse icon */}
                    <path d="M9 1v4h4M5 13v-4H1M9 5L13 1M5 9L1 13" stroke={tokens.text.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </>
                ) : (
                  <>{/* Expand icon */}
                    <path d="M1 5V1h4M13 9v4h-4M1 1l4 4M13 13l-4-4" stroke={tokens.text.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </>
                )}
              </svg>
            </div>
            <Led status="running" size={6} />
          </div>
        </div>
        <WipPreview clock={clock} pipelineMode={pipelineMode} />
      </div>

      {/* Blockers / Needs your attention */}
      <div style={{
        background: tokens.surface.raised,
        boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel,
        padding: "16px 24px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: blockers.length === 0 ? tokens.text.muted : tokens.led.error, letterSpacing: "0.08em" }}>
          {blockers.length === 0 && liveActive ? "STATUS" : "NEEDS YOUR ATTENTION"}
        </div>
        {blockers.length === 0 ? (
          <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.muted, lineHeight: 1.4 }}>
            {liveActive ? "Nothing needs you right now — blockers and questions from the team will appear here." : "No blockers."}
          </div>
        ) : blockers.map((b, i) => {
          // Match blocker agent name to agentsData id (e.g. "CRITIC" → "critic")
          const agentId = agentsData.find(a => a.name === b.agent || a.id === b.agent.toLowerCase())?.id;
          return (
            <div
              key={i}
              onClick={() => agentId && onFocusAgent && onFocusAgent(agentId, { agent: b.agent, text: b.text, severity: b.severity })}
              className="neo-btn"
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                background: b.severity === "input" ? tokens.accent.main + "0A" : tokens.led.error + "0A",
                borderRadius: tokens.radius.inset,
                padding: "8px 12px",
                borderLeft: `3px solid ${b.severity === "input" ? tokens.accent.main : tokens.led.error}`,
                cursor: agentId ? "pointer" : "default",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{
                fontFamily: tokens.font.mono, fontSize: 9, fontWeight: 600,
                color: b.severity === "input" ? tokens.accent.main : tokens.led.error,
                letterSpacing: "0.04em", flexShrink: 0, marginTop: 1,
              }}>
                {b.agent}
              </span>
              <span style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.primary, lineHeight: 1.4, flex: 1 }}>
                {b.text}
              </span>
              {agentId && (
                <span style={{
                  fontFamily: tokens.font.mono, fontSize: 9,
                  color: tokens.text.muted, flexShrink: 0, marginTop: 2,
                }}>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Deliverables */}
      <div style={{
        background: tokens.surface.raised,
        boxShadow: tokens.shadow.convex,
        borderRadius: tokens.radius.panel,
        padding: "16px 24px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.text.muted, letterSpacing: "0.08em" }}>
          DELIVERABLES
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {deliverables.length === 0 && (
            <div style={{ fontFamily: tokens.font.sans, fontSize: 11, color: tokens.text.muted, lineHeight: 1.4 }}>
              {liveActive ? "Deliverables will appear here as the team ships work." : "No deliverables yet."}
            </div>
          )}
          {deliverables.map((d, i) => {
            const isSelected = selectedDeliverable === i;
            return (
              <div key={i}>
                <div
                  className="neo-btn"
                  onClick={() => setSelectedDeliverable(isSelected ? null : i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px",
                    borderRadius: tokens.radius.inset,
                    cursor: "pointer",
                    background: isSelected ? tokens.surface.inset : "transparent",
                    boxShadow: isSelected ? tokens.shadow.pressed : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{
                    fontFamily: tokens.font.mono, fontSize: 11,
                    color: ({ "approved": tokens.accent.main, "draft": tokens.text.secondary, "in-progress": tokens.led.staged })[d.status],
                    width: 14, textAlign: "center",
                  }}>
                    {({ "approved": "✓", "draft": "○", "in-progress": "◑" })[d.status]}
                  </span>
                  <span style={{
                    fontFamily: tokens.font.sans, fontSize: 11,
                    color: isSelected ? tokens.text.primary : (d.status === "approved" ? tokens.text.primary : tokens.text.secondary),
                    flex: 1,
                  }}>
                    {d.name}
                  </span>
                  <span style={{
                    fontFamily: tokens.font.mono, fontSize: 9,
                    color: tokens.text.muted, letterSpacing: "0.04em",
                  }}>
                    {d.agent}
                  </span>
                  <span style={{
                    fontFamily: tokens.font.mono, fontSize: 11,
                    color: tokens.text.muted,
                    transform: isSelected ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}>
                    ∨
                  </span>
                </div>
                {/* Preview drawer */}
                {isSelected && (
                  <div style={{
                    background: tokens.surface.inset,
                    boxShadow: tokens.shadow.concave,
                    borderRadius: tokens.radius.inset,
                    padding: 16,
                    margin: "4px 0 8px 0",
                  }}>
                    <pre style={{
                      fontFamily: tokens.font.mono, fontSize: 11,
                      color: tokens.text.primary,
                      lineHeight: 1.6,
                      margin: 0, whiteSpace: "pre-wrap",
                      wordWrap: "break-word",
                    }}>
                      {d.preview}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* === REVIEW CTA — only appears when agents are done === */}
      {reviewMode === "ready" && (
        <div style={{
          background: tokens.surface.raised,
          boxShadow: tokens.shadow.convex,
          borderRadius: tokens.radius.panel,
          padding: 24,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 14,
          border: `1px solid ${tokens.accent.main}25`,
          animation: "fadeIn 0.6s ease",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: tokens.accent.main + "15",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke={tokens.accent.main} strokeWidth="1.5" />
              <path d="M7 10l2 2 4-4" stroke={tokens.accent.main} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: tokens.font.sans, fontSize: tokens.type.lg,
              fontWeight: 600, color: tokens.text.primary, marginBottom: 4,
            }}>
              Your team is ready to present
            </div>
            <div style={{
              fontFamily: tokens.font.sans, fontSize: tokens.type.md,
              color: tokens.text.secondary, lineHeight: 1.5,
            }}>
              {reviewableDeliverables.length} deliverables assembled. Walk through the work, give your feedback, and make it yours.
            </div>
          </div>
          <button
            className="neo-btn-primary"
            onClick={() => { setReviewMode("reviewing"); setReviewStep(0); }}
            style={{
              width: "100%", padding: "16px 24px",
              background: tokens.accent.main,
              border: "none", borderRadius: tokens.radius.panel,
              fontFamily: tokens.font.mono, fontSize: 11,
              color: "#fff", cursor: "pointer",
              letterSpacing: "0.08em", textTransform: "uppercase",
              boxShadow: `0 4px 12px ${tokens.accent.glow}`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="#fff" strokeWidth="1.3" />
              <path d="M3.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Review with your team
          </button>
        </div>
      )}

      {/* === REVIEW MODE — presentation walkthrough === */}
      {reviewMode === "reviewing" && (
        <div style={{
          background: tokens.surface.raised,
          boxShadow: tokens.shadow.convex,
          borderRadius: tokens.radius.panel,
          padding: 24,
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{
                fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
                color: tokens.accent.text, letterSpacing: "0.08em",
              }}>
                DESIGN REVIEW
              </div>
              <div style={{
                fontFamily: tokens.font.sans, fontSize: tokens.type.md,
                color: tokens.text.muted, marginTop: 2,
              }}>
                {reviewStep + 1} of {reviewableDeliverables.length}
              </div>
            </div>
            {/* Step dots */}
            <div style={{ display: "flex", gap: 4 }}>
              {reviewableDeliverables.map((_, i) => (
                <div key={i} onClick={() => setReviewStep(i)} style={{
                  width: i === reviewStep ? 16 : 6, height: 6, borderRadius: 3,
                  background: i === reviewStep ? tokens.accent.main
                    : i < reviewStep ? tokens.accent.text
                    : tokens.surface.deep,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }} />
              ))}
            </div>
          </div>

          {/* Current deliverable */}
          {reviewableDeliverables[reviewStep] && (
            <>
              <div>
                <div style={{
                  fontFamily: tokens.font.sans, fontSize: tokens.type.lg,
                  fontWeight: 600, color: tokens.text.primary, marginBottom: 4,
                }}>
                  {reviewableDeliverables[reviewStep].name}
                </div>
                <div style={{
                  fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
                  color: tokens.text.muted, letterSpacing: "0.04em",
                }}>
                  by {reviewableDeliverables[reviewStep].agent}
                </div>
              </div>

              {/* Deliverable content */}
              <div style={{
                background: tokens.surface.base,
                boxShadow: tokens.shadow.concave,
                borderRadius: tokens.radius.inset,
                padding: 16, maxHeight: 200, overflowY: "auto",
              }}>
                <pre style={{
                  fontFamily: tokens.font.mono, fontSize: tokens.type.sm,
                  color: tokens.text.primary, lineHeight: 1.6,
                  margin: 0, whiteSpace: "pre-wrap", wordWrap: "break-word",
                }}>
                  {reviewableDeliverables[reviewStep].preview}
                </pre>
              </div>

              {/* Feedback input */}
              <div>
                <label style={{
                  fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
                  color: tokens.text.hint, letterSpacing: "0.06em",
                  textTransform: "uppercase", display: "block", marginBottom: 6,
                }}>
                  Your notes
                </label>
                <textarea
                  value={feedbackNotes}
                  onChange={e => setFeedbackNotes(e.target.value)}
                  placeholder="What would you change? What works? Add your fingerprints..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px",
                    background: tokens.surface.base,
                    boxShadow: tokens.shadow.concave,
                    border: "none", borderRadius: tokens.radius.inset,
                    fontFamily: tokens.font.sans, fontSize: tokens.type.md,
                    color: tokens.text.primary, outline: "none",
                    resize: "vertical", minHeight: 60, lineHeight: 1.5,
                  }}
                />
              </div>

              {/* Previously left feedback for this item */}
              {feedbackItems[reviewStep] && (
                <div style={{
                  padding: "8px 12px",
                  background: tokens.accent.main + "0A",
                  borderLeft: `3px solid ${tokens.accent.main}`,
                  borderRadius: tokens.radius.inset,
                }}>
                  <div style={{
                    fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
                    color: tokens.accent.text, letterSpacing: "0.04em", marginBottom: 4,
                  }}>
                    YOUR FEEDBACK
                  </div>
                  <div style={{
                    fontFamily: tokens.font.sans, fontSize: tokens.type.md,
                    color: tokens.text.primary, lineHeight: 1.5,
                  }}>
                    {feedbackItems[reviewStep]}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Button
              variant="secondary"
              disabled={reviewStep === 0}
              onClick={() => { setReviewStep(s => s - 1); setFeedbackNotes(""); }}
            >
              ← Prev
            </Button>

            <div style={{ display: "flex", gap: 8 }}>
              {feedbackNotes.trim() && (
                <Button variant="secondary" onClick={() => {
                  const updated = [...feedbackItems];
                  updated[reviewStep] = feedbackNotes.trim();
                  setFeedbackItems(updated);
                  setFeedbackNotes("");
                }}>
                  Save note
                </Button>
              )}

              {reviewStep < reviewableDeliverables.length - 1 ? (
                <Button variant="primary" onClick={() => {
                  if (feedbackNotes.trim()) {
                    const updated = [...feedbackItems];
                    updated[reviewStep] = feedbackNotes.trim();
                    setFeedbackItems(updated);
                  }
                  setFeedbackNotes("");
                  setReviewStep(s => s + 1);
                }}>
                  Next →
                </Button>
              ) : (
                <Button variant="primary" onClick={() => {
                  if (feedbackNotes.trim()) {
                    const updated = [...feedbackItems];
                    updated[reviewStep] = feedbackNotes.trim();
                    setFeedbackItems(updated);
                  }
                  setFeedbackNotes("");
                  setReviewMode("summary");
                }}>
                  Finish review
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === REVIEW SUMMARY — after walking through all deliverables === */}
      {reviewMode === "summary" && (() => {
        const hasFeedback = feedbackItems.some(f => f && f.trim());
        return (
          <div style={{
            background: tokens.surface.raised,
            boxShadow: tokens.shadow.convex,
            borderRadius: tokens.radius.panel,
            padding: 24,
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{
              fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
              color: tokens.accent.text, letterSpacing: "0.08em",
            }}>
              REVIEW COMPLETE
            </div>

            {hasFeedback ? (
              <>
                <div style={{
                  fontFamily: tokens.font.sans, fontSize: tokens.type.lg,
                  fontWeight: 600, color: tokens.text.primary,
                }}>
                  You left {feedbackItems.filter(f => f && f.trim()).length} note{feedbackItems.filter(f => f && f.trim()).length > 1 ? "s" : ""}
                </div>

                {/* Feedback summary */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {feedbackItems.map((note, i) => note && note.trim() ? (
                    <div key={i} style={{
                      padding: "10px 12px",
                      background: tokens.surface.base,
                      boxShadow: tokens.shadow.concave,
                      borderRadius: tokens.radius.inset,
                      borderLeft: `3px solid ${tokens.accent.main}`,
                    }}>
                      <div style={{
                        fontFamily: tokens.font.mono, fontSize: tokens.type.xs,
                        color: tokens.accent.text, letterSpacing: "0.04em", marginBottom: 4,
                      }}>
                        {reviewableDeliverables[i]?.name}
                      </div>
                      <div style={{
                        fontFamily: tokens.font.sans, fontSize: tokens.type.md,
                        color: tokens.text.primary, lineHeight: 1.5,
                      }}>
                        {note}
                      </div>
                    </div>
                  ) : null)}
                </div>

                <div style={{
                  fontFamily: tokens.font.sans, fontSize: tokens.type.md,
                  color: tokens.text.secondary, lineHeight: 1.5,
                }}>
                  Your agents will take your notes and iterate. They'll present again when the changes are ready.
                </div>

                <button
                  className="neo-btn-primary"
                  onClick={() => {
                    setReviewMode("building");
                    setReviewStep(0);
                    setFeedbackNotes("");
                    setFeedbackItems([]);
                  }}
                  style={{
                    width: "100%", padding: "16px 24px",
                    background: tokens.accent.main,
                    border: "none", borderRadius: tokens.radius.panel,
                    fontFamily: tokens.font.mono, fontSize: 11,
                    color: "#fff", cursor: "pointer",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    boxShadow: `0 4px 12px ${tokens.accent.glow}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7h10M7 2v10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Send feedback — agents iterate
                </button>
              </>
            ) : (
              <>
                <div style={{
                  fontFamily: tokens.font.sans, fontSize: tokens.type.lg,
                  fontWeight: 600, color: tokens.text.primary,
                }}>
                  No changes needed
                </div>
                <div style={{
                  fontFamily: tokens.font.sans, fontSize: tokens.type.md,
                  color: tokens.text.secondary, lineHeight: 1.5,
                }}>
                  The work looks good to you. Your design is ready to ship.
                </div>
                <button
                  className="neo-btn-primary"
                  onClick={() => {}}
                  style={{
                    width: "100%", padding: "16px 24px",
                    background: tokens.text.primary,
                    border: "none", borderRadius: tokens.radius.panel,
                    fontFamily: tokens.font.mono, fontSize: 11,
                    color: "#fff", cursor: "pointer",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    boxShadow: `0 4px 12px rgba(74,71,68,0.3)`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14 }}>↗</span> Export design
                </button>
              </>
            )}

            {/* Always allow re-review */}
            <Button variant="secondary" onClick={() => { setReviewMode("reviewing"); setReviewStep(0); setFeedbackNotes(""); }}>
              Review again
            </Button>
          </div>
        );
      })()}
    </div>
  );
}

// === TOP BAR ===
// === MODE SWITCHER ===
// DAW-inspired three-position slider: STOPPED → AUTO → HUMAN-IN-THE-LOOP
// A physical knob travels along a pill-shaped track. Each position has distinct
// visual identity. Clicking a zone snaps the knob; the whole bar communicates mode.
function ModeSwitcher({ pipelineMode, setPipelineMode }) {
  // Stroke-based SVG icons — consistent with our icon system
  const StopIcon = ({ color }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="2" width="8" height="8" rx="1.5" fill={color} />
    </svg>
  );
  const RobotIcon = ({ color }) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="4.5" width="8" height="6.5" rx="2" stroke={color} strokeWidth="1.3" />
      <circle cx="5.5" cy="7.5" r="1" fill={color} />
      <circle cx="8.5" cy="7.5" r="1" fill={color} />
      <line x1="7" y1="2" x2="7" y2="4.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="1.5" r="0.7" fill={color} />
      <line x1="1.5" y1="7.5" x2="3" y2="7.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="11" y1="7.5" x2="12.5" y2="7.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  const PersonIcon = ({ color }) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="4.5" r="2.8" stroke={color} strokeWidth="1.3" />
      {/* Eyes */}
      <circle cx="5.8" cy="4" r="0.6" fill={color} />
      <circle cx="8.2" cy="4" r="0.6" fill={color} />
      {/* Smile */}
      <path d="M5.6 5.6c.4.6 1.6.6 2.8 0" stroke={color} strokeWidth="0.8" strokeLinecap="round" fill="none" />
      {/* Body */}
      <path d="M3.5 12.5c0-2.2 1.6-3.5 3.5-3.5s3.5 1.3 3.5 3.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );

  const modes = [
    { id: "stopped", label: "STOP", icon: (c) => <StopIcon color={c} />, color: tokens.text.muted, desc: "Pipeline paused" },
    { id: "playing", label: "AUTO", icon: (c) => <RobotIcon color={c} />, color: tokens.accent.main, desc: "Agents run freely" },
    { id: "recording", label: "HUMAN", icon: (c) => <PersonIcon color={c} />, color: tokens.accent.text, desc: "You approve each step" },
  ];

  const currentIdx = modes.findIndex(m => m.id === pipelineMode);
  const current = modes[currentIdx] || modes[0];

  // Pulse animation for HITL mode
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (pipelineMode !== "recording") { setPulse(false); return; }
    const interval = setInterval(() => setPulse(prev => !prev), 800);
    return () => clearInterval(interval);
  }, [pipelineMode]);

  const trackWidth = 240;
  const knobSize = 36;
  const zoneWidth = trackWidth / 3;
  const knobLeft = currentIdx * zoneWidth + (zoneWidth - knobSize) / 2;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* Track */}
      <div style={{
        position: "relative",
        width: trackWidth, height: 40,
        background: tokens.surface.inset,
        boxShadow: tokens.shadow.concave,
        borderRadius: 20,
        display: "flex", alignItems: "center",
        overflow: "hidden",
      }}>
        {/* Active zone glow — fills from left to knob position */}
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: knobLeft + knobSize, height: "100%",
          background: pipelineMode === "stopped" ? "transparent"
            : `linear-gradient(90deg, transparent 0%, ${current.color}12 50%, ${current.color}20 100%)`,
          borderRadius: 20,
          transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }} />

        {/* Zone labels */}
        {modes.map((mode, i) => (
          <div
            key={mode.id}
            onClick={() => {
              setPipelineMode(mode.id);
              if (mode.id === "playing") SoundEngine.play();
              else if (mode.id === "recording") SoundEngine.record();
              else SoundEngine.stop();
            }}
            style={{
              width: zoneWidth, height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", position: "relative", zIndex: 1,
            }}
          >
            <span style={{
              fontFamily: tokens.font.mono, fontSize: 9,
              color: pipelineMode === mode.id ? current.color : tokens.text.muted,
              letterSpacing: "0.06em", fontWeight: 600,
              opacity: pipelineMode === mode.id ? 0 : 0.6,
              transition: "all 0.3s ease",
            }}>
              {mode.label}
            </span>
          </div>
        ))}

        {/* Knob */}
        <div style={{
          position: "absolute",
          left: knobLeft, top: 2,
          width: knobSize, height: knobSize,
          borderRadius: "50%",
          background: tokens.surface.raised,
          boxShadow: pipelineMode === "stopped"
            ? tokens.shadow.knob
            : `${tokens.shadow.knob}, 0 0 ${pulse ? 12 : 8}px ${current.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease",
          zIndex: 2,
        }}>
          {/* Icon inside knob */}
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.3s ease",
            lineHeight: 1,
          }}>
            {current.icon(current.color)}
          </span>
        </div>
      </div>

      {/* Mode label + description */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 2,
        minWidth: 130,
      }}>
        <span style={{
          fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600,
          color: current.color,
          letterSpacing: "0.08em",
          transition: "color 0.3s ease",
        }}>
          {{ stopped: "STOPPED", playing: "AUTO MODE", recording: "HUMAN-IN-THE-LOOP" }[pipelineMode]}
        </span>
        <span style={{
          fontFamily: tokens.font.sans, fontSize: 9,
          color: tokens.text.muted,
          transition: "color 0.3s ease",
        }}>
          {current.desc}
        </span>
      </div>
    </div>
  );
}

function TopBar({ activeTab, setActiveTab, pipelineMode, setPipelineMode, onSettingsClick }) {
  const tabs = ["ARRANGEMENT", "AGENTS", "NODES"];

  return (
    <div style={{
      height: 56,
      background: tokens.surface.raised,
      boxShadow: tokens.shadow.convex,
      display: "flex", alignItems: "center",
      padding: "0 24px",
      gap: 24,
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: tokens.font.mono, fontSize: 14, fontWeight: 600,
        color: tokens.text.muted, letterSpacing: "0.15em",
      }}>
        OWL-1
      </span>

      <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: activeTab === tab ? `1.5px solid ${tokens.accent.main}` : "1.5px solid transparent",
              borderRadius: 20,
              fontFamily: tokens.font.mono, fontSize: 11,
              color: activeTab === tab ? tokens.accent.text : tokens.text.secondary,
              cursor: "pointer",
              letterSpacing: "0.06em",
              transition: "all 0.15s ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <ModeSwitcher pipelineMode={pipelineMode} setPipelineMode={setPipelineMode} />

      <button className="neo-nav" onClick={onSettingsClick} style={{
        width: 36, height: 36,
        background: tokens.surface.raised,
        boxShadow: tokens.shadow.convex,
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        border: "none",
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke={tokens.text.secondary} strokeWidth="1.5"/>
          <circle cx="8" cy="8" r="1.5" fill={tokens.text.secondary}/>
          <path d="M8 2.5v1.5M8 12v1.5M2.5 8H4M12 8h1.5M4.1 4.1l1 1M10.9 10.9l1 1M4.1 11.9l1-1M10.9 5.1l1-1" stroke={tokens.text.secondary} strokeWidth="1" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// === SETTINGS DRAWER ===
function SettingsDrawer({ isOpen, onClose, theme, toggleTheme }) {
  const [settings, setSettings] = useState({
    defaultModel: "claude-sonnet-4-6",
    sessionCap: 5.00,
    desktopNotifications: true,
    soundEnabled: false,
  });

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const sectionStyle = {
    marginBottom: 24,
  };
  const sectionTitle = {
    fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600,
    color: tokens.text.secondary, letterSpacing: "0.1em",
    marginBottom: 12, textTransform: "uppercase",
  };
  const fieldRow = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10,
  };
  const fieldLabel = {
    fontFamily: tokens.font.sans, fontSize: 11,
    color: tokens.text.primary,
  };
  const selectStyle = {
    fontFamily: tokens.font.mono, fontSize: 11,
    color: tokens.text.primary,
    background: tokens.surface.inset,
    boxShadow: tokens.shadow.pressed,
    border: "none", borderRadius: tokens.radius.button,
    padding: "6px 10px", cursor: "pointer",
    outline: "none",
  };
  const inputStyle = {
    ...selectStyle,
    width: 72, textAlign: "right",
  };
  const toggleTrack = (on) => ({
    width: 36, height: 20, borderRadius: 10,
    background: on ? tokens.accent.main : tokens.surface.deep,
    boxShadow: tokens.shadow.pressed,
    position: "relative", cursor: "pointer",
    transition: "background 0.2s ease",
    border: "none", padding: 0,
  });
  const toggleThumb = (on) => ({
    width: 16, height: 16, borderRadius: "50%",
    background: tokens.surface.raised,
    boxShadow: tokens.shadow.knob,
    position: "absolute", top: 2,
    left: on ? 18 : 2,
    transition: "left 0.2s ease",
  });
  const divider = {
    height: 1, background: tokens.surface.inset,
    margin: "20px 0",
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div onClick={onClose} style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.15)",
          zIndex: 998,
          transition: "opacity 0.2s ease",
        }} />
      )}

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0,
        width: 360, height: "100vh",
        background: tokens.surface.raised,
        boxShadow: isOpen ? "-8px 0 24px rgba(0,0,0,0.12)" : "none",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s ease",
        zIndex: 999,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          height: 56, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: `1px solid ${tokens.surface.inset}`,
        }}>
          <span style={{
            fontFamily: tokens.font.mono, fontSize: 11, fontWeight: 600,
            color: tokens.text.primary, letterSpacing: "0.1em",
          }}>SETTINGS</span>
          <button onClick={onClose} style={{
            width: 32, height: 32,
            background: tokens.surface.raised,
            boxShadow: tokens.shadow.convex,
            border: "none", borderRadius: "50%",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: tokens.text.secondary, fontSize: 14,
          }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* ── APPEARANCE ── */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Appearance</div>

            <div style={fieldRow}>
              <span style={fieldLabel}>Dark mode</span>
              <button onClick={() => { toggleTheme(); SoundEngine.tick(); }} style={toggleTrack(theme === "dark")}>
                <div style={toggleThumb(theme === "dark")} />
              </button>
            </div>
          </div>

          <div style={divider} />

          {/* ── MODEL ── */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Model</div>

            <div style={fieldRow}>
              <span style={fieldLabel}>Default model</span>
              <select value={settings.defaultModel} onChange={e => update("defaultModel", e.target.value)} style={selectStyle}>
                <option value="claude-opus-4-6">Opus 4.6</option>
                <option value="claude-sonnet-4-6">Sonnet 4.6</option>
                <option value="claude-haiku-4-5">Haiku 4.5</option>
              </select>
            </div>

            <div style={fieldRow}>
              <span style={fieldLabel}>Session cost cap</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.muted }}>$</span>
                <input type="number" value={settings.sessionCap} onChange={e => update("sessionCap", Number(e.target.value))} style={inputStyle} step={0.5} min={0} />
              </div>
            </div>
          </div>

          <div style={divider} />

          {/* ── NOTIFICATIONS ── */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Notifications</div>

            <div style={fieldRow}>
              <span style={fieldLabel}>Desktop notifications</span>
              <button onClick={() => update("desktopNotifications", !settings.desktopNotifications)} style={toggleTrack(settings.desktopNotifications)}>
                <div style={toggleThumb(settings.desktopNotifications)} />
              </button>
            </div>

            <div style={fieldRow}>
              <span style={fieldLabel}>UI sounds</span>
              <button onClick={() => {
                const next = !settings.soundEnabled;
                update("soundEnabled", next);
                SoundEngine.setEnabled(next);
                if (next) setTimeout(() => SoundEngine.tick(), 50); // preview sound on enable
              }} style={toggleTrack(settings.soundEnabled)}>
                <div style={toggleThumb(settings.soundEnabled)} />
              </button>
            </div>
          </div>

          <div style={divider} />

          {/* ── DANGER ZONE ── */}
          <div style={sectionStyle}>
            <div style={{
              padding: 12,
              background: tokens.surface.inset,
              boxShadow: tokens.shadow.pressed,
              borderRadius: tokens.radius.inset,
              border: `1px solid rgba(217,79,79,0.2)`,
            }}>
              <div style={{ fontFamily: tokens.font.mono, fontSize: 9, color: tokens.led.error, letterSpacing: "0.08em", marginBottom: 8 }}>
                DANGER ZONE
              </div>
              <HoldToConfirm label="CLEAR ALL MEMORY" onConfirm={() => {
                setSettings(prev => ({ ...prev }));
              }} />
            </div>
          </div>

          <div style={divider} />

          {/* ── ABOUT ── */}
          <div style={sectionStyle}>
            <div style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.secondary, lineHeight: 1.7 }}>
              <div>OWL-1 v0.1.0-alpha</div>
              <div style={{ color: tokens.text.muted, marginTop: 4 }}>by Designpowers</div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", flexShrink: 0,
          borderTop: `1px solid ${tokens.surface.inset}`,
          fontFamily: tokens.font.mono, fontSize: 11,
          color: tokens.text.muted, letterSpacing: "0.06em",
          textAlign: "center",
        }}>
          Changes apply immediately
        </div>
      </div>
    </>
  );
}

// === STATUS BAR ===
function StatusBar() {
  return (
    <div style={{
      height: 32, flexShrink: 0,
      background: tokens.surface.raised,
      display: "flex", alignItems: "center",
      padding: "0 24px", gap: 24,
      borderTop: `1px solid ${tokens.surface.inset}`,
    }}>
      <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.muted }}>CPU: 24%</span>
      <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.muted }}>MEM: 4.2GB</span>
      <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.muted }}>LATENCY: 12MS</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.muted, cursor: "pointer" }}>RECOVERY</span>
      <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.led.error, cursor: "pointer" }}>EMERGENCY STOP</span>
    </div>
  );
}

// === MAIN APP ===
export default function OWL1() {
  const [expandedLane, setExpandedLane] = useState("lead");
  const [activeTab, setActiveTab] = useState("ARRANGEMENT");
  const [wipExpanded, setWipExpanded] = useState(false);
  const [clock, setClock] = useState(0);
  const [pipelineMode, setPipelineMode] = useState("stopped");
  const [activeView, setActiveView] = useState("guide"); // "guide" | "projects" | "tracks" | "memory" | "telemetry"
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasProject, setHasProject] = useState(false); // false = empty state, true = agents running
  const [activeBlocker, setActiveBlocker] = useState(null); // blocker context when navigating from "Needs Your Attention"
  const [theme, setTheme] = useState("light"); // "light" | "dark"

  // === LIVE OAP SOURCE ===
  // Add ?source=live to the URL to drive the UI from a real agent swarm's event
  // stream (e.g. spike/oap-gate/server.mjs or the Designpowers backend) instead of
  // the built-in simulation. Default (no param) = the original prototype, untouched.
  const liveEnabled = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("source") === "live";
  const live = useOapRuntime({ enabled: liveEnabled, url: "/events" });

  // Update the module-level tokens whenever theme changes
  tokens = buildTokens(theme);
  const toggleTheme = useCallback(() => setTheme(t => t === "light" ? "dark" : "light"), []);

  // Global pipeline clock — only runs when playing or recording.
  // A live source drives the clock from real stage events instead (see below).
  useEffect(() => {
    if (live.enabled) return;
    if (pipelineMode === "stopped") return;
    const speed = pipelineMode === "recording" ? 0.001 : 0.002; // recording runs at half speed — agents wait for you
    const interval = setInterval(() => {
      setClock(prev => (prev + speed) % 1);
    }, 50);
    return () => clearInterval(interval);
  }, [pipelineMode, live.enabled]);

  // Live source → transport mode.
  useEffect(() => {
    if (!live.enabled) return;
    setPipelineMode(live.pipelineMode);
  }, [live.enabled, live.pipelineMode]);

  // Live source → clock derived from the active pipeline stage.
  useEffect(() => {
    if (!live.enabled) return;
    const pct = pipelineStages.find(s => s.id === live.stage)?.pct;
    setClock(typeof pct === "number" ? Math.max(0, pct - 0.01) : 0);
  }, [live.enabled, live.stage]);

  // Live source → leave the guide and show the running tracks once connected.
  useEffect(() => {
    if (!live.enabled || !live.connected) return;
    setHasProject(true);
    setActiveView(v => (v === "guide" ? "tracks" : v));
  }, [live.enabled, live.connected]);

  // Live source → auto-expand the lane that's waiting on a handoff approval, so the
  // "✓ APPROVE + CONTINUE" button is in view when a gate opens.
  useEffect(() => {
    if (!live.enabled || !live.gates.length) return;
    const g = live.gates[live.gates.length - 1];
    setActiveView(v => (v === "guide" ? "tracks" : v));
    setExpandedLane(owlIdFor(g.agentId));
  }, [live.enabled, live.gates]);

  // Approve handler: in live mode, send a real OAP gate.approve command to the
  // backend (resolving the canUseTool gate); otherwise keep the prototype's stub.
  const handleApprove = useCallback((owlAgentId) => {
    if (live.enabled) {
      const g = live.gates.find(gg => owlIdFor(gg.agentId) === owlAgentId) || live.gates[live.gates.length - 1];
      if (g) postCommand("/command", { type: "gate.approve", gateId: g.gateId });
    } else {
      console.log(`Approved: ${owlAgentId}`);
    }
  }, [live.enabled, live.gates]);

  // Director console: the designer's first message is the brief that starts the run;
  // later messages steer the team mid-flight ("leave feedback along the way").
  const liveRunStartedRef = useRef(false);
  const [liveBrief, setLiveBrief] = useState("");
  useEffect(() => { if (!live.enabled) { liveRunStartedRef.current = false; setLiveBrief(""); } }, [live.enabled]);
  const handleDirectorMessage = useCallback((text) => {
    if (!liveRunStartedRef.current) {
      liveRunStartedRef.current = true;
      setLiveBrief(text);
      postCommand("/command", { type: "run.start", brief: text, mode: "human" });
    } else {
      postCommand("/command", { type: "agent.ask", text });
    }
  }, []);

  // Map live OAP data into the shapes the panels render. In live mode the UI shows
  // the real run (or honest empty states) instead of the sample fintech project.
  const prettyAgent = (slug) => {
    const owl = OWL_ID_BY_OAP[slug] || slug;
    return agentsData.find(a => a.id === owl)?.name || slug;
  };
  const liveBlockers = live.enabled ? live.blockers.map(b => ({ agent: prettyAgent(b.agent), severity: b.severity || "warn", text: b.text })) : null;
  const liveDeliverables = live.enabled ? live.artifacts.map(a => ({
    name: a.name,
    status: a.status === "approved" ? "approved" : a.status === "staged" ? "draft" : "in-progress",
    agent: prettyAgent(a.agent),
    preview: a.preview || "",
  })) : null;
  const liveProject = live.enabled ? { name: liveBrief ? "Live session" : "New session", brief: liveBrief } : null;

  const toggleLane = useCallback((id) => {
    setExpandedLane(prev => {
      const isCollapsing = prev === id;
      if (isCollapsing) { SoundEngine.collapse(); } else { SoundEngine.expand(); }
      return isCollapsing ? null : id;
    });
    setActiveBlocker(null); // clear blocker context when switching lanes
  }, []);

  return (
    <div style={{
      width: "100%", height: "100vh",
      background: tokens.surface.base,
      display: "flex", flexDirection: "column",
      fontFamily: tokens.font.sans,
      overflow: "hidden",
    }}>
      <style dangerouslySetInnerHTML={{ __html: buildCSS(tokens) }} />
      <TopBar activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); if (activeView === "guide") setActiveView("tracks"); }} pipelineMode={pipelineMode} setPipelineMode={setPipelineMode} onSettingsClick={() => setSettingsOpen(true)} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <SideNav activeView={activeView} setActiveView={(view) => { setActiveView(view); setActiveTab("ARRANGEMENT"); }} />

        {/* Main content area */}
        {!wipExpanded && (
          <div style={{
            flex: 1, overflowY: "auto",
            padding: 24, display: "flex",
            flexDirection: "column", gap: 8,
          }}>
            {/* === GUIDE VIEW — full-screen, replaces all tab content === */}
            {activeView === "guide" && (
              <WelcomeGuide onStart={(project) => {
                setActiveView("tracks");
                setPipelineMode("playing");
                setHasProject(true);
                SoundEngine.play();
              }} />
            )}

            {/* Project header — visible when a project is loaded and not in guide */}
            {activeView !== "guide" && hasProject && <ProjectHeader clock={clock} liveMessages={live.enabled ? live.messages : null} onDirectorSend={live.enabled ? handleDirectorMessage : null} liveProject={liveProject} />}

            {/* === TAB CONTENT: ARRANGEMENT === */}
            {activeTab === "ARRANGEMENT" && activeView !== "guide" && (
              <>
                {/* Side nav views within Arrangement tab */}
                {activeView === "projects" && (
                  <ProjectsView clock={clock} live={live.enabled ? { name: liveProject?.name || "Live session", brief: liveBrief, deliverables: liveDeliverables?.length || 0, blockers: liveBlockers?.length || 0, finished: live.finished } : null} />
                )}

                {activeView === "tracks" && !hasProject && (
                  <EmptyTracksState
                    onLoadProject={() => { setHasProject(true); }}
                    onNewProject={() => { setHasProject(true); setPipelineMode("playing"); }}
                  />
                )}

                {activeView === "tracks" && hasProject && (
                  <>
                    {agentsData.map(agent => {
                      const activity = getAgentActivity(agent, clock);
                      return expandedLane === agent.id ? (
                        <ExpandedLane key={agent.id} agent={agent} activity={activity} onCollapse={() => toggleLane(agent.id)} pipelineMode={pipelineMode} onApprove={() => handleApprove(agent.id)} onSaveDraft={() => console.log(`Draft saved: ${agent.id}`)} activeBlocker={expandedLane === agent.id ? activeBlocker : null} onDismissBlocker={() => setActiveBlocker(null)} liveMessages={live.enabled ? live.messages : null} />
                      ) : (
                        <CollapsedLane key={agent.id} agent={agent} activity={activity} onClick={() => toggleLane(agent.id)} isExpanded={false} pipelineMode={pipelineMode} />
                      );
                    })}
                  </>
                )}

                {activeView === "memory" && (
                  <MemoryView />
                )}

                {activeView === "telemetry" && (
                  <TelemetryView clock={clock} pipelineMode={pipelineMode} live={live.enabled ? { telemetry: live.telemetry } : null} />
                )}
              </>
            )}

            {/* === TAB CONTENT: AGENTS === */}
            {activeTab === "AGENTS" && activeView !== "guide" && (
              <AgentConsoleView clock={clock} pipelineMode={pipelineMode} />
            )}

            {/* === TAB CONTENT: NODES === */}
            {activeTab === "NODES" && activeView !== "guide" && (
              <NodesView clock={clock} pipelineMode={pipelineMode} />
            )}

            {/* Brand stamp */}
            <div style={{
              textAlign: "center", padding: "24px 0 8px",
              fontFamily: tokens.font.mono, fontSize: 11,
              color: tokens.text.muted, letterSpacing: "0.15em",
            }}>
              O W L - 1
            </div>
          </div>
        )}

        {/* Right Panel */}
        <div style={{
          padding: "24px 24px 24px 0",
          flex: wipExpanded ? 1 : "none",
          overflow: "hidden",
          display: "flex",
          minHeight: 0,
        }}>
          <RightPanel expanded={wipExpanded} onToggleExpand={() => setWipExpanded(prev => !prev)} clock={clock} pipelineMode={pipelineMode} blockers={live.enabled ? liveBlockers : undefined} deliverables={live.enabled ? liveDeliverables : undefined} liveActive={live.enabled} onFocusAgent={(agentId, blockerInfo) => {
            setActiveTab("ARRANGEMENT");
            setActiveView("tracks");
            setExpandedLane(agentId);
            setActiveBlocker(blockerInfo || null);
          }} />
        </div>
      </div>

      <StatusBar />
      <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} toggleTheme={toggleTheme} />
    </div>
  );
}
