/**
 * Still Field — full-page nodes + edges graph visualisation.
 *
 * Subtle silver/titanium (or warm grey) nodes connected by soft distance-based
 * edges. Slow calm drift, gently driven by AnalyserNode metrics from the audio
 * engine. Completely optional (defaults off).
 *
 * ## Contract
 *
 * This module owns exactly one DOM element: the canvas handed to
 * `initStillField()`. It never queries the document for anything else. UI
 * controls (the toggle switch, the intensity slider) are rendered by app.js
 * from the snapshot published via `subscribe()`.
 *
 * ## Performance notes — this app runs all night on a phone
 *
 * - O(n²) edge drawing is fine at n ≤ 34.
 * - Theme colours are read once per theme change, not once per frame;
 *   `getComputedStyle` forces a style recalculation and is far too expensive
 *   to call at 60 fps.
 * - `--still-energy` is only written when it moves perceptibly, because every
 *   write invalidates style for the whole document.
 */

import { STORAGE_KEYS, DEFAULTS } from './constants.js';
import { write, readNumber, readBool, clamp } from './storage.js';
import { getAnalyser, getIsPlaying } from './audio.js';
import { getStillTheme } from './theme.js';

// --- Persisted settings ---
let stillFieldEnabled = readBool(STORAGE_KEYS.stillFieldEnabled, DEFAULTS.stillFieldEnabled);
let stillFieldIntensity = clamp(
  readNumber(STORAGE_KEYS.stillFieldIntensity, DEFAULTS.stillFieldIntensity),
  0,
  1,
);

// --- Runtime ---
let stillFieldNodes = [];
let stillFieldRaf = null;
let stillEnergy = 0;          // 0–1 smoothed energy, mirrored to CSS --still-energy
let lastPublishedEnergy = -1; // last value actually written to the CSS variable

let stillFieldCanvas = null;
let stillFieldCtx = null;
let stillFieldW = 0;
let stillFieldH = 0;
let stillFieldDpr = 1;
let resizeDebounceId = null;

// Theme-derived colours, refreshed by refreshThemeColors()
let nodeColor = 'rgba(190,195,210,0.55)';
let edgeColor = 'rgba(160,165,180,0.22)';
let clearColor = 'rgba(12, 12, 17, 0.22)';
let edgeColorHasAlpha = true;

/** Energy must move by at least this much before we touch CSS again. */
const ENERGY_EPSILON = 0.002;

/** Debounce window for resize — mobile browsers fire it on every URL-bar nudge. */
const RESIZE_DEBOUNCE_MS = 150;

// ----------------------------------------------------------
// Subscriptions (mirrors the pattern in audio.js)
// ----------------------------------------------------------
const listeners = new Set();

/**
 * @returns {{enabled: boolean, intensity: number}}
 */
export function getState() {
  return { enabled: stillFieldEnabled, intensity: stillFieldIntensity };
}

/**
 * Subscribe to Still Field setting changes. Fires immediately with current state.
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

export function getStillFieldEnabled() {
  return stillFieldEnabled;
}

export function getStillFieldIntensity() {
  return stillFieldIntensity;
}

export function getStillEnergy() {
  return stillEnergy;
}

// ----------------------------------------------------------
// Setup
// ----------------------------------------------------------

/**
 * Call once after the DOM is ready.
 * @param {HTMLCanvasElement} canvas the full-viewport canvas this module owns
 */
export function initStillField(canvas) {
  stillFieldCanvas = canvas;
  stillFieldCtx = canvas.getContext('2d', { alpha: true });
  refreshThemeColors();
  resizeStillField();
  initStillFieldNodes();
  applyCanvasVisibility();
  if (stillFieldEnabled) startStillFieldLoop();
}

/**
 * Re-read theme colours from CSS custom properties. Call after a theme change;
 * doing this per frame would force a style recalculation every frame.
 */
export function refreshThemeColors() {
  const style = getComputedStyle(document.documentElement);
  nodeColor = style.getPropertyValue('--still-field-node').trim() || 'rgba(190,195,210,0.55)';
  edgeColor = style.getPropertyValue('--still-field-edge').trim() || 'rgba(160,165,180,0.22)';
  clearColor = getStillTheme() === 'bone'
    ? 'rgba(244, 240, 232, 0.28)'
    : 'rgba(12, 12, 17, 0.22)';
  // Only rgba()/hsla() strings can have their alpha rewritten per edge.
  edgeColorHasAlpha = /[\d.]+\s*\)$/.test(edgeColor) && /^(rgba|hsla)\(/i.test(edgeColor);
}

