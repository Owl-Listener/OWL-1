// OWL Agent Protocol (OAP) — minimal session primitives for the gate spike.
// See docs/owl-agent-protocol.md for the full contract this implements a slice of.
//
// An OapSession is the single ordered event stream the UI consumes. Every event
// is wrapped in the OAP envelope { v, type, seq, ts, sessionId, payload }.

import { EventEmitter } from 'node:events';

export const OAP_VERSION = 1;

// Transport modes — OWL-1's pipelineMode, Designpowers' Direct/Auto.
export const Mode = { AUTO: 'auto', HUMAN: 'human', STOP: 'stop' };

// AgentStatus — replaces the prototype's getActivity()/getStatus() thresholds.
export const AgentStatus = {
  IDLE: 'idle',
  ONLINE: 'online',
  RUNNING: 'running',
  BLOCKED: 'blocked',
  AWAITING: 'awaiting',
  DONE: 'done',
  SKIPPED: 'skipped',
};

export class OapSession extends EventEmitter {
  constructor(sessionId) {
    super();
    this.sessionId = sessionId;
    this.seq = 0;
  }

  // Emit one OAP event. Returns the full envelope (handy for tests/logging).
  emitEvent(type, payload = {}) {
    const env = {
      v: OAP_VERSION,
      type,
      seq: ++this.seq,
      ts: new Date().toISOString(),
      sessionId: this.sessionId,
      payload,
    };
    this.emit('event', env);
    return env;
  }
}

let _msgCounter = 0;
export const nextMessageId = () => `msg_${++_msgCounter}`;
