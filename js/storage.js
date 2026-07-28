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
 * Values written by `writeThrottled` that have not reached localStorage yet.
 *
 * Consulted first by `read`, so a deferred write is never invisible to the
 * process that made it. Anything not in here reads exactly as it always did.
 */
const pending = new Map();
let flushTimerId = null;

/**
 * How long a burst of writes is allowed to collapse into one.
 *
 * Short enough that no realistic reload can land inside the window, long enough
 * to swallow a slider drag — pointer moves arrive at 60–120 Hz, so a two-second
 * drag of the volume control is 150-odd events.
 */
const FLUSH_DELAY_MS = 150;

/**
 * Read a raw string.
 * @param {string} key
 * @returns {string|null}
 */
export function read(key) {
  // A throttled write is authoritative from the instant it is made; the delay is
  // an implementation detail of when the disk finds out, not of when the value
  // takes effect.
  if (pending.has(key)) return pending.get(key);
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
  // An immediate write supersedes anything queued for the same key.
  pending.delete(key);
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(key, str);
  } catch (err) {
    // Quota exceeded or storage revoked mid-session — keep the in-memory copy.
  }
}

/**
 * Write a value that is about to be written again.
 *
 * `localStorage.setItem` is **synchronous and persistent**: it blocks the main
 * thread while the browser serialises the whole origin's storage to disk. That
 * is invisible for a button, and it is not invisible for a slider — every
 * pointer move on the volume, EQ or Field Lab controls fired one, so dragging a
 * slider meant a hundred blocking disk writes competing with the render loop for
 * the same thread.
 *
 * Only the last value of a drag is worth keeping, so this collapses a burst into
 * one write. Reads are unaffected: `read` checks the pending value first, so the
 * setting is live immediately and merely lands on disk a moment later.
 *
 * Use it for anything driven by a continuous control. Use `write` for discrete
 * choices — a colour, a theme, a toggle — where there is no burst to collapse
 * and the extra machinery buys nothing.
 *
 * @param {string} key
 * @param {string|number|boolean} value
 */
export function writeThrottled(key, value) {
  const str = String(value);
  if (memory.get(key) === str && !pending.has(key)) return;
  memory.set(key, str);

  if (!hasLocalStorage()) return;
  pending.set(key, str);
  if (flushTimerId === null) {
    flushTimerId = setTimeout(flushWrites, FLUSH_DELAY_MS);
  }
}

/**
 * Push every deferred write to localStorage now.
 *
 * Called on the timer, and eagerly whenever the page might be about to go away.
 * A phone that is backgrounded mid-drag can be killed without ever running
 * another timer, so `pagehide` and the hidden transition are the two moments
 * where the delay has to be cashed in rather than waited out.
 */
export function flushWrites() {
  if (flushTimerId !== null) {
    clearTimeout(flushTimerId);
    flushTimerId = null;
  }
  if (!pending.size) return;

  for (const [key, value] of pending) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      // Quota exceeded or storage revoked mid-session — the in-memory copy in
      // `memory` still carries the value for the rest of the session.
    }
  }
  pending.clear();
}

if (typeof window !== 'undefined') {
  // `pagehide` fires on the mobile bfcache path where `beforeunload` does not.
  window.addEventListener('pagehide', flushWrites);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushWrites();
  });
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
