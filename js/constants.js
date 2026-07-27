/**
 * Shared constants for Complex Noise.
 * Kept in one place so AI agents and humans can find buffer sizes, fade times, and icon SVGs quickly.
 */

/** Buffer length in seconds — long enough for inaudible loop seams on stochastic signals */
export const BUFFER_DURATION = 12;

/** Fade in/out duration in seconds for smooth start/stop */
export const FADE_TIME = 0.9;

/** Clean SVG icons (simple paths — free to use, no external assets) */
export const PLAY_ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
export const PAUSE_ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

/** localStorage key prefixes — all keys are namespaced under complexNoise_ */
export const STORAGE_KEYS = {
  type: 'complexNoise_type',
  volume: 'complexNoise_volume',
  timer: 'complexNoise_timer',
  stillTheme: 'complexNoise_stillTheme',
  stillEqLow: 'complexNoise_stillEqLow',
  stillEqMid: 'complexNoise_stillEqMid',
  stillEqHigh: 'complexNoise_stillEqHigh',
  stillFieldEnabled: 'complexNoise_stillFieldEnabled',
  stillFieldIntensity: 'complexNoise_stillFieldIntensity',
};