function applyCanvasVisibility() {
  if (!stillFieldCanvas) return;
  stillFieldCanvas.classList.toggle('still-field-off', !stillFieldEnabled);
}

function resizeStillField() {
  if (!stillFieldCanvas) return;
  const prevW = stillFieldW;
  const prevH = stillFieldH;

  stillFieldDpr = Math.min(window.devicePixelRatio || 1, 2);
  stillFieldW = window.innerWidth;
  stillFieldH = window.innerHeight;
  stillFieldCanvas.width = Math.floor(stillFieldW * stillFieldDpr);
  stillFieldCanvas.height = Math.floor(stillFieldH * stillFieldDpr);
  stillFieldCanvas.style.width = stillFieldW + 'px';
  stillFieldCanvas.style.height = stillFieldH + 'px';
  stillFieldCtx.setTransform(stillFieldDpr, 0, 0, stillFieldDpr, 0, 0);

  if (stillFieldNodes.length === 0) {
    initStillFieldNodes();
  } else if (prevW > 0 && prevH > 0) {
    // Rescale rather than re-seed: on phones the address bar shows/hides
    // constantly, and re-seeding would teleport every node mid-session.
    const sx = stillFieldW / prevW;
    const sy = stillFieldH / prevH;
    for (const n of stillFieldNodes) {
      n.x *= sx;
      n.y *= sy;
    }
  }
}

/**
 * (Re)seed nodes. `force = true` discards existing positions.
 * @param {boolean} [force=false]
 */
