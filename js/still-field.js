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
 * ## This file is the front door
 *
 * The renderer lives in `js/still-field/`, one module per concern. This file is
 * the **composition root**: it owns the public API, and it is the only place
 * that knows the order in which a setting change has to reach the other
 * modules. `settings.js` clamps and persists a value; deciding that changing
 * the depth also means remeasuring the world *and then* re-counting the nodes
 * happens here, once, where it can be read.
 *
 *     settings.js      what the user chose, and the snapshot the UI renders
 *     view.js          the two canvases, the viewport, the device
 *     world.js         the world plane, the projection, the link radius
 *     grid.js          a uniform spatial grid over a rectangle
 *     math.js          φ, τ, smoothstep
 *     clock.js         the drift clock and the diagnostics clock
 *     palette.js       theme colours, pre-quantised into ramps
 *     energy.js        the three energy layers and the CSS mirror
 *     keep-outs.js     screen rectangles the info layer must avoid
 *     telemetry.js     counters the renderer writes and the HUD reads
 *     audio-metrics.js frequency-band energy from the analyser
 *     nodes.js         the population: model, lifecycle, one simulation step
 *     link-pass.js     the lattice, its envelopes, batching and telemetry
 *     node-pass.js     the nodes, flat then glowing
 *     modes.js         the callout detail modes and their rotation
 *     callout-content.js  what a callout says: the eight detail-mode branches
 *     callouts.js      node callouts: selection, placement, paint
 *     edge-labels.js   edge dimensions: slots, quantised text, paint
 *     code-lines.js    the transcript the source overlay prints
 *     code-ticker.js   the on-canvas source listing
 *     loop.js          one frame, and the loop control around it
 *     stats.js         the public statistics snapshot
 *
 * ## Contract
 *
 * The renderer owns exactly two DOM elements: the field canvas and the info
 * canvas handed to `initStillField()`. It never queries the document for
 * anything else, and it never measures layout — `app.js` pushes the rectangles
 * to avoid via `setLabelKeepOuts()`. UI controls are rendered by `app.js` from
 * the snapshot published via `subscribe()`.
 */

import { applyCanvasVisibility, clearFieldCanvas, clearInfoCanvas, surfaces, watchReducedMotion } from './still-field/view.js';
import { settings, emit } from './still-field/settings.js';
import * as prefs from './still-field/settings.js';
import { measureWorld } from './still-field/world.js';
import { population, initNodes, applyNodeCount, resizeField } from './still-field/nodes.js';
import { energy, publishEnergy } from './still-field/energy.js';
import { refreshThemeColors } from './still-field/palette.js';
import { resetNodeCallout } from './still-field/callouts.js';
import { resetEdgeSlots } from './still-field/edge-labels.js';
import { hitsCodeHeader } from './still-field/code-ticker.js';
import { telemetry, resetInstrumentation } from './still-field/telemetry.js';
import { startLoop, stopLoop, handleVisibilityChange } from './still-field/loop.js';

export { getState, subscribe } from './still-field/settings.js';
export { getStillFieldStats } from './still-field/stats.js';
export { getStillAudioMetrics } from './still-field/audio-metrics.js';
export { setLabelKeepOuts } from './still-field/keep-outs.js';
export { refreshThemeColors } from './still-field/palette.js';

/** Debounce window for resize — mobile browsers fire it on every URL-bar nudge. */
const RESIZE_DEBOUNCE_MS = 150;

let resizeDebounceId = null;

// ----------------------------------------------------------
// Setup
// ----------------------------------------------------------

/**
 * Call once after the DOM is ready.
 * @param {HTMLCanvasElement} canvas the full-viewport field canvas
 * @param {HTMLCanvasElement} [overlay] the full-viewport info canvas. Text is
 *   drawn here, never on the field canvas — see the note in view.js on why.
 */
export function initStillField(canvas, overlay) {
  surfaces.field = canvas;
  surfaces.fieldCtx = canvas.getContext('2d', { alpha: true });
  if (overlay) {
    surfaces.info = overlay;
    surfaces.infoCtx = overlay.getContext('2d', { alpha: true });
    surfaces.hasRoundRect = typeof surfaces.infoCtx.roundRect === 'function';
  }

  refreshThemeColors();
  resizeField();
  initNodes();
  applyCanvasVisibility(settings.enabled);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  watchReducedMotion();

  if (settings.enabled) startLoop();
}

