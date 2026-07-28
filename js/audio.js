/**
 * Audio engine for Complex Noise.
 *
 * Graph: source → Still EQ (3× BiquadFilter) → Analyser → Gain → destination
 *
 * Responsibilities:
 * - Create / resume AudioContext
 * - Build and maintain the permanent EQ + analyser + gain chain
 * - Start / stop looping BufferSourceNodes
 * - Volume, EQ gain, sleep timer, Wake Lock
 *
 * ## State model (important for anyone wiring UI to this module)
 *
 * This module is the single source of truth for playback state. It never
 * touches the DOM. Instead it publishes an immutable snapshot to subscribers
 * whenever anything changes:
 *
 *     import { subscribe } from './audio.js';
 *     subscribe(state => renderMyUi(state));
 *
 * Always render from that snapshot rather than updating the UI at the call
 * site. Playback can stop without any click — the sleep timer does exactly
 * that — and call-site updates miss those transitions.
 */

import {
  FADE_TIME,
  TYPE_SWITCH_FADE_IN,
  TYPE_SWITCH_FADE_OUT,
  STORAGE_KEYS,
  NOISE_TYPES,
  DEFAULTS,
  EQ_MIN_DB,
  EQ_MAX_DB,
} from './constants.js';
import { write, writeThrottled, readNumber, readEnum, clamp } from './storage.js';
import { generateNoiseBuffer } from './noise.js';

// --- Module-private audio nodes ---
let audioCtx = null;
let gainNode = null;
let sourceNode = null;
let stillEqLowNode = null;
let stillEqMidNode = null;
let stillEqHighNode = null;
let analyser = null;

// --- Module-private state (restored from storage) ---
let currentType = readEnum(STORAGE_KEYS.type, NOISE_TYPES, DEFAULTS.type);
let currentVolume = clamp(readNumber(STORAGE_KEYS.volume, DEFAULTS.volume), 0, 1);
let timerHours = Math.max(0, readNumber(STORAGE_KEYS.timer, DEFAULTS.timerHours));
let isPlaying = false;
let statusText = 'Ready';

// EQ state (dB)
let stillEqLow = clampEq(readNumber(STORAGE_KEYS.stillEqLow, DEFAULTS.eq));
let stillEqMid = clampEq(readNumber(STORAGE_KEYS.stillEqMid, DEFAULTS.eq));
let stillEqHigh = clampEq(readNumber(STORAGE_KEYS.stillEqHigh, DEFAULTS.eq));

// Pending async work that must be cancellable
let timerId = null;           // sleep timer
let fadeOutTimerId = null;    // teardown scheduled after a fade-out
let fadingSourceNode = null;  // source still audible during a fade-out
let typeSwitchTimerId = null; // delayed source replacement during a colour dip
let wakeLock = null;

function clampEq(v) {
  return clamp(v, EQ_MIN_DB, EQ_MAX_DB);
}

// ----------------------------------------------------------
// Subscriptions
// ----------------------------------------------------------
const listeners = new Set();

/**
 * Current playback state. Treat the returned object as read-only.
 * @returns {{isPlaying: boolean, type: string, volume: number, timerHours: number, status: string}}
 */
export function getState() {
  return {
    isPlaying,
    type: currentType,
    volume: currentVolume,
    timerHours,
    status: statusText,
  };
}

