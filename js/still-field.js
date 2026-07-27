/**
 * Still Field — a slow, three-dimensional field of nodes and connections.
 *
 * Nodes drift through a shallow perspective volume, gently coming toward the
 * viewer and receding again. They are born, live, and fade out; when one fades,
 * the lines attached to it retract into their surviving partners rather than
 * blinking off. Colour and glow ride a layered energy signal — part procedural,
 * part frequency-band data from the audio engine — so the field breathes with
 * the noise without ever becoming busy.
 *
 * ## Contract
 *
 * This module owns exactly one DOM element: the canvas handed to
 * `initStillField()`. It never queries the document for anything else. UI
 * controls (the toggle switch, the intensity and speed sliders) are rendered by
 * app.js from the snapshot published via `subscribe()`.
 *
 * ## Performance notes — this app runs all night on a phone
 *
 * The field is on by default now, so every per-frame cost is a battery cost for
 * eight unattended hours. The rules that keep it cheap:
 *
 * - **30 fps, not 60.** Nothing here moves fast enough to need more, and the
 *   motion is integrated from real elapsed time, so the field drifts at exactly
 *   the same rate whether the display runs at 30, 60 or 120 Hz. Halving the
 *   frame rate halves the work for no perceptible loss.
 * - **The loop stops when the page is hidden.** Requesting frames that the
 *   browser will only throttle still wakes the compositor; not asking is free.
 * - **No allocation in the render loop.** Colours are pre-quantised into small
 *   palettes at theme-change time and selected by index, so per-node colour
 *   costs an array lookup instead of a string build. Link state lives in one
 *   pre-sized Float32Array.
 * - **`getComputedStyle` is called once per theme change, never per frame**, and
 *   `--still-energy` is only written when it moves perceptibly, because both
 *   force a style recalculation for the whole document.
 * - **Glow is rationed.** `shadowBlur` is the single most expensive thing on
 *   this canvas, so only the few highest-energy nodes get it, with a hard cap.
 * - O(n²) link scanning is fine at n ≤ 58 once the frame rate is halved. The
 *   optional Field Lab instruments the pass without adding a second scan.
 */

import { STORAGE_KEYS, DEFAULTS, STILL_SPEED_MIN, STILL_SPEED_MAX } from './constants.js';
import { write, readNumber, readBool, clamp } from './storage.js';
import { getAnalyser, getIsPlaying } from './audio.js';

// ----------------------------------------------------------
// Tuning constants — all the numbers that shape the look
// ----------------------------------------------------------

/**
 * Perspective depth. `z` runs 0 (nearest) to 1 (furthest) and projects through
 * a pinhole camera of focal length 1:
 *
 *     scale(z) = 1 / (1 + z * DEPTH)
 *
 * so the near plane draws at 1.0 and the far plane at 1/(1 + DEPTH). At 0.75
 * that is a 1.75× size ratio across the volume — enough to read as depth, not
 * enough to look like a flying-through-space screensaver.
 */
const DEPTH = 0.75;
const MIN_SCALE = 1 / (1 + DEPTH);

/** Target frame interval. See the battery note above. */
const FRAME_INTERVAL_MS = 1000 / 30;

/** Longest timestep we will integrate in one go, after a stall or a hidden tab. */
const MAX_STEP_S = 0.1;

/**
 * Node count bounds, measured against the *world* plane rather than the
 * viewport: perspective pulls distant nodes toward the centre, so a count
 * derived from screen area leaves the field looking thin. The upper bound is
 * what keeps O(n²) linking honest — 58 nodes is 1,653 pairs a frame, still a
 * small canvas workload at 30 fps and dense enough to expose the graph maths.
 */
const MIN_NODES = 32;
const MAX_NODES = 58;
const AREA_PER_NODE = 24000;

/** Node lifetime range in seconds, before the speed multiplier. */
const LIFE_MIN_S = 70;
const LIFE_MAX_S = 150;
/** Fractions of a lifetime spent fading in and out. */
const FADE_IN = 0.1;
const FADE_OUT = 0.16;

/** Link envelope rates (per second) — links arrive briskly and leave slowly. */
const LINK_ATTACK = 3.2;
const LINK_RELEASE = 1.1;
/** How much of a new link's brightness comes from the arrival transient. */
const LINK_PULSE_GAIN = 0.9;
/** Below this, a link is invisible and not worth stroking. */
const LINK_EPSILON = 0.004;

/**
 * Fraction of the previous frame's alpha removed each frame. At 30 fps, 0.24
 * fades a trail to invisibility in a little over half a second.
 */
const TRAIL_DECAY = 0.24;

/** Energy smoothing rate (per second) for the value mirrored to CSS. */
const ENERGY_SMOOTH = 2.4;
/** Energy must move by at least this much before we touch CSS again. */
const ENERGY_EPSILON = 0.002;

