/**
 * Shared constants for Complex Noise.
 * Kept in one place so AI agents and humans can find buffer sizes, fade times,
 * icon SVGs, valid ranges, and storage keys quickly.
 */

/** Buffer length in seconds — long enough for inaudible loop seams on stochastic signals */
export const BUFFER_DURATION = 12;

/** Fade in/out duration in seconds for smooth start/stop */
export const FADE_TIME = 0.9;

/** Cross-fade timings used when switching noise type mid-playback (seconds) */
export const TYPE_SWITCH_FADE_OUT = 0.15;
export const TYPE_SWITCH_FADE_IN = 0.25;

/** Noise types the UI and generator both understand. Add new colours here first. */
export const NOISE_TYPES = ['brown', 'pink', 'white'];

/** Themes supported by css/styles.css via [data-still-theme] */
export const THEMES = ['dark', 'bone'];

/** Glass surface modes supported by css/styles.css via [data-glass] */
export const GLASS_MODES = ['standard', 'ultra'];

/** Defaults applied when nothing is persisted yet */
export const DEFAULTS = {
  type: 'brown',
  volume: 0.22,
  timerHours: 0,
  theme: 'dark',
  eq: 0,
  stillFieldEnabled: true,
  stillFieldIntensity: 0.7,
  stillFieldSpeed: 2.0,
  stillGlassTransparent: false,
  uiChromeHidden: false,
};

/** EQ gain range in dB — must match the slider min/max in index.html */
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;

/**
 * Still Field drift speed multiplier — must match the slider min/max in
 * index.html. The previous maximum (2.0) is now the default medium so the
 * field feels alive; the new max (4.0) is for people who want more motion.
 */
export const STILL_SPEED_MIN = 0.5;
export const STILL_SPEED_MAX = 4.0;

/** Clean SVG icons (simple paths — free to use, no external assets) */
export const PLAY_ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
export const PAUSE_ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

/** localStorage keys — all namespaced under complexNoise_ */
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
  stillFieldSpeed: 'complexNoise_stillFieldSpeed',
  stillGlassTransparent: 'complexNoise_stillGlassTransparent',
  uiChromeHidden: 'complexNoise_uiChromeHidden',
};
