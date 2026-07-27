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

// ----------------------------------------------------------
// DOM references
// ----------------------------------------------------------
const els = {
  playBtn: document.getElementById('playBtn'),
  volume: document.getElementById('volume'),
  timer: document.getElementById('timer'),
  status: document.getElementById('status'),
  typeButtons: Array.from(document.querySelectorAll('.type-btn')),
  themeToggle: document.getElementById('stillThemeToggle'),
  themeIcon: document.getElementById('stillThemeIcon'),
  themeLabel: document.getElementById('stillThemeLabel'),
  eqLow: document.getElementById('stillEqLow'),
  eqMid: document.getElementById('stillEqMid'),
  eqHigh: document.getElementById('stillEqHigh'),
  fieldToggle: document.getElementById('stillFieldToggle'),
  fieldIntensity: document.getElementById('stillFieldIntensity'),
  fieldSpeed: document.getElementById('stillFieldSpeed'),
  glassToggle: document.getElementById('stillGlassToggle'),
  fieldCanvas: document.getElementById('stillField'),
  fieldLab: document.getElementById('fieldLab'),
  fieldLabToggle: document.getElementById('fieldLabToggle'),
  fieldLabToggleText: document.querySelector('#fieldLabToggle > span:nth-child(2)'),
  fieldLabTabs: Array.from(document.querySelectorAll('[data-field-tab]')),
  fieldLabViews: Array.from(document.querySelectorAll('.field-lab-view')),
  fieldLabPulse: document.getElementById('fieldLabPulse'),
  fieldLabHealth: document.getElementById('fieldLabHealth'),
  fieldStats: {
    fps: document.getElementById('fieldStatFps'),
    frame: document.getElementById('fieldStatFrame'),
    nodes: document.getElementById('fieldStatNodes'),
    edges: document.getElementById('fieldStatEdges'),
    pairs: document.getElementById('fieldStatPairs'),
    degree: document.getElementById('fieldStatDegree'),
    density: document.getElementById('fieldStatDensity'),
    phase: document.getElementById('fieldStatPhase'),
    waveAngle: document.getElementById('fieldStatWaveAngle'),
    low: document.getElementById('fieldStatLow'),
    mid: document.getElementById('fieldStatMid'),
    high: document.getElementById('fieldStatHigh'),
    energy: document.getElementById('fieldStatEnergy'),
  },
  fieldMeters: {
    low: document.getElementById('fieldMeterLow'),
    mid: document.getElementById('fieldMeterMid'),
    high: document.getElementById('fieldMeterHigh'),
    energy: document.getElementById('fieldMeterEnergy'),
  },
};

/** Human-readable labels for the theme toggle, keyed by theme name. */
const THEME_LABELS = {
  dark: { icon: '◐', text: 'Still · Dark' },
  bone: { icon: '◑', text: 'Still · Bone' },
};

// ----------------------------------------------------------
// Renderers — the only place the UI is written to
// ----------------------------------------------------------