/** Travelling-wave parameters. See computeNodeEnergy(). */
const WAVE_RATE = 0.55;      // rad/s
const WAVE_KX = 0.0042;      // rad per world unit
const WAVE_KY = 0.0042 * 1.6180339887;
/** Only the highest-energy nodes glow, and never more than this many. */
const GLOW_THRESHOLD = 0.62;
const MAX_GLOW_NODES = 8;

/** Quantisation of the purple→spark colour ramp. 16 steps is past the eye. */
const COLOR_STEPS = 16;

/**
 * Strides of the R2 low-discrepancy sequence (Roberts, 2018), generated from
 * the plastic number g ≈ 1.3247. Successive points fill a rectangle far more
 * evenly than `Math.random()`, which clumps — spawning a replacement node at
 * `frac(a * i)` keeps the field's coverage balanced without any repulsion pass.
 * The third stride carries depth.
 */
const R2_A1 = 0.7548776662466927; // 1/g
const R2_A2 = 0.5698402909980532; // 1/g²
const R2_A3 = 0.4301597090052419; // 1/g³

const PHI = 1.6180339887498949;

/** Debounce window for resize — mobile browsers fire it on every URL-bar nudge. */
const RESIZE_DEBOUNCE_MS = 150;

/** Field Lab publishes DOM telemetry at 4 Hz, not at the canvas frame rate. */
const TELEMETRY_INTERVAL_MS = 250;
/** Detailed node callouts persist long enough to be read before rotating. */
const CALLOUT_INTERVAL_S = 8;
const MAX_NODE_CALLOUTS = 12;
const MAX_EDGE_CALLOUTS = 7;
const WAVE_ANGLE_DEG = Math.atan2(WAVE_KY, WAVE_KX) * 180 / Math.PI;

// --- Persisted settings ---
let stillFieldEnabled = readBool(STORAGE_KEYS.stillFieldEnabled, DEFAULTS.stillFieldEnabled);
let stillFieldIntensity = clamp(
  readNumber(STORAGE_KEYS.stillFieldIntensity, DEFAULTS.stillFieldIntensity),
  0,
  1,
);
let stillFieldSpeed = clamp(
  readNumber(STORAGE_KEYS.stillFieldSpeed, DEFAULTS.stillFieldSpeed),
  STILL_SPEED_MIN,
  STILL_SPEED_MAX,
);

// --- Runtime ---
let stillFieldNodes = [];
let linkState = new Float32Array(0); // [i * n + j] link strength, i < j
let spawnIndex = 0;                  // drives the R2 sequence
let clockS = 0;                      // speed-scaled animation clock, in seconds
let stillFieldRaf = null;
let lastFrameMs = 0;
let lastDrawMs = 0;
let stillEnergy = 0;          // 0–1 smoothed energy, mirrored to CSS --still-energy
let lastPublishedEnergy = -1; // last value actually written to the CSS variable

let stillFieldCanvas = null;
let stillFieldCtx = null;
let stillFieldW = 0;   // viewport, CSS px
let stillFieldH = 0;
let worldW = 0;        // world plane, sized so far nodes still reach the edges
let worldH = 0;
let linkRadius = 0;    // world units
let zWorld = 0;        // world units a full depth traverse is worth when linking
let stillFieldDpr = 1;
let resizeDebounceId = null;
let telemetryEnabled = false;
let telemetryTab = 'live';
let lastTelemetryMs = 0;
let nodeSerial = 0;

// Rewritten in place. Instrumentation is opt-in, and its counters piggyback on
// work the renderer already performs rather than rescanning the graph.
const telemetry = {
  fps: 0,
  frameMs: 0,
  nodeCount: 0,
  activeLinks: 0,
  pairChecks: 0,
  meanDegree: 0,
  density: 0,
  energy: 0,
  wavePhase: 0,
  waveAngle: WAVE_ANGLE_DEG,
  low: 0,
  mid: 0,
  high: 0,
};

// Theme-derived colours, refreshed by refreshThemeColors()
const nodePalette = new Array(COLOR_STEPS).fill('rgb(190,195,210)');
const edgePalette = new Array(COLOR_STEPS).fill('rgb(160,165,180)');
let glowColor = 'rgba(124, 58, 237, 0.55)';
let calloutBackground = 'rgba(8, 8, 15, 0.76)';
let baseNodeAlpha = 0.55;
let baseEdgeAlpha = 0.22;

/**
 * Users who ask for reduced motion still get the field if they turned it on,
 * but slowed right down and without the pulsing glow.
 */
const reducedMotionQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
let reducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;

// ----------------------------------------------------------
// Subscriptions (mirrors the pattern in audio.js)
// ----------------------------------------------------------
const listeners = new Set();