/**
 * (Re)seed the field. `force = true` discards existing positions.
 *
 * Deliberately not called by any control. It exists so an agent or a test can
 * put the field back to a known population without reloading the page — the R2
 * spawn sequence, the lifetime stagger and the link buffer all reset together,
 * which is otherwise only reachable at boot. `app.js` exposes it on
 * `window.complexNoiseStill.reseedNodes` for exactly that.
 *
 * Not to be confused with `startStillFieldLoop`, which *is* on a path a user
 * takes: `togglePlayback()` calls it after `audio.play()` resolves, so a field
 * that stopped while the page was hidden comes back with the sound.
 *
 * @param {boolean} [force=false]
 */
export function initStillFieldNodes(force = false) {
  initNodes(force);
}

/** Start the render loop if it is not already running. */
export function startStillFieldLoop() {
  startLoop();
}

/**
 * Handle a viewport resize. Debounced — mobile browsers fire `resize` on every
 * address-bar show/hide, and re-laying-out the canvas is not free.
 */
export function handleResize() {
  if (resizeDebounceId) clearTimeout(resizeDebounceId);
  resizeDebounceId = setTimeout(() => {
    resizeDebounceId = null;
    resizeField();
  }, RESIZE_DEBOUNCE_MS);
}

/**
 * Route a pointer press at viewport coordinates to the source overlay.
 *
 * The overlay is canvas, so it cannot be a button — but a listing you can only
 * dismiss from a panel two scrolls away is a listing people leave switched off.
 * `app.js` calls this for presses that landed on the page background.
 *
 * @param {number} x viewport CSS px
 * @param {number} y viewport CSS px
 * @returns {boolean} true if the overlay consumed the press
 */
export function handleOverlayPointer(x, y) {
  if (!settings.enabled || !settings.nerd) return false;
  if (!hitsCodeHeader(x, y)) return false;
  setCodeFolded(!settings.codeFolded);
  return true;
}

// ----------------------------------------------------------
// Readers
// ----------------------------------------------------------

export function getStillFieldEnabled() { return settings.enabled; }
export function getStillFieldIntensity() { return settings.intensity; }
export function getStillFieldSpeed() { return settings.speed; }
export function getStillFieldNerd() { return settings.nerd; }
export function getStillFieldTexture() { return settings.texture; }
export function getStillFieldCode() { return settings.code; }
/** Are node callouts being painted on the canvas? */
export function getStillFieldCallouts() { return settings.callouts; }
/** Are edge dimensions being painted on the canvas? */
export function getStillFieldEdges() { return settings.edges; }
export function getNerdFolded() { return settings.nerdFolded; }
/** Mean seconds a callout mode holds before the field rotates it. */
export function getStillFieldDwell() { return settings.dwell; }
/** Cap in frames per second the render loop is currently honouring. */
export function getStillFieldFps() { return settings.fps; }
/** The field's smoothed 0–1 energy, mirrored to `--still-energy`. */
export function getStillEnergy() { return energy.level; }

// ----------------------------------------------------------
// Settings
//
// Each of these is "store it, then do whatever else has to happen, then
// publish". The order is the interesting part and it lives here rather than in
// settings.js, so that reading how a control behaves never means reading the
// renderer.
// ----------------------------------------------------------

/**
 * Turn the visualisation on or off. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldEnabled(on) {
  prefs.setEnabled(on);
  applyCanvasVisibility(settings.enabled);

  if (settings.enabled) {
    startLoop();
  } else {
    stopLoop();
    energy.level = 0;
    publishEnergy(0);
    clearFieldCanvas();
    clearInfoCanvas(true);
  }
  emit();
}

/**
 * Set visual intensity. Persists the choice.
 * @param {number} v 0–1
 */
export function setStillFieldIntensity(v) {
  prefs.setIntensity(v);
  measureWorld(population.nodes.length); // intensity widens the link radius
  if (settings.intensity > 0.01 && settings.enabled) startLoop();
  emit();
}

/**
 * Set drift speed. Persists the choice.
 * @param {number} v multiplier, STILL_SPEED_MIN–STILL_SPEED_MAX
 */
