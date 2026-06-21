// React hook that connects an OAP source, reduces the event stream, and publishes
// the result to both React state (for components that take props) and the
// liveRuntime singleton (for the prototype's scattered getAgentActivity call sites).

import { useEffect, useState } from 'react';
import { initialOapState, oapReduce } from './reducer.js';
import { deriveOwlAgents } from './agentMap.js';
import { createSseSource } from './source.js';
import { setLiveRuntime, resetLiveRuntime } from './runtime.js';

// Map OAP transport mode -> OWL-1 pipelineMode.
const PIPELINE_MODE = { auto: 'playing', human: 'recording', stop: 'stopped' };

export function useOapRuntime({ enabled = false, url = '/events', source = null } = {}) {
  const [oapState, setOapState] = useState(initialOapState);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      resetLiveRuntime();
      return;
    }
    const src = source || createSseSource(url);
    let unsub = () => {};
    try {
      unsub = src.subscribe((env) => {
        setConnected(true);
        setOapState((prev) => oapReduce(prev, env));
      });
    } catch {
      /* EventSource unavailable (e.g. SSR) — stay in fallback */
    }
    return () => {
      unsub();
      src.close && src.close();
      resetLiveRuntime();
      setConnected(false);
    };
  }, [enabled, url, source]);

  // Publish to the singleton whenever reduced state changes.
  useEffect(() => {
    if (!enabled) return;
    setLiveRuntime({
      active: connected,
      mode: PIPELINE_MODE[oapState.mode] || 'stopped',
      stage: oapState.stage,
      agents: deriveOwlAgents(oapState),
    });
  }, [enabled, connected, oapState]);

  return {
    enabled,
    connected,
    pipelineMode: PIPELINE_MODE[oapState.mode] || 'stopped',
    stage: oapState.stage,
    messages: oapState.messages,
    blockers: oapState.blockers,
    artifacts: oapState.artifacts,
    gates: oapState.gates,
    telemetry: oapState.telemetry,
    finished: oapState.finished,
    raw: oapState,
  };
}