/**
 * @returns {{enabled: boolean, intensity: number, speed: number, telemetryEnabled: boolean, telemetryTab: string, telemetry: typeof telemetry}}
 */
export function getState() {
  return {
    enabled: stillFieldEnabled,
    intensity: stillFieldIntensity,
    speed: stillFieldSpeed,
    telemetryEnabled,
    telemetryTab,
    telemetry: { ...telemetry },
  };
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

export function getStillFieldSpeed() {
  return stillFieldSpeed;
}

export function getStillEnergy() {
  return stillEnergy;
}

/** @returns {boolean} whether the opt-in Field Lab is collecting telemetry */
export function getTelemetryEnabled() {
  return telemetryEnabled;
}

// ----------------------------------------------------------
// Colour handling
// ----------------------------------------------------------

/**
 * Parse the `rgb()`, `rgba()` and `#rgb`/`#rrggbb` forms our theme tokens use.
 * Returns null for anything else so callers can fall back rather than paint
 * `NaN` into the canvas.
 * @param {string} value
 * @returns {{r: number, g: number, b: number, a: number}|null}
 */
function parseColor(value) {
  if (!value) return null;
  const str = value.trim();

  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(str);
  if (fn) {
    return {
      r: Number(fn[1]),
      g: Number(fn[2]),
      b: Number(fn[3]),
      a: fn[4] === undefined ? 1 : Number(fn[4]),
    };
  }

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(str);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }

  return null;
}

/**
 * Build a quantised colour ramp from `base` to `spark` through `mid`.
 *
 * The midpoint matters: a straight lerp from a cool violet-grey to cyan passes
 * through a desaturated blue that reads as dirty rather than electric. Bending
 * the ramp through the bright purple accent keeps luminance and saturation up
 * across the whole range, so rising energy looks like it is charging rather
 * than washing out.
 *
 * @param {string[]} out array of COLOR_STEPS strings, written in place
 */
function buildPalette(out, base, mid, spark) {
  for (let k = 0; k < COLOR_STEPS; k++) {
    const t = k / (COLOR_STEPS - 1);
    let r, g, b;
    if (t < 0.5) {
      const u = t * 2;
      r = base.r + (mid.r - base.r) * u;
      g = base.g + (mid.g - base.g) * u;
      b = base.b + (mid.b - base.b) * u;
    } else {
      const u = (t - 0.5) * 2;
      r = mid.r + (spark.r - mid.r) * u;
      g = mid.g + (spark.g - mid.g) * u;
      b = mid.b + (spark.b - mid.b) * u;
    }
    out[k] = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }
}

/**
 * Re-read theme colours from CSS custom properties. Call after a theme change;
 * doing this per frame would force a style recalculation every frame.
 */
export function refreshThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const read = name => style.getPropertyValue(name).trim();

  const node = parseColor(read('--still-field-node')) || { r: 176, g: 170, b: 212, a: 0.58 };
  const edge = parseColor(read('--still-field-edge')) || { r: 148, g: 142, b: 192, a: 0.24 };
  const mid = parseColor(read('--still-field-mid')) || { r: 167, g: 139, b: 250, a: 1 };
  const spark = parseColor(read('--still-field-spark')) || { r: 34, g: 211, b: 238, a: 1 };
  const glowSource = parseColor(read('--still-field-glow')) || { r: 124, g: 58, b: 237, a: 0.6 };

  // The token's own alpha is the field's baseline opacity; the ramp itself is
  // opaque and alpha is applied per element via globalAlpha.
  baseNodeAlpha = node.a;
  baseEdgeAlpha = edge.a;
  calloutBackground = node.r < 130
    ? 'rgba(248, 246, 240, 0.86)'
    : 'rgba(8, 8, 15, 0.76)';

  buildPalette(nodePalette, node, mid, spark);
  buildPalette(edgePalette, edge, mid, spark);

  glowColor = `rgba(${Math.round(glowSource.r)},${Math.round(glowSource.g)},${Math.round(glowSource.b)},0.85)`;
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

  document.addEventListener('visibilitychange', handleVisibilityChange);
  if (reducedMotionQuery && reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener('change', e => { reducedMotion = e.matches; });
  }

  if (stillFieldEnabled) startStillFieldLoop();
}

function applyCanvasVisibility() {
  if (!stillFieldCanvas) return;
  stillFieldCanvas.classList.toggle('still-field-off', !stillFieldEnabled);
}

/**
 * Recompute the world plane and everything derived from it.
 *
 * The world is larger than the viewport by exactly the far plane's shrink
 * factor, so that a node sitting at maximum depth still projects to the screen
 * edge instead of leaving a bare border.
 */