export function initStillFieldNodes(force = false) {
  if (stillFieldNodes.length && !force) return;
  // Conservative count for mid-range mobile — still enough for a living graph
  const count = Math.min(34, Math.max(22, Math.floor((stillFieldW * stillFieldH) / 28000)));
  stillFieldNodes = [];

  for (let i = 0; i < count; i++) {
    stillFieldNodes.push({
      x: Math.random() * stillFieldW,
      y: Math.random() * stillFieldH,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

// ----------------------------------------------------------
// Audio-reactive metrics
// ----------------------------------------------------------

// Reused across frames so the render loop allocates nothing.
let metricsBuffer = null;

/**
 * Frequency-band energy from the audio engine's analyser.
 * @returns {{low: number, mid: number, high: number, overall: number}} all 0–1
 */
export function getStillAudioMetrics() {
  const analyser = getAnalyser();
  if (!analyser || !getIsPlaying()) {
    return { low: 0, mid: 0, high: 0, overall: 0 };
  }
  const bins = analyser.frequencyBinCount;
  if (!metricsBuffer || metricsBuffer.length !== bins) {
    metricsBuffer = new Uint8Array(bins);
  }
  analyser.getByteFrequencyData(metricsBuffer);

  let lowSum = 0, midSum = 0, highSum = 0, total = 0;
  const lowEnd = Math.floor(bins * 0.12);
  const midEnd = Math.floor(bins * 0.45);
  for (let i = 0; i < bins; i++) {
    const v = metricsBuffer[i] / 255;
    total += v;
    if (i < lowEnd) lowSum += v;
    else if (i < midEnd) midSum += v;
    else highSum += v;
  }
  return {
    low: lowSum / Math.max(1, lowEnd),
    mid: midSum / Math.max(1, midEnd - lowEnd),
    high: highSum / Math.max(1, bins - midEnd),
    overall: total / bins,
  };
}

/** Write --still-energy only when it has moved perceptibly. */
function publishEnergy(value) {
  if (Math.abs(value - lastPublishedEnergy) < ENERGY_EPSILON) return;
  lastPublishedEnergy = value;
  document.documentElement.style.setProperty('--still-energy', value.toFixed(4));
}

// ----------------------------------------------------------
// Render loop
// ----------------------------------------------------------

function updateStillField() {
  if (!stillFieldEnabled || stillFieldIntensity <= 0.01) {
    applyCanvasVisibility();
    stopLoop();
    stillEnergy = 0;
    publishEnergy(0);
    return;
  }

  if (document.visibilityState !== 'visible') {
    // Background tabs already throttle rAF; just keep the loop alive.
    stillFieldRaf = requestAnimationFrame(updateStillField);
    return;
  }

  const metrics = getStillAudioMetrics();
  // Smooth energy for UI — much quieter when paused
  const targetEnergy = metrics.overall * stillFieldIntensity * (getIsPlaying() ? 1 : 0.06);
  stillEnergy += (targetEnergy - stillEnergy) * 0.09;
  publishEnergy(stillEnergy);

  // Soft residual clear (calm trails)
  stillFieldCtx.fillStyle = clearColor;
  stillFieldCtx.fillRect(0, 0, stillFieldW, stillFieldH);

  const intensity = stillFieldIntensity;
  const energyBoost = 0.35 + metrics.overall * 1.1;
  const maxDist = 110 + intensity * 55; // connection range scales a little with intensity
  const maxDistSq = maxDist * maxDist;
  const drift = 0.9 + metrics.mid * 0.4;

  // --- Update node positions ---
  for (const n of stillFieldNodes) {
    // Extremely gentle random walk
    n.vx += (Math.random() - 0.5) * 0.018 * energyBoost;
    n.vy += (Math.random() - 0.5) * 0.018 * energyBoost;

    // Strong damping → premium slow drift
    n.vx *= 0.978;
    n.vy *= 0.978;

    n.x += n.vx * drift;
    n.y += n.vy * drift;

    // Soft wrap
    if (n.x < -20) n.x = stillFieldW + 20;
    if (n.x > stillFieldW + 20) n.x = -20;
    if (n.y < -20) n.y = stillFieldH + 20;
    if (n.y > stillFieldH + 20) n.y = -20;

    n.phase += 0.006 + metrics.high * 0.01;
  }

  // --- Draw edges (O(n²) is fine at n ≤ 34) ---
  stillFieldCtx.lineWidth = 0.9;
  if (!edgeColorHasAlpha) stillFieldCtx.strokeStyle = edgeColor;
  for (let i = 0; i < stillFieldNodes.length; i++) {
    const a = stillFieldNodes[i];
    for (let j = i + 1; j < stillFieldNodes.length; j++) {
      const b = stillFieldNodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy; // compare squared — avoids a sqrt per pair
      if (distSq >= maxDistSq) continue;

      const alpha = (1 - Math.sqrt(distSq) / maxDist) * 0.55 * intensity;
      if (edgeColorHasAlpha) {
        stillFieldCtx.strokeStyle = edgeColor.replace(/[\d.]+\s*\)$/, alpha.toFixed(3) + ')');
      } else {
        stillFieldCtx.globalAlpha = alpha;
      }
      stillFieldCtx.beginPath();
      stillFieldCtx.moveTo(a.x, a.y);
      stillFieldCtx.lineTo(b.x, b.y);
      stillFieldCtx.stroke();
    }
  }
  stillFieldCtx.globalAlpha = 1;

  // --- Draw nodes (small, subtle) ---
  stillFieldCtx.fillStyle = nodeColor;
  const radiusScale = 0.85 + intensity * 0.25;
  for (const n of stillFieldNodes) {
    const r = (1.6 + Math.sin(n.phase) * 0.4) * radiusScale;
    stillFieldCtx.beginPath();
    stillFieldCtx.arc(n.x, n.y, r, 0, Math.PI * 2);
    stillFieldCtx.fill();
  }

  stillFieldRaf = requestAnimationFrame(updateStillField);
}

function stopLoop() {
  if (stillFieldRaf) {
    cancelAnimationFrame(stillFieldRaf);
    stillFieldRaf = null;
  }
}

export function startStillFieldLoop() {
  if (stillFieldRaf) return;
  if (!stillFieldEnabled) return;
  stillFieldRaf = requestAnimationFrame(updateStillField);
}

// ----------------------------------------------------------
// Settings
// ----------------------------------------------------------

/**
 * Turn the visualisation on or off. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldEnabled(on) {
  stillFieldEnabled = Boolean(on);
  write(STORAGE_KEYS.stillFieldEnabled, stillFieldEnabled);
  applyCanvasVisibility();

  if (stillFieldEnabled) {
    startStillFieldLoop();
  } else {
    stopLoop();
    stillEnergy = 0;
    publishEnergy(0);
    if (stillFieldCtx) {
      stillFieldCtx.clearRect(0, 0, stillFieldW, stillFieldH);
    }
  }
  emit();
}

/**
 * Set visual intensity. Persists the choice.
 * @param {number} v 0–1
 */
export function setStillFieldIntensity(v) {
  stillFieldIntensity = clamp(v, 0, 1);
  write(STORAGE_KEYS.stillFieldIntensity, stillFieldIntensity);
  if (stillFieldIntensity > 0.01 && stillFieldEnabled) startStillFieldLoop();
  emit();
}

/**
 * Handle a viewport resize. Debounced — mobile browsers fire `resize` on every
 * address-bar show/hide, and re-laying-out the canvas is not free.
 */
export function handleResize() {
  if (resizeDebounceId) clearTimeout(resizeDebounceId);
  resizeDebounceId = setTimeout(() => {
    resizeDebounceId = null;
    resizeStillField();
  }, RESIZE_DEBOUNCE_MS);
}