/**
 * Subscribe to playback state changes. The callback fires immediately with the
 * current state so callers never need a separate initial render.
 * @param {(state: ReturnType<typeof getState>) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  listeners.add(fn);
  fn(getState());
  return () => listeners.delete(fn);
}

function emit() {
  const snapshot = getState();
  listeners.forEach(fn => fn(snapshot));
}

function setStatus(text) {
  statusText = text;
  emit();
}

/** Title-case a noise type for status text: "brown" → "Brown". */
function label(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ----------------------------------------------------------
// Read-only accessors used by other modules
// ----------------------------------------------------------

/** @returns {boolean} */
export function getIsPlaying() {
  return isPlaying;
}

/** @returns {string} */
export function getCurrentType() {
  return currentType;
}

/** @returns {number} 0–1 */
export function getCurrentVolume() {
  return currentVolume;
}

/** @returns {{low: number, mid: number, high: number}} gains in dB */
export function getStillEqValues() {
  return { low: stillEqLow, mid: stillEqMid, high: stillEqHigh };
}

/** @returns {number} sleep timer in hours, 0 = off */
export function getTimerHours() {
  return timerHours;
}

/** @returns {AnalyserNode|null} null until the first play() */
export function getAnalyser() {
  return analyser;
}

/** @returns {AudioContext|null} null until the first play() */
export function getAudioContext() {
  return audioCtx;
}

// ----------------------------------------------------------
// Graph construction
// ----------------------------------------------------------

/**
 * Ensure AudioContext and the permanent node chain exist and are running.
 * Must be called from a user gesture the first time (browser autoplay policy).
 */
async function ensureAudio() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio API is not available in this browser');
    audioCtx = new Ctor();

    // Still EQ nodes
    stillEqLowNode = audioCtx.createBiquadFilter();
    stillEqLowNode.type = 'lowshelf';
    stillEqLowNode.frequency.value = 220;
    stillEqLowNode.gain.value = stillEqLow;

    stillEqMidNode = audioCtx.createBiquadFilter();
    stillEqMidNode.type = 'peaking';
    stillEqMidNode.frequency.value = 1000;
    stillEqMidNode.Q.value = 0.85;
    stillEqMidNode.gain.value = stillEqMid;

    stillEqHighNode = audioCtx.createBiquadFilter();
    stillEqHighNode.type = 'highshelf';
    stillEqHighNode.frequency.value = 3500;
    stillEqHighNode.gain.value = stillEqHigh;

    // Analyser for Still Field. Sits before the gain node on purpose: the
    // visualisation should reflect the noise itself, not the listening volume.
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    // Gain
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;

    // Permanent chain: EQ → analyser → gain → dest
    stillEqLowNode.connect(stillEqMidNode);
    stillEqMidNode.connect(stillEqHighNode);
    stillEqHighNode.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

/** Tear down the current source node immediately. */
function disposeSource(node) {
  if (!node) return;
  try { node.stop(); } catch (err) { /* already stopped */ }
  try { node.disconnect(); } catch (err) { /* already disconnected */ }
}

function startSource() {
  disposeSource(sourceNode);
  const buffer = generateNoiseBuffer(audioCtx, currentType);
  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.loop = true;
  // Connect into the Still EQ head
  sourceNode.connect(stillEqLowNode);
  sourceNode.start();
}

/**
 * Cancel a teardown scheduled by a previous fade-out and dispose the node it
 * was going to clean up. Without disposing here, a play() during a fade would
 * leave the old source running forever on top of the new one.
 */
function cancelPendingFadeOut() {
  if (fadeOutTimerId) {
    clearTimeout(fadeOutTimerId);
    fadeOutTimerId = null;
  }
  if (fadingSourceNode) {
    disposeSource(fadingSourceNode);
    fadingSourceNode = null;
  }
}

/**
 * Cancel a delayed colour replacement.
 *
 * Type changes are intentionally delayed until the gain dip reaches zero. The
 * timeout must be coalesced when buttons are pressed quickly, and cancelled by
 * transport changes, or stale work can replace a newly resumed source.
 */
function cancelPendingTypeSwitch() {
  if (typeSwitchTimerId) {
    clearTimeout(typeSwitchTimerId);
    typeSwitchTimerId = null;
  }
}

// ----------------------------------------------------------
// Transport
// ----------------------------------------------------------

/**
 * Start playback with a fade-in. Safe to call while a previous fade-out is
 * still running — the pending teardown is cancelled first.
 * @returns {Promise<void>} rejects if the AudioContext cannot be created/resumed
 */
export async function play() {
  // A pause started less than FADE_TIME ago has a teardown queued that would
  // otherwise stop the source we are about to create.
  cancelPendingFadeOut();
  cancelPendingTypeSwitch();

  try {
    await ensureAudio();
  } catch (err) {
    setStatus('Audio unavailable on this device');
    throw err;
  }

  startSource();

  const now = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(currentVolume, now + FADE_TIME);

  isPlaying = true;
  setStatus(`${label(currentType)} noise playing`);

  requestWakeLock();
  scheduleTimer(); // may replace the status with the timer confirmation
}

/**
 * Stop playback.
 * @param {boolean} [fade=true] ramp the gain down over FADE_TIME first
 * @param {string} [endStatus='Paused'] status shown once the fade completes
 */
export function stop(fade = true, endStatus = 'Paused') {
  if (!audioCtx || !isPlaying) return;

  cancelPendingTypeSwitch();
  cancelPendingFadeOut();
  const now = audioCtx.currentTime;

  if (fade) {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + FADE_TIME);

    // Hand the node to `fadingSourceNode` so a play() during the fade can
    // dispose it explicitly instead of this timeout tearing down the new one.
    fadingSourceNode = sourceNode;
    sourceNode = null;
    fadeOutTimerId = setTimeout(() => {
      fadeOutTimerId = null;
      disposeSource(fadingSourceNode);
      fadingSourceNode = null;
    }, FADE_TIME * 1000 + 50);
  } else {
    disposeSource(sourceNode);
    sourceNode = null;
    gainNode.gain.value = 0;
  }

  isPlaying = false;
  clearTimer();
  releaseWakeLock();
  setStatus(endStatus);
}