function measureWorld() {
  worldW = stillFieldW / MIN_SCALE;
  worldH = stillFieldH / MIN_SCALE;

  // Derive the link radius from the mean spacing between nodes rather than
  // fixing it in pixels: the expected number of neighbours inside radius r is
  // π·(r/spacing)² − 1, so tying r to spacing keeps a phone and a desktop at the
  // same ≈3 connections per node instead of a dense mesh on one and dust on the
  // other.
  const count = Math.max(1, stillFieldNodes.length || targetNodeCount());
  const spacing = Math.sqrt((worldW * worldH) / count);
  linkRadius = spacing * (0.8 + stillFieldIntensity * 0.5);
  zWorld = spacing * 1.1;
}

function targetNodeCount() {
  const area = (stillFieldW * stillFieldH) / (MIN_SCALE * MIN_SCALE);
  return Math.min(MAX_NODES, Math.max(MIN_NODES, Math.floor(area / AREA_PER_NODE)));
}

function resizeStillField() {
  if (!stillFieldCanvas) return;
  const prevW = worldW;
  const prevH = worldH;

  stillFieldDpr = Math.min(window.devicePixelRatio || 1, 2);
  stillFieldW = window.innerWidth;
  stillFieldH = window.innerHeight;
  stillFieldCanvas.width = Math.floor(stillFieldW * stillFieldDpr);
  stillFieldCanvas.height = Math.floor(stillFieldH * stillFieldDpr);
  stillFieldCanvas.style.width = stillFieldW + 'px';
  stillFieldCanvas.style.height = stillFieldH + 'px';
  stillFieldCtx.setTransform(stillFieldDpr, 0, 0, stillFieldDpr, 0, 0);

  measureWorld();

  if (stillFieldNodes.length === 0) {
    initStillFieldNodes();
  } else if (prevW > 0 && prevH > 0) {
    // Rescale rather than re-seed: on phones the address bar shows and hides
    // constantly, and re-seeding would teleport every node mid-session.
    const sx = worldW / prevW;
    const sy = worldH / prevH;
    for (const n of stillFieldNodes) {
      n.x *= sx;
      n.y *= sy;
    }
  }
}

/**
 * Place a node at the next point of the R2 sequence and reset its life.
 * @param {object} n
 * @param {boolean} [seeded=false] true while seeding the initial field, where
 *   lives are staggered so the first generation does not all expire together
 */
function respawnNode(n, seeded = false) {
  const i = spawnIndex++;
  n.id = ++nodeSerial;
  n.generation = (n.generation || 0) + 1;

  // World coordinates are centred on the origin; the camera sits on the axis.
  n.x = (((0.5 + R2_A1 * i) % 1) - 0.5) * worldW;
  n.y = (((0.5 + R2_A2 * i) % 1) - 0.5) * worldH;

  // Depth is the *centre* of this node's excursion, kept off both planes so it
  // always has room to move toward and away from the viewer.
  n.zBase = 0.16 + ((0.5 + R2_A3 * i) % 1) * 0.68;
  n.zAmp = 0.06 + ((i * PHI) % 1) * 0.1;
  n.zRate = 0.05 + ((i * R2_A2) % 1) * 0.07;   // rad/s — a full breath is 50–120 s
  n.zPhase = ((i * R2_A1) % 1) * Math.PI * 2;
  n.z = n.zBase;

  n.vx = (Math.random() - 0.5) * 6;            // world units/s
  n.vy = (Math.random() - 0.5) * 6;

  n.phase = ((i * PHI) % 1) * Math.PI * 2;
  n.phaseRate = 0.22 + ((i * R2_A1 * PHI) % 1) * 0.3;

  n.life = seeded ? Math.random() : 0;
  n.lifeRate = 1 / (LIFE_MIN_S + Math.random() * (LIFE_MAX_S - LIFE_MIN_S));
  n.energy = 0;
}

/** Forget every link touching node `index` — a respawned node is a new node. */
function clearLinksFor(index) {
  const n = stillFieldNodes.length;
  for (let j = 0; j < n; j++) {
    if (j === index) continue;
    linkState[index * n + j] = 0;
    linkState[j * n + index] = 0;
  }
}

/**
 * (Re)seed nodes. `force = true` discards existing positions.
 * @param {boolean} [force=false]
 */
export function initStillFieldNodes(force = false) {
  if (stillFieldNodes.length && !force) return;

  const count = targetNodeCount();
  stillFieldNodes = new Array(count);
  spawnIndex = 0;

  for (let i = 0; i < count; i++) {
    const n = {
      id: 0, generation: 0,
      x: 0, y: 0, z: 0, zBase: 0, zAmp: 0, zRate: 0, zPhase: 0,
      vx: 0, vy: 0, phase: 0, phaseRate: 0,
      life: 0, lifeRate: 0, energy: 0,
      // Scratch fields, written during update and read during draw. Keeping
      // them on the node is what lets the draw pass allocate nothing.
      sx: 0, sy: 0, scale: 0, fade: 0,
    };
    respawnNode(n, true);
    stillFieldNodes[i] = n;
  }

  linkState = new Float32Array(count * count);
  measureWorld();
}

