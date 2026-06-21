// Sample / placeholder content for the OWL-1 design prototype (the offline,
// no-backend experience). In live mode (?source=live) the real run supplies this
// data instead — see the live wiring in owl-1-prototype.jsx. Keeping it here means
// the placeholder fintech project can never leak into a real Designpowers run.

export const sampleProject = {
  name: "Fintech Dashboard Redesign",
  brief: "Redesign the portfolio dashboard for clarity and speed. Reduce cognitive load, improve data density, ensure WCAG AA.",
};

export const eventLogs = [
  { time: "12:44:02", text: "DISCOVERY agent initialized", highlight: false },
  { time: "12:44:05", text: "Design brief loaded — 4 constraints", highlight: false },
  { time: "12:44:10", text: "Competitive scan: 7 products queued", highlight: true },
  { time: "12:44:15", text: "TASTE agent online — loading taste profile", highlight: false },
  { time: "12:44:20", text: "Handing findings to STRATEGY...", highlight: false },
  { time: "12:44:25", text: "Pattern extraction in progress", highlight: false },
  { time: "12:44:30", text: "Component inventory: 44 patterns found", highlight: true },
];

export const conversationData = [
  { role: "user", text: "Analyze the competitive landscape for a fintech dashboard. Focus on data density and navigation patterns." },
  { role: "agent", name: "AGENT-DISCOVERY", text: "SCANNING 7 COMPETITOR PRODUCTS. EXTRACTING COMPONENT PATTERNS, INFORMATION DENSITY METRICS, AND ACCESSIBILITY APPROACHES. MAPPING DESIGN DEPENDENCIES." },
];

export const outputPreviewData = `> ANALYZING_COMPETITIVE_LANDSCAPE
{
  "pattern_classifications": [
    "sidebar_hybrid",
    "grid_dense",
    "contextual_nav"
  ],
  "component_inventory": {
    "charts": 12,
    "tables": 8,
    "widgets": 24,
    "nav_patterns": 5
  },
  "density_score": 0.78,
  "a11y_baseline": "AA"
}`;

export const banterMessages = [
  { from: "Design Scout", to: "Design Strategist", text: "Found 3 recurring patterns across competitors — sidebar nav, contextual filtering, progressive disclosure. Handing over." },
  { from: "Design Strategist", to: "Design Scout", text: "Good. Can you dig deeper on the progressive disclosure? I need specifics on trigger mechanisms." },
  { from: "Inspiration Scout", to: "Design Lead", text: "The moodboard is leaning warm and tactile. Think soft shadows, generous whitespace, muted earth tones with a single accent." },
  { from: "Design Lead", to: "Inspiration Scout", text: "Love that direction. Make sure it doesn't drift too editorial — this needs to feel productive, not just beautiful." },
  { from: "Design Scout", to: "Accessibility Reviewer", text: "Heads up — 4 of 7 competitors fail WCAG AA on their data tables. Flagging as an opportunity." },
  { from: "Design Critic", to: "Design Builder", text: "The card component spec is missing hover and focus states. Don't start building until those are defined." },
  { from: "Content Writer", to: "Design Lead", text: "Draft microcopy ready for the empty states. Three options per screen — want to review before I hand to Design Builder?" },
  { from: "Motion Designer", to: "Design Critic", text: "Proposed 200ms ease-out for panel transitions. Accessible, performant, and matches the calm aesthetic." },
  { from: "Accessibility Reviewer", to: "Design Lead", text: "All color pairs pass AA. Two pairs are borderline for AAA — flagging for your call." },
  { from: "Design Builder", to: "Motion Designer", text: "Component scaffold is ready. Waiting on your animation tokens before I wire up transitions." },
  { from: "Heuristic Evaluator", to: "Design Strategist", text: "Cognitive walkthrough complete. Two flows have unnecessary steps — recommending we cut the confirmation modal on save." },
  { from: "Design Lead", to: "ALL", text: "Good progress everyone. Scout and Strategist are converging. Taste profile is locked. Moving to active design phase." },
];

export const projectConstraints = [
  { label: "Platform", value: "Web (responsive)" },
  { label: "A11y", value: "WCAG AA" },
  { label: "Deadline", value: "Apr 12, 2026" },
  { label: "Framework", value: "React + Tailwind" },
];

export const projectBlockers = [
  { agent: "Design Critic", severity: "warn", text: "Card component missing hover and focus states" },
  { agent: "Inspiration Scout", severity: "input", text: "Needs your input: warm or cool neutral palette?" },
];

export const projectDeliverables = [
  { name: "Competitive audit", status: "approved", agent: "Design Scout",
    preview: "7 competitors analyzed across data density, navigation patterns, and accessibility.\n\nKey findings:\n• Robinhood uses progressive disclosure to manage complexity\n• Wise leads in information density without cognitive overload\n• Only 2/7 competitors meet WCAG AA contrast on charts\n\nFull report: 24 pages, 44 annotated screenshots." },
  { name: "Design principles", status: "approved", agent: "Design Strategist",
    preview: "1. Clarity over density — every data point earns its place\n2. Progressive confidence — reveal complexity as users demonstrate mastery\n3. Accessible by default — AA compliance is the floor, not the ceiling\n4. Speed is respect — sub-200ms interactions, no loading spinners\n5. Calm authority — the interface whispers competence, never shouts" },
  { name: "Taste profile", status: "approved", agent: "Inspiration Scout",
    preview: "Emotional target: Calm authority with warm precision\nReferences: Linear (density), Stripe (clarity), Wise (approachability)\nPalette: Warm neutrals, single accent (coral-orange), restrained use of color\nType: Monospace for data, humanist sans for narrative\nElevation: Neomorphic with purpose — depth signals interactivity" },
  { name: "Information architecture", status: "draft", agent: "Design Strategist",
    preview: "DRAFT — awaiting review\n\nL1: Dashboard (overview) → Portfolio → Activity → Settings\nL2: Portfolio breaks into Holdings, Performance, Allocation\nL3: Each holding → Detail, History, Documents\n\nOpen question: should Alerts live at L1 or as a persistent overlay?" },
  { name: "Component inventory", status: "in-progress", agent: "Design Builder",
    preview: "IN PROGRESS — 44 patterns identified, 28 specced\n\nCompleted: Card, DataTable, MiniChart, StatBlock, NavRail, TopBar, Badge, Avatar, Tooltip\nIn progress: PortfolioRow, AllocationRing, ActivityFeed\nQueued: AlertBanner, EmptyState, OnboardingFlow, FilterBar, DatePicker" },
  { name: "Microcopy — empty states", status: "draft", agent: "Content Writer",
    preview: "DRAFT — 6 empty states written\n\nPortfolio (no holdings): \"Your portfolio is ready. Add your first holding to start tracking.\"\nActivity (no transactions): \"No activity yet. Transactions will appear here as they happen.\"\nSearch (no results): \"Nothing matched. Try a different term or check your filters.\"\n\nTone: Direct, calm, never patronizing." },
];