/**
 * Change noise type. If currently playing, cross-fades to the new buffer.
 * Unknown names are ignored rather than throwing, so a stale button or a stale
 * persisted value cannot stop playback.
 * @param {string} type one of NOISE_TYPES
 */
export function setType(type) {
  if (type === currentType) return;
  if (!NOISE_TYPES.includes(type)) return;

  // Only the final click matters. Without this, each quick click builds a full
  // 12 s buffer and a stale timeout can replace a source created by play().
  cancelPendingTypeSwitch();
  currentType = type;
  write(STORAGE_KEYS.type, type);

  if (!isPlaying) {
    emit();
    return;
  }

  const now = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(0, now + TYPE_SWITCH_FADE_OUT);

  typeSwitchTimerId = setTimeout(() => {
    typeSwitchTimerId = null;
    // The user may have paused during the 160 ms dip.
    if (!isPlaying) return;
    startSource();
    gainNode.gain.linearRampToValueAtTime(
      currentVolume,
      audioCtx.currentTime + TYPE_SWITCH_FADE_IN,
    );
    setStatus(`${label(currentType)} noise playing`);
  }, TYPE_SWITCH_FADE_OUT * 1000 + 10);

  emit();
}

/**
 * Set master volume. Persists and ramps if playing.
 * @param {number} v 0–1
 */
export function setVolume(v) {
  currentVolume = clamp(v, 0, 1);
  writeThrottled(STORAGE_KEYS.volume, currentVolume);
  if (isPlaying && gainNode) {
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(currentVolume, now + 0.05);
  }
  emit();
}

// ----------------------------------------------------------
// Still EQ
// ----------------------------------------------------------

function setEqBand(node, key, v) {
  const gain = clampEq(v);
  write(key, gain);
  if (node) node.gain.value = gain;
  return gain;
}

/** @param {number} v gain in dB (−12…12) */
export function setStillEqLow(v) {
  stillEqLow = setEqBand(stillEqLowNode, STORAGE_KEYS.stillEqLow, v);
}

/** @param {number} v gain in dB (−12…12) */
export function setStillEqMid(v) {
  stillEqMid = setEqBand(stillEqMidNode, STORAGE_KEYS.stillEqMid, v);
}

/** @param {number} v gain in dB (−12…12) */
export function setStillEqHigh(v) {
  stillEqHigh = setEqBand(stillEqHighNode, STORAGE_KEYS.stillEqHigh, v);
}

// ----------------------------------------------------------
// Sleep timer
// ----------------------------------------------------------

/**
 * Set the sleep timer. Takes effect immediately when playing.
 * @param {number|string} hours 0 = off
 */
export function setTimerHours(hours) {
  timerHours = Math.max(0, parseFloat(hours) || 0);
  // Persist the *parsed* value, not the argument. The slider hands over a
  // string, and anything unparseable used to be stored verbatim while the
  // engine ran on the 0 it fell back to — so the control and the sound
  // disagreed on the next load.
  writeThrottled(STORAGE_KEYS.timer, timerHours);
  if (isPlaying) scheduleTimer();
  else emit();
}

