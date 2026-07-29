/**
 * Still Field settings — the values a user can change, and the snapshot the UI
 * renders from.
 *
 * ## What lives here
 *
 * Every persisted preference is read once at import time, clamped to the range
 * `constants.js` declares, and kept on the exported `settings` object. Other
 * modules read `settings.speed` directly; an imported binding is read-only in
 * ES modules, so a shared object is what makes one owner and many readers
 * possible at all. **Only this file assigns to it.**
 *
 * ## What deliberately does not live here
 *
 * The setters below do exactly two things: clamp-and-store, and persist. They
 * do not remeasure the world, restart the loop or clear a canvas, because a
 * settings module that reaches into the renderer is a settings module that
 * cannot be read without reading the renderer too. Those side effects are
 * composed in `js/still-field.js`, which is the only file allowed to know the
 * order they must happen in.
 */

import {
  STORAGE_KEYS, DEFAULTS,
  STILL_SPEED_MIN, STILL_SPEED_MAX,
  STILL_DENSITY_MIN, STILL_DENSITY_MAX,
  STILL_REACH_MIN, STILL_REACH_MAX,
  STILL_TRAIL_MIN, STILL_TRAIL_MAX,
  STILL_DEPTH_MIN, STILL_DEPTH_MAX,
  STILL_DWELL_MIN, STILL_DWELL_MAX,
  STILL_FPS_OPTIONS,
} from '../constants.js';
import { write, writeThrottled, readNumber, readBool, clamp } from '../storage.js';

/** A stored frame cap is only honoured if it is still one of the offered caps. */
function readFps() {
  const stored = readNumber(STORAGE_KEYS.stillFieldFps, DEFAULTS.stillFieldFps);
  return STILL_FPS_OPTIONS.includes(stored) ? stored : DEFAULTS.stillFieldFps;
}

/**
 * Live settings. Read from anywhere, written only by this module.
 *
 * The last three are session-only: a fold is a "not right now", not a
 * preference, and reloading should return to the useful default rather than to
 * whatever state you left a panel in last night.
 */
export const settings = {
  enabled: readBool(STORAGE_KEYS.stillFieldEnabled, DEFAULTS.stillFieldEnabled),
  intensity: clamp(readNumber(STORAGE_KEYS.stillFieldIntensity, DEFAULTS.stillFieldIntensity), 0, 1),
  speed: clamp(readNumber(STORAGE_KEYS.stillFieldSpeed, DEFAULTS.stillFieldSpeed),
    STILL_SPEED_MIN, STILL_SPEED_MAX),
  nerd: readBool(STORAGE_KEYS.stillFieldNerd, DEFAULTS.stillFieldNerd),
  texture: readBool(STORAGE_KEYS.stillFieldTexture, DEFAULTS.stillFieldTexture),
  density: clamp(readNumber(STORAGE_KEYS.stillFieldDensity, DEFAULTS.stillFieldDensity),
    STILL_DENSITY_MIN, STILL_DENSITY_MAX),
  reach: clamp(readNumber(STORAGE_KEYS.stillFieldReach, DEFAULTS.stillFieldReach),
    STILL_REACH_MIN, STILL_REACH_MAX),
  trail: clamp(readNumber(STORAGE_KEYS.stillFieldTrail, DEFAULTS.stillFieldTrail),
    STILL_TRAIL_MIN, STILL_TRAIL_MAX),
  depth: clamp(readNumber(STORAGE_KEYS.stillFieldDepth, DEFAULTS.stillFieldDepth),
    STILL_DEPTH_MIN, STILL_DEPTH_MAX),
  dwell: clamp(readNumber(STORAGE_KEYS.stillFieldDwell, DEFAULTS.stillFieldDwell),
    STILL_DWELL_MIN, STILL_DWELL_MAX),
  fps: readFps(),
  code: readBool(STORAGE_KEYS.stillFieldCode, DEFAULTS.stillFieldCode),
  callouts: readBool(STORAGE_KEYS.stillFieldCallouts, DEFAULTS.stillFieldCallouts),
  edges: readBool(STORAGE_KEYS.stillFieldEdges, DEFAULTS.stillFieldEdges),

  /** Which HUD view is showing. Session-only: a reload returns to Live. */
  nerdView: 'live',
  /**
   * Session-only fold for the HUD panel. Folded by default on narrow viewports
   * so the main interface is not blocked on first open.
   */
  nerdFolded: typeof window !== 'undefined' && window.innerWidth <= 520,
  /**
   * Session-only fold for the on-canvas source listing. Folding leaves the
   * header bar, which is both the affordance and the reminder it is there.
   */
  codeFolded: false,
};

// ----------------------------------------------------------
// Publication (mirrors the pattern in audio.js)
// ----------------------------------------------------------

const listeners = new Set();