// ----------------------------------------------------------
// Audio-reactive metrics
// ----------------------------------------------------------

// Reused across frames so the render loop allocates nothing.
let metricsBuffer = null;
const metrics = { low: 0, mid: 0, high: 0, overall: 0 };

/**
 * Frequency-band energy from the audio engine's analyser.
 *
 * Returns a live object that is rewritten in place each call — copy the fields
 * you need rather than holding the reference across frames.
 *
 * @returns {{low: number, mid: number, high: number, overall: number}} all 0–1
 */
export function getStillAudioMetrics() {
  const analyser = getAnalyser();
  if (!analyser || !getIsPlaying()) {
    metrics.low = metrics.mid = metrics.high = metrics.overall = 0;
    return metrics;
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
  metrics.low = lowSum / Math.max(1, lowEnd);
  metrics.mid = midSum / Math.max(1, midEnd - lowEnd);
  metrics.high = highSum / Math.max(1, bins - midEnd);
  metrics.overall = total / bins;
  return metrics;
}

/** Write --still-energy only when it has moved perceptibly. */
function publishEnergy(value) {
  if (Math.abs(value - lastPublishedEnergy) < ENERGY_EPSILON) return;
  lastPublishedEnergy = value;
  document.documentElement.style.setProperty('--still-energy', value.toFixed(4));
}

/**
 * Per-node energy, 0–1. Three layers that never line up with each other:
 *
 * 1. a personal breath — each node's own slow sinusoid;
 * 2. a plane wave travelling across the field at an irrational angle, so the
 *    crest never settles into the lattice and never visibly repeats;
 * 3. the audio signal, weighted toward the mid and high bands because those are
 *    where brown, pink and white noise actually differ from one another.
 *
 * Silence leaves layers 1 and 2, which is why the field still lives when the
 * app is paused — just more quietly.
 */
function computeNodeEnergy(n, audioBoost) {
  const breath = 0.5 + 0.5 * Math.sin(n.phase);
  const wave = 0.5 + 0.5 * Math.sin(clockS * WAVE_RATE - (n.x * WAVE_KX + n.y * WAVE_KY));
  return clamp(0.3 * breath + 0.24 * wave + 0.46 * audioBoost, 0, 1);
}

/** Smooth 0→1 ramp; gentler at both ends than a straight line. */
function smoothstep(t) {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}

// ----------------------------------------------------------
// Render loop
// ----------------------------------------------------------

function frame(nowMs) {
  stillFieldRaf = requestAnimationFrame(frame);

  if (!stillFieldEnabled || stillFieldIntensity <= 0.01) {
    stopLoop();
    applyCanvasVisibility();
    stillEnergy = 0;
    publishEnergy(0);
    // Without this the last painted frame would sit frozen on screen, because
    // the residual clear that normally erases it only runs while the loop does.
    stillFieldCtx.clearRect(0, 0, stillFieldW, stillFieldH);
    return;
  }

  // Frame cap. The `-1` absorbs the sub-millisecond jitter that would otherwise
  // make every second frame miss its slot and halve the effective rate.
  if (nowMs - lastDrawMs < FRAME_INTERVAL_MS - 1) return;

  const dt = Math.min((nowMs - lastFrameMs) / 1000, MAX_STEP_S);
  lastFrameMs = nowMs;
  lastDrawMs = nowMs;
  if (dt <= 0) return;

  const speed = reducedMotion ? stillFieldSpeed * 0.35 : stillFieldSpeed;
  const adt = dt * speed;   // the animation clock advances at the user's speed
  clockS += adt;

  const renderStart = telemetryEnabled ? performance.now() : 0;
  update(adt);
  draw(adt);

  if (telemetryEnabled) {
    const instantFps = 1 / dt;
    telemetry.fps += (instantFps - telemetry.fps) * 0.18;
    telemetry.frameMs += (performance.now() - renderStart - telemetry.frameMs) * 0.2;
    telemetry.nodeCount = stillFieldNodes.length;
    telemetry.energy = stillEnergy;
    telemetry.wavePhase = ((clockS * WAVE_RATE) % (Math.PI * 2)) * 180 / Math.PI;
    if (nowMs - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
      lastTelemetryMs = nowMs;
      emit();
    }
  }
}

function update(adt) {
  const m = getStillAudioMetrics();
  const audioBoost = Math.min(1, (0.45 * m.overall + 0.35 * m.mid + 0.2 * m.high) * 1.6);
  if (telemetryEnabled) {
    telemetry.low = m.low;
    telemetry.mid = m.mid;
    telemetry.high = m.high;
  }

  // Smoothed, intensity-scaled energy for the CSS variable the UI reacts to.
  const targetEnergy = m.overall * stillFieldIntensity * (getIsPlaying() ? 1 : 0.06);
  stillEnergy += (targetEnergy - stillEnergy) * (1 - Math.exp(-ENERGY_SMOOTH * adt));
  publishEnergy(stillEnergy);

  const nodes = stillFieldNodes;
  const n = nodes.length;
  const halfW = worldW / 2;
  const halfH = worldH / 2;
  const margin = 40;
  const cx = stillFieldW / 2;
  const cy = stillFieldH / 2;

  // Damping as a continuous rate rather than a per-frame factor, so the drift
  // settles identically at any frame rate.
  const damp = Math.exp(-0.55 * adt);
  const jitter = 14 * (0.35 + m.overall * 1.1);

  for (let i = 0; i < n; i++) {
    const node = nodes[i];

    node.life += node.lifeRate * adt;
    if (node.life >= 1) {
      respawnNode(node);
      clearLinksFor(i);
    }

    // Lifecycle envelope: ease in, hold, ease out.
    node.fade = smoothstep(node.life / FADE_IN) * smoothstep((1 - node.life) / FADE_OUT);

    // Gentle random walk, integrated in world units per second.
    node.vx += (Math.random() - 0.5) * jitter * adt;
    node.vy += (Math.random() - 0.5) * jitter * adt;
    node.vx *= damp;
    node.vy *= damp;
    node.x += node.vx * adt;
    node.y += node.vy * adt;

    // Wrap in world space so the lattice stays continuous.
    if (node.x < -halfW - margin) node.x = halfW + margin;
    else if (node.x > halfW + margin) node.x = -halfW - margin;
    if (node.y < -halfH - margin) node.y = halfH + margin;
    else if (node.y > halfH + margin) node.y = -halfH - margin;

    // Depth is a bounded sinusoid rather than an integrated velocity: nodes
    // drift toward the viewer and back without any chance of escaping the
    // volume over an eight-hour night.
    node.zPhase += node.zRate * adt;
    node.z = clamp(node.zBase + Math.sin(node.zPhase) * node.zAmp, 0, 1);

    node.phase += node.phaseRate * adt;
    node.energy = computeNodeEnergy(node, audioBoost);

    // Project once, here, and reuse in the edge and node passes.
    node.scale = 1 / (1 + node.z * DEPTH);
    node.sx = cx + node.x * node.scale;
    node.sy = cy + node.y * node.scale;
  }
}

function draw(adt) {
  const ctx = stillFieldCtx;
  const nodes = stillFieldNodes;
  const n = nodes.length;
  const intensity = stillFieldIntensity;

  // Soft residual clear — leaves a calm trail instead of a hard wipe.
  //
  // `destination-out` subtracts alpha rather than painting the page background
  // over the previous frame. Painting it would work, but only if the fill
  // exactly matched `--bg`, and after a few hundred frames the canvas would be
  // fully opaque — burying the background gradient and the Still Texture
  // underneath it. Subtracting alpha keeps the canvas genuinely transparent, so
  // both still show through, and the theme no longer has to hand this function
  // a matching colour.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${TRAIL_DECAY})`;
  ctx.fillRect(0, 0, stillFieldW, stillFieldH);
  ctx.globalCompositeOperation = 'source-over';

  drawLinks(ctx, nodes, n, intensity, adt);
  drawNodes(ctx, nodes, n, intensity);
  if (telemetryEnabled) drawFieldLab(ctx, nodes, n);

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawLinks(ctx, nodes, n, intensity, adt) {
  const r2 = linkRadius * linkRadius;
  const invR = 1 / linkRadius;

  // Envelope coefficients depend only on the timestep, so they are computed
  // once per frame rather than once per pair.
  const attackK = 1 - Math.exp(-LINK_ATTACK * adt);
  const releaseK = 1 - Math.exp(-LINK_RELEASE * adt);
  let activeLinks = 0;

  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    if (a.fade <= 0) continue;

    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      const k = i * n + j;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = (b.z - a.z) * zWorld;
      const distSq = dx * dx + dy * dy + dz * dz; // squared — no sqrt unless linked

      // A linear falloff leaves most links faint, because most pairs sit near
      // the outer edge of the radius where a linear ramp is already close to
      // zero. The 0.65 exponent lifts the mid-range so the lattice reads as
      // structure rather than as a few bright pairs in a haze.
      let target = 0;
      if (distSq < r2) target = Math.pow(1 - Math.sqrt(distSq) * invR, 0.65);

      const prev = linkState[k];
      // The arrival transient falls straight out of the envelope: the gap
      // between where a link wants to be and where it is peaks the instant two
      // nodes come into range, and closes as the envelope catches up. That gap
      // *is* the pulse — no extra state, no extra pass.
      const pulse = target > prev ? target - prev : 0;
      const strength = prev + (target - prev) * (target > prev ? attackK : releaseK);
      linkState[k] = strength;

      if (strength < LINK_EPSILON) continue;
      activeLinks++;

      const depthFade = (a.scale + b.scale) * 0.5;
      const alpha = clamp(
        (strength + pulse * LINK_PULSE_GAIN) * a.fade * b.fade * baseEdgeAlpha *
          depthFade * (0.5 + intensity * 0.9),
        0,
        1,
      );
      if (alpha < 0.004) continue;

      // A dying node's links retract into the survivor rather than blinking
      // off — the endpoint slides along the segment as the node fades. Capped
      // short of 1 so the line never collapses to a point before it is gone.
      const ra = (1 - a.fade) * 0.92;
      const rb = (1 - b.fade) * 0.92;
      const ax = a.sx + (b.sx - a.sx) * ra;
      const ay = a.sy + (b.sy - a.sy) * ra;
      const bx = b.sx + (a.sx - b.sx) * rb;
      const by = b.sy + (a.sy - b.sy) * rb;

      const energy = (a.energy + b.energy) * 0.5 + pulse * 0.5;
      // Squaring the mix keeps the field mostly in its base colour and lets the
      // spark hue read as an event rather than a wash.
      const shade = clamp(energy * energy, 0, 1);

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = edgePalette[Math.min(COLOR_STEPS - 1, (shade * COLOR_STEPS) | 0)];
      ctx.lineWidth = (0.7 + energy * 0.8) * depthFade;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }

  if (telemetryEnabled) {
    const pairChecks = n * (n - 1) / 2;
    telemetry.activeLinks = activeLinks;
    telemetry.pairChecks = pairChecks;
    telemetry.meanDegree = n ? activeLinks * 2 / n : 0;
    telemetry.density = pairChecks ? activeLinks / pairChecks : 0;
  }
}

function drawNodes(ctx, nodes, n, intensity) {
  const alphaScale = baseNodeAlpha * (0.55 + intensity * 0.45);
  const radiusScale = 0.85 + intensity * 0.25;
  let glowed = 0;

  ctx.shadowBlur = 0;

  // Two passes: everything flat first, then the few brightest nodes again with
  // a shadow. Setting shadowBlur is a pipeline change on most canvas backends,
  // so doing it 8 times beats doing it 32.
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      if (reducedMotion) break;
      ctx.shadowColor = glowColor;
    }

    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      if (node.fade <= 0) continue;

      const bright = node.energy > GLOW_THRESHOLD;
      if (pass === 0 && bright) continue;      // drawn in the glow pass instead
      if (pass === 1) {
        if (!bright) continue;
        if (glowed >= MAX_GLOW_NODES) break;
        glowed++;
        ctx.shadowBlur = Math.min(12, 4 + node.energy * 8);
      }

      // Nearness is the depth cue: closer nodes are larger and more opaque.
      const nearness = (node.scale - MIN_SCALE) / (1 - MIN_SCALE);
      const radius = (2.1 + node.energy * 1.9) * node.scale * radiusScale;
      const alpha = clamp(
        node.fade * (0.42 + nearness * 0.5) * (0.7 + node.energy * 0.45) * alphaScale,
        0,
        1,
      );

      const shade = clamp(node.energy * node.energy, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = nodePalette[Math.min(COLOR_STEPS - 1, (shade * COLOR_STEPS) | 0)];
      ctx.beginPath();
      ctx.arc(node.sx, node.sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.shadowBlur = 0;
}

/**
 * Draw opt-in instrumentation after the aesthetic field. Labels deliberately
 * persist for eight seconds: fast-changing numbers look impressive but cannot
 * be read. Every node keeps a stable ID for its lifetime, while a rotating
 * subset exposes different terms from the equations above.
 */
function drawFieldLab(ctx, nodes, n) {
  const epoch = Math.floor(clockS / CALLOUT_INTERVAL_S);
  const labelMode = epoch % 5;
  let nodeCallouts = 0;
  let edgeCallouts = 0;

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textBaseline = 'middle';

  // Stable identity tags make every node inspectable without turning the whole
  // field into overlapping cards.
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (node.fade < 0.18) continue;
    ctx.globalAlpha = 0.34 + node.energy * 0.32;
    ctx.fillStyle = nodePalette[Math.min(COLOR_STEPS - 1, (node.energy * COLOR_STEPS) | 0)];
    ctx.fillText(`n${String(node.id).padStart(3, '0')}`, node.sx + 7, node.sy - 7);

    if ((i + epoch * 3) % 5 !== 0 || nodeCallouts >= MAX_NODE_CALLOUTS) continue;
    nodeCallouts++;
    const speed = Math.hypot(node.vx, node.vy);
    const values = [
      `E=${node.energy.toFixed(3)}  b=sin(${node.phase.toFixed(2)})`,
      `p=(${node.x.toFixed(0)}, ${node.y.toFixed(0)}, ${node.z.toFixed(3)})`,
      `v=${speed.toFixed(2)}u/s  θ=${Math.atan2(node.vy, node.vx).toFixed(2)}rad`,
      `s(z)=${node.scale.toFixed(3)}  life=${(node.life * 100).toFixed(1)}%`,
      `wave=k·p  φ=${(clockS * WAVE_RATE - (node.x * WAVE_KX + node.y * WAVE_KY)).toFixed(2)}`,
    ];
    drawCallout(ctx, node.sx, node.sy, values[labelMode], node.energy);
  }

  // Annotate a deterministic sample of live edges with both projected angle
  // and true 3D length. The values remain aligned to the lines as they drift.
  for (let i = 0; i < n && edgeCallouts < MAX_EDGE_CALLOUTS; i++) {
    for (let j = i + 1; j < n && edgeCallouts < MAX_EDGE_CALLOUTS; j++) {
      const strength = linkState[i * n + j];
      if (strength < 0.34 || (i * 7 + j + epoch) % 11 !== 0) continue;
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = (b.z - a.z) * zWorld;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const angle = Math.atan2(b.sy - a.sy, b.sx - a.sx) * 180 / Math.PI;
      const mx = (a.sx + b.sx) * 0.5;
      const my = (a.sy + b.sy) * 0.5;
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = edgePalette[Math.min(COLOR_STEPS - 1, ((strength * COLOR_STEPS) | 0))];
      ctx.fillText(`d₃=${distance.toFixed(1)}  θ=${angle.toFixed(1)}°`, mx + 5, my - 6);
      edgeCallouts++;
    }
  }

  ctx.restore();
}

function drawCallout(ctx, x, y, text, energy) {
  const width = ctx.measureText(text).width + 12;
  const right = x < stillFieldW - width - 30;
  const tx = right ? x + 18 : x - width - 18;
  const ty = y < 42 ? y + 25 : y - 21;

  ctx.globalAlpha = 0.35 + energy * 0.35;
  ctx.strokeStyle = edgePalette[Math.min(COLOR_STEPS - 1, (energy * COLOR_STEPS) | 0)];
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(right ? tx - 4 : tx + width + 4, ty);
  ctx.stroke();

  ctx.globalAlpha = 0.84;
  ctx.fillStyle = calloutBackground;
  ctx.fillRect(tx, ty - 9, width, 18);
  ctx.strokeRect(tx, ty - 9, width, 18);
  ctx.fillStyle = nodePalette[Math.min(COLOR_STEPS - 1, (energy * COLOR_STEPS) | 0)];
  ctx.fillText(text, tx + 6, ty);
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
  if (document.visibilityState === 'hidden') return;
  // Reset the clock so the first step after a pause is a normal one rather than
  // however long the app sat idle.
  lastFrameMs = performance.now();
  lastDrawMs = lastFrameMs - FRAME_INTERVAL_MS;
  stillFieldRaf = requestAnimationFrame(frame);
}

/**
 * Stop drawing entirely while the page is hidden. A backgrounded tab still runs
 * throttled animation frames, and on a phone that is a locked screen quietly
 * spending battery for eight hours.
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    stopLoop();
  } else if (stillFieldEnabled) {
    startStillFieldLoop();
  }
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
  if (!stillFieldEnabled) telemetryEnabled = false;
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
  measureWorld(); // intensity widens the link radius
  if (stillFieldIntensity > 0.01 && stillFieldEnabled) startStillFieldLoop();
  emit();
}

/**
 * Set drift speed. Persists the choice.
 * @param {number} v multiplier, STILL_SPEED_MIN–STILL_SPEED_MAX
 */
export function setStillFieldSpeed(v) {
  stillFieldSpeed = clamp(v, STILL_SPEED_MIN, STILL_SPEED_MAX);
  write(STORAGE_KEYS.stillFieldSpeed, stillFieldSpeed);
  emit();
}

/** Enable or hide the opt-in mathematical instrumentation. */
export function setTelemetryEnabled(on) {
  telemetryEnabled = Boolean(on) && stillFieldEnabled;
  lastTelemetryMs = 0;
  emit();
}

/** Select the Field Lab view; rendering remains owned by app.js. */
export function setTelemetryTab(tab) {
  if (!['live', 'math', 'code'].includes(tab)) return;
  telemetryTab = tab;
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
