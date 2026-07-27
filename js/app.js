/**
 * Complex Noise — main application entry point.
 *
 * This is the only module that touches the app's DOM. Everything else owns
 * state and publishes it:
 *
 *   audio.js        → Web Audio engine + EQ + timer + wake lock
 *   still-field.js  → canvas visualisation (owns only its own canvas)
 *   theme.js        → Still Theme (dark / bone)
 *   noise.js        → procedural buffer generation (used by audio)
 *   storage.js      → safe, typed localStorage access
 *   constants.js    → shared numbers, defaults & storage keys
 *   ui-chrome.js    → immersion hide / show of the main controls
 *
 * ## The rule that keeps this app correct
 *
 * Event handlers only *call* into the state modules. They never update the UI
 * directly. Rendering happens exclusively in the `subscribe()` callbacks
 * below, because state changes for reasons that have no click behind them —
 * the sleep timer stopping playback overnight is the obvious one. Updating the
 * play button inside its own click handler is how that button ends up frozen
 * on "pause" after a timer fires.
 */

import { PLAY_ICON, PAUSE_ICON } from './constants.js';
import * as audio from './audio.js';
import * as stillField from './still-field.js';
import * as theme from './theme.js';
import * as uiChrome from './ui-chrome.js';

/** Compact play/pause icons for the minimised chrome (slightly smaller). */
const MINI_PLAY_ICON = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const MINI_PAUSE_ICON = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

/** Icon + label for the floating restore control. */
const SHOW_CONTROLS_HTML = `
  <svg class="chrome-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16"/>
  </svg>
  <span class="chrome-toggle-text">Show controls</span>
`;

// ----------------------------------------------------------
// DOM references
// ----------------------------------------------------------
const els = {
  playBtn: document.getElementById('playBtn'),
  minimisedPlayBtn: document.getElementById('minimisedPlayBtn'),
  volume: document.getElementById('volume'),
  timer: document.getElementById('timer'),
  timerValue: document.getElementById('timerValue'),
  status: document.getElementById('status'),
  minimisedStatus: document.getElementById('minimisedStatus'),
  typeButtons: Array.from(document.querySelectorAll('.type-btn')),
  themeSegs: Array.from(document.querySelectorAll('.theme-seg')),
  eqLow: document.getElementById('stillEqLow'),
  eqMid: document.getElementById('stillEqMid'),
  eqHigh: document.getElementById('stillEqHigh'),
  fieldToggle: document.getElementById('stillFieldToggle'),
  fieldIntensity: document.getElementById('stillFieldIntensity'),
  fieldSpeed: document.getElementById('stillFieldSpeed'),
  glassToggle: document.getElementById('stillGlassToggle'),
  fieldCanvas: document.getElementById('stillField'),
  /** Floating restore button — only visible when chrome is hidden. */
  chromeToggle: document.getElementById('uiChromeToggle'),
  /** Dedicated minimise action button inside the Still Field card. */
  chromeMinimise: document.getElementById('uiChromeMinimise'),
  minimisedChrome: document.getElementById('minimisedChrome'),
  // Package D/E foundations — toggles already in index.html
  fieldNerdToggle: document.getElementById('stillFieldNerdToggle'),
  fieldTextureToggle: document.getElementById('stillFieldTextureToggle'),
  stillTextureEl: document.querySelector('.still-texture'),
};

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

/** Format timer hours for display and aria-valuetext. */
function formatTimerHours(hours) {
  const h = Number(hours) || 0;
  if (h <= 0) return 'Off';
  if (h === 1) return '1 h';
  // Keep half-hours tidy: 1.5 → "1.5 h", 2 → "2 h"
  const label = Number.isInteger(h) ? String(h) : h.toFixed(1);
  return `${label} h`;
}

/** Sync the timer range value, live readout, and ARIA attributes. */
function updateTimerDisplay(hours) {
  const h = Math.max(0, Number(hours) || 0);
  if (els.timer) {
    els.timer.value = String(h);
    els.timer.setAttribute('aria-valuenow', String(h));
    els.timer.setAttribute('aria-valuetext', formatTimerHours(h));
  }
  if (els.timerValue) {
    els.timerValue.textContent = formatTimerHours(h);
  }
}

// ----------------------------------------------------------
// Renderers — the only place the UI is written to
// ----------------------------------------------------------