/**
 * Wall-clock instant the current timer is due, or 0 when no timer is armed.
 *
 * The timer is the one promise this app makes that a user is asleep for, and
 * `setTimeout` is not a promise about when anything happens. A backgrounded tab
 * has its timers throttled to once a minute, and a suspended phone does not run
 * them at all — a one-hour timer on a locked handset can come back minutes or
 * hours late, still playing. Wall-clock time is what "stop in an hour" means, so
 * that is what the deadline is stored in, and `setTimeout` is demoted to a hint
 * that gets re-checked and re-armed whenever the page comes back.
 */
let timerEndsAt = 0;

function scheduleTimer() {
  clearTimer();
  if (timerHours <= 0) return;

  timerEndsAt = Date.now() + timerHours * 3600 * 1000;
  armTimer(timerHours * 3600 * 1000);
  setStatus(`Playing · timer ${timerHours}h`);
}

function armTimer(ms) {
  if (timerId) clearTimeout(timerId);
  timerId = setTimeout(() => {
    timerId = null;
    // Trust the deadline over the timer that woke us. A throttled timeout can
    // fire early as well as late, and re-arming for the remainder is both the
    // correction and the retry.
    if (Date.now() >= timerEndsAt) stop(true, 'Sleep timer ended');
    else armTimer(timerEndsAt - Date.now());
  }, Math.max(0, ms));
}

/**
 * Re-check the deadline against the wall clock. Called when the page becomes
 * visible again, which is the moment a suspended device gets to notice that the
 * hour the user asked for elapsed while it was asleep.
 */
function checkTimerDeadline() {
  if (!isPlaying || timerEndsAt === 0) return;
  const remaining = timerEndsAt - Date.now();
  if (remaining <= 0) stop(true, 'Sleep timer ended');
  else armTimer(remaining);
}

function clearTimer() {
  timerEndsAt = 0;
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
}

/**
 * Milliseconds until the sleep timer fires, or 0 when none is armed. Exposed for
 * the smoke tests, which cannot wait an hour to find out whether the deadline
 * survived a simulated suspend.
 * @returns {number}
 */
export function getTimerRemainingMs() {
  return timerEndsAt === 0 ? 0 : Math.max(0, timerEndsAt - Date.now());
}

// ----------------------------------------------------------
// Wake Lock — keeps the screen alive during a session where supported
// ----------------------------------------------------------

/**
 * Acquire the screen wake lock, if playback is still wanted by the time the
 * browser grants it.
 *
 * `navigator.wakeLock.request()` is asynchronous, and the gap matters: pressing
 * play and then pause inside it used to leave the lock held forever. `stop()`
 * ran `releaseWakeLock()` while `wakeLock` was still null, the request then
 * resolved into that null and installed itself, and nothing ever released it —
 * so the phone's screen stayed lit all night over silent audio. That is the
 * worst possible failure for this app: the one thing worse than the noise
 * stopping is the battery going with it.
 *
 * Hence the re-check after the await, and the `pending` guard so two overlapping
 * requests cannot orphan the first lock by overwriting the handle.
 */
let wakeLockPending = false;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  if (wakeLock || wakeLockPending) return;

  wakeLockPending = true;
  let lock = null;
  try {
    lock = await navigator.wakeLock.request('screen');
  } catch (err) {
    // Not supported, or denied because the document was not visible.
    return;
  } finally {
    wakeLockPending = false;
  }

  // Playback may have stopped while the request was in flight.
  if (!isPlaying) {
    Promise.resolve(lock.release()).catch(() => {});
    return;
  }

  wakeLock = lock;
  // The browser drops the lock when the page is hidden; forget our handle so
  // the visibilitychange listener below re-acquires a fresh one. Compared by
  // identity so a stale lock's late release event cannot clear a newer one.
  lock.addEventListener?.('release', () => {
    if (wakeLock === lock) wakeLock = null;
  });
}

function releaseWakeLock() {
  if (!wakeLock) return;
  const lock = wakeLock;
  wakeLock = null;
  // release() returns a promise that rejects if the lock is already gone.
  Promise.resolve(lock.release()).catch(() => {});
}

// Re-acquire the wake lock when the tab becomes visible again while playing,
// and take the opportunity to check whether the sleep timer came due while the
// device was asleep.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (isPlaying && !wakeLock) requestWakeLock();
  checkTimerDeadline();
});
