/**
 * UI chrome visibility — immersion mode for sleep.
 *
 * When hidden, the main controls leave the screen so the Still Field can fill
 * the night; a floating restore button (rendered by app.js) brings them back.
 * State is published the same way as audio / theme / still-field: this module
 * never touches the DOM.
 */

import { STORAGE_KEYS, DEFAULTS } from './constants.js';
import { write, readBool } from './storage.js';

let chromeHidden = readBool(STORAGE_KEYS.uiChromeHidden, DEFAULTS.uiChromeHidden);

const listeners = new Set();

/**
 * @returns {{hidden: boolean}}
 */
export function getState() {
  return { hidden: chromeHidden };
}

/**
 * Subscribe to chrome visibility changes. Fires immediately with current state.
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

/** @returns {boolean} */
export function isHidden() {
  return chromeHidden;
}

/**
 * Show or hide the main UI chrome. Persists the choice.
 * @param {boolean} hidden
 */
export function setHidden(hidden) {
  chromeHidden = Boolean(hidden);
  write(STORAGE_KEYS.uiChromeHidden, chromeHidden);
  emit();
}

/** Flip between visible and hidden chrome. */
export function toggle() {
  setHidden(!chromeHidden);
}
