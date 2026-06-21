// OWL Agent Protocol — frontend layer barrel.
// Implements a slice of docs/owl-agent-protocol.md so OWL-1 can run on a real
// agent swarm's event stream instead of the built-in sine-curve simulation.

export { initialOapState, oapReduce, oapReduceAll } from './reducer.js';
export { OWL_ID_BY_OAP, OAP_ID_BY_OWL, owlIdFor, oapIdFor, activityForStatus, deriveOwlAgents } from './agentMap.js';
export { liveRuntime, setLiveRuntime, resetLiveRuntime } from './runtime.js';
export { createSseSource, createReplaySource, postCommand } from './source.js';
export { useOapRuntime } from './useOapRuntime.js';