/** @param {ReturnType<typeof audio.getState>} state */
function renderAudio(state) {
  const { playBtn } = els;
  playBtn.classList.toggle('playing', state.isPlaying);
  playBtn.setAttribute('aria-label', state.isPlaying ? 'Pause noise' : 'Play noise');
  playBtn.setAttribute('aria-pressed', state.isPlaying ? 'true' : 'false');

  // innerHTML is only reassigned when the icon actually changes — rewriting it
  // every frame would drop the button's :focus ring mid-interaction.
  const icon = state.isPlaying ? PAUSE_ICON : PLAY_ICON;
  if (playBtn.dataset.icon !== (state.isPlaying ? 'pause' : 'play')) {
    playBtn.innerHTML = icon;
    playBtn.dataset.icon = state.isPlaying ? 'pause' : 'play';
  }

  els.typeButtons.forEach(btn => {
    const active = btn.dataset.type === state.type;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  els.status.textContent = state.status;
  els.volume.setAttribute('aria-valuenow', String(state.volume));
  els.volume.setAttribute('aria-valuetext', `${Math.round(state.volume * 100)} percent`);
}

/** @param {ReturnType<typeof stillField.getState>} state */
function renderStillField(state) {
  els.fieldToggle.setAttribute('aria-checked', state.enabled ? 'true' : 'false');
  els.fieldIntensity.disabled = !state.enabled;
  els.fieldSpeed.disabled = !state.enabled;
  els.fieldLabToggle.disabled = !state.enabled;
  els.fieldLabToggle.setAttribute('aria-expanded', state.telemetryEnabled ? 'true' : 'false');
  els.fieldLabToggle.classList.toggle('is-active', state.telemetryEnabled);
  els.fieldLabToggleText.textContent = state.telemetryEnabled ? 'Close Field Lab' : 'Open Field Lab';
  els.fieldLab.hidden = !state.telemetryEnabled;
  els.fieldIntensity.setAttribute('aria-valuetext', `${Math.round(state.intensity * 100)} percent`);
  els.fieldSpeed.setAttribute('aria-valuetext', `${state.speed.toFixed(2)} times`);

  els.fieldLabTabs.forEach(tab => {
    const active = tab.dataset.fieldTab === state.telemetryTab;
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.tabIndex = active ? 0 : -1;
  });
  els.fieldLabViews.forEach(view => {
    view.hidden = view.id !== `fieldLabView${state.telemetryTab[0].toUpperCase()}${state.telemetryTab.slice(1)}`;
  });

  if (!state.telemetryEnabled) return;
  const t = state.telemetry;
  const fpsStatus = t.fps >= 27 ? 'nominal' : t.fps >= 20 ? 'loaded' : 'strained';
  els.fieldLab.dataset.health = fpsStatus;
  els.fieldLabHealth.textContent = fpsStatus;
  els.fieldLabPulse.title = `${t.fps.toFixed(1)} frames per second`;

  els.fieldStats.fps.textContent = `${t.fps.toFixed(1)} fps`;
  els.fieldStats.frame.textContent = `${t.frameMs.toFixed(2)} ms`;
  els.fieldStats.nodes.textContent = String(t.nodeCount);
  els.fieldStats.edges.textContent = String(t.activeLinks);
  els.fieldStats.pairs.textContent = String(t.pairChecks);
  els.fieldStats.degree.textContent = t.meanDegree.toFixed(2);
  els.fieldStats.density.textContent = `${(t.density * 100).toFixed(2)}%`;
  els.fieldStats.phase.textContent = `${t.wavePhase.toFixed(1)}°`;
  els.fieldStats.waveAngle.textContent = `${t.waveAngle.toFixed(2)}°`;

  ['low', 'mid', 'high', 'energy'].forEach(key => {
    const value = Math.max(0, Math.min(1, t[key]));
    els.fieldStats[key].textContent = value.toFixed(3);
    els.fieldMeters[key].style.setProperty('--meter', value.toFixed(4));
  });
}

/** @param {ReturnType<typeof theme.getState>} state */
function renderTheme(state) {
  const meta = THEME_LABELS[state.theme] || THEME_LABELS.dark;
  if (els.themeIcon) els.themeIcon.textContent = meta.icon;
  if (els.themeLabel) els.themeLabel.textContent = meta.text;
  els.themeToggle.setAttribute('aria-pressed', state.theme === 'bone' ? 'true' : 'false');
  els.glassToggle.setAttribute('aria-checked', state.glass === 'ultra' ? 'true' : 'false');

  // Canvas colours come from CSS custom properties, so they must be re-read
  // whenever the token set changes.
  stillField.refreshThemeColors();
}

// ----------------------------------------------------------
// Restore control positions from persisted state
// ----------------------------------------------------------
function restoreControlValues() {
  els.volume.value = audio.getCurrentVolume();

  const timerHours = audio.getTimerHours();
  const hasOption = Array.from(els.timer.options).some(o => parseFloat(o.value) === timerHours);
  els.timer.value = hasOption ? String(timerHours) : '0';

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
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      toggle();
    }
  });
}

// ----------------------------------------------------------
// Event listeners — these only call into state modules
// ----------------------------------------------------------
function bindEvents() {
  els.playBtn.addEventListener('click', () => {
    if (audio.getIsPlaying()) {
      audio.stop(true);
    } else {
      audio.play()
        .then(() => stillField.startStillFieldLoop())
        .catch(err => console.error('[complex-noise] playback failed', err));
    }
  });

  els.typeButtons.forEach(btn => {
    btn.addEventListener('click', () => audio.setType(btn.dataset.type));
  });

  els.volume.addEventListener('input', e => audio.setVolume(parseFloat(e.target.value)));

  els.timer.addEventListener('change', () => audio.setTimerHours(els.timer.value));

  els.eqLow.addEventListener('input', e => audio.setStillEqLow(parseFloat(e.target.value)));
  els.eqMid.addEventListener('input', e => audio.setStillEqMid(parseFloat(e.target.value)));
  els.eqHigh.addEventListener('input', e => audio.setStillEqHigh(parseFloat(e.target.value)));

  bindSwitch(els.fieldToggle, () => {
    stillField.setStillFieldEnabled(!stillField.getStillFieldEnabled());
  });

  bindSwitch(els.glassToggle, () => theme.toggleGlassMode());

  els.fieldLabToggle.addEventListener('click', () => {
    stillField.setTelemetryEnabled(!stillField.getTelemetryEnabled());
  });

  els.fieldLabTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => stillField.setTelemetryTab(tab.dataset.fieldTab));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = els.fieldLabTabs[(index + direction + els.fieldLabTabs.length) % els.fieldLabTabs.length];
      stillField.setTelemetryTab(next.dataset.fieldTab);
      next.focus();
    });
  });

  els.fieldIntensity.addEventListener('input', e => {
    stillField.setStillFieldIntensity(parseFloat(e.target.value));
  });

  els.fieldSpeed.addEventListener('input', e => {
    stillField.setStillFieldSpeed(parseFloat(e.target.value));
  });

  els.themeToggle.addEventListener('click', () => theme.toggleStillTheme());

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

  // Debug surface for future agents and for the browser smoke tests.
  // Keep this in sync with tests/smoke.mjs.
  window.complexNoiseStill = {
    getTheme: theme.getStillTheme,
    getGlassMode: theme.getGlassMode,
    getEnergy: stillField.getStillEnergy,
    getMetrics: stillField.getStillAudioMetrics,
    getAudioState: audio.getState,
    getFieldState: stillField.getState,
    setTelemetryEnabled: stillField.setTelemetryEnabled,
    setTelemetryTab: stillField.setTelemetryTab,
    getIsPlaying: audio.getIsPlaying,
    getCurrentType: audio.getCurrentType,
    getAudioContext: audio.getAudioContext,
  };
}

// Module scripts are deferred, so the DOM is already parsed here.
boot();
