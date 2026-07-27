/**
 * Still Field — full-page nodes + edges graph visualisation.
 *
 * Subtle silver/titanium (or warm grey) nodes connected by soft distance-based
 * edges. Slow calm drift, gently driven by AnalyserNode metrics from the
 * audio engine. Completely optional (defaults off).
 *
 * Performance note: O(n²) edge drawing is fine at n ≤ 34 on mid-range mobiles.
 */

import { STORAGE_KEYS } from './constants.js';
import { getAnalyser, getIsPlaying } from './audio.js';
import { getStillTheme } from './theme.js';

// --- State ---
let stillFieldEnabled = localStorage.getItem(STORAGE_KEYS.stillFieldEnabled) === 'true';
let stillFieldIntensity = parseFloat(localStorage.getItem(STORAGE_KEYS.stillFieldIntensity));
if (isNaN(stillFieldIntensity)) stillFieldIntensity = 0.55;

let stillFieldNodes = [];
let stillFieldRaf = null;
let stillEnergy = 0; // 0–1 smoothed energy for UI influence (CSS --still-energy)

let stillFieldCanvas = null;
let stillFieldCtx = null;
let stillFieldW = 0;
let stillFieldH = 0;
let stillFieldDpr = 1;

/**
 * Call once after DOM is ready.
 * @param {HTMLCanvasElement} canvas
 */
