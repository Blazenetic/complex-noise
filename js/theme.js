/**
 * Still Theme management.
 *
 * Applies data-still-theme attribute, updates meta theme-color / color-scheme,
 * and persists preference. Calls an optional onThemeChange callback so
 * Still Field can re-seed node colours immediately.
 */

import { STORAGE_KEYS } from './constants.js';

let stillTheme = localStorage.getItem(STORAGE_KEYS.stillTheme) || 'dark';

/**
 * @returns {'dark'|'bone'}
 */
export function getStillTheme() {
  return stillTheme;
}

/**
 * Apply a theme and persist it.
 * @param {'dark'|'bone'} theme
 * @param {(theme: string) => void} [onThemeChange] optional callback (e.g. re-seed Still Field)
 */
export function applyStillTheme(theme, onThemeChange) {
  stillTheme = theme;
  document.documentElement.setAttribute('data-still-theme', theme);
  localStorage.setItem(STORAGE_KEYS.stillTheme, theme);

  const isBone = theme === 'bone';
  const themeColorMeta = document.getElementById('themeColorMeta');
  if (themeColorMeta) themeColorMeta.content = isBone ? '#F4F0E8' : '#0C0C11';

  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (schemeMeta) schemeMeta.content = isBone ? 'light' : 'dark';

  // Update toggle UI if present
  const icon = document.getElementById('stillThemeIcon');
  const label = document.getElementById('stillThemeLabel');
  if (icon) icon.textContent = isBone ? '◑' : '◐';
  if (label) label.textContent = isBone ? 'Still · Bone' : 'Still · Dark';

  if (onThemeChange) onThemeChange(theme);
}

/**
 * Toggle between dark and bone.
 * @param {(theme: string) => void} [onThemeChange]
 */
export function toggleStillTheme(onThemeChange) {
  applyStillTheme(stillTheme === 'dark' ? 'bone' : 'dark', onThemeChange);
}