export function setStillFieldSpeed(v) {
  prefs.setSpeed(v);
  emit();
}

/**
 * Toggle the nerd / info layer. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldNerd(on) {
  prefs.setNerd(on);
  if (!settings.nerd) {
    resetInstrumentation();
    resetEdgeSlots();
    clearInfoCanvas(true);
  }
  emit();
}

/**
 * Node population multiplier. Persists the choice.
 * @param {number} v STILL_DENSITY_MIN–STILL_DENSITY_MAX
 */
export function setStillFieldDensity(v) {
  prefs.setDensity(v);
  applyNodeCount();
  emit();
}

/**
 * Link radius multiplier. Persists the choice.
 * @param {number} v STILL_REACH_MIN–STILL_REACH_MAX
 */
export function setStillFieldReach(v) {
  prefs.setReach(v);
  measureWorld(population.nodes.length);
  emit();
}

/**
 * Trail decay rate, per second. Lower leaves a longer comet tail.
 * @param {number} v STILL_TRAIL_MIN–STILL_TRAIL_MAX
 */
export function setStillFieldTrail(v) {
  prefs.setTrail(v);
  emit();
}

/**
 * Perspective strength. Persists the choice, and re-derives the world plane —
 * the world is sized so the far plane still fills the viewport, and the far
 * plane moves when depth does.
 * @param {number} v STILL_DEPTH_MIN–STILL_DEPTH_MAX
 */
export function setStillFieldDepth(v) {
  prefs.setDepth(v);
  measureWorld(population.nodes.length);
  applyNodeCount();
  emit();
}

/**
 * Mean seconds a callout detail mode holds. The actual per-mode dwell is this
 * scaled by that mode's golden-ratio weight — see MODE_WEIGHTS in modes.js.
 * @param {number} v STILL_DWELL_MIN–STILL_DWELL_MAX
 */
export function setStillFieldDwell(v) {
  prefs.setDwell(v);
  emit();
}

/**
 * Frame-rate cap. Motion is integrated from elapsed time, so this changes how
 * smooth the field looks and nothing about how fast it drifts.
 * @param {number} v one of STILL_FPS_OPTIONS
 */
export function setStillFieldFps(v) {
  if (!prefs.setFps(v)) return;
  emit();
}

/**
 * Toggle the on-canvas source ticker. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldCode(on) {
  prefs.setCode(on);
  emit();
}

/**
 * Toggle the on-canvas node callouts. Persists the choice.
 *
 * Independent of the edge dimensions and the source listing: the three overlays
 * cost different amounts and suit different moods, and one switch for all three
 * meant wanting quiet edges cost you the callouts too.
 * @param {boolean} on
 */
export function setStillFieldCallouts(on) {
  prefs.setCallouts(on);
  if (!settings.callouts) {
    // Drop every hold, or re-enabling would pop a screenful of callouts back in
    // at whatever opacity they froze at.
    for (const node of population.nodes) resetNodeCallout(node);
    telemetry.labels = 0;
    telemetry.modesOnScreen = 0;
  }
  emit();
}

/**
 * Toggle the on-canvas edge dimensions. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldEdges(on) {
  prefs.setEdges(on);
  if (!settings.edges) {
    resetEdgeSlots();
    telemetry.edgeLabels = 0;
  }
  emit();
}

/**
 * Fold or expand the on-canvas source listing. Session-only, like the HUD's
 * fold: the persisted setting is whether the overlay exists at all.
 * @param {boolean} folded
 */
export function setCodeFolded(folded) {
  prefs.setCodeFolded(folded);
  emit();
}

/**
 * Fold or expand the stats HUD. Session-only (does not persist).
 * @param {boolean} folded
 */
export function setNerdFolded(folded) {
  prefs.setNerdFolded(folded);
  emit();
}

/** Toggle the fold state of the stats HUD. */
export function toggleNerdFolded() {
  setNerdFolded(!settings.nerdFolded);
}

/**
 * Select the integrated information view. This is intentionally session-only:
 * reloading returns to the useful live overview.
 * @param {'live'|'math'|'code'} view
 */
export function setNerdView(view) {
  if (!prefs.setNerdView(view)) return;
  emit();
}

/**
 * Toggle the secondary background texture. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldTexture(on) {
  prefs.setTexture(on);
  emit();
}