export function initStillField(canvas) {
  stillFieldCanvas = canvas;
  stillFieldCtx = canvas.getContext('2d', { alpha: true });
  resizeStillField();
  initStillFieldNodes();
  if (stillFieldEnabled) startStillFieldLoop();
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

function resizeStillField() {
  if (!stillFieldCanvas) return;
  stillFieldDpr = Math.min(window.devicePixelRatio || 1, 2);
  stillFieldW = window.innerWidth;
  stillFieldH = window.innerHeight;
  stillFieldCanvas.width = Math.floor(stillFieldW * stillFieldDpr);
  stillFieldCanvas.height = Math.floor(stillFieldH * stillFieldDpr);
  stillFieldCanvas.style.width = stillFieldW + 'px';
  stillFieldCanvas.style.height = stillFieldH + 'px';
  stillFieldCtx.setTransform(stillFieldDpr, 0, 0, stillFieldDpr, 0, 0);
  if (stillFieldNodes.length === 0) initStillFieldNodes();
}

/**
 * (Re)seed nodes. Force = true clears existing positions (e.g. on theme change).
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
      phase: Math.random() * Math.PI * 2
    });
  }
}

function getStillAudioMetrics() {
  const analyser = getAnalyser();
  if (!analyser || !getIsPlaying()) {
    return { low: 0, mid: 0, high: 0, overall: 0 };
  }
  const bins = analyser.frequencyBinCount;
  const data = new Uint8Array(bins);
  analyser.getByteFrequencyData(data);

  let lowSum = 0, midSum = 0, highSum = 0, total = 0;
  const lowEnd = Math.floor(bins * 0.12);
  const midEnd = Math.floor(bins * 0.45);
  for (let i = 0; i < bins; i++) {
    const v = data[i] / 255;
    total += v;
    if (i < lowEnd) lowSum += v;
    else if (i < midEnd) midSum += v;
    else highSum += v;
  }
  const overall = total / bins;
  return {
    low: lowSum / Math.max(1, lowEnd),
    mid: midSum / Math.max(1, midEnd - lowEnd),
    high: highSum / Math.max(1, bins - midEnd),
    overall: overall
  };
}

function updateStillField(ts) {
  if (!stillFieldEnabled || stillFieldIntensity <= 0.01) {
    if (stillFieldCanvas) stillFieldCanvas.classList.add('still-field-off');
    if (stillFieldRaf) {
      cancelAnimationFrame(stillFieldRaf);
      stillFieldRaf = null;
    }
    stillEnergy = 0;
    document.documentElement.style.setProperty('--still-energy', '0');
    return;
  }

  if (stillFieldCanvas) stillFieldCanvas.classList.remove('still-field-off');

  if (document.visibilityState !== 'visible') {
    stillFieldRaf = requestAnimationFrame(updateStillField);
    return;
  }

  const metrics = getStillAudioMetrics();
  // Smooth energy for UI — quieter when paused
  const targetEnergy = metrics.overall * stillFieldIntensity * (getIsPlaying() ? 1 : 0.06);
  stillEnergy += (targetEnergy - stillEnergy) * 0.09;
  document.documentElement.style.setProperty('--still-energy', stillEnergy.toFixed(4));

  // Soft residual clear (calm trails)
  const theme = getStillTheme();
  stillFieldCtx.fillStyle = theme === 'bone'
    ? 'rgba(244, 240, 232, 0.28)'
    : 'rgba(12, 12, 17, 0.22)';
  stillFieldCtx.fillRect(0, 0, stillFieldW, stillFieldH);

  const intensity = stillFieldIntensity;
  const energyBoost = 0.35 + metrics.overall * 1.1;
  const maxDist = 110 + intensity * 55; // connection range scales a little with intensity

  // Read current theme colours once per frame
  const style = getComputedStyle(document.documentElement);
  const nodeColor = style.getPropertyValue('--still-field-node').trim() || 'rgba(190,195,210,0.5)';
  const edgeColor = style.getPropertyValue('--still-field-edge').trim() || 'rgba(160,165,180,0.2)';

  // --- Update + draw nodes ---
  for (const n of stillFieldNodes) {
    // Extremely gentle random walk
    n.vx += (Math.random() - 0.5) * 0.018 * energyBoost;
    n.vy += (Math.random() - 0.5) * 0.018 * energyBoost;

    // Strong damping → premium slow drift
    n.vx *= 0.978;
    n.vy *= 0.978;

    n.x += n.vx * (0.9 + metrics.mid * 0.4);
    n.y += n.vy * (0.9 + metrics.mid * 0.4);

    // Soft wrap
    if (n.x < -20) n.x = stillFieldW + 20;
    if (n.x > stillFieldW + 20) n.x = -20;
    if (n.y < -20) n.y = stillFieldH + 20;
    if (n.y > stillFieldH + 20) n.y = -20;

    n.phase += 0.006 + metrics.high * 0.01;
  }

  // --- Draw edges (O(n²) is fine at n ≤ 34) ---
  stillFieldCtx.lineWidth = 0.9;
  for (let i = 0; i < stillFieldNodes.length; i++) {
    const a = stillFieldNodes[i];
    for (let j = i + 1; j < stillFieldNodes.length; j++) {
      const b = stillFieldNodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist) {
        const alpha = (1 - dist / maxDist) * 0.55 * intensity;
        stillFieldCtx.strokeStyle = edgeColor.replace(/[\d.]+\)$/, alpha.toFixed(3) + ')');
        // Fallback if colour parse fails
        if (!stillFieldCtx.strokeStyle || stillFieldCtx.strokeStyle === edgeColor) {
          stillFieldCtx.globalAlpha = alpha;
          stillFieldCtx.strokeStyle = edgeColor;
        }
        stillFieldCtx.beginPath();
        stillFieldCtx.moveTo(a.x, a.y);
        stillFieldCtx.lineTo(b.x, b.y);
        stillFieldCtx.stroke();
        stillFieldCtx.globalAlpha = 1;
      }
    }
  }

  // --- Draw nodes (small, subtle) ---
  for (const n of stillFieldNodes) {
    const r = 1.6 + Math.sin(n.phase) * 0.4;
    stillFieldCtx.beginPath();
    stillFieldCtx.fillStyle = nodeColor;
    stillFieldCtx.arc(n.x, n.y, r * (0.85 + intensity * 0.25), 0, Math.PI * 2);
    stillFieldCtx.fill();
  }

  stillFieldRaf = requestAnimationFrame(updateStillField);
}

export function startStillFieldLoop() {
  if (stillFieldRaf) return;
  if (!stillFieldEnabled) return;
  stillFieldRaf = requestAnimationFrame(updateStillField);
}

export function setStillFieldEnabled(on) {
  stillFieldEnabled = on;
  localStorage.setItem(STORAGE_KEYS.stillFieldEnabled, on ? 'true' : 'false');

  const toggle = document.getElementById('stillFieldToggle');
  if (toggle) toggle.setAttribute('aria-checked', on ? 'true' : 'false');

  const intensitySlider = document.getElementById('stillFieldIntensity');
  if (intensitySlider) intensitySlider.disabled = !on;

  if (on) {
    startStillFieldLoop();
  } else {
    if (stillFieldRaf) {
      cancelAnimationFrame(stillFieldRaf);
      stillFieldRaf = null;
    }
    if (stillFieldCanvas) stillFieldCanvas.classList.add('still-field-off');
    stillEnergy = 0;
    document.documentElement.style.setProperty('--still-energy', '0');
    if (stillFieldCtx) {
      stillFieldCtx.clearRect(0, 0, stillFieldW || stillFieldCanvas.width, stillFieldH || stillFieldCanvas.height);
    }
  }
}

export function setStillFieldIntensity(v) {
  stillFieldIntensity = v;
  localStorage.setItem(STORAGE_KEYS.stillFieldIntensity, v);
  if (v > 0.01 && stillFieldEnabled) startStillFieldLoop();
}

// Resize handler — call from app.js or attach here
export function handleResize() {
  resizeStillField();
  initStillFieldNodes(true);
}
