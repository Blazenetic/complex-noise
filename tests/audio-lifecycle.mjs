/** Deterministic transport races with a fake context, not browser/audio proof. */
/* global EventTarget */
import test from 'node:test';
import assert from 'node:assert/strict';

let instance;
let deferResume = false;
class FakeContext extends EventTarget {
  constructor(options) {
    super();
    instance = this;
    this.options = options;
    this.state = 'suspended';
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.baseLatency = 0.02;
    this.outputLatency = 0.03;
    this.buffers = 0;
    this.sources = [];
    this.resumeCalls = 0;
    this.fail = null;
    this.ramps = [];
  }
  changeState(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
  resume() {
    this.resumeCalls++;
    return new Promise(resolve => {
      this.finishResume = (notify = true) => {
        if (notify) this.changeState('running');
        else this.state = 'running';
        resolve();
      };
      if (!deferResume) this.finishResume();
    });
  }
  createBiquadFilter() {
    return { frequency: {}, gain: {}, Q: {}, connect() {} };
  }
  createAnalyser() { return { connect() {} }; }
  createGain() {
    const context = this;
    return { connect() {}, gain: { value: 0, cancelScheduledValues() {},
      setValueAtTime() {}, linearRampToValueAtTime(value) { context.ramps.push(value); } } };
  }
  createBuffer(channels, length) {
    if (this.fail === 'buffer') throw new Error('buffer');
    this.buffers++;
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource() {
    if (this.fail === 'create') throw new Error('create');
    const context = this;
    const source = { stopped: false, disconnected: false,
      connect() { if (context.fail === 'connect') throw new Error('connect'); },
      disconnect() { this.disconnected = true; },
      start() { if (context.fail === 'start') throw new Error('start'); },
      stop() { this.stopped = true; } };
    this.sources.push(source);
    return source;
  }
}

async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('condition timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

let serial = 0;
async function freshAudio() {
  globalThis.window = { AudioContext: FakeContext, addEventListener() {} };
  globalThis.document = new EventTarget();
  document.visibilityState = 'visible';
  deferResume = false;
  const audio = await import(`../js/audio.js?test=${serial++}`);
  audio.setTimerHours(0);
  audio.setType('brown');
  return audio;
}

test('stop cancels an unresolved first play without creating a source', async () => {
  const audio = await freshAudio();
  deferResume = true;
  const pending = audio.play();
  audio.stop(false);
  instance.finishResume();
  await pending;
  assert.equal(audio.getIsPlaying(), false);
  assert.equal(instance.buffers, 0);
  assert.equal(instance.options.latencyHint, 'playback');
});

test('repeated play preserves source and sleep deadline', async () => {
  const audio = await freshAudio();
  audio.setTimerHours(1);
  await audio.play();
  const before = audio.getTimerRemainingMs();
  await audio.play();
  assert.equal(instance.buffers, 1);
  assert.ok(audio.getTimerRemainingMs() <= before);
  audio.stop(false);
});

test('visibility resumes an interrupted context without rerolling noise', async () => {
  const audio = await freshAudio();
  await audio.play();
  instance.changeState('interrupted');
  assert.match(audio.getState().status, /interrupted/);
  document.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  assert.equal(instance.state, 'running');
  assert.equal(instance.buffers, 1);
  assert.match(audio.getState().status, /playing/);
  audio.stop(false);
});

test('pending recovery cannot revive a stopped source', async () => {
  const audio = await freshAudio();
  await audio.play();
  instance.changeState('suspended');
  deferResume = true;
  document.dispatchEvent(new Event('visibilitychange'));
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(instance.resumeCalls, 2, 'one initial and one coalesced recovery');
  audio.stop(false);
  instance.finishResume();
  await Promise.resolve();
  assert.equal(audio.getIsPlaying(), false);
  assert.ok(instance.sources.every(source => source.stopped));
});

test('expired sleep timer wins over visibility recovery', async () => {
  const audio = await freshAudio();
  audio.setTimerHours(1);
  await audio.play();
  instance.changeState('suspended');
  const now = Date.now;
  Date.now = () => now() + 3601000;
  try { document.dispatchEvent(new Event('visibilitychange')); }
  finally { Date.now = now; }
  assert.equal(audio.getIsPlaying(), false);
  assert.equal(instance.resumeCalls, 1, 'expired sessions must not resume');
  assert.equal(audio.getState().status, 'Sleep timer ended');
});

test('deadline expires during deferred recovery before playing is published', async () => {
  for (const notify of [false, true]) {
    const audio = await freshAudio();
    audio.setTimerHours(1);
    await audio.play();
    instance.changeState('interrupted');
    deferResume = true;
    const statuses = [];
    audio.subscribe(state => statuses.push(state.status));
    document.dispatchEvent(new Event('visibilitychange'));
    const now = Date.now;
    Date.now = () => now() + 3601000;
    try {
      instance.finishResume(notify);
      await Promise.resolve();
      assert.equal(audio.getIsPlaying(), false, `notify=${notify}`);
      assert.equal(audio.getState().status, 'Sleep timer ended');
      assert.equal(audio.getTimerRemainingMs(), 0);
      assert.ok(!statuses.some(status => /playing/i.test(status)), 'must not publish playing');
      assert.equal(instance.sources[0].stopped, false, 'timer stop retains fade semantics');
    } finally {
      Date.now = now;
      audio.stop(false);
    }
  }
});

test('diagnostics are bounded and detached and do not claim output capture', async () => {
  const audio = await freshAudio();
  await audio.play();
  for (let i = 0; i < 50; i++) instance.changeState('running');
  const snapshot = audio.getPlaybackDiagnostics();
  assert.equal(snapshot.events.length, 32);
  snapshot.events[0].event = 'tampered';
  assert.equal(audio.getPlaybackDiagnostics().events[0].event, 'context-state');
  assert.equal(snapshot.sampleRate, 48000);
  audio.stop(false);
});

test('source failures preserve the old loop and timer and allow a retry', async () => {
  for (const fault of ['buffer', 'create', 'connect', 'start']) {
    const audio = await freshAudio();
    audio.setTimerHours(1);
    await audio.play();
    const previous = instance.sources[0];
    const remaining = audio.getTimerRemainingMs();
    instance.fail = fault;
    audio.setType('white');
    await until(() => /failed/.test(audio.getState().status));
    assert.equal(audio.getState().type, 'brown', fault);
    assert.equal(audio.getIsPlaying(), true, fault);
    assert.equal(previous.stopped, false, fault);
    assert.equal(previous.disconnected, false, fault);
    assert.ok(audio.getTimerRemainingMs() > 0 && audio.getTimerRemainingMs() <= remaining, fault);
    assert.equal(instance.ramps.at(-1), audio.getCurrentVolume(), fault);
    if (fault === 'connect' || fault === 'start') {
      assert.equal(instance.sources[1].stopped, true, fault);
      assert.equal(instance.sources[1].disconnected, true, fault);
    }
    instance.fail = null;
    audio.setType('white');
    await until(() => previous.stopped);
    assert.equal(previous.stopped, true, fault);
    audio.stop(false);
  }
});

test('timer and switch status follow the active deadline and interruption', async () => {
  const audio = await freshAudio();
  const snapshots = [];
  audio.subscribe(state => snapshots.push(state));
  audio.setTimerHours(1);
  await audio.play();
  const remaining = audio.getTimerRemainingMs();
  const previous = instance.sources[0];
  audio.setType('white');
  await until(() => previous.stopped);
  assert.match(audio.getState().status, /timer 1h/);
  assert.ok(audio.getTimerRemainingMs() <= remaining && audio.getTimerRemainingMs() > 0);
  audio.setTimerHours(0);
  assert.equal(audio.getTimerRemainingMs(), 0);
  assert.equal(snapshots.at(-1).timerHours, 0);
  assert.equal(snapshots.at(-1).status, 'White noise playing');
  instance.changeState('interrupted');
  audio.setTimerHours(1);
  assert.match(snapshots.at(-1).status, /interrupted/);
  instance.fail = 'buffer';
  audio.setType('pink');
  await until(() => audio.getPlaybackDiagnostics().events.some(e => e.event === 'source-switch-failed'));
  assert.match(audio.getState().status, /interrupted/);
  instance.changeState('running');
  assert.match(audio.getState().status, /Colour change failed/);
  audio.setTimerHours(0);
  assert.match(snapshots.at(-1).status, /Colour change failed/);
  audio.stop(false);
});

test('initial source failures remain stopped and can be retried', async () => {
  for (const fault of ['buffer', 'create', 'connect', 'start']) {
    const audio = await freshAudio();
    // Initialise the context without creating a source.
    deferResume = true;
    const pending = audio.play();
    instance.fail = fault;
    instance.finishResume();
    await assert.rejects(pending, new RegExp(fault));
    assert.equal(audio.getIsPlaying(), false, fault);
    assert.match(audio.getState().status, /press play to retry/);
    assert.equal(audio.getTimerRemainingMs(), 0);
    if (instance.sources.length) {
      assert.equal(instance.sources[0].stopped, true);
      assert.equal(instance.sources[0].disconnected, true);
    }
    instance.fail = null;
    await audio.play();
    assert.equal(audio.getIsPlaying(), true);
    audio.stop(false);
  }
});
