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
    return { connect() {}, gain: { value: 0, cancelScheduledValues() {},
      setValueAtTime() {}, linearRampToValueAtTime() {} } };
  }
  createBuffer(channels, length) {
    this.buffers++;
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource() {
    const source = { stopped: false, connect() {}, disconnect() {}, start() {},
      stop() { this.stopped = true; } };
    this.sources.push(source);
    return source;
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