/** @param {ReturnType<typeof audio.getState>} state */
function renderAudio(state) {
  const { playBtn, minimisedPlayBtn } = els;

  // Main play button
  playBtn.classList.toggle('playing', state.isPlaying);
  playBtn.setAttribute('aria-label', state.isPlaying ? 'Pause noise' : 'Play noise');
  playBtn.setAttribute('aria-pressed', state.isPlaying ? 'true' : 'false');

  const icon = state.isPlaying ? PAUSE_ICON : PLAY_ICON;
  if (playBtn.dataset.icon !== (state.isPlaying ? 'pause' : 'play')) {
    playBtn.innerHTML = icon;
    playBtn.dataset.icon = state.isPlaying ? 'pause' : 'play';
  }

  // Minimised play button (mirrors the same state)
  if (minimisedPlayBtn) {
    minimisedPlayBtn.classList.toggle('playing', state.isPlaying);
    minimisedPlayBtn.setAttribute('aria-label', state.isPlaying ? 'Pause noise' : 'Play noise');
    minimisedPlayBtn.setAttribute('aria-pressed', state.isPlaying ? 'true' : 'false');
    const miniIcon = state.isPlaying ? MINI_PAUSE_ICON : MINI_PLAY_ICON;
    if (minimisedPlayBtn.dataset.icon !== (state.isPlaying ? 'pause' : 'play')) {
      minimisedPlayBtn.innerHTML = miniIcon;
      minimisedPlayBtn.dataset.icon = state.isPlaying ? 'pause' : 'play';
    }
  }

  els.typeButtons.forEach(btn => {
    const active = btn.dataset.type === state.type;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  // Status appears in both the main card and the minimised cluster
  if (els.status) els.status.textContent = state.status;
  if (els.minimisedStatus) els.minimisedStatus.textContent = state.status;

  els.volume.setAttribute('aria-valuenow', String(state.volume));
  els.volume.setAttribute('aria-valuetext', `${Math.round(state.volume * 100)} percent`);

  // Keep the timer readout in sync when the engine changes the value
  updateTimerDisplay(state.timerHours);
}

/** @param {ReturnType<typeof stillField.getState>} state */
function renderStillField(state) {
  els.fieldToggle.setAttribute('aria-checked', state.enabled ? 'true' : 'false');
  els.fieldIntensity.disabled = !state.enabled;
  els.fieldSpeed.disabled = !state.enabled;
  els.fieldIntensity.setAttribute('aria-valuetext', `${Math.round(state.intensity * 100)} percent`);
  els.fieldSpeed.setAttribute('aria-valuetext', `${state.speed.toFixed(2)} times`);

  // Package D/E — info labels + background texture toggles
  if (els.fieldNerdToggle) {
    els.fieldNerdToggle.setAttribute('aria-checked', state.nerd ? 'true' : 'false');
    // Labels are painted on the canvas, so the control is dead while the field
    // is off — disable it alongside the sliders rather than leaving it live.
    els.fieldNerdToggle.disabled = !state.enabled;
  }
  // The texture is a separate CSS overlay, not part of the canvas, so it stays
  // available even with the field switched off.
  if (els.fieldTextureToggle) {
    els.fieldTextureToggle.setAttribute('aria-checked', state.texture ? 'true' : 'false');
  }
  // Clearing the inline value hands opacity back to the per-theme CSS variable.
  if (els.stillTextureEl) {
    els.stillTextureEl.style.opacity = state.texture ? '' : '0';
  }
}

/** @param {ReturnType<typeof theme.getState>} state */
function renderTheme(state) {
  // Segmented control — mark the active side
  els.themeSegs.forEach(btn => {
    const active = btn.dataset.theme === state.theme;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  els.glassToggle.setAttribute('aria-checked', state.glass === 'ultra' ? 'true' : 'false');

  // Canvas colours come from CSS custom properties, so they must be re-read
  // whenever the token set changes.
  stillField.refreshThemeColors();
}

/** @param {ReturnType<typeof uiChrome.getState>} state */
function renderChrome(state) {
  const hidden = state.hidden;
  document.documentElement.setAttribute('data-ui-chrome', hidden ? 'hidden' : 'visible');

  // Floating restore is the only way back; keep it correctly labelled and
  // out of the tab order while chrome is visible.
  if (els.chromeToggle) {
    const label = 'Show controls';
    els.chromeToggle.setAttribute('aria-label', label);
    els.chromeToggle.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    els.chromeToggle.title = label;
    // Always keep the text + icon markup (it is static once written).
    if (!els.chromeToggle.querySelector('.chrome-toggle-text')) {
      els.chromeToggle.innerHTML = SHOW_CONTROLS_HTML;
    }
    els.chromeToggle.tabIndex = hidden ? 0 : -1;
    els.chromeToggle.setAttribute('aria-hidden', hidden ? 'false' : 'true');
  }

  if (els.minimisedChrome) {
    els.minimisedChrome.setAttribute('aria-hidden', hidden ? 'false' : 'true');
  }

  // After restore, move focus to the minimise button so keyboard users
  // are not stranded on the now-inert floating control (or the body).
  if (!hidden && els.chromeMinimise) {
    const active = document.activeElement;
    if (active === document.body || active === els.chromeToggle || active === els.minimisedPlayBtn) {
      els.chromeMinimise.focus({ preventScroll: true });
    }
  }
}

// ----------------------------------------------------------
// Restore control positions from persisted state
// ----------------------------------------------------------
function restoreControlValues() {
  els.volume.value = audio.getCurrentVolume();

  updateTimerDisplay(audio.getTimerHours());

  const eq = audio.getStillEqValues();
  els.eqLow.value = eq.low;
  els.eqMid.value = eq.mid;
  els.eqHigh.value = eq.high;

  els.fieldIntensity.value = stillField.getStillFieldIntensity();
  els.fieldSpeed.value = stillField.getStillFieldSpeed();
}

/**
 * Wire a `role="switch"` button. `<button>` gives Enter for free, but Space
 * needs the keydown guard or the page scrolls instead of toggling.
 * @param {HTMLElement} el
 * @param {() => void} toggle
 */
function bindSwitch(el, toggle) {
  if (!el) return;
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      toggle();
    }
  });
}

/** Shared play / pause action used by both the main and minimised buttons. */
function togglePlayback() {
  if (audio.getIsPlaying()) {
    audio.stop(true);
  } else {
    audio.play()
      .then(() => stillField.startStillFieldLoop())
      .catch(err => console.error('[complex-noise] playback failed', err));
  }
}

// ----------------------------------------------------------
// Event listeners — these only call into state modules
// ----------------------------------------------------------
function bindEvents() {
  els.playBtn.addEventListener('click', togglePlayback);
  if (els.minimisedPlayBtn) {
    els.minimisedPlayBtn.addEventListener('click', togglePlayback);
  }

  els.typeButtons.forEach(btn => {
    btn.addEventListener('click', () => audio.setType(btn.dataset.type));
  });

  els.volume.addEventListener('input', e => audio.setVolume(parseFloat(e.target.value)));

  // Sleep timer is now a continuous range (0–10 h, 0.5 steps)
  els.timer.addEventListener('input', e => {
    const hours = parseFloat(e.target.value) || 0;
    updateTimerDisplay(hours);
    audio.setTimerHours(hours);
  });

  els.eqLow.addEventListener('input', e => audio.setStillEqLow(parseFloat(e.target.value)));
  els.eqMid.addEventListener('input', e => audio.setStillEqMid(parseFloat(e.target.value)));
  els.eqHigh.addEventListener('input', e => audio.setStillEqHigh(parseFloat(e.target.value)));

  bindSwitch(els.fieldToggle, () => {
    stillField.setStillFieldEnabled(!stillField.getStillFieldEnabled());
  });

  bindSwitch(els.glassToggle, () => theme.toggleGlassMode());

  // Package D/E wiring
  bindSwitch(els.fieldNerdToggle, () => {
    stillField.setStillFieldNerd(!stillField.getStillFieldNerd());
  });
  bindSwitch(els.fieldTextureToggle, () => {
    stillField.setStillFieldTexture(!stillField.getStillFieldTexture());
  });

  els.fieldIntensity.addEventListener('input', e => {
    stillField.setStillFieldIntensity(parseFloat(e.target.value));
  });

  els.fieldSpeed.addEventListener('input', e => {
    stillField.setStillFieldSpeed(parseFloat(e.target.value));
  });

  // Theme segmented control — each side sets the theme directly
  els.themeSegs.forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.theme;
      if (next) theme.applyStillTheme(next);
    });
  });

  // Dedicated minimise button — always hides chrome (restore via floating control or Escape)
  if (els.chromeMinimise) {
    els.chromeMinimise.addEventListener('click', () => uiChrome.setHidden(true));
  }

  // Floating restore button (only present / interactive when hidden).
  if (els.chromeToggle) {
    els.chromeToggle.addEventListener('click', () => uiChrome.setHidden(false));
  }

  // Escape always restores chrome when hidden — desktop / keyboard safety net.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && uiChrome.isHidden()) {
      e.preventDefault();
      uiChrome.setHidden(false);
    }
  });

  // Prevent accidental pinch-zoom on some Android browsers
  document.addEventListener('gesturestart', e => e.preventDefault());

  window.addEventListener('resize', stillField.handleResize);
  window.addEventListener('orientationchange', stillField.handleResize);
}

// ----------------------------------------------------------
// Boot
// ----------------------------------------------------------
function boot() {
  // Apply the persisted theme before anything measures colours.
  theme.applyStillTheme(theme.getStillTheme());

  restoreControlValues();
  bindEvents();

  stillField.initStillField(els.fieldCanvas);

  // subscribe() fires immediately, so this is also the initial render.
  audio.subscribe(renderAudio);
  stillField.subscribe(renderStillField);
  theme.subscribe(renderTheme);
  uiChrome.subscribe(renderChrome);

  // Debug surface for future agents and for the browser smoke tests.
  // Keep this in sync with tests/run.mjs.
  window.complexNoiseStill = {
    getTheme: theme.getStillTheme,
    getGlassMode: theme.getGlassMode,
    getEnergy: stillField.getStillEnergy,
    getMetrics: stillField.getStillAudioMetrics,
    getAudioState: audio.getState,
    getFieldState: stillField.getState,
    getChromeState: uiChrome.getState,
    getIsPlaying: audio.getIsPlaying,
    getCurrentType: audio.getCurrentType,
    getAudioContext: audio.getAudioContext,
  };
}

// Module scripts are deferred, so the DOM is already parsed here.
boot();
