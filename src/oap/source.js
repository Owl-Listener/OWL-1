// OAP event sources. Each returns a uniform { subscribe, close } interface so the
// hook doesn't care whether events arrive over the network or from a replay buffer.

// Live source: Server-Sent Events from the OAP relay (e.g. spike/oap-gate/server.mjs
// or the real Designpowers backend). Browser-only (uses EventSource).
export function createSseSource(url) {
  let es = null;
  return {
    subscribe(onEnvelope) {
      es = new EventSource(url);
      es.onmessage = (m) => {
        try {
          onEnvelope(JSON.parse(m.data));
        } catch {
          /* ignore malformed frame */
        }
      };
      return () => es && es.close();
    },
    close() {
      if (es) es.close();
    },
  };
}

// Replay source: feed a captured array of envelopes on a timer. Lets the UI run a
// live-shaped demo with no server (useful for offline preview / tests).
export function createReplaySource(envelopes, intervalMs = 400) {
  let timer = null;
  return {
    subscribe(onEnvelope) {
      let i = 0;
      timer = setInterval(() => {
        if (i >= envelopes.length) {
          clearInterval(timer);
          return;
        }
        onEnvelope(envelopes[i++]);
      }, intervalMs);
      return () => clearInterval(timer);
    },
    close() {
      if (timer) clearInterval(timer);
    },
  };
}
