/**
 * Complex Noise — main application entry point.
 *
 * Wires DOM, event listeners, and the modular subsystems:
 *   audio.js        → Web Audio engine + EQ + timer + wake lock
 *   still-field.js  → canvas visualisation
 *   theme.js        → Still Theme (dark / bone)
 *   noise.js        → procedural buffer generation (used by audio)
 *   constants.js    → shared numbers & storage keys
 *
 * Designed so AI coding agents can edit one concern at a time
 * without having to scroll through a 40 kB monolith.
 */

import { PLAY_ICON, PAUSE_ICON, STORAGE_KEYS } from './constants.js';
import {
  play,
  stop,
  setType,
  setVolume,
  setStillEqLow,
  setStillEqMid,
  setStillEqHigh,
  setTimerHours,
  getIsPlaying,
  getCurrentType,
  getCurrentVolume,
  getStillEqValues,
} from './audio.js';
import {
  applyStillTheme,
  toggleStillTheme,
  getStillTheme,
} from './theme.js';
import {
  initStillField,
  setStillFieldEnabled,
  setStillFieldIntensity,
  getStillFieldEnabled,
  getStillFieldIntensity,
  startStillFieldLoop,
  handleResize,
  initStillFieldNodes,
  getStillEnergy,
} from './still-field.js';

// ----------------------------------------------------------
// DOM references
// ----------------------------------------------------------
const playBtn = document.getElementById('playBtn');
const volumeSlider = document.getElementById('volume');
const timerSelect = document.getElementById('timer');
const statusEl = document.getElementById('status');
const typeButtons = document.querySelectorAll('.type-btn');
const stillThemeToggle = document.getElementById('stillThemeToggle');
const stillEqLowSlider = document.getElementById('stillEqLow');
const stillEqMidSlider = document.getElementById('stillEqMid');
const stillEqHighSlider = document.getElementById('stillEqHigh');
const stillFieldToggle = document.getElementById('stillFieldToggle');
const stillFieldIntensitySlider = document.getElementById('stillFieldIntensity');
const stillFieldCanvas = document.getElementById('stillField');

// ----------------------------------------------------------
// Status helper
// ----------------------------------------------------------
function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// ----------------------------------------------------------
// Restore UI from persisted state
// ----------------------------------------------------------
function restoreUI() {
  // Volume
  volumeSlider.value = getCurrentVolume();

  // Type buttons
  const type = getCurrentType();
  typeButtons.forEach(btn => {
    const active = btn.dataset.type === type;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  // Timer
  const savedTimer = localStorage.getItem(STORAGE_KEYS.timer);
  if (savedTimer) timerSelect.value = savedTimer;

  // EQ
  const eq = getStillEqValues();
  stillEqLowSlider.value = eq.low;
  stillEqMidSlider.value = eq.mid;
  stillEqHighSlider.value = eq.high;

  // Still Field
  stillFieldIntensitySlider.value = getStillFieldIntensity();
  stillFieldToggle.setAttribute('aria-checked', getStillFieldEnabled() ? 'true' : 'false');
  stillFieldIntensitySlider.disabled = !getStillFieldEnabled();
  if (!getStillFieldEnabled()) {
    stillFieldCanvas.classList.add('still-field-off');
  }
}

// ----------------------------------------------------------
// Event listeners
// ----------------------------------------------------------
function bindEvents() {
  // Play / Pause
  playBtn.addEventListener('click', () => {
    if (getIsPlaying()) {
      stop(true, setStatus);
      playBtn.classList.remove('playing');
      playBtn.innerHTML = PLAY_ICON;
      playBtn.setAttribute('aria-label', 'Play noise');
    } else {
      play(setStatus).then(() => {
        playBtn.classList.add('playing');
        playBtn.innerHTML = PAUSE_ICON;
        playBtn.setAttribute('aria-label', 'Pause noise');
        startStillFieldLoop();
      });
    }
  });

  // Noise type
  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      setType(type, setStatus);
      typeButtons.forEach(b => {
        const active = b.dataset.type === type;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  });

  // Volume
  volumeSlider.addEventListener('input', (e) => {
    setVolume(parseFloat(e.target.value));
  });

  // Sleep timer
  timerSelect.addEventListener('change', () => {
    setTimerHours(timerSelect.value);
  });

  // Still EQ
  stillEqLowSlider.addEventListener('input', (e) => {
    setStillEqLow(parseFloat(e.target.value));
  });
  stillEqMidSlider.addEventListener('input', (e) => {
    setStillEqMid(parseFloat(e.target.value));
  });
  stillEqHighSlider.addEventListener('input', (e) => {
    setStillEqHigh(parseFloat(e.target.value));
  });

  // Still Field toggle + intensity
  stillFieldToggle.addEventListener('click', () => {
    const currentlyOn = stillFieldToggle.getAttribute('aria-checked') === 'true';
    setStillFieldEnabled(!currentlyOn);
  });

  stillFieldIntensitySlider.addEventListener('input', (e) => {
    setStillFieldIntensity(parseFloat(e.target.value));
  });

  // Theme toggle
  stillThemeToggle.addEventListener('click', () => {
    toggleStillTheme(() => {
      // Re-seed nodes so colours update immediately with the new theme
      initStillFieldNodes(true);
    });
  });

  // Prevent accidental zoom / scroll issues on some Android browsers
  document.addEventListener('gesturestart', e => e.preventDefault());

  // Still Field resize
  window.addEventListener('resize', handleResize);
}

// ----------------------------------------------------------
// Boot
// ----------------------------------------------------------
function boot() {
  // Apply persisted theme first (also updates meta tags)
  applyStillTheme(getStillTheme());

  restoreUI();
  bindEvents();

  // Init Still Field canvas
  initStillField(stillFieldCanvas);

  // Expose a few helpers for future agents / debugging (optional)
  window.complexNoiseStill = {
    getTheme: getStillTheme,
    getEnergy: getStillEnergy,
    getIsPlaying,
    getCurrentType,
  };
}

// Run when DOM is ready (module scripts are deferred by default)
boot();
