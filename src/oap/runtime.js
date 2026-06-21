// Module-level live runtime singleton.
//
// The OWL-1 prototype derives every agent's activity from a sine curve at ~12 call
// sites scattered across components that don't share state. Rather than prop-drill a
// store through all of them, the live integration writes the current per-agent
// activity into this singleton, and the prototype's getAgentActivity() reads it.
//
// When `active` is false, the prototype falls back to the original simulation, so the
// standalone prototype is byte-for-byte unchanged unless a live source is connected.

export const liveRuntime = {
  active: false, // true only when a live OAP source is connected
  mode: 'stop', // mapped to OWL-1 pipelineMode: playing | recording | stopped
  stage: null,
  agents: {}, // owlId -> { activity, status, waiting }
};

export function setLiveRuntime(patch) {
  Object.assign(liveRuntime, patch);
}

export function resetLiveRuntime() {
  liveRuntime.active = false;
  liveRuntime.mode = 'stop';
  liveRuntime.stage = null;
  liveRuntime.agents = {};
}
