/**
 * Still Theme management.
 *
 * Owns two attributes on <html> — `data-still-theme` (dark ↔ bone) and
 * `data-glass` (how transparent the control surfaces are) — plus the two meta
 * tags that must follow the theme: `theme-color` drives the Android browser
 * chrome, and `color-scheme` drives native form control rendering.
 *
 * Like audio.js and still-field.js, this module publishes state rather than
 * updating widgets itself — app.js renders the toggle's icon and label.
 *
 * Adding a third theme: add its token block to css/styles.css under
 * `[data-still-theme="..."]`, add the name to THEMES in constants.js, and give
 * it an entry in THEME_META below.
 */

import { STORAGE_KEYS, THEMES, GLASS_MODES, DEFAULTS } from './constants.js';
import { write, readEnum, readBool } from './storage.js';

/** Per-theme browser chrome colours, keyed by theme name. */
export const THEME_META = {
  dark: { themeColor: '#0C0C11', colorScheme: 'dark' },
  // Deep bone — denser, less creamy, premium stone-white feel
  bone: { themeColor: '#E0D6C8', colorScheme: 'light' },
};

let stillTheme = readEnum(STORAGE_KEYS.stillTheme, THEMES, DEFAULTS.theme);
let glassMode = readBool(STORAGE_KEYS.stillGlassTransparent, DEFAULTS.stillGlassTransparent)
  ? 'ultra'
  : 'standard';

const listeners = new Set();

/** @returns {'dark'|'bone'} */
export function getStillTheme() {
  return stillTheme;
}

/** @returns {'standard'|'ultra'} */
export function getGlassMode() {
  return glassMode;
}

/**
 * @returns {{theme: 'dark'|'bone', glass: 'standard'|'ultra'}}
 */
export function getState() {
  return { theme: stillTheme, glass: glassMode };
}

/**
 * Subscribe to theme changes. Fires immediately with the current state.
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

/**
 * Apply a theme and persist it.
 * @param {'dark'|'bone'} theme
 */
export function applyStillTheme(theme) {
  if (!THEMES.includes(theme)) return;
  stillTheme = theme;

  document.documentElement.setAttribute('data-still-theme', theme);
  document.documentElement.setAttribute('data-glass', glassMode);
  write(STORAGE_KEYS.stillTheme, theme);

  const meta = THEME_META[theme] || THEME_META.dark;
  const themeColorMeta = document.getElementById('themeColorMeta');
  if (themeColorMeta) themeColorMeta.content = meta.themeColor;

  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (schemeMeta) schemeMeta.content = meta.colorScheme;

  emit();
}

/** Cycle to the next theme (currently dark ↔ bone). */
export function toggleStillTheme() {
  const next = THEMES[(THEMES.indexOf(stillTheme) + 1) % THEMES.length];
  applyStillTheme(next);
}

/**
 * Choose how transparent the control surfaces are. `ultra` drops their opacity
 * far enough for the Still Field to read through them; it is a separate axis
 * from the light/dark theme, so both combinations are valid.
 * @param {'standard'|'ultra'} mode
 */
export function setGlassMode(mode) {
  if (!GLASS_MODES.includes(mode)) return;
  glassMode = mode;
  document.documentElement.setAttribute('data-glass', glassMode);
  write(STORAGE_KEYS.stillGlassTransparent, glassMode === 'ultra');
  emit();
}

/** Flip between the standard and ultra-transparent glass surfaces. */
export function toggleGlassMode() {
  setGlassMode(glassMode === 'ultra' ? 'standard' : 'ultra');
}
