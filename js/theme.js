/**
 * Still Theme management.
 *
 * Owns the `data-still-theme` attribute on <html> and the two meta tags that
 * must follow it (`theme-color` drives the Android browser chrome, and
 * `color-scheme` drives native form control rendering).
 *
 * Like audio.js and still-field.js, this module publishes state rather than
 * updating widgets itself — app.js renders the toggle's icon and label.
 *
 * Adding a third theme: add its token block to css/styles.css under
 * `[data-still-theme="..."]`, add the name to THEMES in constants.js, and give
 * it an entry in THEME_META below.
 */

import { STORAGE_KEYS, THEMES, DEFAULTS } from './constants.js';
import { write, readEnum } from './storage.js';

/** Per-theme browser chrome colours, keyed by theme name. */
export const THEME_META = {
  dark: { themeColor: '#0C0C11', colorScheme: 'dark' },
  bone: { themeColor: '#F4F0E8', colorScheme: 'light' },
};

let stillTheme = readEnum(STORAGE_KEYS.stillTheme, THEMES, DEFAULTS.theme);

const listeners = new Set();

/** @returns {'dark'|'bone'} */
export function getStillTheme() {
  return stillTheme;
}

/**
 * Subscribe to theme changes. Fires immediately with the current theme.
 * @param {(theme: string) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  listeners.add(fn);
  fn(stillTheme);
  return () => listeners.delete(fn);
}

/**
 * Apply a theme and persist it.
 * @param {'dark'|'bone'} theme
 */
export function applyStillTheme(theme) {
  if (!THEMES.includes(theme)) return;
  stillTheme = theme;

  document.documentElement.setAttribute('data-still-theme', theme);
  write(STORAGE_KEYS.stillTheme, theme);

  const meta = THEME_META[theme] || THEME_META.dark;
  const themeColorMeta = document.getElementById('themeColorMeta');
  if (themeColorMeta) themeColorMeta.content = meta.themeColor;

  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (schemeMeta) schemeMeta.content = meta.colorScheme;

  listeners.forEach(fn => fn(stillTheme));
}

/** Cycle to the next theme (currently dark ↔ bone). */
export function toggleStillTheme() {
  const next = THEMES[(THEMES.indexOf(stillTheme) + 1) % THEMES.length];
  applyStillTheme(next);
}
