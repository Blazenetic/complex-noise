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
 * Exposes a small surface so still-field.js and app.js can query state
 * without owning the AudioContext.
 */

import { FADE_TIME, STORAGE_KEYS } from './constants.js';
import { generateNoiseBuffer } from './noise.js';

// --- Module-private audio nodes & state ---
let audioCtx = null;
let gainNode = null;
let sourceNode = null;
let stillEqLowNode = null;
let stillEqMidNode = null;
let stillEqHighNode = null;
let analyser = null;

let currentType = localStorage.getItem(STORAGE_KEYS.type) || 'brown';
let currentVolume = parseFloat(localStorage.getItem(STORAGE_KEYS.volume)) || 0.4;
let isPlaying = false;
let timerId = null;
let wakeLock = null;

// EQ state (dB)
let stillEqLow = parseFloat(localStorage.getItem(STORAGE_KEYS.stillEqLow)) || 0;
let stillEqMid = parseFloat(localStorage.getItem(STORAGE_KEYS.stillEqMid)) || 0;
let stillEqHigh = parseFloat(localStorage.getItem(STORAGE_KEYS.stillEqHigh)) || 0;

/** @returns {boolean} */
export function getIsPlaying() {
  return isPlaying;
}

/** @returns {string} */
export function getCurrentType() {
  return currentType;
}

/** @returns {AnalyserNode|null} */
export function getAnalyser() {
  return analyser;
}

/** @returns {AudioContext|null} */
export function getAudioContext() {
  return audioCtx;
}

/**
 * Ensure AudioContext and the permanent node chain exist and are running.
 */
async function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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

    // Analyser for Still Field
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

function startSource() {
  if (sourceNode) {
    try { sourceNode.stop(); } catch (e) {}
    sourceNode.disconnect();
  }
  const buffer = generateNoiseBuffer(audioCtx, currentType);
  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.loop = true;
  // Connect into the Still EQ head
  sourceNode.connect(stillEqLowNode);
  sourceNode.start();
}

/**
 * Start playback with fade-in.
 * @param {() => void} [onStatus] optional callback to update UI status text
 */
export async function play(onStatus) {
  await ensureAudio();
  startSource();

  const now = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(currentVolume, now + FADE_TIME);

  isPlaying = true;
  if (onStatus) onStatus(`${currentType.charAt(0).toUpperCase() + currentType.slice(1)} noise playing`);

  requestWakeLock();
  scheduleTimer(onStatus);
}

/**
 * Stop playback with optional fade-out.
 * @param {boolean} [fade=true]
 * @param {() => void} [onStatus]
 */
export function stop(fade = true, onStatus) {
  if (!audioCtx || !isPlaying) return;

  const now = audioCtx.currentTime;
  if (fade) {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + FADE_TIME);
    setTimeout(() => {
      if (sourceNode) {
        try { sourceNode.stop(); } catch (e) {}
        sourceNode.disconnect();
        sourceNode = null;
      }
    }, FADE_TIME * 1000 + 50);
  } else {
    if (sourceNode) {
      try { sourceNode.stop(); } catch (e) {}
      sourceNode.disconnect();
      sourceNode = null;
    }
    gainNode.gain.value = 0;
  }

  isPlaying = false;
  if (onStatus) onStatus('Paused');
  clearTimer();
  releaseWakeLock();
}

/**
 * Change noise type. If currently playing, cross-fades to the new buffer.
 * @param {string} type
 * @param {(label: string) => void} [onStatus]
 */
export function setType(type, onStatus) {
  if (type === currentType) return;
  currentType = type;
  localStorage.setItem(STORAGE_KEYS.type, type);

  if (isPlaying) {
    const now = audioCtx.currentTime;
    gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
    setTimeout(() => {
      startSource();
      gainNode.gain.linearRampToValueAtTime(currentVolume, audioCtx.currentTime + 0.25);
      if (onStatus) onStatus(`${type.charAt(0).toUpperCase() + type.slice(1)} noise playing`);
    }, 160);
  }
}

/**
 * Set master volume (0–1). Persists and ramps if playing.
 * @param {number} v
 */
export function setVolume(v) {
  currentVolume = v;
  localStorage.setItem(STORAGE_KEYS.volume, v);
  if (isPlaying && gainNode) {
    gainNode.gain.linearRampToValueAtTime(v, audioCtx.currentTime + 0.05);
  }
}

export function setStillEqLow(v) {
  stillEqLow = v;
  localStorage.setItem(STORAGE_KEYS.stillEqLow, v);
  if (stillEqLowNode) stillEqLowNode.gain.value = v;
}

export function setStillEqMid(v) {
  stillEqMid = v;
  localStorage.setItem(STORAGE_KEYS.stillEqMid, v);
  if (stillEqMidNode) stillEqMidNode.gain.value = v;
}

export function setStillEqHigh(v) {
  stillEqHigh = v;
  localStorage.setItem(STORAGE_KEYS.stillEqHigh, v);
  if (stillEqHighNode) stillEqHighNode.gain.value = v;
}

export function getStillEqValues() {
  return { low: stillEqLow, mid: stillEqMid, high: stillEqHigh };
}

export function getCurrentVolume() {
  return currentVolume;
}

// ----------------------------------------------------------
// Sleep timer
// ----------------------------------------------------------
let timerSelectValue = localStorage.getItem(STORAGE_KEYS.timer) || '0';

export function setTimerHours(hours) {
  timerSelectValue = String(hours);
  localStorage.setItem(STORAGE_KEYS.timer, timerSelectValue);
  if (isPlaying) scheduleTimer();
}

function scheduleTimer(onStatus) {
  clearTimer();
  const hours = parseFloat(timerSelectValue);
  if (hours <= 0) return;

  const ms = hours * 3600 * 1000;
  timerId = setTimeout(() => {
    if (onStatus) onStatus('Timer ended — fading out…');
    stop(true, onStatus);
  }, ms);

  if (onStatus) onStatus(`Playing · timer ${hours}h`);
}

function clearTimer() {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
}

// ----------------------------------------------------------
// Wake Lock
// ----------------------------------------------------------
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    // ignore — not all browsers / contexts support it
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

// Re-acquire wake lock when tab becomes visible again while playing
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isPlaying) {
    requestWakeLock();
  }
});