/**
 * A snapshot of everything the UI renders from.
 *
 * A fresh object per call, deliberately: subscribers are free to hold it, and
 * handing out the live `settings` object would let a renderer see a half-applied
 * change. This runs on user input, not per frame, so the allocation is free.
 *
 * @returns {{enabled: boolean, intensity: number, speed: number, nerd: boolean,
 *   texture: boolean, nerdView: string, nerdFolded: boolean, density: number,
 *   reach: number, trail: number, depth: number, dwell: number, fps: number,
 *   code: boolean, codeFolded: boolean, callouts: boolean, edges: boolean}}
 */
export function getState() {
  return {
    enabled: settings.enabled,
    intensity: settings.intensity,
    speed: settings.speed,
    nerd: settings.nerd,
    texture: settings.texture,
    nerdView: settings.nerdView,
    nerdFolded: settings.nerdFolded,
    density: settings.density,
    reach: settings.reach,
    trail: settings.trail,
    depth: settings.depth,
    dwell: settings.dwell,
    fps: settings.fps,
    code: settings.code,
    codeFolded: settings.codeFolded,
    callouts: settings.callouts,
    edges: settings.edges,
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

/** Publish the current snapshot to every subscriber. */
export function emit() {
  const snapshot = getState();
  listeners.forEach(fn => fn(snapshot));
}

// ----------------------------------------------------------
// Setters — clamp, store, persist. Nothing else.
//
// Continuous controls (sliders) use writeThrottled: `input` fires at
// pointer-move rate and localStorage.setItem is synchronous, so a
// straight-through write is ~60 blocking disk writes a second competing with
// the render loop. Discrete choices go straight to disk on the click.
// ----------------------------------------------------------

export function setEnabled(on) {
  settings.enabled = Boolean(on);
  write(STORAGE_KEYS.stillFieldEnabled, settings.enabled);
}

export function setIntensity(v) {
  settings.intensity = clamp(v, 0, 1);
  writeThrottled(STORAGE_KEYS.stillFieldIntensity, settings.intensity);
}

export function setSpeed(v) {
  settings.speed = clamp(v, STILL_SPEED_MIN, STILL_SPEED_MAX);
  writeThrottled(STORAGE_KEYS.stillFieldSpeed, settings.speed);
}

export function setNerd(on) {
  settings.nerd = Boolean(on);
  write(STORAGE_KEYS.stillFieldNerd, settings.nerd);
}

export function setTexture(on) {
  settings.texture = Boolean(on);
  write(STORAGE_KEYS.stillFieldTexture, settings.texture);
}

export function setDensity(v) {
  settings.density = clamp(v, STILL_DENSITY_MIN, STILL_DENSITY_MAX);
  writeThrottled(STORAGE_KEYS.stillFieldDensity, settings.density);
}

export function setReach(v) {
  settings.reach = clamp(v, STILL_REACH_MIN, STILL_REACH_MAX);
  writeThrottled(STORAGE_KEYS.stillFieldReach, settings.reach);
}

export function setTrail(v) {
  settings.trail = clamp(v, STILL_TRAIL_MIN, STILL_TRAIL_MAX);
  writeThrottled(STORAGE_KEYS.stillFieldTrail, settings.trail);
}

export function setDepth(v) {
  settings.depth = clamp(v, STILL_DEPTH_MIN, STILL_DEPTH_MAX);
  writeThrottled(STORAGE_KEYS.stillFieldDepth, settings.depth);
}

export function setDwell(v) {
  settings.dwell = clamp(v, STILL_DWELL_MIN, STILL_DWELL_MAX);
  writeThrottled(STORAGE_KEYS.stillFieldDwell, settings.dwell);
}

/**
 * Frame-rate cap. Rejects anything the Lab does not offer rather than clamping,
 * because there is no sensible nearest value between 30 and 60.
 * @returns {boolean} whether the cap changed
 */
export function setFps(v) {
  const next = Number(v);
  if (!STILL_FPS_OPTIONS.includes(next)) return false;
  settings.fps = next;
  write(STORAGE_KEYS.stillFieldFps, settings.fps);
  return true;
}

export function setCode(on) {
  settings.code = Boolean(on);
  write(STORAGE_KEYS.stillFieldCode, settings.code);
}

export function setCallouts(on) {
  settings.callouts = Boolean(on);
  write(STORAGE_KEYS.stillFieldCallouts, settings.callouts);
}

export function setEdges(on) {
  settings.edges = Boolean(on);
  write(STORAGE_KEYS.stillFieldEdges, settings.edges);
}

/** Session-only. @returns {boolean} whether the view is a known one */
export function setNerdView(view) {
  if (view !== 'live' && view !== 'math' && view !== 'code') return false;
  settings.nerdView = view;
  return true;
}

/** Session-only. */
export function setNerdFolded(folded) {
  settings.nerdFolded = Boolean(folded);
}

/** Session-only. */
export function setCodeFolded(folded) {
  settings.codeFolded = Boolean(folded);
}
