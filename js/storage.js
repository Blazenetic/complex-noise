/**
 * Safe localStorage wrapper.
 *
 * Why this module exists:
 * - `localStorage` **throws** on access in Safari Private Browsing and when a
 *   browser has site data disabled. Every module reads persisted state at
 *   import time, so an unguarded read would take the whole app down before the
 *   first frame. Everything here degrades to an in-memory fallback instead.
 * - Numeric reads used to be written as `parseFloat(...) || fallback`, which
 *   silently discards a legitimately stored `0` (a user who sets volume to 0
 *   got 0.4 back on reload). `readNumber` only falls back on NaN.
 *
 * Extension point for AI agents: add new persisted settings by adding a key to
 * STORAGE_KEYS in constants.js, then read/write it through these helpers —
 * never touch `localStorage` directly.
 */

/** In-memory fallback used when localStorage is unavailable. */
const memory = new Map();

/** @type {boolean|null} lazily probed once */
let available = null;

function hasLocalStorage() {
  if (available !== null) return available;
  try {
    const probe = '__complexNoise_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    available = true;
  } catch (err) {
    available = false;
  }
  return available;
}

/**
 * Read a raw string.
 * @param {string} key
 * @returns {string|null}
 */
export function read(key) {
  if (!hasLocalStorage()) return memory.has(key) ? memory.get(key) : null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

/**
 * Write a value (coerced to string). Never throws.
 * @param {string} key
 * @param {string|number|boolean} value
 */
export function write(key, value) {
  const str = String(value);
  memory.set(key, str);
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(key, str);
  } catch (err) {
    // Quota exceeded or storage revoked mid-session — keep the in-memory copy.
  }
}

/**
 * Read a number, falling back only when the stored value is missing or NaN.
 * A stored `0` is returned as `0`.
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
export function readNumber(key, fallback) {
  const parsed = parseFloat(read(key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Read a boolean stored as the string "true" / "false".
 * @param {string} key
 * @param {boolean} fallback used when the key has never been written
 * @returns {boolean}
 */
export function readBool(key, fallback) {
  const raw = read(key);
  if (raw === null) return fallback;
  return raw === 'true';
}

/**
 * Read a value constrained to a known set of options.
 * @template T
 * @param {string} key
 * @param {readonly T[]} allowed
 * @param {T} fallback
 * @returns {T}
 */
export function readEnum(key, allowed, fallback) {
  const raw = read(key);
  return allowed.includes(raw) ? raw : fallback;
}

/**
 * Clamp helper for restoring persisted values that must stay in range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
