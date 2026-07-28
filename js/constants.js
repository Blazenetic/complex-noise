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
export const NOISE_TYPES = ['brown', 'pink', 'white', 'green', 'fan', 'rain'];

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
  stillFieldNerd: true,
  stillFieldTexture: true,
  stillGlassTransparent: false,
  uiChromeHidden: false,
  // Field Lab — the advanced panel under the equaliser. Every default here
  // reproduces the behaviour the field had before the panel existed, so a
  // first-run session looks exactly as it always did.
  stillFieldDensity: 1.0,
  stillFieldReach: 1.0,
  stillFieldTrail: 8.2,
  stillFieldDepth: 0.75,
  stillFieldDwell: 14,
  stillFieldFps: 30,
  stillFieldCode: true,
  // The three on-canvas overlays, each independently switchable. All on, so a
  // first-run session looks exactly as it did when they were one setting.
  stillFieldCallouts: true,
  stillFieldEdges: true,
};

/** EQ gain range in dB — must match the slider min/max in index.html */
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;

/**
 * Still Field drift speed multiplier — must match the slider min/max in
 * index.html. Practical floor raised so the field never feels stuck; ceiling
 * modestly raised for users who want more motion. Default stays calm at 2.0.
 */
export const STILL_SPEED_MIN = 0.7;
export const STILL_SPEED_MAX = 4.8;

/**
 * Field Lab ranges — every one of these must match the matching slider's
 * `min`/`max` in index.html, because the module clamps to these and the slider
 * clamps to those, and a mismatch shows up as a control that refuses to reach
 * its own end stop.
 */
/** Node population multiplier against the viewport-derived target. */
export const STILL_DENSITY_MIN = 0.5;
export const STILL_DENSITY_MAX = 2.2;
/** Link radius multiplier — how far a node looks for neighbours. */
export const STILL_REACH_MIN = 0.6;
export const STILL_REACH_MAX = 1.6;
/**
 * Trail decay rate in *reciprocal seconds*, not a per-frame alpha. The frame
 * rate is now user-selectable, and a per-frame constant would silently shorten
 * every trail the moment the cap moved from 30 to 60.
 */
export const STILL_TRAIL_MIN = 2;
export const STILL_TRAIL_MAX = 26;
/** Perspective strength; see the DEPTH note in still-field.js. */
export const STILL_DEPTH_MIN = 0.3;
export const STILL_DEPTH_MAX = 1.6;
/** Base seconds a callout detail mode holds before the field rotates it. */
export const STILL_DWELL_MIN = 4;
export const STILL_DWELL_MAX = 26;
/** Frame-rate caps offered by the Field Lab. 30 stays the default. */
export const STILL_FPS_OPTIONS = [30, 45, 60];

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
  stillFieldNerd: 'complexNoise_stillFieldNerd',
  stillFieldTexture: 'complexNoise_stillFieldTexture',
  stillFieldDensity: 'complexNoise_stillFieldDensity',
  stillFieldReach: 'complexNoise_stillFieldReach',
  stillFieldTrail: 'complexNoise_stillFieldTrail',
  stillFieldDepth: 'complexNoise_stillFieldDepth',
  stillFieldDwell: 'complexNoise_stillFieldDwell',
  stillFieldFps: 'complexNoise_stillFieldFps',
  stillFieldCode: 'complexNoise_stillFieldCode',
  stillFieldCallouts: 'complexNoise_stillFieldCallouts',
  stillFieldEdges: 'complexNoise_stillFieldEdges',
  stillGlassTransparent: 'complexNoise_stillGlassTransparent',
  uiChromeHidden: 'complexNoise_uiChromeHidden',
};
