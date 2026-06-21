// Tracks open approval gates and lets an external surface (the OWL-1 UI, an HTTP
// client, or a test) resolve them. This is the bridge between the runner's
// canUseTool callback (which awaits a decision) and the UI's APPROVE button
// (which supplies one).

let _counter = 0;

export class GateController {
  constructor() {
    this.open = new Map(); // gateId -> { resolve, meta }
  }

  // Called from canUseTool when a dispatch needs human approval.
  // Returns { id, decision } where `decision` is a Promise that resolves when
  // the UI sends a command. The runner awaits that promise — i.e. it BLOCKS here.
  request(meta) {
    const id = `gate_${++_counter}`;
    let resolve;
    const decision = new Promise((r) => {
      resolve = r;
    });
    this.open.set(id, { resolve, meta });
    return { id, decision };
  }

  // Called by the UI/test via an OAP command. `decision` is e.g.
  //   { action: 'approve' }
  //   { action: 'skip', note }
  //   { action: 'redirect', toAgentId }
  //   { action: 'correct' | 'add', note }
  resolve(id, decision) {
    const entry = this.open.get(id);
    if (!entry) return false;
    this.open.delete(id);
    entry.resolve(decision);
    return true;
  }

  list() {
    return [...this.open.entries()].map(([id, e]) => ({ id, ...e.meta }));
  }
}
